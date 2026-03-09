import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import PactButton from "../components/ui/PactButton";
import AmbientBackground from "../components/ui/AmbientBackground";
import { colors } from "../theme/colors";
import { useAppStore } from "../store/useAppStore";
import { authorizeWallet } from "../services/wallet";
import { getSolBalance, getUsdcBalance } from "../services/solana";
import { USDC_MINT } from "../utils/constants";
import { authenticateWithBackend } from "../services/backendAuth";
import HowPactWorksModal from "../components/ui/HowPactWorksModal";

type Props = NativeStackScreenProps<RootStackParamList, "ConnectWallet">;

const wallets = ["Phantom", "Solflare", "Backpack"];
const SEEN_PACT_INTRO_KEY = "pact_seen_intro_v1";

export default function ConnectWalletScreen({ navigation }: Props) {
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { setWallet, setBalances } = useAppStore();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const result = await authorizeWallet();
      setWallet(result.publicKey, result.authToken);
      const seenIntro = await AsyncStorage.getItem(SEEN_PACT_INTRO_KEY);
      setWalletModalVisible(false);

      void (async () => {
        try {
          const sol = await getSolBalance(result.publicKey);
          const usdc = await getUsdcBalance(result.publicKey, USDC_MINT);
          setBalances(sol, usdc);
        } catch {
          // Non-fatal if balance fetch fails
        }
      })();

      void authenticateWithBackend(result.publicKey.toBase58()).catch(() => {
        // Backend auth optional for initial connect
      });

      if (!seenIntro) {
        setShowHowItWorks(true);
      } else {
        navigation.replace("MainTabs");
      }
    } catch (error: any) {
      Alert.alert("Connection Failed", error?.message || "Could not connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground variant="emerald" />
      <View style={styles.mainBlock}>
        <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <View style={styles.brandBlock}>
            <View style={styles.logoWrap}>
              <Image source={require("../../assets/pactlogo.png")} style={styles.logoImage} />
            </View>
            <Text style={styles.brand}>PACT</Text>
            <Text style={styles.brandSub}>Stake your discipline</Text>
          </View>

          <Text style={styles.headline}>Commit. Stake. Succeed.</Text>
          <Text style={styles.body}>
            PACT is your commitment contract for real life. Put USDC on your goals.
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <PactButton label="Connect Wallet" onPress={() => setWalletModalVisible(true)} />
        </View>
      </View>

      <Modal transparent animationType="slide" visible={walletModalVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Choose Wallet</Text>
            {wallets.map((walletName) => (
              <Pressable
                key={walletName}
                style={({ pressed }) => [styles.walletItem, pressed && { opacity: 0.88 }]}
                onPress={connectWallet}
              >
                <Text style={styles.walletItemText}>{walletName}</Text>
                <Text style={styles.walletItemSub}>Secure Solana signing</Text>
              </Pressable>
            ))}
            <PactButton
              label="Cancel"
              variant="secondary"
              onPress={() => setWalletModalVisible(false)}
              loading={isConnecting}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
      </Modal>

      <HowPactWorksModal
        visible={showHowItWorks}
        ctaLabel="Start using Pact"
        onClose={async () => {
          await AsyncStorage.setItem(SEEN_PACT_INTRO_KEY, "true");
          setShowHowItWorks(false);
          navigation.replace("MainTabs");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  content: {
    justifyContent: "center",
  },
  mainBlock: {
    flex: 1,
    justifyContent: "center",
  },
  brandBlock: {
    alignItems: "center",
    gap: 0,
    marginBottom: 12,
    marginTop: -28,
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -20,
  },
  logoImage: {
    width: 128,
    height: 128,
    resizeMode: "contain",
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  brandSub: {
    color: colors.textSoft,
    marginTop: 2,
    marginBottom: 10,
    fontSize: 15,
    textAlign: "center",
  },
  headline: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    marginBottom: 10,
  },
  body: {
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    gap: 8,
    marginTop: 26,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  walletItem: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  walletItemText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  walletItemSub: {
    color: colors.textSoft,
    marginTop: 2,
    fontSize: 12,
  },
});
