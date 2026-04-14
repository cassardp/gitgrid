import { createIcons, Star, Github, RefreshCw, Globe, Twitter, Settings2, X, AlignLeft, AlignCenter, AlignRight, Smartphone, Monitor, Eye, EyeOff, Code, Image, Mail, Plus, Coffee, ArrowLeft } from "lucide";

let cachedData = null;
let cachedViews = null;
let CONFIG = {};
let currentUser = null;
let isOwner = false;
let previewMode = false;

function refreshIcons() {
  createIcons({ icons: { Star, Github, RefreshCw, Globe, Twitter, Settings2, X, AlignLeft, AlignCenter, AlignRight, Smartphone, Monitor, Eye, EyeOff, Code, Image, Mail, Plus, Coffee, ArrowLeft } });
  document.querySelectorAll("svg[data-lucide]").forEach(el => el.removeAttribute("data-lucide"));
}

function getRepoConfig(name) {
  return (CONFIG.repos && CONFIG.repos[name]) || {};
}

function isExcluded(repo) {
  var rc = getRepoConfig(repo.name);
  if (rc.hidden === true) return true;
  if (rc.hidden === false) return false;
  return repo.private === true;
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

function detectCardBrightness(card) {
  var bg = card.style.backgroundImage;
  if (!bg || bg === "none") {
    card.classList.remove("card-dark-bg");
    return;
  }
  var match = bg.match(/url\(['"]?([^'")+]+)['"]?\)/);
  if (!match) return;
  var img = new window.Image();
  img.onload = function () {
    var canvas = document.createElement("canvas");
    var w = 40, h = 40;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    var srcX = 0;
    var srcY = Math.floor(img.height * 0.85);
    var srcW = Math.floor(img.width * 0.2);
    var srcH = img.height - srcY;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;
    var total = 0;
    for (var i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    card.classList.toggle("card-dark-bg", total / (data.length / 4) < 128);
  };
  img.src = match[1];
}
window.detectCardBrightness = detectCardBrightness;

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function sanitizeURL(url) {
  if (!url) return "";
  try {
    var u = new URL(url, "https://placeholder.com");
    if (u.protocol === "https:" || u.protocol === "http:") return url;
  } catch (e) {}
  return "";
}


function buildSocialLinks(user) {
  const githubUrl = sanitizeURL(CONFIG.github || user.html_url);
  const twitterHandle = CONFIG.twitter || user.twitter_username;
  const blogUrl = CONFIG.blog || user.blog;
  const links = [];
  if (githubUrl)
    links.push(`<a class="icon-btn icon-btn-social" href="${escapeHTML(githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub"><i data-lucide="github"></i></a>`);
  if (twitterHandle) {
    var tVal = twitterHandle.replace(/^@/, "");
    var tUrl = tVal.includes("/") || tVal.includes(".") ? sanitizeURL(tVal.startsWith("http") ? tVal : `https://${tVal}`) : `https://x.com/${encodeURIComponent(tVal)}`;
    if (tUrl) links.push(`<a class="icon-btn icon-btn-social" href="${escapeHTML(tUrl)}" target="_blank" rel="noopener noreferrer" title="X / Twitter"><i data-lucide="twitter"></i></a>`);
  }
  if (blogUrl) {
    const url = blogUrl.startsWith("http") ? sanitizeURL(blogUrl) : `https://${blogUrl}`;
    if (url) links.push(`<a class="icon-btn icon-btn-social" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" title="Website"><i data-lucide="globe"></i></a>`);
  }
  const email = CONFIG.email;
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    links.push(`<a class="icon-btn icon-btn-social" href="mailto:${escapeHTML(email)}" title="Email"><i data-lucide="mail"></i></a>`);
  if (CONFIG.coffee) {
    var cVal = CONFIG.coffee.replace(/^@/, "");
    var coffeeUrl = cVal.includes("/") || cVal.includes(".") ? sanitizeURL(cVal.startsWith("http") ? cVal : `https://${cVal}`) : `https://buymeacoffee.com/${encodeURIComponent(cVal)}`;
    if (coffeeUrl) links.push(`<a class="icon-btn icon-btn-social" href="${escapeHTML(coffeeUrl)}" target="_blank" rel="noopener noreferrer" title="Buy me a coffee"><i data-lucide="coffee"></i></a>`);
  }
  return links.join("");
}

function renderHeader(user) {
  const name = CONFIG.title || user.name || user.login;

  if (isOwner && !document.getElementById("dev-palette")) {
    const palette = document.createElement("div");
    palette.id = "dev-palette";
    palette.innerHTML = `
      <button class="icon-btn" id="sync-btn" title="Sync from GitHub">
        <i data-lucide="refresh-cw"></i>
      </button>
      <span class="palette-sep"></span>
      <button class="icon-btn" id="mobile-btn" title="Mobile preview">
        <i data-lucide="smartphone"></i>
      </button>
      <span class="palette-sep"></span>
      <button class="icon-btn" id="preview-btn" title="Preview as visitor">
        <i data-lucide="eye"></i>
      </button>
      <span class="palette-sep"></span>
      <button class="icon-btn" id="settings-btn" title="Settings">
        <i data-lucide="settings-2"></i>
      </button>
    `;
    document.body.appendChild(palette);
    palette.querySelector("#sync-btn").addEventListener("click", handleSync);
    palette.querySelector("#mobile-btn").addEventListener("click", function () {
      var isMobile = document.body.classList.toggle("mobile-preview");
      this.classList.toggle("active");
      this.querySelector("svg").remove();
      var i = document.createElement("i");
      i.setAttribute("data-lucide", isMobile ? "monitor" : "smartphone");
      this.appendChild(i);
      refreshIcons();
    });
    palette.querySelector("#preview-btn").addEventListener("click", function () {
      previewMode = !previewMode;
      this.classList.toggle("active");
      this.querySelector("svg").remove();
      var i = document.createElement("i");
      i.setAttribute("data-lucide", previewMode ? "code" : "eye");
      this.appendChild(i);
      refreshIcons();
      if (cachedData) {
        renderHeader(cachedData.user);
        renderWithDevConfig(cachedData.repos);
      }
    });
    palette.querySelector("#settings-btn").addEventListener("click", openSettings);
    document.addEventListener("gitgrid:rerender", () => {
      if (cachedData) renderWithDevConfig(cachedData.repos);
    });
  }

  const bioText = CONFIG.bio || user.bio;
  const bio = CONFIG.showBio !== false && bioText ? `<p class="subtitle">${escapeHTML(bioText)}</p>` : "";

  const socialHTML = buildSocialLinks(user);
  const socialRow = socialHTML ? `<div class="social-links">${socialHTML}</div>` : "";

  const avatar = user.avatar_url
    ? `<img class="avatar" src="${escapeHTML(user.avatar_url + '&s=192')}" alt="${escapeHTML(user.login)}" width="96" height="96">` : "";

  const pageTitle = document.getElementById("page-title");
  pageTitle.innerHTML = `
    ${avatar}
    <h1 class="title">
      <span class="title-name">${escapeHTML(name)}</span>
    </h1>
    ${bio}
    ${socialRow}
  `;
  pageTitle.style.textAlign = CONFIG.align || "left";

  document.title = `${name} — Portfolio`;

  // Footer
  const footerText = CONFIG.footer || `© ${new Date().getFullYear()} ${name}`;
  const footerEl = document.getElementById("footer-actions");
  footerEl.innerHTML = `
    <p class="footer-text">${escapeHTML(footerText)}</p>
    <a class="footer-label" href="https://gitgrid.app" target="_blank">Made with GitGrid</a>
  `;

  var statsOverlay = document.getElementById("stats-overlay");
  if (isOwner && !previewMode && cachedViews) {
    if (!statsOverlay) {
      statsOverlay = document.createElement("div");
      statsOverlay.id = "stats-overlay";
      statsOverlay.classList.add("hidden");
      document.body.appendChild(statsOverlay);
      window.addEventListener("scroll", function () {
        var hiddenList = document.querySelector(".hidden-list");
        if (hiddenList) {
          var hr = hiddenList.getBoundingClientRect();
          statsOverlay.classList.toggle("hidden", hr.bottom > window.innerHeight - 120);
        } else {
          var footer = document.getElementById("footer-actions");
          if (!footer) return;
          statsOverlay.classList.toggle("hidden", footer.getBoundingClientRect().bottom > window.innerHeight);
        }
      }, { passive: true });
    }
    statsOverlay.textContent = `${cachedViews.today.toLocaleString()} visit${cachedViews.today !== 1 ? "s" : ""} today · ${cachedViews.week.toLocaleString()} this week`;
    statsOverlay.style.display = "";
  } else if (statsOverlay) {
    statsOverlay.style.display = "none";
  }
  footerEl.style.alignItems = ({ left: "flex-start", right: "flex-end" })[CONFIG.footerAlign] || "center";
  if (CONFIG.showFooter === false) footerEl.querySelector(".footer-text").style.display = "none";

  refreshIcons();
}

function renderCard(repo, index) {
  const link = sanitizeURL(getRepoLink(repo)) || "#";
  const delay = Math.min(index * 0.06, 0.8);
  const rc = getRepoConfig(repo.name);

  const lang = repo.language && CONFIG.showLanguage
    ? `<span class="card-meta-item">${escapeHTML(repo.language)}</span>` : "";

  const stars = repo.stargazers_count > 0 && CONFIG.showStars
    ? `<span class="card-price"><i data-lucide="star" fill="currentColor"></i> ${repo.stargazers_count.toLocaleString()}</span>` : "";

  const bgImg = rc.screenshot && /^[\w.\/-]+$/.test(rc.screenshot)
    ? `background-image:url('/img/${rc.screenshot}');background-size:cover;background-position:center;` : "";

  return `
    <a class="card"
       href="${escapeHTML(link)}" target="_blank" rel="noopener"
       data-repo="${escapeHTML(repo.name)}"
       style="animation-delay:${delay}s;${bgImg}">
      ${CONFIG.showIcon ? `<div class="card-arrow"><i data-lucide="${getCardIcon(repo)}"></i></div>` : ""}
      ${CONFIG.showTitle !== false || lang || stars ? `<div class="card-footer">
        ${lang}
        ${CONFIG.showTitle !== false || stars ? `<div class="card-title-row">
          ${CONFIG.showTitle !== false ? `<span class="card-title">${escapeHTML(repo.name)}</span>` : ""}
          ${stars}
        </div>` : ""}
      </div>` : ""}
    </a>`;
}

function renderGrid(repos) {
  const content = document.getElementById("content");
  let filtered = repos.filter(r => !r.fork && !isExcluded(r));
  filtered = sortRepos(filtered);

  if (!filtered.length) {
    content.innerHTML = `<div class="loading" style="animation:none;opacity:1">No public repos found.</div>`;
    return;
  }

  content.innerHTML = `<div class="grid">${filtered.map(renderCard).join("")}</div>`;
  refreshIcons();
  content.querySelectorAll(".card[style*='background-image']").forEach(detectCardBrightness);
  return filtered;
}

function renderHiddenSection(repos) {
  var existing = document.querySelector(".hidden-section");
  if (existing) existing.remove();
  var footerEl = document.getElementById("footer-actions");

  var hidden = repos.filter(function (r) { return !r.fork && isExcluded(r); });
  if (!hidden.length) { footerEl.classList.remove("has-hidden"); return; }
  footerEl.classList.add("has-hidden");

  hidden.sort(function (a, b) { return a.name.localeCompare(b.name); });

  var section = document.createElement("div");
  section.className = "hidden-section";
  section.innerHTML = `
    <span class="hidden-section-title">Hidden repos</span>
    <div class="hidden-list">
      ${hidden.map(function (r) {
        return `
          <div class="hidden-item" data-repo="${escapeHTML(r.name)}">
            <i data-lucide="plus" class="hidden-item-icon"></i>
            <span class="hidden-item-name">${escapeHTML(r.name)}</span>
          </div>`;
      }).join("")}
    </div>
  `;
  var list = section.querySelector(".hidden-list");
  list.style.justifyContent = ({ left: "flex-start", right: "flex-end" })[CONFIG.footerAlign] || "center";
  document.getElementById("footer-actions").insertAdjacentElement("afterend", section);

  section.querySelectorAll(".hidden-item").forEach(function (item) {
    item.addEventListener("click", async function () {
      var name = item.dataset.repo;
      if (!CONFIG.repos) CONFIG.repos = {};
      if (!CONFIG.repos[name]) CONFIG.repos[name] = {};
      CONFIG.repos[name].hidden = false;
      await saveConfig();
      await renderWithDevConfig(cachedData.repos);
    });
  });

  refreshIcons();
}

async function handleSync() {
  const btn = document.getElementById("sync-btn");
  if (!btn) return;

  btn.classList.add("syncing");
  btn.disabled = true;

  try {
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

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
  if (isOwner && !previewMode) {
    renderHiddenSection(repos);
    if (filtered) {
      const { initDevConfig } = await import("./dev-config.js");
      initDevConfig(CONFIG, filtered);
    }
  } else {
    var existing = document.querySelector(".hidden-section");
    if (existing) existing.remove();
    document.getElementById("footer-actions").classList.remove("has-hidden");
  }
}

async function saveConfig() {
  await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CONFIG),
  });
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
            <button class="setting-toggle ${CONFIG.showBio !== false ? "on" : ""}" id="s-show-bio"></button>
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
        <div class="setting-group input-icon">
          <i data-lucide="github"></i>
          <input class="setting-input" id="s-github" type="url"
            value="${escapeHTML(CONFIG.github || (cachedData ? cachedData.user.html_url : ""))}"
            placeholder="GitHub URL">
        </div>
        <div class="setting-group input-icon">
          <i data-lucide="twitter"></i>
          <input class="setting-input" id="s-twitter" type="text"
            value="${escapeHTML(CONFIG.twitter || (cachedData ? cachedData.user.twitter_username || "" : ""))}"
            placeholder="X / Twitter username">
        </div>
        <div class="setting-group input-icon">
          <i data-lucide="globe"></i>
          <input class="setting-input" id="s-blog" type="url"
            value="${escapeHTML(CONFIG.blog || (cachedData ? cachedData.user.blog || "" : ""))}"
            placeholder="Website URL">
        </div>
        <div class="setting-group input-icon">
          <i data-lucide="mail"></i>
          <input class="setting-input" id="s-email" type="email"
            value="${escapeHTML(CONFIG.email || "")}"
            placeholder="Email">
        </div>
        <div class="setting-group input-icon">
          <i data-lucide="coffee"></i>
          <input class="setting-input" id="s-coffee" type="text"
            value="${escapeHTML(CONFIG.coffee || "")}"
            placeholder="Buy Me a Coffee username or URL">
        </div>
      </div>

      <div class="setting-section">
        <span class="setting-section-title">Cards</span>
        <div class="setting-row">
          <span class="setting-row-label">Show title</span>
          <button class="setting-toggle ${CONFIG.showTitle !== false ? "on" : ""}" id="s-show-title"></button>
        </div>
        <div class="setting-row">
          <span class="setting-row-label">Show language</span>
          <button class="setting-toggle ${CONFIG.showLanguage ? "on" : ""}" id="s-show-language"></button>
        </div>
        <div class="setting-row">
          <span class="setting-row-label">Show stars</span>
          <button class="setting-toggle ${CONFIG.showStars ? "on" : ""}" id="s-show-stars"></button>
        </div>
        <div class="setting-row">
          <span class="setting-row-label">Show icon</span>
          <button class="setting-toggle ${CONFIG.showIcon ? "on" : ""}" id="s-show-icon"></button>
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

      <details class="setting-section setting-danger">
        <summary class="setting-danger-summary">
          <span class="setting-section-title">Delete account</span>
          <svg class="setting-danger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </summary>
        <div class="setting-danger-content">
          <p style="font-size:13px;margin:0 0 12px">This will permanently delete your account, config, and all uploaded images.</p>
          <div class="setting-group">
            <input class="setting-input" id="s-delete-confirm" type="text"
              placeholder="Type ${escapeHTML(currentUser.username)} to confirm">
          </div>
          <button class="setting-delete-btn" id="s-delete-btn" disabled>Delete account</button>
        </div>
      </details>

      <a class="setting-privacy-link" href="#" id="s-privacy-link">Privacy Policy</a>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  refreshIcons();

  // Privacy policy view
  overlay.querySelector("#s-privacy-link").addEventListener("click", async function (e) {
    e.preventDefault();
    var modal = overlay.querySelector(".modal");
    var res = await fetch("/privacy");
    var html = await res.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var content = doc.querySelector(".container");
    var backLink = content.querySelector(".back");
    if (backLink) backLink.remove();
    modal.innerHTML = `
      <div class="modal-header">
        <button class="modal-back"><i data-lucide="arrow-left"></i></button>
        <span class="modal-title">Privacy Policy</span>
        <button class="modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-privacy">${content.innerHTML}</div>
    `;
    modal.scrollTop = 0;
    refreshIcons();
    modal.querySelector(".modal-back").addEventListener("click", function () {
      overlay.remove();
      openSettings();
    });
    modal.querySelector(".modal-close").addEventListener("click", close);
  });

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

  // Apply changes in memory + live DOM update
  const apply = () => {
    CONFIG.title = document.getElementById("s-title").value.trim();
    CONFIG.showBio = document.getElementById("s-show-bio").classList.contains("on");
    CONFIG.showTitle = document.getElementById("s-show-title").classList.contains("on");
    CONFIG.showLanguage = document.getElementById("s-show-language").classList.contains("on");
    CONFIG.showStars = document.getElementById("s-show-stars").classList.contains("on");
    CONFIG.showIcon = document.getElementById("s-show-icon").classList.contains("on");
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
    CONFIG.coffee = document.getElementById("s-coffee").value.trim();

    if (cachedData) {
      CONFIG.bio = document.getElementById("s-bio").value.trim();
      const user = cachedData.user;
      const name = CONFIG.title || user.name || user.login;

      const pageTitle = document.getElementById("page-title");
      if (pageTitle) pageTitle.style.textAlign = CONFIG.align || "left";

      const titleEl = document.querySelector(".title-name");
      if (titleEl) titleEl.textContent = name;
      document.title = name ? `${name} — Portfolio` : "Portfolio";

      const bioText = CONFIG.bio || user.bio;
      const existing = document.querySelector(".subtitle");
      if (CONFIG.showBio && bioText) {
        if (existing) {
          existing.textContent = bioText;
        } else {
          const p = document.createElement("p");
          p.className = "subtitle";
          p.textContent = bioText;
          const pageTitle = document.getElementById("page-title");
          const h1 = pageTitle.querySelector(".title");
          h1.insertAdjacentElement("afterend", p);
        }
      } else if (existing) {
        existing.remove();
      }

      const footerTextEl = document.querySelector(".footer-text");
      const footerEl = document.getElementById("footer-actions");
      if (footerTextEl) {
        footerTextEl.textContent = CONFIG.footer || `© ${new Date().getFullYear()} ${name}`;
        footerTextEl.style.display = CONFIG.showFooter !== false ? "" : "none";
      }
      if (footerEl) footerEl.style.alignItems = ({ left: "flex-start", right: "flex-end" })[CONFIG.footerAlign] || "center";

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

      renderWithDevConfig(cachedData.repos);
    }
  };

  // Save to API on close
  const close = () => {
    overlay.classList.remove("visible");
    setTimeout(() => {
      overlay.remove();
      saveConfig();
    }, 200);
  };

  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll(".setting-input:not(#s-delete-confirm)").forEach((el) => {
    el.addEventListener("change", apply);
  });
  overlay.querySelectorAll(".setting-toggle").forEach((btn) => {
    btn.addEventListener("click", apply);
  });

  // Delete account
  const deleteInput = document.getElementById("s-delete-confirm");
  const deleteBtn = document.getElementById("s-delete-btn");
  deleteInput.addEventListener("input", () => {
    deleteBtn.disabled = deleteInput.value !== currentUser.username;
  });
  deleteBtn.addEventListener("click", async () => {
    if (deleteInput.value !== currentUser.username) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting…";
    const res = await fetch("/api/auth/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser.username }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      deleteBtn.textContent = "Delete account";
      deleteBtn.disabled = false;
    }
  });
}

