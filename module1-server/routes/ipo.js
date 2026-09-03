const express = require("express");
const router = express.Router();
const ipoStore = require("../services/ipoStore");

/**
 * GET /api/ipo
 * Live IPO Intelligence data sourced directly from NSE India's public API.
 * Requires no API key — hits NSE's own public endpoint directly.
 *
 * Query params:
 *   status  - filter to one of: open | upcoming | closed | listed
 *   refresh - "true" to bypass the 5-minute cache and hit the API now
 */
router.get("/ipo", async (req, res) => {
  const { status, refresh } = req.query;
  try {
    const items = await ipoStore.getAllEnriched({ forceRefresh: refresh === "true" });
    const filtered = status ? ipoStore.getByStatus(status, items) : items;

    res.json({
      count: filtered.length,
      lastFetchedAt: ipoStore.getLastSeededAt(),
      source: "nseindia.com",
      items: filtered,
    });
  } catch (err) {
    console.error(`Error in GET /api/ipo:`, err.message);
    res.status(502).json({
      error: "Failed to fetch IPO data from NSE",
      detail: err.message,
    });
  }
});

module.exports = router;
