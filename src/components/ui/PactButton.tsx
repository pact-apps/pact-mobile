import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";

type PactButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "success" | "danger" | "secondary";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const buttonColors = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  secondary: colors.surface3,
};

const borderColors = {
  primary: colors.primarySoft,
  success: colors.successSoft,
  danger: colors.dangerSoft,
  secondary: colors.borderSoft,
};

export default function PactButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  style,
}: PactButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: buttonColors[variant], borderColor: borderColors[variant] },
        pressed && { opacity: 0.85 },
        loading && { opacity: 0.65 },
        style,
      ]}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
