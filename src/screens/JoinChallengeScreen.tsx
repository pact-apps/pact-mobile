import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import PactButton from "../components/ui/PactButton";
import { RootStackParamList } from "../navigation/AppNavigator";
import AmbientBackground from "../components/ui/AmbientBackground";
import { colors } from "../theme/colors";
import { fetchChallenge, fetchSkrLockAccount, fetchVaultBalance } from "../services/anchor";
import { pactApi } from "../services/apiInstance";
import { joinChallenge } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";
import { SKR_BASE_UNITS } from "../utils/constants";
import type { ChallengeConfigResponse } from "../services/pactApi";

type Props = NativeStackScreenProps<RootStackParamList, "JoinChallenge">;

export default function JoinChallengeScreen({ navigation, route }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isLoadingSkr, setIsLoadingSkr] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [challengeCode, setChallengeCode] = useState(route.params?.challengeId ?? "");
  const [challenge, setChallenge] = useState<Awaited<ReturnType<typeof fetchChallenge>>>(null);
  const [metadata, setMetadata] = useState<ChallengeConfigResponse | null>(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [skrLockedAmount, setSkrLockedAmount] = useState<number | null>(null);
  const [joinStatus, setJoinStatus] = useState<{
    tone: "neutral" | "success" | "error";
    text: string;
  } | null>(null);
  const publicKey = useAppStore((state) => state.publicKey);

  useEffect(() => {
    if (route.params?.challengeId) {
      void onLookup(route.params.challengeId);
    }
  }, [route.params?.challengeId]);

  useEffect(() => {
    let active = true;

    const loadSkrState = async () => {
      if (!publicKey) {
        setSkrLockedAmount(null);
        return;
      }

      setIsLoadingSkr(true);
      try {
        const skrLock = await fetchSkrLockAccount(publicKey);
        if (!active) {
          return;
        }
        setSkrLockedAmount(
          skrLock ? skrLock.account.amountLocked.toNumber() / SKR_BASE_UNITS : null
        );
      } finally {
        if (active) {
          setIsLoadingSkr(false);
        }
      }
    };

    void loadSkrState();

    return () => {
      active = false;
    };
  }, [publicKey]);

  const onLookup = async (codeOverride?: string) => {
    const nextCode = (codeOverride ?? challengeCode).trim();
    if (!nextCode) {
      Alert.alert("Enter Code", "Paste or type a challenge invite code first.");
      return;
    }

    setIsLoadingChallenge(true);
    try {
      setJoinStatus(null);
      const [found, metadataResult] = await Promise.all([
        fetchChallenge(nextCode),
        pactApi.challenges.get(nextCode).catch(() => null),
      ]);
      if (!found) {
        setChallenge(null);
        setMetadata(null);
        setVaultBalance(0);
        Alert.alert("Not Found", "No challenge was found for that invite code.");
        return;
      }

      setChallenge(found);
      setMetadata(metadataResult);
      const balance = await fetchVaultBalance(found.publicKey);
      setVaultBalance(balance);
      setChallengeCode(nextCode);
    } catch (error: any) {
      Alert.alert("Lookup Failed", error?.message || "Could not load that challenge.");
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  const onJoin = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before joining a challenge.");
      return;
    }
    if (!challenge) {
      Alert.alert("Find Challenge", "Load a valid invite code before joining.");
      return;
    }

    setIsProcessing(true);
    setJoinStatus({
      tone: "neutral",
      text: "Opening wallet for approval...",
    });
    try {
      const signature = await joinChallenge(publicKey, challenge.account.challengeId);
      setJoinStatus({
        tone: "success",
        text: `Join confirmed. Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      setIsProcessing(false);
      setTimeout(() => {
        navigation.replace("ChallengeDetail", {
          challengeId: challenge.account.challengeId,
          title: challenge.account.title,
          stake: formatUsdc(challenge.account.stakeAmount.toNumber() / 1_000_000),
          duration: challenge.account.durationSeconds.divn(24 * 60 * 60).toString(),
          maxParticipants: challenge.account.maxParticipants.toString(),
        });
      }, 150);
    } catch (error: any) {
      setIsProcessing(false);
      const message = error?.message || "Could not join the challenge.";
      setJoinStatus({
        tone: "error",
        text: message,
      });
      Alert.alert("Join Failed", message);
    }
  };

  const openConfirm = () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before joining a challenge.");
      return;
    }
    if (!challenge) {
      Alert.alert("Find Challenge", "Load a valid invite code before joining.");
      return;
    }
    setConfirmVisible(true);
  };

  const metadataDescription = metadata?.metadata.description?.trim() || null;
  const metadataRules = getRulesText(metadata);

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>Enter Invite Code</Text>
          <Text style={styles.lookupText}>
            Paste the code shared by the challenge creator to load the pact details.
          </Text>
          <TextInput
            value={challengeCode}
            onChangeText={setChallengeCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. 30-day-gym-consistency-m3w9z0"
            placeholderTextColor="#6A7F9E"
            style={styles.input}
          />
          <PactButton label="Find Challenge" onPress={() => void onLookup()} loading={isLoadingChallenge} />
        </View>

        {challenge ? (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{challenge.account.title}</Text>
              <InfoRow label="Invite Code" value={challenge.account.challengeId} />
              <InfoRow
                label="Stake"
                value={`${formatUsdc(challenge.account.stakeAmount.toNumber() / 1_000_000)} USDC`}
              />
              <InfoRow label="Current Pool" value={`${formatUsdc(vaultBalance)} USDC`} />
              <InfoRow
                label="Participants"
                value={`${challenge.account.participantCount} / ${challenge.account.maxParticipants}`}
              />
              <InfoRow
                label="Duration"
                value={`${challenge.account.durationSeconds.divn(24 * 60 * 60).toString()} days`}
              />
              <View style={styles.copyBlock}>
                <Text style={styles.copyTitle}>Description</Text>
                <Text style={styles.copyText}>
                  {metadataDescription ?? "No description added by the creator yet."}
                </Text>
              </View>
              <View style={styles.copyBlock}>
                <Text style={styles.copyTitle}>Rules</Text>
                <Text style={styles.copyText}>
                  {metadataRules ?? "No rules added by the creator yet."}
                </Text>
              </View>
            </View>

            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Ready to join?</Text>
              <Text style={styles.confirmText}>
                Review the stake and group details first, then confirm before your wallet opens.
              </Text>
            </View>

            <PactButton label="Join Challenge" onPress={openConfirm} loading={isProcessing} />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Challenge Loaded</Text>
            <Text style={styles.emptyText}>
              Use an invite code to preview the challenge before you commit your stake.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={confirmVisible}
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalPill} />
            <Text style={styles.modalTitle}>Confirm Your Join</Text>
            <Text style={styles.modalText}>
              Your stake will be locked until the challenge is settled.
            </Text>

            <View style={styles.modalCard}>
              <InfoRow label="Challenge" value={challenge?.account.title ?? "-"} />
              <InfoRow
                label="Stake"
                value={`${formatUsdc(
                  challenge ? challenge.account.stakeAmount.toNumber() / 1_000_000 : 0
                )} USDC`}
              />
              <InfoRow
                label="Duration"
                value={`${challenge?.account.durationSeconds.divn(24 * 60 * 60).toString() ?? "0"} days`}
              />
              <InfoRow
                label="Group"
                value={`${challenge?.account.participantCount ?? 0} / ${challenge?.account.maxParticipants ?? 0}`}
              />
            </View>

            <View style={styles.skrCard}>
              <View style={styles.skrHeader}>
                <Text style={styles.skrTitle}>SKR Boost</Text>
                <View
                  style={[
                    styles.skrBadge,
                    skrLockedAmount ? styles.skrBadgeActive : styles.skrBadgeMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.skrBadgeText,
                      skrLockedAmount ? styles.skrBadgeTextActive : styles.skrBadgeTextMuted,
                    ]}
                  >
                    {isLoadingSkr ? "Checking" : skrLockedAmount ? "Auto" : "Unavailable"}
                  </Text>
                </View>
              </View>
              <Text style={styles.skrText}>
                {isLoadingSkr
                  ? "Checking whether this wallet already has locked SKR for commitment score boost..."
                  : skrLockedAmount
                    ? `Locked SKR detected (${formatUsdc(skrLockedAmount)} SKR). This can boost your commitment score, and it will be applied automatically if the contract accepts it.`
                    : "No locked SKR found for this wallet yet. Join will continue without the commitment boost."}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <PactButton
                label="Back"
                variant="secondary"
                onPress={() => setConfirmVisible(false)}
                style={{ flex: 1 }}
              />
              <PactButton
                label="Confirm Join"
                onPress={() => {
                  setConfirmVisible(false);
                  void onJoin();
                }}
                loading={isProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={!!joinStatus}
        onRequestClose={() => setJoinStatus(null)}
      >
        <View style={styles.statusBackdrop}>
          <View
            style={[
              styles.statusModal,
              joinStatus?.tone === "success" && styles.statusModalSuccess,
              joinStatus?.tone === "error" && styles.statusModalError,
            ]}
          >
            <Text style={styles.statusModalTitle}>
              {joinStatus?.tone === "error"
                ? "Join Failed"
                : joinStatus?.tone === "success"
                  ? "Join Confirmed"
                  : "Joining Challenge"}
            </Text>
            <Text
              style={[
                styles.statusText,
                joinStatus?.tone === "success" && styles.statusTextSuccess,
                joinStatus?.tone === "error" && styles.statusTextError,
              ]}
            >
              {joinStatus?.text}
            </Text>
            {joinStatus?.tone !== "neutral" ? (
              <PactButton
                label="Close"
                variant="secondary"
                onPress={() => setJoinStatus(null)}
                style={{ marginTop: 4 }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  lookupCard: {
    backgroundColor: "#131C2B",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#273247",
    gap: 10,
  },
  lookupTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  lookupText: {
    color: colors.textSoft,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#162338",
    borderWidth: 1,
    borderColor: "#2F4260",
    borderRadius: 14,
    color: colors.text,
    minHeight: 50,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#131C2B",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#273247",
    gap: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#253042",
    paddingVertical: 8,
  },
  label: {
    color: "#8FA0B8",
    fontSize: 14,
  },
  value: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  copyBlock: {
    marginTop: 6,
    paddingTop: 8,
  },
  copyTitle: {
    color: "#CFE0F7",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  copyText: {
    color: "#AFC0DB",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  confirmCard: {
    backgroundColor: "#1A2539",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2E3E5D",
  },
  confirmTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "700",
  },
  confirmText: {
    marginTop: 6,
    color: "#94A3B8",
    lineHeight: 20,
  },
  statusBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 10, 18, 0.42)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  statusModal: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#31445E",
    backgroundColor: "#162234",
    padding: 12,
  },
  statusModalSuccess: {
    borderColor: "#1FAA7A",
    backgroundColor: "#103528",
  },
  statusModalError: {
    borderColor: "#C35A66",
    backgroundColor: "#34171D",
  },
  statusModalTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  statusText: {
    color: "#C9D8EE",
    fontSize: 13,
    lineHeight: 19,
  },
  statusTextSuccess: {
    color: "#BDF3D7",
  },
  statusTextError: {
    color: "#FFC7CF",
  },
  emptyCard: {
    backgroundColor: "#131C2B",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#273247",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 6,
    color: colors.textSoft,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0F1727",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 14,
    borderTopWidth: 1,
    borderColor: "#25466A",
  },
  modalPill: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#33557C",
    alignSelf: "center",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  modalText: {
    color: "#95AACA",
    fontSize: 14,
    lineHeight: 20,
  },
  modalCard: {
    backgroundColor: "#13233A",
    borderWidth: 1,
    borderColor: "#274A72",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skrCard: {
    backgroundColor: "#102429",
    borderWidth: 1,
    borderColor: "#225066",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  skrHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  skrTitle: {
    color: "#E3FEF1",
    fontSize: 15,
    fontWeight: "800",
  },
  skrBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  skrBadgeActive: {
    backgroundColor: "#18D3A522",
    borderColor: "#18D3A5",
  },
  skrBadgeMuted: {
    backgroundColor: "#33415533",
    borderColor: "#4B5563",
  },
  skrBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  skrBadgeTextActive: {
    color: "#9EF0D6",
  },
  skrBadgeTextMuted: {
    color: "#C0CAD7",
  },
  skrText: {
    color: "#C7D9DE",
    fontSize: 13,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
});
