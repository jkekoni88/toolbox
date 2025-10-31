// PoliisiGen – keskialueen MAKSIMI 1375 px (FULL). Preview skaalattu täsmälleen samasta geometriasta.
// Tekstipalkkien (kehysten) haku: /poliisiframes/manifest.json (tai poliisiframes/manifest.json).
// Yhä mahdollista lisätä paikallisia PNG:itä “Päivitä tekstipalkit” -napilla.

const W = 1920, H = 1080;
const PREV_W = 960, PREV_H = 540;

const MAX_CONTENT_W = 1375;
const STROKE_PX = 16;
const STROKE_COLOR = '#ffffff';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('pgCanvas'),
  downloadBtn: $('downloadBtn'),
  newImageBtn: $('newImageBtn'),

  cellsBar: $('cellsBar'),

  // selected cell controls
  cellFile: $('cellFile'),
  cellClear: $('cellClear'),
  cellCenter: $('cellCenter'),
  resetCell: $('resetCell'),

  cellScale: $('cellScale'),
  cellScaleVal: $('cellScaleVal'),
  cellBright: $('cellBright'),
  cellBrightVal: $('cellBrightVal'),
  cellContrast: $('cellContrast'),
  cellContrastVal: $('cellContrastVal'),

  // layout controls
  contentWidth: $('contentWidth'),
  contentWidthVal: $('contentWidthVal'),
  topPad: $('topPad'),
  topPadVal: $('topPadVal'),
  bottomPad: $('bottomPad'),
  bottomPadVal: $('bottomPadVal'),
  layoutBtns: () => Array.from(document.querySelectorAll('.layout-btn')),

  // frames (tekstipalkit)
  frameFile: $('frameFile'),
  noFrameBtn: $('noFrameBtn'),
  framesList: $('framesList'),
  framesHint: $('framesHint'),
};

const ctx = els.canvas.getContext('2d');

// -------- state --------
function defaultCell(){
  // (poistettu blur & gray)
  return { img:null, iw:0, ih:0, scale:100, offX:0, offY:0, bright:100, contrast:100 };
}
const state = {
  layout: 'center1',        // center1 | center2 | center3
  contentW: MAX_CONTENT_W,  // FULL px
  topPad: 50,               // FULL px
  bottomPad: -16,           // FULL px (negatiivinen piilottaa alareunan stroken)
  gap: 24,                  // sisäinen oletus

  selected: 0,
  cells: [defaultCell()],

  bgImg: null,

  // Tekstipalkit
  frames: [],            // { id, name, img, thumb }
  activeFrameIdx: -1,
};

// -------- helpers --------
function clamp(v,lo,hi){ return Math.min(hi, Math.max(lo, v)); }
function filterString(c){
  const b = clamp(c.bright ?? 100, 0, 200);
  const k = clamp(c.contrast ?? 100, 0, 200);
  return `brightness(${b}%) contrast(${k}%)`;
}

function ensureCellCount(){
  const need = state.layout==='center1' ? 1 : (state.layout==='center2' ? 2 : 3);
  const old = state.cells;
  const next = new Array(need).fill(0).map((_,i)=> old[i] ? { ...defaultCell(), ...old[i] } : defaultCell());
  state.cells = next;
  if (state.selected >= need) state.selected = need - 1;
  renderCellsBar();
  syncCellControls();
}

function renderCellsBar(){
  const n = state.cells.length;
  els.cellsBar.innerHTML = '';
  for (let i=0;i<n;i++){
    const b = document.createElement('button');
    b.className = 'cellchip' + (i===state.selected ? ' active' : '');
    b.type = 'button';
    b.textContent = `Solu ${i+1}`;
    b.addEventListener('click', ()=>{
      state.selected = i;
      renderCellsBar();
      syncCellControls();
      drawPreview();
    });
    els.cellsBar.appendChild(b);
  }
}

function syncLayoutButtons(){
  els.layoutBtns().forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  });
}

