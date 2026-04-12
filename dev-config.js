import { createIcons, X, Upload, Eye, EyeOff, Image, Trash2 } from "lucide";

function renderIcons(icons) {
  createIcons({ icons, nameAttr: "data-lucide" });
  document.querySelectorAll("svg[data-lucide]").forEach(el => el.removeAttribute("data-lucide"));
}

let workingConfig = null;
let saveTimer = null;
let stylesInjected = false;
let filteredRepos = null;
let dragState = null;
let dragListenersAttached = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .dev-drag-placeholder {
      border: 2px dashed var(--icon-border) !important;
      background: transparent !important;
      border-radius: var(--radius);
      aspect-ratio: 1;
      box-shadow: none !important;
    }
    .card.dev-dragging {
      box-shadow: 0 12px 32px rgba(0,0,0,0.18) !important;
      opacity: 0.92;
      cursor: grabbing;
    }
    .dev-remove-img {
      position: absolute;
      top: 18px;
      left: 18px;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: none;
      background: color-mix(in srgb, var(--text) 6%, transparent);
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
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workingConfig),
  });
  if (!res.ok) console.error("Save failed");
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveConfig, 300);
}

async function handleImageDrop(name, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("repo", name);
  const res = await fetch("/api/images", { method: "POST", body: formData });
  const result = await res.json();
  if (result.key) {
    const card = document.querySelector(`[data-repo="${name}"]`);
    if (card) applyImage(card, { name }, result.key);
  }
}

function setupDrag(card, repo) {
  var name = repo.name;

  card.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button, .card-arrow, input")) return;
    if (e.button !== 0) return;

    var rect = card.getBoundingClientRect();
    dragState = {
      card: card,
      name: name,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
      placeholder: null,
      grid: null,
      rafId: null,
    };
  });

  // File drop support (external image files only)
  card.addEventListener("dragover", function (e) {
    if (e.dataTransfer && e.dataTransfer.types.indexOf("Files") !== -1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });

  card.addEventListener("drop", function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      e.preventDefault();
      e.stopPropagation();
      handleImageDrop(name, file);
    }
  });
}

function getGridSlot(cx, cy, grid, draggedCard) {
  var style = getComputedStyle(grid);
  var cols = style.gridTemplateColumns.split(" ").length;
  var gap = parseFloat(style.gap) || 0;
  var rect = grid.getBoundingClientRect();
  var cellW = (rect.width - gap * (cols - 1)) / cols;
  var cellH = cellW;

  var x = cx - rect.left;
  var y = cy - rect.top;
  var col = Math.max(0, Math.min(Math.floor(x / (cellW + gap)), cols - 1));
  var row = Math.max(0, Math.floor(y / (cellH + gap)));

  var count = 0;
  for (var i = 0; i < grid.children.length; i++) {
    if (grid.children[i] !== draggedCard) count++;
  }

  return Math.max(0, Math.min(row * cols + col, count - 1));
}

function movePlaceholder(grid, placeholder, targetIndex, draggedCard) {
  var children = [];
  for (var i = 0; i < grid.children.length; i++) {
    if (grid.children[i] !== draggedCard) children.push(grid.children[i]);
  }

  var currentIndex = children.indexOf(placeholder);
  if (currentIndex === targetIndex) return;

  // FLIP — First: record card positions before move
  var cards = [];
  var firsts = [];
  for (var i = 0; i < children.length; i++) {
    if (children[i] !== placeholder) {
      cards.push(children[i]);
      firsts.push(children[i].getBoundingClientRect());
    }
  }

  // Move placeholder to new position
  placeholder.remove();
  var remaining = [];
  for (var i = 0; i < grid.children.length; i++) {
    if (grid.children[i] !== draggedCard) remaining.push(grid.children[i]);
  }
  if (targetIndex >= remaining.length) {
    grid.appendChild(placeholder);
  } else {
    grid.insertBefore(placeholder, remaining[targetIndex]);
  }

  // FLIP — Last + Invert: apply inverse transforms
  var moved = [];
  for (var i = 0; i < cards.length; i++) {
    var last = cards[i].getBoundingClientRect();
    var dx = firsts[i].left - last.left;
    var dy = firsts[i].top - last.top;
    if (dx === 0 && dy === 0) continue;
    cards[i].style.transition = "none";
    cards[i].style.transform = "translate(" + dx + "px," + dy + "px)";
    moved.push(cards[i]);
  }

  // FLIP — Play: animate to final position
  void grid.offsetHeight;
  for (var i = 0; i < moved.length; i++) {
    moved[i].style.transition = "transform 0.2s ease";
    moved[i].style.transform = "";
  }
}

