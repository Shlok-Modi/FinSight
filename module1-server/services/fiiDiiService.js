// FII/DII Flow Tracking — backed by NSE India's own public
// "fiidiiTradeReact" endpoint (the same one nseindia.com/reports/fii-dii
// calls). No API key, no quota wall — but it's an UNDOCUMENTED endpoint,
// same caveats as services/ipoStore.js:
//   - NSE requires browser-like headers + a session cookie obtained by
//     hitting the homepage first (plain fetch without this gets 401/403).
//   - Field names below are based on widely-used community reverse-
//     engineering of this endpoint (nsepython, various OSS scrapers), NOT
//     verified live from this sandbox (nseindia.com is outside this
//     environment's allowed network list). On first real run,
//     RAW_SHAPE_LOGGED will dump one raw record to the console — if the
//     numbers look wrong, check that log and adjust normalizeRecord below.
//   - This endpoint only ever returns the CURRENT/latest trading day's
//     two rows (one FII/FPI, one DII) — NSE does not expose a ready-made
//     historical JSON series here. So instead of guessing a historical
//     endpoint, this service builds its own history by fetching the
//     latest day and appending it to a small local JSON store
//     (data/fiiDiiHistory.json) every time it runs. Over days/weeks this
//     naturally accumulates a real, NSE-sourced daily series.
//   - No seeded/fabricated fallback data, ever. If NSE blocks us or
//     changes shape, we log a clear error and serve whatever real history
//     we've already accumulated (or an empty set on first run) — never
//     invented numbers.

const fs = require("fs");
const path = require("path");

const NSE_BASE = "https://www.nseindia.com";
const FII_DII_URL = `${NSE_BASE}/api/fiidiiTradeReact`;
const REQUEST_TIMEOUT_MS = 10000;
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000; // don't hit NSE more than once per 5 min
const MAX_HISTORY_RECORDS = 1000; // ~4 years of trading days, plenty for this app

function getFlows(options = {}) {
  loadHistoryFromDisk();
  
  let result = [...history];
  
  // Handle options as number for backwards compatibility (e.g. getFlows(15))
  let days = typeof options === 'number' || typeof options === 'string' ? options : options.days;
  const fromDate = typeof options === 'object' ? options.fromDate : null;
  const toDate = typeof options === 'object' ? options.toDate : null;

  if (fromDate) {
    result = result.filter((r) => r.date >= fromDate);
  }
  if (toDate) {
    result = result.filter((r) => r.date <= toDate);
  }

  if (!fromDate && !toDate) {
    if (days === 'all' || days === 'ALL' || Number(days) === 0) {
      return result;
    }
    const numDays = Number(days) || 15;
    result = result.slice(-numDays);
  }

  return result;
}

/** Convenience summary: latest real day's net figures + N-day cumulative
 * over whatever real history is available (may be fewer than N days). */
function getSummary(options = {}) {
  const flows = getFlows(options);
  loadHistoryFromDisk();
  
  const latest = flows[flows.length - 1] || history[history.length - 1] || { fiiNetCr: 0, diiNetCr: 0, date: null };
  const cumulativeFii = flows.reduce((sum, f) => sum + (f.fiiNetCr || 0), 0);
  const cumulativeDii = flows.reduce((sum, f) => sum + (f.diiNetCr || 0), 0);

  // Month-to-date calculation (for the month of the latest record)
  let mtdFii = 0;
  let mtdDii = 0;
  if (latest && latest.date) {
    const latestMonth = latest.date.substring(0, 7); // "YYYY-MM"
    const mtdFlows = history.filter((f) => f.date && f.date.startsWith(latestMonth));
    mtdFii = mtdFlows.reduce((sum, f) => sum + (f.fiiNetCr || 0), 0);
    mtdDii = mtdFlows.reduce((sum, f) => sum + (f.diiNetCr || 0), 0);
  }

  // Find day with max net FII buying and max net DII buying in the current flow window
  let maxFii = null;
  let maxDii = null;
  for (const f of flows) {
    if (!maxFii || (f.fiiNetCr || 0) > (maxFii.fiiNetCr || 0)) maxFii = f;
    if (!maxDii || (f.diiNetCr || 0) > (maxDii.diiNetCr || 0)) maxDii = f;
  }

  return {
    latestDate: latest.date,
    latestFiiNetCr: latest.fiiNetCr,
    latestDiiNetCr: latest.diiNetCr,
    cumulativeFiiNetCr: Math.round(cumulativeFii * 100) / 100,
    cumulativeDiiNetCr: Math.round(cumulativeDii * 100) / 100,
    mtdFiiNetCr: Math.round(mtdFii * 100) / 100,
    mtdDiiNetCr: Math.round(mtdDii * 100) / 100,
    maxFiiDay: maxFii ? { date: maxFii.date, fiiNetCr: maxFii.fiiNetCr } : null,
    maxDiiDay: maxDii ? { date: maxDii.date, diiNetCr: maxDii.diiNetCr } : null,
    windowDays: flows.length,
    totalStoredDays: history.length,
  };
}

