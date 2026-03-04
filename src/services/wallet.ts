import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { PublicKey, Transaction } from "@solana/web3.js";
import { connection } from "./solana";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ==========================================
// MWA — Mobile Wallet Adapter (Production)
// Connects to Phantom / Solflare on Android
// ==========================================

const AUTH_TOKEN_KEY = "pact_mwa_auth_token";
const WALLET_KEY = "pact_mwa_wallet";

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
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  console.log("[DEBUG] signAndSend: blockhash OK:", blockhash.slice(0, 8));
  transaction.recentBlockhash = blockhash;

  const walletAddr = await AsyncStorage.getItem(WALLET_KEY);
  if (!walletAddr) throw new Error("Wallet not connected");
  transaction.feePayer = new PublicKey(walletAddr);

  // Only sign inside transact — keep RPC calls outside MWA session
  console.log("[DEBUG] signAndSend: opening MWA to sign...");
  const signedTx = await transact(async (wallet: Web3MobileWallet) => {
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

    // Only sign — don't send inside MWA session
    const signedTransactions = await wallet.signTransactions({
      transactions: [transaction],
    });
    console.log("[DEBUG] signAndSend: transaction signed OK");
    return signedTransactions[0];
  });

  // Send the signed transaction outside MWA session
  console.log("[DEBUG] signAndSend: sending raw transaction...");
  const rawTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(rawTx);
  console.log("[DEBUG] signAndSend: sent! signature:", signature);

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });
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
