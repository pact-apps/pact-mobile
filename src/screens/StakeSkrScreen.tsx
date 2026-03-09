import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PublicKey } from "@solana/web3.js";
import PactButton from "../components/ui/PactButton";
import AmbientBackground from "../components/ui/AmbientBackground";
import { fetchCommitmentProfile, fetchSkrLockAccount } from "../services/anchor";
import { getUsdcBalance } from "../services/solana";
import { lockSkr, unlockSkr } from "../services/transactions";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";
import { SKR_BASE_UNITS, SKR_MINT_ADDRESS } from "../utils/constants";
import { formatUsdc } from "../utils/format";

export default function StakeSkrScreen() {
  const publicKey = useAppStore((state) => state.publicKey);
  const [amount, setAmount] = useState("");
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [lockedAmount, setLockedAmount] = useState<number>(0);
  const [commitmentScore, setCommitmentScore] = useState<number>(100);
  const [activeChallengeCount, setActiveChallengeCount] = useState<number | null>(null);
  const [skrWalletBalance, setSkrWalletBalance] = useState<number | null>(null);
  const [hasConfig, setHasConfig] = useState(Boolean(SKR_MINT_ADDRESS));

  const loadState = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    setHasConfig(Boolean(SKR_MINT_ADDRESS));

    const [skrLock, profile] = await Promise.all([
      fetchSkrLockAccount(publicKey),
      fetchCommitmentProfile(publicKey),
    ]);

    setLockedAmount(skrLock ? skrLock.account.amountLocked.toNumber() / SKR_BASE_UNITS : 0);
    setCommitmentScore(profile ? Number(profile.account.commitmentScore) : 100);
    setActiveChallengeCount(profile ? profile.account.activeChallengeCount : null);

    if (SKR_MINT_ADDRESS) {
      try {
        const skrMint = new PublicKey(SKR_MINT_ADDRESS);
        const skrBalance = await getUsdcBalance(publicKey, skrMint);
        setSkrWalletBalance(skrBalance);
      } catch {
        setSkrWalletBalance(null);
      }
    } else {
      setSkrWalletBalance(null);
    }
  }, [publicKey]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const parsedAmount = useMemo(() => Number(amount), [amount]);
  const skrMint = useMemo(() => {
    try {
      return SKR_MINT_ADDRESS ? new PublicKey(SKR_MINT_ADDRESS) : null;
    } catch {
      return null;
    }
  }, []);

  const onLock = async () => {
    if (!publicKey || !skrMint) {
      Alert.alert("SKR Not Configured", "Set EXPO_PUBLIC_SKR_MINT before using SKR staking.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Enter a valid SKR amount to lock.");
      return;
    }

    setIsLocking(true);
    try {
      const signature = await lockSkr(publicKey, skrMint, parsedAmount);
      Alert.alert("SKR Locked", `Transaction confirmed: ${signature.slice(0, 8)}...`);
      setAmount("");
      await loadState();
    } catch (error: any) {
      Alert.alert("Lock Failed", error?.message || "Could not lock SKR.");
    } finally {
      setIsLocking(false);
    }
  };

  const onUnlock = async () => {
    if (!publicKey || !skrMint) {
      Alert.alert("SKR Not Configured", "Set EXPO_PUBLIC_SKR_MINT before using SKR staking.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Enter a valid SKR amount to unlock.");
      return;
    }

    setIsUnlocking(true);
    try {
      const signature = await unlockSkr(publicKey, skrMint, parsedAmount);
      Alert.alert("SKR Unlocked", `Transaction confirmed: ${signature.slice(0, 8)}...`);
      setAmount("");
      await loadState();
    } catch (error: any) {
      Alert.alert("Unlock Failed", error?.message || "Could not unlock SKR.");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Stake SKR</Text>
          <Text style={styles.body}>
            Lock SKR before joining a challenge to activate a commitment boost. It improves how
            your Commitment Score moves, without changing challenge payouts.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why stake SKR?</Text>
          <BenefitPoint text="Adds a reputation layer beyond just one win or one loss." />
          <BenefitPoint text="Rewards users who commit more seriously to the Pact ecosystem." />
          <BenefitPoint text="Gives SKR utility through commitment scoring, not payout manipulation." />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How boost works</Text>
          <BenefitPoint text="Boost can become active when your locked SKR reaches the required threshold for a challenge." />
          <BenefitPoint text="With boost active, wins improve your Commitment Score more and failures hurt it less." />
          <BenefitPoint text="Boost only affects reputation scoring. It does not change prize money, fees, or settlement math." />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Simple scoring view</Text>
          <InfoRow label="Normal win / fail" value="+10 / -10" />
          <InfoRow label="Boosted win / fail" value="+15 / -5" />
          <Text style={styles.caption}>
            Auto-fail and disputed-fail penalties are also softened by boost. Commitment Score stays
            capped between 0 and 100.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What it does not do</Text>
          <BenefitPoint text="It does not increase your prize." />
          <BenefitPoint text="It does not protect your stake." />
          <BenefitPoint text="It does not change the challenge outcome." />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SKR Status</Text>
          <InfoRow label="Locked SKR" value={`${formatUsdc(lockedAmount)} SKR`} />
          <InfoRow
            label="Wallet SKR"
            value={skrWalletBalance !== null ? `${formatUsdc(skrWalletBalance)} SKR` : "Unavailable"}
          />
          <InfoRow label="Commitment Score" value={String(commitmentScore)} />
          <InfoRow
            label="Active Challenges"
            value={activeChallengeCount !== null ? String(activeChallengeCount) : "-"}
          />
        </View>

        {!hasConfig ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>SKR mint not configured</Text>
            <Text style={styles.warningText}>
              Add `EXPO_PUBLIC_SKR_MINT` to your `.env` first. Without the mint address, the app
              cannot derive your SKR token account for lock and unlock.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lock or Unlock</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount in SKR"
            placeholderTextColor="#6A7F9E"
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.actionRow}>
            <PactButton
              label="Lock SKR"
              onPress={() => void onLock()}
              loading={isLocking}
              style={styles.flexButton}
            />
            <PactButton
              label="Unlock SKR"
              variant="secondary"
              onPress={() => void onUnlock()}
              loading={isUnlocking}
              style={styles.flexButton}
            />
          </View>
          <Text style={styles.caption}>
            Unlock can fail while you still participate in active challenges. That rule is enforced on-chain.
          </Text>
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

function BenefitPoint({ text }: { text: string }) {
  return (
    <View style={styles.pointRow}>
      <View style={styles.pointDot} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  body: {
    color: "#AFC0DB",
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 16,
    fontWeight: "800",
  },
  warningText: {
    color: "#FFC7CF",
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    marginTop: 6,
    flexShrink: 0,
  },
  pointText: {
    flex: 1,
    color: colors.textSoft,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    color: colors.textSoft,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
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
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  caption: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },
});
