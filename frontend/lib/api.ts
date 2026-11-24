// Thin client for the NEXORA FastAPI backend.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'nexora-token';
export const AUTH_ERROR_EVENT = 'nexora:auth-error';
export const TOKEN_KEY_NAME = TOKEN_KEY;

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function messageFrom(body: unknown, fallback: string): string {
  const d = (body as { detail?: unknown } | null)?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  return fallback;
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? 'GET',
      headers: { ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A token was sent but rejected -> the session in React may be stale (token replaced in another tab,
    // expired, or the account is not an admin). Let AuthProvider re-sync with /api/auth/me.
    if (token && (res.status === 401 || res.status === 403) && typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_ERROR_EVENT));
    throw new ApiError(res.status, messageFrom(data, `Request failed (${res.status}).`));
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** Fetches a protected file (e.g. a PDF) with the auth header and saves it through the browser. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, messageFrom(data, `Download failed (${res.status}).`));
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Where to go after sign-in: the `?next=` path if it is a local path, otherwise `fallback`. */
export function nextPath(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback;
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : fallback;
}
