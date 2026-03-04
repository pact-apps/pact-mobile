import AsyncStorage from "@react-native-async-storage/async-storage";
import { signMessage } from "./wallet";
import { pactApi } from "./apiInstance";

const JWT_KEY = "pact_backend_jwt";

/**
 * Full auth flow:
 * 1. Get nonce from backend
 * 2. Sign message with MWA
 * 3. Verify signature on backend → get JWT
 * 4. Cache JWT for future requests
 */
export async function authenticateWithBackend(
  walletAddress: string
): Promise<string> {
  // 1. Get nonce
  const { message } = await pactApi.auth.getNonce();

  // 2. Sign with MWA
  const signature = await signMessage(message);

  // 3. Verify on backend
  const { token } = await pactApi.auth.verify(walletAddress, signature, message);

  // 4. Cache & set
  await AsyncStorage.setItem(JWT_KEY, token);
  pactApi.setToken(token);

  return token;
}

/** Restore cached JWT if available */
export async function restoreBackendAuth(): Promise<boolean> {
  const token = await AsyncStorage.getItem(JWT_KEY);
  if (token) {
    pactApi.setToken(token);
    return true;
  }
  return false;
}

/** Clear backend auth */
export async function clearBackendAuth(): Promise<void> {
  await AsyncStorage.removeItem(JWT_KEY);
  pactApi.clearToken();
}
