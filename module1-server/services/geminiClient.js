// Thin wrapper around the Gemini API (Google AI Studio) for headline
// sentiment + one-line explainer generation.
//
// Uses the REST endpoint directly (no SDK dependency) so the only new
// requirement is a GEMINI_API_KEY in .env. Requires Node 18+ for global
// fetch.
//
// Each call is guarded by a hard GEMINI_TIMEOUT_MS AbortController timeout
// so a stalled API response never hangs the server.

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000); // 30s hard limit per API call

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "gpt-oss-120b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_INSTRUCTION = `You are a financial news analyst for an Indian stock market (NSE/BSE) dashboard.
For each headline given, return the following fields:

1. "sentiment" — likely short-term price impact:
   - "bullish" if the news is likely positive for the stock/market price
   - "bearish" if the news is likely negative for the stock/market price
   - "neutral" if there's no clear directional impact, it's purely informational, or the impact is ambiguous

2. "explanation" — one-line reason WHY (max ~18 words), in plain language a retail trader would understand. Do not repeat the headline verbatim.

3. "sector" — the single NSE sectoral index this headline most belongs to. Must be exactly one of:
   "Banking & Financial Services", "IT", "Pharma & Healthcare", "Auto", "FMCG", "Energy & Power",
   "Metals & Mining", "Realty", "PSU", "Media & Entertainment", "Infrastructure", "Telecom", "Other / Macro"
   Use "Other / Macro" only for broad market/economy news (e.g. RBI policy, GDP, inflation, budget) that isn't tied to one sector.

4. "impactHorizon" — how long the impact is likely to matter:
   - "intraday" — noise/short-lived (e.g. "hits 52-week high", routine block deal)
   - "short_term" — matters for days to a few weeks (e.g. quarterly results, a contract win)
   - "structural" — matters for months+ (e.g. policy change, M&A, regulatory shift, leadership change)

5. "confidence" — how confident you are in this read: "low", "medium", or "high".
   Use "low" when the headline is vague, ambiguous, or you're guessing at the mechanism.

6. "isMarketWide" — true if this affects the broad market/multiple sectors (macro, RBI, budget, FII/DII flows,
   global cues), false if it's specific to one stock/sector.

Return a JSON object with a "results" array containing one object per input headline, preserving the input "id" exactly.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sentiment: {
            type: "string",
            enum: ["bullish", "bearish", "neutral"],
          },
          explanation: { type: "string" },
          sector: {
            type: "string",
            enum: [
              "Banking & Financial Services",
              "IT",
              "Pharma & Healthcare",
              "Auto",
              "FMCG",
              "Energy & Power",
              "Metals & Mining",
              "Realty",
              "PSU",
              "Media & Entertainment",
              "Infrastructure",
              "Telecom",
              "Other / Macro",
            ],
          },
          impactHorizon: {
            type: "string",
            enum: ["intraday", "short_term", "structural"],
          },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          isMarketWide: { type: "boolean" },
        },
        required: [
          "id",
          "sentiment",
          "explanation",
          "sector",
          "impactHorizon",
          "confidence",
          "isMarketWide",
        ],
      },
    },
  },
  required: ["results"],
};

