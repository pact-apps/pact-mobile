import React, { useMemo, useState } from "react";
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
import { MAX_PARTICIPANTS, SETTLEMENT_FEE_BPS } from "../utils/constants";
import { createChallenge, joinChallenge } from "../services/transactions";
import { getChallengePDA } from "../services/anchor";
import { pactApi } from "../services/apiInstance";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";
import { ensureBackendAuth } from "../services/backendAuth";

type Props = NativeStackScreenProps<RootStackParamList, "CreateChallenge">;

export default function CreateChallengeScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [challengeType, setChallengeType] = useState<"final_only" | "daily_checkin">("final_only");
  const [stake, setStake] = useState("");
  const [duration, setDuration] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoiningCreator, setIsJoiningCreator] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [autoJoinVisible, setAutoJoinVisible] = useState(false);
  const [metadataSyncError, setMetadataSyncError] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{
    challengeId: string;
    title: string;
    description: string;
    rules: string;
    stakeAmount: number;
    durationDays: number;
    participantLimit: number;
  } | null>(null);
  const publicKey = useAppStore((state) => state.publicKey);

  const summary = useMemo(() => {
    const s = Number(stake);
    const p = Number(maxParticipants);
    const pool = Number.isNaN(s) || Number.isNaN(p) ? 0 : s * p;
    return {
      stake: formatUsdc(s),
      pool: formatUsdc(pool),
    };
  }, [stake, maxParticipants]);

  const openChallengeDetail = (
    challengeId: string,
    trimmedTitle: string,
    trimmedDescription: string,
    trimmedRules: string,
    stakeAmount: number,
    durationDays: number,
    participantLimit: number
  ) => {
    navigation.replace("ChallengeDetail", {
      challengeId,
      title: trimmedTitle,
      description: trimmedDescription,
      rules: trimmedRules,
      challengeType,
      stake: formatUsdc(stakeAmount),
      duration: durationDays.toString(),
      maxParticipants: participantLimit.toString(),
    });
  };

  const submitCreate = async (
    challengeId: string,
    trimmedTitle: string,
    trimmedDescription: string,
    trimmedRules: string,
    stakeAmount: number,
    durationDays: number,
    participantLimit: number
  ) => {
    setIsCreating(true);
    setMetadataSyncError(null);
    let nextMetadataSyncError: string | null = null;
    try {
      await createChallenge(
        publicKey!,
        challengeId,
        stakeAmount,
        durationDays * 24 * 60 * 60,
        participantLimit,
        trimmedTitle
      );

      try {
        const [challengePDA] = getChallengePDA(challengeId);
        await ensureBackendAuth(publicKey!.toBase58());
        await pactApi.challenges.upsertMetadata(challengeId, {
          challenge_pubkey: challengePDA.toBase58(),
          title: trimmedTitle,
          description: trimmedDescription,
          tags: [],
          challenge_type: challengeType,
          proof_rule_config: { proof_kind: "photo" },
          required_checkins: challengeType === "daily_checkin" ? durationDays : undefined,
          target_days: durationDays,
          grace_days: challengeType === "daily_checkin" ? 1 : 0,
          rules_json: {
            text: trimmedRules,
          },
        });
      } catch (error: any) {
        const message = extractBackendMessage(error);
        nextMetadataSyncError = message;
        setMetadataSyncError(message);
      }

      setIsCreating(false);
      setPendingCreate({
        challengeId,
        title: trimmedTitle,
        description: trimmedDescription,
        rules: trimmedRules,
        stakeAmount,
        durationDays,
        participantLimit,
      });
      setAutoJoinVisible(true);
      if (nextMetadataSyncError) {
        Alert.alert(
          "Metadata Sync Failed",
          `Challenge was created on-chain, but description and rules were not saved to backend yet.\n\n${nextMetadataSyncError}`
        );
      }
    } catch (error: any) {
      setIsCreating(false);
      Alert.alert(
        "Create Failed",
        error?.message ||
          "Could not create the challenge. Check your wallet balance and try again."
      );
    }
  };

  const confirmCreatorJoin = async () => {
    if (!publicKey || !pendingCreate) {
      return;
    }

    setIsJoiningCreator(true);
    try {
      await joinChallenge(publicKey, pendingCreate.challengeId);
      setIsJoiningCreator(false);
      setAutoJoinVisible(false);
      openChallengeDetail(
        pendingCreate.challengeId,
        pendingCreate.title,
        pendingCreate.description,
        pendingCreate.rules,
        pendingCreate.stakeAmount,
        pendingCreate.durationDays,
        pendingCreate.participantLimit
      );
    } catch (error: any) {
      setIsJoiningCreator(false);
      Alert.alert(
        "Join Failed",
        error?.message ||
          "The challenge was created, but your creator stake could not be joined yet."
      );
    }
  };

  const onCreate = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before creating a challenge.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedRules = rules.trim();
    const stakeAmount = Number(stake);
    const durationDays = Number(duration);
    const participantLimit = Number(maxParticipants);

    if (!trimmedTitle || !trimmedDescription || !trimmedRules) {
      Alert.alert("Missing Info", "Fill in the title, description, and rules first.");
      return;
    }

    if (trimmedTitle.length > 64) {
      Alert.alert("Title Too Long", "Challenge title must be 64 characters or fewer.");
      return;
    }

    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      Alert.alert("Invalid Stake", "Stake must be greater than 0 USDC.");
      return;
    }

    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      Alert.alert("Invalid Duration", "Duration must be at least 1 day.");
      return;
    }

    if (
      !Number.isFinite(participantLimit) ||
      participantLimit < 2 ||
      participantLimit > MAX_PARTICIPANTS
    ) {
      Alert.alert(
        "Invalid Participant Limit",
        `Participant count must be between 2 and ${MAX_PARTICIPANTS}.`
      );
      return;
    }

    const challengeId = buildChallengeId(trimmedTitle);

    setPendingCreate({
      challengeId,
      title: trimmedTitle,
      description: trimmedDescription,
      rules: trimmedRules,
      stakeAmount,
      durationDays,
      participantLimit,
    });
    setConfirmVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="emerald" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Design your pact.</Text>
        <Text style={styles.subheading}>Set terms clearly so everyone knows the commitment.</Text>

        <View style={styles.formCard}>
          <Field
            label="Challenge Title"
            value={title}
            onChangeText={setTitle}
            placeholder="30-Day Gym Consistency"
          />
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Challenge Type</Text>
            <View style={styles.typeRow}>
              <TypeOption
                label="Final Only"
                active={challengeType === "final_only"}
                onPress={() => setChallengeType("final_only")}
              />
              <TypeOption
                label="Daily Check-in"
                active={challengeType === "daily_checkin"}
                onPress={() => setChallengeType("daily_checkin")}
              />
            </View>
            <Text style={styles.hint}>
              {challengeType === "final_only"
                ? "Participants submit one final proof at the end of the challenge."
                : "Participants check in every day during the challenge, then submit a final proof at the end."}
            </Text>
          </View>
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Go to the gym consistently for 30 days and complete the target number of workout sessions. This challenge is for building discipline, not intensity, so the main goal is showing up and finishing real sessions."
            multiline
          />
          <Field
            label="Rules"
            value={rules}
            onChangeText={setRules}
            placeholder={
              "1. Each participant must complete at least 4 gym sessions per week.\n2. Each session must be at least 45 minutes.\n3. Proof must be submitted before the weekly deadline.\n4. Valid proof: gym selfie, check-in screenshot, workout app log, or timestamped equipment photo.\n5. Fake, unclear, or late proof counts as fail for that period.\n6. Missing the minimum weekly target counts as fail.\n7. Final settlement is based on submitted proof and challenge rules."
            }
            multiline
          />
          <View style={styles.row}>
            <Field
              label="Stake (USDC)"
              value={stake}
              onChangeText={setStake}
              keyboardType="numeric"
              placeholder="10"
              compact
            />
            <Field
              label="Days"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="30"
              compact
            />
          </View>
          <Field
            label="Max Participants"
            value={maxParticipants}
            onChangeText={setMaxParticipants}
            keyboardType="numeric"
            placeholder="6"
            hint="Minimum 2, maximum 10 participants"
          />
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Payout Preview</Text>
          <InfoRow label="Stake / Person" value={`${summary.stake} USDC`} />
          <InfoRow label="Max Pool" value={`${summary.pool} USDC`} />
          <InfoRow label="Fee Model" value={`Only ${SETTLEMENT_FEE_BPS / 100}% of forfeited stake`} highlight />
        </View>

        <PactButton label="Create Challenge" onPress={onCreate} loading={isCreating} />
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
            <Text style={styles.modalTitle}>Review Your Pact</Text>
            <Text style={styles.modalText}>
              This will publish the challenge first. After that, you can review one more
              confirmation before joining it as the creator.
            </Text>

            <View style={styles.modalCard}>
              <InfoRow
                label="Challenge"
                value={pendingCreate?.title ?? (title.trim() || "Untitled")}
              />
              <InfoRow
                label="Stake / Person"
                value={`${formatUsdc(pendingCreate?.stakeAmount ?? 0)} USDC`}
              />
              <InfoRow
                label="Duration"
                value={`${pendingCreate?.durationDays ?? 0} days`}
              />
              <InfoRow
                label="Max Participants"
                value={`${pendingCreate?.participantLimit ?? 0}`}
              />
            </View>

            <View style={styles.mechanismCard}>
              <Text style={styles.mechanismTitle}>How settlement works</Text>
              <MechanismRow text="If everyone succeeds, everyone gets their full stake back." />
              <MechanismRow
                text={`Platform fee is only ${SETTLEMENT_FEE_BPS / 100}% of forfeited stake.`}
              />
              <MechanismRow text="Any remaining forfeited stake is shared by the winners." />
              <MechanismRow text="You will get a separate confirmation before your creator stake is locked." />
            </View>

            <View style={styles.modalActions}>
              <PactButton
                label="Back"
                variant="secondary"
                onPress={() => setConfirmVisible(false)}
                style={{ flex: 1 }}
              />
              <PactButton
                label="Confirm Create"
                onPress={() => {
                  if (!pendingCreate) {
                    return;
                  }
                  setConfirmVisible(false);
                  void submitCreate(
                    pendingCreate.challengeId,
                    pendingCreate.title,
                    pendingCreate.description,
                    pendingCreate.rules,
                    pendingCreate.stakeAmount,
                    pendingCreate.durationDays,
                    pendingCreate.participantLimit
                  );
                }}
                loading={isCreating}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={autoJoinVisible}
        onRequestClose={() => setAutoJoinVisible(false)}
      >
        <View style={styles.centerModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAutoJoinVisible(false)} />
          <View style={styles.centerModalCard}>
            <Text style={styles.modalTitle}>Challenge Created</Text>
            <Text style={styles.modalText}>
              Your pact is live. The next step is joining it as the creator so your own stake
              is locked in the challenge too.
            </Text>

            {metadataSyncError ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Metadata not synced yet</Text>
                <Text style={styles.warningText}>
                  The challenge exists on-chain, but description and rules could not be saved to
                  backend yet.
                </Text>
                <Text style={styles.warningText}>{metadataSyncError}</Text>
              </View>
            ) : null}

            <View style={styles.modalCard}>
              <InfoRow
                label="Next Action"
                value={`Join with ${formatUsdc(pendingCreate?.stakeAmount ?? 0)} USDC`}
              />
              <InfoRow
                label="What Happens"
                value="Your creator spot will be reserved and funded"
              />
            </View>

            <View style={styles.modalActions}>
              <PactButton
                label="Skip for Now"
                variant="secondary"
                onPress={() => {
                  if (!pendingCreate) {
                    return;
                  }
                  setAutoJoinVisible(false);
                  openChallengeDetail(
                    pendingCreate.challengeId,
                    pendingCreate.title,
                    pendingCreate.description,
                    pendingCreate.rules,
                    pendingCreate.stakeAmount,
                    pendingCreate.durationDays,
                    pendingCreate.participantLimit
                  );
                }}
                style={{ flex: 1 }}
              />
              <PactButton
                label="Join as Creator"
                onPress={() => {
                  void confirmCreatorJoin();
                }}
                loading={isJoiningCreator}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function buildChallengeId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18) || "challenge";

  return `${slug}-${Date.now().toString(36).slice(-6)}`;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric";
  compact?: boolean;
  multiline?: boolean;
  hint?: string;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  compact = false,
  multiline = false,
  hint,
}: FieldProps) {
  return (
    <View style={[styles.fieldWrap, compact && { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6A7F9E"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.textArea]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function TypeOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text onPress={onPress} style={[styles.typeOption, active && styles.typeOptionActive]}>
      {label}
    </Text>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: "#B4F4CF" }]}>{value}</Text>
    </View>
  );
}

