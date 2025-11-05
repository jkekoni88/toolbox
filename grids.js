// GridGen – per-solu: skaala + kirkkaus + kontrasti
// Layoutit: rect2v, rect2h, rect2x2, rect3, curve-left/right, chevron-left/right,
// diamond-5, circle-spot, slanted-left/right
// Vienti PNG 1920×1080.

const W = 1920, H = 1080;
const PREV_W = 960, PREV_H = 540;

const DIVIDER_PX = 16;
const DIVIDER_COLOR = '#ffffff';
const CURVE_EXTRA = 2; // vain curve/chevronille

const $ = (id) => document.getElementById(id);

// --- elementit (varmistaen, ettei puuttuvat riko koodia)
const els = {
  canvas: $('gridCanvas'),
  download: $('download'),

  layoutGallery: $('layoutGallery'),

  // Divider controls
  ctrlSplitVert: $('ctrlSplitVert'),
  splitVertPos: $('splitVertPos'),
  splitVertVal: $('splitVertVal'),

  ctrlSplitHoriz: $('ctrlSplitHoriz'),
  splitHorizPos: $('splitHorizPos'),
  splitHorizVal: $('splitHorizVal'),

  ctrlGrid2x2X: $('ctrlGrid2x2X'),
  grid2x2X: $('grid2x2X'),
  grid2x2XVal: $('grid2x2XVal'),

  ctrlGrid2x2Y: $('ctrlGrid2x2Y'),
  grid2x2Y: $('grid2x2Y'),
  grid2x2YVal: $('grid2x2YVal'),

  ctrlCurve: $('ctrlCurve'),
  curvePos: $('curvePos'),
  curvePosVal: $('curvePosVal'),

  ctrlDiamondWidth: $('ctrlDiamondWidth'),
  diamondWidth: $('diamondWidth'),
  diamondWidthVal: $('diamondWidthVal'),

  // Circle controls (tuki molemmille nimille)
  ctrlCircleX: $('ctrlCircleX'),
  circleX: $('circleX'),
  circleXVal: $('circleXVal'),
  ctrlCircleSize: $('ctrlCircleSize') || $('ctrlCircleScale'),
  circleSize: $('circleSize') || $('circleScale'),
  circleSizeVal: $('circleSizeVal') || $('circleScaleVal'),

  // Slanted (jos lisätty HTML:ään)
  ctrlSlanted: $('ctrlSlanted'),
  slantedAngle: $('slantedAngle'),
  slantedAngleVal: $('slantedAngleVal'),

  // Cells UI
  cellsBar: $('cellsBar'),
  newImageBtn: $('newImageBtn'),

  // Valittu solu -paneeli
  cellFile: $('cellFile'),
  cellClear: $('cellClear'),
  cellScale: $('cellScale'),
  cellScaleVal: $('cellScaleVal'),

  cellBright: $('cellBright'),
  cellBrightVal: $('cellBrightVal'),
  cellContrast: $('cellContrast'),
  cellContrastVal: $('cellContrastVal'),
  cellBlur: $('cellBlur'),
  cellBlurVal: $('cellBlurVal'),
  cellGray: $('cellGray'),

  cellCenter: $('cellCenter'),
  resetCell: $('resetCell'),
};

const ctx = els.canvas.getContext('2d');

// --- layoutit
const LAYOUTS = [
  { id:'split-vert-2',  name:'2 saraketta (suora)', type:'rect2v' },
  { id:'split-horiz-2', name:'2 riviä (suora)',     type:'rect2h' },
  { id:'grid-2x2',      name:'2 × 2',               type:'rect2x2' },
  { id:'cols-3',        name:'3 saraketta',         type:'rect3'   },
  { id:'stack-left',    name:'Vasen 2 + oikea',     type:'stack-left' },
  { id:'stack-right',   name:'Oikea 2 + vasen',     type:'stack-right' },

  { id:'curve-left',    name:'Kaari (vasen)',       type:'curve-left'  },
  { id:'curve-right',   name:'Kaari (oikea)',       type:'curve-right' },
  { id:'chevron-left',  name:'Nuoli (vasen)',       type:'chevron-left' },
  { id:'chevron-right', name:'Nuoli (oikea)',       type:'chevron-right' },

  { id:'diamond-5',     name:'Timantti + 4',        type:'diamond-5' },

  { id:'circle-spot',   name:'Ympyrä + tausta',     type:'circle' },

  { id:'slanted-left',  name:'Vinopalkit (vasen)',  type:'slanted-left' },
  { id:'slanted-right', name:'Vinopalkit (oikea)',  type:'slanted-right' },
];

const state = {
  layoutId: 'split-vert-2',
  selected: 0,   // sisäinen solun indeksi
  cells: [],

  // suorat
  splitVertPct: 0,
  splitHorizPct: 0,
  grid2x2: { x:0, y:0 },
  grid3: { a: 33, b: 66 },

  // kaaret/nuolet
  curvePosPct: 0,

  // timantti
  diamondWidthPct: 22, // slider min/max 12..35

  // ympyrä
  circle: {
    xPct: 0,
    sizePct: 70
  },

  // vinopalkit
  slantedAngleDeg: 3 // oletus muutama aste pystyyn nähden
};

// --- utilit ---
function getLayoutDef(id){ return LAYOUTS.find(l=>l.id===id); }
function type(){ return getLayoutDef(state.layoutId).type; }
function isCurve(){ const t=type(); return t==='curve-left'||t==='curve-right'; }
function isChevron(){ const t=type(); return t==='chevron-left'||t==='chevron-right'; }
function isShapedSplit2(){ return isCurve() || isChevron(); }
function isDiamond5(){ return type()==='diamond-5'; }
function isCircle(){ return type()==='circle'; }
function isSlanted(){ const t=type(); return t==='slanted-left'||t==='slanted-right'; }

