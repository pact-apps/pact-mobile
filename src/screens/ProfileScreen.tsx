import React, { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AmbientBackground from "../components/ui/AmbientBackground";
import PactButton from "../components/ui/PactButton";
import HowPactWorksModal from "../components/ui/HowPactWorksModal";
import { colors } from "../theme/colors";
import { useAppStore } from "../store/useAppStore";
import { openAccount, openProgram } from "../utils/explorer";
import { authorizeWallet, deauthorizeWallet } from "../services/wallet";
import { getSolBalance, getUsdcBalance } from "../services/solana";
import { SKR_BASE_UNITS, SOLANA_NETWORK, USDC_MINT } from "../utils/constants";
import { pactApi } from "../services/apiInstance";
import { clearBackendAuth } from "../services/backendAuth";
import type { ScoreResponse } from "../services/pactApi";
import { fetchAllChallenges, fetchCommitmentProfile, fetchSkrLockAccount } from "../services/anchor";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { formatSol, formatUsdc } from "../utils/format";

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    publicKey,
    connected,
    solBalance,
    usdcBalance,
    setWallet,
    setBalances,
    disconnect,
  } = useAppStore();

  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [createdChallenges, setCreatedChallenges] = useState<number | null>(null);
  const [activeCreatedChallenges, setActiveCreatedChallenges] = useState<number | null>(null);
  const [lockedSkr, setLockedSkr] = useState<number | null>(null);
  const [commitmentScore, setCommitmentScore] = useState<number>(100);
  const [activeChallengeCount, setActiveChallengeCount] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) return;

    (async () => {
      const [sol, usdc, skrLock, commitmentProfile] = await Promise.all([
        getSolBalance(publicKey),
        getUsdcBalance(publicKey, USDC_MINT),
        fetchSkrLockAccount(publicKey),
        fetchCommitmentProfile(publicKey),
      ]);
      setBalances(sol, usdc);
      setLockedSkr(skrLock ? skrLock.account.amountLocked.toNumber() / SKR_BASE_UNITS : 0);
      setCommitmentScore(commitmentProfile ? Number(commitmentProfile.account.commitmentScore) : 100);
      setActiveChallengeCount(
        commitmentProfile ? commitmentProfile.account.activeChallengeCount : null
      );

      try {
        const s = await pactApi.scores.get(publicKey.toBase58());
        setScore(s);
      } catch {
        // Backend may not be available
      }

      try {
        const allChallenges = await fetchAllChallenges();
        const mine = allChallenges.filter(
          (challenge) => challenge.account.creator.toBase58() === publicKey.toBase58()
        );
        const activeMine = mine.filter((challenge) => {
          const status = Object.keys(challenge.account.status)[0];
          return status === "open" || status === "active" || status === "submission";
        });

        setCreatedChallenges(mine.length);
        setActiveCreatedChallenges(activeMine.length);
      } catch {
        setCreatedChallenges(null);
        setActiveCreatedChallenges(null);
      }
    })();
  }, [connected, publicKey, setBalances]);

  const handleConnect = async () => {
    try {
      const result = await authorizeWallet();
      setWallet(result.publicKey, result.authToken);
      const sol = await getSolBalance(result.publicKey);
      const usdc = await getUsdcBalance(result.publicKey, USDC_MINT);
      setBalances(sol, usdc);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not connect wallet");
    }
  };

  const handleDisconnect = async () => {
    await deauthorizeWallet();
    await clearBackendAuth();
    setScore(null);
    setCreatedChallenges(null);
    setActiveCreatedChallenges(null);
    setLockedSkr(null);
    setCommitmentScore(100);
    setActiveChallengeCount(null);
    disconnect();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "ConnectWallet" }],
      })
    );
  };

  const completed = score?.challenges_completed ?? 0;
  const failed = score?.challenges_failed ?? 0;
  const totalDecided = completed + failed;
  const completionRate =
    totalDecided > 0 ? `${Math.round((completed / totalDecided) * 100)}%` : "-";

  if (!connected || !publicKey) {
    return (
      <SafeAreaView style={styles.container}>
        <AmbientBackground variant="blue" />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Profile</Text>
          <Text style={styles.emptyText}>Connect wallet to see balance, stats, and commitment score.</Text>
          <PactButton label="Connect Wallet" onPress={handleConnect} style={{ marginTop: 14, width: "100%" }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>PROFILE</Text>
        <Text style={styles.heading}>Account Overview</Text>

        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardLabel}>Wallet Identity</Text>
            <Text style={styles.networkTag}>{String(SOLANA_NETWORK).toUpperCase()}</Text>
          </View>
          <Text style={styles.address}>{publicKey.toBase58()}</Text>
        </View>

        <SectionTitle title="Financial Snapshot" />
        <View style={styles.row}>
          <View style={[styles.card, styles.flex]}>
            <Text style={styles.cardLabel}>SOL</Text>
            <Text style={styles.value}>{formatSol(solBalance)}</Text>
          </View>
          <View style={[styles.card, styles.flex]}>
            <Text style={styles.cardLabel}>USDC</Text>
            <Text style={styles.value}>{formatUsdc(usdcBalance)}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <InfoRow label="Locked SKR" value={lockedSkr !== null ? `${formatUsdc(lockedSkr)} SKR` : "-"} />
          <PactButton
            label="Manage SKR Boost"
            variant="secondary"
            onPress={() => navigation.navigate("StakeSkr")}
            style={{ marginTop: 10 }}
          />
        </View>

        <SectionTitle title="Accountability Stats" />
        <View style={styles.scoreCard}>
          <Text style={styles.cardLabel}>Commitment Score</Text>
          <Text style={styles.scoreValue}>{commitmentScore}</Text>
          {score?.rank && <Text style={styles.rank}>Rank #{score.rank}</Text>}

          <View style={styles.statsRow}>
            <MiniStat label="Completed" value={String(completed)} />
            <MiniStat label="Failed" value={String(failed)} />
            <MiniStat
              label="Active Pacts"
              value={activeChallengeCount !== null ? String(activeChallengeCount) : "-"}
            />
          </View>
        </View>

        <SectionTitle title="Challenge Activity Summary" />
        <View style={styles.card}>
          <InfoRow
            label="Created Challenges"
            value={createdChallenges !== null ? String(createdChallenges) : "-"}
          />
          <InfoRow
            label="Active Created"
            value={activeCreatedChallenges !== null ? String(activeCreatedChallenges) : "-"}
          />
          <InfoRow label="Completed Challenges" value={String(completed)} />
          <InfoRow label="Failed Challenges" value={String(failed)} />
        </View>

        <SectionTitle title="Reputation Signals" />
        <View style={styles.card}>
          <InfoRow label="Completion Rate" value={completionRate} />
          <InfoRow label="Current Streak" value={String(score?.streak_current ?? 0)} />
          <InfoRow label="Best Streak" value={String(score?.streak_best ?? 0)} />
        </View>

        <SectionTitle title="Pact Totals" />
        <View style={styles.card}>
          <InfoRow
            label="Total Staked (USDC)"
            value={score ? formatUsdc(score.total_staked_usdc) : "-"}
          />
          <InfoRow
            label="Total Earned (USDC)"
            value={score ? formatUsdc(score.total_earned_usdc) : "-"}
          />
        </View>

        <SectionTitle title="Actions" />

        <TouchableOpacity style={styles.linkBtn} onPress={() => openAccount(publicKey.toBase58())}>
          <Text style={styles.linkText}>View Wallet on Explorer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => openProgram()}>
          <Text style={styles.linkText}>View Pact Program</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => setShowHowItWorks(true)}>
          <Text style={styles.linkText}>How Pact Works</Text>
        </TouchableOpacity>

        <PactButton label="Disconnect Wallet" variant="danger" onPress={handleDisconnect} style={{ marginTop: 8 }} />
      </ScrollView>

      <HowPactWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  overline: {
    marginTop: 6,
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardLabel: {
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontWeight: "700",
    marginBottom: 4,
  },
  inlineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  networkTag: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  address: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  scoreCard: {
    backgroundColor: "#10253B",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A507A",
    padding: 14,
    marginTop: 2,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 46,
    fontWeight: "800",
    lineHeight: 52,
  },
  rank: {
    color: colors.textFaint,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  miniStat: {
    flex: 1,
    backgroundColor: "#16314D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2F5B88",
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  miniValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  miniLabel: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 9,
  },
  infoLabel: {
    color: colors.textSoft,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  linkBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
});
