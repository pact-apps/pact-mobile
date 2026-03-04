import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { pactApi } from "../services/apiInstance";
import { useAppStore } from "../store/useAppStore";
import type { LeaderboardEntry } from "../services/pactApi";

export default function LeaderboardScreen() {
  const { publicKey } = useAppStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await pactApi.scores.leaderboard(50, 0);
      setEntries(data.entries);
    } catch {
      // Backend may not be available
    } finally {
      setLoading(false);
    }
  };

  const myAddress = publicKey?.toBase58();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Leaderboard</Text>
      <Text style={styles.subtitle}>Top commitment scores</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#7c3aed"
          style={{ marginTop: 40 }}
        />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyText}>
          No scores yet. Complete challenges to appear here!
        </Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.wallet_address}
          renderItem={({ item, index }) => {
            const isMe = myAddress === item.wallet_address;
            const rank = index + 1;

            return (
              <View
                style={[
                  styles.row,
                  isMe && styles.myRow,
                  rank <= 3 && styles.topRow,
                ]}
              >
                <View style={styles.rankContainer}>
                  <Text
                    style={[
                      styles.rank,
                      rank === 1 && { color: "#fbbf24" },
                      rank === 2 && { color: "#d1d5db" },
                      rank === 3 && { color: "#d97706" },
                    ]}
                  >
                    #{rank}
                  </Text>
                </View>

                <View style={styles.info}>
                  <Text
                    style={[styles.address, isMe && { color: "#a78bfa" }]}
                  >
                    {isMe
                      ? "You"
                      : `${item.wallet_address.slice(0, 6)}...${item.wallet_address.slice(-4)}`}
                  </Text>
                  <Text style={styles.meta}>
                    {item.challenges_completed} completed
                    {item.streak_best > 0 && ` | Best streak: ${item.streak_best}`}
                  </Text>
                </View>

                <Text style={styles.score}>{item.score}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a0a" },
  header: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 20,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  myRow: {
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  topRow: {
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  rankContainer: {
    width: 40,
    alignItems: "center",
  },
  rank: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "700",
  },
  info: {
    flex: 1,
    marginLeft: 8,
  },
  address: {
    color: "#e5e7eb",
    fontSize: 14,
    fontFamily: "monospace",
  },
  meta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  score: {
    color: "#7c3aed",
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 12,
  },
});
