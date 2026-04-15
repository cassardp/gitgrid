# GitGrid

Turn your GitHub repos into a clean portfolio. Log in with GitHub, and your repos appear as a card grid at `gitgrid.app/username`.

**[gitgrid.app](https://gitgrid.app)**

![GitGrid preview](preview.png)

## Features

- **Auto-sync** — Pulls your repos and profile from GitHub (public + private)
- **Drag & drop** — Reorder cards visually
- **Screenshots** — Upload images or auto-capture from homepage URLs (Cloudflare Browser Rendering)
- **Screenshot frames** — Portrait (phone) and landscape (browser) frames with customizable colors
- **Settings** — Title, bio, social links, footer, alignment — all editable in-app
- **Hidden repos** — Hide any repo from your public portfolio
- **Public pages** — Visitors see your portfolio with zero GitHub API calls (served from cache)
- **OG meta tags** — Dynamic Open Graph tags for link previews
- **Landing page** — Marketing page with hero image and CTA for unauthenticated visitors
- **Visit stats** — Daily/weekly visit counter shown to the portfolio owner
- **Social links** — GitHub, Twitter, blog, email, and Buy Me a Coffee
- **Show/hide card titles** — Toggle card titles from settings
- **Privacy policy** — Accessible directly from the settings modal
- **SEO** — robots.txt, dynamic sitemap (`/sitemap.xml`), and JSON-LD structured data per portfolio

## Tech stack

- **Frontend** — Vanilla JS, no framework, no bundler runtime
- **Backend** — Cloudflare Workers + D1 (SQLite) + R2 (images) + Browser Rendering
- **Auth** — GitHub App OAuth with HMAC-SHA256 sessions
- **Icons** — Lucide
- **Font** — Geist

## Project structure

```
├── main.js              # App entry
├── dev-config.js        # Edit-mode features (owner only)
├── style.css            # CSS imports hub
├── styles/              # Modular stylesheets
│   ├── variables.css    # Custom properties, reset, keyframes
│   ├── layout.css       # Page title, grid, footer
│   ├── card.css         # Cards, screenshot frames
│   ├── components.css   # Shared UI (buttons, overlays, panels)
│   ├── modal.css        # Settings modal
│   ├── editor.css       # Edit mode, image picker
│   ├── landing.css      # Landing page
│   └── responsive.css   # Breakpoints
├── index.html           # SPA shell
└── gitgrid-worker/      # Cloudflare Worker
    └── src/
        ├── index.ts     # Router
        ├── auth.ts      # GitHub OAuth
        ├── config.ts    # User config
        ├── sync.ts      # GitHub sync
        ├── images.ts    # R2 image handling
        ├── portfolio.ts # Public portfolio API
        └── screenshot.ts # Auto-screenshot capture
```

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
