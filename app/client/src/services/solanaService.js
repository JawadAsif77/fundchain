import { Connection, PublicKey, clusterApiUrl, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ADMIN_WALLET_PUBLIC_KEY } from '../lib/constants';
import { mintFcTokensToUser } from './tokenService';

const NETWORK = 'devnet';
const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');

export function getPhantomProvider() {
  if ('solana' in window) {
    const provider = window.solana;
    if (provider?.isPhantom) return provider;
  }
  return null;
}

export async function connectPhantomWallet() {
  const provider = getPhantomProvider();
  if (!provider) throw new Error('Phantom wallet not detected.');
  const resp = await provider.connect();
  return resp.publicKey.toString();
}

export async function disconnectPhantomWallet() {
  const provider = getPhantomProvider();
  if (provider?.isConnected) {
    await provider.disconnect();
  }
}

export async function getSolBalance(address) {
  const pubkey = new PublicKey(address);
  const lamports = await connection.getBalance(pubkey);
  return lamports / 1e9;
}

/**
 * Send SOL from user wallet to admin wallet and mint FC tokens
 * @param {Object} params
 * @param {Connection} params.connection - Solana connection
 * @param {Object} params.wallet - Wallet adapter object with publicKey, signTransaction, sendTransaction
 * @param {number} params.amountSol - Amount of SOL to send
 * @param {number} params.amountFc - Amount of FC tokens to mint
 * @param {string} params.userId - User ID for transaction record
 * @returns {Object} { txSignature, mintSignature }
 */
export async function sendSolAndMintTokens({ connection, wallet, amountSol, amountFc, userId }) {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  if (!ADMIN_WALLET_PUBLIC_KEY || ADMIN_WALLET_PUBLIC_KEY === 'YOUR_ADMIN_WALLET_PUBLIC_KEY_HERE') {
    throw new Error('Admin wallet not configured. Please set VITE_TREASURY_WALLET in .env');
  }

  try {
    // Step 1: Create transaction to send SOL to admin wallet
    const fromPubkey = wallet.publicKey;
    const toPubkey = new PublicKey(ADMIN_WALLET_PUBLIC_KEY);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Check user has sufficient balance
    const balance = await connection.getBalance(fromPubkey);
    if (balance < lamports) {
      throw new Error(`Insufficient SOL balance. Required: ${amountSol} SOL, Available: ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Step 2: Send transaction via wallet adapter
    const signature = await wallet.sendTransaction(transaction, connection);

    // Step 3: Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error('Transaction failed on blockchain');
    }

    console.log('SOL transfer successful:', signature);

    // Step 4: Mint FC tokens to user
    let mintSignature = null;
    try {
      mintSignature = await mintFcTokensToUser({
        userPublicKey: fromPubkey.toBase58(),
        amountFc,
        userId,
        solTxSignature: signature
      });
      console.log('FC tokens minted:', mintSignature);
    } catch (mintError) {
      console.error('Failed to mint FC tokens:', mintError);
      // Transaction succeeded but minting failed - this should be handled by backend
      throw new Error(`SOL transfer succeeded but FC minting failed: ${mintError.message}`);
    }

    return {
      txSignature: signature,
      mintSignature,
    };
  } catch (error) {
    console.error('sendSolAndMintTokens error:', error);
    throw error;
  }
}
