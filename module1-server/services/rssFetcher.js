const Parser = require("rss-parser");
const crypto = require("crypto");
const { detectTicker } = require("./tickerMap");

// ---------------------------------------------------------------------------
// RSS Parser — shared instance with realistic browser headers.
//
// rss-parser uses Node's native https.get (not fetch), so AbortController
// is not applicable. Timeout is enforced via Promise.race in fetchFeedWithRetry.
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 14000; // hard wall-clock timeout per attempt

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

// ---------------------------------------------------------------------------
// Feed definitions.
//
// Business Standard was removed: their entire RSS infrastructure returns
// HTTP 403 Forbidden for all automated clients (Cloudflare WAF), including
// requests with full browser headers. This is a permanent server-side block
// confirmed across every BS RSS endpoint — it cannot be worked around without
// a real browser or Cloudflare bypass.
//
// Replacement: The Hindu BusinessLine — comparable Indian market coverage
// with a publicly accessible RSS feed.
// ---------------------------------------------------------------------------
const FEEDS = [
  {
    source: "ET Markets",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  },
  {
    source: "Moneycontrol",
    url: "https://www.moneycontrol.com/rss/business.xml",
  },
  {
    source: "Livemint",
    url: "https://www.livemint.com/rss/markets",
  },
  {
    // Business Standard permanently blocks automated requests (HTTP 403 /
    // Cloudflare WAF). Replaced with BusinessLine for comparable coverage.
    source: "BusinessLine",
    url: "https://www.thehindubusinessline.com/markets/stock-markets/feeder/default.rss",
  },
  {
    // Google News, scoped to Indian stock-market queries. Acts as a broad
    // catch-all that picks up stories our fixed publisher list misses.
    source: "Google News (Markets)",
    url: "https://news.google.com/rss/search?q=Sensex+OR+Nifty+OR+NSE+OR+BSE+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
  },
  {
    source: "CNBC-TV18",
    url: "https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml",
  },
  // Zee Business removed: their RSS endpoint returns HTTP 403 for all
  // automated clients (Cloudflare WAF), same permanent block as Business
  // Standard. Google News (Markets) already surfaces Zee Business stories
  // via aggregation, so coverage isn't lost — just the dead retry cycle.
];

// ---------------------------------------------------------------------------
// Per-feed status map — available externally for /health and debug endpoints.
// ---------------------------------------------------------------------------
const FEED_STATUS = {};
FEEDS.forEach(({ source }) => {
  FEED_STATUS[source] = { ok: null, lastCheckedAt: null, error: null };
});

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------
const MAX_RETRIES = 3;           // total attempts per feed per cycle
const RETRY_BASE_DELAY_MS = 1000; // 1s → 2s → 4s exponential backoff

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a promise that rejects after `ms` milliseconds.
 * Used with Promise.race to enforce a hard timeout on rss-parser calls.
 */
function timeoutReject(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
}

/**
 * Google News RSS titles are formatted as "Headline - Publisher". Split
 * that out so the publisher becomes structured attribution instead of
 * noise inside the headline text (which otherwise hurts ticker detection
 * and cross-source dedup matching).
 *
 * Only applied to the Google News feed — other sources' titles sometimes
 * legitimately contain " - " as punctuation, so we don't touch those.
 */
function splitGoogleNewsTitle(rawTitle) {
  const lastDash = rawTitle.lastIndexOf(" - ");
  if (lastDash === -1) {
    return { headline: rawTitle, originalPublisher: null };
  }
  return {
    headline: rawTitle.slice(0, lastDash).trim(),
    originalPublisher: rawTitle.slice(lastDash + 3).trim(),
  };
}

/**
 * Stable id for a headline so re-fetching the same item doesn't create
 * duplicates. Based on the article URL (falls back to headline+source).
 */
function makeId(item, source) {
  const basis = item.link || `${source}:${item.title}`;
  return crypto.createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Cross-source near-duplicate detection.
//
// The same story often runs on multiple outlets with different headlines
// and different article URLs, so the exact-id dedup above (keyed on URL)
// lets duplicates through. This pass catches those by comparing normalized
// title token sets pairwise within the same fetch cycle and keeping only
// the earliest-published copy of each cluster.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "for",
  "with", "at", "by", "from", "as", "is", "are", "was", "were", "be",
  "this", "that", "it", "its", "after", "over", "amid", "amidst", "into",
  "up", "down", "vs", "says", "said",
]);

/** Lowercase, strip punctuation, drop stopwords -> token set for comparison. */
function titleTokens(headline) {
  return new Set(
    (headline || "")
      .toLowerCase()
      .replace(/[^a-z0-9%₹\s]/g, " ")
      .split(/\s+/)
      .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok))
  );
}

