import { createIcons, X, Upload } from "lucide";

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
    .dev-upload-btn {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1.5px dashed #d5d5d5;
      background: none;
      color: #999;
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
      z-index: 1;
    }
    .dev-upload-btn:hover {
      border-color: var(--text-2);
      color: var(--text-2);
    }
    .dev-upload-input { display: none; }
    .dev-remove-img {
      position: absolute;
      top: 18px;
      left: 18px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,0.5);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 2;
    }
    .card:hover .dev-remove-img { opacity: 1; }
    .dev-remove-img:hover { background: rgba(220,38,38,0.8); }
    .dev-remove-img svg { width: 14px; height: 14px; }
    .dev-upload-btn svg { width: 14px; height: 14px; }
  `;
  document.head.appendChild(style);
}

function getRC(name) {
  if (!workingConfig.repos) workingConfig.repos = {};
  if (!workingConfig.repos[name]) workingConfig.repos[name] = {};
  return workingConfig.repos[name];
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

async function handleImageDrop(name, file) {
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
      getRC(name).screenshot = result.path;
      await saveConfig();
      const card = document.querySelector(`[data-repo="${name}"]`);
      if (card) {
        card.style.backgroundImage = `url('/${result.path}')`;
        card.style.backgroundSize = "cover";
        card.style.backgroundPosition = "center";
        const btn = card.querySelector(".dev-upload-btn");
        if (btn) btn.remove();
      }
    }
  };
  reader.readAsDataURL(file);
}

function setupDrag(card, repo) {
  const name = repo.name;

  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
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
    e.preventDefault();

    if (dragState) {
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
    }
  });

  card.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Card reorder
    if (dragState) {
      dragState.card.classList.remove("dev-drag-ghost");
      const grid = card.closest(".grid");
      if (grid && filteredRepos) {
        const repoMap = new Map(filteredRepos.map((r) => [r.name, r]));
        const domCards = grid.querySelectorAll("[data-repo]");
        filteredRepos.length = 0;
        domCards.forEach((c) => {
          const r = repoMap.get(c.dataset.repo);
          if (r) filteredRepos.push(r);
        });
        filteredRepos.forEach((r, i) => {
          getRC(r.name).order = i;
        });
        debouncedSave();
      }
      dragState = null;
      return;
    }

    // Image file drop
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageDrop(name, file);
  });
}

function setupRemoveImage(card, repo) {
  const rc = (workingConfig.repos && workingConfig.repos[repo.name]) || {};
  if (!rc.screenshot) return;

  const btn = document.createElement("button");
  btn.className = "dev-remove-img";
  btn.title = "Remove image";
  btn.innerHTML = `<i data-lucide="x"></i>`;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    delete getRC(repo.name).screenshot;
    await saveConfig();
    card.style.backgroundImage = "";
    btn.remove();
    setupUploadButton(card, repo);
  });

  card.appendChild(btn);
  createIcons({ icons: { X }, nameAttr: "data-lucide" });
}

function setupUploadButton(card, repo) {
  const rc = (workingConfig.repos && workingConfig.repos[repo.name]) || {};
  if (rc.screenshot) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "dev-upload-input";

  const btn = document.createElement("label");
  btn.className = "dev-upload-btn";
  btn.innerHTML = `<i data-lucide="upload"></i> Upload image`;
  btn.appendChild(input);

  btn.addEventListener("click", (e) => e.stopPropagation());

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) handleImageDrop(repo.name, file);
  });

  card.appendChild(btn);
  createIcons({ icons: { Upload }, nameAttr: "data-lucide" });
}

export function initDevConfig(config, repos) {
  workingConfig = config;
  filteredRepos = repos;
  injectStyles();
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, i) => {
    if (repos[i]) {
      setupDrag(card, repos[i]);
      setupUploadButton(card, repos[i]);
      setupRemoveImage(card, repos[i]);
    }
  });
}
