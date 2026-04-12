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

- **main.js** — App entry: fetches `data.json`, renders navbar (social links + dev buttons), page title with bio, card grid, and footer badge
- **config.js** — User config: username, title, bio visibility, theme, sort order, alignment, social links (github, twitter, blog), per-repo settings (hidden, order, screenshot)
- **sync.js** — Node script: GitHub API (public, no auth) → `data.json` (user profile + repos, paginated). Only fetches public repos.
- **dev-config.js** — Dev-only: drag-drop card reorder, image upload, visibility toggle (eye/eye-off replaces card arrow), saves config via Vite middleware
- **vite.config.js** — Dev server with custom middlewares (`/__sync`, `/__save-config`, `/__upload-image`, `/__list-images`, `/__delete-image`); custom `serialize()` writes JS not JSON. `config.js` is excluded from file watcher to avoid HMR loops.
- **data.json** — Generated file, not committed. Contains `{user, repos, synced_at}`

## Key Patterns

- **Dev-mode features** gated behind `import.meta.env.DEV` (sync, preview globe/code toggle, settings modal, drag-drop, visibility toggle, image upload)
- **Navbar layout**: social links (GitHub, Twitter, blog) always visible; dev buttons (sync, preview, settings) separated by a dot, dev-only
- **Settings modal** (dev-only): organized in sections (Profile, Appearance, Links). Edits title, bio, show bio toggle, text alignment (left/center/right), dark theme toggle, social links. Changes apply live in-memory; saved to `config.js` on close only (no HMR trigger).
- **Preview mode**: toggle between dev (code icon, shows hidden repos) and production (globe icon, hides excluded repos)
- **Hidden repos**: shown in dev mode with reduced opacity (0.35), eye-off icon on card arrow; toggled via click on card arrow
- **Config updates** in dev go through Vite middleware → file write (no module invalidation)
- **Rendering**: `renderHeader(user)` builds navbar+title+bio+footer, `buildSocialLinks(user)` generates social link HTML (shared by header and settings), `renderCard(repo, i)` builds each card, `renderGrid(repos)` handles filtering/sorting
- **HTML escaping** via `escapeHTML()` on all user-provided content
- **CSS variables** for theming: `--bg`, `--surface`, `--text`, `--text-2`, `--text-3`, `--icon-border`, `--toggle-on`, `--radius`, `--gap`
- **Light/dark** via `[data-theme]` attribute on `<html>`, managed in settings modal
- **Grid** is 3 cols → 2 cols (≤1100px) → 1 col (≤680px), cards are always square (`aspect-ratio: 1`)

## Style

- Font: Geist (primary), Inter (fallback)
- All colors neutral, no hardcoded values outside CSS variables
- Icon buttons (`.icon-btn`): shared style for navbar and social links — subtle border (`--icon-border`), 36px, border-radius 10px, hover shows border + surface bg
- Footer badge: "Built with GitGrid" pill, contrasted (dark on light, surface on dark)
- Card footer: language metadata line + title row with star count aligned right
- Card arrow: top-right, round, replaced by eye/eye-off in dev mode