function syncLayoutControls(){
  state.contentW = clamp(state.contentW, 0, MAX_CONTENT_W);
  els.contentWidth.value = state.contentW;
  els.contentWidthVal.textContent = `${state.contentW} px`;

  els.topPad.value = state.topPad;
  els.topPadVal.textContent = `${state.topPad} px`;

  els.bottomPad.value = state.bottomPad;
  els.bottomPadVal.textContent = `${state.bottomPad} px`;
}

function syncCellControls(){
  const c = state.cells[state.selected] || defaultCell();
  els.cellScale.value = c.scale; els.cellScaleVal.textContent = `${c.scale}%`;
  els.cellBright.value = c.bright; els.cellBrightVal.textContent = `${c.bright}%`;
  els.cellContrast.value = c.contrast; els.cellContrastVal.textContent = `${c.contrast}%`;
}

// -------- geometry (FULL -> scaled) --------
function computeContentRect(outW, outH){
  const sx = outW / W;
  const sy = outH / H;

  const wFull = clamp(state.contentW, 0, MAX_CONTENT_W);
  const w = Math.round(wFull * sx);

  const yTop = Math.round(clamp(state.topPad, -400, 400) * sy);
  const yBottomPad = Math.round(clamp(state.bottomPad, -400, 400) * sy);

  const x = Math.round((outW - w)/2);
  // korkeus: koko alue miinus yläväli ja miinus alareunan väli (negatiivinen kasvattaa)
  const h = outH - yTop - yBottomPad;

  return { x, y: yTop, w, h };
}

function computeRects(outW, outH){
  const R = computeContentRect(outW, outH);
  const g = Math.round(state.gap * (outW / W));

  if (state.layout==='center1'){
    return [{ x:R.x, y:R.y, w:R.w, h:R.h }];
  }
  if (state.layout==='center2'){
    const w = Math.round((R.w - g)/2);
    return [
      { x:R.x, y:R.y, w, h:R.h },
      { x:R.x + w + g, y:R.y, w, h:R.h }
    ];
  }
  // center3
  const w = Math.round((R.w - 2*g)/3);
  return [
    { x:R.x, y:R.y, w, h:R.h },
    { x:R.x + w + g, y:R.y, w, h:R.h },
    { x:R.x + 2*(w+g), y:R.y, w, h:R.h },
  ];
}

// -------- draw helpers --------
function drawCellImage(g, cell, rp, rf, isPreview){
  const iw = cell.iw, ih = cell.ih;
  if (!iw || !ih || !cell.img) return;

  const cover = Math.max(rf.w/iw, rf.h/ih);
  const user = cell.scale/100;
  const dW = iw * cover * user;
  const dH = ih * cover * user;

  if (isPreview){
    const sx = PREV_W / W, sy = PREV_H / H;
    const cx = rp.x + rp.w/2 + (cell.offX * sx);
    const cy = rp.y + rp.h/2 + (cell.offY * sy);
    const drawW = dW * sx, drawH = dH * sy;

    g.save();
    g.filter = filterString(cell);
    g.drawImage(cell.img, cx - drawW/2, cy - drawH/2, drawW, drawH);
    g.restore();
  } else {
    const cx = rf.x + rf.w/2 + cell.offX;
    const cy = rf.y + rf.h/2 + cell.offY;

    g.save();
    g.filter = filterString(cell);
    g.drawImage(cell.img, cx - dW/2, cy - dH/2, dW, dH);
    g.restore();
  }
}

function drawStrokeRect(g, r, isPreview){
  g.save();
  g.strokeStyle = STROKE_COLOR;
  g.lineWidth = STROKE_PX * (isPreview ? (PREV_W/W) : 1);
  g.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  g.restore();
}