function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
function clampRange(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
function updateRangeFill(el){
  if (!el) return;
  const min = Number(el.min ?? 0);
  const max = Number(el.max ?? 100);
  const value = Number(el.value ?? min);
  const pct = max === min ? 0 : clampRange(((value - min) / (max - min)) * 100, 0, 100);
  el.style.setProperty('--gg-range-value', `${pct}%`);
}

// solun oletus
function defaultCell(){
  return { img:null, iw:0, ih:0, scale:100, offX:0, offY:0, bright:100, contrast:100, gray:false, blur:0 };
}

// HUOM: Circle-layoutissa cells[0] = Ympyrä, cells[1] = Tausta (sisäinen toteutus)
function initCellsForLayout(){
  const t = type();
  let count;
  if (t==='rect2v' || t==='rect2h' || isShapedSplit2() || isSlanted()){
    count = 2;
  } else if (t==='rect2x2'){
    count = 4;
  } else if (t==='rect3' || t==='stack-left' || t==='stack-right'){
    count = 3;
  } else if (isDiamond5()){
    count = 5;
  } else if (isCircle()){
    count = 2;
  } else {
    count = 2;
  }
  const old = state.cells;
  state.cells = new Array(count).fill(0).map((_,i)=> old[i] ? { ...defaultCell(), ...old[i] } : defaultCell());

  if (isCircle()){
    if (!state.cells[0]) state.cells[0] = defaultCell(); // ympyrä
    if (!state.cells[1]) state.cells[1] = defaultCell(); // tausta
    if (state.selected > 1) state.selected = 0;
  }

  if (state.selected >= count) state.selected = count - 1;
  if (state.selected < 0) state.selected = 0;
  renderCellsBar();
  syncCellControls();
}

// --- geometria ---
function midXFromPct(outW, pct){
  const mid = outW/2 + (pct/100)*outW;
  const margin = Math.max(DIVIDER_PX*2, outW*0.05);
  return Math.min(outW - margin, Math.max(margin, mid));
}
function midYFromPct(outH, pct){
  const mid = outH/2 + (pct/100)*outH;
  const margin = Math.max(DIVIDER_PX*2, outH*0.05);
  return Math.min(outH - margin, Math.max(margin, mid));
}
function posFromPct(outW, pct){
  const margin = Math.max(DIVIDER_PX*2, outW*0.05);
  const x = (pct/100)*outW;
  return Math.min(outW - margin, Math.max(margin, x));
}

function curveMidX(outW){ return midXFromPct(outW, state.curvePosPct); }

function diamondMetrics(outW, outH){
  const cx = Math.round(outW/2), cy = Math.round(outH/2);
  const rx = Math.round(outW * (state.diamondWidthPct / 100));
  const top = [cx, 0], right = [cx + rx, cy], bottom = [cx, outH], left = [cx - rx, cy];
  const bbox = { x: cx - rx, y: 0, w: rx*2, h: outH };
  return { cx, cy, rx, top, right, bottom, left, bbox };
}

function circleGeom(outW, outH){
  const cx = Math.round(outW/2 + (state.circle.xPct/100)*outW);
  const cy = Math.round(outH/2);
  const radius = Math.max(1, Math.round((state.circle.sizePct/100) * (outH/2)));
  return { cx, cy, r: radius };
}

// Slanted: kulma asteina suhteessa PYSTYyn (0 = suora pystyviiva ylhäältä alas)
function slantedLineEnds(outW, outH, angleDeg){
  const k = Math.tan(angleDeg * Math.PI/180); // x = cx + k*(y - cy)
  const cx = outW/2, cy = outH/2;
  const xtop = cx + k*(0 - cy);
  const xbot = cx + k*(outH - cy);
  return { xtop, xbot };
}

// --- rectien laskenta (export-skaalaukselle)
function computeRects(outW, outH){
  const g = DIVIDER_PX;
  const t = type();

  if (t==='rect2v' || isSlanted()){ // slanted käyttää samaa “kaksi aluetta” -skaalausta
    const mid = (t==='rect2v') ? midXFromPct(outW, state.splitVertPct) : outW/2; // slanted aina keskellä
    const leftW = Math.round(mid - g/2);
    const rightW = outW - leftW - g;
    return [{x:0,y:0,w:leftW,h:outH},{x:leftW+g,y:0,w:rightW,h:outH}];
  }
  if (t==='stack-left' || t==='stack-right'){
    const mid = midXFromPct(outW, state.splitVertPct);
    const leftW = Math.round(mid - g/2);
    const rightW = outW - leftW - g;
    const midY = midYFromPct(outH, state.splitHorizPct);
    const topH = Math.round(midY - g/2);
    const botH = outH - topH - g;
    if (t==='stack-left'){
      return [
        {x:0, y:0, w:leftW, h:topH},
        {x:0, y:topH+g, w:leftW, h:botH},
        {x:leftW+g, y:0, w:rightW, h:outH}
      ];
    } else {
      const rightX = leftW + g;
      return [
        {x:0, y:0, w:leftW, h:outH},
        {x:rightX, y:0, w:rightW, h:topH},
        {x:rightX, y:topH+g, w:rightW, h:botH}
      ];
    }
  }
  if (t==='rect2h'){
    const mid = midYFromPct(outH, state.splitHorizPct);
    const topH = Math.round(mid - g/2);
    const botH = outH - topH - g;
    return [{x:0,y:0,w:outW,h:topH},{x:0,y:topH+g,w:outW,h:botH}];
  }
  if (t==='rect2x2'){
    const mx = midXFromPct(outW, state.grid2x2.x);
    const my = midYFromPct(outH, state.grid2x2.y);
    const leftW = Math.round(mx - g/2);
    const rightW = outW - leftW - g;
    const topH = Math.round(my - g/2);
    const botH = outH - topH - g;
    return [
      {x:0,y:0,w:leftW,h:topH},
      {x:leftW+g,y:0,w:rightW,h:topH},
      {x:0,y:topH+g,w:leftW,h:botH},
      {x:leftW+g,y:topH+g,w:rightW,h:botH}
    ];
  }
  if (t==='rect3'){
    let x1 = posFromPct(outW, state.grid3.a);
    let x2 = posFromPct(outW, state.grid3.b);
    const minGap = g + Math.max(40, outW*0.05);
    if (x2 - x1 < minGap) x2 = x1 + minGap;
    if (x2 > outW - Math.max(g, outW*0.05)) { x2 = outW - Math.max(g, outW*0.05); if (x2 - x1 < minGap) x1 = x2 - minGap; }

    const leftW = Math.round(x1 - g/2);
    const centerW = Math.round(x2 - x1 - g);
    const rightW = outW - (x2 + g/2);
    return [
      {x:0, y:0, w:leftW,  h:outH},
      {x:x1 + g/2, y:0, w:centerW, h:outH},
      {x:x2 + g/2, y:0, w:rightW,  h:outH}
    ];
  }
  if (isShapedSplit2()){
    const mid = outW/2; // pos% vain kaarille/nuolille poikittainen siirto
    const leftW = Math.floor(mid - g/2);
    const rightW = outW - leftW - g;
    return [{x:0,y:0,w:leftW,h:outH},{x:leftW+g,y:0,w:rightW,h:outH}];
  }
  if (isDiamond5()){
    const { cx, bbox } = diamondMetrics(outW, outH);
    const TL = { x:0,     y:0,      w:cx,       h:outH/2 };
    const TR = { x:cx,    y:0,      w:outW-cx,  h:outH/2 };
    const BR = { x:cx,    y:outH/2, w:outW-cx,  h:outH/2 };
    const BL = { x:0,     y:outH/2, w:cx,       h:outH/2 };
    const CENTER = { ...bbox };
    return [TL, TR, BR, BL, CENTER];
  }
  if (isCircle()){
    const bg = { x:0, y:0, w:outW, h:outH };
    const { cx, cy, r } = circleGeom(outW, outH);
    return [
      { x: cx - r, y: cy - r, w: r*2, h: r*2 }, // [0] = circle bbox (ympyrä)
      bg                                         // [1] = tausta
    ];
  }
  return [];
}

// --- Path-rakentajat ---
function buildCurvePaths(outW, outH){
  const side = type();
  const mid = outW/2 + (state.curvePosPct/100)*outW;
  const amp = Math.round(outW * 0.18);
  const ctrlX = side==='curve-right' ? mid + amp : mid - amp;
  const ctrlY = outH/2;

  const leftPath = new Path2D();
  leftPath.moveTo(0,0); leftPath.lineTo(mid,0);
  leftPath.quadraticCurveTo(ctrlX, ctrlY, mid, outH);
  leftPath.lineTo(0,outH); leftPath.closePath();

  const rightPath = new Path2D();
  rightPath.moveTo(mid,0); rightPath.lineTo(outW,0);
  rightPath.lineTo(outW,outH); rightPath.lineTo(mid,outH);
  rightPath.quadraticCurveTo(ctrlX, ctrlY, mid, 0);
  rightPath.closePath();

  const strokePath = new Path2D();
  strokePath.moveTo(mid,0); strokePath.quadraticCurveTo(ctrlX, ctrlY, mid, outH);

  return { leftPath, rightPath, strokePath };
}
function buildChevronPaths(outW, outH){
  const side = type();
  const mid = outW/2 + (state.curvePosPct/100)*outW;
  const amp = Math.round(outW * 0.18);
  const ctrlX = side==='chevron-right' ? mid + amp : mid - amp;
  const ctrlY = outH/2;

  const leftPath = new Path2D();
  leftPath.moveTo(0,0); leftPath.lineTo(mid,0); leftPath.lineTo(ctrlX, ctrlY);
  leftPath.lineTo(mid, outH); leftPath.lineTo(0, outH); leftPath.closePath();

  const rightPath = new Path2D();
  rightPath.moveTo(mid,0); rightPath.lineTo(outW,0); rightPath.lineTo(outW,outH);
  rightPath.lineTo(mid,outH); rightPath.lineTo(ctrlX, ctrlY); rightPath.closePath();

  const strokePath = new Path2D();
  strokePath.moveTo(mid,0); strokePath.lineTo(ctrlX, ctrlY); strokePath.lineTo(mid, outH);

  return { leftPath, rightPath, strokePath };
}
function buildDiamondPaths(outW, outH){
  const { cx, cy, rx, top, right, bottom, left } = diamondMetrics(outW, outH);

  const center = new Path2D();
  center.moveTo(...top); center.lineTo(...right); center.lineTo(...bottom); center.lineTo(...left); center.closePath();

  const strokePath = new Path2D();
  strokePath.moveTo(...top); strokePath.lineTo(...right); strokePath.lineTo(...bottom); strokePath.lineTo(...left); strokePath.closePath();

  const leftH = new Path2D();
  leftH.moveTo(0, cy); leftH.lineTo(left[0], left[1]);

  const rightH = new Path2D();
  rightH.moveTo(right[0], right[1]); rightH.lineTo(outW, cy);

  const TL = new Path2D();
  TL.moveTo(0,0); TL.lineTo(cx,0); TL.lineTo(...left); TL.lineTo(0,cy); TL.closePath();

  const TR = new Path2D();
  TR.moveTo(cx,0); TR.lineTo(outW,0); TR.lineTo(outW,cy); TR.lineTo(...right); TR.closePath();

  const BR = new Path2D();
  BR.moveTo(...right); BR.lineTo(outW,cy); BR.lineTo(outW,outH); BR.lineTo(cx,outH); BR.closePath();

  const BL = new Path2D();
  BL.moveTo(0,cy); BL.lineTo(...left); BL.lineTo(cx,outH); BL.lineTo(0,outH); BL.closePath();

  return { center, strokePath, leftH, rightH, corners:[TL, TR, BR, BL] };
}
function buildCirclePath(outW, outH){
  const { cx, cy, r } = circleGeom(outW, outH);
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return { path: p, cx, cy, r };
}
function buildSlantedPaths(outW, outH, angleDeg){
  const { xtop, xbot } = slantedLineEnds(outW, outH, angleDeg);

  const leftPath = new Path2D();
  leftPath.moveTo(0,0);
  leftPath.lineTo(Math.round(xtop), 0);
  leftPath.lineTo(Math.round(xbot), outH);
  leftPath.lineTo(0, outH);
  leftPath.closePath();

  const rightPath = new Path2D();
  rightPath.moveTo(Math.round(xtop), 0);
  rightPath.lineTo(outW, 0);
  rightPath.lineTo(outW, outH);
  rightPath.lineTo(Math.round(xbot), outH);
  rightPath.closePath();

  const strokePath = new Path2D();
  strokePath.moveTo(Math.round(xtop), 0);
  strokePath.lineTo(Math.round(xbot), outH);

  return { leftPath, rightPath, strokePath };
}

// --- layout-gallerian thumbit ---
function drawLayoutThumb(canvas, type){
  const c = canvas, g = c.getContext('2d');
  const TW = c.width, TH = c.height;
  g.fillStyle = '#c62026'; g.fillRect(0,0,TW,TH);

  const gutter = Math.max(2, Math.round(DIVIDER_PX * (TW / W)));
  g.fillStyle = '#ffffff';

  if (type==='rect2v'){ g.fillRect(Math.round(TW/2 - gutter/2), 0, gutter, TH); }
  else if (type==='rect2h'){ g.fillRect(0, Math.round(TH/2 - gutter/2), TW, gutter); }
  else if (type==='rect2x2'){
    const mx = Math.round(TW/2), my = Math.round(TH/2);
    g.fillRect(mx - gutter/2, 0, gutter, TH);
    g.fillRect(0, my - gutter/2, TW, gutter);
  } else if (type==='rect3'){
    const x1 = Math.round(TW*(33/100)), x2 = Math.round(TW*(66/100));
    g.fillRect(x1 - gutter/2, 0, gutter, TH);
    g.fillRect(x2 - gutter/2, 0, gutter, TH);
  } else if (type==='stack-left' || type==='stack-right'){
    const mid = Math.round(TW/2);
    g.fillRect(mid - gutter/2, 0, gutter, TH);
    const y = Math.round(TH/2);
    if (type==='stack-left'){
      const span = Math.max(0, mid - Math.round(gutter/2));
      g.fillRect(0, y - gutter/2, span, gutter);
    } else {
      const start = mid + Math.round(gutter/2);
      const span = Math.max(0, TW - start);
      g.fillRect(start, y - gutter/2, span, gutter);
    }
  } else if (type==='curve-left' || type==='curve-right'){
    const mid = Math.round(TW/2);
    const amp = Math.round(TW*0.18);
    const ctrlX = (type==='curve-right') ? mid + amp : mid - amp;
    const ctrlY = TH/2;
    g.strokeStyle = '#ffffff';
    g.lineWidth = gutter + Math.round(5 * (TW / W));
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(mid,0); g.quadraticCurveTo(ctrlX,ctrlY,mid,TH); g.stroke();
  } else if (type==='chevron-left' || type==='chevron-right'){
    const mid = Math.round(TW/2);
    const amp = Math.round(TW*0.18);
    const ctrlX = (type==='chevron-right') ? mid + amp : mid - amp;
    const ctrlY = TH/2;
    g.strokeStyle = '#ffffff';
    g.lineWidth = gutter;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(mid,0); g.lineTo(ctrlX, ctrlY); g.lineTo(mid, TH);
    g.stroke();
  } else if (type==='diamond-5'){
    const cx = Math.round(TW/2), cy = Math.round(TH/2);
    const rx = Math.round(TW * 0.22);
    const pts = [[cx,0],[cx+rx,cy],[cx,TH],[cx-rx,cy]];
    g.strokeStyle = '#ffffff';
    g.lineWidth = gutter;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i=1;i<4;i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.stroke();

    g.beginPath();
    g.moveTo(0, cy); g.lineTo(cx - rx, cy);
    g.moveTo(cx + rx, cy); g.lineTo(TW, cy);
    g.stroke();
  } else if (type==='circle'){
    const r = Math.round((0.70 * TH) / 2);
    const cx = Math.round(TW/2);
    const cy = Math.round(TH/2);
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
    g.lineWidth = Math.max(2, Math.round(DIVIDER_PX * (TW / W)));
    g.strokeStyle = '#ffffff'; g.stroke();
  } else if (type==='slanted-left' || type==='slanted-right'){
    const k = Math.tan((type==='slanted-right'? 6 : -6) * Math.PI/180);
    const cx = TW/2, cy = TH/2;
    const xtop = cx + k*(0 - cy);
    const xbot = cx + k*(TH - cy);
    g.strokeStyle = '#ffffff';
    g.lineWidth = gutter;
    g.beginPath(); g.moveTo(Math.round(xtop),0); g.lineTo(Math.round(xbot),TH); g.stroke();
  }
}
function renderLayoutGallery(){
  const container = els.layoutGallery;
  if (!container) return;
  container.innerHTML = '';
  LAYOUTS.forEach(l=>{
    const item = document.createElement('button');
    item.className = 'layout-item'; item.type = 'button'; item.dataset.layout = l.id;

    const cnv = document.createElement('canvas');
    cnv.width = 200; cnv.height = 100; cnv.className = 'layout-thumb';
    drawLayoutThumb(cnv, l.type);

    const name = document.createElement('div');
    name.className = 'layout-name'; name.textContent = l.name;

    item.appendChild(cnv); item.appendChild(name);
    item.addEventListener('click', ()=>{
      state.layoutId = l.id;

      // oletuskulma slantedille suuntaan sopivaksi
      if (l.type==='slanted-left') state.slantedAngleDeg = -3;
      if (l.type==='slanted-right') state.slantedAngleDeg = +3;

      document.querySelectorAll('.layout-item').forEach(n=>n.classList.remove('active'));
      item.classList.add('active');
      initCellsForLayout();
      updateControlsVisibility();
      drawPreview();
    });
    if (l.id === state.layoutId) item.classList.add('active');
    container.appendChild(item);
  });
}

// --- Soluchipit ---
function renderCellsBar(){
  const count = state.cells.length;
  const bar = els.cellsBar;
  if (!bar) return;
  bar.innerHTML = '';

  const selectedDisplayIndex = (function(){
    if (!isCircle()) return state.selected;
    return state.selected === 0 ? 1 : 0; // UI:ssa tausta on “Solu 1”
  })();

  for (let i = 0; i < count; i++){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cellchip' + (i === selectedDisplayIndex ? ' active' : '');

    let label;
    if (isCircle()){
      label = (i === 0) ? 'Tausta (Solu 1)' : 'Ympyrä (Solu 2)';
    } else {
      label = `Solu ${i+1}`;
    }
    b.textContent = label;

    b.addEventListener('click', ()=>{
      if (isCircle()){
        state.selected = (i === 0) ? 1 : 0; // 0:Tausta => cells[1], 1:Ympyrä => cells[0]
      } else {
        state.selected = i;
      }
      renderCellsBar();
      syncCellControls();
      drawPreview();
    });

    bar.appendChild(b);
  }
}

// --- piirtoapuja ---
function filterString(c){
  const b = clampRange(c.bright ?? 100, 0, 200);
  const k = clampRange(c.contrast ?? 100, 0, 200);
  const bl = clampRange(c.blur ?? 0, 0, 50);
  const gray = c.gray ? 100 : 0;
  return `brightness(${b}%) contrast(${k}%) grayscale(${gray}%) blur(${bl}px)`;
}
const SHADES = [
  '#c62026',
  '#c62026',
  '#c62026',
  '#c62026'
];
function drawCellImage(cell, rp, rf){
  const iw = cell.iw, ih = cell.ih;
  if (!iw || !ih || !cell.img) return;

  const cover = Math.max(rf.w / iw, rf.h / ih);
  const user = cell.scale / 100;
  const dWf = iw * cover * user;
  const dHf = ih * cover * user;

  const sX = PREV_W / W, sY = PREV_H / H;
  const cxp = rp.x + rp.w/2 + Math.round(cell.offX * sX);
  const cyp = rp.y + rp.h/2 + Math.round(cell.offY * sY);
  const dWp = dWf * sX, dHp = dHf * sY;

  ctx.save();
  ctx.filter = filterString(cell);
  ctx.drawImage(cell.img, cxp - dWp/2, cyp - dHp/2, dWp, dHp);
  ctx.restore();
}
function drawRectGutters(outW, outH){
  const t = type();
  const d = DIVIDER_PX;
  ctx.save();
  ctx.fillStyle = DIVIDER_COLOR;

  if (t==='rect2v' || isSlanted()){
    const mid = (t==='rect2v') ? midXFromPct(outW, state.splitVertPct) : outW/2;
    ctx.fillRect(Math.round(mid - d/2), 0, d, outH);
  } else if (t==='stack-left' || t==='stack-right'){
    const mid = midXFromPct(outW, state.splitVertPct);
    const leftW = Math.round(mid - d/2);
    const rightW = outW - leftW - d;
    ctx.fillRect(Math.round(mid - d/2), 0, d, outH);
    const midY = midYFromPct(outH, state.splitHorizPct);
    const y = Math.round(midY - d/2);
    if (t==='stack-left'){
      ctx.fillRect(0, y, leftW, d);
    } else {
      const rightX = leftW + d;
      ctx.fillRect(rightX, y, rightW, d);
    }
  } else if (t==='rect2h'){
    const mid = midYFromPct(outH, state.splitHorizPct);
    ctx.fillRect(0, Math.round(mid - d/2), outW, d);
  } else if (t==='rect2x2'){
    const mx = midXFromPct(outW, state.grid2x2.x);
    const my = midYFromPct(outH, state.grid2x2.y);
    ctx.fillRect(Math.round(mx - d/2), 0, d, outH);
    ctx.fillRect(0, Math.round(my - d/2), outW, d);
  } else if (t==='rect3'){
    let x1 = posFromPct(outW, state.grid3.a);
    let x2 = posFromPct(outW, state.grid3.b);
    if (x2 < x1) [x1,x2] = [x2,x1];
    ctx.fillRect(Math.round(x1 - d/2), 0, d, outH);
    ctx.fillRect(Math.round(x2 - d/2), 0, d, outH);
  }
  ctx.restore();
}

// --- PREVIEW ---
function drawPreview(){
  ctx.clearRect(0,0,PREV_W,PREV_H);

  const rectsPrev = computeRects(PREV_W, PREV_H);
  const rectsFull = computeRects(W, H);

  if (isCurve()){
    const { leftPath, rightPath, strokePath } = buildCurvePaths(PREV_W, PREV_H);
    const paths = [leftPath, rightPath];

    paths.forEach((p,i)=>{ ctx.save(); ctx.clip(p); ctx.fillStyle = SHADES[i%SHADES.length]; ctx.fillRect(0,0,PREV_W,PREV_H); ctx.restore(); });
    paths.forEach((p,i)=>{ const cell = state.cells[i]; if (!cell?.img) return; const rp = rectsPrev[i], rf = rectsFull[i]; ctx.save(); ctx.clip(p); drawCellImage(cell, rp, rf); ctx.restore(); });

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = (DIVIDER_PX + CURVE_EXTRA) * (PREV_W / W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(strokePath);
    ctx.restore();

  } else if (isChevron()){
    const { leftPath, rightPath, strokePath } = buildChevronPaths(PREV_W, PREV_H);
    const paths = [leftPath, rightPath];

    paths.forEach((p,i)=>{ ctx.save(); ctx.clip(p, 'nonzero'); ctx.fillStyle = SHADES[i%SHADES.length]; ctx.fillRect(0,0,PREV_W,PREV_H); ctx.restore(); });
    paths.forEach((p,i)=>{ const cell = state.cells[i]; if (!cell?.img) return; const rp = rectsPrev[i], rf = rectsFull[i]; ctx.save(); ctx.clip(p, 'nonzero'); drawCellImage(cell, rp, rf); ctx.restore(); });

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = DIVIDER_PX * (PREV_W / W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(strokePath);
    ctx.restore();

  } else if (isDiamond5()){
    const { center, strokePath, leftH, rightH, corners } = buildDiamondPaths(PREV_W, PREV_H);

    for (let i=0;i<4;i++){
      const rp = rectsPrev[i], rf = rectsFull[i];
      ctx.save();
      ctx.clip(corners[i], 'nonzero');
      ctx.fillStyle = SHADES[i%SHADES.length]; ctx.fillRect(0,0,PREV_W,PREV_H);
      const cell = state.cells[i];
      if (cell?.img) drawCellImage(cell, rp, rf);
      ctx.restore();
    }

    const rpC = rectsPrev[4], rfC = rectsFull[4];
    const cellC = state.cells[4];
    ctx.save(); ctx.clip(center, 'nonzero');
    ctx.fillStyle = SHADES[4 % SHADES.length]; ctx.fillRect(0,0,PREV_W,PREV_H);
    if (cellC?.img) drawCellImage(cellC, rpC, rfC);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = DIVIDER_PX * (PREV_W / W);
    ctx.lineJoin = 'round';
    ctx.stroke(strokePath);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = DIVIDER_PX * (PREV_W / W);
    ctx.lineCap = 'butt';
    ctx.stroke(leftH);
    ctx.stroke(rightH);
    ctx.restore();

  } else if (isCircle()){
    const bgCell = state.cells[1];
    const rpBg = rectsPrev[1], rfBg = rectsFull[1];
    if (bgCell?.img){ ctx.save(); drawCellImage(bgCell, rpBg, rfBg); ctx.restore(); }
    else { ctx.save(); ctx.fillStyle = SHADES[0]; ctx.fillRect(0,0,PREV_W,PREV_H); ctx.restore(); }

    const { path: circlePath, cx, cy, r } = buildCirclePath(PREV_W, PREV_H);
    const rpCircle = rectsPrev[0], rfCircle = rectsFull[0];
    const circleCell = state.cells[0];
    ctx.save(); ctx.clip(circlePath, 'nonzero');
    if (circleCell?.img){ drawCellImage(circleCell, rpCircle, rfCircle); }
    else { ctx.fillStyle = SHADES[2]; ctx.fillRect(0,0,PREV_W,PREV_H); }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = DIVIDER_PX * (PREV_W / W);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

  } else if (isSlanted()){
    const ang = clamp(state.slantedAngleDeg, -45, 45);
    const { leftPath, rightPath, strokePath } = buildSlantedPaths(PREV_W, PREV_H, ang);

    [leftPath, rightPath].forEach((p,i)=>{
      ctx.save(); ctx.clip(p, 'nonzero');
      ctx.fillStyle = SHADES[i%SHADES.length];
      ctx.fillRect(0,0,PREV_W,PREV_H);
      const cell = state.cells[i];
      if (cell?.img){
        const rp = rectsPrev[i], rf = rectsFull[i];
        drawCellImage(cell, rp, rf);
      }
      ctx.restore();
    });

    ctx.save();
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = DIVIDER_PX * (PREV_W / W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(strokePath);
    ctx.restore();

  } else {
    rectsPrev.forEach((rp,i)=>{
      const rf = rectsFull[i];
      const cell = state.cells[i];
      ctx.save();
      ctx.beginPath(); ctx.rect(rp.x,rp.y,rp.w,rp.h); ctx.clip();
      ctx.fillStyle = SHADES[i%SHADES.length]; ctx.fillRect(rp.x,rp.y,rp.w,rp.h);
      if (cell?.img) drawCellImage(cell, rp, rf);
      ctx.restore();
    });
    drawRectGutters(PREV_W, PREV_H);
  }

  // Valitun solun korostus
  ctx.save();
  ctx.strokeStyle = '#ffd400';
  ctx.setLineDash([8,6]);
  ctx.lineWidth = 3;

  if (isCircle()){
    if (state.selected === 0){
      const { cx, cy, r } = circleGeom(PREV_W, PREV_H);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.strokeRect(1,1,PREV_W-2,PREV_H-2);
    }
  } else {
    const rects = computeRects(PREV_W, PREV_H);
    const rp = rects[state.selected];
    if (rp) { ctx.strokeRect(rp.x+1, rp.y+1, rp.w-2, rp.h-2); }
  }
  ctx.restore();
}

// --- interaktiot (drag) ---
let draggingImg = false, lastX=0, lastY=0;
let draggingDivider = null;
let slantDragStartPx = 0, slantDragStartAngle = 0;

function hitStroke(path, px, py, lineWidthPx){
  ctx.save();
  ctx.lineWidth = lineWidthPx;
  const ok = ctx.isPointInStroke(path, px, py);
  ctx.restore();
  return ok;
}

function dividerHitTest(px, py){
  const d = DIVIDER_PX * (PREV_W / W);
  const tol = Math.max(10, d + 6);

  if (type()==='rect2v'){
    const x = midXFromPct(PREV_W, state.splitVertPct);
    if (Math.abs(px - x) <= tol) return {kind:'v'};
  } else if (type()==='rect2h'){
    const y = midYFromPct(PREV_H, state.splitHorizPct);
    if (Math.abs(py - y) <= tol) return {kind:'h'};
  } else if (type()==='rect2x2'){
    const x = midXFromPct(PREV_W, state.grid2x2.x);
    const y = midYFromPct(PREV_H, state.grid2x2.y);
    const dx = Math.abs(px - x), dy = Math.abs(py - y);
    if (dx <= tol && dy <= tol){ return dx < dy ? {kind:'vx2'} : {kind:'hx2'}; }
    if (dx <= tol) return {kind:'vx2'};
    if (dy <= tol) return {kind:'hx2'};
  } else if (type()==='rect3'){
    let x1 = posFromPct(PREV_W, state.grid3.a);
    let x2 = posFromPct(PREV_W, state.grid3.b);
    if (Math.abs(px - x1) <= tol) return {kind:'v3a'};
    if (Math.abs(px - x2) <= tol) return {kind:'v3b'};
  } else if (type()==='stack-left' || type()==='stack-right'){
    const mid = midXFromPct(PREV_W, state.splitVertPct);
    if (Math.abs(px - mid) <= tol) return {kind:'v'};
    const midY = midYFromPct(PREV_H, state.splitHorizPct);
    if (type()==='stack-left'){
      const limit = mid - (d/2);
      if (px >= -tol && px <= limit + tol && Math.abs(py - midY) <= tol){
        return {kind:'h'};
      }
    } else {
      const start = mid + (d/2);
      if (px >= start - tol && px <= PREV_W + tol && Math.abs(py - midY) <= tol){
        return {kind:'h'};
      }
    }
  } else if (isCurve()){
    const { strokePath } = buildCurvePaths(PREV_W, PREV_H);
    if (hitStroke(strokePath, px, py, d + 8)) return {kind:'curve'};
  } else if (isChevron()){
    const { strokePath } = buildChevronPaths(PREV_W, PREV_H);
    if (hitStroke(strokePath, px, py, d + 6)) return {kind:'chevron'};
  } else if (isDiamond5()){
    const { strokePath } = buildDiamondPaths(PREV_W, PREV_H);
    if (hitStroke(strokePath, px, py, d + 6)) return {kind:'diamond'};
  } else if (isCircle()){
    const { path } = buildCirclePath(PREV_W, PREV_H);
    if (hitStroke(path, px, py, d + 8)) return {kind:'circle-stroke'};
  } else if (isSlanted()){
    const { strokePath } = buildSlantedPaths(PREV_W, PREV_H, state.slantedAngleDeg);
    if (hitStroke(strokePath, px, py, d + 6)) return {kind:'slant'};
  }
  return null;
}

els.canvas.addEventListener('pointerdown', (e)=>{
  const rect = els.canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  // 1) jakajan raahaus (kaikki templatet)
  const hitDiv = dividerHitTest(px, py);
  if (hitDiv){
    draggingDivider = hitDiv.kind;
    if (draggingDivider==='slant'){
      slantDragStartPx = px;
      slantDragStartAngle = state.slantedAngleDeg;
    }
    els.canvas.setPointerCapture(e.pointerId);
    return;
  }

  // 2) solun valinta
  if (isCircle()){
    const geom = circleGeom(PREV_W, PREV_H);
    const dx = px - geom.cx, dy = py - geom.cy;
    const inside = (dx*dx + dy*dy) <= (geom.r*geom.r);
    state.selected = inside ? 0 : 1; // 0=ympyrä, 1=tausta
  } else {
    const rects = computeRects(PREV_W, PREV_H);
    let hit=-1; rects.forEach((r,i)=>{ if(px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h) hit=i; });
    if (hit>=0) state.selected = hit;
  }
  renderCellsBar();
  syncCellControls();
  drawPreview();

  // 3) kuvan raahaus valitussa solussa
  if (state.cells[state.selected]?.img){
    draggingImg = true; lastX = e.clientX; lastY = e.clientY;
    els.canvas.setPointerCapture(e.pointerId);
  }
});

els.canvas.addEventListener('pointermove', (e)=>{
  // jakajan dragit
  if (draggingDivider){
    const rect = els.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (draggingDivider==='v'){
      const pct = ((px - PREV_W/2) / PREV_W) * 100;
      state.splitVertPct = clamp(pct, -30, 30);
    } else if (draggingDivider==='h'){
      const pct = ((py - PREV_H/2) / PREV_H) * 100;
      state.splitHorizPct = clamp(pct, -30, 30);
    } else if (draggingDivider==='vx2'){
      const pct = ((px - PREV_W/2) / PREV_W) * 100;
      state.grid2x2.x = clamp(pct, -30, 30);
    } else if (draggingDivider==='hx2'){
      const pct = ((py - PREV_H/2) / PREV_H) * 100;
      state.grid2x2.y = clamp(pct, -30, 30);
    } else if (draggingDivider==='v3a' || draggingDivider==='v3b'){
      const pct = clamp((px / PREV_W) * 100, 5, 95);
      if (draggingDivider==='v3a') state.grid3.a = pct; else state.grid3.b = pct;
      if (state.grid3.a > state.grid3.b) [state.grid3.a, state.grid3.b] = [state.grid3.b, state.grid3.a];
    } else if (draggingDivider==='curve' || draggingDivider==='chevron'){
      const pct = ((px - PREV_W/2) / PREV_W) * 100;
      state.curvePosPct = clamp(pct, -30, 30);
    } else if (draggingDivider==='diamond'){
      const cx = PREV_W/2;
      const rel = Math.abs(px - cx) / PREV_W;
      state.diamondWidthPct = clamp(rel * 100, 12, 35);
    } else if (draggingDivider==='circle-stroke'){
      const pct = ((px - PREV_W/2) / PREV_W) * 100;
      state.circle.xPct = clamp(pct, -30, 30);
    } else if (draggingDivider==='slant'){
      const dx = px - slantDragStartPx;
      const deltaDeg = (dx / PREV_W) * 90; // koko leveyden raahaus = ~90°
      state.slantedAngleDeg = clamp(slantDragStartAngle + deltaDeg, -45, 45);
    }
    updateControlsVisibility();
    drawPreview();
    return;
  }

  // kuvan drag valitussa solussa
  if (!draggingImg) return;
  const dxp = e.clientX - lastX, dyp = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  const c = state.cells[state.selected]; if(!c) return;
  c.offX += Math.round(dxp * (W/PREV_W));
  c.offY += Math.round(dyp * (H/PREV_H));
  drawPreview();
});

['pointerup','pointercancel'].forEach(ev=>{
  els.canvas.addEventListener(ev, (e)=>{
    draggingImg = false;
    draggingDivider = null;
    try{ els.canvas.releasePointerCapture(e.pointerId);}catch{}
  });
});

// DnD suoraan soluun
;['dragenter','dragover'].forEach(t=>els.canvas.addEventListener(t, e=>{e.preventDefault();}, false));
;['dragleave','drop'].forEach(t=>els.canvas.addEventListener(t, e=>{e.preventDefault();}, false));
els.canvas.addEventListener('drop', async (e)=>{
  const file = Array.from(e.dataTransfer.files||[]).find(f=>/image\/(png|jpe?g)/i.test(f.type));
  if (!file) return;
  const rect = els.canvas.getBoundingClientRect();
  const px=e.clientX-rect.left, py=e.clientY-rect.top;

  let targetIndex = 0;
  if (isCircle()){
    const { cx, cy, r } = circleGeom(PREV_W, PREV_H);
    const dx = px - cx, dy = py - cy;
    targetIndex = (dx*dx+dy*dy <= r*r) ? 0 : 1;
  } else {
    const rects = computeRects(PREV_W, PREV_H);
    let hit=-1; rects.forEach((r,i)=>{ if(px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h) hit=i; });
    if (hit>=0) targetIndex = hit;
  }

  await loadFileToCell(file, targetIndex);
  state.selected = targetIndex;
  renderCellsBar(); syncCellControls(); drawPreview();
});

// --- kontrollit ---
function updateControlsVisibility(){
  const t = type();
  const showSplitVert = (t==='rect2v' || t==='stack-left' || t==='stack-right');
  const showSplitHoriz = (t==='rect2h' || t==='stack-left' || t==='stack-right');
  if (els.ctrlSplitVert)   els.ctrlSplitVert.style.display = showSplitVert ? '' : 'none';
  if (els.ctrlSplitHoriz)  els.ctrlSplitHoriz.style.display = showSplitHoriz ? '' : 'none';
  if (els.ctrlGrid2x2X)    els.ctrlGrid2x2X.style.display = (t==='rect2x2') ? '' : 'none';
  if (els.ctrlGrid2x2Y)    els.ctrlGrid2x2Y.style.display = (t==='rect2x2') ? '' : 'none';
  if (els.ctrlCurve)       els.ctrlCurve.style.display = (isShapedSplit2()) ? '' : 'none';
  if (els.ctrlDiamondWidth)els.ctrlDiamondWidth.style.display = (isDiamond5()) ? '' : 'none';

  const circleVisible = isCircle();
  if (els.ctrlCircleX)    els.ctrlCircleX.style.display = circleVisible ? '' : 'none';
  if (els.ctrlCircleSize) els.ctrlCircleSize.style.display = circleVisible ? '' : 'none';

  if (els.ctrlSlanted)    els.ctrlSlanted.style.display = isSlanted() ? '' : 'none';

  if (els.splitVertPos) {
    els.splitVertPos.value = state.splitVertPct;
    if (els.splitVertVal) els.splitVertVal.textContent = `${Math.round(state.splitVertPct)}%`;
    updateRangeFill(els.splitVertPos);
  }
  if (els.splitHorizPos){
    els.splitHorizPos.value = state.splitHorizPct;
    if (els.splitHorizVal) els.splitHorizVal.textContent = `${Math.round(state.splitHorizPct)}%`;
    updateRangeFill(els.splitHorizPos);
  }
  if (els.grid2x2X){
    els.grid2x2X.value = state.grid2x2.x;
    if (els.grid2x2XVal) els.grid2x2XVal.textContent = `${Math.round(state.grid2x2.x)}%`;
    updateRangeFill(els.grid2x2X);
  }
  if (els.grid2x2Y){
    els.grid2x2Y.value = state.grid2x2.y;
    if (els.grid2x2YVal) els.grid2x2YVal.textContent = `${Math.round(state.grid2x2.y)}%`;
    updateRangeFill(els.grid2x2Y);
  }

  if (els.curvePos){
    els.curvePos.value = state.curvePosPct;
    if (els.curvePosVal) els.curvePosVal.textContent = `${Math.round(state.curvePosPct)}%`;
    updateRangeFill(els.curvePos);
  }
  if (els.diamondWidth){
    els.diamondWidth.value = state.diamondWidthPct;
    if (els.diamondWidthVal) els.diamondWidthVal.textContent = `${Math.round(state.diamondWidthPct)}%`;
    updateRangeFill(els.diamondWidth);
  }

  if (els.circleX){
    els.circleX.value = state.circle.xPct;
    if (els.circleXVal) els.circleXVal.textContent = `${Math.round(state.circle.xPct)}%`;
    updateRangeFill(els.circleX);
  }
  if (els.circleSize){
    els.circleSize.value = state.circle.sizePct;
    if (els.circleSizeVal) els.circleSizeVal.textContent = `${Math.round(state.circle.sizePct)}%`;
    updateRangeFill(els.circleSize);
  }

  if (els.slantedAngle){
    els.slantedAngle.value = state.slantedAngleDeg;
    if (els.slantedAngleVal) els.slantedAngleVal.textContent = `${Math.round(state.slantedAngleDeg)}°`;
    updateRangeFill(els.slantedAngle);
  }
}

function syncCellControls(){
  const c = state.cells[state.selected] || defaultCell();
  if (els.cellScale){
    els.cellScale.value = c.scale;
    if (els.cellScaleVal) els.cellScaleVal.textContent = `${c.scale}%`;
    updateRangeFill(els.cellScale);
  }
  if (els.cellBright){
    els.cellBright.value = c.bright;
    if (els.cellBrightVal) els.cellBrightVal.textContent = `${c.bright}%`;
    updateRangeFill(els.cellBright);
  }
  if (els.cellContrast){
    els.cellContrast.value = c.contrast;
    if (els.cellContrastVal) els.cellContrastVal.textContent = `${c.contrast}%`;
    updateRangeFill(els.cellContrast);
  }
  if (els.cellBlur){
    els.cellBlur.value = c.blur;
    if (els.cellBlurVal) els.cellBlurVal.textContent = `${c.blur} px`;
    updateRangeFill(els.cellBlur);
  }
  if (els.cellGray) els.cellGray.checked = !!c.gray;
}

if (els.cellFile) els.cellFile.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  await loadFileToCell(file, state.selected);
  syncCellControls(); drawPreview();
});

function onSplitVert(){
  state.splitVertPct=+els.splitVertPos.value;
  if (els.splitVertVal) els.splitVertVal.textContent=`${Math.round(state.splitVertPct)}%`;
  updateRangeFill(els.splitVertPos);
  drawPreview();
}
function onSplitHoriz(){
  state.splitHorizPct=+els.splitHorizPos.value;
  if (els.splitHorizVal) els.splitHorizVal.textContent=`${Math.round(state.splitHorizPct)}%`;
  updateRangeFill(els.splitHorizPos);
  drawPreview();
}
function onGrid2x2X(){
  state.grid2x2.x=+els.grid2x2X.value;
  if (els.grid2x2XVal) els.grid2x2XVal.textContent=`${Math.round(state.grid2x2.x)}%`;
  updateRangeFill(els.grid2x2X);
  drawPreview();
}
function onGrid2x2Y(){
  state.grid2x2.y=+els.grid2x2Y.value;
  if (els.grid2x2YVal) els.grid2x2YVal.textContent=`${Math.round(state.grid2x2.y)}%`;
  updateRangeFill(els.grid2x2Y);
  drawPreview();
}
function onCurvePos(){
  state.curvePosPct=+els.curvePos.value;
  if (els.curvePosVal) els.curvePosVal.textContent=`${Math.round(state.curvePosPct)}%`;
  updateRangeFill(els.curvePos);
  drawPreview();
}
function onDiamondWidth(){
  state.diamondWidthPct=+els.diamondWidth.value;
  if (els.diamondWidthVal) els.diamondWidthVal.textContent=`${Math.round(state.diamondWidthPct)}%`;
  updateRangeFill(els.diamondWidth);
  drawPreview();
}
function onCircleX(){
  state.circle.xPct = +els.circleX.value;
  if (els.circleXVal) els.circleXVal.textContent = `${Math.round(state.circle.xPct)}%`;
  updateRangeFill(els.circleX);
  drawPreview();
}
function onCircleSize(){
  state.circle.sizePct = +els.circleSize.value;
  if (els.circleSizeVal) els.circleSizeVal.textContent = `${Math.round(state.circle.sizePct)}%`;
  updateRangeFill(els.circleSize);
  drawPreview();
}
function onSlantedAngle(){
  state.slantedAngleDeg = clamp(+els.slantedAngle.value, -45, 45);
  if (els.slantedAngleVal) els.slantedAngleVal.textContent = `${Math.round(state.slantedAngleDeg)}°`;
  updateRangeFill(els.slantedAngle);
  drawPreview();
}

;['input','change'].forEach(ev=>{
  if (els.splitVertPos) els.splitVertPos.addEventListener(ev, onSplitVert);
  if (els.splitHorizPos) els.splitHorizPos.addEventListener(ev, onSplitHoriz);
  if (els.grid2x2X) els.grid2x2X.addEventListener(ev, onGrid2x2X);
  if (els.grid2x2Y) els.grid2x2Y.addEventListener(ev, onGrid2x2Y);
  if (els.curvePos) els.curvePos.addEventListener(ev, onCurvePos);
  if (els.diamondWidth) els.diamondWidth.addEventListener(ev, onDiamondWidth);

  if (els.circleX) els.circleX.addEventListener(ev, onCircleX);
  if (els.circleSize) els.circleSize.addEventListener(ev, onCircleSize);

  if (els.slantedAngle) els.slantedAngle.addEventListener(ev, onSlantedAngle);
});

if (els.cellScale) els.cellScale.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.scale = +els.cellScale.value;
  if (els.cellScaleVal) els.cellScaleVal.textContent = `${c.scale}%`;
  updateRangeFill(els.cellScale);
  drawPreview();
});
if (els.cellBright) els.cellBright.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.bright = +els.cellBright.value;
  if (els.cellBrightVal) els.cellBrightVal.textContent = `${c.bright}%`;
  updateRangeFill(els.cellBright);
  drawPreview();
});
if (els.cellContrast) els.cellContrast.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.contrast = +els.cellContrast.value;
  if (els.cellContrastVal) els.cellContrastVal.textContent = `${c.contrast}%`;
  updateRangeFill(els.cellContrast);
  drawPreview();
});
if (els.cellBlur) els.cellBlur.addEventListener('input', ()=>{
  const c = state.cells[state.selected]; if(!c) return;
  c.blur = +els.cellBlur.value;
  if (els.cellBlurVal) els.cellBlurVal.textContent = `${c.blur} px`;
  updateRangeFill(els.cellBlur);
  drawPreview();
});
if (els.cellGray) els.cellGray.addEventListener('change', ()=>{ const c = state.cells[state.selected]; if(!c) return; c.gray = !!els.cellGray.checked; drawPreview(); });