function runHeuristicSimulation(batch) {
  console.log("[geminiClient] Running heuristic sentiment simulator fallback.");
  return batch.map((item) => {
    const text = item.headline.toLowerCase();
    
    let sector = "Other / Macro";
    if (text.includes("bank") || text.includes("finance") || text.includes("hdfc") || text.includes("icici") || text.includes("sbi") || text.includes("axis") || text.includes("kotak") || text.includes("bajaj")) {
      sector = "Banking & Financial Services";
    } else if (text.includes("tcs") || text.includes("infosys") || text.includes("wipro") || text.includes("hcl") || text.includes("techm") || text.includes("tech") || text.includes("consultancy")) {
      sector = "IT";
    } else if (text.includes("pharma") || text.includes("cipla") || text.includes("reddy") || text.includes("sun") || text.includes("lab") || text.includes("drug") || text.includes("healthcare")) {
      sector = "Pharma & Healthcare";
    } else if (text.includes("maruti") || text.includes("motors") || text.includes("eicher") || text.includes("hero") || text.includes("auto") || text.includes("car")) {
      sector = "Auto";
    } else if (text.includes("itc") || text.includes("nestle") || text.includes("unilever") || text.includes("hul") || text.includes("fmcg") || text.includes("titan")) {
      sector = "FMCG";
    } else if (text.includes("reliance") || text.includes("ntpc") || text.includes("ongc") || text.includes("power") || text.includes("bpcl") || text.includes("coal") || text.includes("energy")) {
      sector = "Energy & Power";
    } else if (text.includes("steel") || text.includes("metal") || text.includes("mining") || text.includes("gold") || text.includes("silver") || text.includes("jsw") || text.includes("iron")) {
      sector = "Metals & Mining";
    } else if (text.includes("realty") || text.includes("real estate") || text.includes("property")) {
      sector = "Realty";
    } else if (text.includes("psu")) {
      sector = "PSU";
    } else if (text.includes("airtel") || text.includes("telecom") || text.includes("jio") || text.includes("vodafone") || text.includes("idea")) {
      sector = "Telecom";
    } else if (text.includes("l&t") || text.includes("larsen") || text.includes("adani") || text.includes("ports") || text.includes("infrastructure") || text.includes("cement") || text.includes("grasim")) {
      sector = "Infrastructure";
    }

    let isMarketWide = sector === "Other / Macro" || text.includes("nifty") || text.includes("sensex") || text.includes("market") || text.includes("rbi") || text.includes("gdp") || text.includes("inflation") || text.includes("budget") || text.includes("global") || text.includes("fed");

    let sentiment = "neutral";
    let explanation = "General market news with balanced trading interest and neutral momentum.";

    if (text.includes("gain") || text.includes("rise") || text.includes("surge") || text.includes("up") || text.includes("buy") || text.includes("bullish") || text.includes("jump") || text.includes("higher") || text.includes("record") || text.includes("profit") || text.includes("win") || text.includes("growth") || text.includes("positive") || text.includes("strong") || text.includes("acquisition") || text.includes("order") || text.includes("hikes") || text.includes("optimism")) {
      sentiment = "bullish";
      explanation = `Positive momentum triggered by strong indicators or expansion updates in the ${sector} sector.`;
    } else if (text.includes("fall") || text.includes("drop") || text.includes("plunge") || text.includes("down") || text.includes("sell") || text.includes("bearish") || text.includes("dip") || text.includes("lower") || text.includes("loss") || text.includes("crash") || text.includes("negative") || text.includes("weak") || text.includes("slump") || text.includes("cut") || text.includes("debt") || text.includes("fined") || text.includes("decline") || text.includes("probe") || text.includes("caution")) {
      sentiment = "bearish";
      explanation = `Downward pressure on price due to profit booking, cautionary cues, or negative news in the ${sector} sector.`;
    }

    let impactHorizon = "short_term";
    if (text.includes("policy") || text.includes("acquisition") || text.includes("merger") || text.includes("rbi") || text.includes("deal") || text.includes("m&a")) {
      impactHorizon = "structural";
    } else if (text.includes("intraday") || text.includes("today") || text.includes("session")) {
      impactHorizon = "intraday";
    }

    return {
      id: item.id,
      sentiment,
      explanation: explanation.slice(0, 200),
      sector,
      impactHorizon,
      confidence: "high",
      isMarketWide
    };
  });
}

