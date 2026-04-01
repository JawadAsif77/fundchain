// filepath: supabase/functions/analyze-wallet-footprint/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.98.2';

// --- Constants for Analysis ---

// Known reputable DeFi / NFT Marketplace Program IDs on Solana
const REPUTABLE_PROGRAM_IDS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator
  'M2mx93ekt1fmXSVkTrUL9xVFHkmc8HTNaMmb9ccB8Vp', // Marinade Finance
  'MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8', // Magic Eden
  'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAszQLYveE', // Tensor
  // Add more known program IDs here
]);

const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
const MIN_TRANSACTIONS_FOR_LOW_RISK = 50;
const MIN_UNIQUE_INTERACTIONS = 5;

// --- Main Handler ---

serve(async (req) => {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'walletAddress is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use the Helius RPC endpoint for better performance and reliability
    // You should get a free API key from helius.dev
    const rpcUrl = Deno.env.get('HELIUS_RPC_URL');
    if (!rpcUrl) throw new Error('HELIUS_RPC_URL is not set in environment variables.');
    
    const connection = new Connection(rpcUrl, 'confirmed');
    const publicKey = new PublicKey(walletAddress);

    // --- On-Chain Data Fetching ---
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 100 });
    if (signatures.length === 0) {
      return new Response(JSON.stringify({
        riskScore: 95, // Very high risk for a wallet with no history
        explanation: 'This wallet has no transaction history.',
        details: {
          walletAgeScore: 100,
          transactionVolumeScore: 100,
          dappInteractionScore: 100,
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const transactions = await connection.getParsedTransactions(
      signatures.map((s: { signature: string }) => s.signature),
      { maxSupportedTransactionVersion: 0 }
    );

    // --- Risk Analysis Logic ---
    let riskScore = 0;
    const explanations: string[] = [];

    // 1. Wallet Age Analysis (Weight: 30%)
    const firstTx = signatures[signatures.length - 1];
    const walletAgeSeconds = Date.now() / 1000 - firstTx.blockTime!;
    let walletAgeScore = 0;
    if (walletAgeSeconds < ONE_MONTH_IN_SECONDS) {
      walletAgeScore = 80;
      explanations.push('Wallet is less than 1 month old, indicating it might be newly created for this project.');
    } else {
      walletAgeScore = 10;
      explanations.push('Wallet has an established history of over 1 month.');
    }
    riskScore += walletAgeScore * 0.30;

    // 2. Transaction Volume & Activity (Weight: 30%)
    let transactionVolumeScore = 0;
    if (signatures.length < MIN_TRANSACTIONS_FOR_LOW_RISK) {
      transactionVolumeScore = 75;
      explanations.push(`Low transaction count (${signatures.length}) suggests limited on-chain activity.`);
    } else {
      transactionVolumeScore = 20;
      explanations.push(`Healthy transaction count (${signatures.length}) indicates regular on-chain activity.`);
    }
    riskScore += transactionVolumeScore * 0.30;

    // 3. dApp Interaction Analysis (Weight: 40%)
    const interactedPrograms = new Set<string>();
    for (const tx of transactions) {
      if (!tx) continue;
      for (const ix of tx.transaction.message.instructions) {
        if ('programId' in ix && ix.programId) {
          interactedPrograms.add(ix.programId.toBase58());
        }
      }
    }

    const reputableInteractions = [...interactedPrograms].filter(id => REPUTABLE_PROGRAM_IDS.has(id));
    let dappInteractionScore = 0;
    if (reputableInteractions.length === 0) {
      dappInteractionScore = 90;
      explanations.push('Wallet has not interacted with any known reputable dApps. This is a major red flag.');
    } else if (reputableInteractions.length < MIN_UNIQUE_INTERACTIONS) {
      dappInteractionScore = 40;
      explanations.push(`Wallet has interacted with only a few reputable dApps (${reputableInteractions.length}).`);
    } else {
      dappInteractionScore = 0;
      explanations.push(`Wallet shows a healthy history of interacting with ${reputableInteractions.length} reputable dApps.`);
    }
    riskScore += dappInteractionScore * 0.40;

    // --- Final Response ---
    const finalRiskScore = Math.round(riskScore);
    const responsePayload = {
      riskScore: finalRiskScore,
      explanation: explanations.join(' '),
      details: {
        walletAgeScore,
        transactionVolumeScore,
        dappInteractionScore,
        reputableInteractionsCount: reputableInteractions.length,
        totalTransactions: signatures.length,
        walletAgeDays: Math.round(walletAgeSeconds / (24 * 60 * 60)),
      }
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
