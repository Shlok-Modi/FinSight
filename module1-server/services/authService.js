// Auth service: Google ID token verification, user upsert, JWT session management.
//
// Required env vars (add to .env):
//   GOOGLE_CLIENT_ID   — from Google Cloud Console OAuth 2.0 credentials
//   JWT_SECRET         — any long random string, e.g. openssl rand -hex 32
//   JWT_EXPIRES_IN     — e.g. "7d" (default)

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

// Lazy-init OAuth client so startup doesn't fail before .env is filled in
let _googleClient = null;
function getGoogleClient() {
  if (_googleClient) return _googleClient;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") {
    throw new Error(
      "[auth] GOOGLE_CLIENT_ID is not set. Add it to .env to enable Google Sign-In."
    );
  }
  _googleClient = new OAuth2Client(clientId);
  return _googleClient;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "YOUR_JWT_SECRET_HERE") {
    throw new Error("[auth] JWT_SECRET is not set. Add a random secret to .env.");
  }
  return secret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Verify a Google ID token (received from the GSI popup on the client).
 * Returns { googleId, email, name, picture } on success, throws on failure.
 */
async function verifyGoogleToken(idToken) {
  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Empty payload from Google token verification.");
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture || null,
  };
}

/**
 * Insert a new user or update their profile if they already exist.
 * Always updates last_login_at. Returns the full user row.
 */
async function upsertUser({ googleId, email, name, picture }) {
  const rows = await db.query`
    INSERT INTO users (google_id, email, name, picture, last_login_at)
    VALUES (${googleId}, ${email}, ${name}, ${picture}, NOW())
    ON CONFLICT (google_id) DO UPDATE SET
      email         = EXCLUDED.email,
      name          = EXCLUDED.name,
      picture       = EXCLUDED.picture,
      last_login_at = NOW()
    RETURNING id, google_id, email, name, picture, created_at, last_login_at
  `;
  return rows[0];
}

/**
 * Create a new session row in the DB and sign a JWT containing the session ID.
 * The JWT is the session token returned to the client.
 */
async function createSession(userId) {
  const sessionId = uuidv4();
  const expiresAt = new Date();
  const days = parseInt(JWT_EXPIRES_IN) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  await db.query`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()})
  `;

  const token = jwt.sign({ sessionId, userId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });

  return token;
}

/**
 * Verify a JWT session token from the client (sent as Authorization: Bearer <token>).
 * Checks signature + DB session existence + expiry.
 * Returns the full user row on success, throws on any failure.
 */
async function verifySession(token) {
  if (!token) throw new Error("No token provided.");

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (err) {
    throw new Error(`Invalid or expired token: ${err.message}`);
  }

  const { sessionId, userId } = payload;

  const rows = await db.query`
    SELECT s.id, s.expires_at, u.id as user_id, u.email, u.name, u.picture, u.google_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId}
      AND s.user_id = ${userId}
      AND s.expires_at > NOW()
  `;

  if (rows.length === 0) {
    throw new Error("Session not found or expired. Please sign in again.");
  }

  const row = rows[0];
  return {
    id: row.user_id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture,
  };
}

/**
 * Delete a session from the DB (sign out).
 */
async function deleteSession(token) {
  if (!token) return;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    await db.query`DELETE FROM sessions WHERE id = ${payload.sessionId}`;
  } catch {
    // Token invalid — session may already be gone, nothing to do
  }
}

/**
 * Middleware factory: attaches req.user if a valid Bearer token is present.
 * Does NOT block unauthenticated requests — routes that require auth must
 * check req.user themselves.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  verifySession(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => {
      // Bad token — just skip, don't block
      next();
    });
}

/**
 * Middleware: requires a valid session. Returns 401 if not authenticated.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  verifySession(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((err) => {
      res.status(401).json({ error: err.message });
    });
}

module.exports = {
  verifyGoogleToken,
  upsertUser,
  createSession,
  verifySession,
  deleteSession,
  optionalAuth,
  requireAuth,
};
