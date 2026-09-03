

Pasted markdown(1).md
File
Isko sahi kro and give me

Haan bhai, README ko properly GitHub-ready kar diya — broken Claude links, malformed tables, screenshot paths, clone path, license mismatch, formatting issues sab fix kiye hain. 


Download: 

Ek important correction bhi kiya: README mein MIT badge tha but repo mein LICENSE file nahi hai, toh maine usko falsely MIT-licensed show nahi kiya. 

 



Library
/
README-FinSight-fixed.md


<div align="center"> <img src="./docs/images/logo-placeholder.png" alt="FinSight logo" width="96" />

FinSight
AI-Powered Market Intelligence for Indian Retail Investors

Catch the market before it shifts.

FinSight ingests live Indian market news, scores it for sentiment with an LLM pipeline, and surfaces IPOs and institutional (FII/DII) flow data in a single dashboard — so retail traders stop tab-switching between six different sites.

Built for the Build With Bharat National Hackathon by Team QuadCore, where it placed 2nd Runner-Up among 300+ teams, with finals hosted at Microsoft Gurugram.

Node.js (image)
React (image)
Express (image)
Vite (image)
Gemini (image)
PostgreSQL (image)
JWT (image)
Hackathon (image)
License

</div>

Project status: FinSight, as built during the Build With Bharat hackathon, ships the Market Intelligence module (AI news, IPO tracking, FII/DII flows, auth). The PaperDesk practice-trading module described in the team's pitch is a planned, not-yet-implemented module — see Roadmap.

Table of Contents
About

Key Features

Screenshots

Architecture

Tech Stack

Folder Structure

Installation

Environment Variables

API Documentation

AI Pipeline

Project Workflow

Security Notes

Roadmap / Future Scope

Contributors

License

Acknowledgements

📖 About
FinSight is a market-intelligence dashboard built for Indian retail investors during the Build With Bharat national-level hackathon by Team QuadCore.

The problem: India has 210M+ demat accounts, and most retail investors trade on gut feeling. Market-moving news is scattered across six or more sources (Twitter, Moneycontrol, NSE, Telegram, and more), so critical signals — RBI decisions, FII exits, earnings surprises — go unnoticed, and there is no single dashboard that connects macro trends, stock-specific news, and the IPO pipeline.

What FinSight does today: it continuously pulls headlines from major Indian financial news outlets, runs each headline through an LLM (with automatic fallbacks) to classify sentiment, sector, and likely impact horizon, and pairs that with live IPO data and FII/DII institutional flow data — all sourced directly from NSE India's public endpoints, with no seeded or fabricated numbers.

Who it's for: retail traders and investors who want one screen that tells them what's moving the market right now and why, instead of piecing it together across a dozen apps.

✨ Key Features
Only capabilities that exist in the current codebase are listed here. Everything the team has planned but not yet built lives in Roadmap.

📰 Market Intelligence
Multi-source news ingestion — polls RSS feeds from ET Markets, Moneycontrol, Livemint, The Hindu BusinessLine, CNBC-TV18, and a Google News (Nifty/Sensex/NSE/BSE) aggregator on a configurable interval.

Cross-source deduplication — collapses near-duplicate headlines covering the same story across outlets (Jaccard token-similarity matching) and lists which other outlets also carried it.

Ticker detection — maps headline text to NSE ticker symbols via a keyword dictionary (50+ large-cap names).

AI sentiment scoring — every headline is tagged bullish / bearish / neutral, with a one-line plain-English explanation, a sector classification, an impact horizon (intraday / short-term / structural), and a confidence level.

"Why is it moving?" explainer — on a stock's detail page, FinSight surfaces the most relevant recent headline explanation for that symbol's price action.

Sector & sentiment filtering, live search — filter the news feed by sector, source, sentiment, or free-text search across headline/ticker/description.

Two feed layouts — a card-based "Flashcard" view and a compact "List Trends" feed.

Market outlook summary — an aggregate bullish/bearish/neutral breakdown across recent headlines, shown as a dropdown "outlook" badge with a plain-language summary.

