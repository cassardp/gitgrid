import CONFIG from "./config.js";
import { createIcons, Star, ArrowUpRight, Github, RefreshCw, Globe, Twitter, Settings, X, Code } from "lucide";

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
  createIcons({ icons: { Star, ArrowUpRight, Github, RefreshCw, Globe, Twitter, Settings, X, Code } });
}

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

function getTheme() {
  return localStorage.getItem("theme") || CONFIG.theme || "light";
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

  // Social links (always visible)
  const githubUrl = CONFIG.github || user.html_url;
  const twitterHandle = CONFIG.twitter || user.twitter_username;
  const blogUrl = CONFIG.blog || user.blog;

  const socialLinks = [];
  if (githubUrl)
    socialLinks.push(`<a class="icon-btn" href="${githubUrl}" target="_blank" title="GitHub"><i data-lucide="github"></i></a>`);
  if (twitterHandle) {
    const tUrl = twitterHandle.startsWith("http") ? twitterHandle : `https://x.com/${twitterHandle}`;
    socialLinks.push(`<a class="icon-btn" href="${tUrl}" target="_blank" title="X / Twitter"><i data-lucide="twitter"></i></a>`);
  }
  if (blogUrl) {
    const url = blogUrl.startsWith("http") ? blogUrl : `https://${blogUrl}`;
    socialLinks.push(`<a class="icon-btn" href="${url}" target="_blank" title="Website"><i data-lucide="globe"></i></a>`);
  }

  const devBtns = import.meta.env.DEV
    ? `<span class="nav-separator"></span>
        <button class="icon-btn" id="sync-btn" title="Sync from GitHub">
          <i data-lucide="refresh-cw"></i>
        </button>
        <button class="icon-btn" id="preview-btn" title="Dev mode">
          <i data-lucide="code"></i>
        </button>
        <button class="icon-btn" id="settings-btn" title="Settings">
          <i data-lucide="settings"></i>
        </button>`
    : "";

  document.getElementById("navbar").innerHTML = `
    <div class="nav-left"></div>
    <div class="nav-right">
      ${socialLinks.join("")}
      ${devBtns}
    </div>
  `;

  const bio = CONFIG.showBio && user.bio ? `<p class="subtitle">${escapeHTML(user.bio)}</p>` : "";

  document.getElementById("page-title").innerHTML = `
    <h1 class="title">
      <span class="title-name">${escapeHTML(name)}</span>
    </h1>
    ${bio}
  `;

  document.title = `${name} — Portfolio`;

  // Footer
  document.getElementById("footer-actions").innerHTML = `
    <a class="footer-label" href="https://github.com/${escapeHTML(login)}/gitgrid" target="_blank">Built with GitGrid</a>
  `;

  const btn = document.getElementById("sync-btn");
  if (btn) btn.addEventListener("click", handleSync);

  const previewBtn = document.getElementById("preview-btn");
  if (previewBtn) previewBtn.addEventListener("click", handlePreview);

  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) settingsBtn.addEventListener("click", openSettings);

  refreshIcons();
}

