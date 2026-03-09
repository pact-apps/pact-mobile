import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import PactButton from "../components/ui/PactButton";
import { RootStackParamList } from "../navigation/AppNavigator";
import AmbientBackground from "../components/ui/AmbientBackground";
import { colors } from "../theme/colors";
import { useAppStore } from "../store/useAppStore";
import { getSolBalance, getUsdcBalance } from "../services/solana";
import { SKR_BASE_UNITS, USDC_MINT } from "../utils/constants";
import { pactApi } from "../services/apiInstance";
import {
  fetchChallengesForWallet,
  fetchCommitmentProfile,
  fetchSkrLockAccount,
} from "../services/anchor";
import { formatSol, formatUsdc } from "../utils/format";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<RootNav>();
  const appear = useRef(new Animated.Value(0)).current;
  const { publicKey, connected, usdcBalance, solBalance, setBalances } = useAppStore();
  const [score, setScore] = useState<number>(100);
  const [boostStatus, setBoostStatus] = useState<{
    active: boolean;
    lockedAmount: number;
  }>({ active: false, lockedAmount: 0 });
  const [summary, setSummary] = useState({
    active: 0,
    submissionDueToday: 0,
    settledThisWeek: 0,
    nextSubmissionLabel: "No pending windows",
  });

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (connected && publicKey) {
        try {
          const [sol, usdc] = await Promise.all([
            getSolBalance(publicKey),
            getUsdcBalance(publicKey, USDC_MINT),
          ]);
          if (active) {
            setBalances(sol, usdc);
          }
        } catch {
          // Ignore balance refresh errors on home.
        }

        try {
          const [profile, skrLock] = await Promise.all([
            fetchCommitmentProfile(publicKey),
            fetchSkrLockAccount(publicKey),
          ]);
          if (active) {
            setScore(profile ? Number(profile.account.commitmentScore) : 100);
            const lockedAmount = skrLock ? skrLock.account.amountLocked.toNumber() / SKR_BASE_UNITS : 0;
            setBoostStatus({
              active: lockedAmount > 0,
              lockedAmount,
            });
          }
        } catch {
          if (active) {
            setScore(100);
            setBoostStatus({ active: false, lockedAmount: 0 });
          }
        }
      } else if (active) {
        setScore(100);
        setBoostStatus({ active: false, lockedAmount: 0 });
      }

      try {
        if (!publicKey) {
          if (active) {
            setSummary({
              active: 0,
              submissionDueToday: 0,
              settledThisWeek: 0,
              nextSubmissionLabel: "No pending windows",
            });
          }
          return;
        }

        const walletChallenges = await fetchChallengesForWallet(publicKey);
        if (!active) return;

        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 60 * 60;

        const activeChallenges = walletChallenges.filter((item) => {
          const status = Object.keys(item.account.status)[0];
          return status === "open" || status === "active";
        });
        const submissionChallenges = walletChallenges.filter((item) => {
          const status = Object.keys(item.account.status)[0];
          return status === "submission";
        });
        const dueToday = submissionChallenges.filter(
          (item) => item.account.submissionDeadline.toNumber() - now <= 24 * 60 * 60
        );
        const settledThisWeek = walletChallenges.filter((item) => {
          const status = Object.keys(item.account.status)[0];
          return status === "settled" && item.account.deadline.toNumber() >= weekAgo;
        });

        const nextSubmission = submissionChallenges
          .map((item) => item.account.submissionDeadline.toNumber())
          .filter((deadline) => deadline > now)
          .sort((a, b) => a - b)[0];

        setSummary({
          active: activeChallenges.length,
          submissionDueToday: dueToday.length,
          settledThisWeek: settledThisWeek.length,
          nextSubmissionLabel: nextSubmission ? formatTimeLeft(nextSubmission) : "No pending windows",
        });
      } catch {
        if (active) {
          setSummary({
            active: 0,
            submissionDueToday: 0,
            settledThisWeek: 0,
            nextSubmissionLabel: "Unavailable",
          });
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [connected, publicKey, setBalances]);

  const urgencyPills = useMemo(
    () => [
      {
        title: "Submission Window",
        subtitle:
          summary.submissionDueToday > 0
            ? `${summary.submissionDueToday} due, next ${summary.nextSubmissionLabel}`
            : "No submission due today",
        tone: "warn" as const,
        },
      {
        title: "Commitment Boost",
        subtitle: boostStatus.active
          ? `Active · ${formatUsdc(boostStatus.lockedAmount)} SKR locked`
          : "Inactive · No SKR locked",
        tone: "good" as const,
      },
    ],
    [boostStatus.active, boostStatus.lockedAmount, summary.nextSubmissionLabel, summary.submissionDueToday]
  );

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <Animated.View
        style={{
          flex: 1,
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.overline}>PACT BOARD</Text>
          <Text style={styles.title}>Stake your discipline.</Text>
          <Text style={styles.subtitle}>Commit. Stake. Succeed.</Text>

          <View style={styles.heroPanel}>
            <View style={styles.scoreRing}>
              <View style={styles.scoreCore}>
                <Text style={styles.scoreValue}>{score}</Text>
                <Text style={styles.scoreLabel}>score</Text>
              </View>
            </View>
            <View style={styles.heroSide}>
              <Metric label="USDC" value={`${formatUsdc(usdcBalance)} USDC`} />
              <Metric label="SOL" value={formatSol(solBalance)} />
              <Metric label="Active Pacts" value={`${summary.active}`} tone="danger" />
            </View>
          </View>

          <View style={styles.urgencyRail}>
            {urgencyPills.map((pill) => (
              <UrgencyPill
                key={pill.title}
                title={pill.title}
                subtitle={pill.subtitle}
                tone={pill.tone}
              />
            ))}
          </View>

          <View style={styles.ctaDock}>
            <PactButton
              label="Create"
              onPress={() => navigation.navigate("CreateChallenge")}
              style={styles.ctaButton}
            />
            <PactButton
              label="Join"
              variant="secondary"
              onPress={() => navigation.navigate("JoinChallenge")}
              style={styles.ctaButton}
            />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Challenge Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Active</Text>
              <Text style={styles.summaryValue}>{summary.active}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submission Due Today</Text>
              <Text style={styles.summaryValue}>{summary.submissionDueToday}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Settled This Week</Text>
              <Text style={styles.summaryValue}>{summary.settledThisWeek}</Text>
            </View>
            <PactButton
              label="Create Challenge"
              variant="secondary"
              onPress={() => navigation.navigate("CreateChallenge")}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function Metric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "danger";
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === "danger" && { color: "#FCA5A5" }]}>{value}</Text>
    </View>
  );
}

