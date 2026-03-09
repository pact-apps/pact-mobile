import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import PactButton from "./PactButton";

type HowPactWorksModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  ctaLabel?: string;
};

export default function HowPactWorksModal({
  visible,
  onClose,
  title = "How PACT Works",
  ctaLabel = "Got it",
}: HowPactWorksModalProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Step n="1" text="Create or join a pact, then stake USDC." />
          <Step n="2" text="Finish your goal and submit proof on time." />
          <Step n="3" text="Participants review the submission." />
          <Step n="4" text="Win: share reward. Fail: lose stake." />
          <Text style={styles.note}>
            Your stake stays locked until settlement. Always verify challenge terms.
          </Text>
          <PactButton label={ctaLabel} onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepNo}>{n}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
  },
  stepNo: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    width: 16,
  },
  stepText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  note: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
