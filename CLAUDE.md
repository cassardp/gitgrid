# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server (localhost:5173), proxies /api + /img to Worker
npm run build      # Vite build → gitgrid-worker/public/
npm run preview    # Preview production build
npm run deploy     # Build + wrangler deploy
```

Worker (in `gitgrid-worker/`):
```bash
npm run dev        # wrangler dev (localhost:8787)
npm run deploy     # wrangler deploy
```

## Architecture

Vanilla JS portfolio platform deployed on Cloudflare Workers + D1 + R2. Users log in with GitHub, repos are synced and displayed as a card grid. No framework.

### Frontend (`/`)

- **main.js** — App entry: fetches portfolio data from `/api/portfolio/:username`, checks auth via `/api/auth/me`, renders header (title + bio + social links), card grid, footer, floating edit palette for owner
- **dev-config.js** — Edit-mode features (loaded dynamically when `isOwner`): pointer-event drag-drop card reorder with FLIP animations, image picker/upload to R2, visibility toggle (eye/eye-off). Has its own `renderIcons()` wrapper.
- **vite.config.js** — Build output to `gitgrid-worker/public/`, dev proxy for `/api` and `/img` to Worker on port 8787
- **index.html** — SPA shell
- **style.css** — All styles

### Worker (`gitgrid-worker/`)

- **src/index.ts** — Router: `/api/*` → handlers, `/img/*` → R2 serve, else → `env.ASSETS.fetch()` (SPA fallback)
- **src/auth.ts** — GitHub App install+auth flow (login → callback → session cookie HMAC-SHA256 signed), session verification, account deletion
- **src/config.ts** — GET/PUT user config
- **src/sync.ts** — POST: fetch GitHub profile + repos (public + private) with user's token → store in D1 `repos_data`
- **src/images.ts** — Upload/list/delete images via R2, serve with immutable cache
- **src/portfolio.ts** — GET public: config + repos + user. Visitors see public repos + private repos with homepage only. Owner sees all. Zero GitHub API calls.
- **schema.sql** — D1 schema: `users` (github_id, username, access_token, config JSON, repos_data JSON) + `images` (user_id, r2_key, repo_name)
- **wrangler.jsonc** — Bindings: D1, R2, ASSETS with `run_worker_first: true` + SPA fallback

### Data flow

- **Auth**: GitHub App installation flow (`/apps/gitgrid-app/installations/new`) → OAuth callback → user access token → D1. Session = HMAC-signed user ID in HttpOnly cookie. Timing-safe HMAC verification via `crypto.subtle.verify`.
- **Sync**: User's token → GitHub API (profile + all repos, public + private) → D1 `repos_data`. Each user uses their own rate limit (5000 req/h).
- **Public pages**: Served from D1 `repos_data` cache, zero GitHub API calls. Private repos without homepage are filtered out for visitors.
- **Account deletion**: `DELETE /api/auth/delete` with username confirmation. Deletes user, config, images (R2 + D1), clears session cookie.
- **Images**: Client uploads to `/api/images` → R2. Served at `/img/:key` with immutable cache.
- **Config**: JSON stored in D1 `config` column. GET is public, PUT requires auth.

## Key Patterns

- **Edit-mode features** gated on `isOwner` (authenticated + same username). Edit palette, drag-drop, visibility toggle, image upload, settings modal.
- **First login auto-sync**: If owner visits their page with no data, SPA auto-triggers `POST /api/sync` and renders after completion.
- **Dev palette**: fixed floating pill at bottom center (`#dev-palette`), dark bg with light icons. Contains sync, preview, settings buttons. Event listeners attached once at creation time.
- **Social links**: displayed under the bio in `#page-title`. GitHub, Twitter, blog, email (mailto: with regex validation). Built by `buildSocialLinks(user)`.
- **Settings modal**: organized in sections (Header, Links, Footer, Danger zone). Title and bio inputs use GitHub values as placeholders. Changes apply live via `renderWithDevConfig`; saved to API on modal close. Danger zone: delete account with username confirmation.
- **Preview mode**: toggle between edit (globe icon) and production (code icon). Icons show destination, not current state.
- **Hidden repos**: shown in edit mode with grayscale filter + overlay. Visibility toggled via click on card arrow (eye/eye-off).
- **Drag & drop reorder**: pointer events (not HTML5 drag API). FLIP animation for smooth card shifting. `requestAnimationFrame` throttle. File drops (images) use HTML5 drag events.
- **Card arrow icon**: `getCardIcon(repo)` returns `smartphone` for App Store links, `globe` for other external links, `github` otherwise
- **Rendering**: `renderHeader(user)` builds title+bio+social links+footer, `renderCard(repo, i)` builds each card, `renderGrid(repos)` handles filtering/sorting, `renderWithDevConfig(repos)` re-inits edit features after DOM changes
- **Lucide icons**: `refreshIcons()` calls `createIcons()` then removes `data-lucide` attrs to prevent warnings on subsequent calls.
- **HTML escaping** via `escapeHTML()` on all user-provided content
- **Boolean config defaults**: `showBio` and `showFooter` default to `true` (check `!== false`, not truthy)
- **CSS variables** from Tailwind neutral palette: `--bg`, `--surface`, `--text`, `--text-2`, `--text-3`, `--icon-border`, `--toggle-on`, `--radius`, `--gap`
- **Light theme only**
- **Page title** uses flex column with `align-items` driven by CSS attribute selectors on `style.textAlign`
- **Footer alignment** uses `align-items` (flex), not `text-align`
- **Grid** is 3 cols → 2 cols (≤1100px) → 1 col (≤680px), cards are always square (`aspect-ratio: 1`)

## Style

- Font: Geist (primary), Inter (fallback)
- All colors from Tailwind neutral palette via CSS variables. Opacity variants use `color-mix()`.
- Icon buttons (`.icon-btn`): subtle border, 36px, border-radius 10px. Social links have hover lift.
- Cards: no border, hover lifts with translateY + scale + shadow
- Footer: copyright text (configurable, toggleable) + "Made with GitGrid" badge pill
