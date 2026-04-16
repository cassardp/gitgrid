import { createIcons, ImagePlus, ImageOff, Trash2, RotateCcw, Globe, Loader, Smartphone, Tablet, Monitor, Square, SquareDashed, PanelTop, Ellipsis } from "lucide";

function renderIcons(icons) {
  createIcons({ icons, nameAttr: "data-lucide" });
  document.querySelectorAll("svg[data-lucide]").forEach(el => el.removeAttribute("data-lucide"));
}

let workingConfig = null;
let saveTimer = null;
var captureQueue = Promise.resolve();

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
  var existing = card.querySelector(".dev-card-menu");
  if (existing) existing.remove();
  var oldPlaceholder = card.querySelector(".dev-no-image");
  if (oldPlaceholder) oldPlaceholder.remove();
  var rc = getRC(repo.name);
  var hasScreenshot = !!rc.screenshot;

  var menu = document.createElement("div");
  menu.className = "dev-card-menu";

  // Trigger button
  var trigger = document.createElement("button");
  trigger.className = "dev-card-trigger";
  trigger.innerHTML = '<i data-lucide="ellipsis"></i>';
  trigger.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var wasOpen = dropdown.classList.contains("open");
    // Close any other open dropdown
    document.querySelectorAll(".dev-card-dropdown.open").forEach(function (d) { d.classList.remove("open"); });
    if (!wasOpen) dropdown.classList.add("open");
  });
  menu.appendChild(trigger);

  // Dropdown
  var dropdown = document.createElement("div");
  dropdown.className = "dev-card-dropdown";

  var surfaceColor = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();

  if (hasScreenshot) {
    // Color picker
    var colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = rc.frameBg || surfaceColor;
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
    dropdown.appendChild(colorInput);

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
      card.style.removeProperty("--frame-bg");
      colorInput.value = surfaceColor;
      resetBtn.style.display = "none";
      if (window.detectCardBrightness) window.detectCardBrightness(card);
      debouncedSave();
    });
    colorInput.addEventListener("change", function () {
      resetBtn.style.display = "";
    });
    dropdown.appendChild(resetBtn);

    var chromeImg = card.querySelector(".card-frame-img");
    var MODE_CYCLE = ["mobile", "tablet", "desktop"];
    var MODE_ICON = { mobile: "smartphone", tablet: "tablet", desktop: "monitor" };
    var MODE_LABEL = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };
    function currentMode() {
      var m = window.getFrameMode(rc);
      if (m) return m;
      if (chromeImg && chromeImg.naturalWidth) {
        return chromeImg.naturalWidth < chromeImg.naturalHeight ? "mobile" : "tablet";
      }
      return "tablet";
    }
    function currentDecorated() {
      return window.isFrameDecorated(rc);
    }
    // Separator after color group
    var sepColor = document.createElement("div");
    sepColor.className = "dev-frame-sep";
    dropdown.appendChild(sepColor);

    var modeBtn = document.createElement("button");
    modeBtn.className = "dev-frame-btn";
    function updateModeIcon() {
      var m = currentMode();
      modeBtn.title = MODE_LABEL[m];
      modeBtn.innerHTML = '<i data-lucide="' + MODE_ICON[m] + '"></i>';
      renderIcons({ Smartphone, Tablet, Monitor });
    }
    updateModeIcon();
    if (chromeImg && !chromeImg.complete) chromeImg.addEventListener("load", updateModeIcon, { once: true });
    modeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var next = MODE_CYCLE[(MODE_CYCLE.indexOf(currentMode()) + 1) % MODE_CYCLE.length];
      rc.frameMode = next;
      delete rc.frameStyle;
      delete rc.showChrome;
      card.dataset.frameMode = next;
      delete card.dataset.frameStyle;
      card.classList.remove("card-frame-mobile", "card-frame-tablet", "card-frame-desktop", "card-frame-portrait", "card-frame-landscape", "card-frame-show-chrome");
      card.classList.add("card-frame-" + next);
      updateModeIcon();
      updateDecorIcon();
      if (window.detectCardBrightness) window.detectCardBrightness(card);
      debouncedSave();
    });
    dropdown.appendChild(modeBtn);

    // Decoration toggle (border on mobile/tablet, chrome on desktop)
    var decorBtn = document.createElement("button");
    decorBtn.className = "dev-frame-btn";
    function updateDecorIcon() {
      var mode = currentMode();
      var on = currentDecorated();
      var icon;
      if (mode === "desktop") icon = on ? "panel-top" : "square-dashed";
      else icon = on ? "square" : "square-dashed";
      decorBtn.title = mode === "desktop" ? "Browser chrome" : "Device border";
      decorBtn.innerHTML = '<i data-lucide="' + icon + '"></i>';
      renderIcons({ Square, SquareDashed, PanelTop });
    }
    updateDecorIcon();
    decorBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var next = !currentDecorated();
      rc.frameDecorated = next;
      delete rc.showChrome;
      card.classList.toggle("card-frame-decorated", next);
      updateDecorIcon();
      debouncedSave();
    });
    dropdown.appendChild(decorBtn);

    // Separator before destructive actions (remove screenshot + hide)
    var sepDestructive = document.createElement("div");
    sepDestructive.className = "dev-frame-sep";
    dropdown.appendChild(sepDestructive);

    // Remove screenshot
    var deleteBtn = document.createElement("button");
    deleteBtn.className = "dev-frame-btn";
    deleteBtn.title = "Remove screenshot";
    deleteBtn.innerHTML = '<i data-lucide="image-off"></i>';
    deleteBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.remove("open");
      applyImage(card, repo, null);
    });
    dropdown.appendChild(deleteBtn);
  } else {
    // Fetch from homepage (only if repo has a URL)
    if (repo.homepage && /^https?:\/\//.test(repo.homepage)) {
      var fetchBtn = document.createElement("button");
      fetchBtn.className = "dev-frame-btn";
      fetchBtn.title = "Fetch from website";
      fetchBtn.innerHTML = '<i data-lucide="globe"></i>';
      fetchBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.remove("open");
        triggerCapture(card, repo);
      });
      dropdown.appendChild(fetchBtn);
    }

    // Upload — directly opens file picker
    var addBtn = document.createElement("button");
    addBtn.className = "dev-frame-btn";
    addBtn.title = "Upload image";
    addBtn.innerHTML = '<i data-lucide="image-plus"></i>';
    addBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.remove("open");
      triggerUpload(card, repo);
    });
    dropdown.appendChild(addBtn);

    // Separator before hide
    var sepHide = document.createElement("div");
    sepHide.className = "dev-frame-sep";
    dropdown.appendChild(sepHide);
  }

  // Hide repo
  var hideBtn = document.createElement("button");
  hideBtn.className = "dev-frame-btn";
  hideBtn.title = "Hide repo";
  hideBtn.innerHTML = '<i data-lucide="trash-2"></i>';
  hideBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.remove("open");
    rc.hidden = true;
    debouncedSave();
    document.dispatchEvent(new CustomEvent("gitgrid:rerender"));
  });
  dropdown.appendChild(hideBtn);

  menu.appendChild(dropdown);
  menu.addEventListener("click", function (e) { e.stopPropagation(); });
  card.appendChild(menu);
  renderIcons({ ImageOff, ImagePlus, Globe, Trash2, RotateCcw, Smartphone, Tablet, Monitor, Square, SquareDashed, PanelTop, Ellipsis });
}

