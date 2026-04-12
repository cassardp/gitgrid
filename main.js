import CONFIG from "./config.js";
import { createIcons, Star, Github, RefreshCw, Globe, Twitter, Settings, X, Code, AlignLeft, AlignCenter, AlignRight, Smartphone, Eye, EyeOff, Image, Mail } from "lucide";

let cachedData = null;
let previewMode = false;

function refreshIcons() {
  createIcons({ icons: { Star, Github, RefreshCw, Globe, Twitter, Settings, X, Code, AlignLeft, AlignCenter, AlignRight, Smartphone, Eye, EyeOff, Image, Mail } });
  document.querySelectorAll("svg[data-lucide]").forEach(el => el.removeAttribute("data-lucide"));
}



function getRepoConfig(name) {
  return (CONFIG.repos && CONFIG.repos[name]) || {};
}

function isExcluded(name) {
  return getRepoConfig(name).hidden;
}

function sortRepos(repos) {
  const sortBy = CONFIG.sort || "stars";
  repos.sort((a, b) => {
    const aRC = getRepoConfig(a.name);
    const bRC = getRepoConfig(b.name);
    const aHasOrder = typeof aRC.order === "number";
    const bHasOrder = typeof bRC.order === "number";
    if (aHasOrder && bHasOrder) return aRC.order - bRC.order;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
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

function isAppStoreLink(repo) {
  if (!repo.homepage) return false;
  return repo.homepage.includes("apps.apple.com") || repo.homepage.includes("play.google.com");
}

function getCardIcon(repo) {
  if (isAppStoreLink(repo)) return "smartphone";
  if (hasExternalLink(repo)) return "globe";
  return "github";
}

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function buildSocialLinks(user) {
  const githubUrl = CONFIG.github || user.html_url;
  const twitterHandle = CONFIG.twitter || user.twitter_username;
  const blogUrl = CONFIG.blog || user.blog;
  const links = [];
  if (githubUrl)
    links.push(`<a class="icon-btn icon-btn-social" href="${githubUrl}" target="_blank" title="GitHub"><i data-lucide="github"></i></a>`);
  if (twitterHandle) {
    const tUrl = twitterHandle.startsWith("http") ? twitterHandle : `https://x.com/${twitterHandle}`;
    links.push(`<a class="icon-btn icon-btn-social" href="${tUrl}" target="_blank" title="X / Twitter"><i data-lucide="twitter"></i></a>`);
  }
  if (blogUrl) {
    const url = blogUrl.startsWith("http") ? blogUrl : `https://${blogUrl}`;
    links.push(`<a class="icon-btn icon-btn-social" href="${url}" target="_blank" title="Website"><i data-lucide="globe"></i></a>`);
  }
  const email = CONFIG.email;
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    links.push(`<a class="icon-btn icon-btn-social" href="mailto:${email}" title="Email"><i data-lucide="mail"></i></a>`);
  return links.join("");
}

function renderHeader(user) {
  const name = CONFIG.title || user.name || user.login;
  const login = user.login;

  if (import.meta.env.DEV && !document.getElementById("dev-palette")) {
    const palette = document.createElement("div");
    palette.id = "dev-palette";
    palette.innerHTML = `
      <button class="icon-btn" id="sync-btn" title="Sync from GitHub">
        <i data-lucide="refresh-cw"></i>
      </button>
      <button class="icon-btn" id="preview-btn" title="Preview production">
        <i data-lucide="globe"></i>
      </button>
      <button class="icon-btn" id="settings-btn" title="Settings">
        <i data-lucide="settings"></i>
      </button>
    `;
    document.body.appendChild(palette);
  }

  const bioText = CONFIG.bio || user.bio;
  const bio = CONFIG.showBio && bioText ? `<p class="subtitle">${escapeHTML(bioText)}</p>` : "";

  const socialHTML = buildSocialLinks(user);
  const socialRow = socialHTML ? `<div class="social-links">${socialHTML}</div>` : "";

  const pageTitle = document.getElementById("page-title");
  pageTitle.innerHTML = `
    <h1 class="title">
      <span class="title-name">${escapeHTML(name)}</span>
    </h1>
    ${bio}
    ${socialRow}
  `;
  pageTitle.style.textAlign = CONFIG.align || "left";

  document.title = `${name} — Portfolio`;

  // Footer
  const footerText = CONFIG.footer || `© ${new Date().getFullYear()} ${escapeHTML(name)}`;
  const footerEl = document.getElementById("footer-actions");
  footerEl.innerHTML = `
    <p class="footer-text">${escapeHTML(footerText)}</p>
    <a class="footer-label" href="https://github.com/${escapeHTML(login)}/gitgrid" target="_blank">Made with GitGrid</a>
  `;
  footerEl.style.alignItems = ({ left: "flex-start", right: "flex-end" })[CONFIG.footerAlign] || "center";
  if (CONFIG.showFooter === false) footerEl.querySelector(".footer-text").style.display = "none";

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
      <div class="card-arrow"><i data-lucide="${getCardIcon(repo)}"></i></div>
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

    cachedData = data;
    renderHeader(data.user);
    await renderWithDevConfig(data.repos);
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
    btn.title = previewMode ? "Back to dev" : "Preview production";
    btn.innerHTML = previewMode
      ? `<i data-lucide="code"></i>`
      : `<i data-lucide="globe"></i>`;
    refreshIcons();
  }
  const syncBtn = document.getElementById("sync-btn");
  const settingsBtn = document.getElementById("settings-btn");
  if (syncBtn) syncBtn.style.display = previewMode ? "none" : "";
  if (settingsBtn) settingsBtn.style.display = previewMode ? "none" : "";
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

      <div class="setting-section">
        <span class="setting-section-title">Header</span>
        <div class="setting-group">
          <input class="setting-input" id="s-title" type="text"
            value="${escapeHTML(CONFIG.title || "")}"
            placeholder="${escapeHTML(cachedData ? cachedData.user.name || cachedData.user.login : "Title")}">
        </div>
        <div class="setting-group">
          <input class="setting-input" id="s-bio" type="text"
            value="${escapeHTML(CONFIG.bio || "")}"
            placeholder="${cachedData && cachedData.user.bio ? escapeHTML(cachedData.user.bio) : "Bio"}">
        </div>
        <div class="setting-row-pair">
          <div class="setting-row">
            <span class="setting-row-label">Show bio</span>
            <button class="setting-toggle ${CONFIG.showBio ? "on" : ""}" id="s-show-bio"></button>
          </div>
          <div class="setting-row">
            <span class="setting-row-label">Alignment</span>
            <div class="setting-align" data-target="header">
              <button class="setting-align-btn${(CONFIG.align || "left") === "left" ? " on" : ""}" data-align="left"><i data-lucide="align-left"></i></button>
              <button class="setting-align-btn${(CONFIG.align || "left") === "center" ? " on" : ""}" data-align="center"><i data-lucide="align-center"></i></button>
              <button class="setting-align-btn${(CONFIG.align || "left") === "right" ? " on" : ""}" data-align="right"><i data-lucide="align-right"></i></button>
            </div>
          </div>
        </div>
      </div>

      <div class="setting-section">
        <span class="setting-section-title">Links</span>
        <div class="setting-group">
          <input class="setting-input" id="s-github" type="url"
            value="${escapeHTML(CONFIG.github || (cachedData ? cachedData.user.html_url : ""))}"
            placeholder="GitHub URL">
        </div>
        <div class="setting-group">
          <input class="setting-input" id="s-twitter" type="text"
            value="${escapeHTML(CONFIG.twitter || (cachedData ? cachedData.user.twitter_username || "" : ""))}"
            placeholder="X / Twitter username">
        </div>
        <div class="setting-group">
          <input class="setting-input" id="s-blog" type="url"
            value="${escapeHTML(CONFIG.blog || (cachedData ? cachedData.user.blog || "" : ""))}"
            placeholder="Website URL">
        </div>
        <div class="setting-group">
          <input class="setting-input" id="s-email" type="email"
            value="${escapeHTML(CONFIG.email || "")}"
            placeholder="Email">
        </div>
      </div>

      <div class="setting-section">
        <span class="setting-section-title">Footer</span>
        <div class="setting-group">
          <input class="setting-input" id="s-footer" type="text"
            value="${escapeHTML(CONFIG.footer || "")}"
            placeholder="© ${new Date().getFullYear()} ${escapeHTML(CONFIG.title || (cachedData ? cachedData.user.name || cachedData.user.login : ""))}">
        </div>
        <div class="setting-row-pair">
          <div class="setting-row">
            <span class="setting-row-label">Show footer</span>
            <button class="setting-toggle ${CONFIG.showFooter !== false ? "on" : ""}" id="s-show-footer"></button>
          </div>
          <div class="setting-row">
            <span class="setting-row-label">Alignment</span>
            <div class="setting-align" data-target="footer">
              <button class="setting-align-btn${(CONFIG.footerAlign || "center") === "left" ? " on" : ""}" data-align="left"><i data-lucide="align-left"></i></button>
              <button class="setting-align-btn${(CONFIG.footerAlign || "center") === "center" ? " on" : ""}" data-align="center"><i data-lucide="align-center"></i></button>
              <button class="setting-align-btn${(CONFIG.footerAlign || "center") === "right" ? " on" : ""}" data-align="right"><i data-lucide="align-right"></i></button>
            </div>
          </div>
        </div>
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

  // Alignment buttons (scoped per group)
  overlay.querySelectorAll(".setting-align").forEach((group) => {
    group.querySelectorAll(".setting-align-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".setting-align-btn").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        apply();
      });
    });
  });

  // Apply changes in memory + live DOM update (no file save)
  const apply = () => {
    CONFIG.title = document.getElementById("s-title").value.trim();
    CONFIG.showBio = document.getElementById("s-show-bio").classList.contains("on");
    CONFIG.showFooter = document.getElementById("s-show-footer").classList.contains("on");

    const headerAlignBtn = overlay.querySelector('.setting-align[data-target="header"] .setting-align-btn.on');
    CONFIG.align = headerAlignBtn ? headerAlignBtn.dataset.align : "left";

    const footerAlignBtn = overlay.querySelector('.setting-align[data-target="footer"] .setting-align-btn.on');
    CONFIG.footerAlign = footerAlignBtn ? footerAlignBtn.dataset.align : "center";

    CONFIG.footer = document.getElementById("s-footer").value.trim();
    CONFIG.github = document.getElementById("s-github").value.trim();
    CONFIG.twitter = document.getElementById("s-twitter").value.trim();
    CONFIG.blog = document.getElementById("s-blog").value.trim();
    CONFIG.email = document.getElementById("s-email").value.trim();

    if (cachedData) {
      CONFIG.bio = document.getElementById("s-bio").value.trim();
      const user = cachedData.user;
      const name = CONFIG.title || user.name || user.login;

      // Update alignment
      const pageTitle = document.getElementById("page-title");
      if (pageTitle) pageTitle.style.textAlign = CONFIG.align || "left";

      // Update title
      const titleEl = document.querySelector(".title-name");
      if (titleEl) titleEl.textContent = name;
      document.title = name ? `${name} — Portfolio` : "Portfolio";

      // Update bio
      const bioText = CONFIG.bio || user.bio;
      const existing = document.querySelector(".subtitle");
      if (CONFIG.showBio && bioText) {
        if (existing) {
          existing.textContent = bioText;
        } else {
          const p = document.createElement("p");
          p.className = "subtitle";
          p.textContent = bioText;
          document.getElementById("page-title").appendChild(p);
        }
      } else if (existing) {
        existing.remove();
      }

      // Update footer
      const footerTextEl = document.querySelector(".footer-text");
      const footerEl = document.getElementById("footer-actions");
      if (footerTextEl) {
        footerTextEl.textContent = CONFIG.footer || `© ${new Date().getFullYear()} ${name}`;
        footerTextEl.style.display = CONFIG.showFooter !== false ? "" : "none";
      }
      if (footerEl) footerEl.style.alignItems = ({ left: "flex-start", right: "flex-end" })[CONFIG.footerAlign] || "center";

      // Update social links under bio
      const existingSocial = pageTitle.querySelector(".social-links");
      const newSocialHTML = buildSocialLinks(user);
      if (newSocialHTML) {
        if (existingSocial) {
          existingSocial.innerHTML = newSocialHTML;
        } else {
          const div = document.createElement("div");
          div.className = "social-links";
          div.innerHTML = newSocialHTML;
          pageTitle.appendChild(div);
        }
      } else if (existingSocial) {
        existingSocial.remove();
      }
      refreshIcons();

      // Update grid
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
  overlay.querySelectorAll(".setting-input").forEach((el) => {
    el.addEventListener("change", apply);
  });
  overlay.querySelectorAll(".setting-toggle").forEach((btn) => {
    btn.addEventListener("click", apply);
  });
}

async function init() {
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
