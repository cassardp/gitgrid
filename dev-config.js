import { createIcons, X, Upload, Eye, EyeOff, Image, Trash2 } from "lucide";

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
    .card.dev-drag-ghost {
      border: 2px dashed #3b82f6 !important;
      background: rgba(59, 130, 246, 0.06) !important;
      box-shadow: none !important;
    }
    .card.dev-drag-ghost > * { visibility: hidden; }
    .dev-remove-img {
      position: absolute;
      top: 18px;
      left: 18px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: var(--bg);
      color: var(--text-2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s, color 0.2s;
      z-index: 2;
    }
    .card:hover .dev-remove-img { opacity: 1; }
    .dev-remove-img:hover { background: rgba(220,38,38,0.8); color: #fff; }
    .dev-remove-img svg { width: 14px; height: 14px; }
    .dev-no-image {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1.5px dashed var(--icon-border);
      background: none;
      color: var(--text-3);
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
      z-index: 1;
    }
    .dev-no-image:hover {
      border-color: var(--text-2);
      color: var(--text-2);
    }
    .dev-no-image svg { width: 14px; height: 14px; }
    .picker-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .picker-overlay.visible { opacity: 1; }
    .picker {
      background: var(--surface);
      border-radius: 16px;
      width: 100%;
      max-width: 560px;
      max-height: 80vh;
      overflow-y: auto;
      padding: 32px;
      transform: translateY(8px);
      transition: transform 0.2s;
    }
    .picker-overlay.visible .picker { transform: translateY(0); }
    .picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .picker-title {
      font-size: 18px;
      font-weight: 500;
      color: var(--text);
    }
    .picker-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: none;
      color: var(--text-3);
      cursor: pointer;
    }
    .picker-close:hover { background: var(--bg); color: var(--text); }
    .picker-close svg { width: 18px; height: 18px; }
    .picker-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .picker-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.2s;
    }
    .picker-item:hover { border-color: var(--text-2); }
    .picker-item.selected { border-color: var(--text); }
    .picker-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .picker-item-delete {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,0.6);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .picker-item:hover .picker-item-delete { opacity: 1; }
    .picker-item-delete:hover { background: rgba(220,38,38,0.9); }
    .picker-item-delete svg { width: 12px; height: 12px; }
    .picker-actions {
      display: flex;
      gap: 8px;
    }
    .picker-btn {
      flex: 1;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--icon-border);
      background: none;
      color: var(--text-2);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: border-color 0.2s, color 0.2s;
    }
    .picker-btn:hover { border-color: var(--text-2); color: var(--text); }
    .picker-btn svg { width: 14px; height: 14px; }
    .picker-btn-danger { color: var(--text-3); }
    .picker-btn-danger:hover { border-color: rgba(220,38,38,0.5); color: rgba(220,38,38,0.9); }
    .picker-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-3);
      font-size: 13px;
    }
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
      const card = document.querySelector(`[data-repo="${name}"]`);
      if (card) applyImage(card, { name }, result.path);
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

function addRemoveButton(card, repo) {
  const existing = card.querySelector(".dev-remove-img");
  if (existing) existing.remove();
  const btn = document.createElement("button");
  btn.className = "dev-remove-img";
  btn.title = "Remove image";
  btn.innerHTML = `<i data-lucide="x"></i>`;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyImage(card, repo, null);
  });
  card.appendChild(btn);
  createIcons({ icons: { X }, nameAttr: "data-lucide" });
}

function applyImage(card, repo, imagePath) {
  const rc = getRC(repo.name);
  if (imagePath) {
    rc.screenshot = imagePath;
    card.style.backgroundImage = `url('/${imagePath}')`;
    card.style.backgroundSize = "cover";
    card.style.backgroundPosition = "center";
    const placeholder = card.querySelector(".dev-no-image");
    if (placeholder) placeholder.remove();
    addRemoveButton(card, repo);
  } else {
    delete rc.screenshot;
    card.style.backgroundImage = "";
    const removeBtn = card.querySelector(".dev-remove-img");
    if (removeBtn) removeBtn.remove();
    if (!card.querySelector(".dev-no-image")) {
      addPlaceholder(card, repo);
    }
  }
  debouncedSave();
}

function addPlaceholder(card, repo) {
  const btn = document.createElement("button");
  btn.className = "dev-no-image";
  btn.innerHTML = `<i data-lucide="image"></i> Add image`;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openImagePicker(card, repo);
  });
  card.appendChild(btn);
  createIcons({ icons: { Image }, nameAttr: "data-lucide" });
}

