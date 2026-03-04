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
      location.reload();
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

export function initDevConfig(config, repos) {
  workingConfig = config;
  filteredRepos = repos;
  injectStyles();
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, i) => {
    if (repos[i]) setupDrag(card, repos[i]);
  });
}
