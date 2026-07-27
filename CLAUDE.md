# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GitGrid is a portfolio platform: users log in with GitHub, their repos are synced and displayed as a card grid on a public page. Vanilla JS frontend (no framework, no bundler beyond Vite), Cloudflare Worker backend with D1 + R2, deployed on the custom domain gitgrid.app.

## Commands

Frontend (repo root):

```bash
npm run dev        # Vite dev server (localhost:5173), proxies /api and /img to the Worker
npm run build      # Vite build into gitgrid-worker/public/
npm run deploy     # Build + wrangler deploy
```

Worker (`gitgrid-worker/`):

```bash
npm run dev        # wrangler dev (localhost:8787)
npm run deploy     # wrangler deploy
```

## Architecture

- **Frontend**: `main.js` is the SPA entry (fetch portfolio, render header/grid, auth check); `dev-config.js` is loaded dynamically for the owner only and carries all edit-mode features (reorder, image upload, settings). CSS is modular under `styles/`.
- **Worker** (`gitgrid-worker/src/`): `index.ts` routes `/api/*` to handlers, `/img/*` to R2, injects OG meta tags for `/:username` pages, falls back to `ASSETS` (SPA). One file per domain: `auth.ts`, `sync.ts`, `portfolio.ts`, `config.ts`, `images.ts`, `screenshot.ts`.
- **Auth**: GitHub App OAuth with a `state` cookie (CSRF), session is an HMAC-SHA256-signed user id in an HttpOnly cookie, GitHub access tokens are encrypted at rest (AES-GCM derived from `HMAC_KEY`).
- **Sync**: the user's own token fetches profile + repos from the GitHub API into D1 `users.repos_data`. Public pages are served entirely from that D1 cache: zero GitHub API calls on visits.
- **Images**: optimized client-side (canvas to WebP) then uploaded to R2; the Worker validates content-type whitelist, 5MB max and repo name. `screenshot.ts` captures repo homepages via Browser Rendering (`BROWSER` binding, `@cloudflare/puppeteer`).
- **D1 schema** (`schema.sql`): `users` (github_id, username, access_token, `config` JSON, `repos_data` JSON), `images`, `views`.

## Security invariants

- All user-provided content rendered into HTML goes through `escapeHTML()`, including attribute values (`href`, `src`).
- All user-provided URLs go through `sanitizeURL()`, which rejects non-http(s) protocols; external links carry `rel="noopener noreferrer"`.
- Any new write endpoint must check the session (`getSessionUser`) and validate its inputs like `config.ts` and `images.ts` do (whitelists, size caps, regexes).