if (els.cellCenter) els.cellCenter.addEventListener('click', ()=>{ const c = state.cells[state.selected]; if(!c) return; c.offX = 0; c.offY = 0; drawPreview(); });

if (els.cellClear) els.cellClear.addEventListener('click', ()=>{ const i = state.selected; state.cells[i] = defaultCell(); if (els.cellFile) els.cellFile.value = ''; syncCellControls(); drawPreview(); });

if (els.resetCell) els.resetCell.addEventListener('click', ()=>{
  const c = state.cells[state.selected];
  if (!c) return;
  const keepImg = c.img, iw=c.iw, ih=c.ih;
  Object.assign(c, { scale:100, offX:0, offY:0, bright:100, contrast:100, gray:false, blur:0 });
  c.img = keepImg; c.iw = iw; c.ih = ih;
  syncCellControls(); drawPreview();
});

// "Uusi kuva" – nollaa layoutin tilan
if (els.newImageBtn) els.newImageBtn.addEventListener('click', ()=>{
  state.cells = state.cells.map(()=>defaultCell());
  state.splitVertPct = 0; state.splitHorizPct = 0; state.grid2x2 = { x:0, y:0 }; state.curvePosPct = 0; state.grid3 = { a:33, b:66 };
  state.diamondWidthPct = 22;
  state.circle = { xPct: 0, sizePct: 70 };
  state.slantedAngleDeg = 3;
  state.selected = isCircle() ? 1 : 0;
  if (els.cellFile) els.cellFile.value = '';
  renderCellsBar(); syncCellControls(); updateControlsVisibility(); drawPreview();
});