const DATA_DIR = path.join(__dirname, "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "fiiDiiHistory.json");

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/reports/fii-dii",
};

let sessionCookie = null;
let history = null; // in-memory mirror of HISTORY_FILE, array oldest -> newest
let lastFetchedAt = null;
let lastError = null;
let inFlightFetch = null;
let rawShapeLogged = false;

/** Skip weekends -- NSE/BSE don't trade Sat/Sun. Used only to sanity-check
 * dates coming back from NSE, never to invent data for skipped days. */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadHistoryFromDisk() {
  if (history !== null) return history;
  ensureDataDir();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    history = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // File doesn't exist yet (first run) or is corrupt — start clean.
    history = [];
  }
  return history;
}

function persistHistoryToDisk() {
  ensureDataDir();
  const trimmed = history.slice(-MAX_HISTORY_RECORDS);
  history = trimmed;
  // Write atomically (temp file + rename) so a crash mid-write can't
  // corrupt the store.
  const tmpFile = `${HISTORY_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(trimmed, null, 2), "utf8");
  fs.renameSync(tmpFile, HISTORY_FILE);
}

/** Upsert one day's record into history (overwrite same-date record if
 * NSE re-publishes/revises the same session, e.g. provisional -> final). */
function upsertRecord(record) {
  loadHistoryFromDisk();
  const idx = history.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    history[idx] = record;
  } else {
    history.push(record);
    history.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  persistHistoryToDisk();
}

// NSE requires a valid session cookie from a real page hit before the
// /api/* endpoints will respond (otherwise 401/403). Reused across calls
// until rejected, same pattern as ipoStore.js.
async function ensureSession() {
  if (sessionCookie) return sessionCookie;

  const res = await fetch(NSE_BASE, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error(
      "Could not obtain an NSE session cookie (no Set-Cookie header on homepage response). NSE may be blocking this environment's IP or User-Agent."
    );
  }
  sessionCookie = setCookie;
  return sessionCookie;
}

/** Parse NSE's "12,345.67" style strings (with commas, sometimes a
 * trailing/leading sign) into a plain number. */
function parseNseNumber(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(String(val).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

/** NSE dates on this endpoint come as "DD-Mon-YYYY" (e.g. "30-Jul-2026").
 * Convert to ISO YYYY-MM-DD for consistency with the rest of the app. */
function parseNseDate(val) {
  if (!val) return null;
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const match = String(val).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const [, day, monAbbr, year] = match;
  const month = months[monAbbr.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

/** Category strings from NSE sometimes carry a trailing "*" (provisional
 * marker) or vary in casing/spacing, e.g. "FII/FPI *", "DII **". */
function normalizeCategory(raw) {
  const clean = String(raw || "").replace(/\*/g, "").trim().toUpperCase();
  if (clean.includes("FII") || clean.includes("FPI")) return "FII";
  if (clean.includes("DII")) return "DII";
  return null;
}

function normalizeRecord(raw) {
  if (!rawShapeLogged) {
    console.log(
      "[fiiDiiService] Sample raw NSE record from fiidiiTradeReact (verify field mapping against this):",
      JSON.stringify(raw)
    );
    rawShapeLogged = true;
  }

  const category = normalizeCategory(raw.category);
  const date = parseNseDate(raw.date);
  const buyValue = parseNseNumber(raw.buyValue);
  const sellValue = parseNseNumber(raw.sellValue);
  let netValue = parseNseNumber(raw.netValue);
  if (netValue === null && buyValue !== null && sellValue !== null) {
    netValue = Math.round((buyValue - sellValue) * 100) / 100;
  }

  return { category, date, buyValue, sellValue, netValue };
}

/**
 * Groups a flat list of raw {category, date, buyValue, sellValue, netValue}
 * rows (e.g. parsed straight out of NSE's own downloadable CSV, which is
 * exactly two rows — "FII/FPI" and "DII" — per trading date) into full
 * daily records and upserts each one into the real history store.
 *
 * This is how past/historical data gets added: NSE's live JSON endpoint
 * only ever returns *today's* figures, but NSE's own site lets you
 * download a CSV of past sessions from https://www.nseindia.com/reports/fii-dii
 * (or the archives page). Importing that official export is the only way
 * to get genuinely correct historical numbers — anything else would be a
 * guess dressed up as data, which we don't do.
 *
 * Returns { imported, skipped, errors } for the caller (e.g. an import
 * script) to report back to whoever ran it.
 */
function importRecords(rawRows) {
  const normalized = rawRows.map(normalizeRecord).filter((r) => r.category && r.date);

  const byDate = new Map();
  for (const row of normalized) {
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    byDate.get(row.date)[row.category] = row;
  }

  let imported = 0;
  const errors = [];
  for (const [date, rows] of byDate.entries()) {
    const fii = rows.FII;
    const dii = rows.DII;
    if (!fii || !dii) {
      errors.push(
        `${date}: missing ${!fii ? "FII/FPI" : "DII"} row in the import — skipped (need both per date).`
      );
      continue;
    }
    upsertRecord({
      date,
      fiiNetCr: fii.netValue,
      diiNetCr: dii.netValue,
      fiiBuyCr: fii.buyValue,
      fiiSellCr: fii.sellValue,
      diiBuyCr: dii.buyValue,
      diiSellCr: dii.sellValue,
      fetchedAt: new Date().toISOString(),
      source: "nse-csv-import",
    });
    imported++;
  }

  return { imported, skipped: rawRows.length - normalized.length, errors };
}

async function fetchLatestFromNse() {
  const cookie = await ensureSession();

  const res = await fetch(FII_DII_URL, {
    headers: { ...BROWSER_HEADERS, Cookie: cookie },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 401 || res.status === 403) {
    sessionCookie = null; // force a fresh session next time
    throw new Error(
      `NSE rejected the request with HTTP ${res.status} for ${FII_DII_URL}. Their site likely fingerprints/blocks non-browser or datacenter-IP traffic. If this keeps happening on your deployment host, test the same request from your own machine/browser network — NSE is known to block many cloud/server IP ranges outright.`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NSE returned HTTP ${res.status} for ${FII_DII_URL}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : null;
  if (!list || list.length === 0) {
    throw new Error(
      `Unexpected/empty response shape from NSE at ${FII_DII_URL}. Raw keys: ${Object.keys(data || {}).join(", ")}`
    );
  }

  const normalized = list.map(normalizeRecord);
  const fii = normalized.find((r) => r.category === "FII");
  const dii = normalized.find((r) => r.category === "DII");

  if (!fii || !dii || !fii.date) {
    throw new Error(
      `Could not find both FII and DII rows in NSE response (got categories: ${normalized
        .map((r) => r.category)
        .join(", ")}). NSE may have changed this endpoint's shape — check the raw record logged above.`
    );
  }

  const recordDate = new Date(fii.date);
  if (!Number.isNaN(recordDate.getTime()) && isWeekend(recordDate)) {
    console.warn(
      `[fiiDiiService] NSE returned a weekend date (${fii.date}) — using it as-is since NSE is the source of truth, but flagging in case this indicates a parsing bug.`
    );
  }

  return {
    date: fii.date,
    fiiNetCr: fii.netValue,
    diiNetCr: dii.netValue,
    fiiBuyCr: fii.buyValue,
    fiiSellCr: fii.sellValue,
    diiBuyCr: dii.buyValue,
    diiSellCr: dii.sellValue,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Hits NSE for the latest trading day's FII/DII figures and appends/
 * updates it in the local history store. Safe to call often — internally
 * rate-limited so it won't hammer NSE (respects MIN_REFRESH_GAP_MS unless
 * forceRefresh is set).
 */
async function refreshFromNse({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && lastFetchedAt && now - lastFetchedAt < MIN_REFRESH_GAP_MS) {
    return { skipped: true, reason: "recently refreshed" };
  }
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = fetchLatestFromNse()
    .then((record) => {
      upsertRecord(record);
      lastFetchedAt = Date.now();
      lastError = null;
      return record;
    })
    .catch((err) => {
      lastFetchedAt = Date.now();
      lastError = err.message;
      throw err;
    })
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}



function getLastFetchedAt() {
  return lastFetchedAt ? new Date(lastFetchedAt).toISOString() : null;
}

function getLastError() {
  return lastError;
}

function historyCount() {
  loadHistoryFromDisk();
  return history.length;
}

module.exports = {
  getFlows,
  getSummary,
  refreshFromNse,
  importRecords,
  getLastFetchedAt,
  getLastError,
  historyCount,
};
