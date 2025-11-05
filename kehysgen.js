// KehysGen â€“ kehysten lataus ja muokkaustyÃ¶kalut

const W = 1920, H = 1080;
const PREV_W = 960, PREV_H = 540;

const els = {
  // Kehykset
  framesList: document.getElementById('framesList'),
  refreshFramesBtn: document.getElementById('refreshFramesBtn'),
  clearFramesBtn: document.getElementById('clearFramesBtn'),
  noFrameBtn: document.getElementById('noFrameBtn'),

  // Kuvan I/O
  fileInput: document.getElementById('fileInput'),
  downloadBtn: document.getElementById('downloadBtn'),
  downloadBaseBtn: document.getElementById('downloadBaseBtn'),
  clearBtn: document.getElementById('clearBtn'),

  // Canvas & viestit
  canvas: document.getElementById('previewCanvas'),
  hint: document.getElementById('hint'),
  warn: document.getElementById('warn'),

  // Presetit & kontrollit
  presetsRow: document.getElementById('presetsRow'),
  flipXBtn: document.getElementById('flipXBtn'),
  resetBtn: document.getElementById('resetBtn'),

  brightness: document.getElementById('brightness'),
  brightnessVal: document.getElementById('brightnessVal'),
  contrast: document.getElementById('contrast'),
  contrastVal: document.getElementById('contrastVal'),
  saturate: document.getElementById('saturate'),
  saturateVal: document.getElementById('saturateVal'),
  hue: document.getElementById('hue'),
  hueVal: document.getElementById('hueVal'),
  grayscale: document.getElementById('grayscale'),

  blur: document.getElementById('blur'),
  blurVal: document.getElementById('blurVal'),

  scale: document.getElementById('scale'),
  scaleVal: document.getElementById('scaleVal'),
  scaleX: document.getElementById('scaleX'),
  scaleXVal: document.getElementById('scaleXVal'),
  scaleY: document.getElementById('scaleY'),
  scaleYVal: document.getElementById('scaleYVal'),

  vignette: document.getElementById('vignette'),
  vignetteVal: document.getElementById('vignetteVal'),
  vignetteShape: document.getElementById('vignetteShape'),

  grain: document.getElementById('grain'),
  grainVal: document.getElementById('grainVal'),

  // (Mahdolliset nuolipainikkeet, jos ne ovat vielÃ¤ HTML:ssÃ¤)
  moveLeft: document.getElementById('moveLeft'),
  moveRight: document.getElementById('moveRight'),
  moveUp: document.getElementById('moveUp'),
  moveDown: document.getElementById('moveDown'),
  zeroOffset: document.getElementById('zeroOffset')
};

const ctx = els.canvas.getContext('2d', { alpha: true });

// ===== IndexedDB =====
const DB_NAME = 'kehysgeneraattori-db';
const STORE = 'frames';