async function openImagePicker(card, repo) {
  const existing = document.querySelector(".picker-overlay");
  if (existing) existing.remove();

  const res = await fetch("/__list-images");
  const { images } = await res.json();
  const rc = getRC(repo.name);
  const current = rc.screenshot || "";

  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";

  const grid = images.length
    ? images.map(img => `
        <div class="picker-item${img === current ? " selected" : ""}" data-path="${img}">
          <img src="/${img}" alt="${img}">
          <button class="picker-item-delete" data-path="${img}" title="Delete image"><i data-lucide="trash-2"></i></button>
        </div>`).join("")
    : `<div class="picker-empty">No images yet. Upload one below.</div>`;

  overlay.innerHTML = `
    <div class="picker">
      <div class="picker-header">
        <span class="picker-title">Images</span>
        <button class="picker-close"><i data-lucide="x"></i></button>
      </div>
      <div class="picker-grid">${grid}</div>
      <div class="picker-actions">
        <button class="picker-btn" id="picker-upload">
          <i data-lucide="upload"></i> Upload
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  createIcons({ icons: { X, Upload, Trash2, Image }, nameAttr: "data-lucide" });

  const close = () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector(".picker-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Select an image
  overlay.querySelectorAll(".picker-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".picker-item-delete")) return;
      applyImage(card, repo, item.dataset.path);
      close();
    });
  });

  // Delete an image
  overlay.querySelectorAll(".picker-item-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const imgPath = btn.dataset.path;
      await fetch("/__delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath: imgPath }),
      });
      // Remove from any card config that uses it
      if (workingConfig.repos) {
        for (const name of Object.keys(workingConfig.repos)) {
          if (workingConfig.repos[name].screenshot === imgPath) {
            delete workingConfig.repos[name].screenshot;
            const c = document.querySelector(`[data-repo="${name}"]`);
            if (c) {
              c.style.backgroundImage = "";
              if (!c.querySelector(".dev-no-image")) addPlaceholder(c, { name });
            }
          }
        }
      }
      debouncedSave();
      btn.closest(".picker-item").remove();
      if (!overlay.querySelector(".picker-item")) {
        overlay.querySelector(".picker-grid").innerHTML = `<div class="picker-empty">No images yet. Upload one below.</div>`;
      }
    });
  });

  // Upload new image
  document.getElementById("picker-upload").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(",")[1];
        const r = await fetch("/__upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoName: repo.name, filename: file.name, data: base64 }),
        });
        const result = await r.json();
        if (result.ok) {
          applyImage(card, repo, result.path);
          close();
        }
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });

}

function setupImageButton(card, repo) {
  const rc = (workingConfig.repos && workingConfig.repos[repo.name]) || {};

  if (rc.screenshot) {
    addRemoveButton(card, repo);
  } else {
    addPlaceholder(card, repo);
  }
}

function setupVisibilityToggle(card, repo) {
  const rc = getRC(repo.name);
  const arrow = card.querySelector(".card-arrow");
  if (!arrow) return;

  const hidden = rc.hidden === true;
  arrow.title = hidden ? "Show repo" : "Hide repo";
  arrow.innerHTML = hidden
    ? `<i data-lucide="eye-off"></i>`
    : `<i data-lucide="eye"></i>`;

  arrow.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isHidden = rc.hidden === true;
    if (isHidden) {
      delete rc.hidden;
    } else {
      rc.hidden = true;
    }
    const nowHidden = rc.hidden === true;
    card.classList.toggle("card-hidden", nowHidden);
    arrow.title = nowHidden ? "Show repo" : "Hide repo";
    arrow.innerHTML = nowHidden
      ? `<i data-lucide="eye-off"></i>`
      : `<i data-lucide="eye"></i>`;
    createIcons({ icons: { Eye, EyeOff }, nameAttr: "data-lucide" });
    debouncedSave();
  });

  createIcons({ icons: { Eye, EyeOff }, nameAttr: "data-lucide" });
}

export function initDevConfig(config, repos) {
  workingConfig = config;
  filteredRepos = repos;
  injectStyles();
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, i) => {
    if (repos[i]) {
      setupDrag(card, repos[i]);
      setupImageButton(card, repos[i]);
      setupVisibilityToggle(card, repos[i]);
    }
  });
}
