import CONFIG from "./config.js";

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

const starSVG = `<svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`;

const externalSVG = `<svg class="card-external" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 1.5H2.25A.75.75 0 001.5 2.25v7.5c0 .414.336.75.75.75h7.5a.75.75 0 00.75-.75V7.5M7.5 1.5h3m0 0v3m0-3L5.25 6.75"/></svg>`;

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
}

function getRepoConfig(name) {
  return (CONFIG.repos && CONFIG.repos[name]) || {};
}

function isExcluded(name) {
  const rc = getRepoConfig(name);
  return rc.hidden || (CONFIG.exclude && CONFIG.exclude.includes(name));
}

function getSize(repo) {
  const rc = getRepoConfig(repo.name);
  if (rc.size) return rc.size;
  if (repo.stargazers_count >= 50) return "large";
  if (repo.stargazers_count >= 10 || (repo.description && repo.description.length > 80)) return "medium";
  return "small";
}

function sortRepos(repos) {
  const order = CONFIG.sort || "stars";
  const configured = new Set(Object.keys(CONFIG.repos || {}));
  repos.sort((a, b) => {
    const aPri = configured.has(a.name) ? 0 : 1;
    const bPri = configured.has(b.name) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    if (order === "stars") return b.stargazers_count - a.stargazers_count;
    if (order === "updated") return new Date(b.updated_at) - new Date(a.updated_at);
    if (order === "name") return a.name.localeCompare(b.name);
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

function renderSidebar(user) {
  const el = document.getElementById("sidebar");
  const title = CONFIG.title || user.name || user.login;
  const bio = CONFIG.showBio && user.bio
    ? `<p class="sidebar-bio">${escapeHTML(user.bio)}</p>` : "";

  const pills = [];
  pills.push(`<a href="${user.html_url}" target="_blank">GitHub</a>`);
  if (user.blog) {
    const url = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
    pills.push(`<a href="${url}" target="_blank">${user.blog.replace(/^https?:\/\//, "")}</a>`);
  }
  if (user.twitter_username)
    pills.push(`<a href="https://x.com/${user.twitter_username}" target="_blank">@${user.twitter_username}</a>`);
  if (user.location)
    pills.push(`<span>${escapeHTML(user.location)}</span>`);

  const devBtns = import.meta.env.DEV
    ? `<div class="dev-btns">
        <button class="sync-btn" id="sync-btn" title="Sync from GitHub">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1.5 8a6.5 6.5 0 0111.48-4.17M14.5 8a6.5 6.5 0 01-11.48 4.17"/>
            <path d="M13 1v3.5h-3.5M3 15v-3.5h3.5"/>
          </svg>
          Sync
        </button>
        <button class="sync-btn" id="preview-btn" title="Preview production">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Preview
        </button>
       </div>`
    : "";

  el.innerHTML = `
    <img class="avatar" src="${user.avatar_url}" alt="${escapeHTML(title)}" />
    <h1 class="sidebar-name">${escapeHTML(title)}</h1>
    ${bio}
    <div class="sidebar-links">${pills.join("")}</div>
    ${devBtns}
  `;
  document.title = `${title} — Portfolio`;

  const btn = document.getElementById("sync-btn");
  if (btn) btn.addEventListener("click", handleSync);

  const previewBtn = document.getElementById("preview-btn");
  if (previewBtn) previewBtn.addEventListener("click", handlePreview);
}

function renderCard(repo, index) {
  const size = getSize(repo);
  const rc = getRepoConfig(repo.name);
  const link = getRepoLink(repo);
  const hasScreenshot = !!rc.screenshot;
  const langColor = LANG_COLORS[repo.language] || "#999";
  const delay = Math.min(index * 0.04, 0.6);

  const ext = hasExternalLink(repo) ? externalSVG : "";

  const lang = repo.language
    ? `<span class="card-meta"><span class="lang-dot" style="background:${langColor}"></span>${repo.language}</span>`
    : "";

  const stars = repo.stargazers_count > 0
    ? `<span class="card-meta">${starSVG} ${repo.stargazers_count}</span>`
    : "";

  if (hasScreenshot) {
    return `
      <a class="card card-hero card-${size}"
         href="${link}" target="_blank" rel="noopener"
         style="animation-delay:${delay}s">
        <div class="card-img">
          <img src="${rc.screenshot}" alt="${escapeHTML(repo.name)}" loading="lazy" />
        </div>
        <div class="card-bar">
          <span class="card-bar-name">${escapeHTML(repo.name)}${ext}</span>
          <div class="card-bar-meta">${lang}${stars}</div>
        </div>
      </a>`;
  }

  const desc = repo.description
    ? `<div class="card-desc">${escapeHTML(repo.description)}</div>` : "";

  return `
    <a class="card card-${size}"
       href="${link}" target="_blank" rel="noopener"
       style="animation-delay:${delay}s">
      <div class="card-top">
        <div class="card-name">${escapeHTML(repo.name)}${ext}</div>
        ${desc}
      </div>
      <div class="card-bottom">${lang}${stars}</div>
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

    renderSidebar(data.user);
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
  setTheme(CONFIG.theme || "light");

  try {
    const res = await fetch("/data.json");
    if (!res.ok) throw new Error("data.json not found. Run: npm run sync");
    cachedData = await res.json();

    renderSidebar(cachedData.user);
    await renderWithDevConfig(cachedData.repos);
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="error">${escapeHTML(err.message)}</div>`;
  }
}

init();