async function openDB() {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => {
      const db2 = req.result;
      if (!db2.objectStoreNames.contains(STORE)) {
        const os = db2.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('byName', 'name', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

async function dbPut(frame) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(frame);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ===== Apurit =====
function showWarn(msg) {
  els.warn.hidden = false;
  els.warn.textContent = msg;
}
function clearWarn() {
  els.warn.hidden = true;
  els.warn.textContent = '';
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function updateRangeFill(el) {
  if (!el) return;
  const min = Number(el.min ?? 0);
  const max = Number(el.max ?? 100);
  const value = Number(el.value ?? min);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  el.style.setProperty('--kg-range-value', `${clamp(percent, 0, 100)}%`);
}

async function bitmapFromBlob(blob) {
  return await createImageBitmap(blob);
}

async function scaleBitmap(src, outW, outH) {
  const c = ('OffscreenCanvas' in window)
    ? new OffscreenCanvas(outW, outH)
    : Object.assign(document.createElement('canvas'), { width: outW, height: outH });

  const g = c.getContext('2d', { alpha: true });
  g.imageSmoothingQuality = 'high';
  g.clearRect(0, 0, outW, outH);
  g.drawImage(src, 0, 0, outW, outH);

  if (c instanceof OffscreenCanvas) return await createImageBitmap(c);
  const url = c.toDataURL('image/png');
  const blob = await (await fetch(url)).blob();
  return await createImageBitmap(blob);
}

// Grain
let noisePrev = null, noiseFull = null;
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function createGrainCanvas(w, h, seed = 1337) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rnd() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function ensureNoise() {
  if (!noisePrev) noisePrev = createGrainCanvas(PREV_W, PREV_H, 1337);
  if (!noiseFull) noiseFull = createGrainCanvas(W, H, 7331);
}
function drawGrain(ctx2, outW, outH, strengthPct) {
  if (!strengthPct) return;
  ensureNoise();
  const tex = (outW === PREV_W && outH === PREV_H) ? noisePrev : noiseFull;
  const alpha = Math.min(Math.max(strengthPct, 0), 100) / 100 * 0.35;
  ctx2.save();
  ctx2.globalAlpha = alpha;
  ctx2.globalCompositeOperation = 'soft-light';
  ctx2.drawImage(tex, 0, 0, outW, outH);
  ctx2.restore();
}

// ===== tila =====
let baseImagePrev = null;
let baseImageFull = null;
let currentFrameId = null;
const frameCache = new Map();

const edit = {
  flipX: false, brightness: 100, contrast: 100, saturate: 100, hue: 0,
  grayscale: false, blur: 0, scale: 100, scaleX: 100, scaleY: 100,
  vignette: 0, vignetteShape: 'round', grain: 0, offsetX: 0, offsetY: 0
};

// Presetit
const PRESETS = [
  { id: 'clean',     name: 'Clean',      set: { brightness: 105, contrast: 105, saturate: 110, hue: 0,  grayscale: false, blur: 0, vignette: 8,  grain: 5 } },
  { id: 'vivid',     name: 'Vivid Pop',  set: { brightness: 102, contrast: 116, saturate: 130, hue: 0,  grayscale: false, blur: 0, vignette: 6,  grain: 8 } },
  { id: 'noir',      name: 'Noir B/W',   set: { brightness: 105, contrast: 130, saturate: 0,   hue: 0,  grayscale: true,  blur: 0, vignette: 30, grain: 12 } },
  { id: 'cineBlue',  name: 'Cine Blue',  set: { brightness: 100, contrast: 112, saturate: 108, hue: -12, grayscale: false, blur: 0, vignette: 20, grain: 18 } },
  { id: 'cineTeal',  name: 'Cine Teal',  set: { brightness: 101, contrast: 115, saturate: 112, hue: -18, grayscale: false, blur: 0, vignette: 24, grain: 20 } },
  { id: 'cineGreen', name: 'Cine Green', set: { brightness: 100, contrast: 110, saturate: 108, hue: -35, grayscale: false, blur: 0, vignette: 18, grain: 16 } },
  { id: 'warmcine',  name: 'Warm Cine',  set: { brightness: 102, contrast: 110, saturate: 115, hue: 12,  grayscale: false, blur: 0, vignette: 22, grain: 12 } },
  { id: 'matte',     name: 'Matte Fade', set: { brightness: 106, contrast: 90,  saturate: 90,  hue: 0,  grayscale: false, blur: 0, vignette: 18, grain: 10 } },
  { id: 'glow',      name: 'Soft Glow',  set: { brightness: 106, contrast: 98,  saturate: 110, hue: 0,  grayscale: false, blur: 2, vignette: 10, grain: 8 } },
];

function renderPresets() {
  els.presetsRow.innerHTML = '';
  PRESETS.forEach(p => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = p.name;
    chip.dataset.preset = p.id;
    chip.addEventListener('click', () => applyPreset(p));
    els.presetsRow.appendChild(chip);
  });
}

function applyPreset(p) {
  Object.assign(edit, p.set);
  syncControlsUI();
  drawPreview();
  els.presetsRow.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('active', c.dataset.preset === p.id)
  );
}

// Kehyksen kortti
function frameItemCard({ id, name, thumbDataUrl }) {
  const item = document.createElement('div');
  item.className = 'frame-item';

  const wrap = document.createElement('div');
  wrap.className = 'frame-thumb-wrap';
  const img = new Image();
  img.className = 'frame-thumb';
  img.loading = 'lazy'; img.decoding = 'async';
  img.src = thumbDataUrl;
  wrap.appendChild(img);

  const cap = document.createElement('div');
  cap.className = 'frame-caption';
  const title = document.createElement('div'); title.className = 'frame-title'; title.textContent = name || id;
  const sub = document.createElement('div'); sub.className = 'frame-sub'; sub.textContent = id;
  cap.append(title, sub);

  item.append(wrap, cap);
  item.addEventListener('click', async () => {
    document.querySelectorAll('.frame-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    currentFrameId = id;
    if (!frameCache.has(id)) await ensureFrameBitmapsLoaded(id);
    drawPreview();
  });
  return item;
}

async function ensureFrameBitmapsLoaded(id) {
  if (frameCache.has(id)) return;
  const all = await dbGetAll();
  const rec = all.find(r => r.id === id);
  if (!rec) return;
  const fullBmp = await bitmapFromBlob(rec.pngBlob);
  const prevBmp = await scaleBitmap(fullBmp, PREV_W, PREV_H);
  frameCache.set(id, { fullBmp, prevBmp, name: rec.name });
}

// Piirto
function buildFilter() {
  return [
    `blur(${edit.blur}px)`,
    `brightness(${edit.brightness}%)`,
    `contrast(${edit.contrast}%)`,
    `saturate(${edit.saturate}%)`,
    `hue-rotate(${edit.hue}deg)`,
    `grayscale(${edit.grayscale ? 100 : 0}%)`
  ].join(' ');
}

function computeDrawRect(outW, outH, scale, scaleX, scaleY, offsetX, offsetY) {
  const sU = Math.max(0, scale) / 100;
  const sX = sU * Math.max(0, scaleX) / 100;
  const sY = sU * Math.max(0, scaleY) / 100;
  const w = Math.round(outW * sX);
  const h = Math.round(outH * sY);
  const x = Math.round((outW - w) / 2) + offsetX;
  const y = Math.round((outH - h) / 2) + offsetY;
  return { x, y, w, h };
}

function drawBaseImageTo(ctx2, bmp, outW, outH, offsetX, offsetY, flipX, filterStr, scale, scaleX, scaleY) {
  const { x, y, w, h } = computeDrawRect(outW, outH, scale, scaleX, scaleY, offsetX, offsetY);
  if (w <= 0 || h <= 0) return;
  ctx2.save();
  ctx2.filter = filterStr || 'none';
  if (flipX) {
    ctx2.translate(outW, 0);
    ctx2.scale(-1, 1);
    ctx2.drawImage(bmp, outW - (x + w), y, w, h);
  } else {
    ctx2.drawImage(bmp, x, y, w, h);
  }
  ctx2.restore();
  ctx2.filter = 'none';
}

function drawVignetteRound(ctx2, outW, outH, strengthPct) {
  if (!strengthPct) return;
  const strength = Math.min(Math.max(strengthPct, 0), 100) / 100;
  const radius = Math.hypot(outW, outH) * 0.55;
  const cx = outW / 2, cy = outH / 2;
  const g = ctx2.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
  g.addColorStop(0.0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, `rgba(0,0,0,${0.4 * strength})`);
  g.addColorStop(1.0, `rgba(0,0,0,${0.7 * strength})`);
  ctx2.save(); ctx2.fillStyle = g; ctx2.fillRect(0, 0, outW, outH); ctx2.restore();
}

function drawVignetteSquare(ctx2, outW, outH, strengthPct) {
  if (!strengthPct) return;
  const s = Math.min(Math.max(strengthPct, 0), 100) / 100;
  ctx2.save();
  let g = ctx2.createLinearGradient(0, 0, outW / 2, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * s})`); g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx2.fillStyle = g; ctx2.fillRect(0, 0, outW / 2, outH);

  g = ctx2.createLinearGradient(outW, 0, outW / 2, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * s})`); g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx2.fillStyle = g; ctx2.fillRect(outW / 2, 0, outW / 2, outH);

  g = ctx2.createLinearGradient(0, 0, 0, outH / 2);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * s})`); g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx2.fillStyle = g; ctx2.fillRect(0, 0, outW, outH / 2);

  g = ctx2.createLinearGradient(0, outH, 0, outH / 2);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * s})`); g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx2.fillStyle = g; ctx2.fillRect(0, outH / 2, outW, outH / 2);
  ctx2.restore();
}

