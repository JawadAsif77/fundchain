import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const SOLANA_RPC = "https://api.devnet.solana.com";

export const solanaConnection = new Connection(SOLANA_RPC, "confirmed");

export async function getSolBalance(publicKey) {
  try {
    const pk = new PublicKey(publicKey);
    const lamports = await solanaConnection.getBalance(pk);
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Balance fetch error:", error);
    return null;
  }
}
