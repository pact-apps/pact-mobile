import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";

interface AppState {
  // Wallet
  publicKey: PublicKey | null;
  connected: boolean;
  authToken: string | null;
  solBalance: number;
  usdcBalance: number;

  // Actions
  setWallet: (publicKey: PublicKey, authToken: string) => void;
  disconnect: () => void;
  setBalances: (sol: number, usdc: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  publicKey: null,
  connected: false,
  authToken: null,
  solBalance: 0,
  usdcBalance: 0,

  setWallet: (publicKey, authToken) =>
    set({ publicKey, connected: true, authToken }),
  disconnect: () =>
    set({
      publicKey: null,
      connected: false,
      authToken: null,
      solBalance: 0,
      usdcBalance: 0,
    }),
  setBalances: (sol, usdc) => set({ solBalance: sol, usdcBalance: usdc }),
}));