function drawVignette(ctx2, outW, outH, strengthPct, shape) {
  if (shape === 'square') drawVignetteSquare(ctx2, outW, outH, strengthPct);
  else drawVignetteRound(ctx2, outW, outH, strengthPct);
}

function drawPreview() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

  if (baseImagePrev) {
    const sX = PREV_W / W, sY = PREV_H / H;
    const dx = Math.round(edit.offsetX * sX);
    const dy = Math.round(edit.offsetY * sY);
    drawBaseImageTo(ctx, baseImagePrev, PREV_W, PREV_H, dx, dy, edit.flipX, buildFilter(), edit.scale, edit.scaleX, edit.scaleY);
    drawVignette(ctx, PREV_W, PREV_H, edit.vignette, edit.vignetteShape);
    drawGrain(ctx, PREV_W, PREV_H, edit.grain);
  }

  if (currentFrameId && frameCache.has(currentFrameId)) {
    const { prevBmp } = frameCache.get(currentFrameId);
    ctx.drawImage(prevBmp, 0, 0, PREV_W, PREV_H);
  }

  const hasImg = !!baseImageFull;
  els.downloadBtn.disabled = !hasImg;
  els.downloadBaseBtn.disabled = !hasImg;
  els.clearBtn.disabled = !baseImagePrev;
}

