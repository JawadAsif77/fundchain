// Frontend service layer to call Supabase Edge Functions for wallet operations
const functionsBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/`;

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
};

/**
 * Get wallet balance for a user
 */
export async function getWallet(userId) {
  const response = await fetch(`${functionsBase}get-wallet`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId })
  });
  return await response.json();
}

/**
 * Buy FC tokens with USD
 * First converts USD to FC, then calls buy-fc-tokens
 */
export async function buyTokens(userId, usdAmount) {
  // Step 1: Convert USD to FC (1 USD = 1 FC)
  const conversionResponse = await fetch(`${functionsBase}exchange-usd-to-fc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ usd: usdAmount })
  });
  const conversionData = await conversionResponse.json();
  const fcAmount = conversionData.fc;

  // Step 2: Buy FC tokens
  // For USD purchases, pass the FC amount directly (already converted)
  const dummyTxSignature = `demo_usd_tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const response = await fetch(`${functionsBase}buy-fc-tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      userId, 
      amountFc: fcAmount,
      usdAmount: usdAmount,
      txSignature: dummyTxSignature,
      purchaseType: 'usd'
    })
  });
  return await response.json();
}

/**
 * Get transaction history for a user
 */
export async function getTransactions(userId) {
  const response = await fetch(`${functionsBase}get-transactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId })
  });
  return await response.json();
}

/**
 * Convert USD to FC tokens (preview/calculation only)
 */
export async function exchangeUsdToFc(usd) {
  const response = await fetch(`${functionsBase}exchange-usd-to-fc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ usd })
  });
  return await response.json();
}
