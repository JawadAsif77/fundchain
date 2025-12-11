// Solana network constants
export const SOLANA_NETWORK = 'devnet';

// Admin/Treasury wallet public key (replace with your actual admin wallet)
export const ADMIN_WALLET_PUBLIC_KEY = import.meta.env.VITE_TREASURY_WALLET || 'YOUR_ADMIN_WALLET_PUBLIC_KEY_HERE';

// FC Token mint public key (replace with your actual token mint address)
export const FC_TOKEN_MINT_PUBLIC_KEY = import.meta.env.VITE_FC_TOKEN_MINT || 'YOUR_FC_TOKEN_MINT_PUBLIC_KEY_HERE';

// Conversion rates
export const SOL_TO_USD_RATE = 100; // 1 SOL = 100 USD (devnet rate)
export const USD_TO_FC_RATE = 1;    // 1 USD = 1 FC
export const SOL_TO_FC_RATE = 100;  // 1 SOL = 100 FC