📈 IPO Intelligence
Live IPO data sourced directly from NSE India (all-upcoming-issues and public-past-issues endpoints) — no third-party API key required.

Grey Market Premium (GMP) enrichment — live-scraped from Chittorgarh / InvestorGain and matched to NSE IPO records by fuzzy company-name matching; GMP is never fabricated — NSE itself does not publish it, so it's clearly attributed to a separate unofficial source.

Status filtering — Open / Upcoming / Closed / Listed, mainboard IPOs only (SME issues are filtered out).

5-minute response cache to stay within NSE's request tolerance, with a manual force-refresh option.

🏦 FII/DII Flow Tracking
Daily institutional flow data sourced live from NSE India (fiidiiTradeReact endpoint).

Self-accumulating history — since NSE's live endpoint only returns the current day, FinSight appends each day's real, NSE-sourced figures to a local JSON store (data/fiiDiiHistory.json) over time, building genuine historical coverage.

Official CSV backfill script (scripts/importFiiDiiHistoricalCsv.js) to import NSE's own historical export and an in-app CSV import modal for the same.

Scatter plot, bar chart, and sortable/paginated/searchable table views with cumulative, month-to-date, and single-day summaries.

CSV export of the currently loaded history.

🔐 Authentication
Google Sign-In (Google Identity Services) with server-side ID-token verification.

JWT session tokens backed by session rows in a Neon serverless PostgreSQL database; sessions are checked against the DB (not just signature-verified) so they can be revoked.

Auth is fully optional/graceful — the app runs and shows a clear "not configured" state in the sign-in modal if GOOGLE_CLIENT_ID / DATABASE_URL / JWT_SECRET are not set.

🧭 Dashboard UX
Resizable watchlist sidebar (sector-grouped, with a client-side simulated price ticker for demo "liveliness" — see note below).

Stock detail view combining a price chart, market-wide news, stock-specific news, and sector news in independently resizable, drag-reorderable panels.

Dark/light theme toggle, layout scaling, dismissible "quick overview" briefing screen on load.

Note on price data: the watchlist and stock-detail price ticks (WatchlistSidebar.jsx) are client-side simulated (a small deterministic random walk) for demo purposes — FinSight does not currently have a live NSE/BSE price-feed integration. News, IPO, and FII/DII data, by contrast, are genuinely sourced live from NSE India and RSS publishers.

🖼 Screenshots
Note: Replace the screenshot paths below with the final exported images before publishing.

Dashboard	News Feed


Flashcard market intelligence view	List Trends feed view
IPO Intelligence	FII/DII Flows


IPO Intelligence hub	FII/DII flow scatter/table view
🏗 Architecture
FinSight is a two-service monorepo: a Vite/React single-page app and an Express API server. There is no separate database service for market data — news and IPOs are held in memory (repopulated on each RSS/NSE poll), and FII/DII history is persisted to a local JSON file. PostgreSQL (Neon) is used exclusively for authentication (users, sessions).

finsight/
├── module1-client/     # React 19 + Vite frontend
└── module1-server/     # Node.js + Express backend

flowchart LR
    subgraph External Sources
        RSS[RSS Feeds\nET Markets / Moneycontrol / Livemint /\nBusinessLine / CNBC-TV18 / Google News]
        NSE[NSE India Public APIs\nIPO issues + FII/DII trade data]
        CG[Chittorgarh / InvestorGain\nLive GMP HTML]
        GID[Google Identity Services]
    end

    subgraph "module1-server (Express, Node.js)"
        RF[rssFetcher.js]
        NS[newsStore.js\nin-memory]
        SS[sentimentService.js]
        GC[geminiClient.js\nGemini → Groq → heuristic]
        IS[ipoStore.js]
        GMP[chittorgarhGmpService.js]
        FD[fiiDiiService.js\n+ data/fiiDiiHistory.json]
        AUTH[authService.js]
        DB[(Neon PostgreSQL\nusers, sessions)]
        API[Express routes\n/api/news /api/ipo /api/fii-dii /api/auth]
    end

    subgraph "module1-client (React 19 + Vite)"
        UI[Dashboard UI\nFlashcards / Feed / IPO / FII-DII / Stock Detail]
    end

    RSS --> RF --> NS --> SS --> GC --> NS
    NSE --> IS --> GMP
    CG --> GMP
    NSE --> FD
    GID --> AUTH --> DB
    NS --> API
    IS --> API
    FD --> API
    AUTH --> API
    API <--> UI

