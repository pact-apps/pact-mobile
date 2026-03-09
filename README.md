# Pact

Pact is a mobile-first accountability app on Solana. Users commit to a goal, lock funds into a challenge, submit proof, and settle outcomes transparently on-chain.

This repository contains the Android mobile client built with Expo React Native. It connects to Solana through Mobile Wallet Adapter, signs transactions with wallets like Phantom, and talks to a backend service for metadata, proof uploads, and leaderboard data.

## Why Pact

Most accountability apps rely on reminders and streaks. Pact adds economic commitment.

Users do not just say they will finish something. They stake value behind that promise:

- Create a challenge with a USDC stake
- Invite others to join
- Submit proof of completion
- Settle the outcome on-chain

The result is a stronger incentive loop for real-world goals such as fitness, study plans, creator sprints, and team commitments.

## What Judges Should Know

- Platform: Android-first mobile app
- Wallet UX: Solana Mobile Wallet Adapter
- Network: Solana devnet
- Asset used for staking: devnet USDC
- Program ID: `CvTggHr71Qm6NC5qjkvCq4txe2UbbZWrKAWGpMVMWw6y`
- App package: `com.pact.mobile`

The app is designed for a real mobile wallet flow, so wallet actions are intended to be tested on Android emulator or Android device, not in the browser.

## Core User Flow

1. Connect a Solana wallet with Mobile Wallet Adapter.
2. Create or join a challenge with a USDC stake.
3. Start the challenge once the group is ready.
4. Submit proof or daily check-ins.
5. Finalize the challenge and distribute funds according to the result.

## Product Highlights

- Real wallet-based commitment flow on mobile
- On-chain challenge actions using Anchor-compatible Solana transactions
- Proof upload and challenge metadata handled off-chain for better UX
- Leaderboard and commitment score for repeat usage
- Multi-endpoint RPC fallback for more resilient transaction sending

## Architecture

The app uses a split architecture:

- Mobile client: Expo React Native app for wallet connection, challenge flow, proof submission, and profile views
- Solana program: challenge escrow and settlement logic
- Backend API: authentication nonce flow, proof storage, challenge metadata, leaderboard, and supporting indexed data

### Mobile responsibilities

- Wallet authorization and signing through Mobile Wallet Adapter
- Solana RPC reads and transaction submission
- Proof image selection and upload
- Backend JWT authentication through signed wallet messages
- Local state and screen orchestration

### Backend responsibilities

- Nonce generation and signature verification
- Metadata for challenges
- Proof upload and retrieval
- Leaderboard and score data
- Additional helper endpoints for settlement planning and indexed views

## Tech Stack

- Expo SDK 55
- React Native 0.83
- React 19
- TypeScript
- Solana Web3.js
- Anchor client
- TanStack Query
- Zustand

## Repository Structure

```text
pact-mobile/
|- App.tsx
|- app.json
|- idl/
|  |- pact_escrow.json
|- src/
|  |- components/
|  |- navigation/
|  |- screens/
|  |- services/
|  |- store/
|  |- theme/
|  |- utils/
|- android/
```

Important files:

- `src/screens/ConnectWalletScreen.tsx`: wallet onboarding flow
- `src/services/wallet.ts`: Mobile Wallet Adapter integration
- `src/services/transactions.ts`: challenge transactions
- `src/services/anchor.ts`: Anchor program access and account fetching
- `src/services/pactApi.ts`: backend API client
- `src/services/backendAuth.ts`: wallet signature to JWT flow
- `src/utils/constants.js`: Solana and backend configuration

## Environment

The app reads these environment variables:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
EXPO_PUBLIC_SKR_MINT=...
EXPO_PUBLIC_SOLANA_EXTRA_WRITE_RPCS=https://api.devnet.solana.com
```

Notes:

- `10.0.2.2` is the Android emulator alias to the host machine.
- For a physical Android device, the backend should be exposed through a reachable public URL such as ngrok.

## Running the App

### Prerequisites

- Node.js 20.x
- npm 10.x
- Android Studio
- Android SDK Platform Tools
- Android emulator with Google Play support
- A Solana wallet app such as Phantom installed on the emulator/device

### Install dependencies

```bash
npm install
```

### Start Metro

```bash
npm run dev:clean
```

### Build and run on Android

In another terminal:

```bash
npm run android
```

If the app was already built and you only need the JS bundler:

```bash
npx expo start
```

### Web preview

```bash
npm run web
```

Web is for UI preview only. Wallet connection and transaction flows are Android-only.

## Judge Demo Setup

For the intended demo path:

1. Start the backend service on the host machine at port `8080`.
2. Set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080` for Android emulator testing.
3. Boot an Android emulator with Google Play.
4. Install and open Phantom in the emulator.
5. Switch Phantom to devnet and fund it with devnet SOL.
6. Launch Pact and connect the wallet.

If judges are using a physical Android device instead of an emulator:

1. Expose the backend with ngrok or another public tunnel.
2. Point `EXPO_PUBLIC_API_BASE_URL` to that HTTPS URL.
3. Install Phantom on the device and switch it to devnet.

## Demo Script

Recommended short demo:

1. Connect wallet
2. Show wallet balance and active profile state
3. Create a challenge with devnet USDC
4. Join or inspect an existing challenge
5. Submit proof
6. Show leaderboard / profile / challenge history

## Solana Notes

- The app currently targets `devnet`
- Read RPC uses Helius by default
- Transaction sending has fallback RPC handling
- Staking uses devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Known Constraints

- Mobile wallet flow is Android-only
- Browser mode cannot perform real wallet actions
- Backend is required for the full proof and leaderboard experience
- Emulator testing is smoother than physical-device localhost testing unless a public tunnel is used

## Validation

Type checking:

```bash
npx tsc --noEmit
```

## Related Components

This repository is the mobile client only. The full product also depends on:

- The Solana program deployment
- The backend API service used for auth, proof storage, and indexed data

## License

Private project for hackathon/demo use unless stated otherwise by the team.
