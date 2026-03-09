import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  getProgram,
  getChallengePDA,
  getVaultPDA,
  getParticipantPDA,
  getCommitmentProfilePDA,
  getSkrLockPDA,
  getDisputeReceiptPDA,
  getPlatformConfigPDA,
  getSkrVaultPDA,
  fetchPlatformConfig,
} from "./anchor";
import { signAndSendTransaction } from "./wallet";
import { SKR_BASE_UNITS, USDC_MINT } from "../utils/constants";
import type { FinalizePlanResponse } from "./pactApi";

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
      rent: SYSVAR_RENT_PUBKEY,
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
  const [commitmentProfilePDA] = getCommitmentProfilePDA(participant);
  const [skrLockPDA] = getSkrLockPDA(participant);

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
      commitmentProfile: commitmentProfilePDA,
      participantTokenAccount,
      vault: vaultPDA,
      skrLock: skrLockPDA,
      challengeMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
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
  const [disputeReceiptPDA] = getDisputeReceiptPDA(
    challengePDA,
    disputer,
    targetParticipant
  );

  const tx = await program.methods
    .dispute()
    .accounts({
      disputer,
      challenge: challengePDA,
      targetParticipantState: targetPDA,
      disputerState: disputerPDA,
      disputeReceipt: disputeReceiptPDA,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

// ==========================================
// FINALIZE / SETTLEMENT (permissionless)
// remaining_accounts: [ParticipantState_0, TokenAccount_0, CommitmentProfile_0, ...]
// ==========================================
export async function finalizeChallenge(
  authority: PublicKey,
  challengeId: string,
  participantKeys: PublicKey[],
  finalizePlan?: FinalizePlanResponse
): Promise<string> {
  const program = getProgram();
  const [challengePDA] = getChallengePDA(challengeId);
  const [vaultPDA] = getVaultPDA(challengePDA);
  const platformConfigPDA = finalizePlan
    ? new PublicKey(finalizePlan.platform_config_pda)
    : getPlatformConfigPDA()[0];
  const platformConfig = finalizePlan ? null : await fetchPlatformConfig();

  if (!finalizePlan && !platformConfig) {
    throw new Error("Platform config is not initialized on-chain");
  }

  const treasuryTokenAccount = finalizePlan
    ? new PublicKey(finalizePlan.treasury_token_account)
    : await getAssociatedTokenAddress(USDC_MINT, platformConfig!.account.treasuryAuthority);

  const remainingAccounts: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[] = [];

  if (finalizePlan) {
    for (const triple of finalizePlan.participant_triples) {
      remainingAccounts.push({
        pubkey: new PublicKey(triple.participant_state),
        isSigner: false,
        isWritable: true,
      });
      remainingAccounts.push({
        pubkey: new PublicKey(triple.payout_token_account),
        isSigner: false,
        isWritable: true,
      });
      remainingAccounts.push({
        pubkey: new PublicKey(triple.commitment_profile),
        isSigner: false,
        isWritable: true,
      });
    }
  } else {
    for (const partKey of participantKeys) {
      const [partPDA] = getParticipantPDA(challengePDA, partKey);
      const [commitmentProfilePDA] = getCommitmentProfilePDA(partKey);
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
      remainingAccounts.push({
        pubkey: commitmentProfilePDA,
        isSigner: false,
        isWritable: true,
      });
    }
  }

  const tx = await program.methods
    .finalize()
    .accounts({
      authority,
      platformConfig: platformConfigPDA,
      challenge: challengePDA,
      vault: vaultPDA,
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

export async function lockSkr(
  user: PublicKey,
  skrMint: PublicKey,
  amount: number
): Promise<string> {
  const program = getProgram();
  const [skrLockPDA] = getSkrLockPDA(user);
  const [skrVaultPDA] = getSkrVaultPDA(user);
  const [commitmentProfilePDA] = getCommitmentProfilePDA(user);
  const userSkrTokenAccount = await getAssociatedTokenAddress(skrMint, user);

  const tx = await program.methods
    .lockSkr(new BN(Math.round(amount * SKR_BASE_UNITS)))
    .accounts({
      user,
      skrLock: skrLockPDA,
      skrVault: skrVaultPDA,
      commitmentProfile: commitmentProfilePDA,
      userSkrTokenAccount,
      skrMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}

export async function unlockSkr(
  user: PublicKey,
  skrMint: PublicKey,
  amount: number
): Promise<string> {
  const program = getProgram();
  const [skrLockPDA] = getSkrLockPDA(user);
  const [skrVaultPDA] = getSkrVaultPDA(user);
  const [commitmentProfilePDA] = getCommitmentProfilePDA(user);
  const userSkrTokenAccount = await getAssociatedTokenAddress(skrMint, user);

  const tx = await program.methods
    .unlockSkr(new BN(Math.round(amount * SKR_BASE_UNITS)))
    .accounts({
      user,
      skrLock: skrLockPDA,
      skrVault: skrVaultPDA,
      commitmentProfile: commitmentProfilePDA,
      userSkrTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return await signAndSendTransaction(tx);
}
