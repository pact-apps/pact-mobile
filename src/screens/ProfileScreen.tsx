import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useAppStore } from "../store/useAppStore";
import { openAccount, openProgram } from "../utils/explorer";
import { authorizeWallet, deauthorizeWallet } from "../services/wallet";
import { getSolBalance, getUsdcBalance } from "../services/solana";
import { USDC_MINT } from "../utils/constants";
import { pactApi } from "../services/apiInstance";
import { clearBackendAuth } from "../services/backendAuth";
import type { ScoreResponse } from "../services/pactApi";

export default function ProfileScreen() {
  const {
    publicKey,
    connected,
    solBalance,
    usdcBalance,
    setWallet,
    setBalances,
    disconnect,
  } = useAppStore();

  const [score, setScore] = useState<ScoreResponse | null>(null);

  // Refresh balances and score
  useEffect(() => {
    if (connected && publicKey) {
      (async () => {
        const sol = await getSolBalance(publicKey);
        const usdc = await getUsdcBalance(publicKey, USDC_MINT);
        setBalances(sol, usdc);

        // Fetch commitment score from backend
        try {
          const s = await pactApi.scores.get(publicKey.toBase58());
          setScore(s);
        } catch {
          // Backend may not be available
        }
      })();
    }
  }, [connected, publicKey]);

  const handleConnect = async () => {
    try {
      const result = await authorizeWallet();
      setWallet(result.publicKey, result.authToken);
      const sol = await getSolBalance(result.publicKey);
      const usdc = await getUsdcBalance(result.publicKey, USDC_MINT);
      setBalances(sol, usdc);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not connect wallet");
    }
  };

  const handleDisconnect = async () => {
    await deauthorizeWallet();
    await clearBackendAuth();
    setScore(null);
    disconnect();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      {connected && publicKey ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.label}>Wallet Address</Text>
            <Text style={styles.value}>{publicKey.toBase58()}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.infoCard, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>SOL</Text>
              <Text style={styles.value}>{solBalance.toFixed(4)}</Text>
            </View>
            <View style={[styles.infoCard, { flex: 1 }]}>
              <Text style={styles.label}>USDC</Text>
              <Text style={styles.value}>{usdcBalance.toFixed(2)}</Text>
            </View>
          </View>

          {/* Commitment Score */}
          {score && (
            <View style={styles.scoreSection}>
              <Text style={styles.sectionTitle}>Commitment Score</Text>

              <View style={styles.scoreBigCard}>
                <Text style={styles.scoreNumber}>{score.score}</Text>
                {score.rank && (
                  <Text style={styles.scoreRank}>Rank #{score.rank}</Text>
                )}
              </View>

              <View style={styles.row}>
                <View style={[styles.statCard, { marginRight: 6 }]}>
                  <Text style={styles.statValue}>{score.challenges_completed}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={[styles.statCard, { marginHorizontal: 3 }]}>
                  <Text style={styles.statValue}>{score.challenges_failed}</Text>
                  <Text style={styles.statLabel}>Failed</Text>
                </View>
                <View style={[styles.statCard, { marginLeft: 6 }]}>
                  <Text style={styles.statValue}>{score.streak_current}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.statCard, { marginRight: 6 }]}>
                  <Text style={[styles.statValue, { color: "#4ade80" }]}>
                    {score.total_earned_usdc.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>Earned (USDC)</Text>
                </View>
                <View style={[styles.statCard, { marginLeft: 6 }]}>
                  <Text style={styles.statValue}>
                    {score.total_staked_usdc.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>Staked (USDC)</Text>
                </View>
              </View>

              {score.streak_best > 0 && (
                <View style={styles.infoCard}>
                  <Text style={styles.label}>Best Streak</Text>
                  <Text style={styles.value}>{score.streak_best}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.explorerBtn}
            onPress={() => openAccount(publicKey.toBase58())}
          >
            <Text style={styles.explorerBtnText}>
              View Wallet on Explorer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.explorerBtn}
            onPress={() => openProgram()}
          >
            <Text style={styles.explorerBtnText}>
              View Pact Program on Explorer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={handleDisconnect}
          >
            <Text style={styles.disconnectBtnText}>Disconnect Wallet</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </>
      ) : (
        <View style={styles.notConnectedSection}>
          <Text style={styles.notConnected}>Wallet not connected</Text>
          <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
            <Text style={styles.connectBtnText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a0a" },
  header: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { color: "#9ca3af", fontSize: 12, marginBottom: 4 },
  value: { color: "#fff", fontSize: 16, fontFamily: "monospace" },
  row: { flexDirection: "row", marginBottom: 8 },
  scoreSection: { marginBottom: 16 },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  scoreBigCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  scoreNumber: {
    color: "#7c3aed",
    fontSize: 48,
    fontWeight: "800",
  },
  scoreRank: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 4,
  },
  explorerBtn: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  explorerBtnText: { color: "#7c3aed", fontSize: 14, fontWeight: "600" },
  disconnectBtn: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  disconnectBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  notConnectedSection: { alignItems: "center", marginTop: 40 },
  notConnected: {
    color: "#6b7280",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  connectBtn: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  connectBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
