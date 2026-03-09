import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import PactButton from "../components/ui/PactButton";
import { RootStackParamList } from "../navigation/AppNavigator";
import { fetchChallenge } from "../services/anchor";
import { ensureBackendAuth } from "../services/backendAuth";
import { pactApi } from "../services/apiInstance";
import type {
  ChallengeConfigResponse,
  DailyCheckinResponse,
  FinalProofUploadResponse,
  FinalProofSummary,
  ProofHashResponse,
} from "../services/pactApi";
import { submitResult } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Submission">;

type UploadAsset = {
  uri: string;
  name: string;
  type: string;
};

export default function SubmissionScreen({ navigation, route }: Props) {
  const { challengeId } = route.params;
  const publicKey = useAppStore((state) => state.publicKey);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [isUploadingCheckin, setIsUploadingCheckin] = useState(false);
  const [isSubmittingOnChain, setIsSubmittingOnChain] = useState(false);
  const [challenge, setChallenge] = useState<Awaited<ReturnType<typeof fetchChallenge>>>(null);
  const [config, setConfig] = useState<ChallengeConfigResponse | null>(null);
  const [result, setResult] = useState<"success" | "fail" | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadAsset[]>([]);
  const [finalUpload, setFinalUpload] = useState<FinalProofUploadResponse | null>(null);
  const [proofHash, setProofHash] = useState<ProofHashResponse | null>(null);
  const [summary, setSummary] = useState<FinalProofSummary | null>(null);
  const [lastCheckin, setLastCheckin] = useState<DailyCheckinResponse | null>(null);
  const [checkinDate, setCheckinDate] = useState("");
  const [dayIndex, setDayIndex] = useState("");
  const [notes, setNotes] = useState("");

  const loadSubmissionContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const [chainChallenge, challengeConfig] = await Promise.all([
        fetchChallenge(challengeId),
        pactApi.challenges.get(challengeId).catch(() => null),
      ]);
      setChallenge(chainChallenge);
      setConfig(challengeConfig);

      if (publicKey) {
        const wallet = publicKey.toBase58();
        const [proofHashResult, summaryResult] = await Promise.all([
          pactApi.proofs.getProofHash(challengeId, wallet).catch(() => null),
          pactApi.proofs.getSummary(challengeId, wallet).catch(() => null),
        ]);
        setProofHash(proofHashResult);
        setSummary(summaryResult);
      }
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, publicKey]);

  useEffect(() => {
    void loadSubmissionContext();
  }, [loadSubmissionContext]);

  const challengeType = config?.metadata.challenge_type ?? "final_only";
  const rulesText = getRulesText(config);
  const stakeAmount = challenge ? challenge.account.stakeAmount.toNumber() / 1_000_000 : 0;
  const checkinWindow = useMemo(() => {
    const value = config?.rules?.rules_json?.checkin_window;
    return typeof value === "string" ? value : null;
  }, [config]);

  const pickFiles = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Allow photo access to upload proof files.");
      return;
    }

    const resultPicker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5,
    });

    if (resultPicker.canceled) {
      return;
    }

    const nextFiles = resultPicker.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `proof-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || "image/jpeg",
    }));
    setSelectedFiles((current) => {
      const merged = [...current, ...nextFiles];
      return merged.slice(0, 5);
    });
  };

  const removeFile = (uri: string) => {
    setSelectedFiles((current) => current.filter((file) => file.uri !== uri));
  };

  const uploadFinalProof = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before uploading proof.");
      return;
    }
    if (!result) {
      Alert.alert("Choose Result", "Select whether you succeeded or failed before uploading.");
      return;
    }
    if (challengeType === "final_only" && selectedFiles.length === 0) {
      Alert.alert("Proof Required", "Final-only challenges require at least one proof file.");
      return;
    }

    setIsUploadingFinal(true);
    try {
      await ensureBackendAuth(publicKey.toBase58());
      const uploaded = await pactApi.proofs.uploadFinal(challengeId, selectedFiles, result);
      setFinalUpload(uploaded);
      setProofHash({
        challenge_id: uploaded.summary.challenge_id,
        participant_wallet: uploaded.summary.participant_wallet,
        challenge_type: uploaded.summary.challenge_type,
        final_sha256: uploaded.final_sha256,
        generated_at: uploaded.summary.generated_at,
      });
      setSummary(uploaded.summary);
      Alert.alert("Final Proof Uploaded", "Your final proof was saved successfully.");
    } catch (error: any) {
      Alert.alert("Upload Failed", extractBackendMessage(error));
    } finally {
      setIsUploadingFinal(false);
    }
  };

  const uploadDailyCheckin = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before uploading a check-in.");
      return;
    }
    if (challengeType !== "daily_checkin") {
      Alert.alert("Not Needed", "This challenge uses final-only proof, not daily check-ins.");
      return;
    }
    if (selectedFiles.length === 0) {
      Alert.alert("Attachment Required", "Add at least one proof file for your daily check-in.");
      return;
    }

    setIsUploadingCheckin(true);
    try {
      await ensureBackendAuth(publicKey.toBase58());
      const uploaded = await pactApi.proofs.uploadCheckin(challengeId, selectedFiles, {
        checkin_date: checkinDate.trim() || undefined,
        day_index: dayIndex.trim() ? Number(dayIndex) : undefined,
        notes: notes.trim() || undefined,
      });
      setLastCheckin(uploaded);
      setProofHash((current) => ({
        challenge_id: challengeId,
        participant_wallet: publicKey.toBase58(),
        challenge_type: challengeType,
        final_sha256: uploaded.final_sha256,
        generated_at: new Date().toISOString(),
      }));
      Alert.alert("Check-in Uploaded", "Your daily check-in was saved successfully.");
    } catch (error: any) {
      Alert.alert("Check-in Failed", extractBackendMessage(error));
    } finally {
      setIsUploadingCheckin(false);
    }
  };

  const submitOnChain = async () => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before submitting your result.");
      return;
    }
    if (!result) {
      Alert.alert("Choose Result", "Select your final result first.");
      return;
    }
    if (challengeType === "final_only" && selectedFiles.length === 0) {
      Alert.alert("Proof Required", "Choose at least one proof file before submitting.");
      return;
    }

    setIsSubmittingOnChain(true);
    try {
      let latestProofHash = proofHash;

      if (challengeType === "final_only") {
        await ensureBackendAuth(publicKey.toBase58());
        const uploaded = await pactApi.proofs.uploadFinal(challengeId, selectedFiles, result);
        setFinalUpload(uploaded);
        latestProofHash = {
          challenge_id: uploaded.summary.challenge_id,
          participant_wallet: uploaded.summary.participant_wallet,
          challenge_type: uploaded.summary.challenge_type,
          final_sha256: uploaded.final_sha256,
          generated_at: uploaded.summary.generated_at,
        };
        setProofHash(latestProofHash);
        setSummary(uploaded.summary);
      }

      latestProofHash =
        latestProofHash ??
        (await pactApi.proofs.getProofHash(challengeId, publicKey.toBase58()));
      setProofHash(latestProofHash);

      const proofBytes = hexToBytes(latestProofHash.final_sha256);
      const signature = await submitResult(
        publicKey,
        challengeId,
        result === "success",
        proofBytes
      );
      Alert.alert("Result Submitted", `Transaction confirmed: ${signature.slice(0, 8)}...`);
      navigation.navigate("ReviewDispute", { challengeId });
    } catch (error: any) {
      Alert.alert("Submit Failed", extractBackendMessage(error));
    } finally {
      setIsSubmittingOnChain(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{challenge?.account.title ?? "Submission"}</Text>
          <Text style={styles.supporting}>
            Proof mode: {challengeType === "daily_checkin" ? "Daily Check-in" : "Final Only"}
          </Text>
          <InfoRow label="Stake" value={`${formatUsdc(stakeAmount)} USDC`} />
          <InfoRow
            label="Status"
            value={isLoading ? "Loading..." : challengeType === "daily_checkin" ? "Daily check-ins + final review" : "Final proof + final review"}
          />
          {checkinWindow ? <InfoRow label="Check-in Window" value={checkinWindow} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Choose Result</Text>
          <Text style={styles.body}>
            Choose whether you completed the challenge successfully or not.
          </Text>
          <View style={styles.row}>
            <PactButton
              label="SUCCESS"
              variant="success"
              onPress={() => setResult("success")}
              style={[styles.flexButton, result === "success" && styles.selected]}
            />
            <PactButton
              label="FAIL"
              variant="danger"
              onPress={() => setResult("fail")}
              style={[styles.flexButton, result === "fail" && styles.selected]}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Proof Files</Text>
          <Text style={styles.body}>
            {challengeType === "daily_checkin"
              ? "Pick images for your proof bundle. You can reuse the same picker for final proof or daily check-ins."
              : "Pick your final proof files. They will be sent automatically when you submit your result."}
          </Text>
          <PactButton label={selectedFiles.length > 0 ? `Selected ${selectedFiles.length} file(s)` : "Choose Files"} variant="secondary" onPress={() => void pickFiles()} />
          {selectedFiles.length > 0 ? (
            <View style={styles.fileList}>
              {selectedFiles.map((file) => (
                <View key={`${file.uri}-${file.name}`} style={styles.fileCard}>
                  <Image source={{ uri: file.uri }} style={styles.filePreview} />
                  <View style={styles.fileMeta}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileType}>{file.type}</Text>
                  </View>
                  <Pressable onPress={() => removeFile(file.uri)} style={styles.removeChip}>
                    <Text style={styles.removeChipText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {challengeType === "final_only" && proofHash ? (
            <Text style={styles.caption}>
              Latest proof prepared: {proofHash.final_sha256.slice(0, 16)}...
            </Text>
          ) : null}
        </View>

        {challengeType === "daily_checkin" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>3. Daily Check-in</Text>
            <TextInput
              value={checkinDate}
              onChangeText={setCheckinDate}
              placeholder="Check-in date (YYYY-MM-DD)"
              placeholderTextColor="#6A7F9E"
              style={styles.input}
            />
            <TextInput
              value={dayIndex}
              onChangeText={setDayIndex}
              placeholder="Day index (optional)"
              placeholderTextColor="#6A7F9E"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="#6A7F9E"
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />
            <PactButton
              label="Upload Daily Check-in"
              onPress={() => void uploadDailyCheckin()}
              loading={isUploadingCheckin}
            />
            {lastCheckin ? (
              <Text style={styles.caption}>
                Last check-in: {lastCheckin.checkin.checkin_date} • {lastCheckin.checkin.attachment_count} attachment(s)
              </Text>
            ) : null}
          </View>
        ) : null}

        {challengeType === "daily_checkin" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>4. Final Proof</Text>
            <Text style={styles.body}>
              Upload your final proof to prepare your result for submission.
            </Text>
            <PactButton
              label="Upload Final Proof"
              variant="secondary"
              onPress={() => void uploadFinalProof()}
              loading={isUploadingFinal}
            />
            {proofHash ? (
              <Text style={styles.caption}>
                Proof ready: {proofHash.final_sha256.slice(0, 16)}...
              </Text>
            ) : null}
            {summary ? (
              <Text style={styles.caption}>
                Summary generated: {summary.generated_at}
              </Text>
            ) : null}
            {finalUpload ? (
              <Text style={styles.caption}>
                Final files saved: {finalUpload.proof_files.length}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {challengeType === "daily_checkin" ? "5. Submit Result" : "3. Submit Result"}
          </Text>
          <Text style={styles.body}>
            {challengeType === "daily_checkin"
              ? "This is the final step that submits your success or fail result."
              : "This is the final step. Your selected proof files will be uploaded first, then your result will be submitted."}
          </Text>
          {rulesText ? <Text style={styles.rules}>{rulesText}</Text> : null}
          <PactButton
            label="Submit Result On-Chain"
            onPress={() => void submitOnChain()}
            loading={isSubmittingOnChain || (challengeType === "final_only" && isUploadingFinal)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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

function getRulesText(config: ChallengeConfigResponse | null) {
  const textRule = config?.rules?.rules_json?.text;
  if (typeof textRule === "string" && textRule.trim()) {
    return textRule.trim();
  }
  return null;
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

function hexToBytes(hex: string) {
  const normalized = hex.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Backend proof hash is not a valid 32-byte hex string.");
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1018",
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#13213A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#294061",
    padding: 16,
    gap: 6,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "800",
  },
  supporting: {
    color: "#A7BDD9",
    fontSize: 14,
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#131C2B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#273247",
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  body: {
    color: "#AFC0DB",
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  selected: {
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#253042",
  },
  infoLabel: {
    color: "#8FA0B8",
  },
  infoValue: {
    color: "#F8FAFC",
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
  },
  input: {
    backgroundColor: "#162338",
    borderWidth: 1,
    borderColor: "#2F4260",
    borderRadius: 14,
    color: "#F8FAFC",
    minHeight: 50,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fileList: {
    gap: 8,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#18243B",
    borderWidth: 1,
    borderColor: "#31445E",
    borderRadius: 14,
    padding: 10,
  },
  filePreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#22314A",
  },
  fileMeta: {
    flex: 1,
    gap: 3,
  },
  fileName: {
    color: "#E6EEF9",
    fontSize: 13,
    fontWeight: "700",
  },
  fileType: {
    color: "#8FA0B8",
    fontSize: 12,
  },
  removeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7C3E4B",
    backgroundColor: "#34171D",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeChipText: {
    color: "#FFC7CF",
    fontSize: 12,
    fontWeight: "700",
  },
  caption: {
    color: "#8FA0B8",
    fontSize: 12,
    lineHeight: 18,
  },
  rules: {
    color: "#D5E4F6",
    backgroundColor: "#172234",
    borderRadius: 12,
    padding: 12,
    lineHeight: 20,
  },
});
