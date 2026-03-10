# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server (localhost:5173)
npm run sync       # Fetch repos from GitHub API → data.json
npm run build      # sync + vite build
npm run preview    # Preview production build
```

## Architecture

Vanilla JS portfolio generator that displays GitHub repos as a card grid. No framework.

- **main.js** — App entry: fetches `data.json`, renders navbar, page title, and card grid
- **config.js** — User config: username, theme, sort order, per-repo settings (hidden, order, size)
- **sync.js** — Node script: GitHub API → `data.json` (user profile + repos, paginated)
- **dev-config.js** — Dev-only: drag-drop card reorder, image upload, saves config via Vite middleware
- **vite.config.js** — Dev server with custom middlewares (`/__sync`, `/__save-config`, `/__upload-image`); custom `serialize()` writes JS not JSON
- **data.json** — Generated file, not committed. Contains `{user, repos, synced_at}`

## Key Patterns

- **Dev-mode features** gated behind `import.meta.env.DEV` (sync button, preview toggle, drag-drop)
- **Config updates** in dev go through Vite middleware → file write → module invalidation
- **Rendering**: `renderHeader(user)` builds navbar+title, `renderCard(repo, i)` builds each card, `renderGrid(repos)` handles filtering/sorting
- **HTML escaping** via `escapeHTML()` on all user-provided content
- **CSS variables** for theming: `--bg`, `--surface`, `--text`, `--text-2`, `--text-3`, `--radius`, `--gap`
- **Light/dark** via `[data-theme]` attribute on `<html>`
- **Grid** is 3 cols → 2 cols (≤1100px) → 1 col (≤680px), cards are always square (`aspect-ratio: 1`)

## Style

- Font: Geist (primary), Inter (fallback)
- Design inspired by modern product grid layouts: white cards on #f5f5f5 bg, 16px radius, arrow button top-right
- Card footer: language metadata line + title row with star count aligned right
