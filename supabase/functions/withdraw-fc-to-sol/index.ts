// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}


// Accepts Keypair implementation and bs58 codec (dynamically imported)
type PublicKeyLike = {
  toBase58(): string
  equals(other: unknown): boolean
  toJSON(): string
  toBytes(): Uint8Array
  toBuffer(): Uint8Array
  [Symbol.toStringTag]: string
  encode(): Uint8Array
}
type KeypairInstance = { publicKey: PublicKeyLike; secretKey: Uint8Array }
type KeypairCtor = { fromSecretKey(secret: Uint8Array): KeypairInstance }
type Bs58 = { decode(s: string): Uint8Array }
const getTreasuryKeypair = (Keypair: KeypairCtor, bs58: Bs58): KeypairInstance => {
  const jsonKey = Deno.env.get('TREASURY_PRIVATE_KEY_JSON')

  if (jsonKey) {
    const secret = JSON.parse(jsonKey)

    if (!Array.isArray(secret)) {
      throw new Error('TREASURY_PRIVATE_KEY_JSON must be a JSON array of numbers')
    }

    return Keypair.fromSecretKey(Uint8Array.from(secret))
  }

  const base58Key = Deno.env.get('TREASURY_PRIVATE_KEY_BASE58')

  if (base58Key) {
    return Keypair.fromSecretKey(bs58.decode(base58Key))
  }

  throw new Error(
    'Treasury signing key not configured. Set TREASURY_PRIVATE_KEY_JSON or TREASURY_PRIVATE_KEY_BASE58.'
  )
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse(
        {
          success: false,
          error: 'Method not allowed',
        },
        405
      )
    }

    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return jsonResponse(
        {
          success: false,
          error: 'Missing authorization header',
        },
        401
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Server misconfigured. Missing Supabase environment variables.',
        },
        500
      )
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const token = authHeader.replace('Bearer ', '')

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid authentication',
        },
        401
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const amountFc = Number(body?.amountFc)

    if (!amountFc || amountFc <= 0) {
      return jsonResponse(
        {
          success: false,
          error: 'amountFc must be a positive number',
        },
        400
      )
    }

    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, role, wallet_address')
      .eq('id', user.id)
      .single()

    if (creatorError || !creator) {
      return jsonResponse(
        {
          success: false,
          error: 'Creator profile not found',
        },
        404
      )
    }

    if (creator.role !== 'creator') {
      return jsonResponse(
        {
          success: false,
          error: 'Only creators can withdraw funds',
        },
        403
      )
    }

    if (!creator.wallet_address) {
      return jsonResponse(
        {
          success: false,
          error: 'No Solana wallet address linked to your profile',
        },
        400
      )
    }

    // defer creating PublicKey until after dynamic Solana import

    const { data: creatorWallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id, balance_fc, locked_fc')
      .eq('user_id', creator.id)
      .single()

    if (walletError || !creatorWallet) {
      return jsonResponse(
        {
          success: false,
          error: 'Creator wallet not found',
        },
        404
      )
    }

    if (Number(creatorWallet.balance_fc) < amountFc) {
      return jsonResponse(
        {
          success: false,
          error: 'Insufficient FC balance',
          available: Number(creatorWallet.balance_fc),
          requested: amountFc,
        },
        400
      )
    }

    /**
     * Supports both names:
     * FC_PER_SOL = newer/simple name
     * FC_TO_SOL_RATE = your existing Supabase secret name
     */
    const fcPerSol = Number(
      Deno.env.get('FC_PER_SOL') ??
      Deno.env.get('FC_TO_SOL_RATE') ??
      '100'
    )

    if (!fcPerSol || fcPerSol <= 0) {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid FC/SOL rate configuration',
        },
        500
      )
    }

    // Dynamically import Solana libraries to avoid heavy worker startup cost
    const solanaWeb3 = await import('https://esm.sh/@solana/web3.js@1.95.3')
    const bs58Module = await import('https://esm.sh/bs58@5.0.0')
    const bs58 = (bs58Module && (bs58Module.default ?? bs58Module))

    const {
      Connection,
      Keypair: KeypairImpl,
      LAMPORTS_PER_SOL,
      PublicKey,
      SystemProgram,
      Transaction,
      sendAndConfirmTransaction,
    } = solanaWeb3

    let destinationPubkey
    try {
      destinationPubkey = new PublicKey(creator.wallet_address)
    } catch (_err) {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid Solana wallet address linked to your profile',
        },
        400
      )
    }

    const amountSol = Number((amountFc / fcPerSol).toFixed(6))
    const amountLamports = Math.round(amountSol * LAMPORTS_PER_SOL)

    if (amountLamports <= 0) {
      return jsonResponse(
        {
          success: false,
          error: 'Withdraw amount is too small to send on-chain',
        },
        400
      )
    }

    let treasuryKeypair
    try {
      treasuryKeypair = getTreasuryKeypair(KeypairImpl, bs58)
    } catch (err) {
      console.error('Treasury keypair error:', err)
      return jsonResponse(
        {
          success: false,
          error: 'Treasury wallet is not configured correctly',
          details: String(err),
        },
        500
      )
    }

    const treasuryPubkey = treasuryKeypair.publicKey

    const solanaNetwork = Deno.env.get('SOLANA_NETWORK') ?? 'devnet'

    const rpcUrl =
      Deno.env.get('SOLANA_RPC_URL') ??
      Deno.env.get('HELIUS_RPC_URL') ??
      (solanaNetwork === 'mainnet-beta'
        ? 'https://api.mainnet-beta.solana.com'
        : `https://api.${solanaNetwork}.solana.com`)

    const connection = new Connection(rpcUrl, 'confirmed')

    const treasuryBalance = await connection.getBalance(treasuryPubkey)

    const feeBufferLamports = 10_000

    if (treasuryBalance < amountLamports + feeBufferLamports) {
      return jsonResponse(
        {
          success: false,
          error: 'Treasury has insufficient SOL to complete the withdrawal',
          treasuryBalanceSol: treasuryBalance / LAMPORTS_PER_SOL,
          requestedSol: amountSol,
          treasuryWallet: treasuryPubkey.toBase58(),
        },
        400
      )
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryPubkey,
        toPubkey: destinationPubkey,
        lamports: amountLamports,
      })
    )

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed')

    tx.recentBlockhash = blockhash
    tx.feePayer = treasuryPubkey

    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [treasuryKeypair],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    )

    const newBalanceFc = Number(creatorWallet.balance_fc) - amountFc

    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({
        balance_fc: newBalanceFc,
      })
      .eq('user_id', creator.id)

    if (updateWalletError) {
      console.error('Critical wallet update error after SOL sent:', updateWalletError)

      return jsonResponse(
        {
          success: false,
          error:
            'SOL was sent, but failed to update FC wallet balance. Manual admin review required.',
          txSignature,
          amountFc,
          amountSol,
          destinationWallet: creator.wallet_address,
          details: updateWalletError,
        },
        500
      )
    }

    const metadata = {
      destination_wallet: creator.wallet_address,
      initiated_by: creator.id,
      exchange_rate_fc_per_sol: fcPerSol,
      settlement: 'onchain',
      source: 'edge_function',
      function: 'withdraw-fc-to-sol',
      tx_signature: txSignature,
      rpc_url: rpcUrl,
      last_valid_block_height: lastValidBlockHeight,
      treasury_wallet: treasuryPubkey.toBase58(),
    }

    const warnings: string[] = []

    const { error: fundTxError } = await supabase
      .from('fund_transactions')
      .insert({
        user_id: creator.id,
        amount_fc: amountFc,
        amount_sol: amountSol,
        solana_tx_signature: txSignature,
        status: 'completed',
        metadata,
      })

    if (fundTxError) {
      console.error('fund_transactions insert error:', fundTxError)
      warnings.push('Failed to create fund transaction record')
    }

    const { error: tokenTxError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: creator.id,
        amount_fc: amountFc,
        type: 'withdraw_fc',
        metadata: {
          ...metadata,
          amount_sol: amountSol,
          solana_tx_signature: txSignature,
          status: 'completed',
        },
      })

    if (tokenTxError) {
      console.error('token_transactions insert error:', tokenTxError)
      warnings.push('Failed to create token transaction record')
    }

    const txPayload = {
      user_id: creator.id,
      amount: amountFc,
      type: 'withdraw_fc',
      description: `Creator withdrew ${amountFc} FC to Solana wallet (${amountSol} SOL equivalent). Tx: ${txSignature}`,
    }

    console.debug('transactions insert payload:', JSON.stringify(txPayload))

    const { error: txError } = await supabase
      .from('transactions')
      .insert(txPayload)

    if (txError) {
      console.error('transactions insert error:', txError)
      warnings.push('Failed to create transaction history record')
    }

    return jsonResponse(
      {
        success: true,
        amountFc,
        amountSol,
        exchangeRate: fcPerSol,
        destinationWallet: creator.wallet_address,
        treasuryWallet: treasuryPubkey.toBase58(),
        status: 'completed',
        txSignature,
        warnings,
        wallet: {
          balance_fc: newBalanceFc,
          locked_fc: Number(creatorWallet.locked_fc || 0),
        },
      },
      200
    )
  } catch (err) {
    console.error('withdraw-fc-to-sol error:', err)

    return jsonResponse(
      {
        success: false,
        error: 'Internal server error',
        details: String(err),
      },
      500
    )
  }
})