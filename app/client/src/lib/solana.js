import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { PUBLIC_CONFIG } from '../config/publicConfig';

const NETWORK = PUBLIC_CONFIG.SOLANA_NETWORK || "devnet";

export const connection = new Connection(
  PUBLIC_CONFIG.SOLANA_RPC_URL || `https://api.${NETWORK}.solana.com`,
  "confirmed"
);

export async function sendSolTransaction(fromProvider, toAddress, amountSol) {
  const fromPublicKey = new PublicKey(fromProvider.publicKey.toString());
  const toPublicKey = new PublicKey(toAddress);

  const lamports = amountSol * LAMPORTS_PER_SOL;

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports
    })
  );

  // required for Phantom
  transaction.feePayer = fromPublicKey;

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // let Phantom sign
  const signedTx = await fromProvider.signTransaction(transaction);

  const txId = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(txId);

  return txId;
}

export async function sendSolToTreasury(wallet, amountSol) {
  const treasury = new PublicKey(PUBLIC_CONFIG.TREASURY_WALLET_PUBLIC_KEY);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: treasury,
      lamports: amountSol * 1e9,
    })
  );

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function sendFcToUser(userWallet, amountFc, treasurySigner) {
  const mint = new PublicKey(PUBLIC_CONFIG.FC_TOKEN_MINT_PUBLIC_KEY);

  const fromTokenAcc = await getOrCreateAssociatedTokenAccount(
    connection,
    treasurySigner,
    mint,
    treasurySigner.publicKey
  );

  const toTokenAcc = await getOrCreateAssociatedTokenAccount(
    connection,
    treasurySigner,
    mint,
    userWallet
  );

  const signature = await transfer(
    connection,
    treasurySigner,
    fromTokenAcc.address,
    toTokenAcc.address,
    treasurySigner.publicKey,
    amountFc * 1e6
  );

  return signature;
}
