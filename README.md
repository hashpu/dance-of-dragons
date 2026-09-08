# Dungeons & Dragons

A lore/community site for a Game of Thrones–genre Roblox group: house family trees,
a Dance of the Dragons timeline, factions overview, a Roblox build showcase, a
department application system, and Discord sign-in.

## Architecture

- **Frontend** — plain HTML/CSS/JS (no build step, no framework) in the project root.
- **Backend** — Node.js + Express, in `server/`, talking to **PostgreSQL**.
- One Express server serves both the REST API (`/api/*`) and the static frontend
  files, so in production it's a single deployable app on one origin (no CORS
  needed between them).

```
gamewebsite/
├── index.html, house.html, timeline.html, ...   ← frontend pages
├── css/style.css
├── js/                                          ← frontend JS (fetches /api/*)
└── server/                                      ← backend
    ├── app.js, index.js                         ← Express app + entry point
    ├── db.js, schema.sql, migrate.js, seed.js    ← PostgreSQL
    ├── routes/                                   ← houses, applications, admin
    └── test/                                     ← automated tests (no DB needed)
```

## Running it locally

You need [Node.js](https://nodejs.org) 18+ and a PostgreSQL database (local
install, Docker, or a free hosted one like [Neon](https://neon.tech) or
[Supabase](https://supabase.com)).

```bash
cd server
npm install
cp .env.example .env      # then edit .env: set DATABASE_URL, ADMIN_SECRET, etc.
npm run migrate           # creates the tables
npm run seed              # loads the default houses/lore
npm start                 # http://localhost:3001
```

Open `http://localhost:3001` — that's the whole site, frontend and API together.

**No Postgres installed yet and just want to look around?** `npm run demo` runs
the real server against an in-memory database (seeded automatically, resets
whenever you restart it). It's for a quick look only — `npm start` with a real
`DATABASE_URL` is the real thing.

## Running the tests

```bash
cd server
npm test
```

The test suite (`node --test`) exercises every route through the real Express
app, using an in-memory Postgres-compatible engine (`pg-mem`) instead of a real
database — no setup required to run it.

## Configuration (`server/.env`)

See `server/.env.example` for the full list. The important ones:

- `DATABASE_URL` — your Postgres connection string.
- `ADMIN_SECRET` — required in an `x-admin-secret` header to reset all data or
  view submitted applications. Since house/member data is now shared across
  every visitor (not per-browser like before), this gates the destructive
  "reset everything" action.
- `WEBHOOK_<DEPARTMENT>` — optional Discord webhook URLs (one per Apply
  department) to auto-post new applications into a channel. Leave unset and
  applications are still saved to the database — you just won't get a Discord
  ping for them. These live server-side only now, so — unlike a client-side
  webhook — they're never exposed in page source.

## Discord sign-in

`js/auth.js` implements Discord OAuth2 (implicit grant, client-side only — no
server session). It needs the site's own root URL (e.g.
`https://your-site.onrender.com/`) registered as a valid OAuth2 redirect in
the [Discord Developer Portal](https://discord.com/developers/applications)
for this app (Discord allows multiple redirects, so this can sit alongside
any existing one). The redirect always lands back at the root; `js/nav.js`
picks the token up from there and returns the user to whichever page they
started sign-in from. It won't work opened as a local file — OAuth redirects
require http/https.

## Deploying

This is a single Node process (Express serves the frontend too), so it fits
platforms built for that directly — [Render](https://render.com),
[Railway](https://railway.app), or [Fly.io](https://fly.io) are good fits, each
with an add-on/managed Postgres. Point `DATABASE_URL` at that database, run
`npm run migrate && npm run seed` once, then start the app.

Uploaded application images are stored on local disk under `server/uploads/` —
on hosts with an ephemeral filesystem (e.g. free-tier Render), that folder is
wiped on redeploy. For images to persist long-term in production, attach a
persistent volume or switch that storage to an object store (S3-compatible).

Netlify/Vercel-style static hosting won't work for the backend on its own
(they don't run a persistent Node server) — either use one of the platforms
above, or adapt the routes to serverless functions.
