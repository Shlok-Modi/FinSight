# 📈 FinSight

**Financial market intelligence platform** covering live news sentiment, IPO tracking, and FII/DII flow data — built for the **Built With Bharat National Hackathon**, where it placed **2nd Runner-Up among 300+ teams**, with finals hosted at Microsoft Gurugram.

Also includes **PaperDesk**, a full-featured paper-trading simulator with ₹1,00,00,000 virtual capital and live NSE/BSE feeds, integrated as FinSight's risk-free trading module.

<br>

## ✨ Features

- **AI News Sentiment** — Pulls live market headlines via RSS from major financial outlets (Economic Times, Moneycontrol, Livemint, CNBC-TV18, and more), then tags each as bullish/bearish using Gemini (with a Groq fallback) alongside a plain-language explanation of the likely market impact.
- **IPO Intelligence** — Live IPO listings from NSE India, enriched with Grey Market Premium (GMP) data.
- **FII/DII Flow Tracker** — Daily net institutional flow figures sourced from NSE, refreshed automatically in the background.
- **Google Sign-In & Sessions** — OAuth-based login with JWT session tokens, backed by a Postgres sessions table (not just stateless tokens — sessions can be revoked server-side).
- **Paper Trading (PaperDesk)** — Live order placement, portfolio tracking, and holdings/watchlist management against the Angel One broker API, without risking real capital.

<br>

## 🏗️ Architecture

```
finsight/
├── module1-client/     # React 19 + Vite frontend
└── module1-server/     # Node.js + Express backend
```

**Backend** — Node.js, Express 5, PostgreSQL (Neon serverless), parameterized SQL queries throughout (no raw string interpolation), JWT auth with DB-backed session verification, rate-limited and secured with Helmet.

**Frontend** — React 19, Vite, Lucide icons.

<br>

## 🔌 API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/news` | GET | List stored, sentiment-tagged headlines |
| `/api/news/:id` | GET | Single headline lookup |
| `/api/news/refresh` | POST | Re-fetch RSS feeds now (rate-limited) |
| `/api/news/analyze` | POST | Trigger sentiment analysis on unprocessed headlines |
| `/api/ipo` | GET | Live IPO listings + GMP data |
| `/api/fii-dii` | GET | FII/DII daily net flows (`?days=N`) |
| `/api/fii-dii/import` | POST | Import historical FII/DII data |
| `/api/auth/config` | GET | Public auth config (Google Client ID) |
| `/api/auth/google` | POST | Sign in with a Google ID token |
| `/api/auth/me` | GET | Get current session's user profile |
| `/api/auth/logout` | POST | Revoke the current session |

<br>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) Postgres database (free tier works)
- API keys: [Google AI Studio](https://aistudio.google.com/apikey) (Gemini), optionally [Groq](https://console.groq.com/keys) as fallback, [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth Client ID)

### 1. Clone and install

```bash
git clone https://github.com/Shlok-Modi/FinSight.git
cd FinSight/finsight

cd module1-server && npm install
cd ../module1-client && npm install
```

### 2. Configure environment variables

```bash
cd module1-server
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — your Neon connection string
- `GEMINI_API_KEY` / `GROQ_API_KEY` — for sentiment analysis
- `GOOGLE_CLIENT_ID` — for Google Sign-In
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- `IPOALERTS_API_KEY` — optional, for IPO data

### 3. Run

```bash
# Backend (from module1-server/)
npm start

# Frontend (from module1-client/, separate terminal)
npm run dev
```

The backend runs on `http://localhost:4000`, the frontend on Vite's default dev port.

<br>

## 🔐 Security Notes

- All SQL queries use parameterized tagged templates — no string-concatenated queries.
- Sessions are DB-backed (not purely stateless JWTs), so they can be revoked server-side.
- API is protected with [Helmet](https://helmetjs.github.io/) security headers and rate limiting (general, auth-specific, and refresh-specific limits).
- CORS is configurable via `ALLOWED_ORIGINS` in `.env` (comma-separated) for production; defaults to permissive for local development.
- `.env` is git-ignored — see `.env.example` for the required variable names without real values.

<br>

## 👥 Team

FinSight is being developed collaboratively by:

**Shlok Modi**
R&D / Backend Development

**Shivam Rattan**
R&D / Frontend Development

**Somya Garg**
Backend Development

All three contributors are working together on the design, research,
architecture, and implementation of the project.

[GitHub](https://github.com/Shlok-Modi) · [LinkedIn](https://linkedin.com/in/shlok-modi) · [LeetCode](https://leetcode.com/u/Shlok_Modi_05/)