// ===== Kehysten lataus (manifest.json / manifest.js) =====
async function tryFetchManifestJSON() {
  const candidates = ['/frames/manifest.json', 'frames/manifest.json'];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  return null;
}

async function tryLoadManifestJS() {
  if (Array.isArray(window.FRAMES_MANIFEST)) return window.FRAMES_MANIFEST;
  const candidates = ['/frames/manifest.js', 'frames/manifest.js'];
  for (const url of candidates) {
    try {
      const arr = await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
        s.async = true;
        s.onload = () => {
          if (Array.isArray(window.FRAMES_MANIFEST)) resolve(window.FRAMES_MANIFEST);
          else reject(new Error('FRAMES_MANIFEST puuttuu'));
        };
        s.onerror = () => reject(new Error('manifest.js lataus epÃ¤onnistui'));
        document.head.appendChild(s);
      });
      if (Array.isArray(arr)) return arr;
    } catch (_) {}
  }
  return null;
}

async function populateFramesFromList(entries) {
  await dbClear();
  frameCache.clear();
  currentFrameId = null;

  for (const entry of entries) {
    const file = entry?.file;
    if (!file || !/\.png$/i.test(file)) continue;
    const name = entry?.name || file.replace(/\.png$/i, '');
    const urls = [`/frames/${file}`, `frames/${file}`];

    let imgRes = null;
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) { imgRes = r; break; }
      } catch (_) {}
    }
    if (!imgRes) continue;

    const pngBlob = await imgRes.blob();
    const bmp = await bitmapFromBlob(pngBlob);

    const thumbW = 150, thumbH = Math.round(thumbW * 9 / 16);
    const c = document.createElement('canvas'); c.width = thumbW; c.height = thumbH;
    const g = c.getContext('2d');
    g.fillStyle = '#d1d5db'; g.fillRect(0, 0, thumbW, thumbH);
    g.drawImage(bmp, 0, 0, thumbW, thumbH);
    const thumbDataUrl = c.toDataURL('image/png');

    const id = `frames/${file}`;
    await dbPut({ id, name, pngBlob, thumbDataUrl });
  }

  await loadFramesListToSidebar();
  return true;
}

