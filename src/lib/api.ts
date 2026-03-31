// ============================================================
// LIMA – API client (fetch-based, JWT auth)
// ============================================================

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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
  const url = new URL(`${BASE_URL}${path}`);

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