// -------- preview --------
function drawPreview(){
  ctx.clearRect(0,0,PREV_W,PREV_H);

  // tausta
  if (state.bgImg){
    const iw=state.bgImg.width, ih=state.bgImg.height;
    const cover = Math.max(PREV_W/iw, PREV_H/ih);
    const dw = iw * cover, dh = ih * cover;
    ctx.drawImage(state.bgImg, (PREV_W-dw)/2, (PREV_H-dh)/2, dw, dh);
  } else {
    ctx.fillStyle = '#0b3d91';
    ctx.fillRect(0,0,PREV_W,PREV_H);
  }

  const rectsPrev = computeRects(PREV_W, PREV_H);
  const rectsFull = computeRects(W, H);

  // solut
  for (let i=0;i<state.cells.length;i++){
    const cell = state.cells[i];
    const rp = rectsPrev[i];
    const rf = rectsFull[i];

    ctx.save();
    ctx.beginPath(); ctx.rect(rp.x, rp.y, rp.w, rp.h); ctx.clip();
    if (cell?.img) drawCellImage(ctx, cell, rp, rf, true);
    ctx.restore();

    drawStrokeRect(ctx, rp, true);
  }

  // tekstipalkki
  if (state.activeFrameIdx >= 0){
    const fr = state.frames[state.activeFrameIdx];
    if (fr?.img){
      ctx.drawImage(fr.img, 0, 0, PREV_W, PREV_H);
    }
  }

  // valitun solun korostus
  const rpSel = rectsPrev[state.selected];
  if (rpSel){
    ctx.save();
    ctx.strokeStyle = '#ffd400';
    ctx.setLineDash([8,6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(rpSel.x+1, rpSel.y+1, rpSel.w-2, rpSel.h-2);
    ctx.restore();
  }
}

// -------- export --------
function saveBlob(blob, filename){
  const a = document.createElement('a');
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function downloadCanvasPNG(canvas, filename){
  if (canvas.toBlob){
    canvas.toBlob((blob)=>{
      if (blob) return saveBlob(blob, filename);
      try{
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = filename; a.href = url; a.click();
      }catch(err){ console.error('Tallennus epäonnistui:', err); }
    }, 'image/png', 1.0);
  } else {
    try{
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = filename; a.href = url; a.click();
    }catch(err){ console.error('Tallennus epäonnistui:', err); }
  }
}

function exportPNG(){
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');

  // tausta
  if (state.bgImg){
    const iw=state.bgImg.width, ih=state.bgImg.height;
    const cover = Math.max(W/iw, H/ih);
    const dw = iw * cover, dh = ih * cover;
    g.drawImage(state.bgImg, (W-dw)/2, (H-dh)/2, dw, dh);
  } else {
    g.fillStyle = '#0b3d91';
    g.fillRect(0,0,W,H);
  }

  const rects = computeRects(W,H);

  // solut
  for (let i=0;i<state.cells.length;i++){
    const r = rects[i];
    const c = state.cells[i];
    g.save();
    g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    if (c?.img) drawCellImage(g, c, r /*unused*/, r, false);
    g.restore();

    drawStrokeRect(g, r, false);
  }

  // tekstipalkki
  if (state.activeFrameIdx >= 0){
    const fr = state.frames[state.activeFrameIdx];
    if (fr?.img) g.drawImage(fr.img, 0, 0, W, H);
  }

  downloadCanvasPNG(out, 'poliisigen_kuva.png');
}

// -------- interactions --------
let draggingImg = false, lastX=0, lastY=0;

els.canvas.addEventListener('pointerdown', (e)=>{
  const rect = els.canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const rectsPrev = computeRects(PREV_W, PREV_H);
  let hit = -1;
  rectsPrev.forEach((r,i)=>{ if(px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h) hit=i; });
  if (hit>=0) state.selected = hit;
  renderCellsBar();
  syncCellControls();
  drawPreview();

  if (state.cells[state.selected]?.img){
    draggingImg = true; lastX=e.clientX; lastY=e.clientY;
    els.canvas.setPointerCapture(e.pointerId);
  }
});

els.canvas.addEventListener('pointermove', (e)=>{
  if (!draggingImg) return;
  const dxp = e.clientX - lastX, dyp = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  const c = state.cells[state.selected]; if(!c) return;
  c.offX += Math.round(dxp * (W/PREV_W));
  c.offY += Math.round(dyp * (H/PREV_H));
  drawPreview();
});

['pointerup','pointercancel'].forEach(t=>{
  els.canvas.addEventListener(t, (e)=>{
    draggingImg = false;
    try{ els.canvas.releasePointerCapture(e.pointerId);}catch{}
  });
});

// DnD kuvat suoraan canvakselle
;['dragenter','dragover','dragleave','drop'].forEach(t=>{
  els.canvas.addEventListener(t, e=>e.preventDefault(), false);
});
els.canvas.addEventListener('drop', async (e)=>{
  const file = Array.from(e.dataTransfer.files||[]).find(f=>/image\/(png|jpe?g)/i.test(f.type));
  if (!file) return;
  const rect = els.canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const rectsPrev = computeRects(PREV_W, PREV_H);
  let hit = -1;
  rectsPrev.forEach((r,i)=>{ if(px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h) hit=i; });
  const idx = hit>=0 ? hit : state.selected;
  await loadFileToCell(file, idx);
  state.selected = idx;
  renderCellsBar(); syncCellControls(); drawPreview();
});

// --- selected cell controls
els.cellFile.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  await loadFileToCell(file, state.selected);
  els.cellFile.value = '';
  syncCellControls(); drawPreview();
});
els.cellClear.addEventListener('click', ()=>{
  const i = state.selected;
  state.cells[i] = defaultCell();
  els.cellFile.value='';
  syncCellControls(); drawPreview();
});
els.cellCenter.addEventListener('click', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.offX = 0; c.offY = 0; drawPreview();
});
els.resetCell.addEventListener('click', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  const keep = { img:c.img, iw:c.iw, ih:c.ih };
  Object.assign(c, defaultCell(), keep);
  syncCellControls(); drawPreview();
});

