import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import CreateChallengeScreen from "../screens/CreateChallengeScreen";
import ChallengeDetailScreen from "../screens/ChallengeDetailScreen";
import ProfileScreen from "../screens/ProfileScreen";
import LeaderboardScreen from "../screens/LeaderboardScreen";

export type RootStackParamList = {
  HomeMain: undefined;
  CreateChallenge: undefined;
  ChallengeDetail: { challengeId: string };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: "#111127" },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" as const },
};

const pactTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#7c3aed",
    background: "#0a0a0a",
    card: "#111127",
    text: "#ffffff",
    border: "#2d2d44",
    notification: "#7c3aed",
  },
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: "Pact" }}
      />
      <Stack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{ title: "Create Challenge" }}
      />
      <Stack.Screen
        name="ChallengeDetail"
        component={ChallengeDetailScreen}
        options={{ title: "Challenge" }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={pactTheme}>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: "#111127",
            borderTopColor: "#2d2d44",
          },
          tabBarActiveTintColor: "#7c3aed",
          tabBarInactiveTintColor: "#6b7280",
        }}
      >
        <Tab.Screen
          name="Challenges"
          component={HomeStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={screenOptions}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={screenOptions}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
