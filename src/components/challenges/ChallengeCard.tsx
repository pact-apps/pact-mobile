import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

export type ChallengeSummary = {
  id: string;
  title: string;
  pool: string;
  participants: string;
  timeLabel: string;
  timeRemaining: string;
  status: "Active" | "Submission" | "Review" | "Completed";
  relation?: "Created" | "Joined";
};

type ChallengeCardProps = {
  challenge: ChallengeSummary;
  onPress?: () => void;
};

const statusColor: Record<ChallengeSummary["status"], string> = {
  Active: colors.primary,
  Submission: colors.warning,
  Review: "#FB923C",
  Completed: colors.success,
};

export default function ChallengeCard({ challenge, onPress }: ChallengeCardProps) {
  const accent = statusColor[challenge.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${accent}66` },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: `${accent}44` }]} />
      <View style={styles.headlineRow}>
        <View style={[styles.statusDot, { backgroundColor: accent }]} />
        <Text numberOfLines={1} style={styles.title}>
          {challenge.title}
        </Text>
        {challenge.relation ? (
          <View style={styles.relationBadge}>
            <Text style={styles.relationText}>{challenge.relation}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.badge,
            {
              borderColor: accent,
              backgroundColor: `${accent}20`,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: accent }]}>{challenge.status}</Text>
        </View>
      </View>
      <View style={styles.midRow}>
        <Stat label="Current Pool" value={challenge.pool} />
        <Stat label="Group" value={challenge.participants} />
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>{challenge.timeLabel}</Text>
        <Text style={styles.footerValue}>{challenge.timeRemaining}</Text>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: "#101826",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  topBar: {
    height: 5,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginHorizontal: -16,
    marginBottom: 12,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  relationBadge: {
    borderWidth: 1,
    borderColor: "#41597E",
    backgroundColor: "#18243B",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  relationText: {
    color: "#BFD1EC",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  midRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  statBlock: {
    flex: 1,
    backgroundColor: "#172135",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#293652",
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  statLabel: {
    color: "#91A4C5",
    fontSize: 10,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  statValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  footerRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27344C",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: {
    color: "#90A0BD",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  footerValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
});
