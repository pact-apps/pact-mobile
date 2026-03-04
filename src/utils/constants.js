import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// === NETWORK ===
// Pakai devnet untuk development
export const SOLANA_NETWORK = "devnet";
// PENTING: Public RPC Solana (api.devnet.solana.com) menonaktifkan getProgramAccounts
// yang dibutuhkan Anchor untuk fetch semua challenges.
// Wajib pakai RPC private — daftar GRATIS di https://helius.dev
// lalu ganti URL di bawah:
export const SOLANA_RPC_URL = "https://devnet.helius-rpc.com/?api-key=0a7524a0-c695-4137-bf7f-26e8b1eb7b77";
// Nanti production: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"

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
// Saat testing di Android: ganti dengan ngrok URL
// Contoh: "https://xxxx-xx-xx.ngrok-free.app"
// Saat emulator: "http://10.0.2.2:8080"
export const API_BASE_URL = "https://unimmersed-preabundantly-florentino.ngrok-free.dev";

// === APP CONFIG ===
export const SETTLEMENT_FEE_BPS = 200; // 2%
export const MAX_PARTICIPANTS = 10;
export const SUBMISSION_WINDOW_HOURS = 24;