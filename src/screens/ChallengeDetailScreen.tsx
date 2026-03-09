import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import PactButton from "../components/ui/PactButton";
import ParticipantStatusCard from "../components/challenges/ParticipantStatusCard";
import { RootStackParamList } from "../navigation/AppNavigator";
import { fetchAllParticipants, fetchChallenge } from "../services/anchor";
import { pactApi } from "../services/apiInstance";
import { ensureBackendAuth } from "../services/backendAuth";
import type { ChallengeConfigResponse } from "../services/pactApi";
import { joinChallenge, startChallenge } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "ChallengeDetail">;

export default function ChallengeDetailScreen({ navigation, route }: Props) {
  const [chainChallenge, setChainChallenge] = useState<Awaited<ReturnType<typeof fetchChallenge>>>(null);
  const [metadata, setMetadata] = useState<ChallengeConfigResponse | null>(null);
  const [participants, setParticipants] = useState<
    Awaited<ReturnType<typeof fetchAllParticipants>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isJoiningCreator, setIsJoiningCreator] = useState(false);
  const { challengeId } = route.params;
  const publicKey = useAppStore((state) => state.publicKey);

  const loadChallenge = useCallback(async () => {
    setIsLoading(true);
    try {
      const [found, metadataResult] = await Promise.all([
        fetchChallenge(challengeId),
        pactApi.challenges.get(challengeId).catch(() => null),
      ]);
      let nextMetadata = metadataResult;

      const shouldResyncMetadata =
        !!found &&
        !!publicKey &&
        !!route.params.title &&
        (!!route.params.description || !!route.params.rules) &&
        (
          !metadataResult ||
          !metadataResult.metadata.description?.trim() ||
          !getRulesText(metadataResult)
        );

      if (shouldResyncMetadata) {
        try {
          await ensureBackendAuth(publicKey.toBase58());
          nextMetadata = await pactApi.challenges.upsertMetadata(challengeId, {
            challenge_pubkey: found.publicKey.toBase58(),
            title: route.params.title ?? found.account.title,
            description: route.params.description?.trim() || undefined,
            challenge_type: route.params.challengeType ?? "final_only",
            proof_rule_config: { proof_kind: "photo" },
            target_days: Number(route.params.duration ?? 0) || undefined,
            required_checkins:
              route.params.challengeType === "daily_checkin"
                ? Number(route.params.duration ?? 0) || undefined
                : undefined,
            grace_days: route.params.challengeType === "daily_checkin" ? 1 : 0,
            rules_json: route.params.rules?.trim()
              ? { text: route.params.rules.trim() }
              : undefined,
          });
        } catch {
          // Keep the existing fallback copy if backend resync still fails.
        }
      }

      setChainChallenge(found);
      setMetadata(nextMetadata);
      setParticipants(found ? await fetchAllParticipants(found.publicKey) : []);
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, publicKey, route.params.challengeType, route.params.description, route.params.duration, route.params.rules, route.params.title]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }
      await loadChallenge();
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadChallenge]);

  const merged = useMemo(() => {
    const account = chainChallenge?.account;
    const metadataDescription = metadata?.metadata.description?.trim() || null;
    const metadataRules = getRulesText(metadata);
    const statusKey = account ? Object.keys(account.status)[0] : "active";
    return {
      statusKey,
      title: account?.title ?? route.params.title ?? "Challenge",
      description:
        metadataDescription ??
        route.params.description ??
        "Challenge details will appear here once the creator adds them.",
      rules:
        metadataRules ??
        route.params.rules ??
        "No rules added by the creator yet.",
      challengeType:
        metadata?.metadata.challenge_type ?? route.params.challengeType ?? "final_only",
      stake:
        account ? formatUsdc(account.stakeAmount.toNumber() / 1_000_000) : route.params.stake ?? "0.00",
      duration:
        account?.durationSeconds.divn(24 * 60 * 60).toString() ?? route.params.duration ?? "0",
      maxParticipants: account?.maxParticipants.toString() ?? route.params.maxParticipants ?? "0",
      participantCount: account?.participantCount.toString() ?? "0",
      status: formatStatus(statusKey),
      timeLeft: account ? getTimeLeftLabel(account) : "--",
      timeLabel: account ? getTimeMetricLabel(account) : "Time Left",
    };
  }, [chainChallenge, route.params]);

  const isCreator =
    !!publicKey &&
    !!chainChallenge &&
    chainChallenge.account.creator.toBase58() === publicKey.toBase58();
  const isCreatorJoined =
    !!publicKey &&
    participants.some(
      (participant) => participant.account.participant.toBase58() === publicKey.toBase58()
    );
  const canJoinAsCreator =
    !!publicKey &&
    isCreator &&
    !isCreatorJoined &&
    merged.statusKey === "open";
  const canStart =
    merged.statusKey === "open" && isCreator && Number(merged.participantCount) >= 2;
  const canSubmit = merged.statusKey === "active" || merged.statusKey === "submission";
  const canReview = merged.statusKey === "submission" || merged.statusKey === "allFailVoting";
  const canViewSettlement = merged.statusKey === "settled" || merged.statusKey === "allFailVoting";

  const onStartChallenge = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before starting a challenge.");
      return;
    }
    if (!canStart) {
      Alert.alert("Cannot Start Yet", "A challenge needs at least 2 participants before it can start.");
      return;
    }

    setIsStarting(true);
    try {
      await startChallenge(publicKey, challengeId);
      await loadChallenge();
    } catch (error: any) {
      Alert.alert("Start Failed", error?.message || "Could not start the challenge.");
    } finally {
      setIsStarting(false);
    }
  };

  const onCopyInviteCode = async () => {
    await Clipboard.setStringAsync(challengeId);
    Alert.alert("Invite Code Copied", "Share this code so your friends can join the challenge.");
  };

  const onShareInviteCode = async () => {
    await Share.share({
      message: `Join my Pact challenge "${merged.title}" with invite code: ${challengeId}`,
    });
  };

  const onJoinAsCreator = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before joining this challenge.");
      return;
    }

    setIsJoiningCreator(true);
    try {
      await joinChallenge(publicKey, challengeId);
      await loadChallenge();
      Alert.alert("Joined as Creator", "Your stake has been added to the challenge.");
    } catch (error: any) {
      Alert.alert(
        "Join Failed",
        error?.message || "Could not join this challenge as the creator right now."
      );
    } finally {
      setIsJoiningCreator(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{merged.title}</Text>
          <Text style={styles.challengeId}>Invite Code: {challengeId}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{formatChallengeType(merged.challengeType)}</Text>
          </View>
          <Text style={styles.description}>{merged.description}</Text>
          <View style={styles.metricRow}>
            <Metric label="Stake" value={`${merged.stake} USDC`} />
            <Metric label="Duration" value={`${merged.duration} days`} />
          </View>
          <View style={styles.metricRow}>
            <Metric label="Players" value={`${merged.participantCount} / ${merged.maxParticipants}`} />
            <Metric label={merged.timeLabel} value={merged.timeLeft} />
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{isLoading ? "Status: Loading..." : `Status: ${merged.status}`}</Text>
          </View>
          <View style={styles.shareRow}>
            <PactButton
              label="Copy Code"
              variant="secondary"
              onPress={() => void onCopyInviteCode()}
              style={styles.shareButton}
            />
            <PactButton
              label="Share"
              onPress={() => void onShareInviteCode()}
              style={styles.shareButton}
            />
          </View>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.rulesText}>{merged.description}</Text>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.sectionTitle}>Rules</Text>
          <Text style={styles.rulesText}>{merged.rules}</Text>
        </View>

        <View style={styles.participantsWrap}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {participants.length > 0 ? (
            participants.map((participant: (typeof participants)[number]) => (
              <ParticipantStatusCard
                key={participant.publicKey.toBase58()}
                username={formatParticipantLabel(participant.account.participant.toBase58())}
                submitted={participant.account.submitted}
                result={formatParticipantResult(participant.account.submissionResult)}
              />
            ))
          ) : (
            <Text style={styles.emptyParticipants}>
              {isLoading
                ? "Loading participants..."
                : "No participants have joined this challenge yet."}
            </Text>
          )}
        </View>

        <View style={styles.actionWrap}>
          {canJoinAsCreator ? (
            <PactButton
              label="Join as Creator"
              onPress={() => void onJoinAsCreator()}
              loading={isJoiningCreator}
            />
          ) : null}
          {canStart ? (
            <PactButton
              label="Start Challenge"
              onPress={() => void onStartChallenge()}
              loading={isStarting}
              style={canJoinAsCreator ? styles.actionButtonSpacing : undefined}
            />
          ) : null}
          {merged.statusKey === "open" && isCreator && Number(merged.participantCount) < 2 ? (
            <Text style={styles.actionHint}>Need at least 2 participants before the challenge can start.</Text>
          ) : null}
          {canSubmit ? (
            <PactButton
              label="Go to Submission"
              onPress={() => navigation.navigate("Submission", { challengeId })}
              style={canStart ? styles.actionButtonSpacing : undefined}
            />
          ) : null}
          {canReview ? (
            <PactButton
              label="Review / Dispute"
              variant="secondary"
              onPress={() => navigation.navigate("ReviewDispute", { challengeId })}
              style={styles.actionButtonSpacing}
            />
          ) : null}
          {canViewSettlement ? (
            <PactButton
              label={merged.statusKey === "settled" ? "View Settlement" : "Settlement"}
              variant="success"
              onPress={() => navigation.navigate("Settlement", { challengeId })}
              style={styles.actionButtonSpacing}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case "allFailVoting":
      return "All-Fail Voting";
    case "submission":
      return "Submission";
    case "settled":
      return "Settled";
    case "cancelled":
      return "Cancelled";
    case "open":
      return "Open";
    default:
      return "Active";
  }
}

