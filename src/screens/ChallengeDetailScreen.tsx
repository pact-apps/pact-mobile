import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  useChallengeDetail,
  useVaultBalance,
  useParticipantState,
  useAllParticipants,
} from "../hooks/useChallenge";
import { useAppStore } from "../store/useAppStore";
import {
  joinChallenge,
  startChallenge,
  submitResult,
  disputeParticipant,
  finalizeChallenge,
  voteContinue,
} from "../services/transactions";
import { openTransaction } from "../utils/explorer";
import { pactApi } from "../services/apiInstance";
import { PublicKey } from "@solana/web3.js";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "#4ade80";
    case "active":
      return "#facc15";
    case "submission":
      return "#f97316";
    case "allFailVoting":
      return "#ef4444";
    case "settled":
      return "#6b7280";
    case "cancelled":
      return "#6b7280";
    default:
      return "#9ca3af";
  }
}

export default function ChallengeDetailScreen({ route }: any) {
  const { challengeId } = route.params;
  const { publicKey } = useAppStore();
  const { data: challenge, isLoading, refetch } = useChallengeDetail(challengeId);
  const { data: vaultBalance } = useVaultBalance(challenge?.publicKey ?? null);
  const { data: myState } = useParticipantState(
    challenge?.publicKey ?? null,
    publicKey ?? null
  );
  const { data: participants } = useAllParticipants(
    challenge?.publicKey ?? null
  );
  const [countdown, setCountdown] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);

  const c = challenge?.account;
  const status = c ? Object.keys(c.status)[0] : "";

  // Countdown timer
  useEffect(() => {
    if (!c) return;
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      let targetTime = 0;
      if (status === "active") {
        targetTime = c.deadline?.toNumber?.() ?? c.deadline ?? 0;
      } else if (status === "submission") {
        targetTime =
          c.submissionDeadline?.toNumber?.() ?? c.submissionDeadline ?? 0;
      }
      if (targetTime > 0) {
        setCountdown(formatCountdown(Math.max(0, targetTime - now)));
      } else {
        setCountdown("");
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [c, status]);

  const handleAction = useCallback(
    async (action: () => Promise<string>, successMsg: string) => {
      if (!publicKey) {
        Alert.alert("Error", "Connect wallet first");
        return;
      }
      setActionLoading(true);
      try {
        const sig = await action();
        refetch();
        Alert.alert("Success", successMsg, [
          { text: "OK" },
          { text: "View TX", onPress: () => openTransaction(sig) },
        ]);
      } catch (error: any) {
        Alert.alert("Error", error.message || "Transaction failed");
      } finally {
        setActionLoading(false);
      }
    },
    [publicKey, refetch]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!challenge || !c) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Challenge not found</Text>
      </View>
    );
  }

  const isCreator =
    publicKey && c.creator.toBase58() === publicKey.toBase58();
  const hasJoined = !!myState?.deposited;
  const hasSubmitted = !!myState?.submitted;

  return (
    <ScrollView style={styles.container}>
      {/* Title & Status */}
      <Text style={styles.title}>{c.title}</Text>
      <View style={styles.statusBadge}>
        <View
          style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]}
        />
        <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
          {status.toUpperCase()}
        </Text>
        {c.cycle > 1 && (
          <Text style={styles.cycleText}>Cycle {c.cycle}</Text>
        )}
      </View>

      {/* Countdown */}
      {countdown !== "" && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>
            {status === "active" ? "Deadline" : "Submission Closes"}
          </Text>
          <Text style={styles.countdownValue}>{countdown}</Text>
        </View>
      )}

      {/* Escrow Pool */}
      <View style={styles.poolCard}>
        <Text style={styles.poolLabel}>Escrow Pool</Text>
        <Text style={styles.poolAmount}>
          {(vaultBalance ?? 0).toFixed(2)} USDC
        </Text>
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <InfoRow
          label="Stake"
          value={`${(c.stakeAmount?.toNumber?.() ?? c.stakeAmount) / 1_000_000} USDC`}
        />
        <InfoRow
          label="Participants"
          value={`${c.participantCount ?? c.depositCount ?? 0} / ${c.maxParticipants}`}
        />
        <InfoRow
          label="Duration"
          value={`${Math.floor(((c.durationSeconds?.toNumber?.() ?? c.durationSeconds) || 0) / 86400)} days`}
        />
      </View>

      {/* Action Buttons */}
      {actionLoading && (
        <ActivityIndicator
          size="small"
          color="#7c3aed"
          style={{ marginVertical: 12 }}
        />
      )}

      <View style={styles.actionsSection}>
        {/* JOIN — when Open and not yet joined */}
        {status === "open" && !hasJoined && publicKey && (
          <ActionButton
            label="Join Challenge"
            color="#16a34a"
            disabled={actionLoading}
            onPress={() =>
              handleAction(
                () => joinChallenge(publicKey, challengeId),
                "Joined! USDC deposited to escrow."
              )
            }
          />
        )}

        {/* START — creator only, when Open and >= 2 participants */}
        {status === "open" &&
          isCreator &&
          (c.depositCount ?? c.participantCount ?? 0) >= 2 && (
            <ActionButton
              label="Start Challenge"
              color="#7c3aed"
              disabled={actionLoading}
              onPress={() =>
                handleAction(
                  () => startChallenge(publicKey!, challengeId),
                  "Challenge started! Countdown begins."
                )
              }
            />
          )}

        {/* SUBMIT — during submission window, if joined and not submitted */}
        {status === "submission" && hasJoined && !hasSubmitted && publicKey && (
          <View>
            {/* Proof image preview */}
            {proofImage && (
              <View style={styles.proofPreview}>
                <Image
                  source={{ uri: proofImage }}
                  style={styles.proofImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeProofBtn}
                  onPress={() => setProofImage(null)}
                >
                  <Text style={styles.removeProofText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Pick proof image */}
            <ActionButton
              label={proofImage ? "Change Proof Photo" : "Attach Proof Photo"}
              color="#334155"
              disabled={actionLoading}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setProofImage(result.assets[0].uri);
                }
              }}
            />

            <ActionButton
              label="Submit Success"
              color="#16a34a"
              disabled={actionLoading}
              onPress={() =>
                handleAction(async () => {
                  let proofHash = new Uint8Array(32);

                  // Upload proof to backend if image selected
                  if (proofImage) {
                    try {
                      const proofResp = await pactApi.proofs.upload(
                        challengeId,
                        publicKey.toBase58(),
                        {
                          uri: proofImage,
                          name: "proof.jpg",
                          type: "image/jpeg",
                        }
                      );
                      // Convert hex hash to bytes for on-chain
                      const hexHash = proofResp.proof_hash;
                      proofHash = new Uint8Array(
                        hexHash.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
                      );
                    } catch (e: any) {
                      console.warn("Proof upload failed, using empty hash:", e.message);
                    }
                  }

                  return submitResult(publicKey, challengeId, true, proofHash);
                }, "Result submitted: SUCCESS")
              }
            />
            <ActionButton
              label="Submit Fail"
              color="#ef4444"
              disabled={actionLoading}
              onPress={() =>
                handleAction(
                  () =>
                    submitResult(
                      publicKey,
                      challengeId,
                      false,
                      new Uint8Array(32)
                    ),
                  "Result submitted: FAIL"
                )
              }
            />
          </View>
        )}

        {/* FINALIZE — anyone can trigger after submission window */}
        {(status === "submission" || status === "active") &&
          publicKey &&
          participants &&
          participants.length > 0 && (
            <ActionButton
              label="Settle Challenge"
              color="#f59e0b"
              disabled={actionLoading}
              onPress={() =>
                handleAction(
                  () =>
                    finalizeChallenge(
                      publicKey,
                      challengeId,
                      participants.map(
                        (p: any) => new PublicKey(p.account.participant)
                      )
                    ),
                  "Challenge settled! Check your wallet."
                )
              }
            />
          )}

        {/* VOTE CONTINUE — AllFailVoting phase */}
        {status === "allFailVoting" && hasJoined && publicKey && (
          <View>
            <ActionButton
              label="Vote: Continue"
              color="#7c3aed"
              disabled={actionLoading}
              onPress={() =>
                handleAction(
                  () => voteContinue(publicKey, challengeId, true),
                  "Voted to continue!"
                )
              }
            />
            <ActionButton
              label="Vote: Refund"
              color="#ef4444"
              disabled={actionLoading}
              onPress={() =>
                handleAction(
                  () => voteContinue(publicKey, challengeId, false),
                  "Voted to refund!"
                )
              }
            />
          </View>
        )}
      </View>

      {/* Participants List */}
      {participants && participants.length > 0 && (
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {participants.map((p: any) => {
            const addr = p.account.participant.toBase58();
            const subResult = Object.keys(
              p.account.submissionResult ?? { none: {} }
            )[0];
            const isMe =
              publicKey && addr === publicKey.toBase58();

            return (
              <View key={addr} style={styles.participantRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.participantAddr, isMe && { color: "#a78bfa" }]}
                  >
                    {isMe ? "You" : `${addr.slice(0, 6)}...${addr.slice(-4)}`}
                  </Text>
                  <Text style={styles.participantMeta}>
                    {p.account.submitted
                      ? `Submitted: ${subResult.toUpperCase()}`
                      : p.account.deposited
                      ? "Deposited"
                      : "Pending"}
                    {p.account.disputeCount > 0 &&
                      ` | ${p.account.disputeCount} dispute(s)`}
                    {p.account.isWinner && " | WINNER"}
                  </Text>
                </View>

                {/* Dispute button */}
                {status === "submission" &&
                  hasJoined &&
                  publicKey &&
                  !isMe &&
                  p.account.submitted &&
                  subResult === "success" && (
                    <TouchableOpacity
                      style={styles.disputeBtn}
                      disabled={actionLoading}
                      onPress={() =>
                        handleAction(
                          () =>
                            disputeParticipant(
                              publicKey,
                              challengeId,
                              new PublicKey(addr)
                            ),
                          "Dispute filed!"
                        )
                      }
                    >
                      <Text style={styles.disputeBtnText}>Dispute</Text>
                    </TouchableOpacity>
                  )}
              </View>
            );
          })}
        </View>
      )}

      {/* My Status */}
      {myState && (
        <View style={styles.myStatusCard}>
          <Text style={styles.sectionTitle}>Your Status</Text>
          <InfoRow
            label="Deposited"
            value={myState.deposited ? "Yes" : "No"}
          />
          <InfoRow
            label="Submitted"
            value={myState.submitted ? "Yes" : "No"}
          />
          {myState.submitted && (
            <InfoRow
              label="Result"
              value={
                Object.keys(myState.submissionResult)[0].toUpperCase()
              }
            />
          )}
          {myState.isWinner && (
            <Text style={styles.winnerBadge}>WINNER</Text>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
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

function ActionButton({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color }, disabled && { opacity: 0.5 }]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a0a" },
  error: { color: "#ef4444", textAlign: "center", marginTop: 40, fontSize: 16 },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: { fontSize: 14, fontWeight: "700" },
  cycleText: {
    color: "#9ca3af",
    fontSize: 12,
    marginLeft: 12,
  },
  countdownCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  countdownLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 4 },
  countdownValue: {
    color: "#f59e0b",
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  poolCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  poolLabel: { color: "#9ca3af", fontSize: 14, marginBottom: 8 },
  poolAmount: { color: "#4ade80", fontSize: 36, fontWeight: "800" },
  infoSection: { marginBottom: 16 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  infoLabel: { color: "#9ca3af", fontSize: 16 },
  infoValue: { color: "#fff", fontSize: 16, fontWeight: "600" },
  actionsSection: { marginBottom: 20 },
  actionBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  participantsSection: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d44",
  },
  participantAddr: {
    color: "#e5e7eb",
    fontSize: 14,
    fontFamily: "monospace",
  },
  participantMeta: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  disputeBtn: {
    backgroundColor: "#dc262633",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  disputeBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  myStatusCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  winnerBadge: {
    color: "#4ade80",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },
  proofPreview: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  proofImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  removeProofBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#dc262633",
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  removeProofText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "600",
  },
});
