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

- **main.js** — App entry: fetches `data.json`, renders page title with bio and social links, card grid, footer text and badge, floating dev palette
- **config.js** — User config: username, title, bio (overrides GitHub defaults), show bio toggle, sort order, header alignment, footer text/alignment/show toggle, social links (github, twitter, blog, email), per-repo settings (hidden, order, screenshot)
- **sync.js** — Node script: GitHub API (public, no auth) → `data.json` (user profile + repos, paginated). Only fetches public repos.
- **dev-config.js** — Dev-only: pointer-event drag-drop card reorder with FLIP animations, image picker/upload, visibility toggle (eye/eye-off replaces card arrow), saves config via Vite middleware. Has its own `renderIcons()` wrapper that cleans `data-lucide` attrs after rendering.
- **vite.config.js** — Dev server with custom middlewares (`/__sync`, `/__save-config`, `/__upload-image`, `/__list-images`, `/__delete-image`); custom `serialize()` writes JS not JSON. `config.js` is excluded from file watcher to avoid HMR loops.
- **data.json** — Generated file, not committed. Contains `{user, repos, synced_at}`

## Key Patterns

- **Dev-mode features** gated behind `import.meta.env.DEV` (sync, preview, settings modal, drag-drop, visibility toggle, image upload)
- **Dev palette**: fixed floating pill at bottom center (`#dev-palette`), dark bg with light icons. Contains sync, preview, settings buttons. Preview mode hides sync+settings, only shows the toggle button.
- **Social links**: displayed under the bio in `#page-title` (not in a navbar). GitHub, Twitter, blog, email (mailto: with regex validation). Built by `buildSocialLinks(user)`.
- **Settings modal** (dev-only): organized in sections (Header, Links, Footer). Title and bio inputs use GitHub values as placeholders; only custom overrides are stored in config. Footer has text field, show/hide toggle, and alignment. Changes apply live in-memory; saved to `config.js` on close only (no HMR trigger).
- **Preview mode**: toggle between dev (globe icon = "go to preview") and production (code icon = "back to dev"). Icons show destination, not current state.
- **Hidden repos**: shown in dev mode with grayscale filter + `::after` overlay (bg at 0.65 opacity), no hover shadow; card-arrow stays fully opaque (z-index: 2). Visibility toggled via click on card arrow (eye/eye-off)
- **Drag & drop reorder**: pointer events (not HTML5 drag API). Card goes `position: fixed` following cursor, placeholder takes its slot in grid. Slot detection via grid geometry (`getGridSlot`). FLIP animation (`movePlaceholder`) for smooth card shifting. `requestAnimationFrame` throttle. File drops (images) still use HTML5 drag events.
- **Card arrow icon**: `getCardIcon(repo)` returns `smartphone` for App Store / Play Store links, `globe` for other external links, `github` otherwise
- **Config updates** in dev go through Vite middleware → file write (no module invalidation)
- **Rendering**: `renderHeader(user)` builds title+bio+social links+footer+dev palette, `buildSocialLinks(user)` generates social link HTML, `renderCard(repo, i)` builds each card, `renderGrid(repos)` handles filtering/sorting
- **Lucide icons**: `refreshIcons()` calls `createIcons()` then removes `data-lucide` attrs from rendered SVGs to prevent warnings on subsequent calls. `dev-config.js` uses its own `renderIcons()` wrapper with the same cleanup.
- **HTML escaping** via `escapeHTML()` on all user-provided content
- **CSS variables** from Tailwind neutral palette: `--bg` (neutral-100/200 mix), `--surface` (neutral-50), `--text` (neutral-800), `--text-2` (neutral-500), `--text-3` (neutral-400), `--icon-border` (text at 8%), `--toggle-on`, `--radius`, `--gap`
- **Light theme only** (dark mode removed — see git history for `[data-theme="dark"]` variables)
- **Page title** uses `display: flex; flex-direction: column` with `align-items` driven by alignment setting (center/left/right via `[style*="center"]` CSS selector)
- **Footer alignment** uses `align-items` (flex), not `text-align`
- **Grid** is 3 cols → 2 cols (≤1100px) → 1 col (≤680px), cards are always square (`aspect-ratio: 1`)

## Style

- Font: Geist (primary), Inter (fallback)
- All colors from Tailwind neutral palette, referenced via CSS variables. Opacity variants use `color-mix(in srgb, var(--text) N%, transparent)`.
- Icon buttons (`.icon-btn`): shared style for social links and dev palette — subtle border (`--icon-border`), 36px, border-radius 10px, hover shows border + surface bg. Social links have a hover lift (`translateY(-2px)`).
- Card arrow: top-right, border-radius 10px, `color-mix` bg at 6% text, replaced by eye/eye-off in dev mode. Remove-image button uses same style.
- Cards: no border, hover lifts with `translateY(-3px) scale(1.01)` + shadow
- Footer: copyright text (configurable, toggleable) + "Made with GitGrid" badge pill
- Card footer: language metadata line + title row with star count aligned right
