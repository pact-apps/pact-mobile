import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PublicKey } from "@solana/web3.js";
import PactButton from "../components/ui/PactButton";
import { RootStackParamList } from "../navigation/AppNavigator";
import { fetchAllParticipants, fetchChallenge } from "../services/anchor";
import { pactApi } from "../services/apiInstance";
import type { DisputeReviewResponse } from "../services/pactApi";
import { disputeParticipant } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "ReviewDispute">;

export default function ReviewDisputeScreen({ navigation, route }: Props) {
  const { challengeId } = route.params;
  const publicKey = useAppStore((state) => state.publicKey);
  const [isLoading, setIsLoading] = useState(true);
  const [challengeTitle, setChallengeTitle] = useState("Review & Dispute");
  const [items, setItems] = useState<
    Array<{
      wallet: string;
      review: DisputeReviewResponse | null;
    }>
  >([]);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadReviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const challenge = await fetchChallenge(challengeId);
      if (challenge) {
        setChallengeTitle(challenge.account.title);
        const participants = await fetchAllParticipants(challenge.publicKey);
        const reviews = await Promise.all(
          participants.map(async (participant) => {
            const wallet = participant.account.participant.toBase58();
            const review = await pactApi.proofs
              .getDisputeReview(challengeId, wallet)
              .catch(() => null);
            return { wallet, review };
          })
        );
        setItems(reviews);
      } else {
        setItems([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadReviewData();
  }, [loadReviewData]);

  const onDispute = async (targetWallet: string) => {
    if (!publicKey) {
      Alert.alert("Wallet Required", "Connect your wallet before filing a dispute.");
      return;
    }
    if (publicKey.toBase58() === targetWallet) {
      Alert.alert("Not Allowed", "You cannot dispute your own submission.");
      return;
    }

    setPendingWallet(targetWallet);
    try {
      await disputeParticipant(publicKey, challengeId, new PublicKey(targetWallet));
      Alert.alert("Dispute Filed", "Your dispute transaction was submitted.");
      await loadReviewData();
    } catch (error: any) {
      Alert.alert("Dispute Failed", extractBackendMessage(error));
    } finally {
      setPendingWallet(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{challengeTitle}</Text>
          <Text style={styles.rule}>
            Review backend proof summaries before disputing. Disputes are sent on-chain per participant.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.card}>
            <Text style={styles.user}>Loading review data...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.user}>No submissions available for review yet.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.wallet} style={styles.card}>
              <Text style={styles.user}>{shortWallet(item.wallet)}</Text>
              <Text style={styles.meta}>
                Claim: {item.review?.submission?.final_result_claim ?? "Not submitted"}
              </Text>
              <Text style={styles.meta}>
                Files: {item.review?.proof_files.length ?? 0} • Check-ins: {item.review?.daily_checkins.length ?? 0}
              </Text>
              <Text style={styles.meta}>
                Proof hash: {item.review?.summary?.final_sha256?.slice(0, 16) ?? "No summary"}...
              </Text>
              {item.review?.proof_files?.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.evidenceRail}
                >
                  {item.review.proof_files.map((file) => (
                    <Pressable
                      key={file.id}
                      style={styles.evidenceCard}
                      onPress={() => setPreviewImage(file.file_url)}
                    >
                      {file.mime_type.startsWith("image/") ? (
                        <Image source={{ uri: file.file_url }} style={styles.evidenceImage} />
                      ) : (
                        <View style={[styles.evidenceImage, styles.evidenceFallback]}>
                          <Text style={styles.evidenceFallbackText}>FILE</Text>
                        </View>
                      )}
                      <Text style={styles.evidenceLabel}>{file.proof_kind}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {item.review?.daily_checkins?.[0]?.notes ? (
                <Text style={styles.note}>Latest note: {item.review.daily_checkins[0].notes}</Text>
              ) : null}
              <View style={styles.row}>
                <PactButton
                  label="Approve"
                  variant="success"
                  onPress={() => Alert.alert("No Action Needed", "If you do not dispute, the submission simply stands.")}
                  style={styles.flexButton}
                />
                <PactButton
                  label="Dispute"
                  variant="danger"
                  onPress={() => void onDispute(item.wallet)}
                  loading={pendingWallet === item.wallet}
                  style={styles.flexButton}
                />
              </View>
            </View>
          ))
        )}

        <PactButton
          label="Continue to Settlement"
          onPress={() => navigation.navigate("Settlement", { challengeId })}
          style={{ marginTop: 8 }}
        />
      </ScrollView>

      <Modal
        transparent
        visible={!!previewImage}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewImage(null)} />
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1018",
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: "#131C2B",
    borderWidth: 1,
    borderColor: "#273247",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  rule: {
    color: "#CBD5E1",
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#131C2B",
    borderWidth: 1,
    borderColor: "#273247",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  user: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: "#D7E4F7",
    fontSize: 13,
    lineHeight: 18,
  },
  evidenceRail: {
    gap: 10,
    paddingTop: 4,
  },
  evidenceCard: {
    width: 104,
    gap: 6,
  },
  evidenceImage: {
    width: 104,
    height: 104,
    borderRadius: 12,
    backgroundColor: "#22314A",
  },
  evidenceFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#31445E",
  },
  evidenceFallbackText: {
    color: "#C9D8EE",
    fontSize: 12,
    fontWeight: "800",
  },
  evidenceLabel: {
    color: "#B9C9DF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 8, 14, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewImage: {
    width: "100%",
    height: "80%",
  },
});
