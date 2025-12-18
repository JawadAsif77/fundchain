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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, error: 'No active session' };
    }

    const { data, error } = await supabase.functions.invoke('get-wallet', {
      body: { userId },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
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
    // CRITICAL: Refresh session before making the call
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return { success: false, error: 'Please login again. Your session has expired.' };
    }

    // If session exists but might be expired, try refreshing it
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    const activeSession = refreshedSession || session;

    if (!activeSession?.access_token) {
      return { success: false, error: 'Authentication failed. Please logout and login again.' };
    }

    console.log('Making request with userId:', userId, 'amount:', usdAmount);

    const { data, error } = await supabase.functions.invoke('exchange-usd-to-fc', {
      body: { 
        userId: userId,
        amountUsd: Number(usdAmount) 
      },
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`
      }
    });

    if (error) {
      console.error('Edge Function error:', error);
      
      // Handle 401 specifically
      if (error.status === 401 || error.message?.includes('401')) {
        return { success: false, error: 'Session expired. Please refresh the page and try again.' };
      }
      
      const errorMessage = error?.context?.body?.error || 
                          error?.message || 
                          'Transaction failed';
      return { success: false, error: errorMessage };
    }
    
    return { success: true, ...data };
  } catch (err) {
    console.error('buyTokens catch error:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, data: [], error: 'No active session' };
    }

    const { data, error } = await supabase.functions.invoke('get-transactions', {
      body: { userId },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) return { success: false, data: [], error: error.message };
    
    // Handle the response structure from get-transactions
    const txArray = data?.transactions || data?.data || (Array.isArray(data) ? data : []);
    return { success: true, data: txArray };
  } catch (err) {
    console.error('Service tx error:', err);
    return { success: false, data: [], error: err.message };
  }
}