const express = require("express");
const router = express.Router();
const auth = require("../services/authService");

/**
 * GET /api/auth/config
 * Returns public auth config needed by the frontend (e.g. Google Client ID).
 * Safe to expose — Client ID is public by design (it's embedded in every page).
 */
router.get("/auth/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    configured: !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE" &&
      process.env.DATABASE_URL &&
      process.env.DATABASE_URL !== "YOUR_NEON_DATABASE_URL_HERE" &&
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET !== "YOUR_JWT_SECRET_HERE"
    ),
  });
});

/**
 * POST /api/auth/google
 * Body: { idToken: string }
 *
 * Called by the frontend after the Google Identity Services popup returns
 * a credential (ID token). We verify it with Google, upsert the user in
 * Neon, create a session, and return a JWT + user profile.
 */
router.post("/auth/google", async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: "idToken is required." });
  }

  try {
    // 1. Verify the token with Google
    const profile = await auth.verifyGoogleToken(idToken);

    // 2. Upsert the user in Neon DB
    const user = await auth.upsertUser(profile);

    // 3. Create a session + sign JWT
    const token = await auth.createSession(user.id);

    console.log(`[auth] Sign-in: ${user.email} (id=${user.id})`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error("[auth] Google sign-in failed:", err.message);

    if (
      err.message.includes("GOOGLE_CLIENT_ID") ||
      err.message.includes("DATABASE_URL") ||
      err.message.includes("JWT_SECRET")
    ) {
      return res.status(503).json({
        error: "Auth not configured yet.",
        detail: err.message,
      });
    }

    res.status(401).json({ error: "Google sign-in failed.", detail: err.message });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 *
 * Returns the signed-in user's profile. Used on page load to restore
 * session from a token stored in localStorage.
 */
router.get("/auth/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  try {
    const user = await auth.verifySession(token);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 *
 * Deletes the session from the DB. Client should also clear its localStorage.
 */
router.post("/auth/logout", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  try {
    await auth.deleteSession(token);
    console.log("[auth] Session deleted (logout).");
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true });
  }
});

module.exports = router;