els.cellScale.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.scale = +els.cellScale.value; els.cellScaleVal.textContent = `${c.scale}%`; drawPreview();
});
els.cellBright.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.bright = +els.cellBright.value; els.cellBrightVal.textContent = `${c.bright}%`; drawPreview();
});
els.cellContrast.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.contrast = +els.cellContrast.value; els.cellContrastVal.textContent = `${c.contrast}%`; drawPreview();
});

// --- layout
els.layoutBtns().forEach(b=>{
  b.addEventListener('click', ()=>{
    state.layout = b.dataset.layout;
    syncLayoutButtons();
    ensureCellCount();
    drawPreview();
  });
});

// --- settings
els.contentWidth.addEventListener('input', ()=>{
  state.contentW = clamp(+els.contentWidth.value, 0, MAX_CONTENT_W);
  els.contentWidthVal.textContent = `${state.contentW} px`;
  drawPreview();
});
els.topPad.addEventListener('input', ()=>{
  state.topPad = +els.topPad.value;
  els.topPadVal.textContent = `${state.topPad} px`;
  drawPreview();
});
els.bottomPad.addEventListener('input', ()=>{
  state.bottomPad = +els.bottomPad.value;
  els.bottomPadVal.textContent = `${state.bottomPad} px`;
  drawPreview();
});

// --- frames (tekstipalkit) – MANIFEST + paikallinen lisäys
function renderFramesList(){
  els.framesList.innerHTML = '';
  if (!state.frames.length){
    els.framesHint.style.display = '';
    return;
  }
  els.framesHint.style.display = 'none';
  state.frames.forEach((f, idx)=>{
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'frame-item' + (idx===state.activeFrameIdx ? ' active':'');
    const img = new Image();
    img.className = 'frame-thumb';
    img.src = f.thumb;
    const name = document.createElement('div');
    name.className = 'frame-name';
    name.textContent = f.name || `Palkki ${idx+1}`;
    item.appendChild(img); item.appendChild(name);
    item.addEventListener('click', ()=>{
      state.activeFrameIdx = idx;
      renderFramesList();
      drawPreview();
    });
    els.framesList.appendChild(item);
  });
}