Request flow at a glance:

On server startup and on a timer (REFRESH_INTERVAL_MS), rssFetcher.js polls all configured feeds, dedupes across sources, and upserts into the in-memory newsStore.

sentimentService.js picks up any headline without a sentiment and batches it to geminiClient.js, which tries Gemini first, falls back to Groq, and finally falls back to a deterministic keyword-based heuristic simulator if both AI providers are unavailable — so the dashboard never shows blank sentiment.

ipoStore.js and fiiDiiService.js independently poll NSE India's public (undocumented) JSON endpoints on their own cache/refresh intervals; IPOs are further enriched with GMP scraped from Chittorgarh.

The React client polls /api/news and /api/ipo on a timer and calls /api/fii-dii on demand, rendering everything client-side with no server-side templating.

Auth is a separate, optional path: Google ID tokens are verified server-side, users/sessions are persisted in Neon Postgres, and a JWT is handed back to the client for subsequent Authorization: Bearer calls.

🧰 Tech Stack
Technology	Purpose	Where Used
React 19	Frontend UI library	module1-client/src
Vite 8	Frontend dev server & bundler, with /api proxy to the backend	module1-client/vite.config.js
lucide-react	Icon set used throughout the UI	module1-client/src/components
Node.js + Express 5	Backend HTTP API server	module1-server/server.js, routes/
rss-parser	Fetches and parses publisher RSS feeds	module1-server/services/rssFetcher.js
Google Gemini API (gemini-flash-latest)	Primary LLM for headline sentiment/sector/explanation	module1-server/services/geminiClient.js
Groq API (gpt-oss-120b)	Fallback LLM when Gemini is unavailable or rate-limited	module1-server/services/geminiClient.js
Heuristic keyword simulator	Final offline fallback so sentiment is always populated	module1-server/services/geminiClient.js
NSE India public JSON endpoints	Live IPO listings and FII/DII institutional flow data	module1-server/services/ipoStore.js, fiiDiiService.js
Chittorgarh / InvestorGain	Live IPO Grey Market Premium (GMP) scraping	module1-server/services/chittorgarhGmpService.js
google-auth-library	Verifies Google ID tokens server-side	module1-server/services/authService.js
jsonwebtoken	Issues/verifies session JWTs	module1-server/services/authService.js
@neondatabase/serverless	Serverless PostgreSQL client (Neon)	module1-server/services/db.js
Google Identity Services (GSI)	Client-side Google Sign-In button/flow	module1-client/src/components/GoogleSignInModal.jsx
dotenv, cors, uuid	Server config, CORS handling, session IDs	module1-server
oxlint	Frontend linting	module1-client/package.json
📁 Folder Structure
finsight/
├── module1-client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── FiiDiiFlow.jsx       # FII/DII scatter/chart/table view
│   │   │   ├── Flashcard.jsx        # News card component
│   │   │   ├── GoogleSignInModal.jsx
│   │   │   ├── IpoCard.jsx
│   │   │   ├── Logo.jsx
│   │   │   ├── MainDashboard.jsx    # Search/filter shell for all views
│   │   │   ├── NewsFeed.jsx         # "List Trends" feed layout
│   │   │   ├── StockDetail.jsx      # Per-stock drill-down view
│   │   │   └── WatchlistSidebar.jsx # Sector-grouped watchlist
│   │   ├── services/authService.js  # Client-side auth API wrapper
│   │   ├── App.jsx                  # Top-level layout, data fetching, view switching
│   │   └── main.jsx
│   ├── public/
│   ├── vite.config.js               # Dev proxy: /api → http://localhost:4000
│   └── package.json
│
├── module1-server/                  # Express backend
│   ├── routes/
│   │   ├── auth.js                  # /api/auth/*
│   │   ├── fiidii.js                # /api/fii-dii*
│   │   ├── ipo.js                   # /api/ipo
│   │   └── news.js                  # /api/news*
│   ├── services/
│   │   ├── authService.js           # Google token verify + JWT sessions
│   │   ├── chittorgarhGmpService.js # Live GMP scraping
│   │   ├── db.js                    # Neon Postgres client + migrations
│   │   ├── fiiDiiService.js         # NSE FII/DII polling + local history
│   │   ├── geminiClient.js          # Gemini → Groq → heuristic sentiment
│   │   ├── ipoStore.js              # NSE IPO polling + caching
│   │   ├── newsStore.js             # In-memory headline store
│   │   ├── rssFetcher.js            # Multi-feed RSS ingestion + dedup
│   │   ├── sentimentService.js      # Batches unprocessed headlines to AI
│   │   └── tickerMap.js             # Headline → NSE ticker detection
│   ├── scripts/
│   │   └── importFiiDiiHistoricalCsv.js  # Backfill official NSE CSV exports
│   ├── data/
│   │   └── fiiDiiHistory.json       # Generated — accumulated real NSE history
│   ├── .env.example
│   └── server.js                    # Express app, startup fetch, refresh timers
│
├── start-dashboard.ps1              # Windows convenience script (starts both servers)
└── README.md

