import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { PROGRAM_ID } from "../utils/constants";
import { connection } from "./solana";

import idl from "../../idl/pact_escrow.json";

// ==========================================
// MANUAL DECODER (bypasses Buffer polyfill issues in Hermes)
// Uses DataView instead of Buffer.readUIntLE etc.
// ==========================================

const CHALLENGE_DISCRIMINATOR = [119, 250, 161, 121, 119, 81, 22, 208];
const PARTICIPANT_STATE_DISCRIMINATOR = [94, 173, 138, 206, 211, 209, 252, 75];

const STATUS_VARIANTS = ["open", "active", "submission", "allFailVoting", "settled", "cancelled"];

function matchesDiscriminator(data: Uint8Array, disc: number[]): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== disc[i]) return false;
  }
  return true;
}

function decodeChallenge(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip discriminator

  // creator: pubkey (32 bytes)
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // challenge_id: borsh string (u32 len + utf8)
  const idLen = view.getUint32(offset, true);
  offset += 4;
  const challengeId = new TextDecoder().decode(data.slice(offset, offset + idLen));
  offset += idLen;

  // title: borsh string
  const titleLen = view.getUint32(offset, true);
  offset += 4;
  const title = new TextDecoder().decode(data.slice(offset, offset + titleLen));
  offset += titleLen;

  // stake_amount: u64 (read as two u32s)
  const stakeLow = view.getUint32(offset, true);
  const stakeHigh = view.getUint32(offset + 4, true);
  const stakeAmount = new BN(stakeLow).add(new BN(stakeHigh).shln(32));
  offset += 8;

  // max_participants: u8
  const maxParticipants = data[offset++];

  // participant_count: u8
  const participantCount = data[offset++];

  // deposit_count: u8
  const depositCount = data[offset++];

  // duration_seconds: i64
  const durLow = view.getUint32(offset, true);
  const durHigh = view.getUint32(offset + 4, true);
  const durationSeconds = new BN(durLow).add(new BN(durHigh).shln(32));
  offset += 8;

  // created_at: i64
  const catLow = view.getUint32(offset, true);
  const catHigh = view.getUint32(offset + 4, true);
  const createdAt = new BN(catLow).add(new BN(catHigh).shln(32));
  offset += 8;

  // deadline: i64
  const dlLow = view.getUint32(offset, true);
  const dlHigh = view.getUint32(offset + 4, true);
  const deadline = new BN(dlLow).add(new BN(dlHigh).shln(32));
  offset += 8;

  // submission_deadline: i64
  const sdlLow = view.getUint32(offset, true);
  const sdlHigh = view.getUint32(offset + 4, true);
  const submissionDeadline = new BN(sdlLow).add(new BN(sdlHigh).shln(32));
  offset += 8;

  // status: enum (1 byte variant index)
  const statusIdx = data[offset++];
  const statusKey = STATUS_VARIANTS[statusIdx] || "open";
  const status: Record<string, object> = {};
  status[statusKey] = {};

  // cycle: u8
  const cycle = data[offset++];

  // bump: u8
  const bump = data[offset++];

  // vault_bump: u8
  const vaultBump = data[offset++];

  return {
    creator,
    challengeId,
    title,
    stakeAmount,
    maxParticipants,
    participantCount,
    depositCount,
    durationSeconds,
    createdAt,
    deadline,
    submissionDeadline,
    status,
    cycle,
    bump,
    vaultBump,
  };
}

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

function decodeParticipantState(data: Uint8Array) {
  let offset = 8; // skip discriminator

  const participant = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const challenge = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const deposited = Boolean(data[offset++]);
  const submitted = Boolean(data[offset++]);

  const submissionResultVariant = data[offset++];
  const submissionResultKey =
    submissionResultVariant === 0
      ? "pending"
      : submissionResultVariant === 1
        ? "success"
        : "fail";
  const submissionResult: Record<string, object> = {
    [submissionResultKey]: {},
  };

  const proofHash = Array.from(data.slice(offset, offset + 32));
  offset += 32;

  const disputed = Boolean(data[offset++]);
  const disputeCount = data[offset++];
  const isWinner = Boolean(data[offset++]);
  const boostEnabled = Boolean(data[offset++]);

  const voteContinueFlag = data[offset++];
  const voteContinue =
    voteContinueFlag === 0 ? null : Boolean(data[offset++]);

  const bump = data[offset++];

  return {
    participant,
    challenge,
    deposited,
    submitted,
    submissionResult,
    proofHash,
    disputed,
    disputeCount,
    isWinner,
    boostEnabled,
    voteContinue,
    bump,
  };
}

export function getCommitmentProfilePDA(userKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_profile"), userKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getSkrLockPDA(userKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("skr_lock"), userKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getSkrVaultPDA(userKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("skr_vault"), userKey.toBuffer()],
    PROGRAM_ID
  );
}

export function getPlatformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("platform_config")], PROGRAM_ID);
}