async function loadFramesFromManifest() {
  let list = await tryFetchManifestJSON();
  if (!list) list = await tryLoadManifestJS();
  if (!list) return false;
  return await populateFramesFromList(list);
}

// Sivupalkin lista
async function loadFramesListToSidebar() {
  els.framesList.innerHTML = '';
  const list = await dbGetAll();

  if (!list.length) {
    // Ei kehyksiÃ¤ tallessa
    showWarn('Kehysten haku ei onnistunut');
    return;
  }

  clearWarn();
  list.forEach((rec, idx) => {
    const card = frameItemCard(rec);
    els.framesList.appendChild(card);
    if (idx === 0 && !currentFrameId) {
      card.classList.add('active');
      currentFrameId = rec.id;
      ensureFrameBitmapsLoaded(rec.id).then(drawPreview);
    }
  });
}

// ===== UI toiminnot =====
if (els.refreshFramesBtn) {
  els.refreshFramesBtn.addEventListener('click', async () => {
    showWarn('Haetaan kehyksiÃ¤â€¦');
    const ok = await loadFramesFromManifest();
    if (!ok) {
      showWarn('Kehysten haku ei onnistunut');
    } else {
      await loadFramesListToSidebar();
      drawPreview();
    }
  });
}
if (els.clearFramesBtn) {
  els.clearFramesBtn.addEventListener('click', async () => {
    frameCache.clear();
    currentFrameId = null;
    await dbClear();
    els.framesList.innerHTML = '';
    showWarn('Kehysten haku ei onnistunut');
    drawPreview();
  });
}
if (els.noFrameBtn) {
  els.noFrameBtn.addEventListener('click', () => {
    currentFrameId = null;
    document.querySelectorAll('.frame-item').forEach(n => n.classList.remove('active'));
    drawPreview();
  });
}

// ===== Kuvan valinta & DnD =====
els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await loadUserImage(file);
});

const dropZone = els.canvas.parentElement;
['dragenter', 'dragover'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('drag'); }, false)
);
['dragleave', 'drop'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('drag'); }, false)
);
dropZone.addEventListener('drop', async (e) => {
  const file = Array.from(e.dataTransfer.files || []).find(f => /image\/(png|jpe?g)/i.test(f.type));
  if (file) await loadUserImage(file);
});

async function loadUserImage(file) {
  clearWarn();
  const bmpFull = await createImageBitmap(file);
  if (bmpFull.width !== W || bmpFull.height !== H) {
    // Info: kuva skaalataan vientiin 1920Ã—1080 (ei varoitus, vain informaatio -> jÃ¤tetÃ¤Ã¤n warn piiloon)
  }
  baseImageFull = bmpFull;
  baseImagePrev = await scaleBitmap(bmpFull, PREV_W, PREV_H);
  els.hint.style.display = 'none';
  drawPreview();
}

// Drag kanvaksella
let dragging = false;
let lastX = 0, lastY = 0;