(node_modules, dist**, package-lock.json**, and build caches are omitted above.)

🚀 Installation
Prerequisites
Node.js 18+ (the server uses global fetch and AbortSignal.timeout, which require Node 18+)

npm

Optional: a Neon Postgres database (free tier works) if you want auth enabled

1. Clone the repository
git clone https://github.com/Shlok-Modi/FinSight.git
cd FinSight

2. Install dependencies
# Backend
cd module1-server
npm install

# Frontend (in a separate terminal)
cd ../module1-client
npm install

3. Configure environment variables
cd module1-server
cp .env.example .env
# then edit .env — see Environment Variables below

The app runs with zero required configuration: news, IPO, and FII/DII data work out of the box against public endpoints. AI sentiment falls back to a heuristic simulator without an API key, and Google Sign-In stays disabled (with a clear in-app message) until you add OAuth/DB credentials.

4. Run in development mode
# Terminal 1 — backend (http://localhost:4000)
cd module1-server
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd module1-client
npm run dev

Vite's dev server proxies all /api/* requests to http://localhost:4000 (see vite.config.js), so the frontend and backend can run independently during development.

On Windows, start-dashboard.ps1 launches both servers in separate PowerShell windows in one step:

./start-dashboard.ps1

5. Production build
cd module1-client
npm run build      # outputs to module1-client/dist
npm run preview    # serve the production build locally

cd ../module1-server
npm start           # node server.js (no file-watch)

There is no built-in reverse proxy or static-file serving wired between the two services for production — you'll need to serve module1-client/dist behind your own web server (or a proxy) alongside the Express API.

🔑 Environment Variables
All variables below are read directly by module1-server. None are required for the app to boot; each subsystem degrades gracefully when its variables are missing.

Variable Description Default / Required	

