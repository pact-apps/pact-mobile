/**
 * Pact Backend API Client
 * Adapted from backend-provided client for React Native.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface AuthResponse {
  token: string;
  wallet_address: string;
  expires_at: string;
}

export interface ChallengeMetadata {
  id: string;
  challenge_id: string;
  challenge_pubkey: string;
  title: string;
  description: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeListResponse {
  challenges: ChallengeMetadata[];
  total: number;
}

export interface UpsertMetadataRequest {
  challenge_pubkey: string;
  title: string;
  description?: string;
  tags?: string[];
  wallet_address: string;
}

export interface ProofResponse {
  challenge_id: string;
  wallet_address: string;
  proof_hash: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  submitted_at: string;
}

export interface ScoreResponse {
  wallet_address: string;
  score: number;
  rank: number | null;
  challenges_completed: number;
  challenges_failed: number;
  streak_current: number;
  streak_best: number;
  total_staked_usdc: number;
  total_earned_usdc: number;
}

export interface LeaderboardEntry {
  wallet_address: string;
  score: number;
  challenges_completed: number;
  streak_best: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

export interface EventLog {
  id: number;
  signature: string;
  event_type: string;
  challenge_id: string | null;
  wallet_address: string | null;
  data: Record<string, unknown>;
  slot: number;
  block_time: string | null;
  indexed_at: string;
}

// ─── Error ───────────────────────────────────────────────────────────

export class PactApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`API ${status} on ${path}: ${body}`);
    this.name = "PactApiError";
  }
}

// ─── Client ──────────────────────────────────────────────────────────

export function createPactApi(baseUrl: string) {
  let authToken: string | null = null;

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
      ...(options.headers as Record<string, string>),
    };

    if (authToken && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(`${baseUrl}${path}`, { ...options, headers });

    if (!resp.ok) {
      const text = await resp.text();
      throw new PactApiError(resp.status, text, path);
    }

    return resp.json() as Promise<T>;
  }

  return {
    setToken(token: string) {
      authToken = token;
    },
    clearToken() {
      authToken = null;
    },
    getToken() {
      return authToken;
    },

    health: {
      check: () => request<{ status: string }>("/health"),
    },

    auth: {
      getNonce: () => request<NonceResponse>("/api/auth/nonce"),
      verify: (
        walletAddress: string,
        signature: string,
        message: string
      ) =>
        request<AuthResponse>("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: walletAddress,
            signature,
            message,
          }),
        }),
    },

    challenges: {
      list: (limit = 20, offset = 0, createdBy?: string) => {
        let url = `/api/challenges?limit=${limit}&offset=${offset}`;
        if (createdBy) url += `&created_by=${createdBy}`;
        return request<ChallengeListResponse>(url);
      },
      get: (challengeId: string) =>
        request<ChallengeMetadata>(`/api/challenges/${challengeId}`),
      upsertMetadata: (
        challengeId: string,
        data: UpsertMetadataRequest
      ) =>
        request<ChallengeMetadata>(
          `/api/challenges/${challengeId}/metadata`,
          {
            method: "POST",
            body: JSON.stringify(data),
          }
        ),
    },

    proofs: {
      upload: async (
        challengeId: string,
        walletAddress: string,
        file: { uri: string; name: string; type: string }
      ) => {
        const form = new FormData();
        form.append("challenge_id", challengeId);
        form.append("wallet_address", walletAddress);
        form.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);

        return request<ProofResponse>("/api/proofs/upload", {
          method: "POST",
          body: form,
        });
      },
      get: (challengeId: string, wallet: string) =>
        request<ProofResponse>(`/api/proofs/${challengeId}/${wallet}`),
    },

    scores: {
      get: (wallet: string) =>
        request<ScoreResponse>(`/api/scores/${wallet}`),
      leaderboard: (limit = 20, offset = 0) =>
        request<LeaderboardResponse>(
          `/api/scores?limit=${limit}&offset=${offset}`
        ),
    },

    events: {
      get: (challengeId: string, eventType?: string) => {
        const params = eventType ? `?event_type=${eventType}` : "";
        return request<EventLog[]>(
          `/api/events/${challengeId}${params}`
        );
      },
    },
  };
}
