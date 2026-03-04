# Pact Mobile — Setup & Run Guide

Pact is a mobile-first accountability app built on Solana. Groups escrow USDC into challenges, complete them to earn rewards, or lose their stake.

**Tech Stack:** React Native (Expo SDK 55) + Solana Web3.js + Anchor + MWA (Mobile Wallet Adapter)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | v18+ | https://nodejs.org |
| **npm** | v9+ | Comes with Node.js |
| **Git** | Any | https://git-scm.com |

### For Android (full MWA support):
| Tool | Install |
|------|---------|
| **Android Studio** | https://developer.android.com/studio |
| **Android SDK** | Via Android Studio SDK Manager (API 33+) |
| **JDK 17** | Via Android Studio or https://adoptium.net |
| **Phantom Wallet** | Google Play Store (on physical device) |

### For Web (quick preview, no wallet features):
No additional tools needed — runs in browser.

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd pact-mobile
npm install
```

---

## 2. Environment Setup

### Set ANDROID_HOME (required for Android builds)

**Windows (PowerShell):**
```powershell
# Check if already set
echo $env:ANDROID_HOME

# If not set, add to your system environment variables:
# Default path: C:\Users\<YourUser>\AppData\Local\Android\Sdk
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

**macOS/Linux (bash):**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Verify Android setup
```bash
npx react-native doctor
```

All Android-related checks should be green. iOS can be ignored (Android-only app).

---

## 3. Backend Connection

The app connects to the Pact backend API. You have two options:

### Option A: Use shared ngrok URL (easiest)

Ask the team for the current ngrok URL, then edit `src/utils/constants.js`:

```js
export const API_BASE_URL = "https://your-ngrok-url.ngrok-free.dev";
```

### Option B: Run backend locally

If running the Rust backend on your machine (or WSL):

```bash
# In the pact-backend directory
cargo run
# Server starts on http://localhost:8080
```

Then set `API_BASE_URL` based on how you're running the app:

| Running on | API_BASE_URL |
|---|---|
| Android Emulator | `http://10.0.2.2:8080` |
| Physical Android device | Use ngrok: `ngrok http 8080` → use the https URL |
| Web browser | `http://localhost:8080` |

---

## 4. Run the App

### Option A: Android Device (Recommended — full MWA support)

This is the **production-intended** experience with real wallet signing via Phantom/Solflare.

```bash
# 1. Connect Android phone via USB (enable Developer Options + USB Debugging)
# 2. Verify device is connected:
adb devices

# 3. Build and run:
npx expo run:android
```

**First-time build** takes 5–10 minutes (downloads Gradle, builds native code). Subsequent runs are faster.

**On-device setup:**
1. Install **Phantom Wallet** from Google Play Store
2. Open Phantom → Settings → Developer Settings → Enable **Devnet**
3. Tap "Airdrop SOL" in Phantom to get devnet SOL for gas fees

### Option B: Android Emulator

```bash
# 1. Open Android Studio → Virtual Device Manager → Create device
#    Recommended: Pixel 7, API 34 (Android 14), x86_64 image

# 2. Start the emulator from Android Studio

# 3. Install Fake Wallet for MWA testing on emulator:
#    Download from: https://github.com/niclasdoerr/solana-mobile-fake-wallet/releases
#    Then: adb install fake-wallet.apk

# 4. Build and run:
npx expo run:android
```

### Option C: Web Browser (Quick Preview — No Wallet)

For quick UI preview without Solana wallet features. **MWA does not work on web** — wallet connect, transactions, and signing will not function. Useful for checking layouts, navigation, and API-dependent screens (leaderboard, etc.).

```bash
npx expo start --web
```

This opens the app at `http://localhost:8081` in your browser.

> **Note:** Some features may show errors on web since Solana mobile libraries are Android-native. The wallet connect button will not work. You can still browse the UI structure, navigation tabs, and any screens that don't require a connected wallet.

---

## 5. Testing the Full Flow (Android only)

### Step-by-step:

