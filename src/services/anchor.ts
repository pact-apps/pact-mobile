import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { PROGRAM_ID } from "../utils/constants";
import { connection } from "./solana";

import idl from "../../idl/pact_escrow.json";

// ==========================================
// SETUP PROGRAM
// ==========================================

function getReadOnlyProvider(): AnchorProvider {
  const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  return new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
}

export function getProgram(): Program {
  const provider = getReadOnlyProvider();
  return new Program(idl as any, provider);
}

// Helper to access account namespace without TS errors
function accounts(program: Program) {
  return program.account as any;
}

// ==========================================
// PDA DERIVATION
// ==========================================

export function getChallengePDA(challengeId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("challenge"), Buffer.from(challengeId)],
    PROGRAM_ID
  );
}

export function getVaultPDA(challengeKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), challengeKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getParticipantPDA(
  challengeKey: PublicKey,
  participantKey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("participant"),
      challengeKey.toBuffer(),
      participantKey.toBuffer(),
    ],
    PROGRAM_ID
  );
}

// ==========================================
// FETCH DATA (READ from chain)
// ==========================================

export async function fetchChallenge(challengeId: string) {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);

  try {
    const challenge = await accounts(program).challenge.fetch(challengePDA);
    return {
      publicKey: challengePDA,
      account: challenge,
    };
  } catch (error) {
    console.log("Challenge not found:", challengeId);
    return null;
  }
}

export async function fetchAllChallenges() {
  const program = getProgram();

  try {
    const allChallenges = await accounts(program).challenge.all();
    return allChallenges.map((item: any) => ({
      publicKey: item.publicKey,
      account: item.account,
    }));
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return [];
  }
}

export async function fetchChallengesByStatus(status: string) {
  const program = getProgram();
  const allChallenges = await accounts(program).challenge.all();

  return allChallenges.filter(
    (c: any) => Object.keys(c.account.status)[0] === status.toLowerCase()
  );
}

export async function fetchParticipantState(
  challengeKey: PublicKey,
  participantKey: PublicKey
) {
  const program = getProgram();
  const [participantPDA] = getParticipantPDA(challengeKey, participantKey);

  try {
    return await accounts(program).participantState.fetch(participantPDA);
  } catch {
    return null;
  }
}

export async function fetchVaultBalance(challengeKey: PublicKey) {
  const [vaultPDA] = getVaultPDA(challengeKey);

  try {
    const tokenAccount = await connection.getTokenAccountBalance(vaultPDA);
    return tokenAccount.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchAllParticipants(challengeKey: PublicKey) {
  const program = getProgram();

  try {
    const allParticipants = await accounts(program).participantState.all();
    return allParticipants
      .filter(
        (item: any) =>
          item.account.challenge.toBase58() === challengeKey.toBase58()
      )
      .map((item: any) => ({
        publicKey: item.publicKey,
        account: item.account,
      }));
  } catch {
    return [];
  }
}
