# GitGrid

> Work in progress — lots of features still to come.

A minimal portfolio generator that turns your GitHub repos into a clean card grid. No framework, no database — just a static site you configure locally and deploy anywhere.

**[Live demo](https://gitgrid.vercel.app/)**

## How it works

1. **Sync** — Pulls your public repos and profile from the GitHub API
2. **Configure** — A local dev mode lets you reorder cards (drag & drop), upload screenshots, hide repos, edit title/bio/theme/social links via a settings modal
3. **Deploy** — Builds a static `dist/` folder, deployable on Vercel, Netlify, or any static host

All configuration lives in `config.js`. No account needed, no backend, no API keys for public repos.

## Quick start

```bash
npm install
npm run dev        # Dev server with admin tools (localhost:5173)
```

In dev mode you get:
- Drag & drop to reorder cards
- Click the eye icon on any card to show/hide it
- Upload screenshots per repo
- Settings modal (gear icon) for title, bio, theme, social links

When you're happy with the result:

```bash
npm run build      # Syncs from GitHub + builds to dist/
```

Deploy `dist/` wherever you want. On Vercel, just connect the repo — build command is `npm run build`, output is `dist`.

## Configuration

Everything is in `config.js`:

```js
export default {
  username: "your-github-username",
  title: "",              // Custom title (default: GitHub name)
  showBio: true,          // Show GitHub bio under title
  theme: "light",         // "light" or "dark"
  sort: "stars",          // "stars", "updated", or "name"
  github: "",             // Override GitHub profile URL
  twitter: "",            // Twitter/X handle
  blog: "",               // Website URL
  repos: {
    "repo-name": {
      hidden: true,       // Hide from portfolio
      order: 0,           // Manual sort order
      screenshot: "images/repo.png"
    }
  }
};
```

Most of this can be edited visually in dev mode via the settings modal and card interactions.

## Tech stack

- Vanilla JS — no framework
- Vite — dev server + build
- Lucide — icons
- Geist — font
- GitHub public API — no auth required

## What's next

This is an early version. Planned improvements include:

- Private repo support (via GitHub token)
- Multi-user / platform mode
- Custom domain documentation
- More card layout options
- Improved mobile experience
