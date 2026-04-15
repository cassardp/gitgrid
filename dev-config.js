import { createIcons, X, Upload, Image, Trash2, RotateCcw, EyeOff, Plus, Camera, Loader } from "lucide";

function renderIcons(icons) {
  createIcons({ icons, nameAttr: "data-lucide" });
  document.querySelectorAll("svg[data-lucide]").forEach(el => el.removeAttribute("data-lucide"));
}

let workingConfig = null;
let saveTimer = null;
var captureQueue = Promise.resolve();
var skipAutoCapture = new Set();

var MAX_SIZE = 1200;
var QUALITY = 0.82;

function optimizeImage(file) {
  return new Promise(function (resolve) {
    if (!file.type.startsWith("image/")) return resolve(file);
    var img = new window.Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        var ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(function (blob) {
        if (!blob) return resolve(file);
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      }, "image/webp", QUALITY);
    };
    img.onerror = function () { resolve(file); };
    img.src = URL.createObjectURL(file);
  });
}
let filteredRepos = null;
let dragState = null;
let dragListenersAttached = false;

function injectStyles() {}

function getRC(name) {
  if (!workingConfig.repos) workingConfig.repos = {};
  if (!workingConfig.repos[name]) workingConfig.repos[name] = {};
  return workingConfig.repos[name];
}

var saveConfigFn = null;

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() { if (saveConfigFn) saveConfigFn(); }, 300);
}

async function handleImageDrop(name, file) {
  file = await optimizeImage(file);
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
  if (matchMedia("(pointer: coarse)").matches) return;
  var name = repo.name;

  card.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button, input")) return;
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
      card.style.animation = "none";
      card.style.opacity = "1";
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

function addCardToolbar(card, repo) {
  var existing = card.querySelector(".dev-frame-toolbar");
  if (existing) existing.remove();
  var oldPlaceholder = card.querySelector(".dev-no-image");
  if (oldPlaceholder) oldPlaceholder.remove();
  var rc = getRC(repo.name);
  var hasScreenshot = !!rc.screenshot;

  var toolbar = document.createElement("div");
  toolbar.className = "dev-frame-toolbar";

  if (hasScreenshot) {
    // Color picker
    var colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = rc.frameBg || "#DADAD7";
    colorInput.title = "Background color";
    colorInput.className = "dev-frame-color";
    colorInput.addEventListener("input", function (e) {
      e.stopPropagation();
      rc.frameBg = colorInput.value;
      card.style.setProperty("--frame-bg", colorInput.value);
      if (window.detectCardBrightness) window.detectCardBrightness(card);
      debouncedSave();
    });
    colorInput.addEventListener("click", function (e) { e.stopPropagation(); });
    toolbar.appendChild(colorInput);

    // Reset (hidden until color is changed)
    var resetBtn = document.createElement("button");
    resetBtn.className = "dev-frame-btn";
    resetBtn.title = "Reset";
    resetBtn.innerHTML = '<i data-lucide="rotate-ccw"></i>';
    resetBtn.style.display = rc.frameBg ? "" : "none";
    resetBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      delete rc.frameBg;
      card.style.setProperty("--frame-bg", "#DADAD7");
      colorInput.value = "#DADAD7";
      resetBtn.style.display = "none";
      if (window.detectCardBrightness) window.detectCardBrightness(card);
      debouncedSave();
    });
    colorInput.addEventListener("change", function () {
      resetBtn.style.display = "";
    });
    toolbar.appendChild(resetBtn);

    // Separator
    var sep1 = document.createElement("div");
    sep1.className = "dev-frame-sep";
    toolbar.appendChild(sep1);
  }

  if (hasScreenshot) {
    // Remove screenshot
    var deleteBtn = document.createElement("button");
    deleteBtn.className = "dev-frame-btn";
    deleteBtn.title = "Remove screenshot";
    deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
    deleteBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      applyImage(card, repo, null);
    });
    toolbar.appendChild(deleteBtn);
  } else {
    // Add screenshot
    var addBtn = document.createElement("button");
    addBtn.className = "dev-frame-btn";
    addBtn.title = "Add screenshot";
    addBtn.innerHTML = '<i data-lucide="plus"></i>';
    addBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openImagePicker(card, repo);
    });
    toolbar.appendChild(addBtn);
  }

  // Hide repo
  var hideBtn = document.createElement("button");
  hideBtn.className = "dev-frame-btn";
  hideBtn.title = "Hide repo";
  hideBtn.innerHTML = '<i data-lucide="eye-off"></i>';
  hideBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    rc.hidden = true;
    debouncedSave();
    document.dispatchEvent(new CustomEvent("gitgrid:rerender"));
  });
  toolbar.appendChild(hideBtn);

  toolbar.addEventListener("click", function (e) { e.stopPropagation(); });
  card.appendChild(toolbar);
  renderIcons({ Trash2, RotateCcw, EyeOff, Plus });
}

