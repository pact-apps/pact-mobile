import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, useColorScheme } from "react-native";
import { colors } from "../theme/colors";

import HomeScreen from "../screens/HomeScreen";
import CreateChallengeScreen from "../screens/CreateChallengeScreen";
import ChallengeDetailScreen from "../screens/ChallengeDetailScreen";
import ConnectWalletScreen from "../screens/ConnectWalletScreen";
import JoinChallengeScreen from "../screens/JoinChallengeScreen";
import SubmissionScreen from "../screens/SubmissionScreen";
import ReviewDisputeScreen from "../screens/ReviewDisputeScreen";
import SettlementScreen from "../screens/SettlementScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ChallengesScreen from "../screens/ChallengesScreen";
import HistoryDetailScreen from "../screens/HistoryDetailScreen";
import StakeSkrScreen from "../screens/StakeSkrScreen";

export type RootStackParamList = {
  ConnectWallet: undefined;
  MainTabs: undefined;
  CreateChallenge: undefined;
  JoinChallenge: { challengeId?: string } | undefined;
  ChallengeDetail: {
    challengeId: string;
    title?: string;
    description?: string;
    rules?: string;
    challengeType?: "final_only" | "daily_checkin";
    stake?: string;
    duration?: string;
    maxParticipants?: string;
  };
  Submission: { challengeId: string };
  ReviewDispute: { challengeId: string };
  Settlement: { challengeId: string };
  StakeSkr: undefined;
  HistoryDetail: {
    challengeId: string;
    title: string;
    result: "Won" | "Lost";
    payout: number;
    stake: number;
    participants: number;
    date: string;
    duration: string;
    winners: string;
    mySubmission: "Success" | "Fail";
    challengeType: "final_only" | "daily_checkin";
    settlementNote: string;
    proofSummary?: string;
    filesSubmitted?: number;
    checkinsCompleted?: number;
    expectedCheckins?: number;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Challenges: undefined;
  History: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" as const },
};

const pactTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

const pactLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: "#F4F6FB",
    card: "#FFFFFF",
    text: "#0F172A",
    border: "#E5EAF5",
    notification: colors.primary,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
        tabBarIcon: ({ focused, color, size }) => {
          let icon = "•";

          if (route.name === "Home") {
            icon = "⌂";
          } else if (route.name === "Challenges") {
            icon = "◈";
          } else if (route.name === "History") {
            icon = "◷";
          } else if (route.name === "Profile") {
            icon = "◎";
          }

          return (
            <Text style={{ color, fontSize: focused ? size + 1 : size, fontWeight: "700" }}>
              {icon}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Challenges" component={ChallengesScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === "dark" ? pactTheme : pactLightTheme}>
      <Stack.Navigator initialRouteName="ConnectWallet" screenOptions={screenOptions}>
        <Stack.Screen
          name="ConnectWallet"
          component={ConnectWalletScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateChallenge"
          component={CreateChallengeScreen}
          options={{ title: "Create Challenge" }}
        />
        <Stack.Screen
          name="JoinChallenge"
          component={JoinChallengeScreen}
          options={{ title: "Join Challenge" }}
        />
        <Stack.Screen
          name="ChallengeDetail"
          component={ChallengeDetailScreen}
          options={{ title: "Challenge Detail" }}
        />
        <Stack.Screen
          name="Submission"
          component={SubmissionScreen}
          options={{ title: "Submission" }}
        />
        <Stack.Screen
          name="ReviewDispute"
          component={ReviewDisputeScreen}
          options={{ title: "Review & Dispute" }}
        />
        <Stack.Screen
          name="Settlement"
          component={SettlementScreen}
          options={{ title: "Settlement" }}
        />
        <Stack.Screen
          name="StakeSkr"
          component={StakeSkrScreen}
          options={{ title: "Stake SKR" }}
        />
        <Stack.Screen
          name="HistoryDetail"
          component={HistoryDetailScreen}
          options={{ title: "History Detail" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
