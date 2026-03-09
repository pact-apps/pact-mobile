import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  SOLANA_EXTRA_WRITE_RPC_URLS,
  SOLANA_FALLBACK_WRITE_RPC_URL,
  SOLANA_READ_RPC_URL,
  SOLANA_WRITE_RPC_URL,
} from "../utils/constants";

export const readConnection = new Connection(SOLANA_READ_RPC_URL, "confirmed");
export const writeConnection = new Connection(SOLANA_WRITE_RPC_URL, "confirmed");
export const fallbackWriteConnection = new Connection(
  SOLANA_FALLBACK_WRITE_RPC_URL,
  "confirmed"
);
export const extraWriteConnections = SOLANA_EXTRA_WRITE_RPC_URLS.map(
  (url: string) => new Connection(url, "confirmed")
);
export const writeConnections = [
  writeConnection,
  fallbackWriteConnection,
  ...extraWriteConnections,
].filter(
  (connection, index, all) =>
    all.findIndex((item) => item.rpcEndpoint === connection.rpcEndpoint) === index
);

// Keep the existing export name for read paths across the app.
export const connection = readConnection;

// Helper: cek saldo SOL
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const balance = await readConnection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Helper: cek saldo USDC (SPL Token)
export async function getUsdcBalance(
  publicKey: PublicKey,
  usdcMint: PublicKey
): Promise<number> {
  try {
    const tokenAccounts = await readConnection.getParsedTokenAccountsByOwner(
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
  return readConnection.onAccountChange(publicKey, callback, "confirmed");
}

// Helper: unsubscribe
export function unsubscribeFromAccount(subscriptionId: number) {
  readConnection.removeAccountChangeListener(subscriptionId);
}
