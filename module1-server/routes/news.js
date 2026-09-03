const express = require("express");
const router = express.Router();
const { fetchAllFeeds, FEED_STATUS } = require("../services/rssFetcher");
const store = require("../services/newsStore");
const { processUnprocessed } = require("../services/sentimentService");

/**
 * GET /api/news
 * Returns the current stored headline list (contract shape).
 * Does NOT trigger a fetch — fast, always available for the frontend.
 */
router.get("/news", (req, res) => {
  res.json({
    count: store.count(),
    lastFetchedAt: store.getLastFetchedAt(),
    items: store.getAll(),
  });
});

/**
 * GET /api/news/:id
 * Single headline lookup — useful for A2/B to inspect one item.
 */
router.get("/news/:id", (req, res) => {
  const item = store.getById(req.params.id);
  if (!item) return res.status(404).json({ error: "Headline not found" });
  res.json(item);
});

/**
 * POST /api/news/refresh
 * Pulls all RSS feeds now, merges into the store, returns the fresh count.
 * Call this on a timer (e.g. every few minutes) or manually for the demo.
 */
router.post("/news/refresh", async (req, res) => {
  try {
    const items = await fetchAllFeeds();
    store.upsertMany(items);

    // Fire-and-forget: kick off AI analysis without blocking the HTTP response,
    // consistent with the server.js auto-refresh interval behavior.
    processUnprocessed().catch((err) =>
      console.error("[routes/news] Post-refresh sentiment analysis failed:", err.message)
    );

    res.json({
      ok: true,
      fetched: items.length,
      totalStored: store.count(),
      lastFetchedAt: store.getLastFetchedAt(),
      feedStatus: FEED_STATUS,
    });
  } catch (err) {
    console.error("[routes/news] refresh failed:", err.message);
    res.status(500).json({ ok: false, error: "Failed to refresh feeds" });
  }
});

/**
 * POST /api/news/analyze
 * Manually trigger a sentiment/explainer pass over currently unprocessed
 * headlines (sentiment === null). Useful for the demo ("watch it fill in
 * live") and for debugging A2 without waiting for the next auto-refresh.
 * Runs synchronously and returns once the batch(es) are done.
 */
router.post("/news/analyze", async (req, res) => {
  try {
    const result = await processUnprocessed();
    res.json({ ...result, totalStored: store.count() });
  } catch (err) {
    console.error("[routes/news] analyze failed:", err.message);
    res.status(500).json({ ok: false, error: "Failed to analyze headlines" });
  }
});

module.exports = router;
