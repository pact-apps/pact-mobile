import { Linking } from "react-native";

const EXPLORER_BASE = "https://explorer.solana.com";
const CLUSTER = "devnet"; // ganti ke mainnet-beta untuk production

export function openTransaction(signature: string) {
  const url = `${EXPLORER_BASE}/tx/${signature}?cluster=${CLUSTER}`;
  Linking.openURL(url);
}

export function openAccount(address: string) {
  const url = `${EXPLORER_BASE}/address/${address}?cluster=${CLUSTER}`;
  Linking.openURL(url);
}

export function openProgram() {
  const programId = "6JTfaG74DZydUwHdQAo6P6frYAVhSitwTexomvTphbCs";
  openAccount(programId);
}

// Pakai di app:
// Setelah createChallenge() return signature:
// openTransaction(signature);