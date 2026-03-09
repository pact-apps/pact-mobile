import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { writeConnections } from "./solana";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ==========================================
// MWA — Mobile Wallet Adapter (Production)
// Connects to Phantom / Solflare on Android
// ==========================================

const AUTH_TOKEN_KEY = "pact_mwa_auth_token";
const WALLET_KEY = "pact_mwa_wallet";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

function wrapTxError(stage: string, error: unknown): never {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("declined") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    throw new Error("Wallet approval was cancelled.");
  }

  if (lower.includes("network request failed")) {
    throw new Error(`${stage} failed because the network request did not complete.`);
  }

  throw new Error(`${stage} failed: ${message}`);
}

function getConnectionLabel(connection: Connection) {
  return connection.rpcEndpoint;
}

function isNetworkSendError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

async function getLatestBlockhashWithFallback() {
  let lastError: unknown = null;

  for (const connection of writeConnections) {
    try {
      const latest = await connection.getLatestBlockhash();
      console.log("[DEBUG] signAndSend: using blockhash from", getConnectionLabel(connection));
      return { connection, ...latest };
    } catch (error) {
      lastError = error;
      if (!isNetworkSendError(error)) {
        throw error;
      }
      console.warn(
        "[DEBUG] signAndSend: blockhash fetch failed on",
        getConnectionLabel(connection),
        getErrorMessage(error)
      );
    }
  }

  throw lastError ?? new Error("No write RPC endpoints were reachable.");
}

async function confirmSignatureAcrossConnections(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number
) {
  let lastError: unknown = null;

  for (const connection of writeConnections) {
    try {
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );
      console.log("[DEBUG] signAndSend: confirmed via", getConnectionLabel(connection));
      return;
    } catch (error) {
      lastError = error;
      if (!isNetworkSendError(error)) {
        throw error;
      }
      console.warn(
        "[DEBUG] signAndSend: confirm failed on",
        getConnectionLabel(connection),
        getErrorMessage(error)
      );
    }
  }

  throw lastError ?? new Error("Confirmation did not complete on any write RPC endpoint.");
}

async function sendAndConfirmWithFallback(
  rawTx: Uint8Array,
  blockhash: string,
  lastValidBlockHeight: number
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    for (const connection of writeConnections) {
      try {
        console.log(
          "[DEBUG] signAndSend: sending attempt",
          attempt,
          "via",
          getConnectionLabel(connection)
        );
        const signature = await connection.sendRawTransaction(rawTx, {
          maxRetries: 3,
          preflightCommitment: "confirmed",
        });
        console.log(
          "[DEBUG] signAndSend: send succeeded via",
          getConnectionLabel(connection),
          signature
        );
        await confirmSignatureAcrossConnections(signature, blockhash, lastValidBlockHeight);
        return signature;
      } catch (error) {
        lastError = error;
        if (!isNetworkSendError(error)) {
          throw error;
        }
        console.warn(
          "[DEBUG] signAndSend: send failed on",
          getConnectionLabel(connection),
          getErrorMessage(error)
        );
      }
    }
  }

  const endpoints = writeConnections.map((connection) => getConnectionLabel(connection)).join(", ");
  throw new Error(
    `All write RPC endpoints failed (${endpoints}). Last error: ${getErrorMessage(lastError)}`
  );
}

export const APP_IDENTITY = {
  name: "Pact",
  uri: "https://pact.app",
  icon: "favicon.png",
};

// Authorize with MWA wallet (Phantom, Solflare, etc.)
export async function authorizeWallet(): Promise<{
  publicKey: PublicKey;
  authToken: string;
}> {
  console.log("[DEBUG] transact: starting...");
  const result = await transact(async (wallet: Web3MobileWallet) => {
    console.log("[DEBUG] transact: inside callback, calling authorize...");
    const authResult = await wallet.authorize({
      identity: APP_IDENTITY,
      cluster: "devnet",
    });
    console.log("[DEBUG] transact: authorize returned:", JSON.stringify(authResult.accounts?.[0]?.address));
    return authResult;
  });
  console.log("[DEBUG] transact: resolved, address type:", typeof result.accounts[0].address);
  console.log("[DEBUG] address value:", result.accounts[0].address);

  // MWA native returns address as Uint8Array/base64, not base58
  const rawAddress = result.accounts[0].address;
  const publicKey = new PublicKey(
    typeof rawAddress === "string"
      ? Buffer.from(rawAddress, "base64")
      : rawAddress
  );
  const authToken = result.auth_token;

  await AsyncStorage.setItem(AUTH_TOKEN_KEY, authToken);
  await AsyncStorage.setItem(WALLET_KEY, publicKey.toBase58());

  return { publicKey, authToken };
}

