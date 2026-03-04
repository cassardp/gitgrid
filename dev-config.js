let workingConfig = null;
let saveTimer = null;
let stylesInjected = false;
let filteredRepos = null;
let dragState = null;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .card { position: relative; }
    .dev-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.7);
      border-radius: var(--radius);
      opacity: 0;
      transition: opacity 0.15s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      pointer-events: none;
    }
    .card:hover .dev-overlay { opacity: 1; pointer-events: auto; }
    .dev-toolbar {
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px;
    }
    .dev-btn {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      line-height: 1;
      transition: background 0.1s;
    }
    .dev-btn:hover { background: rgba(255,255,255,0.3); }
    .dev-btn.active { background: rgba(255,255,255,0.45); }
    .dev-drop-zone {
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      font-weight: 500;
      pointer-events: none;
      display: none;
    }
    .dev-dragover .dev-drop-zone { display: block; }
    .dev-dragover .dev-overlay { opacity: 1 !important; pointer-events: auto; }
    .dev-link {
      position: absolute; bottom: 8px; right: 8px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      padding: 4px 6px;
      color: #fff;
      cursor: pointer;
      display: flex;
      text-decoration: none;
      transition: background 0.1s;
    }
    .dev-link:hover { background: rgba(255,255,255,0.3); }
    .card.dev-hidden {
      opacity: 0.35 !important;
      border: 2px dashed rgba(255,255,255,0.3);
    }
    [data-theme="light"] .card.dev-hidden {
      border-color: rgba(0,0,0,0.2);
    }
    .dev-btns {
      display: flex;
      gap: 8px;
      margin-top: 20px;
    }
    .dev-btns .sync-btn { margin-top: 0; }
    .sync-btn.active {
      background: var(--text);
      color: var(--bg);
      border-color: var(--text);
    }
    .card.dev-drag-ghost {
      border: 2px dashed #3b82f6 !important;
      background: rgba(59, 130, 246, 0.06) !important;
      box-shadow: none !important;
    }
    .card.dev-drag-ghost > * { visibility: hidden; }
  `;
  document.head.appendChild(style);
}

const eyeSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeOffSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const linkSVG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 1.5H2.25A.75.75 0 001.5 2.25v7.5c0 .414.336.75.75.75h7.5a.75.75 0 00.75-.75V7.5M7.5 1.5h3m0 0v3m0-3L5.25 6.75"/></svg>`;

function getRC(name) {
  if (!workingConfig.repos) workingConfig.repos = {};
  if (!workingConfig.repos[name]) workingConfig.repos[name] = {};
  return workingConfig.repos[name];
}

function isHidden(name) {
  const rc = getRC(name);
  return rc.hidden || (workingConfig.exclude && workingConfig.exclude.includes(name));
}

async function saveConfig() {
  const res = await fetch("/__save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workingConfig),
  });
  const result = await res.json();
  if (!result.ok) console.error("Save failed:", result.error);
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveConfig, 300);
}

async function handleDrop(name, card, file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];
    const res = await fetch("/__upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName: name, filename: file.name, data: base64 }),
    });
    const result = await res.json();
    if (result.ok) {
      const rc = getRC(name);
      rc.screenshot = result.path;
      // For image drop, a reload is needed to re-render the card as hero
      await saveConfig();
      location.reload();
    }
  };
  reader.readAsDataURL(file);
}