function MechanismRow({ text }: { text: string }) {
  return (
    <View style={styles.mechanismRow}>
      <View style={styles.mechanismDot} />
      <Text style={styles.mechanismText}>{text}</Text>
    </View>
  );
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
  return error?.message || "Unknown backend error.";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heading: {
    marginTop: 6,
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
  },
  subheading: {
    color: "#9CB0CD",
    fontSize: 14,
    lineHeight: 20,
    marginTop: -2,
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#101A2B",
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  fieldWrap: {
    gap: 7,
  },
  label: {
    color: "#AFC0DB",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeOption: {
    flex: 1,
    textAlign: "center",
    backgroundColor: "#162338",
    borderWidth: 1,
    borderColor: "#2F4260",
    borderRadius: 14,
    color: colors.text,
    paddingVertical: 13,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  typeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "#1C355F",
    color: "#DDE9FF",
  },
  hint: {
    color: "#7F95B5",
    fontSize: 12,
    lineHeight: 16,
    marginTop: -1,
  },
  input: {
    backgroundColor: "#162338",
    borderWidth: 1,
    borderColor: "#2F4260",
    borderRadius: 14,
    color: colors.text,
    minHeight: 50,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#225066",
    backgroundColor: "#102429",
    padding: 14,
  },
  previewTitle: {
    color: "#E3FEF1",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3A56",
  },
  infoLabel: {
    color: "#A8C7CD",
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1.2,
    textAlign: "right",
    flexWrap: "wrap",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: 18,
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
  centerModalCard: {
    backgroundColor: "#0F1727",
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
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
  mechanismCard: {
    backgroundColor: "#102429",
    borderWidth: 1,
    borderColor: "#225066",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  warningCard: {
    backgroundColor: "#34171D",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#7C3E4B",
    padding: 14,
    gap: 8,
  },
  warningTitle: {
    color: "#FFE4E8",
    fontSize: 15,
    fontWeight: "800",
  },
  warningText: {
    color: "#FFC7CF",
    lineHeight: 19,
    fontSize: 13,
  },
  mechanismTitle: {
    color: "#E3FEF1",
    fontSize: 15,
    fontWeight: "800",
  },
  mechanismRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  mechanismDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#18D3A5",
    marginTop: 5,
  },
  mechanismText: {
    flex: 1,
    color: "#C7D9DE",
    fontSize: 13,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
});