els.canvas.addEventListener('pointerdown', (e) => {
  if (!baseImagePrev) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  els.canvas.setPointerCapture(e.pointerId);
});
els.canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dxp = e.clientX - lastX, dyp = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  edit.offsetX += Math.round(dxp * (W / PREV_W));
  edit.offsetY += Math.round(dyp * (H / PREV_H));
  drawPreview();
});
['pointerup', 'pointercancel'].forEach(type => {
  els.canvas.addEventListener(type, (e) => {
    dragging = false;
    try { els.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });
});

// Kontrollit
function syncControlsUI() {
  els.brightness.value = String(edit.brightness);
  els.contrast.value = String(edit.contrast);
  els.saturate.value = String(edit.saturate);
  els.hue.value = String(edit.hue);
  els.grayscale.checked = !!edit.grayscale;

  els.blur.value = String(edit.blur);
  els.scale.value = String(edit.scale);
  els.scaleX.value = String(edit.scaleX);
  els.scaleY.value = String(edit.scaleY);
  els.vignette.value = String(edit.vignette);
  els.vignetteShape.value = edit.vignetteShape;
  els.grain.value = String(edit.grain);
  [
    els.brightness,
    els.contrast,
    els.saturate,
    els.hue,
    els.blur,
    els.scale,
    els.scaleX,
    els.scaleY,
    els.vignette,
    els.grain
  ].forEach(updateRangeFill);

  els.brightnessVal.textContent = `${edit.brightness}%`;
  els.contrastVal.textContent = `${edit.contrast}%`;
  els.saturateVal.textContent = `${edit.saturate}%`;
  els.hueVal.textContent = `${edit.hue}°`;
  els.blurVal.textContent = `${edit.blur} px`;
  els.scaleVal.textContent = `${edit.scale}%`;
  els.scaleXVal.textContent = `${edit.scaleX}%`;
  els.scaleYVal.textContent = `${edit.scaleY}%`;
  els.vignetteVal.textContent = `${edit.vignette}%`;
  els.grainVal.textContent = `${edit.grain}%`;
}

function resetAllEdits() {
  Object.assign(edit, {
    flipX: false, brightness: 100, contrast: 100, saturate: 100, hue: 0,
    grayscale: false, blur: 0, scale: 100, scaleX: 100, scaleY: 100,
    vignette: 0, vignetteShape: 'round', grain: 0, offsetX: 0, offsetY: 0
  });
  syncControlsUI(); drawPreview();
}

if (els.flipXBtn) els.flipXBtn.addEventListener('click', () => { edit.flipX = !edit.flipX; drawPreview(); });
if (els.resetBtn) els.resetBtn.addEventListener('click', resetAllEdits);

if (els.brightness) els.brightness.addEventListener('input', () => { edit.brightness = +els.brightness.value; els.brightnessVal.textContent = `${edit.brightness}%`; updateRangeFill(els.brightness); drawPreview(); });
if (els.contrast)  els.contrast .addEventListener('input', () => { edit.contrast   = +els.contrast.value;   els.contrastVal.textContent = `${edit.contrast}%`;   updateRangeFill(els.contrast);   drawPreview(); });
if (els.saturate)  els.saturate .addEventListener('input', () => { edit.saturate   = +els.saturate.value;   els.saturateVal.textContent = `${edit.saturate}%`;   updateRangeFill(els.saturate);   drawPreview(); });
if (els.hue) {
  els.hue.addEventListener('input', () => {
    edit.hue = +els.hue.value;
    els.hueVal.textContent = `${edit.hue}°`;
    updateRangeFill(els.hue);
    drawPreview();
  });
}
if (els.grayscale) els.grayscale.addEventListener('change',()=> { edit.grayscale   =  els.grayscale.checked;                                   drawPreview(); });

if (els.blur)   els.blur  .addEventListener('input', () => { edit.blur  = +els.blur.value;  els.blurVal.textContent  = `${edit.blur} px`;  updateRangeFill(els.blur);  drawPreview(); });
if (els.scale)  els.scale .addEventListener('input', () => { edit.scale = +els.scale.value; els.scaleVal.textContent = `${edit.scale}%`;  updateRangeFill(els.scale);  drawPreview(); });
if (els.scaleX) els.scaleX.addEventListener('input', () => { edit.scaleX= +els.scaleX.value;els.scaleXVal.textContent= `${edit.scaleX}%`; updateRangeFill(els.scaleX); drawPreview(); });
if (els.scaleY) els.scaleY.addEventListener('input', () => { edit.scaleY= +els.scaleY.value;els.scaleYVal.textContent= `${edit.scaleY}%`; updateRangeFill(els.scaleY); drawPreview(); });

if (els.vignette)      els.vignette     .addEventListener('input', () => { edit.vignette      = +els.vignette.value;      els.vignetteVal.textContent = `${edit.vignette}%`; updateRangeFill(els.vignette); drawPreview(); });
if (els.vignetteShape) els.vignetteShape.addEventListener('change',() => { edit.vignetteShape =  els.vignetteShape.value;                            drawPreview(); });
if (els.grain)         els.grain        .addEventListener('input', () => { edit.grain         = +els.grain.value;         els.grainVal.textContent    = `${edit.grain}%`;    updateRangeFill(els.grain);    drawPreview(); });

// (Mahd. nuolipainikkeet jos ovat HTML:ssÃ¤)
function nudge(dx, dy, step = 10) { edit.offsetX += dx * step; edit.offsetY += dy * step; drawPreview(); }
if (els.moveLeft)  els.moveLeft .addEventListener('click', (e)=> nudge(-1, 0, e.altKey ? 1 : 10));
if (els.moveRight) els.moveRight.addEventListener('click', (e)=> nudge( 1, 0, e.altKey ? 1 : 10));
if (els.moveUp)    els.moveUp   .addEventListener('click', (e)=> nudge( 0,-1, e.altKey ? 1 : 10));
if (els.moveDown)  els.moveDown .addEventListener('click', (e)=> nudge( 0, 1, e.altKey ? 1 : 10));
if (els.zeroOffset)els.zeroOffset.addEventListener('click', ()=> { edit.offsetX = 0; edit.offsetY = 0; drawPreview(); });

window.addEventListener('keydown', (e) => {
  if (!baseImagePrev) return;
  const step = e.altKey ? 1 : 10;
  let handled = true;
  if (e.key === 'ArrowLeft') nudge(-1, 0, step);
  else if (e.key === 'ArrowRight') nudge(1, 0, step);
  else if (e.key === 'ArrowUp') nudge(0, -1, step);
  else if (e.key === 'ArrowDown') nudge(0, 1, step);
  else handled = false;
  if (handled) e.preventDefault();
});

// Kuva I/O
els.clearBtn.addEventListener('click', () => {
  baseImagePrev = null;
  baseImageFull = null;
  els.fileInput.value = '';
  els.hint.style.display = '';
  resetAllEdits();
  drawPreview();
});

function downloadComposite() {
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d', { alpha: true });

  if (baseImageFull) {
    drawBaseImageTo(g, baseImageFull, W, H, edit.offsetX, edit.offsetY, edit.flipX, buildFilter(), edit.scale, edit.scaleX, edit.scaleY);
    drawVignette(g, W, H, edit.vignette, edit.vignetteShape);
    drawGrain(g, W, H, edit.grain);
  }
  if (currentFrameId && frameCache.has(currentFrameId)) {
    const { fullBmp } = frameCache.get(currentFrameId);
    g.drawImage(fullBmp, 0, 0, W, H);
  }

  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.download = 'kehysgen_kuva.png';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png', 1.0);
}
els.downloadBtn.addEventListener('click', downloadComposite);

function downloadBaseOnly() {
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d', { alpha: true });

  if (baseImageFull) {
    drawBaseImageTo(g, baseImageFull, W, H, edit.offsetX, edit.offsetY, edit.flipX, buildFilter(), edit.scale, edit.scaleX, edit.scaleY);
    drawVignette(g, W, H, edit.vignette, edit.vignetteShape);
    drawGrain(g, W, H, edit.grain);
  }

  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.download = 'kehysgen_ilman_kehysta.png';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png', 1.0);
}
els.downloadBaseBtn.addEventListener('click', downloadBaseOnly);

// ===== Start =====
renderPresets();
syncControlsUI();

(async () => {
  showWarn('Haetaan kehyksiÃ¤â€¦');
  const ok = await loadFramesFromManifest();
  if (!ok) {
    showWarn('Kehysten haku ei onnistunut');
  } else {
    await loadFramesListToSidebar();
  }
  drawPreview();
})();