function applyImage(card, repo, imagePath) {
  const rc = getRC(repo.name);
  if (imagePath) {
    var prevKey = rc.screenshot;
    if (prevKey && prevKey !== imagePath) {
      fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: prevKey }),
      });
    }
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
    var addrText = repo.homepage && !repo.homepage.includes("github.com") ? new URL(repo.homepage).hostname.replace(/^www\./, "") : repo.name;
    chrome.innerHTML = '<span class="chrome-dot"></span><span class="chrome-dot"></span><span class="chrome-dot"></span><span class="chrome-address">' + addrText + '</span>';
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
    if (rc.frameBg) card.style.setProperty("--frame-bg", rc.frameBg);
    card.style.setProperty("--frame-pos", rc.framePosition || "center");
    card.classList.remove("card-dark-bg");
    var mode = window.getFrameMode(rc);
    if (mode) card.dataset.frameMode = mode;
    else delete card.dataset.frameMode;
    card.classList.toggle("card-frame-decorated", window.isFrameDecorated(rc));
    if (window.detectFrameRadius) window.detectFrameRadius(card);
    const placeholder = card.querySelector(".dev-no-image");
    if (placeholder) placeholder.remove();
    addCardToolbar(card, repo);
  } else {
    var oldKey = rc.screenshot;
    delete rc.screenshot;
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
    card.classList.remove("card-has-frame", "card-frame-mobile", "card-frame-tablet", "card-frame-desktop", "card-frame-portrait", "card-frame-landscape", "card-frame-show-chrome", "card-frame-decorated", "card-dark-bg");
    card.style.removeProperty("--frame-bg");
    card.style.backgroundImage = "";
    addCardToolbar(card, repo);
    setupPlaceholder(card, repo);
  }
  debouncedSave();
}

