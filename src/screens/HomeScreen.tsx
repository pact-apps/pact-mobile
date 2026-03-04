import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAllChallenges } from "../hooks/useChallenge";
import { useAppStore } from "../store/useAppStore";
import {
  authorizeWallet,
  reauthorizeWallet,
  getCachedPublicKey,
} from "../services/wallet";
import { getSolBalance, getUsdcBalance } from "../services/solana";
import { USDC_MINT } from "../utils/constants";
import {
  authenticateWithBackend,
  restoreBackendAuth,
} from "../services/backendAuth";

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
    default:
      return "#9ca3af";
  }
}

export default function HomeScreen({ navigation }: any) {
  const { data: challenges, isLoading } = useAllChallenges();
  const { connected, publicKey, setWallet, setBalances } = useAppStore();

  // Try to restore session on mount
  useEffect(() => {
    (async () => {
      if (connected) return;
      const cached = await getCachedPublicKey();
      if (cached) {
        const result = await reauthorizeWallet();
        if (result) {
          setWallet(result.publicKey, result.authToken);
          const sol = await getSolBalance(result.publicKey);
          const usdc = await getUsdcBalance(result.publicKey, USDC_MINT);
          setBalances(sol, usdc);
          // Restore backend JWT
          await restoreBackendAuth();
        }
      }
    })();
  }, []);

  const handleConnect = async () => {
    try {
      const result = await authorizeWallet();
      setWallet(result.publicKey, result.authToken);
      const sol = await getSolBalance(result.publicKey);
      const usdc = await getUsdcBalance(result.publicKey, USDC_MINT);
      setBalances(sol, usdc);

      // Authenticate with backend (sign message + verify)
      try {
        await authenticateWithBackend(result.publicKey.toBase58());
      } catch {
        // Backend auth is optional — on-chain features still work
        console.warn("Backend auth failed, some features may be limited");
      }
    } catch (error: any) {
      Alert.alert("Connection Failed", error.message || "Could not connect wallet");
    }
  };

  return (
    <View style={styles.container}>
      {/* Wallet Section */}
      {!connected ? (
        <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
          <Text style={styles.connectBtnText}>Connect Wallet</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.walletInfo}>
          <Text style={styles.walletText}>
            {publicKey?.toBase58().slice(0, 8)}...
            {publicKey?.toBase58().slice(-4)}
          </Text>
        </View>
      )}

      {/* Create Button */}
      {connected && (
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate("CreateChallenge")}
        >
          <Text style={styles.createBtnText}>+ New Challenge</Text>
        </TouchableOpacity>
      )}

      {/* Challenge List */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.publicKey.toBase58()}
          renderItem={({ item }) => {
            const status = Object.keys(item.account.status)[0];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  navigation.navigate("ChallengeDetail", {
                    challengeId: item.account.challengeId,
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.account.title}</Text>
                  <View
                    style={[
                      styles.cardStatusBadge,
                      { backgroundColor: getStatusColor(status) + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cardStatusText,
                        { color: getStatusColor(status) },
                      ]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  Stake:{" "}
                  {(item.account.stakeAmount?.toNumber?.() ??
                    item.account.stakeAmount) /
                    1_000_000}{" "}
                  USDC
                </Text>
                <Text style={styles.cardMeta}>
                  Participants: {item.account.participantCount ?? item.account.depositCount ?? 0}/
                  {item.account.maxParticipants}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No challenges yet. Create one!
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a0a" },
  connectBtn: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  connectBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  walletInfo: {
    backgroundColor: "#1a1a2e",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  walletText: { color: "#a78bfa", fontSize: 14, fontFamily: "monospace" },
  createBtn: {
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  cardStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  cardStatusText: { fontSize: 10, fontWeight: "700" },
  cardMeta: { color: "#9ca3af", fontSize: 14, marginBottom: 4 },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
});
