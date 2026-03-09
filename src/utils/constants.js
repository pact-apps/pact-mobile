import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// === NETWORK ===
// Pakai devnet untuk development
export const SOLANA_NETWORK = "devnet";
// Read-heavy calls stay on Helius, with public devnet as send fallback.
export const SOLANA_READ_RPC_URL =
  "https://devnet.helius-rpc.com/?api-key=0a7524a0-c695-4137-bf7f-26e8b1eb7b77";
export const SOLANA_WRITE_RPC_URL = SOLANA_READ_RPC_URL;
export const SOLANA_FALLBACK_WRITE_RPC_URL = "https://api.devnet.solana.com";
export const SOLANA_EXTRA_WRITE_RPC_URLS = (
  process.env.EXPO_PUBLIC_SOLANA_EXTRA_WRITE_RPCS?.trim() || ""
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
export const SOLANA_RPC_URL = SOLANA_READ_RPC_URL;
// Nanti production: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"

// === PROGRAM ===
// Program ID kamu (dari anchor deploy)
export const PROGRAM_ID = new PublicKey(
  "CvTggHr71Qm6NC5qjkvCq4txe2UbbZWrKAWGpMVMWw6y"
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
// Override with EXPO_PUBLIC_API_BASE_URL.
// Android emulator fallback uses the host machine at 10.0.2.2.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://10.0.2.2:8080";
export const SKR_MINT_ADDRESS = process.env.EXPO_PUBLIC_SKR_MINT?.trim() || "";
export const SKR_DECIMALS = 9;
export const SKR_BASE_UNITS = 10 ** SKR_DECIMALS;

// === APP CONFIG ===
export const SETTLEMENT_FEE_BPS = 500; // 5% of forfeited stake
export const MAX_PARTICIPANTS = 10;
export const SUBMISSION_WINDOW_HOURS = 24;
