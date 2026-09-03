require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const newsRoutes = require("./routes/news");
const ipoRoutes = require("./routes/ipo");
const fiiDiiRoutes = require("./routes/fiidii");
const authRoutes = require("./routes/auth");
const db = require("./services/db");

const store = require("./services/newsStore");
const ipoStore = require("./services/ipoStore");
const fiiDiiService = require("./services/fiiDiiService");
const { fetchAllFeeds, FEED_STATUS } = require("./services/rssFetcher");
const { processUnprocessed } = require("./services/sentimentService");

const app = express();
const PORT = process.env.PORT || 4000;

// Configuration constants with env fallback
const REFRESH_INTERVAL_MS = process.env.REFRESH_INTERVAL_MS
  ? parseInt(process.env.REFRESH_INTERVAL_MS, 10)
  : 60 * 1000;

const FIIDII_REFRESH_INTERVAL_MS = process.env.FIIDII_REFRESH_INTERVAL_MS
  ? parseInt(process.env.FIIDII_REFRESH_INTERVAL_MS, 10)
  : 15 * 60 * 1000;

// Run Neon DB migrations for users + sessions tables on startup
if (process.env.DATABASE_URL) {
  db.runMigrations().catch((err) =>
    console.warn(`[server] DB migration warning: ${err.message}`)
  );
}

// --- Security hardening -----------------------------------------------
// Security headers (CSP left permissive by default since this API is
// consumed by a separate frontend origin, not serving HTML itself).
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: if ALLOWED_ORIGINS is set in .env (comma-separated), only those
// origins are allowed. If unset, falls back to allow-all so nothing
// breaks for local dev / before you've configured it.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(
  cors(
    allowedOrigins
      ? {
          origin: (origin, callback) => {
            // Allow non-browser requests (no origin header, e.g. curl/health checks)
            if (!origin || allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            callback(new Error("Not allowed by CORS"));
          },
        }
      : {}
  )
);

// Cap request body size to prevent oversized-payload abuse
app.use(express.json({ limit: "1mb" }));

// General rate limit: 100 requests / minute per IP across the API
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use("/api", generalLimiter);

// Stricter limit on auth (brute-force / token-spam protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again later." },
});
app.use("/api/auth", authLimiter);

// Stricter limit on refresh endpoints (they trigger outbound calls to
// external services — NSE, RSS feeds, Gemini/Groq — so abuse here has
// a real cost, not just server load).
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh requests. Please wait before retrying." },
});
app.use("/api/news/refresh", refreshLimiter);
// -------------------------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    storedHeadlines: store.count(),
    lastFetchedAt: store.getLastFetchedAt(),
    feedStatus: FEED_STATUS,
    ipo: {
      source: "nseindia.com",
      cachedCount: ipoStore.count(),
      lastFetchedAt: ipoStore.getLastSeededAt(),
      lastError: ipoStore.getLastError(),
    },
    fiiDii: {
      source: "nseindia.com",
      historyCount: fiiDiiService.historyCount(),
      lastFetchedAt: fiiDiiService.getLastFetchedAt(),
      lastError: fiiDiiService.getLastError(),
    },
  });
});

app.use("/api", authRoutes);
app.use("/api", newsRoutes);
app.use("/api", ipoRoutes);
app.use("/api", fiiDiiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function initialFetch() {
  console.log("[server] Fetching RSS feeds on startup...");
  const items = await fetchAllFeeds();
  store.upsertMany(items);
  console.log(`[server] Loaded ${items.length} headlines (${store.count()} stored).`);

  // Fire-and-forget: don't block server startup on Gemini calls.
  processUnprocessed().catch((err) =>
    console.error("[server] Initial sentiment analysis failed:", err.message)
  );

  // Fire-and-forget: warm up the FII/DII history store from NSE right
  // away so the dashboard has real data on the very first page load
  // instead of waiting for the first request to trigger it.
  fiiDiiService
    .refreshFromNse({ forceRefresh: true })
    .then((record) =>
      console.log(
        `[server] FII/DII: fetched latest NSE session (${record.date}) — FII net ₹${record.fiiNetCr} Cr, DII net ₹${record.diiNetCr} Cr.`
      )
    )
    .catch((err) =>
      console.error(
        "[server] Initial FII/DII fetch from NSE failed (will keep retrying):",
        err.message
      )
    );
}

initialFetch().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] Module 1 news-ingestion API running on port ${PORT}`);
    console.log(`[server]   GET  /api/news          - list stored headlines`);
    console.log(`[server]   GET  /api/news/:id       - single headline`);
    console.log(`[server]   POST /api/news/refresh   - re-fetch RSS now`);
    console.log(`[server]   GET  /api/ipo            - live IPO data from NSE India (no key needed)`);
    console.log(`[server]   GET  /api/fii-dii?days=15 - FII/DII daily net flows (live from NSE)`);
  });

  if (REFRESH_INTERVAL_MS > 0) {
    setInterval(async () => {
      try {
        const items = await fetchAllFeeds();
        store.upsertMany(items);
        console.log(`[server] Auto-refresh: ${items.length} headlines fetched.`);
        processUnprocessed().catch((err) =>
          console.error("[server] Auto-refresh sentiment analysis failed:", err.message)
        );
      } catch (err) {
        console.error("[server] Auto-refresh failed:", err.message);
      }
    }, REFRESH_INTERVAL_MS);
  }

  if (FIIDII_REFRESH_INTERVAL_MS > 0) {
    setInterval(() => {
      fiiDiiService
        .refreshFromNse()
        .then((result) => {
          if (!result.skipped) {
            console.log(
              `[server] FII/DII auto-refresh: fetched ${result.date} from NSE.`
            );
          }
        })
        .catch((err) =>
          console.error("[server] FII/DII auto-refresh failed:", err.message)
        );
    }, FIIDII_REFRESH_INTERVAL_MS);
  }
});