// Reauthorize using cached auth token
export async function reauthorizeWallet(): Promise<{
  publicKey: PublicKey;
  authToken: string;
} | null> {
  const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!cachedToken) return null;

  try {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.reauthorize({
        identity: APP_IDENTITY,
        auth_token: cachedToken,
      });
      return authResult;
    });

    const publicKey = new PublicKey(result.accounts[0].address);
    const authToken = result.auth_token;

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, authToken);
    await AsyncStorage.setItem(WALLET_KEY, publicKey.toBase58());

    return { publicKey, authToken };
  } catch {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(WALLET_KEY);
    return null;
  }
}

// Deauthorize (disconnect)
export async function deauthorizeWallet(): Promise<void> {
  const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (cachedToken) {
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: cachedToken });
      });
    } catch {
      // Ignore deauth errors
    }
  }
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(WALLET_KEY);
}

// Sign and send transaction via MWA
export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  console.log("[DEBUG] signAndSend: getting blockhash...");
  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    const latest = await getLatestBlockhashWithFallback();
    blockhash = latest.blockhash;
    lastValidBlockHeight = latest.lastValidBlockHeight;
  } catch (error) {
    wrapTxError("Fetching recent blockhash", error);
  }
  console.log("[DEBUG] signAndSend: blockhash OK:", blockhash.slice(0, 8));
  transaction.recentBlockhash = blockhash;

  const walletAddr = await AsyncStorage.getItem(WALLET_KEY);
  if (!walletAddr) throw new Error("Wallet not connected");
  transaction.feePayer = new PublicKey(walletAddr);

  // Only sign inside transact — keep RPC calls outside MWA session
  console.log("[DEBUG] signAndSend: opening MWA to sign...");
  let signedTx: Transaction;
  try {
    signedTx = await transact(async (wallet: Web3MobileWallet) => {
      // Reauthorize session
      const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (cachedToken) {
        const authResult = await wallet.reauthorize({
          identity: APP_IDENTITY,
          auth_token: cachedToken,
        });
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);
      } else {
        const authResult = await wallet.authorize({
          identity: APP_IDENTITY,
          cluster: "devnet",
        });
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);
      }

      const signedTransactions = await wallet.signTransactions({
        transactions: [transaction],
      });
      console.log("[DEBUG] signAndSend: transaction signed OK");
      return signedTransactions[0];
    });
  } catch (error) {
    wrapTxError("Wallet approval", error);
  }

  // Send the signed transaction outside MWA session
  console.log("[DEBUG] signAndSend: sending raw transaction...");
  const rawTx = signedTx.serialize();
  let signature: string;
  try {
    signature = await sendAndConfirmWithFallback(
      rawTx,
      blockhash,
      lastValidBlockHeight
    );
  } catch (error) {
    wrapTxError("Sending transaction", error);
  }
  console.log("[DEBUG] signAndSend: sent! signature:", signature);
  console.log("[DEBUG] signAndSend: confirmed!");

  return signature;
}

// Sign a message (for backend auth) — returns base58 encoded signature
export async function signMessage(message: string): Promise<string> {
  const sigBase58: string = await transact(
    async (wallet: Web3MobileWallet) => {
      const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (cachedToken) {
        const authResult = await wallet.reauthorize({
          identity: APP_IDENTITY,
          auth_token: cachedToken,
        });
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);
      } else {
        const authResult = await wallet.authorize({
          identity: APP_IDENTITY,
          cluster: "devnet",
        });
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);
      }

      const encoded = new TextEncoder().encode(message);
      const walletAddr = (await AsyncStorage.getItem(WALLET_KEY))!;
      const signedMessages = await wallet.signMessages({
        addresses: [walletAddr],
        payloads: [encoded],
      });

      // Encode to base58 inside transact so return type is string
      const bs58mod = await import("bs58");
      return bs58mod.default.encode(signedMessages[0]);
    }
  );

  return sigBase58;
}

// Get cached public key (without opening MWA)
export async function getCachedPublicKey(): Promise<PublicKey | null> {
  const addr = await AsyncStorage.getItem(WALLET_KEY);
  return addr ? new PublicKey(addr) : null;
}
