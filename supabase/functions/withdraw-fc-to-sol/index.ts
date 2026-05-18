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
    } catch (_err) {
      return jsonResponse(
        {
          success: false,
          error: 'Treasury wallet is not configured. Please contact support.',
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
          error: 'Insufficient treasury balance to complete the withdrawal. Please try again later.',
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
      // SOL was already sent — admin must reconcile manually
      return jsonResponse(
        {
          success: false,
          error: 'SOL was sent but wallet balance update failed. Please contact support with your transaction reference.',
          txSignature,
        },
        500
      )
    }

    const metadata = {
      exchange_rate_fc_per_sol: fcPerSol,
      settlement: 'onchain',
      source: 'edge_function',
      function: 'withdraw-fc-to-sol',
      tx_signature: txSignature,
      last_valid_block_height: lastValidBlockHeight,
    }

    // Record in fund_transactions, token_transactions, transactions (non-critical)
    await supabase.from('fund_transactions').insert({
      user_id: creator.id,
      amount_fc: amountFc,
      amount_sol: amountSol,
      solana_tx_signature: txSignature,
      status: 'completed',
      metadata,
    })

    await supabase.from('token_transactions').insert({
      user_id: creator.id,
      amount_fc: amountFc,
      type: 'withdraw_fc',
      metadata: { ...metadata, amount_sol: amountSol, status: 'completed' },
    })

    await supabase.from('transactions').insert({
      user_id: creator.id,
      amount: amountFc,
      type: 'withdraw_fc',
      description: `Withdrew ${amountFc} FC to Solana wallet (${amountSol} SOL). Tx: ${txSignature}`,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: creator.id,
      action: 'WITHDRAWAL_COMPLETED',
      target_type: 'wallet',
      target_id: creator.id,
      metadata: { amount_fc: amountFc, amount_sol: amountSol, tx_signature: txSignature },
    })

    return jsonResponse(
      {
        success: true,
        amountFc,
        amountSol,
        exchangeRate: fcPerSol,
        status: 'completed',
        txSignature,
        wallet: {
          balance_fc: newBalanceFc,
          locked_fc: Number(creatorWallet.locked_fc || 0),
        },
      },
      200
    )
  } catch (_err) {
    return jsonResponse(
      { success: false, error: 'Internal server error' },
      500
    )
  }
})