PORT	Port the Express server listens on	4000
REFRESH_INTERVAL_MS	How often (ms) to re-poll all RSS feeds	60000
GEMINI_API_KEY	Google AI Studio key for Gemini sentiment analysis	Optional — falls back to Groq, then heuristic simulator
GEMINI_MODEL	Gemini model name	gemini-flash-latest
GEMINI_TIMEOUT_MS	Hard timeout per Gemini/Groq API call (ms)	30000
GROQ_API_KEY	Groq API key, used as the AI fallback when Gemini fails or is unset	Optional
GROQ_MODEL	Groq model name	gpt-oss-120b
SENTIMENT_BATCH_SIZE	Headlines per AI batch request	25 (.env.example suggests 10)
SENTIMENT_BATCH_DELAY_MS	Delay between AI batches, to respect rate limits	4000
FIIDII_REFRESH_INTERVAL_MS	How often (ms) to poll NSE for new FII/DII data	900000 (15 min)
GOOGLE_CLIENT_ID	OAuth 2.0 Client ID for Google Sign-In	Optional — sign-in shows an "unconfigured" state without it
DATABASE_URL	Neon PostgreSQL connection string (used for users/sessions)	Optional — auth disabled without it
JWT_SECRET	Secret used to sign session JWTs (generate with openssl rand -hex 32)	Optional — required for auth to function
JWT_EXPIRES_IN	Session JWT lifetime	7d
module1-server/.env.example also lists IPOALERTS_API_KEY and IPOALERTS_INCLUDE_GMP, referencing a third-party IPO API (ipoalerts.in). These are not referenced anywhere in the current source — IPO data is sourced directly from NSE India instead, with GMP scraped from Chittorgarh/InvestorGain. Treat those two variables as stale and safe to remove from your own .env.

📡 API Documentation
No Swagger/OpenAPI spec is present in the repo, so the endpoints below are documented directly from the route source. Base URL in development: http://localhost:4000.

Health
Method	Route	Description	Auth
GET	/health	Server + subsystem status: headline count, feed status per source, IPO cache status, FII/DII history status	None
News
Method	Route	Description	Response	Auth
GET	/api/news	Current stored, sentiment-tagged headlines (no fetch triggered)	{ count, lastFetchedAt, items[] }	None
GET	/api/news/:id	Single headline lookup by id	Headline object or 404	None
POST	/api/news/refresh	Re-fetch all RSS feeds now, merge into store, kick off AI analysis (rate-limited)	{ ok, fetched, totalStored, lastFetchedAt, feedStatus }	None
POST	/api/news/analyze	Manually trigger AI sentiment analysis on unprocessed headlines	{ ok, processed, failed, batches, totalStored }	None
IPO Intelligence
Method	Route	Description	Request	Response	Auth
GET	/api/ipo	Live IPO list from NSE India, GMP-enriched	Query: status (open|upcoming|closed|listed), refresh=true to bypass cache	{ count, lastFetchedAt, source, items[] }	None
FII/DII Flows
Method	Route	Description	Request	Response	Auth
GET	/api/fii-dii	Historical + latest daily FII/DII net flows	Query: days (default 30, or all), from, to (YYYY-MM-DD), refresh=true	{ count, summary, data[], source, lastFetchedAt, lastError }	None
POST	/api/fii-dii/import	Import an official NSE CSV export (or structured JSON records) into local history	Body: { csvText } or { records: [] }	{ ok, importedDays, skippedRows, errors, totalStoredDays }	None
Authentication
Method	Route	Description	Request	Response	Auth
GET	/api/auth/config	Public auth config for the frontend (Google Client ID, configured flag)	—	{ googleClientId, configured }	None
POST	/api/auth/google	Exchange a Google ID token for a FinSight session	Body: { idToken }	{ token, user: { id, email, name, picture } }	None
GET	/api/auth/me	Get the signed-in user's profile	Header: Authorization: Bearer <token>	{ user } or 401	Bearer JWT
POST	/api/auth/logout	Invalidate the current session	Header: Authorization: Bearer <token>	{ ok: true }	Bearer JWT
🤖 AI Pipeline
FinSight's AI layer lives entirely in module1-server/services/geminiClient.js and sentimentService.js, and is deliberately built with three tiers of fallback so the dashboard is never left with unprocessed headlines:

Gemini (gemini-flash-latest) — primary. Called with a structured JSON response schema (responseSchema) so the model returns validated sentiment, explanation, sector, impactHorizon, confidence, and isMarketWide fields per headline.

Groq (gpt-oss-120b) — automatic fallback if Gemini's key is missing/invalid, the request fails, or Gemini returns zero valid results.

Heuristic keyword simulator — final offline fallback (runHeuristicSimulation) that classifies sentiment/sector via keyword matching (e.g. "surge", "profit", "crash", "probe") so results are always populated even with no AI provider configured.

What the AI actually determines per headline:

