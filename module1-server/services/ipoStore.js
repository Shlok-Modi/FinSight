// IPO Intelligence — backed by NSE India's own public "all-upcoming-issues"
// endpoint (the same one nseindia.com's website calls). No API key, no
// quota wall — but it's an UNDOCUMENTED endpoint, so:
//   - NSE requires browser-like headers + a session cookie obtained by
//     hitting the homepage first (plain fetch without this gets a 401/403).
//   - Field names below are based on widely-used community reverse-
//     engineering of this endpoint, NOT verified live from this sandbox
//     (nseindia.com is outside this environment's allowed network list).
//     On first real run, RAW_SHAPE_LOGGED will dump one raw record to the
//     console — if `normalizeIpo` looks wrong, check that log and adjust
//     the field mapping below to match.
//   - No seeded/fabricated fallback data. If NSE blocks us or changes
//     shape, we throw a clear error rather than inventing IPOs.
//   - No GMP here either — NSE doesn't publish grey market premium (it's
//     not exchange data, it's unofficial). gmp stays null throughout.

const { enrichIposWithChittorgarhGmp } = require("./chittorgarhGmpService");

const NSE_BASE = "https://www.nseindia.com";
const UPCOMING_URL = `${NSE_BASE}/api/all-upcoming-issues?category=ipo`;
// CONFIRMED via browser DevTools (Network tab -> XHR) while browsing NSE's
// IPO page — this is the real endpoint, not a guess. Returns closed /
// recently-listed issues (mainboard + SME mixed) with real field names:
//   company / companyName, ipoStartDate, ipoEndDate, listingDate,
//   priceRange, securityType, symbol
const PAST_ISSUES_URL = `${NSE_BASE}/api/public-past-issues`;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 10000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/market-data/all-upcoming-issues-ipo",
};

let cachedIpos = null;
let lastFetchedAt = null;
let lastFetchError = null;
let inFlightFetch = null;
let sessionCookie = null;
let rawShapeLogged = {};

// NSE requires a valid session cookie from a real page hit before the
// /api/* endpoints will respond (otherwise 401). We fetch the homepage
// once, capture the Set-Cookie header, and reuse it until it's rejected.
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

function upperPrice(priceBand) {
  if (!priceBand) return null;
  const nums = String(priceBand).match(/[\d.]+/g);
  if (!nums || nums.length === 0) return null;
  return parseFloat(nums[nums.length - 1]);
}

function normalizeStatus(raw) {
  // NSE's own status strings vary by record; normalize to our 4 buckets.
  const s = String(raw || "").toLowerCase();
  if (s.includes("open") || s.includes("active")) return "open";
  if (s.includes("closed")) return "closed";
  if (s.includes("list")) return "listed";
  return "upcoming";
}

// public-past-issues marks SME issues explicitly via securityType === "SME".
// We exclude SME entirely per product requirement (mainboard IPOs only).
function isSmeRecord(raw) {
  return String(raw.securityType || "").toUpperCase() === "SME";
}

function normalizeIpo(raw, sourceHint) {
  if (!rawShapeLogged[sourceHint]) {
    console.log(
      `[ipoStore] Sample raw NSE record from ${sourceHint} (verify field mapping against this):`,
      JSON.stringify(raw)
    );
    rawShapeLogged[sourceHint] = true;
  }

  if (sourceHint === "past-issues") {
    // Confirmed real field shape from public-past-issues:
    //   company / companyName, ipoStartDate, ipoEndDate, listingDate,
    //   priceRange (e.g. "Rs.65 to Rs.69"), securityType, symbol
    const hasListed = raw.listingDate && raw.listingDate !== "-";
    return {
      id: raw.symbol || raw.company || raw.companyName,
      name: raw.company || raw.companyName || raw.symbol,
      symbol: raw.symbol || null,
      type: "Mainboard", // SME already filtered out before this runs
      status: hasListed ? "listed" : "closed",
      openDate: raw.ipoStartDate || null,
      closeDate: raw.ipoEndDate || null,
      listingDate: hasListed ? raw.listingDate : null,
      priceBand: raw.priceRange || null,
      issueSizeCr: null, // not present on this endpoint
      // NSE doesn't publish GMP — it's grey-market/unofficial data, not
      // exchange data. We never fabricate it.
      gmp: null,
      gmpPercent: null,
      estListing: null,
      gainPercent: null,
      minQty: null,
      minAmount: null,
      link: `https://www.nseindia.com/market-data/all-upcoming-issues-ipo`,
      gmpSources: [],
      gmpLastUpdatedAt: null,
    };
  }

  // "upcoming" source — field names here are still a community-sourced
  // best guess (see UPCOMING_URL comment); adjust against the console log
  // above if this endpoint's real shape differs once tested live.
  const priceBand =
    raw.issuePrice || raw.priceBand
      ? String(raw.issuePrice || raw.priceBand).includes("₹")
        ? raw.issuePrice || raw.priceBand
        : `₹${raw.issuePrice || raw.priceBand}`
      : null;

  return {
    id: raw.symbol || raw.companyName || raw.series,
    name: raw.companyName || raw.symbol,
    symbol: raw.symbol || null,
    type: "Mainboard", // SME already filtered out before this runs
    status: normalizeStatus(raw.status),
    openDate: raw.issueStartDate || raw.startDate || null,
    closeDate: raw.issueEndDate || raw.endDate || null,
    listingDate: raw.listingDate || null,
    priceBand,
    issueSizeCr: raw.issueSize ? parseFloat(String(raw.issueSize).replace(/[^0-9.]/g, "")) || null : null,
    gmp: null,
    gmpPercent: null,
    estListing: null,
    gainPercent:
      raw.gainOnListing ?? raw.lossOnListing ?? raw.listingGain ?? raw.gainLossPercent ?? null,
    minQty: raw.marketLot || raw.minQty || null,
    minAmount: null,
    link: `https://www.nseindia.com/market-data/all-upcoming-issues-ipo`,
    gmpSources: [],
    gmpLastUpdatedAt: null,
  };
}

