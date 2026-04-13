# GitGrid

Turn your GitHub repos into a clean portfolio. Log in with GitHub, and your repos appear as a card grid at `gitgrid.app/username`.

**[gitgrid.app](https://gitgrid.app)**

![GitGrid preview](preview.png)

## Features

- **Auto-sync** — Pulls your repos and profile from GitHub (public + private)
- **Drag & drop** — Reorder cards visually
- **Screenshots** — Upload images per repo (client-side WebP optimization)
- **Settings** — Title, bio, social links, footer, alignment — all editable in-app
- **Hidden repos** — Hide any repo from your public portfolio
- **Public pages** — Visitors see your portfolio with zero GitHub API calls (served from cache)
- **OG meta tags** — Dynamic Open Graph tags for link previews

## Tech stack

- **Frontend** — Vanilla JS, no framework, no bundler runtime
- **Backend** — Cloudflare Workers + D1 (SQLite) + R2 (images)
- **Auth** — GitHub App OAuth with HMAC-SHA256 sessions
- **Icons** — Lucide
- **Font** — Geist

## Development

```bash
npm install
npm run dev          # Vite dev server (localhost:5173)
```

In a separate terminal:

```bash
cd gitgrid-worker
npm install
npm run dev          # Wrangler dev (localhost:8787)
```

The Vite dev server proxies `/api` and `/img` to the Worker.

## Deploy

```bash
npm run deploy       # Build + wrangler deploy
```

Requires a Cloudflare account with D1 and R2 configured. Secrets (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `HMAC_KEY`) are set via `wrangler secret put`.

## License

MIT
