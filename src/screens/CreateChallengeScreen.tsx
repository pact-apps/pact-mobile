import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useAppStore } from "../store/useAppStore";
import { createChallenge } from "../services/transactions";
import { openTransaction } from "../utils/explorer";

export default function CreateChallengeScreen({ navigation }: any) {
  const { publicKey } = useAppStore();
  const [title, setTitle] = useState("");
  const [stake, setStake] = useState("");
  const [duration, setDuration] = useState("7");
  const [maxParticipants, setMaxParticipants] = useState("4");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!publicKey) {
      Alert.alert("Error", "Connect wallet first");
      return;
    }
    if (!title || !stake) {
      Alert.alert("Error", "Fill in all fields");
      return;
    }
    if (title.length > 64) {
      Alert.alert("Error", "Title too long (max 64 chars)");
      return;
    }
    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum <= 0) {
      Alert.alert("Error", "Invalid stake amount");
      return;
    }
    const maxPart = parseInt(maxParticipants);
    if (isNaN(maxPart) || maxPart < 2 || maxPart > 10) {
      Alert.alert("Error", "Participants must be 2-10");
      return;
    }

    setLoading(true);
    try {
      const challengeId = `pact-${Date.now()}`;
      const durationSec = parseInt(duration) * 86400;

      const signature = await createChallenge(
        publicKey,
        challengeId,
        stakeNum,
        durationSec,
        maxPart,
        title
      );

      Alert.alert("Success!", "Challenge created!", [
        { text: "OK", onPress: () => navigation.goBack() },
        { text: "View TX", onPress: () => openTransaction(signature) },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create challenge");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Challenge Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Gym 3x This Week"
        placeholderTextColor="#6b7280"
        maxLength={64}
      />

      <Text style={styles.label}>Stake Amount (USDC)</Text>
      <TextInput
        style={styles.input}
        value={stake}
        onChangeText={setStake}
        placeholder="e.g. 10"
        placeholderTextColor="#6b7280"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Duration (Days)</Text>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        placeholderTextColor="#6b7280"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Max Participants (2-10)</Text>
      <TextInput
        style={styles.input}
        value={maxParticipants}
        onChangeText={setMaxParticipants}
        placeholderTextColor="#6b7280"
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={[styles.createBtn, loading && { opacity: 0.5 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.createBtnText}>
          {loading ? "Creating..." : "Create Challenge"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a0a" },
  label: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  createBtn: {
    backgroundColor: "#7c3aed",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  createBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