function formatChallengeType(challengeType: "final_only" | "daily_checkin") {
  return challengeType === "daily_checkin" ? "Daily Check-in" : "Final Only";
}

function getRulesText(config: ChallengeConfigResponse | null) {
  const textRule = config?.rules?.rules_json?.text;
  if (typeof textRule === "string" && textRule.trim()) {
    return textRule.trim();
  }

  if (!config?.rules) {
    return null;
  }

  const details: string[] = [];
  if (typeof config.rules.required_checkins === "number") {
    details.push(`Required check-ins: ${config.rules.required_checkins}`);
  }
  if (typeof config.rules.target_days === "number") {
    details.push(`Target days: ${config.rules.target_days}`);
  }
  if (typeof config.rules.grace_days === "number") {
    details.push(`Grace days: ${config.rules.grace_days}`);
  }

  return details.length > 0 ? details.join("\n") : null;
}

function formatParticipantLabel(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatParticipantResult(submissionResult: Record<string, object>) {
  const resultKey = Object.keys(submissionResult ?? {})[0];
  if (resultKey === "Success") {
    return "Success";
  }
  if (resultKey === "Fail") {
    return "Fail";
  }
  return "Pending";
}

function getTimeMetricLabel(account: NonNullable<Awaited<ReturnType<typeof fetchChallenge>>>["account"]) {
  const statusKey = Object.keys(account.status)[0];
  if (statusKey === "open") {
    return "Start";
  }
  if (statusKey === "settled" || statusKey === "cancelled") {
    return "State";
  }
  return statusKey === "submission" ? "Submission Left" : "Time Left";
}

function getTimeLeftLabel(account: NonNullable<Awaited<ReturnType<typeof fetchChallenge>>>["account"]) {
  const statusKey = Object.keys(account.status)[0];

  if (statusKey === "open") {
    return "Not started";
  }
  if (statusKey === "settled") {
    return "Completed";
  }
  if (statusKey === "cancelled") {
    return "Cancelled";
  }

  const now = Math.floor(Date.now() / 1000);
  const target =
    statusKey === "submission"
      ? account.submissionDeadline.toNumber()
      : account.deadline.toNumber();

  if (target <= 0) {
    return statusKey === "submission" ? "Awaiting submit" : "Not started";
  }

  const diff = target - now;
  if (diff <= 0) {
    return statusKey === "submission" ? "Closed" : "Ended";
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1018",
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: "#13213A",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#294061",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "800",
  },
  challengeId: {
    color: "#9FB4D0",
    fontSize: 12,
    marginTop: 4,
  },
  description: {
    color: "#C8D7EA",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  typeBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#14304C",
    borderColor: "#356A9A",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeText: {
    color: "#B8D9FF",
    fontSize: 12,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#1A2C49",
    borderRadius: 14,
    padding: 12,
  },
  metricLabel: {
    color: "#95A8C3",
    fontSize: 12,
  },
  metricValue: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontSize: 18,
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#2DA5FF22",
    borderColor: "#2DA5FF",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: "#72C2FF",
    fontWeight: "700",
  },
  shareRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  shareButton: {
    flex: 1,
  },
  rulesCard: {
    backgroundColor: "#131C2B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#273247",
    padding: 14,
  },
  participantsWrap: {
    backgroundColor: "#131C2B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#273247",
    padding: 14,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  rulesText: {
    color: "#B8C7DA",
    fontSize: 14,
    lineHeight: 22,
  },
  emptyParticipants: {
    color: "#8FA0B8",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
  actionWrap: {
    marginTop: 2,
  },
  actionHint: {
    color: "#8FA0B8",
    fontSize: 13,
    lineHeight: 19,
  },
  actionButtonSpacing: {
    marginTop: 10,
  },
});
