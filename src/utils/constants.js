import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// === NETWORK ===
// Pakai devnet untuk development
export const SOLANA_NETWORK = "devnet";
export const SOLANA_RPC_URL = clusterApiUrl("devnet");
// Nanti production ganti ke: clusterApiUrl("mainnet-beta")
// Atau pakai RPC provider: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"

// === PROGRAM ===
// Program ID kamu (dari anchor deploy)
export const PROGRAM_ID = new PublicKey(
  "6JTfaG74DZydUwHdQAo6P6frYAVhSitwTexomvTphbCs"
);

// === USDC ===
// Devnet USDC mint address (official Circle devnet USDC)
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
// Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

// === TREASURY ===
// Treasury wallet for settlement fee collection
export const TREASURY_WALLET = new PublicKey(
  "HN7cABqLq46Es1jh92dQQisAi5YqpSi1sFdsepnMDnp8" // TODO: Replace with actual treasury
);

// === BACKEND ===
export const API_BASE_URL = "http://localhost:8080";

// === APP CONFIG ===
export const SETTLEMENT_FEE_BPS = 200; // 2%
export const MAX_PARTICIPANTS = 10;
export const SUBMISSION_WINDOW_HOURS = 24;