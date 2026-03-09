import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AmbientBackground from "../components/ui/AmbientBackground";
import ChallengeCard, { ChallengeSummary } from "../components/challenges/ChallengeCard";
import PactButton from "../components/ui/PactButton";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/AppNavigator";
import { fetchChallengesForWallet } from "../services/anchor";
import { useAppStore } from "../store/useAppStore";
import { formatUsdc } from "../utils/format";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export default function ChallengesScreen() {
  const navigation = useNavigation<RootNav>();
  const publicKey = useAppStore((state) => state.publicKey);
  const [items, setItems] = useState<ChallengeSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "created" | "joined">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadChallenges = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      if (!publicKey) {
        setItems([]);
        return;
      }

      const all = await fetchChallengesForWallet(publicKey);
      const mapped = all
        .sort((a, b) => b.account.createdAt.cmp(a.account.createdAt))
        .map((item) => {
          const statusKey = Object.keys(item.account.status)[0];
          const relation: ChallengeSummary["relation"] =
            item.account.creator.toBase58() === publicKey.toBase58() ? "Created" : "Joined";
          return {
            id: item.account.challengeId,
            title: item.account.title,
            pool: `${formatUsdc(
              item.account.stakeAmount.muln(item.account.depositCount).toNumber() / 1_000_000
            )} USDC`,
            participants: `${item.account.participantCount} / ${item.account.maxParticipants}`,
            timeLabel: getTimeLabel(statusKey),
            timeRemaining: getTimeValue(item.account, statusKey),
            status: mapStatus(statusKey),
            relation,
          };
        });
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const filteredItems = useMemo(() => {
    if (filter === "created") {
      return items.filter((item) => item.relation === "Created");
    }
    if (filter === "joined") {
      return items.filter((item) => item.relation === "Joined");
    }
    return items;
  }, [filter, items]);

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="blue" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={isRefreshing}
            onRefresh={() => void loadChallenges(true)}
          />
        }
      >
        <Text style={styles.overline}>CHALLENGES</Text>
        <Text style={styles.heading}>Choose Your Pact</Text>
        <Text style={styles.subheading}>Join a pact or create one with your group.</Text>

        <View style={styles.ctaRow}>
          <PactButton
            label="Create"
            onPress={() => navigation.navigate("CreateChallenge")}
            style={styles.ctaButton}
          />
          <PactButton
            label="Join"
            variant="secondary"
            onPress={() => navigation.navigate("JoinChallenge")}
            style={styles.ctaButton}
          />
        </View>

        <View style={styles.filterRow}>
          <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip
            label="Created"
            active={filter === "created"}
            onPress={() => setFilter("created")}
          />
          <FilterChip
            label="Joined"
            active={filter === "joined"}
            onPress={() => setFilter("joined")}
          />
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Loading challenges...</Text>
            <Text style={styles.stateText}>Fetching the latest pacts from chain.</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No matching challenges yet</Text>
            <Text style={styles.stateText}>
              {filter === "all"
                ? "This tab only shows challenges you created or joined with the connected wallet."
                : filter === "created"
                  ? "No challenges created by this wallet yet."
                  : "This wallet has not joined any other challenges yet."}
            </Text>
          </View>
        ) : (
          filteredItems.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onPress={() =>
                navigation.navigate("ChallengeDetail", {
                  challengeId: challenge.id,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function mapStatus(status: string): ChallengeSummary["status"] {
  switch (status) {
    case "submission":
      return "Submission";
    case "settled":
    case "cancelled":
      return "Completed";
    case "allFailVoting":
      return "Review";
    default:
      return "Active";
  }
}

function formatTimeLeft(targetUnix: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = targetUnix - now;

  if (diff <= 0) {
    return "Ended";
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getTimeLabel(status: string) {
  if (status === "open") {
    return "Start";
  }
  if (status === "submission") {
    return "Submission";
  }
  if (status === "settled" || status === "cancelled") {
    return "State";
  }
  return "Time Left";
}

function getTimeValue(
  account: Awaited<ReturnType<typeof fetchChallengesForWallet>>[number]["account"],
  status: string
) {
  if (status === "open") {
    return "Not started";
  }
  if (status === "settled") {
    return "Completed";
  }
  if (status === "cancelled") {
    return "Cancelled";
  }

  const target =
    status === "submission"
      ? account.submissionDeadline.toNumber()
      : account.deadline.toNumber();

  if (target <= 0) {
    return status === "submission" ? "Awaiting submit" : "Not started";
  }

  const formatted = formatTimeLeft(target);
  if (formatted === "Ended") {
    return status === "submission" ? "Closed" : "Ended";
  }
  return formatted;
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
  overline: {
    marginTop: 6,
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subheading: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: -2,
    marginBottom: 8,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 2,
  },
  ctaButton: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#31445E",
    backgroundColor: "#18243B",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: "#1B3B69",
  },
  filterChipText: {
    color: "#BFD1EC",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  filterChipTextActive: {
    color: "#EAF2FF",
  },
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 4,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  stateText: {
    color: colors.textSoft,
    marginTop: 6,
    lineHeight: 20,
  },
});
