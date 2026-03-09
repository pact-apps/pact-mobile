import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import PactButton from "../components/ui/PactButton";
import { RootStackParamList } from "../navigation/AppNavigator";
import {
  fetchAllParticipants,
  fetchChallenge,
  getCommitmentProfilePDA,
  getVaultPDA,
} from "../services/anchor";
import { ensureBackendAuth } from "../services/backendAuth";
import { pactApi } from "../services/apiInstance";
import { finalizeChallenge } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";
import { SETTLEMENT_FEE_BPS, USDC_MINT } from "../utils/constants";
import { formatUsdc } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Settlement">;

export default function SettlementScreen({ route }: Props) {
  const { challengeId } = route.params;
  const publicKey = useAppStore((state) => state.publicKey);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettling, setIsSettling] = useState(false);
  const [challenge, setChallenge] = useState<Awaited<ReturnType<typeof fetchChallenge>>>(null);
  const [participants, setParticipants] = useState<Awaited<ReturnType<typeof fetchAllParticipants>>>([]);
  const [platformFeeBps, setPlatformFeeBps] = useState(SETTLEMENT_FEE_BPS);

  const loadSettlementData = useCallback(async () => {
    setIsLoading(true);
    try {
      const chainChallenge = await fetchChallenge(challengeId);
      setChallenge(chainChallenge);
      if (chainChallenge) {
        const challengeParticipants = await fetchAllParticipants(chainChallenge.publicKey);
        setParticipants(challengeParticipants);
      } else {
        setParticipants([]);
      }

      const chainConfig = await pactApi.chain.getConfig().catch(() => null);
      if (chainConfig) {
        setPlatformFeeBps(chainConfig.platform_fee_bps);
      }
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadSettlementData();
  }, [loadSettlementData]);

  const summary = useMemo(() => {
    const stake = challenge ? challenge.account.stakeAmount.toNumber() / 1_000_000 : 0;
    const depositCount = challenge ? challenge.account.depositCount : 0;
    const totalPool = stake * depositCount;
    const winners = participants.filter((item) => item.account.isWinner);
    const losers = participants.filter((item) => item.account.deposited && !item.account.isWinner);
    const penaltyPool = losers.length * stake;
    const fee = penaltyPool * (platformFeeBps / 10_000);
    const distributable = Math.max(0, penaltyPool - fee);
    const payoutPerWinner =
      winners.length > 0 ? stake + distributable / winners.length : 0;

    return {
      stake,
      totalPool,
      winners,
      losers,
      fee,
      payoutPerWinner,
    };
  }, [challenge, participants, platformFeeBps]);

  const triggerSettlement = async () => {
    if (!publicKey || !challenge) {
      Alert.alert("Wallet Required", "Connect your wallet before settling a challenge.");
      return;
    }

    setIsSettling(true);
    try {
      await ensureBackendAuth(publicKey.toBase58());

      const [vaultPda] = getVaultPDA(challenge.publicKey);
      const participantAccounts = await Promise.all(
        participants.map(async (item) => {
          const payoutTokenAccount = await getAssociatedTokenAddress(
            USDC_MINT,
            item.account.participant
          );
          const [commitmentProfilePda] = getCommitmentProfilePDA(item.account.participant);
          return {
            participant_state: item.publicKey.toBase58(),
            payout_token_account: payoutTokenAccount.toBase58(),
            commitment_profile: commitmentProfilePda.toBase58(),
          };
        })
      );

      const finalizePlan = await pactApi.chain.finalizePlan({
        challenge: challenge.publicKey.toBase58(),
        vault: vaultPda.toBase58(),
        token_program: TOKEN_PROGRAM_ID.toBase58(),
        stake_mint: USDC_MINT.toBase58(),
        challenge_authority: publicKey.toBase58(),
        participant_accounts: participantAccounts,
      });

      const signature = await finalizeChallenge(
        publicKey,
        challengeId,
        participants.map((item) => item.account.participant),
        finalizePlan
      );

      Alert.alert("Settlement Submitted", `Transaction confirmed: ${signature.slice(0, 8)}...`);
      await loadSettlementData();
    } catch (error: any) {
      Alert.alert("Settlement Failed", extractBackendMessage(error));
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{challenge?.account.title ?? "Settlement Summary"}</Text>
          <InfoRow label="Total Pool" value={`${formatUsdc(summary.totalPool)} USDC`} />
          <InfoRow
            label={`Fee on Forfeited Stake (${platformFeeBps / 100}%)`}
            value={`${formatUsdc(summary.fee)} USDC`}
          />
          <InfoRow
            label="Winners"
            value={
              summary.winners.length > 0
                ? summary.winners.map((item) => shortWallet(item.account.participant.toBase58())).join(", ")
                : "None yet"
            }
          />
          <InfoRow
            label="Payout / Winner"
            value={`${formatUsdc(summary.payoutPerWinner)} USDC`}
          />
          <InfoRow
            label="Status"
            value={isLoading ? "Loading..." : Object.keys(challenge?.account.status ?? { open: {} })[0]}
          />
        </View>
        <PactButton
          label="Trigger Settlement"
          variant="success"
          onPress={() => void triggerSettlement()}
          loading={isSettling}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function extractBackendMessage(error: any) {
  const body = error?.body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.error === "string") {
        return parsed.error;
      }
    } catch {
      return body;
    }
  }
  return error?.message || "Request failed.";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1018",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#131C2B",
    borderWidth: 1,
    borderColor: "#273247",
    borderRadius: 20,
    padding: 16,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 23,
    fontWeight: "800",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#253042",
  },
  label: {
    color: "#8FA0B8",
    flex: 1,
  },
  value: {
    color: "#F8FAFC",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
});