function UrgencyPill({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: "good" | "warn";
}) {
  const color = tone === "good" ? colors.success : colors.warning;
  return (
    <View style={[styles.urgencyPill, { borderColor: `${color}66`, backgroundColor: `${color}1A` }]}>
      <Text style={styles.urgencyTitle}>{title}</Text>
      <Text style={[styles.urgencySubtitle, { color }]}>{subtitle}</Text>
    </View>
  );
}

function formatTimeLeft(targetUnix: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = targetUnix - now;

  if (diff <= 0) return "ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  overline: {
    marginTop: 6,
    color: "#89A3CE",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 35,
  },
  subtitle: {
    color: "#9AAECC",
    fontSize: 14,
    lineHeight: 20,
    marginTop: -4,
  },
  heroPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#111B2D",
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  scoreRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#203459",
    borderWidth: 8,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCore: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#0E1A2F",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  scoreLabel: {
    color: "#9CB0D5",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  heroSide: {
    flex: 1,
    gap: 8,
  },
  metricCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33415E",
    backgroundColor: "#18243B",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: "#9CB0D5",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    marginTop: 3,
    fontWeight: "700",
  },
  urgencyRail: {
    flexDirection: "row",
    gap: 8,
  },
  urgencyPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  urgencyTitle: {
    color: "#D9E5FA",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontWeight: "700",
  },
  urgencySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  ctaDock: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2E3A55",
    backgroundColor: "#111A2B",
    padding: 10,
  },
  ctaButton: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