function addOverlay(card, repo) {
  const name = repo.name;
  const rc = getRC(name);
  const currentSize = rc.size || "small";
  const hidden = isHidden(name);

  if (hidden) card.classList.add("dev-hidden");

  card.addEventListener("click", (e) => {
    if (e.target.closest(".dev-link")) return;
    e.preventDefault();
  });

  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    if (e.dataTransfer.types.includes("Files")) return;
    e.dataTransfer.setData("text/plain", name);
    e.dataTransfer.effectAllowed = "move";
    dragState = { name, card, originalNext: card.nextSibling };
    requestAnimationFrame(() => card.classList.add("dev-drag-ghost"));
  });

  card.addEventListener("dragend", () => {
    if (!dragState) return;
    dragState.card.classList.remove("dev-drag-ghost");
    const grid = dragState.card.closest(".grid");
    if (dragState.originalNext) {
      grid.insertBefore(dragState.card, dragState.originalNext);
    } else {
      grid.appendChild(dragState.card);
    }
    dragState = null;
  });

  card.addEventListener("dragover", (e) => {
    if (!dragState || !e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (dragState.name === name) return;

    const rect = card.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const grid = card.closest(".grid");

    if (before) {
      grid.insertBefore(dragState.card, card);
    } else {
      grid.insertBefore(dragState.card, card.nextSibling);
    }
  });

  card.addEventListener("drop", (e) => {
    if (!dragState || !e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.stopPropagation();

    dragState.card.classList.remove("dev-drag-ghost");

    const grid = card.closest(".grid");
    if (!grid || !filteredRepos) return;

    const repoMap = new Map(filteredRepos.map((r) => [r.name, r]));
    const domCards = grid.querySelectorAll("[data-repo]");
    filteredRepos.length = 0;
    domCards.forEach((c) => {
      const repo = repoMap.get(c.dataset.repo);
      if (repo) filteredRepos.push(repo);
    });

    filteredRepos.forEach((r, i) => {
      getRC(r.name).order = i;
    });
    debouncedSave();

    dragState = null;
  });

  const overlay = document.createElement("div");
  overlay.className = "dev-overlay";

  const toolbar = document.createElement("div");
  toolbar.className = "dev-toolbar";

  const sizeBtns = [];
  ["small", "medium", "large"].forEach((s) => {
    const btn = document.createElement("button");
    btn.className = `dev-btn${currentSize === s ? " active" : ""}`;
    btn.textContent = s[0].toUpperCase();
    btn.title = s;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Update config
      const rc = getRC(name);
      rc.size = s;
      // Update DOM: swap card size class
      card.classList.remove("card-small", "card-medium", "card-large");
      card.classList.add(`card-${s}`);
      // Update active button
      sizeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      debouncedSave();
    });
    sizeBtns.push(btn);
    toolbar.appendChild(btn);
  });

  const hideBtn = document.createElement("button");
  hideBtn.className = "dev-btn";
  hideBtn.innerHTML = hidden ? eyeSVG : eyeOffSVG;
  hideBtn.title = hidden ? "Show" : "Hide";
  hideBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rc = getRC(name);
    rc.hidden = !rc.hidden;
    if (workingConfig.exclude) {
      const idx = workingConfig.exclude.indexOf(name);
      if (idx !== -1) workingConfig.exclude.splice(idx, 1);
    }
    // Update DOM
    const nowHidden = rc.hidden;
    card.classList.toggle("dev-hidden", nowHidden);
    hideBtn.innerHTML = nowHidden ? eyeSVG : eyeOffSVG;
    hideBtn.title = nowHidden ? "Show" : "Hide";
    debouncedSave();
  });
  toolbar.appendChild(hideBtn);

  const dropZone = document.createElement("div");
  dropZone.className = "dev-drop-zone";
  dropZone.textContent = "Drop image";

  const link = document.createElement("a");
  link.className = "dev-link";
  link.href = repo.homepage || repo.html_url;
  link.target = "_blank";
  link.rel = "noopener";
  link.innerHTML = linkSVG;
  link.addEventListener("click", (e) => e.stopPropagation());

  overlay.appendChild(toolbar);
  overlay.appendChild(dropZone);
  overlay.appendChild(link);
  card.appendChild(overlay);

  let dragCounter = 0;
  card.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounter++;
    card.classList.add("dev-dragover");
  });
  card.addEventListener("dragleave", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      card.classList.remove("dev-dragover");
    }
  });
  card.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  card.addEventListener("drop", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    card.classList.remove("dev-dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleDrop(name, card, file);
  });
}

export function initDevConfig(config, repos) {
  workingConfig = config;
  filteredRepos = repos;
  injectStyles();
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, i) => {
    if (repos[i]) addOverlay(card, repos[i]);
  });
}
