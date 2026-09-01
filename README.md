# moooney

A fast, minimal personal expense tracker. The core idea: **spend money → record it in under 5 seconds.**

Type a sentence like "Target $43.28 home supplies" or snap a photo of a receipt — AI extracts the transaction, you confirm or edit, and it's saved.

## Features

- **Natural language capture** — "Lunch at Din Tai Fung $36.50" → parsed into amount, merchant, category, date, description, type
- **Receipt scanning** — photo or upload → merchant, date, total, items, suggested category; the original receipt image is kept with the transaction
- **Always a confirm step** — the AI never saves silently; uncertain fields are left blank for you to fill in, never guessed
- **Manual entry** — same quick form, no AI required
- Three screens only: **Home** (this month's spend, today, income, balance, category breakdown, recent transactions), **Add**, **History** (search, month + category filters, edit, delete)
- Installable as a PWA — works fully offline-capable and can be added to your iPhone Home Screen
- Optional PIN lock — no accounts, just a single local passcode if you want one

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via Drizzle ORM (`@libsql/client`) — a single local file, no database server to run
- OpenAI-compatible API for parsing (works with OpenAI or any compatible endpoint)
- `next-pwa` for offline/installable support

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_PATH` | No | Path to the SQLite file (defaults to `./data/app.db`) |
| `OPENAI_API_KEY` | Yes | Needed for AI parsing of text/receipts |
| `OPENAI_BASE_URL` | No | Point at any OpenAI-compatible endpoint |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o` |
| `APP_PIN` | No | Set to lock the app behind a PIN screen. Leave blank to run with no lock |
| `APP_SECRET` | No | Any random string — required if `APP_PIN` is set |

No database setup needed — the SQLite file and its table are created automatically on first run.

### 3. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Using it on your iPhone

1. Run the app somewhere reachable from your phone (see Docker below for a simple always-on option on your home network), or use `npm run dev` while on the same Wi-Fi and open `http://<your-computer's-ip>:3000`.
2. Open the URL in Safari.
3. Share icon → **Add to Home Screen**.
4. It launches full-screen, no browser chrome, like a native app.

## Docker

```bash
npm run docker:build
npm run docker:run
```

The SQLite database lives at `/app/data/app.db` inside the container — mount a volume there (already configured) so your data survives restarts.

## Project structure

```
src/
├── app/
│   ├── actions/       # Server actions (AI extraction, save/update/delete, unlock)
│   ├── add/            # Add screen (input → confirm → save)
│   ├── history/         # History screen + edit/detail page
│   ├── unlock/          # PIN screen
│   └── page.tsx         # Home screen
├── components/         # React components (incl. shadcn/Radix UI primitives)
├── db/                 # Drizzle schema + SQLite connection
└── lib/                # Categories, OpenAI client/prompt, PIN hashing, utils
```

## Security notes

- Never commit `.env.local`
- The PIN lock is a convenience gate for casual access, not real authentication — don't rely on it for sensitive data on a publicly reachable deployment