function setupDocumentDragListeners() {
  if (dragListenersAttached) return;
  dragListenersAttached = true;

  document.addEventListener("pointermove", function (e) {
    if (!dragState) return;

    var ds = dragState;

    if (!ds.moved) {
      var dx = e.clientX - ds.startX;
      var dy = e.clientY - ds.startY;
      if (dx * dx + dy * dy < 25) return;

      ds.moved = true;
      var grid = ds.card.closest(".grid");
      ds.grid = grid;

      var placeholder = document.createElement("div");
      placeholder.className = "dev-drag-placeholder";
      grid.insertBefore(placeholder, ds.card);
      ds.placeholder = placeholder;

      ds.card.style.position = "fixed";
      ds.card.style.zIndex = "1000";
      ds.card.style.width = ds.width + "px";
      ds.card.style.height = ds.height + "px";
      ds.card.style.transition = "box-shadow 0.2s, opacity 0.2s";
      ds.card.style.pointerEvents = "none";
      ds.card.style.margin = "0";
      ds.card.classList.add("dev-dragging");

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    }

    if (ds.moved) {
      ds.card.style.left = (e.clientX - ds.offsetX) + "px";
      ds.card.style.top = (e.clientY - ds.offsetY) + "px";

      if (ds.rafId) cancelAnimationFrame(ds.rafId);
      var cx = e.clientX, cy = e.clientY;
      ds.rafId = requestAnimationFrame(function () {
        if (!dragState || !dragState.moved) return;
        var slot = getGridSlot(cx, cy, ds.grid, ds.card);
        movePlaceholder(ds.grid, ds.placeholder, slot, ds.card);
      });
    }
  });

  document.addEventListener("pointerup", function () {
    if (!dragState) return;

    var ds = dragState;

    if (ds.moved) {
      if (ds.rafId) cancelAnimationFrame(ds.rafId);

      var card = ds.card;
      var grid = ds.grid;

      grid.insertBefore(card, ds.placeholder);
      ds.placeholder.remove();

      card.style.position = "";
      card.style.zIndex = "";
      card.style.width = "";
      card.style.height = "";
      card.style.left = "";
      card.style.top = "";
      card.style.transition = "";
      card.style.pointerEvents = "";
      card.style.margin = "";
      card.classList.remove("dev-dragging");

      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      // Clear any leftover FLIP transforms
      var allCards = grid.querySelectorAll(".card");
      allCards.forEach(function (c) {
        c.style.transition = "";
        c.style.transform = "";
      });

      if (filteredRepos) {
        var repoMap = new Map(filteredRepos.map(function (r) { return [r.name, r]; }));
        var domCards = grid.querySelectorAll("[data-repo]");
        filteredRepos.length = 0;
        domCards.forEach(function (c) {
          var r = repoMap.get(c.dataset.repo);
          if (r) filteredRepos.push(r);
        });
        filteredRepos.forEach(function (r, i) {
          getRC(r.name).order = i;
        });
        debouncedSave();
      }

      card.addEventListener("click", function (ev) {
        ev.preventDefault();
      }, { once: true });
    }

    dragState = null;
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
  renderIcons({ X });
}

function applyImage(card, repo, imagePath) {
  const rc = getRC(repo.name);
  if (imagePath) {
    rc.screenshot = imagePath;
    card.style.backgroundImage = `url('/img/${imagePath}')`;
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
  renderIcons({ Image });
}

async function openImagePicker(card, repo) {
  const existing = document.querySelector(".picker-overlay");
  if (existing) existing.remove();

  const res = await fetch("/api/images");
  const { images: imageList } = await res.json();
  const rc = getRC(repo.name);
  const current = rc.screenshot || "";
  const images = imageList.map(img => img.r2_key);

  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";

  const grid = images.length
    ? images.map(img => `
        <div class="picker-item${img === current ? " selected" : ""}" data-path="${img}">
          <img src="/img/${img}" alt="${img}">
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
  renderIcons({ X, Upload, Trash2, Image });

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
      await fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: imgPath }),
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("repo", repo.name);
      const r = await fetch("/api/images", { method: "POST", body: formData });
      const result = await r.json();
      if (result.key) {
        applyImage(card, repo, result.key);
        close();
      }
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
    renderIcons({ Eye, EyeOff });
    debouncedSave();
  });

  renderIcons({ Eye, EyeOff });
}

export function initDevConfig(config, repos) {
  workingConfig = config;
  filteredRepos = repos;
  injectStyles();
  setupDocumentDragListeners();
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, i) => {
    if (repos[i]) {
      setupDrag(card, repos[i]);
      setupImageButton(card, repos[i]);
      setupVisibilityToggle(card, repos[i]);
    }
  });
}
