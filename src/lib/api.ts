import type {
  ActivityLog,
  ActivityStats,
  DailyActiveUserStat,
  EndpointStat,
  LoginAttempt,
  LoginStats,
  MemberPlanning,
} from "@/types";

// ============================================================
// LIMA – API client (fetch-based, JWT auth)
// ============================================================

const _env_url = import.meta.env.VITE_API_URL as string | undefined;
const BASE_URL = _env_url && _env_url.length > 0
  ? _env_url
  : "https://api-production-e15b.up.railway.app";

const TOKEN_KEY = "lima_token";

// ---- Token helpers ----
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---- Core request helper ----
interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    message?: string
  ) {
    super(message ?? detail);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  { body, params, headers: extraHeaders, ...rest }: RequestOptions = {}
): Promise<T> {
  const fullUrl = BASE_URL ? `${BASE_URL}${path}` : path;
  const url = new URL(fullUrl, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const token = getToken();
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let bodyInit: BodyInit | undefined;
  if (body instanceof FormData) {
    bodyInit = body;
    // Don't set Content-Type; browser sets it with boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: bodyInit,
    ...rest,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err?.detail ?? detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(response.status, detail);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ---- HTTP verb helpers ----
export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    request<T>("GET", path, { params }),

  post: <T>(path: string, body?: unknown, params?: RequestOptions["params"]) =>
    request<T>("POST", path, { body, params }),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, { body }),

  delete: <T = void>(path: string) =>
    request<T>("DELETE", path),

  postForm: <T>(path: string, form: FormData, params?: RequestOptions["params"]) =>
    request<T>("POST", path, { body: form, params }),
};

function normalizeEndpointStats(value: unknown): EndpointStat[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): EndpointStat | null => {
      if (Array.isArray(item) && item.length >= 2) {
        return {
          path: String(item[0] ?? "—"),
          count: Number(item[1] ?? 0),
        };
      }

      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return {
          path: String(obj.path ?? obj.endpoint ?? obj.url ?? obj.label ?? "—"),
          count: Number(obj.count ?? obj.total ?? obj.value ?? 0),
        };
      }

      return null;
    })
    .filter((item): item is EndpointStat => !!item && !!item.path)
    .sort((a, b) => b.count - a.count);
}

function normalizeDailyActiveUsers(value: unknown): DailyActiveUserStat[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): DailyActiveUserStat | null => {
      if (Array.isArray(item) && item.length >= 2) {
        return {
          date: String(item[0] ?? ""),
          count: Number(item[1] ?? 0),
        };
      }

      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return {
          date: String(obj.date ?? obj.day ?? obj.label ?? ""),
          count: Number(obj.count ?? obj.users ?? obj.value ?? 0),
        };
      }

      return null;
    })
    .filter((item): item is DailyActiveUserStat => !!item && !!item.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeRecentActivity(value: unknown): ActivityLog[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? ((value as Record<string, unknown>).items ?? (value as Record<string, unknown>).results ?? value)
      : [];

  if (!Array.isArray(items)) return [];

  return items
    .map((item): ActivityLog | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const firstName = typeof obj.first_name === "string" ? obj.first_name : "";
      const lastName = typeof obj.last_name === "string" ? obj.last_name : "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        id: typeof obj.id === "string" ? obj.id : undefined,
        user_id: typeof obj.user_id === "string" ? obj.user_id : null,
        email: typeof obj.email === "string" ? obj.email : null,
        name: typeof obj.name === "string" ? obj.name : fullName || null,
        path: String(obj.path ?? obj.endpoint ?? obj.url ?? ""),
        method: typeof obj.method === "string" ? obj.method : null,
        status_code: typeof obj.status_code === "number" ? obj.status_code : typeof obj.status === "number" ? obj.status : null,
        response_time_ms:
          typeof obj.response_time_ms === "number"
            ? obj.response_time_ms
            : typeof obj.duration_ms === "number"
              ? obj.duration_ms
              : null,
        created_at: String(obj.created_at ?? obj.timestamp ?? obj.occurred_at ?? ""),
      };
    })
    .filter((item): item is ActivityLog => !!item && !!item.path && !!item.created_at);
}

function normalizeLoginAttempts(value: unknown): LoginStats {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const directAttempts = Array.isArray(raw.attempts) ? raw.attempts : null;

  const toAttempt = (item: unknown, successFallback?: boolean): LoginAttempt | null => {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const firstName = typeof obj.first_name === "string" ? obj.first_name : "";
    const lastName = typeof obj.last_name === "string" ? obj.last_name : "";
    const fullName = `${firstName} ${lastName}`.trim();
    const inferredSuccess =
      typeof obj.success === "boolean"
        ? obj.success
        : typeof obj.status === "string"
          ? obj.status.toLowerCase() === "success"
          : successFallback ?? false;

    const createdAt = String(obj.created_at ?? obj.timestamp ?? obj.last_attempt_at ?? obj.date ?? "");
    if (!createdAt) return null;

    return {
      id: typeof obj.id === "string" ? obj.id : undefined,
      user_id: typeof obj.user_id === "string" ? obj.user_id : null,
      email: typeof obj.email === "string" ? obj.email : null,
      name: typeof obj.name === "string" ? obj.name : fullName || null,
      success: inferredSuccess,
      created_at: createdAt,
    };
  };

  const attempts = directAttempts
    ? directAttempts.map((item) => toAttempt(item)).filter((item): item is LoginAttempt => !!item)
    : [
        ...(Array.isArray(raw.success) ? raw.success.map((item) => toAttempt(item, true)) : []),
        ...(Array.isArray(raw.failure) ? raw.failure.map((item) => toAttempt(item, false)) : []),
        ...(Array.isArray(raw.failures) ? raw.failures.map((item) => toAttempt(item, false)) : []),
      ].filter((item): item is LoginAttempt => !!item);

  const success_count = attempts.filter((attempt) => attempt.success).length;
  const failure_count = attempts.length - success_count;

  return {
    attempts: attempts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    success_count,
    failure_count,
  };
}

export async function fetchActivityStats(days: number): Promise<ActivityStats> {
  const raw = await api.get<Record<string, unknown>>("/api/admin/activity/stats", { days });

  return {
    total_requests: Number(raw.total_requests ?? 0),
    unique_users: Number(raw.unique_users ?? 0),
    top_endpoints: normalizeEndpointStats(raw.top_endpoints),
    error_endpoints: normalizeEndpointStats(raw.error_endpoints),
    daily_active_users: normalizeDailyActiveUsers(raw.daily_active_users),
    avg_response_time_ms: Number(raw.avg_response_time_ms ?? 0),
  };
}

export async function fetchRecentActivity(limit: number): Promise<ActivityLog[]> {
  const raw = await api.get<unknown>("/api/admin/activity/recent", { limit });
  return normalizeRecentActivity(raw);
}

export async function fetchLoginStats(days: number): Promise<LoginStats> {
  const raw = await api.get<unknown>("/api/admin/activity/logins", { days });
  return normalizeLoginAttempts(raw);
}

export async function fetchMyPlanning(): Promise<MemberPlanning> {
  return api.get<MemberPlanning>("/members/me/planning");
}