```
1. CONNECT WALLET
   Home screen → "Connect Wallet"
   → Phantom opens → Approve connection
   → Your wallet address appears on Home screen

2. GET DEVNET USDC
   You need devnet USDC to create/join challenges.
   → Mint devnet USDC at: https://spl-token-ui.com
   → Or ask team for devnet USDC faucet script

3. CREATE A CHALLENGE
   Home → "+ New Challenge"
   → Fill in: Title, Stake amount (in USDC), Duration, Max participants
   → Submit → Approve transaction in Phantom
   → Challenge appears in the list

4. JOIN A CHALLENGE
   → Tap a challenge → "Join Challenge"
   → Approve transaction (stakes your USDC)

5. START CHALLENGE (creator only, needs ≥2 participants)
   → Tap your challenge → "Start Challenge"
   → Approve transaction

6. SUBMIT PROOF
   → "Submit — I Succeeded"
   → Pick a photo from gallery
   → Photo uploads to backend → SHA256 hash sent on-chain
   → Approve transaction

7. SETTLE
   → After submission window ends → "Settle Challenge"
   → Winners receive pool rewards
```

### Testing with multiple wallets:
To test the full flow (join from different wallets), you need multiple Phantom accounts or test on multiple devices.

---

## 6. Development Commands

```bash
# Start Metro bundler only (if already built native code)
npx expo start

# Build + run on Android
npx expo run:android

# Web preview
npx expo start --web

# Type checking
npx tsc --noEmit

# Clear Metro cache (if you get stale bundle errors)
npx expo start --clear
```

---

## 7. Project Structure

```
pact-mobile/
├── App.tsx                    # Root component (QueryClient + SafeArea + Navigator)
├── polyfills.ts               # Buffer, URL, crypto polyfills for Solana
├── index.ts                   # Entry point
├── app.json                   # Expo config (Android-only)
├── idl/
│   └── pact_escrow.json       # Anchor IDL for on-chain program
└── src/
    ├── navigation/
    │   └── AppNavigator.tsx    # Bottom tabs (Challenges, Leaderboard, Profile)
    ├── screens/
    │   ├── HomeScreen.tsx      # Challenge list + wallet connect
    │   ├── CreateChallengeScreen.tsx
    │   ├── ChallengeDetailScreen.tsx  # Join/Start/Submit/Settle/Dispute
    │   ├── LeaderboardScreen.tsx
    │   └── ProfileScreen.tsx   # Wallet info, balances, commitment score
    ├── services/
    │   ├── wallet.ts           # MWA (authorize, sign, send)
    │   ├── transactions.ts     # On-chain tx builders (create, join, start, submit, finalize, dispute, vote)
    │   ├── anchor.ts           # Anchor program + account fetchers
    │   ├── solana.ts           # RPC connection, balance queries
    │   ├── pactApi.ts          # Backend REST API client
    │   ├── apiInstance.ts      # Singleton API instance
    │   └── backendAuth.ts      # Wallet signature → JWT auth flow
    ├── hooks/
    │   └── useChallenge.ts     # React Query hooks for on-chain data
    ├── store/
    │   └── useAppStore.ts      # Zustand global state (wallet, balances)
    └── utils/
        ├── constants.js        # Network, program ID, USDC mint, API URL
        └── explorer.ts         # Solana Explorer link helpers
```

---

## 8. Troubleshooting

| Problem | Solution |
|---|---|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, run `npm install` again |
| `ANDROID_HOME` not set | See Step 2 above |
| `adb devices` shows nothing | Enable USB Debugging on phone, trust the computer |
| Build fails "SDK not found" | Open Android Studio → SDK Manager → Install API 33+ |
| Metro: "Unable to resolve module" | Run `npx expo start --clear` |
| MWA: "No wallet found" | Install Phantom (device) or Fake Wallet (emulator) |
| Backend connection refused | Check ngrok is running / `API_BASE_URL` is correct |
| "Missing Authorization header" | Normal — means backend is reachable, auth happens automatically in-app |
| Web: wallet button doesn't work | Expected — MWA is Android-only, web is for UI preview only |
| First build very slow | Normal — Gradle downloads ~500MB on first run |

---

## 9. Key Config Values

All configurable values are in `src/utils/constants.js`:

| Constant | Value | Description |
|---|---|---|
| `SOLANA_NETWORK` | `devnet` | Solana cluster |
| `PROGRAM_ID` | `6JTfaG...bCs` | Deployed Pact Escrow program |
| `USDC_MINT` | `4zMMC9...DU` | Devnet USDC token mint |
| `API_BASE_URL` | ngrok URL | Backend API endpoint |
| `TREASURY_WALLET` | `HN7cAB...p8` | Fee collection wallet |
