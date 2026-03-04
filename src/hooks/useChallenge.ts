import { useQuery } from "@tanstack/react-query";
import {
  fetchAllChallenges,
  fetchChallenge,
  fetchVaultBalance,
  fetchParticipantState,
  fetchAllParticipants,
} from "../services/anchor";
import { PublicKey } from "@solana/web3.js";

export function useAllChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: fetchAllChallenges,
    refetchInterval: 10_000,
  });
}

export function useChallengeDetail(challengeId: string) {
  return useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: () => fetchChallenge(challengeId),
    enabled: !!challengeId,
    refetchInterval: 5_000,
  });
}

export function useVaultBalance(challengeKey: PublicKey | null) {
  return useQuery({
    queryKey: ["vault", challengeKey?.toBase58()],
    queryFn: () => fetchVaultBalance(challengeKey!),
    enabled: !!challengeKey,
    refetchInterval: 5_000,
  });
}

export function useParticipantState(
  challengeKey: PublicKey | null,
  participantKey: PublicKey | null
) {
  return useQuery({
    queryKey: [
      "participant",
      challengeKey?.toBase58(),
      participantKey?.toBase58(),
    ],
    queryFn: () => fetchParticipantState(challengeKey!, participantKey!),
    enabled: !!challengeKey && !!participantKey,
    refetchInterval: 5_000,
  });
}

export function useAllParticipants(challengeKey: PublicKey | null) {
  return useQuery({
    queryKey: ["participants", challengeKey?.toBase58()],
    queryFn: () => fetchAllParticipants(challengeKey!),
    enabled: !!challengeKey,
    refetchInterval: 5_000,
  });
}