function applyImage(card, repo, imagePath) {
  const rc = getRC(repo.name);
  if (imagePath) {
    rc.screenshot = imagePath;
    // Remove old background-image styles (backward compat)
    card.style.backgroundImage = "";
    card.style.backgroundSize = "";
    card.style.backgroundPosition = "";
    // Remove existing frame if any
    var oldFrame = card.querySelector(".card-frame");
    if (oldFrame) oldFrame.remove();
    // Create frame DOM
    var frameDiv = document.createElement("div");
    frameDiv.className = "card-frame";
    var deviceDiv = document.createElement("div");
    deviceDiv.className = "card-frame-device";
    var chrome = document.createElement("div");
    chrome.className = "card-frame-chrome";
    chrome.innerHTML = '<span class="chrome-dot"></span><span class="chrome-dot"></span><span class="chrome-dot"></span>';
    deviceDiv.appendChild(chrome);
    var img = document.createElement("img");
    img.className = "card-frame-img";
    img.src = "/img/" + imagePath;
    img.alt = "";
    deviceDiv.appendChild(img);
    frameDiv.appendChild(deviceDiv);
    card.insertBefore(frameDiv, card.firstChild);
    // Apply frame classes
    card.classList.add("card-has-frame");
    card.style.setProperty("--frame-bg", rc.frameBg || "#DADAD7");
    card.style.setProperty("--frame-pos", rc.framePosition || "center");
    card.classList.remove("card-dark-bg");
    if (window.detectFrameRadius) window.detectFrameRadius(card);
    const placeholder = card.querySelector(".dev-no-image");
    if (placeholder) placeholder.remove();
    addCardToolbar(card, repo);
  } else {
    var oldKey = rc.screenshot;
    delete rc.screenshot;
    skipAutoCapture.add(repo.name);
    // Delete from R2 + D1
    if (oldKey) {
      fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: oldKey }),
      });
    }
    // Remove frame
    var frame = card.querySelector(".card-frame");
    if (frame) frame.remove();
    card.classList.remove("card-has-frame", "card-frame-landscape", "card-frame-portrait", "card-dark-bg");
    card.style.removeProperty("--frame-bg");
    card.style.backgroundImage = "";
    addCardToolbar(card, repo);
    setupPlaceholder(card, repo);
  }
  debouncedSave();
}

function setupPlaceholder(card, repo) {
  var rc = getRC(repo.name);
  if (rc.screenshot) return;
  var existing = card.querySelector(".dev-no-image");
  if (existing) existing.remove();

  // Auto-capture if repo has a homepage URL and no image yet (skip if manually removed)
  var hasHomepage = repo.homepage && /^https?:\/\//.test(repo.homepage);
  if (hasHomepage && !card.dataset.capturing && !skipAutoCapture.has(repo.name)) {
    card.dataset.capturing = "1";
    var label = document.createElement("div");
    label.className = "dev-no-image";
    label.innerHTML = '<i data-lucide="loader"></i> Capturing\u2026';
    card.appendChild(label);
    renderIcons({ Loader });
    var svg = label.querySelector("svg");
    if (svg) svg.style.animation = "spin 1s linear infinite";
    captureQueue = captureQueue.then(function() { return autoCapture(card, repo); });
    return;
  }

  var btn = document.createElement("button");
  btn.className = "dev-no-image";
  if (card.classList.contains("card-dark-bg")) btn.classList.add("dev-no-image-light");
  btn.innerHTML = `<i data-lucide="image"></i> Add screenshot`;
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    openImagePicker(card, repo);
  });
  card.appendChild(btn);
  renderIcons({ Image });
}

