import { sendSolToTreasury } from '../lib/solana';
import { supabase } from '../lib/supabase';

/**
 * Complete SOL → FC swap workflow
 * 1. Send SOL to treasury wallet via Phantom
 * 2. Call buy-fc-tokens edge function to credit FC tokens
 * 
 * @param {Object} wallet - Connected Phantom wallet object
 * @param {string} userId - User ID from auth
 * @param {number} amountSol - Amount of SOL to swap
 * @returns {Promise<Object>} Result with signature and updated balance
 */
export async function swapSolForFc(wallet, userId, amountSol) {
  try {
    // Step 1: Send SOL to treasury wallet
    const solSignature = await sendSolToTreasury(wallet, amountSol);
    console.log('SOL sent to treasury:', solSignature);

    // Step 2: Calculate FC amount (conversion rate from env or default)
    const fcPerSol = Number(import.meta.env.VITE_FC_PER_SOL) || 100;
    const amountFc = amountSol * fcPerSol;

    // Step 3: Call Supabase edge function to update wallet balance
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/buy-fc-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        userId,
        amountSol,
        amountFc,
        txSignature: solSignature
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to credit FC tokens');
    }

    return {
      success: true,
      solSignature,
      amountFc,
      newBalance: result.newBalance
    };

  } catch (error) {
    console.error('swapSolForFc error:', error);
    throw error;
  }
}
