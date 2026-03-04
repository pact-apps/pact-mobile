# Pact Mobile — Complete Setup & Build Guide

Pact is a mobile-first accountability app built on Solana. Groups escrow USDC into challenges, complete them to earn rewards, or lose their stake.

**Tech Stack:** React Native (Expo SDK 55) + Solana Web3.js + Anchor + MWA (Mobile Wallet Adapter)

> **PENTING:** App ini Android-only untuk fitur wallet (MWA). Web mode tersedia untuk preview UI saja.

---

## Prerequisites

Pastikan semua ini terinstall **sebelum mulai**:

| Tool | Version | Install | Cek |
|------|---------|---------|-----|
| **Node.js** | v18+ | https://nodejs.org | `node -v` |
| **npm** | v9+ | Sudah include di Node.js | `npm -v` |
| **Git** | Any | https://git-scm.com | `git --version` |
| **Android Studio** | Latest | https://developer.android.com/studio | Buka app |
| **JDK 17** | 17+ | Via Android Studio atau https://adoptium.net | `java -version` |

### Android Studio SDK Setup

Buka Android Studio, lalu:

1. **File** → **Settings** → **Languages & Frameworks** → **Android SDK**
2. Tab **SDK Platforms**: centang **Android 14 (API 34)** atau yang terbaru
3. Tab **SDK Tools**: centang semua ini:
   - **Android SDK Build-Tools** (versi terbaru)
   - **Android SDK Command-line Tools**
   - **Android SDK Platform-Tools**
   - **NDK (Side by side)** — centang **Show Package Details**, pastikan versi **27.1.12297006** ada
     > Kalau NDK 27.1 gagal download, lihat bagian [Troubleshooting NDK](#ndk-tidak-bisa-diinstall)
   - **CMake** (versi 3.22.1)
4. Klik **Apply** dan tunggu download selesai

---

## Step 1 — Clone & Install

```bash
# PENTING: Clone ke path yang PENDEK!
# JANGAN clone ke folder seperti:
#   C:\Users\NamaAnda\Desktop\Projects\hackathon\pact-app-mobile\pact-mobile
#
# Windows punya limit 260 karakter untuk path file.
# Path yang terlalu panjang AKAN menyebabkan build GAGAL pada tahap CMake/ninja.
# Error yang muncul: "Filename longer than 260 characters"

# BENAR — clone langsung ke root drive:
cd C:\
git clone <repo-url> pact
cd C:\pact

# Install dependencies
npm install
```

> **KRITIS:** Jika kamu clone ke path panjang (misal Desktop), build PASTI gagal di tahap native compilation. Ini bukan bug app — ini limitasi Windows. Selalu gunakan path pendek seperti `C:\pact`.

---

## Step 2 — Set Environment Variables

### ANDROID_HOME

**Windows (PowerShell):**
```powershell
# Cek apakah sudah di-set
echo $env:ANDROID_HOME

# Kalau kosong, set:
# Path default biasanya: C:\Users\<NamaAnda>\AppData\Local\Android\Sdk
# ATAU: C:\Android\Sdk (tergantung install)
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\Sdk", "User")

# Restart terminal setelah set
```

**macOS/Linux:**
```bash
# Tambahkan ke ~/.bashrc atau ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
source ~/.bashrc
```

### Verifikasi setup
```bash
npx react-native doctor
```

Semua cek Android harus hijau. iOS bisa diabaikan.

---

## Step 3 — Backend Connection

App butuh koneksi ke Pact backend API (Rust/Axum server).

### Option A: Gunakan ngrok URL tim (paling mudah)

Tanya tim untuk URL ngrok yang aktif, lalu edit file `src/utils/constants.js`:

```js
export const API_BASE_URL = "https://xxxx-xxxx.ngrok-free.dev";
```

### Option B: Jalankan backend sendiri

#### Di WSL/Linux:
```bash
cd ~/pact-backend
cargo run
# Server jalan di http://localhost:8080
```

#### Expose ke Android device:
Android **tidak bisa** akses `localhost` dari PC secara langsung. Pilih salah satu:

| Cara run app | API_BASE_URL | Perlu ngrok? |
|---|---|---|
| **Android Emulator** | `http://10.0.2.2:8080` | Tidak |
| **HP fisik via USB** | `https://xxx.ngrok-free.dev` | Ya |
| **Web browser** | `http://localhost:8080` | Tidak |

#### Setup ngrok (untuk HP fisik):
```powershell
# Install ngrok (Windows)
winget install ngrok.ngrok

# Daftar akun gratis di https://ngrok.com lalu:
ngrok config add-authtoken YOUR_TOKEN

# Jalankan (backend harus sudah running):
ngrok http 8080
# Copy URL https yang muncul → paste ke constants.js
```

> **Catatan:** URL ngrok gratis berubah tiap restart. Update `API_BASE_URL` setiap sesi baru.

#### Cara test backend jalan:
Buka di browser: `https://your-ngrok-url.ngrok-free.dev/api/scores?limit=10&offset=0`

Kalau muncul `{"error":"Missing Authorization header"}` → **backend jalan dengan benar**. Error itu normal karena endpoint butuh JWT.

---

## Step 4 — Siapkan Device/Emulator

### Option A: HP Android Fisik (Recommended)

1. **Aktifkan Developer Options:**
   - Buka **Settings** → **About Phone** → tap **Build Number** 7x berturut-turut
   - Muncul toast "You are now a developer!"

2. **Aktifkan USB Debugging:**
   - **Settings** → **Developer Options** → nyalakan **USB Debugging**

3. **Colok USB ke PC:**
   - Di HP muncul popup **"Allow USB Debugging?"** → tap **Allow** (centang "Always allow")

4. **Verifikasi:**
   ```powershell
   adb devices
   # Harus muncul device ID, BUKAN "unauthorized"
   ```

5. **Install Phantom Wallet:**
   - Download dari **Google Play Store** di HP
   - Buka Phantom → buat/import wallet
   - **Settings** → **Developer Settings** → switch ke **Devnet**
   - Tap **"Airdrop SOL"** untuk gas fee

### Option B: Android Emulator

1. Buka **Android Studio** → **Virtual Device Manager** (atau **More Actions** → **Virtual Device Manager**)
2. Klik **Create Virtual Device**
3. Pilih **Pixel 7** atau **Pixel 7a** → **Next**
4. Pilih system image:
   - **PENTING:** Pilih yang ada logo **Play Store** (segitiga) supaya bisa install Phantom
   - Rekomendasi: **API 34 (Android 14)** — `Google Play | x86_64`
   - Kalau belum ada, klik **Download** dulu
5. **Next** → **Finish**
6. Klik tombol **Play** untuk start emulator

**Install Phantom di emulator:**
- Buka **Google Play Store** di emulator
- Login Google Account
- Search **"Phantom"** → Install
- Setup wallet → switch ke Devnet

> **Alternatif tanpa Play Store:** Download APK Phantom dari [APKMirror](https://www.apkmirror.com/apk/phantom-technologies-inc/phantom-crypto-wallet/) lalu:
> ```powershell
> adb install phantom.apk
> ```

> **Emulator tidak ada internet?** Tutup emulator, lalu start ulang dengan DNS manual:
> ```powershell
> # Lihat nama AVD
> emulator -list-avds
> # Start dengan DNS Google
> emulator -avd Pixel_7a -dns-server 8.8.8.8,8.8.4.4
> ```
> Kalau `emulator` command not found, gunakan full path:
> ```powershell
> C:\Android\Sdk\emulator\emulator -list-avds
> ```

---

## Step 5 — Build & Run

```powershell
cd C:\pact
npx expo run:android
```

### Apa yang terjadi:

1. **Gradle download dependencies** (~500MB pertama kali) — bisa 5-15 menit
2. **Compile native code** (C++, Kotlin, Java)
3. **Build APK** dan install ke device/emulator
4. **Start Metro Bundler** — JS bundle server
5. **App terbuka** di device/emulator

> **PENTING:** Jangan tutup terminal setelah build selesai! Metro bundler harus tetap jalan.

### Build berhasil kalau muncul:
```
BUILD SUCCESSFUL in Xm Xs
...
Starting Metro Bundler
› Installing .../app-debug.apk
› Opening com.pact.mobile/.MainActivity
```

### Subsequent runs (setelah build pertama):
```powershell
# Kalau native code tidak berubah, cukup start Metro:
npx expo start

# Kalau ada perubahan native dependencies:
npx expo run:android
```

---

## Step 6 — Web Preview (Tanpa Android)

Kalau belum setup Android atau mau quick preview UI:

```powershell
cd C:\pact
npx expo start --web
```

Buka `http://localhost:8081` di browser.

> **Limitasi web:**
> - Tombol **"Connect Wallet"** tidak akan berfungsi (MWA = Android only)
> - Semua fitur yang butuh wallet (create/join/submit challenge) tidak jalan
> - Berguna untuk cek layout, navigasi, dan screen yang tidak butuh wallet (Leaderboard jika backend jalan)

---

## Step 7 — Testing Full Flow (Android)

```
1. CONNECT WALLET
   Home screen → tap "Connect Wallet"
   → Phantom terbuka → tap "Approve"
   → Wallet address muncul di Home screen

2. GET DEVNET USDC
   Butuh devnet USDC untuk create/join challenge.
   → Mint devnet USDC di: https://spl-token-ui.com
   → Atau minta ke tim

3. CREATE CHALLENGE
   Home → tap "+ New Challenge"
   → Isi: Title, Stake (dalam USDC), Duration, Max participants
   → Submit → Approve di Phantom
   → Challenge muncul di list

4. JOIN CHALLENGE (perlu wallet berbeda/device lain)
   → Tap challenge → "Join Challenge"
   → Approve transaction (USDC di-stake)

5. START CHALLENGE (creator saja, minimal 2 participant)
   → Tap challenge → "Start Challenge"
   → Approve transaction

6. SUBMIT PROOF
   → "Submit — I Succeeded"
   → Pilih foto dari gallery
   → Foto upload ke backend → SHA256 hash dikirim on-chain
   → Approve transaction

7. SETTLE
   → Setelah submission window habis → "Settle Challenge"
   → Token didistribusikan ke winner
```

---

## Troubleshooting

### Build errors

#### NDK tidak bisa diinstall

Kalau NDK 27.1.12297006 gagal download (connection reset, laptop sleep, dll):

```
Error: NDK at C:\Android\Sdk\ndk\27.1.12297006 did not have a source.properties file
```

**Solusi:** Kamu punya NDK versi lain (misal 27.0)? Copy sebagai 27.1:

```powershell
# Hapus folder NDK yang corrupt
Remove-Item -Recurse -Force "C:\Android\Sdk\ndk\27.1.12297006"

# Copy NDK yang sudah ada
Copy-Item -Recurse "C:\Android\Sdk\ndk\27.0.12077973" "C:\Android\Sdk\ndk\27.1.12297006"
```

Versi 27.0 dan 27.1 kompatibel — build akan jalan.

#### "Filename longer than 260 characters"

```
ninja: error: Stat(...): Filename longer than 260 characters
```

**Penyebab:** Project ada di path terlalu panjang (misal `C:\Users\Nama\Desktop\folder\subfolder\pact-mobile`).

**Solusi:** Pindahkan project ke root drive:
```powershell
Copy-Item -Recurse "C:\path\panjang\pact-mobile" "C:\pact"
cd C:\pact

# Hapus build cache lama
Remove-Item -Recurse -Force "C:\pact\android\.cxx" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\pact\android\app\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\pact\android\build" -ErrorAction SilentlyContinue

npx expo run:android
```

#### "Could not find org.asyncstorage.shared_storage:storage-android"

**Penyebab:** `@react-native-async-storage/async-storage` versi 3.x butuh Maven repo tambahan.

**Solusi:** Downgrade ke versi 2.x:
```bash
npm install @react-native-async-storage/async-storage@2.1.2
```

#### Build gagal di tengah jalan (laptop sleep/mati)

Gradle punya cache. Jalankan ulang:
```bash
npx expo run:android
```

Build akan lanjut dari cache — tidak perlu download ulang semua.

Kalau masih error setelah restart, clean build:
```powershell
Remove-Item -Recurse -Force "C:\pact\android\.cxx" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\pact\android\app\build" -ErrorAction SilentlyContinue
npx expo run:android
```

> **Tips:** Set laptop supaya tidak sleep saat build:
> **Settings** → **System** → **Power** → **Screen and sleep** → set ke **Never** (sementara)

### Runtime errors

| Problem | Solusi |
|---|---|
| `npm install` fails | Hapus `node_modules` dan `package-lock.json`, run `npm install` lagi |
| `ANDROID_HOME` not set | Lihat Step 2 |
| `adb devices` kosong | Enable USB Debugging, trust PC di HP |
| Build fails "SDK not found" | Android Studio → SDK Manager → Install API 34+ |
| Metro: "Unable to resolve module" | `npx expo start --clear` |
| MWA: "No wallet found" | Install Phantom (HP) atau download APK manual (emulator) |
| Backend connection refused | Cek ngrok masih jalan / `API_BASE_URL` benar |
| `{"error":"Missing Authorization header"}` di browser | **Normal** — backend jalan, auth otomatis di app |
| Web: tombol wallet gak jalan | **Expected** — MWA Android-only |
| Emulator gak ada internet | Restart emulator dengan `-dns-server 8.8.8.8` (lihat Step 4) |
| `rmdir /s /q` error di PowerShell | Gunakan `Remove-Item -Recurse -Force "path"` (PowerShell syntax berbeda dari CMD) |

---

## Development Commands

```bash
# Start Metro bundler (kalau native sudah di-build)
npx expo start

# Build + run di Android
npx expo run:android

# Web preview
npx expo start --web

# Type check
npx tsc --noEmit

# Clear Metro cache
npx expo start --clear

# Cek device terhubung
adb devices

# Install APK manual
adb install path/to/app.apk
```

---

## Project Structure

```
pact-mobile/
├── App.tsx                    # Root (QueryClient + SafeArea + Navigator)
├── polyfills.ts               # Buffer, URL, crypto polyfills untuk Solana
├── index.ts                   # Entry point
├── app.json                   # Expo config
├── idl/
│   └── pact_escrow.json       # Anchor IDL (on-chain program interface)
├── android/                   # Native Android project (auto-generated by Expo)
│   ├── build.gradle           # Root Gradle config (NDK override di sini)
│   └── app/build.gradle       # App Gradle config
└── src/
    ├── navigation/
    │   └── AppNavigator.tsx    # Bottom tabs: Challenges, Leaderboard, Profile
    ├── screens/
    │   ├── HomeScreen.tsx      # Challenge list + wallet connect
    │   ├── CreateChallengeScreen.tsx
    │   ├── ChallengeDetailScreen.tsx  # Join/Start/Submit/Settle/Dispute + proof upload
    │   ├── LeaderboardScreen.tsx      # Commitment score rankings
    │   └── ProfileScreen.tsx          # Wallet info, balances, score stats
    ├── services/
    │   ├── wallet.ts           # MWA: authorize, reauthorize, sign tx, sign message
    │   ├── transactions.ts     # On-chain: create, join, start, submit, finalize, dispute, vote
    │   ├── anchor.ts           # Anchor Program + account fetchers
    │   ├── solana.ts           # RPC connection, SOL/USDC balance queries
    │   ├── pactApi.ts          # Backend REST API client (auth, challenges, proofs, scores)
    │   ├── apiInstance.ts      # Singleton API instance
    │   └── backendAuth.ts      # Wallet signature → JWT auth flow
    ├── hooks/
    │   └── useChallenge.ts     # React Query hooks for on-chain data
    ├── store/
    │   └── useAppStore.ts      # Zustand: wallet state, balances
    └── utils/
        ├── constants.js        # Network config, program ID, USDC mint, API URL
        └── explorer.ts         # Solana Explorer link helpers
```

---

## Key Config Values

Semua config ada di `src/utils/constants.js`:

| Constant | Value | Keterangan |
|---|---|---|
| `SOLANA_NETWORK` | `devnet` | Solana cluster |
| `PROGRAM_ID` | `6JTfaG...bCs` | Deployed Pact Escrow program on devnet |
| `USDC_MINT` | `4zMMC9...DU` | Devnet USDC token mint |
| `API_BASE_URL` | ngrok URL | Backend API endpoint — update setiap sesi |
| `TREASURY_WALLET` | `HN7cAB...p8` | Fee collection wallet (placeholder) |

---

## Backend Setup (Separate Repo)

Backend menggunakan **Rust + Axum**, berjalan di port 8080. Lihat README di repo `pact-backend` untuk setup lengkap.

Secara singkat:
```bash
# Di WSL/Linux
cd pact-backend
cp .env.example .env  # Edit config (database URL, JWT secret, RPC URL, program ID)
cargo run
# Server starts at http://localhost:8080
```

API endpoints yang dipakai app:
- `GET /api/auth/nonce` — Get nonce untuk wallet signature
- `POST /api/auth/verify` — Verify signature, return JWT
- `GET /api/challenges` — List semua challenges
- `POST /api/proofs/upload` — Upload proof image (multipart)
- `GET /api/scores/:wallet` — Get commitment score
- `GET /api/scores?limit=50&offset=0` — Leaderboard