async function fetchCapture(repoName) {
  for (var attempts = 0; attempts < 3; attempts++) {
    var r = await fetch("/api/screenshots/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: repoName }),
    });
    if (r.status === 429 && attempts < 2) {
      await new Promise(function(res) { setTimeout(res, 3000); });
      continue;
    }
    return await r.json();
  }
  return null;
}

async function autoCapture(card, repo) {
  try {
    var result = await fetchCapture(repo.name);
    if (result && result.key) {
      applyImage(card, repo, result.key);
      debouncedSave();
    } else {
      delete card.dataset.capturing;
      setupPlaceholder(card, repo);
    }
  } catch {
    delete card.dataset.capturing;
    setupPlaceholder(card, repo);
  }
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
    : `<div class="picker-empty"><i data-lucide="image"></i>No images yet</div>`;

  const hasHomepage = repo.homepage && /^https?:\/\//.test(repo.homepage);

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
        ${hasHomepage ? `<button class="picker-btn" id="picker-capture" title="${repo.homepage.replace(/[&"<>]/g, '')}">
          <i data-lucide="camera"></i> Capture
        </button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  renderIcons({ X, Upload, Trash2, Image, Camera });

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
              var fr = c.querySelector(".card-frame");
              if (fr) fr.remove();
              var tb = c.querySelector(".dev-frame-toolbar");
              if (tb) tb.remove();
              c.classList.remove("card-has-frame", "card-frame-landscape", "card-frame-portrait", "card-dark-bg");
              c.style.removeProperty("--frame-bg");
              c.style.backgroundImage = "";
              if (!c.querySelector(".dev-no-image")) setupPlaceholder(c, { name });
            }
          }
        }
      }
      debouncedSave();
      btn.closest(".picker-item").remove();
      if (!overlay.querySelector(".picker-item")) {
        overlay.querySelector(".picker-grid").innerHTML = `<div class="picker-empty"><i data-lucide="image"></i>No images yet</div>`;
      }
    });
  });

  // Upload new image
  document.getElementById("picker-upload").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      var file = input.files[0];
      if (!file) return;
      file = await optimizeImage(file);
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

  // Capture screenshot from homepage URL
  const captureBtn = document.getElementById("picker-capture");
  if (captureBtn) {
    captureBtn.addEventListener("click", async () => {
      captureBtn.disabled = true;
      captureBtn.innerHTML = '<i data-lucide="loader"></i> Capturing\u2026';
      renderIcons({ Loader });
      // Spin the loader icon
      const loaderSvg = captureBtn.querySelector("svg");
      if (loaderSvg) loaderSvg.style.animation = "spin 1s linear infinite";
      try {
        var result = await fetchCapture(repo.name);
        if (result && result.key) {
          applyImage(card, repo, result.key);
          close();
        } else {
          captureBtn.innerHTML = '<i data-lucide="camera"></i> Failed';
          renderIcons({ Camera });
          captureBtn.disabled = false;
        }
      } catch {
        captureBtn.innerHTML = '<i data-lucide="camera"></i> Failed';
        renderIcons({ Camera });
        captureBtn.disabled = false;
      }
    });
  }

}

function setupCardToolbar(card, repo) {
  addCardToolbar(card, repo);
}

export function initDevConfig(config, repos, saveFn) {
  workingConfig = config;
  saveConfigFn = saveFn;
  filteredRepos = repos;
  injectStyles();
  setupDocumentDragListeners();
  const cards = document.querySelectorAll(".grid .card");
  cards.forEach((card, i) => {
    if (repos[i]) {
      setupDrag(card, repos[i]);
      setupCardToolbar(card, repos[i]);
      setupPlaceholder(card, repos[i]);
    }
  });
}