async function fileToBitmap(file){
  return await createImageBitmap(file);
}
function makeThumb(imgBmp){
  const TW = 200, TH = 112;
  const c = document.createElement('canvas'); c.width=TW; c.height=TH;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1220'; g.fillRect(0,0,TW,TH);
  g.drawImage(imgBmp, 0,0,TW,TH);
  return c.toDataURL('image/png');
}

els.frameFile.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files || []).filter(f=>/image\/png/i.test(f.type));
  if (!files.length) return;
  for (const f of files){
    try{
      const bmp = await fileToBitmap(f);
      const thumb = makeThumb(bmp);
      state.frames.push({ id:f.name, img:bmp, name:f.name.replace(/\.png$/i,''), thumb });
    }catch(_){}
  }
  els.frameFile.value = '';
  if (state.activeFrameIdx < 0 && state.frames.length) state.activeFrameIdx = 0;
  renderFramesList();
  drawPreview();
});
els.noFrameBtn.addEventListener('click', ()=>{
  state.activeFrameIdx = -1;
  renderFramesList(); drawPreview();
});

// --- manifest-lataus ---
async function tryFetchManifestJSON(){
  const candidates = ['/poliisiframes/manifest.json', 'poliisiframes/manifest.json'];
  for (const url of candidates){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }catch(_){}
  }
  return null;
}
async function populateFramesFromList(entries){
  state.frames = [];
  for (const entry of entries){
    const file = entry?.file;
    if (!file || !/\.png$/i.test(file)) continue;

    const name = entry?.name || entry?.id || file.replace(/\.png$/i,'');
    const urls = [`/poliisiframes/${file}`, `poliisiframes/${file}`];

    let imgRes = null;
    for (const u of urls){
      try{
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok){ imgRes = r; break; }
      }catch(_){}
    }
    if (!imgRes) continue;

    const blob = await imgRes.blob();
    const bmp = await createImageBitmap(blob);
    const thumb = makeThumb(bmp);
    state.frames.push({ id: entry.id || file, name, img:bmp, thumb });
  }
  if (state.frames.length && state.activeFrameIdx < 0) state.activeFrameIdx = 0;
  renderFramesList();
  drawPreview();
}
async function loadFramesFromManifest(){
  if (!els.framesHint) return;
  els.framesHint.style.display = '';
  els.framesHint.textContent = 'Haetaan tekstipalkkeja…';

  const list = await tryFetchManifestJSON();
  if (!list){
    els.framesHint.style.display = '';
    els.framesHint.textContent = 'Tekstipalkkien haku ei onnistunut.';
    return false;
  }
  await populateFramesFromList(list);
  if (!state.frames.length){
    els.framesHint.style.display = '';
    els.framesHint.textContent = 'Tekstipalkkien haku ei onnistunut.';
    return false;
  }
  els.framesHint.style.display = 'none';
  return true;
}

// --- new / download
els.newImageBtn.addEventListener('click', ()=>{
  state.cells = state.cells.map(()=>defaultCell());
  state.selected = 0;
  renderCellsBar(); syncCellControls(); drawPreview();
});
els.downloadBtn.addEventListener('click', exportPNG);

// --- load bg
(function loadBackground(){
  const img = new Image();
  img.crossOrigin = 'anonymous'; // varmuuden vuoksi
  img.onload = ()=>{ state.bgImg = img; drawPreview(); };
  img.onerror = ()=>{ state.bgImg = null; drawPreview(); };
  img.src = 'img/poliisigen_tausta.jpg';
})();

// --- load to cell
async function loadFileToCell(file, index){
  try{
    const bmp = await createImageBitmap(file);
    state.cells[index] = { ...defaultCell(), img:bmp, iw:bmp.width, ih:bmp.height };
  }catch(err){ console.error('Kuvan lataus epäonnistui:', err); }
}

// --- start
async function start(){
  ensureCellCount();
  syncLayoutButtons();
  syncLayoutControls();
  renderFramesList();
  renderCellsBar();
  syncCellControls();
  drawPreview();

  // yritä hakea manifest
  await loadFramesFromManifest();
}
start();
