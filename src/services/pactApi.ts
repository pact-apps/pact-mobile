/**
 * Pact Backend API Client
 */

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
  description?: string;
  tags?: string[];
  challenge_type?: "final_only" | "daily_checkin";
  proof_rule_config?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeRulesConfig {
  challenge_id: string;
  required_checkins?: number;
  target_days?: number;
  grace_days?: number;
  rules_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChallengeConfigResponse {
  metadata: ChallengeMetadata;
  rules: ChallengeRulesConfig | null;
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
  challenge_type?: "final_only" | "daily_checkin";
  proof_rule_config?: Record<string, unknown>;
  required_checkins?: number;
  target_days?: number;
  grace_days?: number;
  rules_json?: Record<string, unknown>;
  wallet_address?: string;
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

export interface ChainConfigResponse {
  program_id: string;
  platform_config_pda: string;
  treasury_authority: string;
  platform_fee_bps: number;
  treasury_token_accounts: Record<string, string>;
}

export interface FinalizePlanParticipantTriple {
  participant_state: string;
  payout_token_account: string;
  commitment_profile: string;
}

export interface FinalizePlanRequest {
  challenge: string;
  vault: string;
  token_program: string;
  stake_mint: string;
  challenge_authority?: string;
  participant_accounts: FinalizePlanParticipantTriple[];
}

export interface FinalizePlanResponse {
  program_id: string;
  platform_config_pda: string;
  treasury_authority: string;
  treasury_token_account: string;
  platform_fee_bps: number;
  challenge: string;
  vault: string;
  token_program: string;
  stake_mint: string;
  challenge_authority?: string;
  remaining_accounts: string[];
  participant_triples: FinalizePlanParticipantTriple[];
}

export interface UploadedProofFile {
  id: string;
  challenge_id: string;
  participant_wallet: string;
  submission_id: string;
  checkin_id: string | null;
  challenge_type: "final_only" | "daily_checkin";
  proof_kind: string;
  storage_path: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  sha256: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface FinalProofSummary {
  id: string;
  challenge_id: string;
  participant_wallet: string;
  challenge_type: "final_only" | "daily_checkin";
  summary_json: Record<string, unknown>;
  summary_text: string;
  final_sha256: string;
  based_on_submission_updated_at: string;
  generated_at: string;
}

export interface SubmissionRecord {
  id: string;
  challenge_id: string;
  participant_wallet: string;
  challenge_type: "final_only" | "daily_checkin";
  status: string;
  final_result_claim?: string;
  finalized_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FinalProofUploadResponse {
  submission: SubmissionRecord;
  proof_files: UploadedProofFile[];
  summary: FinalProofSummary;
  final_sha256: string;
}

export interface DailyCheckinRecord {
  id: string;
  challenge_id: string;
  participant_wallet: string;
  submission_id: string;
  checkin_date: string;
  day_index?: number;
  status: string;
  notes?: string;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckinResponse {
  checkin: DailyCheckinRecord;
  attachments: Array<{
    id: string;
    proof_kind: string;
    mime_type: string;
    sha256: string;
  }>;
  summary: {
    id: string;
    final_sha256: string;
  };
  final_sha256: string;
}

export interface ProofHashResponse {
  challenge_id: string;
  participant_wallet: string;
  challenge_type: "final_only" | "daily_checkin";
  final_sha256: string;
  generated_at: string;
}

export interface DisputeReviewResponse {
  challenge_id: string;
  participant_wallet: string;
  challenge_type: "final_only" | "daily_checkin";
  submission: {
    id: string;
    status: string;
    final_result_claim?: string;
  } | null;
  summary: {
    id: string;
    final_sha256: string;
  } | null;
  proof_files: Array<{
    id: string;
    proof_kind: string;
    file_url: string;
    mime_type: string;
    sha256: string;
  }>;
  daily_checkins: Array<{
    id: string;
    checkin_date: string;
    day_index?: number;
    notes?: string;
  }>;
}

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

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export function createPactApi(baseUrl: string) {
  let authToken: string | null = null;

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
      ...(options.headers as Record<string, string>),
    };

    if (authToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        signal: options.signal ?? controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms for ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

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
      verify: (walletAddress: string, signature: string, message: string) =>
        request<AuthResponse>("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: walletAddress,
            signature,
            message,
          }),
        }),
    },

    chain: {
      getConfig: () => request<ChainConfigResponse>("/api/chain/config"),
      finalizePlan: (payload: FinalizePlanRequest) =>
        request<FinalizePlanResponse>("/api/chain/finalize-plan", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
    },

    challenges: {
      list: (limit = 20, offset = 0, createdBy?: string) => {
        let url = `/api/challenges?limit=${limit}&offset=${offset}`;
        if (createdBy) {
          url += `&created_by=${createdBy}`;
        }
        return request<ChallengeListResponse>(url);
      },
      get: (challengeId: string) =>
        request<ChallengeConfigResponse>(`/api/challenges/${challengeId}/config`),
      upsertMetadata: (challengeId: string, data: UpsertMetadataRequest) =>
        request<ChallengeConfigResponse>(`/api/challenges/${challengeId}/metadata`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
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
      uploadFinal: async (
        challengeId: string,
        files: Array<{ uri: string; name: string; type: string }>,
        finalResultClaim?: "success" | "fail"
      ) => {
        const form = new FormData();
        files.forEach((file) => {
          form.append("file", {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });
        if (finalResultClaim) {
          form.append("final_result_claim", finalResultClaim);
        }
        return request<FinalProofUploadResponse>(
          `/api/challenges/${challengeId}/proofs/final`,
          {
            method: "POST",
            body: form,
          }
        );
      },
      uploadCheckin: async (
        challengeId: string,
        files: Array<{ uri: string; name: string; type: string }>,
        fields: {
          checkin_date?: string;
          day_index?: number;
          notes?: string;
        } = {}
      ) => {
        const form = new FormData();
        files.forEach((file) => {
          form.append("file", {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });
        if (fields.checkin_date) {
          form.append("checkin_date", fields.checkin_date);
        }
        if (typeof fields.day_index === "number") {
          form.append("day_index", String(fields.day_index));
        }
        if (fields.notes) {
          form.append("notes", fields.notes);
        }
        return request<DailyCheckinResponse>(
          `/api/challenges/${challengeId}/checkins`,
          {
            method: "POST",
            body: form,
          }
        );
      },
      getSummary: (challengeId: string, wallet: string) =>
        request<FinalProofSummary>(
          `/api/challenges/${challengeId}/submissions/${wallet}/summary`
        ),
      getProofHash: (challengeId: string, wallet: string) =>
        request<ProofHashResponse>(
          `/api/challenges/${challengeId}/submissions/${wallet}/proof-hash`
        ),
      getDisputeReview: (challengeId: string, wallet: string) =>
        request<DisputeReviewResponse>(
          `/api/challenges/${challengeId}/submissions/${wallet}/dispute-review`
        ),
    },

    scores: {
      get: (wallet: string) => request<ScoreResponse>(`/api/scores/${wallet}`),
      leaderboard: (limit = 20, offset = 0) =>
        request<LeaderboardResponse>(`/api/scores?limit=${limit}&offset=${offset}`),
    },

    events: {
      get: (challengeId: string, eventType?: string) => {
        const params = eventType ? `?event_type=${eventType}` : "";
        return request<EventLog[]>(`/api/events/${challengeId}${params}`);
      },
    },
  };
}
