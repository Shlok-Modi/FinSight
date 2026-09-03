// Client-side auth helpers — wraps /api/auth/* calls and manages the
// JWT token in localStorage.

const TOKEN_KEY = "finsight_auth_token";

/** Store token in localStorage */
export function saveToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Get stored token */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

/** Clear stored token */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Authorization header for API calls */
function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Sign in with a Google ID token from the GSI popup.
 * Returns { token, user } on success; throws on failure.
 */
export async function signInWithGoogle(idToken) {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.error || `Auth failed (${res.status})`);
  }
  saveToken(data.token);
  return data; // { token, user }
}

/**
 * Restore session on page load. Returns user if token is valid, null otherwise.
 */
export async function getMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth/me", {
      headers: authHeader(),
    });
    if (!res.ok) {
      clearToken();
      return null;
    }
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

/**
 * Sign out — deletes session from DB and clears local token.
 */
export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: authHeader(),
      });
    } catch {
      // Best-effort — clear local token regardless
    }
  }
  clearToken();
}
