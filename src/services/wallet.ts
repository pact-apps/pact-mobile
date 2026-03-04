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
  const result = await transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      identity: APP_IDENTITY,
      cluster: "devnet",
    });
    return authResult;
  });

  const publicKey = new PublicKey(result.accounts[0].address);
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
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  const walletAddr = await AsyncStorage.getItem(WALLET_KEY);
  if (!walletAddr) throw new Error("Wallet not connected");
  transaction.feePayer = new PublicKey(walletAddr);

  const signature = await transact(async (wallet: Web3MobileWallet) => {
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

    // Sign and send
    const signedTransactions = await wallet.signTransactions({
      transactions: [transaction],
    });
    const rawTx = signedTransactions[0].serialize();
    return await connection.sendRawTransaction(rawTx);
  });

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

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