Sentiment — bullish / bearish / neutral, driven purely by likely short-term price impact.

Explanation — a plain-language, ≤18-word reason (used for the "Why is it moving today?" panel).

Sector — one of 13 fixed NSE sector buckets (Banking & Financial Services, IT, Pharma & Healthcare, Auto, FMCG, Energy & Power, Metals & Mining, Realty, PSU, Media & Entertainment, Infrastructure, Telecom, Other/Macro).

Impact horizon — intraday / short-term / structural.

Confidence — low / medium / high.

Is market-wide — whether the news is macro/broad-market vs. stock-specific.

Processing runs in batches (SENTIMENT_BATCH_SIZE) with a delay between batches (SENTIMENT_BATCH_DELAY_MS) to respect free-tier rate limits, and preserves already-analyzed sentiment across RSS re-fetches so re-polling never wipes out prior AI work.

🔄 Project Workflow
flowchart LR
    A[RSS Feeds + NSE India APIs] --> B[Backend Ingestion\nrssFetcher / ipoStore / fiiDiiService]
    B --> C[AI Analysis\nGemini → Groq → Heuristic]
    C --> D[In-memory Store\n+ data/fiiDiiHistory.json]
    D --> E[Express REST API\n/api/news /api/ipo /api/fii-dii]
    E --> F[React Dashboard\nFlashcards / Feed / IPO / FII-DII / Stock Detail]
    F --> G[User]

🔐 Security Notes
All SQL queries use parameterized tagged templates — no string-concatenated or raw-interpolated queries.

Sessions are DB-backed (not purely stateless JWTs), so they can be revoked server-side at any time.

API is protected with Helmet security headers and rate limiting (general, auth-specific, and refresh-specific limits).

CORS is configurable via ALLOWED_ORIGINS in .env (comma-separated) for production; defaults to permissive for local development.

.env is git-ignored — see .env.example for the required variable names without real values.

🗺 Roadmap / Future Scope
The following were presented as the product vision in the Build With Bharat pitch but are not present in the current codebase. They are listed here, not under Features, per the team's own scope distinction between "Module 1 · Market Intelligence" (built) and "Module 2 · PaperDesk" (pitched):

PaperDesk practice trading — large virtual capital allocation, live-price simulated order execution (market & limit orders), positions and portfolio tracking, P&L/TradeBook reports, integration against a broker API for realistic order simulation.

Portfolio Analyzer & Analytics — mark-to-market allocation and risk view across a user's paper portfolio.

Real-time price alerts via Telegram Bot API.

Push notifications (Firebase Cloud Messaging).

Live NSE/BSE price-feed integration to replace the current client-side simulated watchlist prices.

Mobile app — the pitch's tech-stack slide lists React Native/Flutter; the current frontend is a Vite web SPA.

Cloud deployment / containerization — the pitch mentions AWS/GCP, Docker, and CI/CD; none of this exists in the repository yet.

👥 Contributors
Team QuadCore — Build With Bharat National-Level Hackathon, NIT Delhi

Shlok Modi — R&D / Backend Development
GitHub · LinkedIn · LeetCode

Shivam Rattan — R&D / Frontend Development

Somya Garg — Backend Development

All three contributors worked together on the design, research, architecture, and implementation of the project.

📄 License
No license has been added to the repository yet. Until a LICENSE file is committed, the project should not be represented as MIT-licensed.

🙏 Acknowledgements
Build With Bharat — National Level Hackathon, for the platform and problem statement.

NSE India (nseindia.com) — public data source for IPO listings and FII/DII institutional flow figures.

Chittorgarh / InvestorGain — live IPO Grey Market Premium data.

Google Gemini and Groq — AI sentiment analysis providers.

ET Markets, Moneycontrol, Livemint, The Hindu BusinessLine, CNBC-TV18, Google News — RSS news sources powering the intelligence feed.

The open-source maintainers of React, Vite, Express, rss-parser, google-auth-library, and @neondatabase/serverless.

<div align="center">

Built with ☕ and too many browser tabs by Team QuadCore at Build With Bharat.

</div>