// --- export ---
if (els.download) els.download.addEventListener('click', ()=>{
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');

  const rects = computeRects(W, H);

  if (isCurve()){
    const { leftPath, rightPath, strokePath } = buildCurvePaths(W, H);
    const paths = [leftPath,rightPath];
    paths.forEach((p,i)=>{ g.save(); g.clip(p); const c = state.cells[i]; if (c?.img) drawCellExport(g, c, rects[i]); g.restore(); });
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX + CURVE_EXTRA; g.lineCap='round'; g.lineJoin='round'; g.stroke(strokePath); g.restore();

  } else if (isChevron()){
    const { leftPath, rightPath, strokePath } = buildChevronPaths(W, H);
    const paths = [leftPath,rightPath];
    paths.forEach((p,i)=>{ g.save(); g.clip(p,'nonzero'); const c = state.cells[i]; if (c?.img) drawCellExport(g, c, rects[i]); g.restore(); });
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX; g.lineCap='round'; g.lineJoin='round'; g.stroke(strokePath); g.restore();

  } else if (isDiamond5()){
    const { center, strokePath, leftH, rightH, corners } = buildDiamondPaths(W, H);
    for (let i=0;i<4;i++){ const rf = rects[i]; g.save(); g.clip(corners[i], 'nonzero'); const c = state.cells[i]; if (c?.img) drawCellExport(g, c, rf); g.restore(); }
    const rfC = rects[4]; const cC = state.cells[4]; g.save(); g.clip(center, 'nonzero'); if (cC?.img) drawCellExport(g, cC, rfC); g.restore();
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX; g.lineJoin='round'; g.stroke(strokePath); g.restore();
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX; g.lineCap='butt'; g.stroke(leftH); g.stroke(rightH); g.restore();

  } else if (isCircle()){
    const bgCell = state.cells[1];
    if (bgCell?.img) drawCellExport(g, bgCell, rects[1]);

    const { cx, cy, r } = circleGeom(W, H);
    g.save(); const p = new Path2D(); p.arc(cx, cy, r, 0, Math.PI*2); g.clip(p, 'nonzero');
    const cCircle = state.cells[0];
    if (cCircle?.img) drawCellExport(g, cCircle, rects[0]);
    g.restore();
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.stroke(); g.restore();

  } else if (isSlanted()){
    const ang = clamp(state.slantedAngleDeg, -45, 45);
    const { leftPath, rightPath, strokePath } = buildSlantedPaths(W, H, ang);
    [leftPath, rightPath].forEach((p,i)=>{ g.save(); g.clip(p, 'nonzero'); const c = state.cells[i]; if (c?.img) drawCellExport(g, c, rects[i]); g.restore(); });
    g.save(); g.strokeStyle = DIVIDER_COLOR; g.lineWidth = DIVIDER_PX; g.lineCap='round'; g.lineJoin='round'; g.stroke(strokePath); g.restore();

  } else {
    rects.forEach((rf,i)=>{ g.save(); g.beginPath(); g.rect(rf.x, rf.y, rf.w, rf.h); g.clip(); const c = state.cells[i]; if (c?.img) drawCellExport(g, c, rf); g.restore(); });
    drawRectGuttersExport(g, W, H);
  }

  out.toBlob((blob)=>{ const a = document.createElement('a'); a.download = 'gridgen_kuva.png'; a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href); }, 'image/png', 1.0);
});

