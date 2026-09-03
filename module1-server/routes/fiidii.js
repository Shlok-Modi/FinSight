const express = require("express");
const router = express.Router();
const fiiDiiService = require("../services/fiiDiiService");

/**
 * Tokenizer for CSV parsing in memory
 */
function tokenizeCsv(content) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\r") {
      // ignore
    } else if (ch === "\n") {
      row.push(cur.trim());
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

function canonicalHeaderKey(cell) {
  const clean = cell.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.includes("categ")) return "category";
  if (clean === "date") return "date";
  if (clean.includes("buy")) return "buyValue";
  if (clean.includes("sell")) return "sellValue";
  if (clean.includes("net")) return "netValue";
  return null;
}

function parseCsvText(raw) {
  const cleanRaw = raw.replace(/^\uFEFF/, "");
  const allRows = tokenizeCsv(cleanRaw);
  if (allRows.length < 2) {
    throw new Error("No CSV data rows found");
  }

  const headerCells = allRows[0];
  const keys = headerCells.map(canonicalHeaderKey);

  if (!keys.includes("category") || !keys.includes("date")) {
    throw new Error(`Unrecognized CSV headers: ${headerCells.join(", ")}`);
  }

  const rows = [];
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i];
    if (cells.every((c) => c === "")) continue;
    const row = {};
    keys.forEach((key, idx) => {
      if (key) row[key] = cells[idx];
    });
    rows.push(row);
  }
  return rows;
}

/**
 * GET /api/fii-dii?days=30&from=2026-05-01&to=2026-07-31
 * Query params:
 *   days    - how many trading days to return (1-365, or "all", default 30)
 *   from    - start date YYYY-MM-DD
 *   to      - end date YYYY-MM-DD
 *   refresh - "true" to force a fresh hit to NSE
 */
router.get("/fii-dii", async (req, res) => {
  const rawDays = req.query.days;
  let daysParam = 30;
  if (rawDays === "all" || rawDays === "ALL") {
    daysParam = "all";
  } else if (rawDays) {
    daysParam = Math.min(Math.max(Number(rawDays) || 30, 1), 365);
  }

  const fromDate = req.query.from || null;
  const toDate = req.query.to || null;
  const forceRefresh = req.query.refresh === "true";

  try {
    await fiiDiiService.refreshFromNse({ forceRefresh });
  } catch (err) {
    console.error("[routes/fiidii] NSE refresh failed:", err.message);
  }

  const options = { days: daysParam, fromDate, toDate };
  const data = fiiDiiService.getFlows(options);
  const summary = fiiDiiService.getSummary(options);
  const lastError = fiiDiiService.getLastError();

  if (data.length === 0) {
    return res.status(502).json({
      error: "No FII/DII data available yet from NSE.",
      detail:
        lastError ||
        "Initial fetch from NSE has not succeeded yet. It will keep retrying automatically.",
    });
  }

  res.json({
    count: data.length,
    summary,
    data,
    source: "nseindia.com",
    lastFetchedAt: fiiDiiService.getLastFetchedAt(),
    lastError,
  });
});

/**
 * POST /api/fii-dii/import
 * Imports official NSE CSV text or structured JSON array into history.
 * Body: { csvText: string } OR { records: Array }
 */
router.post("/fii-dii/import", (req, res) => {
  try {
    const { csvText, records } = req.body;
    let result = null;

    if (csvText) {
      const rows = parseCsvText(csvText);
      result = fiiDiiService.importRecords(rows);
    } else if (Array.isArray(records)) {
      result = fiiDiiService.importRecords(records);
    } else {
      return res.status(400).json({ error: "Missing csvText or records array in request body." });
    }

    res.json({
      ok: true,
      importedDays: result.imported,
      skippedRows: result.skipped,
      errors: result.errors,
      totalStoredDays: fiiDiiService.historyCount(),
    });
  } catch (err) {
    console.error("[routes/fiidii] Import error:", err.message);
    res.status(400).json({ error: "Failed to import FII/DII data.", detail: err.message });
  }
});

module.exports = router;
