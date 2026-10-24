import { ApiError } from "@/mocks/db";

const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BACKEND_URL"]) ||
  "http://localhost:4000/api/v1";

let cachedToken: string | null = null;
let loginPromise: Promise<string | null> | null = null;

/**
 * Retrieves the active JWT access token or automatically authenticates
 * against the backend using dev admin credentials.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const stored =
      localStorage.getItem("pos_access_token") ||
      localStorage.getItem("accessToken");
    if (stored) return stored;
  }

  if (cachedToken) return cachedToken;
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          password: "adminpassword",
        }),
      });

      if (!res.ok) return null;

      const json = await res.json();
      const token = json?.data?.accessToken || null;
      if (token) {
        cachedToken = token;
        if (typeof window !== "undefined") {
          localStorage.setItem("pos_access_token", token);
        }
      }
      return token;
    } catch {
      return null;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

/**
 * Universal fetch wrapper for backend NestJS endpoints with token injection and error handling.
 */
export async function backendFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http")
    ? path
    : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      503,
      "Cannot connect to backend server. Make sure it is running on port 4000."
    );
  }

  // If token expired (401), clear cached token and try once more with freshly logged-in token
  if (res.status === 401 && token) {
    cachedToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("pos_access_token");
      localStorage.removeItem("accessToken");
    }
    const freshToken = await getAuthToken();
    if (freshToken) {
      headers["Authorization"] = `Bearer ${freshToken}`;
      try {
        res = await fetch(url, {
          ...options,
          headers,
        });
      } catch {
        throw new ApiError(503, "Cannot connect to backend server.");
      }
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      json?.message ||
      json?.errors?.[0]?.message ||
      json?.error ||
      res.statusText ||
      "Request failed";
    throw new ApiError(res.status, message);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}
