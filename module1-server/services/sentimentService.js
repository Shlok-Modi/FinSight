// A2 — pulls unprocessed headlines (sentiment === null) from the A1 store,
// sends them to Gemini in small batches, and writes {sentiment, explanation}
// back onto each headline via store.updateSentiment.
//
// Designed to be called after every RSS fetch/refresh (startup fetch,
// auto-refresh interval, manual /api/news/refresh), and also exposed as
// its own manual trigger (/api/news/analyze) for demo control.

const store = require("./newsStore");
const { analyzeBatch } = require("./geminiClient");

const BATCH_SIZE = Number(process.env.SENTIMENT_BATCH_SIZE || 25);
// Gap between batches, to stay comfortably under Gemini free-tier rate limits.
const BATCH_DELAY_MS = Number(process.env.SENTIMENT_BATCH_DELAY_MS || 4000);

let isProcessing = false; // simple guard so overlapping triggers don't double-run

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Process all currently-unprocessed headlines in the store.
 * Never throws — logs and returns a summary so callers (server.js /
 * routes) don't need try/catch around it.
 */
async function processUnprocessed() {
  if (isProcessing) {
    console.log("[sentimentService] Already processing, skipping this trigger.");
    return { ok: false, reason: "already_processing" };
  }

  const pending = store.getUnprocessed();
  if (!pending.length) {
    return { ok: true, processed: 0, failed: 0, batches: 0 };
  }

  isProcessing = true;
  console.log(`[sentimentService] ${pending.length} unprocessed headlines. Starting analysis...`);

  const batches = chunk(pending, BATCH_SIZE);
  let processed = 0;
  let failed = 0;

  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const results = await analyzeBatch(
          batch.map((item) => ({ id: item.id, headline: item.headline }))
        );

        const resultIds = new Set();
        for (const r of results) {
          store.updateSentiment(r.id, {
            sentiment: r.sentiment,
            explanation: r.explanation,
            sector: r.sector,
            impactHorizon: r.impactHorizon,
            confidence: r.confidence,
            isMarketWide: r.isMarketWide,
          });
          resultIds.add(r.id);
          processed++;
        }

        // Anything in the batch that Gemini didn't return a valid result
        // for gets marked neutral/low-confidence with generic defaults, so
        // it doesn't stay stuck as "unprocessed" forever and get retried
        // every cycle.
        for (const item of batch) {
          if (!resultIds.has(item.id)) {
            store.updateSentiment(item.id, {
              sentiment: "neutral",
              explanation: "Impact unclear — no confident read from analysis.",
              sector: "Other / Macro",
              impactHorizon: "intraday",
              confidence: "low",
              isMarketWide: false,
            });
            failed++;
          }
        }

        console.log(
          `[sentimentService] Batch ${i + 1}/${batches.length}: ${results.length}/${batch.length} analyzed.`
        );
      } catch (err) {
        console.error(`[sentimentService] Batch ${i + 1}/${batches.length} failed: ${err.message}`);
        failed += batch.length;
        // Leave these as sentiment: null so they get retried on the next
        // refresh cycle instead of being permanently marked neutral —
        // this failure is ours (API/network), not a judgment call on the
        // headline itself.

        const isQuotaError = err.message.includes("429");
        if (isQuotaError) {
          const remaining = batches.length - (i + 1);
          console.error(
            `[sentimentService] Quota/rate-limit hit (429). Stopping this run — ` +
              `${remaining} remaining batch(es) will be retried on the next trigger ` +
              `instead of repeating the same failure. Check https://ai.dev/rate-limit ` +
              `for your current usage.`
          );
          break;
        }
      }

      if (i < batches.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  } finally {
    isProcessing = false;
  }

  console.log(`[sentimentService] Done. Processed: ${processed}, failed: ${failed}.`);
  return { ok: true, processed, failed, batches: batches.length };
}

module.exports = { processUnprocessed };