async function fetchNseJson(url) {
  const cookie = await ensureSession();

  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Cookie: cookie },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 401 || res.status === 403) {
    sessionCookie = null; // force a fresh session next time
    throw new Error(
      `NSE rejected the request with HTTP ${res.status} for ${url}. Their site likely fingerprints/blocks non-browser or datacenter-IP traffic. Test this from your own machine — if it also fails there, NSE may need a real browser (Puppeteer) instead of plain fetch.`
    );
  }
  if (res.status === 404) {
    throw new Error(`NSE returned HTTP 404 for ${url} — this endpoint path is likely wrong/guessed incorrectly.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NSE returned HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : null;
  if (!list) {
    throw new Error(
      `Unexpected response shape from NSE at ${url} (no array found). Raw keys: ${Object.keys(data || {}).join(", ")}`
    );
  }
  return list;
}

async function doFullFetch() {
  const errors = [];
  let upcomingList = [];
  let pastList = [];

  try {
    upcomingList = (await fetchNseJson(UPCOMING_URL))
      .filter((r) => !isSmeRecord(r))
      .map((r) => normalizeIpo(r, "upcoming"));
  } catch (err) {
    console.error(`[ipoStore] upcoming/open fetch failed: ${err.message}`);
    errors.push(err.message);
  }

  try {
    pastList = (await fetchNseJson(PAST_ISSUES_URL))
      .filter((r) => !isSmeRecord(r))
      .map((r) => normalizeIpo(r, "past-issues"));
  } catch (err) {
    console.error(`[ipoStore] closed/listed fetch failed: ${err.message}`);
    errors.push(err.message);
  }

  const merged = [...upcomingList, ...pastList];

  // De-dupe by id, preferring the upcoming/open record if a company somehow
  // appears in both lists (e.g. listed same day).
  const byId = new Map();
  for (const ipo of merged) {
    if (!byId.has(ipo.id)) byId.set(ipo.id, ipo);
  }
  const deduped = Array.from(byId.values());

  if (deduped.length > 0) {
    cachedIpos = deduped;
    lastFetchedAt = Date.now();
    lastFetchError = errors.length > 0 ? `Partial failure: ${errors.join(" | ")}` : null;
  } else if (!cachedIpos) {
    throw new Error(errors.join(" | ") || "No IPO data available from NSE.");
  } else {
    lastFetchError = errors.join(" | ");
  }

  return cachedIpos;
}

async function getAllEnriched({ forceRefresh = false } = {}) {
  const now = Date.now();
  let baseIpos = cachedIpos;

  if (forceRefresh || !cachedIpos || !lastFetchedAt || now - lastFetchedAt >= CACHE_DURATION_MS) {
    if (!inFlightFetch) {
      inFlightFetch = doFullFetch()
        .catch((err) => {
          lastFetchError = err.message;
          throw err;
        })
        .finally(() => {
          inFlightFetch = null;
        });
    }
    baseIpos = await inFlightFetch;
  }

  // Enrich with live GMP directly from Chittorgarh.com
  try {
    return await enrichIposWithChittorgarhGmp(baseIpos);
  } catch (err) {
    console.warn(`[ipoStore] Chittorgarh GMP enrichment warning: ${err.message}`);
    return baseIpos;
  }
}

function getByStatus(status, items) {
  return items.filter((ipo) => ipo.status === status);
}

function getLastSeededAt() {
  return lastFetchedAt ? new Date(lastFetchedAt).toISOString() : null;
}

function getLastError() {
  return lastFetchError;
}

function count() {
  return cachedIpos ? cachedIpos.length : 0;
}

module.exports = {
  getAllEnriched,
  getByStatus,
  getLastSeededAt,
  getLastError,
  count,
};