function renderCard(repo, index) {
  const link = getRepoLink(repo);
  const delay = Math.min(index * 0.03, 0.5);
  const rc = getRepoConfig(repo.name);
  const hidden = isExcluded(repo.name);

  const lang = repo.language
    ? `<span class="card-meta-item">${repo.language}</span>` : "";

  const stars = repo.stargazers_count > 0
    ? `<span class="card-price"><i data-lucide="star" fill="currentColor"></i> ${repo.stargazers_count.toLocaleString()}</span>` : "";

  const bgImg = rc.screenshot
    ? `background-image:url('/${rc.screenshot}');background-size:cover;background-position:center;` : "";

  const hiddenClass = hidden ? " card-hidden" : "";

  return `
    <a class="card${hiddenClass}"
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
  if (btn) {
    btn.title = previewMode ? "Production mode" : "Dev mode";
    btn.innerHTML = previewMode
      ? `<i data-lucide="globe"></i>`
      : `<i data-lucide="code"></i>`;
    refreshIcons();
  }
  if (cachedData) await renderWithDevConfig(cachedData.repos);
}

function openSettings() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Settings</span>
        <button class="modal-close"><i data-lucide="x"></i></button>
      </div>

      <div class="setting-group">
        <label class="setting-label">Title</label>
        <input class="setting-input" id="s-title" type="text"
          value="${escapeHTML(CONFIG.title || "")}"
          placeholder="${cachedData ? escapeHTML(cachedData.user.name || cachedData.user.login) : ""}">
      </div>

      <div class="setting-group">
        <label class="setting-label">Bio</label>
        <input class="setting-input" id="s-bio" type="text"
          value="${cachedData ? escapeHTML(cachedData.user.bio || "") : ""}"
          placeholder="Short description">
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <span class="setting-row-label">Show bio</span>
          <button class="setting-toggle ${CONFIG.showBio ? "on" : ""}" id="s-show-bio"></button>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <span class="setting-row-label">Dark theme</span>
          <button class="setting-toggle ${getTheme() === "dark" ? "on" : ""}" id="s-theme"></button>
        </div>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-group">
        <label class="setting-label">GitHub</label>
        <input class="setting-input" id="s-github" type="url"
          value="${escapeHTML(CONFIG.github || (cachedData ? cachedData.user.html_url : ""))}"
          placeholder="https://github.com/username">
      </div>

      <div class="setting-group">
        <label class="setting-label">X / Twitter</label>
        <input class="setting-input" id="s-twitter" type="text"
          value="${escapeHTML(CONFIG.twitter || (cachedData ? cachedData.user.twitter_username || "" : ""))}"
          placeholder="username">
      </div>

      <div class="setting-group">
        <label class="setting-label">Website</label>
        <input class="setting-input" id="s-blog" type="url"
          value="${escapeHTML(CONFIG.blog || (cachedData ? cachedData.user.blog || "" : ""))}"
          placeholder="https://example.com">
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  refreshIcons();

  // Toggle buttons
  overlay.querySelectorAll(".setting-toggle").forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("on"));
  });

  // Apply changes in memory + live DOM update (no file save)
  const apply = () => {
    CONFIG.title = document.getElementById("s-title").value.trim();
    CONFIG.showBio = document.getElementById("s-show-bio").classList.contains("on");

    const isDark = document.getElementById("s-theme").classList.contains("on");
    CONFIG.theme = isDark ? "dark" : "light";
    setTheme(CONFIG.theme);

    CONFIG.github = document.getElementById("s-github").value.trim();
    CONFIG.twitter = document.getElementById("s-twitter").value.trim();
    CONFIG.blog = document.getElementById("s-blog").value.trim();

    if (cachedData) {
      cachedData.user.bio = document.getElementById("s-bio").value.trim();
      const user = cachedData.user;
      const name = CONFIG.title || user.name || user.login;

      // Update title
      const titleEl = document.querySelector(".title-name");
      if (titleEl) titleEl.textContent = name;
      document.title = `${name} — Portfolio`;

      // Update bio
      const existing = document.querySelector(".subtitle");
      if (CONFIG.showBio && user.bio) {
        if (existing) {
          existing.textContent = user.bio;
        } else {
          const p = document.createElement("p");
          p.className = "subtitle";
          p.textContent = user.bio;
          document.getElementById("page-title").appendChild(p);
        }
      } else if (existing) {
        existing.remove();
      }

      // Update grid (sort, maxRepos)
      renderGrid(cachedData.repos);
    }
  };

  // Save to disk on close (DOM already up to date via apply)
  const close = () => {
    overlay.classList.remove("visible");
    setTimeout(() => {
      overlay.remove();
      fetch("/__save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CONFIG),
      });
    }, 200);
  };

  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Live preview: apply in-memory on each change
  overlay.querySelectorAll(".setting-input, .setting-select").forEach((el) => {
    el.addEventListener("change", apply);
  });
  overlay.querySelectorAll(".setting-toggle").forEach((btn) => {
    btn.addEventListener("click", apply);
  });
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
