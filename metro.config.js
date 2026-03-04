const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add "react-native" as highest priority condition for package exports.
// This fixes the MWA SDK loading index.browser.js (needs crypto.subtle)
// instead of index.native.js (uses native TurboModule).
// Preserve existing defaults so other packages (e.g. @solana/web3.js) still work.
const existing = config.resolver.unstable_conditionNames || [];
config.resolver.unstable_conditionNames = [
  "react-native",
  ...existing.filter((c) => c !== "react-native"),
];

module.exports = config;
