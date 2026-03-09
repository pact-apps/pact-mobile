import React from "react";
import { StyleSheet, Text, View } from "react-native";

type ParticipantStatusCardProps = {
  username: string;
  submitted: boolean;
  result: "Success" | "Fail" | "Pending";
};

const resultColor = {
  Success: "#18B67A",
  Fail: "#E5484D",
  Pending: "#8FA0B8",
};

export default function ParticipantStatusCard({
  username,
  submitted,
  result,
}: ParticipantStatusCardProps) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.meta}>{submitted ? "Submission sent" : "Awaiting proof"}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${resultColor[result]}22` }]}>
        <Text style={[styles.statusText, { color: resultColor[result] }]}>{result}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#253042",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#335CFF",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  username: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: "#8FA0B8",
    marginTop: 2,
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