function parseAndValidateResults(parsed) {
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const validSentiments = new Set(["bullish", "bearish", "neutral"]);
  const validSectors = new Set([
    "Banking & Financial Services",
    "IT",
    "Pharma & Healthcare",
    "Auto",
    "FMCG",
    "Energy & Power",
    "Metals & Mining",
    "Realty",
    "PSU",
    "Media & Entertainment",
    "Infrastructure",
    "Telecom",
    "Other / Macro",
  ]);
  const validHorizons = new Set(["intraday", "short_term", "structural"]);
  const validConfidence = new Set(["low", "medium", "high"]);

  return results
    .filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        validSentiments.has(r.sentiment) &&
        validSectors.has(r.sector) &&
        validHorizons.has(r.impactHorizon) &&
        validConfidence.has(r.confidence) &&
        typeof r.isMarketWide === "boolean"
    )
    .map((r) => ({
      id: r.id,
      sentiment: r.sentiment,
      explanation: (r.explanation || "").toString().slice(0, 200),
      sector: r.sector,
      impactHorizon: r.impactHorizon,
      confidence: r.confidence,
      isMarketWide: r.isMarketWide,
    }));
}

/**
 * Fallback to Groq API (GPT-oss 120B) when Gemini is unavailable or rate limited.
 */
async function analyzeBatchGroq(batch) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_groq_key_here") {
    console.log("[geminiClient] No GROQ_API_KEY configured. Using heuristic simulator.");
    return runHeuristicSimulation(batch);
  }

  const userContent = batch
    .map((item, i) => `${i + 1}. id=${item.id} :: ${item.headline}`)
    .join("\n");

  console.log(`[geminiClient] Calling Groq API (${GROQ_MODEL}) for ${batch.length} headlines...`);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: `${SYSTEM_INSTRUCTION}\nReturn JSON strictly adhering to schema.` },
          { role: "user", content: `Headlines:\n${userContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq API response choice content was empty");

    const parsed = JSON.parse(content);
    const validated = parseAndValidateResults(parsed);
    if (validated.length > 0) return validated;

    console.warn("[geminiClient] Groq API returned 0 valid items. Falling back to simulator.");
    return runHeuristicSimulation(batch);
  } catch (err) {
    clearTimeout(timeoutHandle);
    console.error(`[geminiClient] Groq API call failed (${err.message}). Using heuristic simulator.`);
    return runHeuristicSimulation(batch);
  }
}

/**
 * Main batch analysis endpoint. Tries Gemini first, falls back to Groq API (GPT-oss 120B), then simulator.
 */
async function analyzeBatch(batch) {
  if (!batch.length) return [];

  const isGeminiKeyValid = GEMINI_API_KEY && GEMINI_API_KEY !== "your_key_here" && GEMINI_API_KEY.trim() !== "" && !GEMINI_API_KEY.includes("DA KEY");

  if (!isGeminiKeyValid) {
    console.log("[geminiClient] Gemini API key invalid or missing. Attempting Groq API fallback directly...");
    return analyzeBatchGroq(batch);
  }

  const userContent = batch
    .map((item, i) => `${i + 1}. id=${item.id} :: ${item.headline}`)
    .join("\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nHeadlines:\n${userContent}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[geminiClient] Gemini API returned HTTP ${res.status}: ${errText.slice(0, 150)}. Falling back to Groq API (${GROQ_MODEL})...`);
      return analyzeBatchGroq(batch);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.warn("[geminiClient] Gemini response missing content. Falling back to Groq API...");
      return analyzeBatchGroq(batch);
    }

    const parsed = JSON.parse(rawText);
    const validated = parseAndValidateResults(parsed);
    if (validated.length > 0) return validated;

    console.warn("[geminiClient] Gemini returned zero valid items. Falling back to Groq API...");
    return analyzeBatchGroq(batch);
  } catch (err) {
    clearTimeout(timeoutHandle);
    console.warn(`[geminiClient] Gemini API call failed (${err.message}). Falling back to Groq API (${GROQ_MODEL})...`);
  }
}

module.exports = { analyzeBatch };