function getUsername() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);
  return parts[0] || null;
}

async function init() {
  const username = getUsername();

  if (!username) {
    document.querySelector(".main").classList.add("landing");
    document.getElementById("page-title").remove();
    document.getElementById("footer-actions").remove();
    document.getElementById("content").innerHTML = `
      <div class="landing-content">
        <div class="landing-top">
          <p class="landing-badge">Your dev portfolio in 10 seconds</p>
          <h1 class="landing-title">GitGrid</h1>
          <p class="landing-tagline">Connect GitHub, get a visual portfolio. Built for makers and developers.</p>
          <a href="/api/auth/login" class="landing-cta"><i data-lucide="github"></i>Get started with GitHub</a>
          <a href="/cassardp" class="landing-demo" target="_blank" rel="noopener noreferrer">See a live portfolio <span>&rarr;</span></a>
        </div>
        <a href="/cassardp" class="landing-hero-link" target="_blank" rel="noopener noreferrer">
          <img src="/hero.png" alt="GitGrid portfolio example" class="landing-hero">
        </a>
        <footer class="landing-footer">
          <div class="landing-footer-links">
            <a href="https://github.com/cassardp/gitgrid" target="_blank" rel="noopener noreferrer" title="GitHub"><i data-lucide="github"></i></a>
            <a href="https://x.com/patricecassard" target="_blank" rel="noopener noreferrer" title="X / Twitter"><i data-lucide="twitter"></i></a>
            <a href="https://buymeacoffee.com/patricecassard" target="_blank" rel="noopener noreferrer" title="Buy me a coffee"><i data-lucide="coffee"></i></a>
          </div>
          <p class="landing-footer-copy">&copy; ${new Date().getFullYear()} GitGrid</p>
        </footer>
      </div>
    `;
    refreshIcons();
    return;
  }

  try {
    // Fetch portfolio data and auth status in parallel
    const [portfolioRes, authRes] = await Promise.all([
      fetch(`/api/portfolio/${username}`),
      fetch("/api/auth/me"),
    ]);

    const auth = await authRes.json();
    currentUser = auth.user;
    isOwner = currentUser && currentUser.username === username;

    if (!portfolioRes.ok) {
      if (isOwner) {
        // First login — no data yet, trigger initial sync
        document.getElementById("content").innerHTML =
          `<div style="display:flex;align-items:center;justify-content:center;min-height:80vh;color:var(--text-2)">Syncing your repos from GitHub…</div>`;
        const syncRes = await fetch("/api/sync", { method: "POST" });
        if (!syncRes.ok) throw new Error("Sync failed");
        const data = await syncRes.json();
        CONFIG = {};
        cachedData = { user: data.user, repos: data.repos };
        renderHeader(cachedData.user);
        await renderWithDevConfig(cachedData.repos);
        return;
      }
      throw new Error("Portfolio not found");
    }

    const portfolio = await portfolioRes.json();

    // User exists but never synced — repos_data is empty
    if (!portfolio.user && isOwner) {
      document.getElementById("content").innerHTML =
        `<div style="display:flex;align-items:center;justify-content:center;min-height:80vh;color:var(--text-2)">Syncing your repos from GitHub…</div>`;
      const syncRes = await fetch("/api/sync", { method: "POST" });
      if (!syncRes.ok) throw new Error("Sync failed");
      const data = await syncRes.json();
      CONFIG = portfolio.config || {};
      cachedData = { user: data.user, repos: data.repos };
      renderHeader(cachedData.user);
      await renderWithDevConfig(cachedData.repos);
      return;
    }

    if (!portfolio.user) {
      throw new Error("Portfolio not found");
    }

    CONFIG = portfolio.config || {};
    cachedViews = portfolio.views || null;
    cachedData = { user: portfolio.user, repos: portfolio.repos };

    renderHeader(cachedData.user);
    await renderWithDevConfig(cachedData.repos);
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="error">${escapeHTML(err.message)}<a href="/">← Back to GitGrid</a></div>`;
  }
}

init();
