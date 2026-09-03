// Minimal keyword -> NSE ticker map for headline ticker detection.
// Extend this list as you notice missed headlines in the demo dataset.
// Keys are matched as case-insensitive substrings against the headline text.

const TICKER_MAP = {
  "reliance": "RELIANCE",
  "ril": "RELIANCE",
  "tcs": "TCS",
  "tata consultancy": "TCS",
  "infosys": "INFY",
  "hdfc bank": "HDFCBANK",
  "hdfc": "HDFCBANK",
  "icici bank": "ICICIBANK",
  "icici": "ICICIBANK",
  "sbi": "SBIN",
  "state bank of india": "SBIN",
  "axis bank": "AXISBANK",
  "kotak mahindra": "KOTAKBANK",
  "kotak bank": "KOTAKBANK",
  "bharti airtel": "BHARTIARTL",
  "airtel": "BHARTIARTL",
  "itc": "ITC",
  "larsen & toubro": "LT",
  "larsen and toubro": "LT",
  "l&t": "LT",
  "wipro": "WIPRO",
  "hcl tech": "HCLTECH",
  "hcltech": "HCLTECH",
  "maruti suzuki": "MARUTI",
  "maruti": "MARUTI",
  "tata motors": "TATAMOTORS",
  "tata steel": "TATASTEEL",
  "sun pharma": "SUNPHARMA",
  "adani enterprises": "ADANIENT",
  "adani ports": "ADANIPORTS",
  "adani": "ADANIENT",
  "ntpc": "NTPC",
  "ongc": "ONGC",
  "power grid": "POWERGRID",
  "ultratech cement": "ULTRACEMCO",
  "asian paints": "ASIANPAINT",
  "bajaj finance": "BAJFINANCE",
  "bajaj finserv": "BAJAJFINSV",
  "titan": "TITAN",
  "nestle india": "NESTLEIND",
  "hindustan unilever": "HINDUNILVR",
  "hul": "HINDUNILVR",
  "coal india": "COALINDIA",
  "indusind bank": "INDUSINDBK",
  "jsw steel": "JSWSTEEL",
  "grasim": "GRASIM",
  "cipla": "CIPLA",
  "dr reddy": "DRREDDY",
  "eicher motors": "EICHERMOT",
  "hero motocorp": "HEROMOTOCO",
  "britannia": "BRITANNIA",
  "divi's lab": "DIVISLAB",
  "divis lab": "DIVISLAB",
  "sbi life": "SBILIFE",
  "hdfc life": "HDFCLIFE",
  "tech mahindra": "TECHM",
  "shriram finance": "SHRIRAMFIN",
  "bpcl": "BPCL",
  "nifty": "NIFTY50",
  "sensex": "SENSEX",
};

/**
 * Detect a ticker from headline text by matching known company keywords.
 * Returns the first match (longest keys checked first to prefer specific
 * matches over generic ones, e.g. "hdfc bank" before "hdfc").
 * @param {string} text
 * @returns {string|null}
 */
function detectTicker(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const keys = Object.keys(TICKER_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) {
      return TICKER_MAP[key];
    }
  }
  return null;
}

module.exports = { detectTicker, TICKER_MAP };
