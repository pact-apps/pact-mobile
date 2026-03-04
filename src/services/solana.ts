import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../utils/constants";

// Satu connection instance untuk seluruh app
export const connection = new Connection(SOLANA_RPC_URL, "confirmed");

// Helper: cek saldo SOL
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Helper: cek saldo USDC (SPL Token)
export async function getUsdcBalance(
  publicKey: PublicKey,
  usdcMint: PublicKey
): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { mint: usdcMint }
    );

    if (tokenAccounts.value.length === 0) return 0;

    const balance =
      tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance ?? 0;
  } catch {
    return 0;
  }
}

// Helper: subscribe ke account changes (real-time updates)
export function subscribeToAccount(
  publicKey: PublicKey,
  callback: (accountInfo: any) => void
): number {
  return connection.onAccountChange(publicKey, callback, "confirmed");
}

// Helper: unsubscribe
export function unsubscribeFromAccount(subscriptionId: number) {
  connection.removeAccountChangeListener(subscriptionId);
}