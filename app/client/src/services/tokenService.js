// src/services/tokenService.js
import { supabase } from '../lib/supabase';

export async function buyFcWithSolBackend({
  userId,
  amountUsd,
  amountSol,
  txSignature,
}) {
  const { data, error } = await supabase.functions.invoke('buy-fc-with-sol', {
    body: {
      userId,
      amountUsd,
      amountSol,
      txSignature,
    },
  });

  if (error) {
    console.error('[TokenService] buy-fc-with-sol error:', error);
    throw error;
  }

  return data;
}

/**
 * Mint FC tokens to user's account
 * This calls the backend to credit FC tokens after SOL payment
 * @param {Object} params
 * @param {string} params.userPublicKey - User's Solana wallet address
 * @param {number} params.amountFc - Amount of FC tokens to mint
 * @param {string} params.userId - User ID in database
 * @param {string} params.solTxSignature - SOL transaction signature as proof
 * @returns {string} Transaction signature or confirmation
 */
export async function mintFcTokensToUser({ userPublicKey, amountFc, userId, solTxSignature }) {
  try {
    // Call Supabase edge function to credit FC tokens
    const { data, error } = await supabase.functions.invoke('buy-fc-with-sol', {
      body: {
        userId,
        amountUsd: amountFc, // 1 USD = 1 FC
        amountSol: 0, // Not needed for minting, just for record
        txSignature: solTxSignature,
        userWalletAddress: userPublicKey,
        fcAmount: amountFc
      },
    });

    if (error) {
      console.error('[TokenService] mint FC tokens error:', error);
      throw new Error(error.message || 'Failed to mint FC tokens');
    }

    return data?.signature || 'minted';
  } catch (error) {
    console.error('mintFcTokensToUser error:', error);
    throw error;
  }
}
