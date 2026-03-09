import React, { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AmbientBackground from "../components/ui/AmbientBackground";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/AppNavigator";
import {
  fetchAllParticipants,
  fetchChallengesForWallet,
  fetchParticipantState,
} from "../services/anchor";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";

type HistoryResult = "Won" | "Lost";
type HistoryFilter = "All" | "Won" | "Lost";
type RootNav = NativeStackNavigationProp<RootStackParamList>;

type HistoryItem = {
  challengeId: string;
  title: string;
  result: HistoryResult;
  payout: number;
  stake: number;
  participants: number;
  date: string;
  duration: string;
  winners: string;
  mySubmission: "Success" | "Fail";
  challengeType: "final_only" | "daily_checkin";
  settlementNote: string;
};

const PLATFORM_FEE_BPS = 500;

export default function HistoryScreen() {
  const navigation = useNavigation<RootNav>();
  const publicKey = useAppStore((state) => state.publicKey);
  const [filter, setFilter] = useState<HistoryFilter>("All");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!publicKey) {
        if (active) {
          setItems([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const walletChallenges = await fetchChallengesForWallet(publicKey);
        const settledChallenges = walletChallenges.filter((item) => {
          const status = Object.keys(item.account.status ?? {})[0];
          return status === "settled";
        });

        const history = await Promise.all(
          settledChallenges.map(async (item) => {
            const participantState = await fetchParticipantState(item.publicKey, publicKey);
            if (!participantState?.deposited) {
              return null;
            }

            const participants = await fetchAllParticipants(item.publicKey);
            return buildHistoryItem(
              item.account.challengeId,
              item.account.title,
              item.account.stakeAmount.toNumber() / 1_000_000,
              item.account.durationSeconds.toNumber(),
              item.account.depositCount,
              item.account.submissionDeadline.toNumber() || item.account.deadline.toNumber(),
              participantState,
              participants
            );
          })
        );

        if (!active) {
          return;
        }

        const nextItems = history
          .filter((item): item is HistoryItem => Boolean(item))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setItems(nextItems);
      } catch {
        if (active) {
          setItems([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [publicKey]);

  const filteredItems = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((item) => item.result === filter);
  }, [filter, items]);

  const summary = useMemo(() => {
    const earned = items.filter((item) => item.payout > 0).reduce((acc, item) => acc + item.payout, 0);
    const lost = items.filter((item) => item.payout < 0).reduce((acc, item) => acc + Math.abs(item.payout), 0);
    const net = earned - lost;
    return { earned, lost, net };
  }, [items]);

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>History</Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="Earned" value={summary.earned} tone="good" />
          <SummaryCard label="Lost" value={summary.lost} tone="danger" minus />
          <SummaryCard label="Net P&L" value={summary.net} tone={summary.net >= 0 ? "good" : "danger"} />
        </View>

        <View style={styles.filterRow}>
          {(["All", "Won", "Lost"] as HistoryFilter[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filterChip,
                filter === value && styles.filterChipActive,
                value === "Won" && filter === value && { borderColor: colors.success },
                value === "Lost" && filter === value && { borderColor: colors.danger },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === value && styles.filterTextActive,
                  value === "Won" && filter === value && { color: colors.success },
                  value === "Lost" && filter === value && { color: colors.danger },
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        {filteredItems.map((item) => (
          <Pressable
            key={item.challengeId}
            onPress={() =>
              navigation.navigate("HistoryDetail", {
                challengeId: item.challengeId,
                title: item.title,
                result: item.result,
                payout: item.payout,
                stake: item.stake,
                participants: item.participants,
                date: item.date,
                duration: item.duration,
                winners: item.winners,
                mySubmission: item.mySubmission,
                challengeType: item.challengeType,
                settlementNote: item.settlementNote,
              })
            }
            style={({ pressed }) => [styles.itemCard, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.itemBadge, item.payout > 0 ? styles.itemBadgeUp : styles.itemBadgeDown]}>
              <Text style={[styles.itemBadgeIcon, item.payout > 0 ? { color: colors.success } : { color: colors.danger }]}>
                {item.payout > 0 ? "↗" : "↘"}
              </Text>
            </View>

            <View style={styles.itemCenter}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {item.date} · {item.participants} participants
              </Text>
            </View>

            <View style={styles.itemRight}>
              <Text style={[styles.itemAmount, { color: item.payout > 0 ? colors.success : colors.danger }]}>
                {item.payout > 0 ? "+" : "-"}${formatUsdc(Math.abs(item.payout))}
              </Text>
              <Text style={styles.itemDuration}>{item.duration}</Text>
            </View>
          </Pressable>
        ))}

        {!isLoading && filteredItems.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No settled challenge history yet.</Text>
          </View>
        )}

        {isLoading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading history...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildHistoryItem(
  challengeId: string,
  title: string,
  stake: number,
  durationSeconds: number,
  participantCount: number,
  settledAtUnix: number,
  myState: Awaited<ReturnType<typeof fetchParticipantState>>,
  participants: Awaited<ReturnType<typeof fetchAllParticipants>>
): HistoryItem {
  const winners = participants.filter((item) => item.account.isWinner);
  const deposited = participants.filter((item) => item.account.deposited);
  const losers = deposited.filter((item) => !item.account.isWinner);
  const fee = losers.length * stake * (PLATFORM_FEE_BPS / 10_000);
  const penaltyPool = losers.length * stake;
  const distributable = Math.max(0, penaltyPool - fee);
  const everyoneWon = winners.length > 0 && winners.length === deposited.length;
  const everyoneFailed = deposited.length > 0 && winners.length === 0;

  let payout = -stake;
  let settlementNote = "Your stake was forfeited when this challenge settled.";

  if (everyoneWon) {
    payout = 0;
    settlementNote = "Everyone qualified successfully, so all participants received their full stake back.";
  } else if (everyoneFailed) {
    const refundMinusFee = stake - fee / Math.max(1, deposited.length);
    payout = refundMinusFee - stake;
    settlementNote =
      "No participant qualified. The challenge refunded stake across participants after the platform fee was applied.";
  } else if (myState?.isWinner) {
    payout = distributable / Math.max(1, winners.length);
    settlementNote =
      "You qualified for settlement, so you received your stake back plus a share of the forfeited pool.";
  }

  const submissionKey = Object.keys(myState?.submissionResult ?? { fail: {} })[0];
  const mySubmission = submissionKey === "success" ? "Success" : "Fail";

  return {
    challengeId,
    title,
    result: myState?.isWinner ? "Won" : "Lost",
    payout,
    stake,
    participants: participantCount,
    date: formatHistoryDate(settledAtUnix),
    duration: `${Math.max(1, Math.round(durationSeconds / 86400))} days`,
    winners: `${winners.length} / ${deposited.length || participantCount}`,
    mySubmission,
    challengeType: "final_only",
    settlementNote,
  };
}

function formatHistoryDate(unix: number) {
  if (!unix) {
    return "Unknown date";
  }
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryCard({
  label,
  value,
  tone,
  minus = false,
}: {
  label: string;
  value: number;
  tone: "good" | "danger";
  minus?: boolean;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: tone === "good" ? colors.success : colors.danger }]}>
        {minus ? "-" : value < 0 ? "-" : "+"}${formatUsdc(Math.abs(value))}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  heading: {
    marginTop: 6,
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 4,
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}1A`,
  },
  filterText: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.primary,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBadgeUp: {
    backgroundColor: `${colors.success}22`,
  },
  itemBadgeDown: {
    backgroundColor: `${colors.danger}22`,
  },
  itemBadgeIcon: {
    fontSize: 18,
    fontWeight: "800",
  },
  itemCenter: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  itemMeta: {
    marginTop: 2,
    color: colors.textSoft,
    fontSize: 13,
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemAmount: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  itemDuration: {
    color: colors.textSoft,
    fontSize: 13,
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 13,
  },
});
