import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

type AmbientBackgroundProps = {
  variant?: "blue" | "emerald";
};

export default function AmbientBackground({ variant = "blue" }: AmbientBackgroundProps) {
  const top = variant === "blue" ? `${colors.primary}33` : `${colors.primaryStrong}22`;
  const bottom = variant === "blue" ? `${colors.success}22` : "#05966933";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.orbTop, { backgroundColor: top }]} />
      <View style={[styles.orbMiddle, { backgroundColor: `${colors.primaryStrong}1C` }]} />
      <View style={[styles.orbBottom, { backgroundColor: bottom }]} />
      <View style={styles.noise} />
    </View>
  );
}

const styles = StyleSheet.create({
  orbTop: {
    position: "absolute",
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  orbMiddle: {
    position: "absolute",
    top: "34%",
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  orbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  noise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${colors.bg}22`,
  },
});
