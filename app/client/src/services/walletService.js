import { supabase } from '../lib/supabase';

// Helper to handle the response from Supabase invoke
const handleResponse = (data, error) => {
  if (error) {
    const msg = error.context?.message || error.message || 'Unknown error';
    console.error('Wallet Service Error:', msg);
    return { success: false, error: msg };
  }
  return { success: true, data };
};

/**
 * Get wallet balance for a user
 */
export async function getWallet(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('get-wallet', {
      body: { userId }
    });
    
    if (error) return handleResponse(null, error);
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message, balance: 0 };
  }
}

/**
 * Buy FC tokens with USD (Dummy/Test)
 * Uses Supabase invoke to automatically handle Authentication
 */
export async function buyTokens(userId, usdAmount) {
  try {
    const { data, error } = await supabase.functions.invoke('exchange-usd-to-fc', {
      body: { amountUsd: Number(usdAmount) }
    });

    if (error) return handleResponse(null, error);
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Helper to preview conversion rate
 */
export async function exchangeUsdToFc(usdAmount) {
  return new Promise((resolve) => {
    resolve({ 
      fc: Number(usdAmount), 
      rate: 1, 
      fee: 0 
    });
  });
}

/**
 * Get transaction history
 * FIXED: Always returns { success: true, data: [] } structure
 */
export async function getTransactions(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('get-transactions', {
      body: { userId }
    });

    if (error) return { success: false, data: [], error: error.message };
    
    // Ensure we always return an array in 'data'
    const txArray = Array.isArray(data) ? data : (data?.data || []);
    return { success: true, data: txArray };
  } catch (err) {
    console.error('Service tx error:', err);
    return { success: false, data: [], error: err.message };
  }
}