/** Jaccard similarity between two token sets, 0..1. */
function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.6; // >=60% token overlap counts as the same story

/**
 * Given a deduped, newest-first list of items, collapse near-duplicate
 * headlines (same story, different outlet/wording) into a single item —
 * the earliest-published copy — while noting which other sources also
 * covered it in `alsoReportedBy`.
 */
function collapseNearDuplicates(items) {
  // Compare in chronological order so the "kept" copy is the earliest one.
  const chronological = [...items].sort(
    (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt)
  );

  const kept = [];
  const keptTokens = [];

  for (const item of chronological) {
    const tokens = titleTokens(item.headline);
    let matchIdx = -1;

    for (let i = 0; i < kept.length; i++) {
      if (jaccard(tokens, keptTokens[i]) >= SIMILARITY_THRESHOLD) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx === -1) {
      kept.push({ ...item, alsoReportedBy: [] });
      keptTokens.push(tokens);
    } else {
      kept[matchIdx].alsoReportedBy.push(item.source);
    }
  }

  // Restore newest-first order for the final feed.
  kept.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return kept;
}

// ---------------------------------------------------------------------------
// Core fetch with retry + exponential backoff
// ---------------------------------------------------------------------------

/**
 * Fetch and parse a single RSS feed with up to MAX_RETRIES attempts.
 * Uses Promise.race for a hard per-attempt wall-clock timeout.
 * Never throws — returns [] on final failure so one dead feed doesn't block
 * the rest of the ingestion run.
 *
 * @param {{ source: string, url: string }} feedDef
 * @returns {Promise<object[]>}
 */
async function fetchFeedWithRetry({ source, url }) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[rssFetcher] Fetching "${source}" (attempt ${attempt}/${MAX_RETRIES}): ${url}`
      );

      // Race the rss-parser call against a hard timeout. The parser's own
      // `timeout` option covers socket inactivity; this covers total wall-time.
      const feed = await Promise.race([
        parser.parseURL(url),
        timeoutReject(FETCH_TIMEOUT_MS + 2000), // +2s buffer after parser timeout
      ]);

      const items = (feed.items || []).map((item) => {
        const rawTitle = (item.title || "").trim();
        const { headline, originalPublisher } =
          source === "Google News (Markets)"
            ? splitGoogleNewsTitle(rawTitle)
            : { headline: rawTitle, originalPublisher: null };

        return {
          id: makeId(item, source),
          headline,
          source,
          originalPublisher, // e.g. "Economic Times" — only set for Google News items
          url: item.link || "",
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          description: (item.contentSnippet || item.content || item.description || "").trim(),
          ticker: detectTicker(headline),
          sentiment: null,
          explanation: null,
          sector: null,
          impactHorizon: null,
          confidence: null,
          isMarketWide: null,
        };
      });

      console.log(
        `[rssFetcher] "${source}" OK — ${items.length} items fetched.`
      );

      FEED_STATUS[source] = {
        ok: true,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      };

      return items;
    } catch (err) {
      const errMsg = err.message || String(err);
      // rss-parser surface status codes as "Status code 403" in the message
      const statusMatch = errMsg.match(/Status code (\d+)/);
      const statusCode = statusMatch ? statusMatch[1] : "N/A";

      console.warn(
        `[rssFetcher] "${source}" attempt ${attempt}/${MAX_RETRIES} failed` +
          ` — status: ${statusCode}, error: ${errMsg}`
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[rssFetcher] "${source}" retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        console.error(
          `[rssFetcher] "${source}" permanently unavailable this cycle` +
            ` after ${MAX_RETRIES} attempts. Skipping. Last error: ${errMsg}`
        );

        FEED_STATUS[source] = {
          ok: false,
          lastCheckedAt: new Date().toISOString(),
          error: errMsg,
        };
      }
    }
  }

  return [];
}

/**
 * Fetch all configured feeds in parallel and return a flat, deduped list
 * in the shared contract shape, newest first.
 */
async function fetchAllFeeds() {
  const results = await Promise.all(FEEDS.map(fetchFeedWithRetry));
  const all = results.flat();

  const seen = new Set();
  const deduped = [];
  for (const item of all) {
    if (!item.headline || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const collapsed = collapseNearDuplicates(deduped);

  console.log(
    `[rssFetcher] ${deduped.length} unique items -> ${collapsed.length} after ` +
      `cross-source dedup (${deduped.length - collapsed.length} near-duplicates merged).`
  );

  return collapsed;
}

module.exports = { fetchAllFeeds, FEEDS, FEED_STATUS };
