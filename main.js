import CONFIG from "./config.js";
import { createIcons, Star, ArrowUpRight, Github, RefreshCw, Eye, Sun, Moon, Globe, Twitter } from "lucide";

let cachedData = null;
let previewMode = false;

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
  Swift: "#F05138", "Objective-C": "#438eff", Kotlin: "#A97BFF",
  Java: "#b07219", Go: "#00ADD8", Rust: "#dea584", Ruby: "#701516",
  PHP: "#4F5D95", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
  Dart: "#00B4AB", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051",
  Vue: "#41b883", Svelte: "#ff3e00", Lua: "#000080", R: "#198CE7",
  Scala: "#c22d40", Elixir: "#6e4a7e", Haskell: "#5e5086",
  Zig: "#ec915c", Nim: "#ffc200", OCaml: "#3be133",
};

function refreshIcons() {
  createIcons({ icons: { Star, ArrowUpRight, Github, RefreshCw, Eye, Sun, Moon, Globe, Twitter } });
}

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

function getTheme() {
  return localStorage.getItem("theme") || CONFIG.theme || "light";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.innerHTML = isDark
    ? `<i data-lucide="sun"></i>`
    : `<i data-lucide="moon"></i>`;
  refreshIcons();
}

function getRepoConfig(name) {
  return (CONFIG.repos && CONFIG.repos[name]) || {};
}

function isExcluded(name) {
  const rc = getRepoConfig(name);
  return rc.hidden || (CONFIG.exclude && CONFIG.exclude.includes(name));
}

function sortRepos(repos) {
  const sortBy = CONFIG.sort || "stars";
  const configured = new Set(Object.keys(CONFIG.repos || {}));
  repos.sort((a, b) => {
    const aRC = (CONFIG.repos && CONFIG.repos[a.name]) || {};
    const bRC = (CONFIG.repos && CONFIG.repos[b.name]) || {};
    const aHasOrder = typeof aRC.order === "number";
    const bHasOrder = typeof bRC.order === "number";
    if (aHasOrder && bHasOrder) return aRC.order - bRC.order;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    const aPri = configured.has(a.name) ? 0 : 1;
    const bPri = configured.has(b.name) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    if (sortBy === "stars") return b.stargazers_count - a.stargazers_count;
    if (sortBy === "updated") return new Date(b.updated_at) - new Date(a.updated_at);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });
  return repos;
}

function getRepoLink(repo) {
  return repo.homepage || repo.html_url;
}

function hasExternalLink(repo) {
  return repo.homepage && !repo.homepage.includes("github.com");
}

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function renderHeader(user) {
  const name = CONFIG.title || user.name || user.login;
  const login = user.login;

  const devBtns = import.meta.env.DEV
    ? `<button class="footer-action" id="sync-btn" title="Sync from GitHub">
          <i data-lucide="refresh-cw"></i>
        </button>
        <button class="footer-action" id="preview-btn" title="Preview production">
          <i data-lucide="eye"></i>
        </button>`
    : "";

  document.getElementById("navbar").innerHTML = `
    <div class="nav-left"></div>
    <div class="nav-right">
      ${devBtns}
    </div>
  `;

  document.getElementById("page-title").innerHTML = `
    <h1 class="title">
      <span class="title-name">${escapeHTML(name)}</span>
    </h1>
  `;

  document.title = `${name} — Portfolio`;

  // Footer
  const socialLinks = [];
  socialLinks.push(`<a class="footer-action" href="${user.html_url}" target="_blank" title="GitHub"><i data-lucide="github"></i></a>`);
  if (user.twitter_username)
    socialLinks.push(`<a class="footer-action" href="https://x.com/${user.twitter_username}" target="_blank" title="X / Twitter"><i data-lucide="twitter"></i></a>`);
  if (user.blog) {
    const url = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
    socialLinks.push(`<a class="footer-action" href="${url}" target="_blank" title="Website"><i data-lucide="globe"></i></a>`);
  }

  document.getElementById("footer-actions").innerHTML = `
    <div class="footer-icons">
      ${socialLinks.join("")}
      <button class="footer-action" id="theme-toggle" title="Toggle theme"></button>
    </div>
    <span class="footer-label">Built with <a href="https://github.com/${escapeHTML(login)}/gitgrid" target="_blank">GitGrid</a></span>
  `;

  const btn = document.getElementById("sync-btn");
  if (btn) btn.addEventListener("click", handleSync);

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const previewBtn = document.getElementById("preview-btn");
  if (previewBtn) previewBtn.addEventListener("click", handlePreview);

  updateThemeIcon();
  refreshIcons();
}