export function getDisputeReceiptPDA(
  challengeKey: PublicKey,
  disputerKey: PublicKey,
  targetParticipantKey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("dispute"),
      challengeKey.toBuffer(),
      disputerKey.toBuffer(),
      targetParticipantKey.toBuffer(),
    ],
    PROGRAM_ID
  );
}

// ==========================================
// FETCH DATA (READ from chain)
// ==========================================

export async function fetchChallenge(challengeId: string) {
  const [challengePDA] = getChallengePDA(challengeId);

  try {
    const accountInfo = await connection.getAccountInfo(challengePDA);
    if (!accountInfo) {
      console.log("Challenge not found:", challengeId);
      return null;
    }
    const data = new Uint8Array(accountInfo.data);
    const decoded = decodeChallenge(data);
    return {
      publicKey: challengePDA,
      account: decoded,
    };
  } catch (error) {
    console.log("Challenge not found:", challengeId);
    return null;
  }
}

export async function fetchAllChallenges() {
  try {
    console.log("[DEBUG] fetchAllChallenges: calling getProgramAccounts...");
    const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log("[DEBUG] fetchAllChallenges: got", rawAccounts.length, "raw accounts");

    const challenges = [];
    for (const item of rawAccounts) {
      const data = new Uint8Array(item.account.data);
      if (!matchesDiscriminator(data, CHALLENGE_DISCRIMINATOR)) continue;

      try {
        const decoded = decodeChallenge(data);
        challenges.push({ publicKey: item.pubkey, account: decoded });
      } catch (e: any) {
        console.warn("[DEBUG] decode challenge failed:", item.pubkey.toBase58(), e?.message);
      }
    }
    console.log("[DEBUG] fetchAllChallenges: decoded", challenges.length, "challenges");
    return challenges;
  } catch (error: any) {
    console.error("[DEBUG] fetchAllChallenges error:", error?.message || error);
    return [];
  }
}

export async function fetchChallengesForWallet(walletKey: PublicKey) {
  const [allChallenges, participantStates] = await Promise.all([
    fetchAllChallenges(),
    fetchAllParticipantStates(),
  ]);

  const challengeKeys = new Set<string>();

  for (const challenge of allChallenges) {
    if (challenge.account.creator.toBase58() === walletKey.toBase58()) {
      challengeKeys.add(challenge.publicKey.toBase58());
    }
  }

  for (const participantState of participantStates) {
    if (participantState.account.participant.toBase58() === walletKey.toBase58()) {
      challengeKeys.add(participantState.account.challenge.toBase58());
    }
  }

  return allChallenges.filter((challenge) =>
    challengeKeys.has(challenge.publicKey.toBase58())
  );
}

export async function fetchChallengesByStatus(status: string) {
  const program = getProgram();
  const allChallenges = await accounts(program).challenge.all();

  return allChallenges.filter(
    (c: any) => Object.keys(c.account.status)[0] === status.toLowerCase()
  );
}

export async function fetchPlatformConfig() {
  const program = getProgram();
  const [platformConfigPDA] = getPlatformConfigPDA();

  try {
    const config = await accounts(program).platformConfig.fetch(platformConfigPDA);
    return {
      publicKey: platformConfigPDA,
      account: config,
    };
  } catch {
    return null;
  }
}

export async function fetchSkrLockAccount(userKey: PublicKey) {
  const program = getProgram();
  const [skrLockPDA] = getSkrLockPDA(userKey);

  try {
    const account = await accounts(program).skrLockAccount.fetch(skrLockPDA);
    return {
      publicKey: skrLockPDA,
      account,
    };
  } catch {
    return null;
  }
}

export async function fetchCommitmentProfile(userKey: PublicKey) {
  const program = getProgram();
  const [commitmentProfilePDA] = getCommitmentProfilePDA(userKey);

  try {
    const account = await accounts(program).commitmentProfile.fetch(commitmentProfilePDA);
    return {
      publicKey: commitmentProfilePDA,
      account,
    };
  } catch {
    return null;
  }
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
  try {
    const allParticipants = await fetchAllParticipantStates();
    return allParticipants
      .filter((item) => item.account.challenge.toBase58() === challengeKey.toBase58())
      .map((item) => ({
        publicKey: item.publicKey,
        account: item.account,
      }));
  } catch {
    return [];
  }
}

export async function fetchAllParticipantStates() {
  try {
    const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID);

    const participantStates = [];
    for (const item of rawAccounts) {
      const data = new Uint8Array(item.account.data);
      if (!matchesDiscriminator(data, PARTICIPANT_STATE_DISCRIMINATOR)) continue;

      try {
        const decoded = decodeParticipantState(data);
        participantStates.push({ publicKey: item.pubkey, account: decoded });
      } catch (e: any) {
        console.warn(
          "[DEBUG] decode participant state failed:",
          item.pubkey.toBase58(),
          e?.message
        );
      }
    }

    return participantStates;
  } catch {
    return [];
  }
}
