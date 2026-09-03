// Simple in-memory store for headline objects, keyed by id.
// Good enough for a hackathon demo. Swap for SQLite/Postgres later if
// persistence across server restarts becomes necessary — the interface
// below (getAll/upsertMany/getById) is what would need to keep working.

let store = new Map();
let lastFetchedAt = null;

/** Insert or update headlines, preserving existing sentiment/explanation
 *  if a headline already has them (so re-fetching RSS doesn't wipe out
 *  work A2's sentiment pass already did). */
function upsertMany(items) {
  for (const item of items) {
    const existing = store.get(item.id);
    if (existing) {
      store.set(item.id, {
        ...item,
        sentiment: existing.sentiment ?? item.sentiment,
        explanation: existing.explanation ?? item.explanation,
        sector: existing.sector ?? item.sector ?? null,
        impactHorizon: existing.impactHorizon ?? item.impactHorizon ?? null,
        confidence: existing.confidence ?? item.confidence ?? null,
        isMarketWide: existing.isMarketWide ?? item.isMarketWide ?? null,
        originalPublisher: existing.originalPublisher ?? item.originalPublisher ?? null,
      });
    } else {
      store.set(item.id, item);
    }
  }
  lastFetchedAt = new Date().toISOString();
}

function getAll() {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}

function getById(id) {
  return store.get(id) || null;
}

function getUnprocessed() {
  return getAll().filter((item) => item.sentiment === null);
}

/** Write the AI analysis result onto a single stored headline (used by A2
 *  after an LLM call resolves). Accepts any subset of the analysis fields
 *  (sentiment, explanation, sector, impactHorizon, confidence, isMarketWide)
 *  and merges them onto the existing record. No-op if the id isn't in the
 *  store (e.g. it aged out or was replaced by a re-fetch in the meantime). */
function updateSentiment(id, patch) {
  const existing = store.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  return updated;
}

function getLastFetchedAt() {
  return lastFetchedAt;
}

function count() {
  return store.size;
}

module.exports = {
  upsertMany,
  getAll,
  getById,
  getUnprocessed,
  updateSentiment,
  getLastFetchedAt,
  count,
};