function triggerUpload(card, repo) {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async function () {
    var file = input.files[0];
    if (!file) return;
    file = await optimizeImage(file);
    var formData = new FormData();
    formData.append("file", file);
    formData.append("repo", repo.name);
    var r = await fetch("/api/images", { method: "POST", body: formData });
    var result = await r.json();
    if (result.key) applyImage(card, repo, result.key);
  });
  input.click();
}

function triggerCapture(card, repo) {
  var rc = getRC(repo.name);
  rc.captureTried = true;
  debouncedSave();
  var existing = card.querySelector(".dev-no-image");
  if (existing) existing.remove();
  card.dataset.capturing = "1";
  var label = document.createElement("div");
  label.className = "dev-no-image dev-no-image-loading";
  label.innerHTML = '<i data-lucide="loader"></i> Capturing\u2026';
  card.appendChild(label);
  renderIcons({ Loader });
  var svg = label.querySelector("svg");
  if (svg) svg.style.animation = "spin 1s linear infinite";
  captureQueue = captureQueue.then(function () { return autoCapture(card, repo); });
}

function setupPlaceholder(card, repo) {
  var rc = getRC(repo.name);
  if (rc.screenshot) return;
  var existing = card.querySelector(".dev-no-image");
  if (existing) existing.remove();

  var hasHomepage = repo.homepage && /^https?:\/\//.test(repo.homepage);

  // Auto-capture only on first discovery of this repo (never tried before)
  if (hasHomepage && !rc.captureTried && !card.dataset.capturing) {
    triggerCapture(card, repo);
    return;
  }

  var wrap = document.createElement("div");
  wrap.className = "dev-no-image";

  if (hasHomepage) {
    var captureBtn = document.createElement("button");
    captureBtn.className = "dev-no-image-btn";
    captureBtn.innerHTML = '<i data-lucide="globe"></i><span>Fetch</span>';
    captureBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      triggerCapture(card, repo);
    });
    wrap.appendChild(captureBtn);
  }

  var uploadBtn = document.createElement("button");
  uploadBtn.className = "dev-no-image-btn";
  uploadBtn.innerHTML = '<i data-lucide="image-plus"></i><span>Upload</span>';
  uploadBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    triggerUpload(card, repo);
  });
  wrap.appendChild(uploadBtn);

  card.appendChild(wrap);
  renderIcons({ Globe, ImagePlus });
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

function setupCardToolbar(card, repo) {
  addCardToolbar(card, repo);
}

export function initDevConfig(config, repos, saveFn) {
  workingConfig = config;
  saveConfigFn = saveFn;
  filteredRepos = repos;
  injectStyles();
  setupDocumentDragListeners();
  if (!window._devMenuClickOutside) {
    window._devMenuClickOutside = true;
    document.addEventListener("click", function () {
      document.querySelectorAll(".dev-card-dropdown.open").forEach(function (d) { d.classList.remove("open"); });
    });
  }
  const cards = document.querySelectorAll(".grid .card");
  cards.forEach((card, i) => {
    if (repos[i]) {
      card.addEventListener("click", function (e) { e.preventDefault(); });
      setupDrag(card, repos[i]);
      setupCardToolbar(card, repos[i]);
      setupPlaceholder(card, repos[i]);
    }
  });
}