function drawCellExport(g, c, rf){
  const iw=c.iw, ih=c.ih;
  if (!iw || !ih || !c.img) return;
  const cover = Math.max(rf.w/iw, rf.h/ih);
  const user = c.scale/100;
  const dW = iw*cover*user, dH = ih*cover*user;
  const cx = rf.x + rf.w/2 + c.offX;
  const cy = rf.y + rf.h/2 + c.offY;

  g.save();
  g.filter = filterString(c);
  g.drawImage(c.img, cx - dW/2, cy - dH/2, dW, dH);
  g.restore();
}
function drawRectGuttersExport(g, outW, outH){
  const t = type();
  const d = DIVIDER_PX;
  g.save(); g.fillStyle=DIVIDER_COLOR;
  if (t==='rect2v' || isSlanted()){
    const mid = (t==='rect2v') ? midXFromPct(outW, state.splitVertPct) : outW/2;
    g.fillRect(Math.round(mid - d/2),0,d,outH);
  }
  else if (t==='stack-left' || t==='stack-right'){
    const mid = midXFromPct(outW, state.splitVertPct);
    const leftW = Math.round(mid - d/2);
    const rightW = outW - leftW - d;
    g.fillRect(Math.round(mid - d/2),0,d,outH);
    const midY = midYFromPct(outH, state.splitHorizPct);
    const y = Math.round(midY - d/2);
    if (t==='stack-left'){
      g.fillRect(0,y,leftW,d);
    } else {
      const rightX = leftW + d;
      g.fillRect(rightX,y,rightW,d);
    }
  }
  else if (t==='rect2h'){ const mid=midYFromPct(outH, state.splitHorizPct); g.fillRect(0,Math.round(mid - d/2),outW,d); }
  else if (t==='rect2x2'){ const mx=midXFromPct(outW, state.grid2x2.x), my=midYFromPct(outH, state.grid2x2.y); g.fillRect(Math.round(mx - d/2),0,d,outH); g.fillRect(0,Math.round(my - d/2),outW,d); }
  else if (t==='rect3'){
    let x1 = posFromPct(outW, state.grid3.a);
    let x2 = posFromPct(outW, state.grid3.b);
    if (x2 < x1) [x1,x2] = [x2,x1];
    g.fillRect(Math.round(x1 - d/2), 0, d, outH);
    g.fillRect(Math.round(x2 - d/2), 0, d, outH);
  }
  g.restore();
}

// --- kuvan lataus soluun ---
async function loadFileToCell(file, index){
  try{
    const bmp = await createImageBitmap(file);
    state.cells[index] = { ...defaultCell(), img:bmp, iw:bmp.width, ih:bmp.height };
    if (els.cellFile) els.cellFile.value=''; // nollaa input
  }catch(err){ console.error('Kuvan lataus epäonnistui:', err); }
}

// --- Start ---
function start(){
  renderLayoutGallery();
  initCellsForLayout();
  updateControlsVisibility();
  drawPreview();
}
start();
