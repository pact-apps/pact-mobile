import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  getProgram,
  getChallengePDA,
  getVaultPDA,
  getParticipantPDA,
} from "./anchor";
import { signAndSendTransaction } from "./wallet";
import { USDC_MINT, TREASURY_WALLET } from "../utils/constants";

// ==========================================
// CREATE CHALLENGE
// ==========================================
export async function createChallenge(
  creator: PublicKey,
  challengeId: string,
  stakeAmount: number,
  durationSeconds: number,
  maxParticipants: number,
  title: string
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [vaultPDA] = getVaultPDA(challengePDA);

  const stakeAmountLamports = new BN(stakeAmount * 1_000_000);

  const tx = await program.methods
    .createChallenge(
      challengeId,
      stakeAmountLamports,
      new BN(durationSeconds),
      maxParticipants,
      title
    )
    .accounts({
      creator,
      challenge: challengePDA,
      vault: vaultPDA,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// JOIN CHALLENGE
// ==========================================
export async function joinChallenge(
  participant: PublicKey,
  challengeId: string
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [vaultPDA] = getVaultPDA(challengePDA);
  const [participantPDA] = getParticipantPDA(challengePDA, participant);

  const participantTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    participant
  );

  const tx = await program.methods
    .joinChallenge()
    .accounts({
      participant,
      challenge: challengePDA,
      participantState: participantPDA,
      participantTokenAccount,
      vault: vaultPDA,
      challengeMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// START CHALLENGE (Creator only, min 2 participants)
// ==========================================
export async function startChallenge(
  creator: PublicKey,
  challengeId: string
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);

  const tx = await program.methods
    .startChallenge()
    .accounts({
      creator,
      challenge: challengePDA,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// SUBMIT RESULT
// ==========================================
export async function submitResult(
  participant: PublicKey,
  challengeId: string,
  success: boolean,
  proofHash: Uint8Array
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [participantPDA] = getParticipantPDA(challengePDA, participant);

  const tx = await program.methods
    .submitResult(success, Array.from(proofHash))
    .accounts({
      participant,
      challenge: challengePDA,
      participantState: participantPDA,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// DISPUTE
// ==========================================
export async function disputeParticipant(
  disputer: PublicKey,
  challengeId: string,
  targetParticipant: PublicKey
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [targetPDA] = getParticipantPDA(challengePDA, targetParticipant);
  const [disputerPDA] = getParticipantPDA(challengePDA, disputer);

  const tx = await program.methods
    .dispute()
    .accounts({
      disputer,
      challenge: challengePDA,
      targetParticipantState: targetPDA,
      disputerState: disputerPDA,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// FINALIZE / SETTLEMENT (permissionless)
// remaining_accounts: [ParticipantState_0, TokenAccount_0, ...]
// ==========================================
export async function finalizeChallenge(
  authority: PublicKey,
  challengeId: string,
  participantKeys: PublicKey[]
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [vaultPDA] = getVaultPDA(challengePDA);

  const treasuryTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    TREASURY_WALLET
  );

  const remainingAccounts: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[] = [];

  for (const partKey of participantKeys) {
    const [partPDA] = getParticipantPDA(challengePDA, partKey);
    const partTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      partKey
    );
    remainingAccounts.push({
      pubkey: partPDA,
      isSigner: false,
      isWritable: true,
    });
    remainingAccounts.push({
      pubkey: partTokenAccount,
      isSigner: false,
      isWritable: true,
    });
  }

  const tx = await program.methods
    .finalize()
    .accounts({
      authority,
      challenge: challengePDA,
      vault: vaultPDA,
      treasury: TREASURY_WALLET,
      treasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// VOTE CONTINUE (All-fail cycle 1)
// ==========================================
export async function voteContinue(
  participant: PublicKey,
  challengeId: string,
  wantsContinue: boolean
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [participantPDA] = getParticipantPDA(challengePDA, participant);

  const tx = await program.methods
    .voteContinue(wantsContinue)
    .accounts({
      participant,
      challenge: challengePDA,
      participantState: participantPDA,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}