function renderCard(repo, index) {
  const link = getRepoLink(repo);
  const delay = Math.min(index * 0.03, 0.5);
  const rc = getRepoConfig(repo.name);

  const lang = repo.language
    ? `<span class="card-meta-item">${repo.language}</span>` : "";

  const stars = repo.stargazers_count > 0
    ? `<span class="card-price"><i data-lucide="star" fill="currentColor"></i> ${repo.stargazers_count.toLocaleString()}</span>` : "";

  const bgImg = rc.screenshot
    ? `background-image:url('/${rc.screenshot}');background-size:cover;background-position:center;` : "";

  return `
    <a class="card"
       href="${link}" target="_blank" rel="noopener"
       data-repo="${escapeHTML(repo.name)}"
       style="animation-delay:${delay}s;${bgImg}">
      <div class="card-arrow"><i data-lucide="arrow-up-right"></i></div>
      <div class="card-image"></div>
      <div class="card-footer">
        ${lang}
        <div class="card-title-row">
          <span class="card-title">${escapeHTML(repo.name)}</span>
          ${stars}
        </div>
      </div>
    </a>`;
}

function renderGrid(repos) {
  const content = document.getElementById("content");
  let filtered = repos.filter(r => !r.fork);
  if (!import.meta.env.DEV || previewMode) {
    filtered = filtered.filter(r => !isExcluded(r.name));
  }
  filtered = sortRepos(filtered);

  if (CONFIG.maxRepos > 0)
    filtered = filtered.slice(0, CONFIG.maxRepos);

  if (!filtered.length) {
    content.innerHTML = `<div class="loading" style="animation:none;opacity:1">No public repos found.</div>`;
    return;
  }

  content.innerHTML = `<div class="grid">${filtered.map(renderCard).join("")}</div>`;
  refreshIcons();
  return filtered;
}

async function handleSync() {
  const btn = document.getElementById("sync-btn");
  if (!btn) return;

  btn.classList.add("syncing");
  btn.disabled = true;

  try {
    const res = await fetch("/__sync", { method: "POST" });
    const result = await res.json();

    if (!result.ok) throw new Error(result.error);

    const dataRes = await fetch("/data.json?t=" + Date.now());
    const data = await dataRes.json();

    renderHeader(data.user);
    renderGrid(data.repos);
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    btn.classList.remove("syncing");
    btn.disabled = false;
  }
}

async function renderWithDevConfig(repos) {
  const filtered = renderGrid(repos);
  if (import.meta.env.DEV && filtered && !previewMode) {
    const { initDevConfig } = await import("./dev-config.js");
    initDevConfig(CONFIG, filtered);
  }
}

async function handlePreview() {
  previewMode = !previewMode;
  const btn = document.getElementById("preview-btn");
  if (btn) btn.classList.toggle("active", previewMode);
  if (cachedData) await renderWithDevConfig(cachedData.repos);
}

async function init() {
  setTheme(getTheme());

  try {
    const res = await fetch("/data.json");
    if (!res.ok) throw new Error("data.json not found. Run: npm run sync");
    cachedData = await res.json();

    renderHeader(cachedData.user);
    await renderWithDevConfig(cachedData.repos);
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="error">${escapeHTML(err.message)}</div>`;
  }
}

init();
