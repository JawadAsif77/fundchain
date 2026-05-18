import { PUBLIC_CONFIG } from '../config/publicConfig';

// Solana network constants
export const SOLANA_NETWORK = PUBLIC_CONFIG.SOLANA_NETWORK;

// Admin/Treasury wallet public key (replace with your actual admin wallet)
export const ADMIN_WALLET_PUBLIC_KEY = PUBLIC_CONFIG.TREASURY_WALLET_PUBLIC_KEY;

// FC Token mint public key (replace with your actual token mint address)
export const FC_TOKEN_MINT_PUBLIC_KEY = PUBLIC_CONFIG.FC_TOKEN_MINT_PUBLIC_KEY;

// Conversion rates
export const SOL_TO_USD_RATE = 100; // 1 SOL = 100 USD (devnet rate)
export const USD_TO_FC_RATE = 1;    // 1 USD = 1 FC
export const SOL_TO_FC_RATE = PUBLIC_CONFIG.FC_PER_SOL;
