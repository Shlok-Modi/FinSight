#!/usr/bin/env node
// Import NSE's own official historical FII/DII CSV export into the app's
// real data/fiiDiiHistory.json store.
//
// Why this exists: NSE's live JSON endpoint (fiidiiTradeReact, used by
// services/fiiDiiService.js for day-to-day auto-updates) only ever
// returns the CURRENT trading day — it has no historical range. NSE does
// publish real historical figures, but only as a CSV you download by hand
// from their own site. This script ingests that official CSV so past
// days are backed by the exact same NSE-published numbers, not a guess.
//
// How to get the CSV:
//   1. Go to https://www.nseindia.com/reports/fii-dii in a normal browser
//      (must be a real browser session — NSE blocks non-browser requests
//      for these downloads).
//   2. Click "Download (.csv)" under "FII/FPI & DII trading activity on
//      NSE, BSE and MSEI in Capital Market Segment" (the COMBINED report
//      — not the NSE-only one — since that's the one this app displays).
//   3. For older dates, use NSE's archives search
//      (https://www.nseindia.com/products/content/equities/equities/eq_fiidii_archives.htm)
//      to pull CSVs for earlier date ranges, one file per range.
//
// Expected CSV shape (this is NSE's own export format):
//   Category,Date,Buy Value,Sell Value,Net Value
//   FII/FPI *,10-Jul-2019,3853.73,4458.67,-604.94
//   DII,10-Jul-2019,3499.57,2832.17,667.4
//   ... (repeated: one FII/FPI row + one DII row per trading date)
//
// Usage:
//   node scripts/importFiiDiiHistoricalCsv.js path/to/file1.csv [path/to/file2.csv ...]

const fs = require("fs");
const path = require("path");
const fiiDiiService = require("../services/fiiDiiService");

/**
 * Full quote-aware CSV tokenizer that parses the WHOLE file content at
 * once, rather than splitting into lines first. This matters because
 * NSE's own CSV export wraps each cell in quotes that can contain a
 * literal embedded newline (e.g. the header cell is literally
 * `"CATEGORY\n"`, `"DATE\n"`, etc) — that's valid CSV (a quoted field is
 * allowed to contain newlines), but naively splitting on \n before
 * looking at quotes breaks those cells apart. Only a \n encountered
 * OUTSIDE of quotes ends a row.
 *
 * Returns an array of rows, each row an array of (trimmed) cell strings.
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
      // ignore; \n (or \r\n) handles the row break
    } else if (ch === "\n") {
      row.push(cur.trim());
      cur = "";
      // Only keep the row if it has at least one non-empty cell — NSE's
      // export can have stray blank lines between sections.
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  // Flush any trailing cell/row that wasn't newline-terminated.
  if (cur !== "" || row.length > 0) {
    row.push(cur.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

/** Normalize a CSV header cell ("Buy Value", "buy_value", " BUY VALUE ")
 * down to a canonical key so we're tolerant of NSE tweaking capitalization
 * or spacing across different report exports. */
function canonicalHeaderKey(cell) {
  const clean = cell.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.includes("categ")) return "category";
  if (clean === "date") return "date";
  if (clean.includes("buy")) return "buyValue";
  if (clean.includes("sell")) return "sellValue";
  if (clean.includes("net")) return "netValue";
  return null;
}

function parseCsvFile(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  raw = raw.replace(/^\uFEFF/, ""); // strip BOM if present

  const allRows = tokenizeCsv(raw);
  if (allRows.length < 2) {
    throw new Error(`${filePath}: no data rows found`);
  }

  const headerCells = allRows[0];
  const keys = headerCells.map(canonicalHeaderKey);

  if (!keys.includes("category") || !keys.includes("date")) {
    throw new Error(
      `${filePath}: couldn't recognize CSV headers (got: ${headerCells.join(
        ", "
      )}). Expected columns like Category, Date, Buy Value, Sell Value, Net Value.`
    );
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

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/importFiiDiiHistoricalCsv.js <file1.csv> [file2.csv ...]");
    console.error("See the comment header in this script for where to download the CSV from NSE.");
    process.exit(1);
  }

  let totalImported = 0;
  const allErrors = [];

  for (const file of files) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error(`Skipping ${file}: file not found`);
      continue;
    }
    console.log(`Reading ${resolved} ...`);
    let rows;
    try {
      rows = parseCsvFile(resolved);
    } catch (err) {
      console.error(err.message);
      continue;
    }

    const result = fiiDiiService.importRecords(rows);
    console.log(
      `  -> ${result.imported} trading day(s) imported from ${rows.length} CSV row(s) (${result.skipped} row(s) unparseable).`
    );
    if (result.errors.length > 0) {
      console.log(`  -> ${result.errors.length} date(s) skipped (missing a matching FII or DII row):`);
      result.errors.slice(0, 10).forEach((e) => console.log(`     - ${e}`));
      if (result.errors.length > 10) console.log(`     ... and ${result.errors.length - 10} more`);
    }
    totalImported += result.imported;
    allErrors.push(...result.errors);
  }

  console.log(`\nDone. ${totalImported} trading day(s) imported in total.`);
  console.log(`History now has ${fiiDiiService.historyCount()} real trading day(s) stored.`);
}

main();
