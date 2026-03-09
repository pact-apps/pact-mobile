import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import AmbientBackground from "../components/ui/AmbientBackground";
import { colors } from "../theme/colors";
import { formatUsdc } from "../utils/format";
import { useAppStore } from "../store/useAppStore";
import { pactApi } from "../services/apiInstance";
import type { ChallengeConfigResponse, FinalProofSummary } from "../services/pactApi";

type Props = NativeStackScreenProps<RootStackParamList, "HistoryDetail">;

export default function HistoryDetailScreen({ route }: Props) {
  const publicKey = useAppStore((state) => state.publicKey);
  const {
    challengeId,
    title,
    result,
    payout,
    stake,
    participants,
    date,
    duration,
    winners,
    mySubmission,
    challengeType: routeChallengeType,
    settlementNote,
    proofSummary: initialProofSummary,
    filesSubmitted: initialFilesSubmitted,
    checkinsCompleted: initialCheckinsCompleted,
    expectedCheckins: initialExpectedCheckins,
  } = route.params;
  const [config, setConfig] = useState<ChallengeConfigResponse | null>(null);
  const [summary, setSummary] = useState<FinalProofSummary | null>(null);
  const isWon = result === "Won";

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [configResult, summaryResult] = await Promise.all([
        pactApi.challenges.get(challengeId).catch(() => null),
        publicKey
          ? pactApi.proofs.getSummary(challengeId, publicKey.toBase58()).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!active) {
        return;
      }

      setConfig(configResult);
      setSummary(summaryResult);
    };

    void load();

    return () => {
      active = false;
    };
  }, [challengeId, publicKey]);

  const derived = useMemo(() => {
    const summaryJson = summary?.summary_json ?? {};
    const evaluation = asRecord(summaryJson.evaluation);
    const proofFiles = Array.isArray(summaryJson.proof_files) ? summaryJson.proof_files : [];
    const dailyCheckins = Array.isArray(summaryJson.daily_checkins) ? summaryJson.daily_checkins : [];
    const challengeType =
      config?.metadata.challenge_type ?? summary?.challenge_type ?? routeChallengeType;
    const challengeTypeLabel =
      challengeType === "daily_checkin" ? "Daily Check-in" : "Final Only";

    const proofSummary =
      summary?.summary_text?.trim() ||
      initialProofSummary ||
      "No backend proof summary is available for this challenge yet.";

    const filesSubmitted =
      proofFiles.length > 0
        ? proofFiles.length
        : typeof initialFilesSubmitted === "number"
          ? initialFilesSubmitted
          : undefined;

    const checkinsCompletedRaw = asNumber(evaluation.completed_checkins);
    const expectedCheckinsRaw = asNumber(evaluation.expected_checkins);

    return {
      challengeTypeLabel,
      proofSummary,
      filesSubmitted,
      checkinsCompleted:
        checkinsCompletedRaw ?? initialCheckinsCompleted,
      expectedCheckins:
        expectedCheckinsRaw ?? initialExpectedCheckins,
      totalCheckinsFromSummary: dailyCheckins.length,
    };
  }, [
    config?.metadata.challenge_type,
    initialCheckinsCompleted,
    initialExpectedCheckins,
    initialFilesSubmitted,
    initialProofSummary,
    routeChallengeType,
    summary,
  ]);

  const hasProofSection =
    Boolean(derived.proofSummary) ||
    typeof derived.filesSubmitted === "number" ||
    typeof derived.checkinsCompleted === "number";

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{title}</Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Outcome</Text>
          <Text style={[styles.heroValue, { color: isWon ? colors.success : colors.danger }]}>
            {result}
          </Text>
          <Text style={[styles.heroPayout, { color: isWon ? colors.success : colors.danger }]}>
            {payout >= 0 ? "+" : "-"}{formatUsdc(Math.abs(payout))} USDC
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Challenge Overview</Text>
          <InfoRow label="Settled On" value={date} />
          <InfoRow label="Challenge Type" value={derived.challengeTypeLabel} />
          <InfoRow label="Duration" value={duration} />
          <InfoRow label="Stake" value={`${formatUsdc(stake)} USDC`} />
          <InfoRow label="Participants" value={`${participants}`} />
          <InfoRow label="Winners" value={winners} />
          <InfoRow label="Net Result" value={`${payout >= 0 ? "+" : "-"}${formatUsdc(Math.abs(payout))} USDC`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Submission</Text>
          <InfoRow label="Your Submission" value={mySubmission} />
          <InfoRow
            label="Review Status"
            value={mySubmission === "Success" ? "Qualified for payout" : "Did not qualify"}
            valueColor={mySubmission === "Success" ? colors.success : colors.danger}
          />
        </View>

        {hasProofSection && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Proof Summary</Text>
            <Text style={styles.summaryText}>{derived.proofSummary}</Text>
            {typeof derived.filesSubmitted === "number" ? (
              <InfoRow label="Files Submitted" value={`${derived.filesSubmitted}`} />
            ) : null}
            {typeof derived.checkinsCompleted === "number" &&
            typeof derived.expectedCheckins === "number" ? (
              <InfoRow
                label="Check-ins"
                value={`${derived.checkinsCompleted} / ${derived.expectedCheckins}`}
              />
            ) : null}
            {derived.totalCheckinsFromSummary > 0 ? (
              <InfoRow label="Recorded Check-ins" value={`${derived.totalCheckinsFromSummary}`} />
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settlement</Text>
          <Text style={styles.summaryText}>{settlementNote}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  heading: {
    marginTop: 6,
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  heroLabel: {
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  heroValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: "800",
  },
  heroPayout: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  infoLabel: {
    color: colors.textSoft,
    fontSize: 13,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  summaryText: {
    color: colors.textSoft,
    lineHeight: 20,
    marginBottom: 8,
  },
});
