# data/

`fiiDiiHistory.json` lives here once the app has real data. It's created
automatically the first time the server successfully fetches from NSE, or
by running the CSV importer — see `scripts/importFiiDiiHistoricalCsv.js`.

This file is generated data, not source code — you'll typically want to
`.gitignore` it (or commit it once populated, if you want history to ship
with your deployment).

To backfill genuine historical days (NSE's live endpoint only returns
today's figures):

```
node scripts/importFiiDiiHistoricalCsv.js path/to/nse-fii-dii-export.csv
```

Download that CSV yourself from https://www.nseindia.com/reports/fii-dii
("Download (.csv)" under the combined NSE+BSE+MSEI report) — see the
comment header in the import script for full instructions, including how
to pull older date ranges from NSE's archives page.
