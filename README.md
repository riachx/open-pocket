# Open Pocket

A React + TypeScript app with a Node/Express + SQLite backend that helps you explore U.S. politicians’ committees, corporate connections, and recent votes. It aggregates FEC committee data, corporate PAC links, and industry connections and presents them with a clean UI powered by Chakra UI.

[![Watch the video](https://img.youtube.com/vi/99JXE8DeNJA/hqdefault.jpg)](https://youtu.be/99JXE8DeNJA)

## Inspiration

The United States is in a politically complex and pivotal moment. We wanted to make a meaningful impact by helping people better understand the flow of money in politics. Super PACs and PACs wield significant influence, often shaping outcomes behind the scenes. Open Pocket aims to surface those financial relationships in a transparent and navigable way. R

## Features

- Politician profile with:
  - Recent House vote info via Congress.gov API
  - Affiliated committees and contribution totals
  - Corporate connections grouped by industry
- Explore contributions by industry sectors (e.g., Pharmaceuticals, Military & Defense, Oil & Gas)
- Track industry influence across senators and representatives
- SQLite database (`src/services/politicaldata.db`) seeded with FEC-derived tables

## Tech Stack

- Frontend: React, TypeScript, Vite, Chakra UI
- Backend: Node.js (Express) in `src/server.js`
- Data/Services: Python utilities in `src/services/*.py`, SQLite (`politicaldata.db`)

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.x
- SQLite (CLI optional but useful)

### 1) Install dependencies
```bash
npm install
```

### 2) Environment variables
Create `.env` or `.env.local` (Vite-compatible) in the project root:
```bash
VITE_CONGRESS_API_KEY=your_congress_gov_api_key
```
This key is used by the frontend to fetch vote details from Congress.gov.

### 3) Database
The app uses a SQLite database located at:
```
src/services/politicaldata.db
```
It contains tables for committees, candidate linkages, and optionally `linkedin_companies`.

Initialize/update schema (optional):
```bash
python src/services/initialize_db.py
```

### 4) Run the backend
```bash
node src/server.js
```
By default it serves the API on http://localhost:3001.

### 5) Run the frontend
```bash
npm run dev
```
Vite will start the app (typically on http://localhost:5173).

## How We Built It

- Back-end
  - Node.js/Express server for API endpoints and request handling
  - SQLite for fast, local querying of large FEC-derived datasets
  - Python data-processing scripts to transform raw FEC text files into queryable tables
  - Candidate- and industry-specific endpoints to support the UI
- Front-end
  - Figma for rapid prototyping
  - React + TypeScript + Chakra UI for fast iteration and clean component design
  - Keyword-based industry classifier to robustly categorize companies when third-party APIs are limited

## Challenges

- Data scale: FEC text files are massive (gigabytes). Attempting to import to MongoDB quickly exhausted storage. SQLite proved significantly faster for parsing and querying locally.
- API instability/limits (as of April):
  - OpenSecrets API unavailable
  - OpenFEC rate-limited (≈40 calls/hour)
  - Congress.gov unstable; ProPublica Congress API deprecated; Google Civic slow/limited
  - We pivoted to downloading and parsing the data ourselves with SQLite, which yielded very fast queries once structured
- Learning curve: Working with very large datasets and unfamiliar political finance terminology

## Accomplishments

- Built a full-stack system as a team of two, despite multiple API failures
- Switched to a self-hosted data pipeline (SQLite) and effectively made a tailored “internal API” for our needs
- Experimented with new tech: Model Context Protocol ideas, SQLite-based analytics, and robust data wrangling

## What We Learned

- Extreme improvisation pays off: when external APIs failed, building our own pipeline with SQLite let us move forward quickly
- Practical strategies for handling large, messy public datasets and turning them into fast queries and usable UI

## What’s Next for Open Pocket

- Reintegrate external data sources when they stabilize (e.g., the returning OpenSecrets API) to enhance scope and accuracy
- Ship an AI agent powered by a Model Context Protocol server connected to our database for natural-language Q&A about politicians’ finances
- Expand UI to include deeper “active industries” views and top-donating PACs per politician, integrated directly into the profile pages

## Key Pages

- `src/pages/Politician.tsx` – Main profile view with Committees, Industries, and Recent Votes
- `src/pages/IndustryDetail.tsx` – Deeper dive for a specific industry

## Data Flow (High-level)

- Frontend fetches politician details and UI sections from the backend API
- Backend calls Python helpers to read from `politicaldata.db` and assemble committee and corporate-connection data
- Industry grouping uses a keyword-based classifier to ensure every company gets a reasonable category even if LinkedIn data is sparse

## API Endpoints (selected)

- GET `http://localhost:3001/api/congressman/:id`
  - Returns the politician record used by `Politician.tsx`
- GET `http://localhost:3001/api/senator/:id/committees`
  - Returns affiliated committees and summary stats
- GET `http://localhost:3001/api/senator/:id/industries`
  - Returns companies grouped by industry; uses keyword-based classification as a fallback
- GET `http://localhost:3001/api/politician/:lastName/industries?firstName=Optional`
  - Alternative industry view by name

Note: The frontend passes `VITE_CONGRESS_API_KEY` as `x-api-key` where required.

## Troubleshooting

- Industries all show “Unknown”
  - Ensure frontend classification is running: refresh and check browser console logs from `Politician.tsx`
  - Verify the backend at http://localhost:3001 is running
  - Confirm `VITE_CONGRESS_API_KEY` is set for vote lookups (not required for industry classification but useful for the page)
- DB file not found
  - Confirm `src/services/politicaldata.db` exists; re-run `python src/services/initialize_db.py` if needed

## Project Structure (partial)

```
src/
  pages/
    Politician.tsx
    IndustryDetail.tsx
  components/
    RecentVoteInfo.tsx
    ChatBot.tsx
    CongressmanBanner.tsx
  services/
    server.js          # Express API
    *.py               # Python helpers, DB utilities
    politicaldata.db   # SQLite database
```

## License
MIT (or project-specific license if different).
