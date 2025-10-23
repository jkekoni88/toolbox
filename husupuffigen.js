// HusupuffiGen – 1080x1920 pysty
// Fontit: 'Quattro News' (Bold) ladataan @font-face:lla CSS:stä ja odotetaan ennen piirtämistä

const W = 1080, H = 1920;

// Reunamarginaalit ja tekstialue
const MARGIN_X = 100;
const TEXT_LEFT = MARGIN_X;
const TEXT_RIGHT = W - MARGIN_X;
const MAX_TEXT_WIDTH = TEXT_RIGHT - TEXT_LEFT;

// Canvas ja kontrollit
const canvas = document.getElementById("puffiCanvas");
const ctx = canvas.getContext("2d");

const headlineInput = document.getElementById("headline");
const weekdaySelect = document.getElementById("weekday");
const scheduleInput = document.getElementById("schedule");
const footerInput = document.getElementById("footer");
const downloadBtn = document.getElementById("download");

// Tausta
const bg = new Image();
bg.src = "img/husupuffipohja.jpg";

// Typografia
const COLOR_HEADLINE = "#e7b106";
const COLOR_BODY = "#000000";
const FONT_FACE = "Quattro News";   // vastaa @font-face:n font-family -nimeä

const HEADLINE_BASE = 72;   // px
const BODY_SIZE = 44;       // px
const FOOTER_SIZE = 55;     // px

const HEADLINE_BOTTOM_Y = 547; // toisen otsikkorivin baseline
const BODY_LINEHEIGHT = 70;    // kiinteä riviväli leipäteksteille
const FOOTER_LINEHEIGHT = Math.round(FOOTER_SIZE * 1.28);

const HEADLINE_MIN_SIZE = 42;
const GAP_AFTER_HEADLINE = 120;   // 100 + extra 20 px
const FOOTER_GAP = 100;
const FOOTER_BOTTOM_MARGIN = 150;

// Aikakolumni
const TIME_GAP = 9; // pienennetty väli kellonajan ja otsikon välillä
const TIME_REGEX = /^(\d{1,2}\.\d{2})\s+(.*)$/;

// ---- Fontin varmistus ----
async function ensureFontLoaded(){
  // Ladataan kaikki käytetyt koot (bold)
  try{
    // jos fonttia ei tunnisteta, document.fonts.check palauttaa false
    const need =
      !document.fonts.check(`700 ${HEADLINE_BASE}px '${FONT_FACE}'`) ||
      !document.fonts.check(`700 ${BODY_SIZE}px '${FONT_FACE}'`) ||
      !document.fonts.check(`700 ${FOOTER_SIZE}px '${FONT_FACE}'`);

    if (need){
      await Promise.all([
        document.fonts.load(`700 ${HEADLINE_BASE}px '${FONT_FACE}'`),
        document.fonts.load(`700 ${BODY_SIZE}px '${FONT_FACE}'`),
        document.fonts.load(`700 ${FOOTER_SIZE}px '${FONT_FACE}'`),
      ]);
      await document.fonts.ready;
    }
  }catch(_){
    // jos selain ei tue FontFaceSet API:a, jatketaan vain
  }
}

// -- apurit --
function setFont(sizePx, weight = "700", face = FONT_FACE){
  // Käytä täsmälleen samaa family-nimeä kuin @font-face:ssa ('Quattro News')
  // ja kerroin 700 varmistamaan bold-leikkauksen.
  ctx.font = `${weight} ${sizePx}px '${face}'`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR_BODY;
}

function fitHeadlineSize(text, baseSize){
  let size = baseSize;
  setFont(size, "700");
  while (ctx.measureText(text).width > MAX_TEXT_WIDTH && size > HEADLINE_MIN_SIZE){
    size -= 1;
    setFont(size, "700");
  }
  return size;
}

function wrapToWidth(text, sizePx, width){
  setFont(sizePx, "700");
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (let i=0;i<words.length;i++){
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width <= width){
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLinesLeft(lines, x, startY, sizePx, lineHeight){
  setFont(sizePx, "700");
  let y = startY;
  for (const ln of lines){
    ctx.fillText(ln, x, y);
    y += lineHeight;
  }
  return y;
}

function drawLinesCenter(lines, startY, sizePx, lineHeight){
  setFont(sizePx, "700");
  ctx.textAlign = "center";
  let y = startY;
  for (const ln of lines){
    ctx.fillText(ln, W/2, y);
    y += lineHeight;
  }
  ctx.textAlign = "left";
  return y;
}

// -- otsikko --
function drawHeadline(){
  const first = headlineInput.value || "";
  const day = weekdaySelect.value || "";

  const size1 = fitHeadlineSize(first, HEADLINE_BASE);
  const size2 = fitHeadlineSize(day,   HEADLINE_BASE);
  const lh1 = Math.round(size1 * 1.20);

  const line2Y = HEADLINE_BOTTOM_Y;
  const line1Y = HEADLINE_BOTTOM_Y - lh1;

  // rivi 1
  setFont(size1, "700");
  ctx.fillStyle = COLOR_HEADLINE;
  ctx.fillText(first, TEXT_LEFT, line1Y);

  // rivi 2
  setFont(size2, "700");
  ctx.fillStyle = COLOR_HEADLINE;
  ctx.fillText(day, TEXT_LEFT, line2Y);

  ctx.fillStyle = COLOR_BODY;
  return line2Y + GAP_AFTER_HEADLINE;
}

// -- aikataulu (kellonaika + otsikko sisennettynä) --
function measureTimeColumn(lines){
  setFont(BODY_SIZE, "700");
  let maxW = ctx.measureText("88.88").width; // konservatiivinen vähimmäisleveys
  for (const raw of lines){
    const m = raw.match(TIME_REGEX);
    if (m){
      const t = m[1];
      const w = ctx.measureText(t).width;
      if (w > maxW) maxW = w;
    }
  }
  return Math.ceil(maxW);
}

function drawSchedule(startY){
  const rawLines = (scheduleInput.value || "").split("\n");

  // 1) aikakolumnin leveys
  const timeColWidth = measureTimeColumn(rawLines);
  const titleX = TEXT_LEFT + timeColWidth + TIME_GAP;
  const titleWidth = TEXT_RIGHT - titleX;

  let y = startY;

  for (const raw of rawLines){
    const text = raw.trim();
    if (!text){
      y += BODY_LINEHEIGHT;
      continue;
    }

    const m = text.match(TIME_REGEX);
    if (m){
      const time = m[1];
      const title = m[2];

      // kellonaika vasemmasta reunasta alkaen (kolumni vas. reuna = TEXT_LEFT)
      setFont(BODY_SIZE, "700");
      ctx.fillText(time, TEXT_LEFT, y);

      // otsikko rivitettynä title-kolumniin
      const wrapped = wrapToWidth(title, BODY_SIZE, titleWidth);
      y = drawLinesLeft(wrapped, titleX, y, BODY_SIZE, BODY_LINEHEIGHT);
    } else {
      const wrapped = wrapToWidth(text, BODY_SIZE, TEXT_RIGHT - TEXT_LEFT);
      y = drawLinesLeft(wrapped, TEXT_LEFT, y, BODY_SIZE, BODY_LINEHEIGHT);
    }
  }

  return y;
}

// -- footer --
function drawFooter(yAfterSchedule){
  const text = footerInput.value || "";
  const lines = wrapToWidth(text, FOOTER_SIZE, MAX_TEXT_WIDTH);

  const desiredY = yAfterSchedule + FOOTER_GAP;
  const totalH = lines.length * FOOTER_LINEHEIGHT;
  const maxStart = H - FOOTER_BOTTOM_MARGIN - (totalH - FOOTER_LINEHEIGHT);

  const startY = Math.min(maxStart, desiredY);
  drawLinesCenter(lines, startY, FOOTER_SIZE, FOOTER_LINEHEIGHT);
}

// -- pääpiirto --
function draw(){
  ctx.clearRect(0,0,W,H);

  // tausta cover
  if (bg.complete && bg.naturalWidth){
    const r = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const dw = Math.round(bg.naturalWidth * r);
    const dh = Math.round(bg.naturalHeight * r);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    ctx.drawImage(bg, dx, dy, dw, dh);
  }

  const afterHeadline = drawHeadline();
  const afterSchedule = drawSchedule(afterHeadline);
  drawFooter(afterSchedule);
}

// kuuntelijat
[headlineInput, weekdaySelect, scheduleInput, footerInput].forEach(el =>
  el.addEventListener("input", async () => {
    await ensureFontLoaded();
    draw();
  })
);

// start (odotetaan fontti + tausta)
(async function init(){
  await ensureFontLoaded();
  if (bg.complete) draw();
  else bg.onload = () => { draw(); };
})();

// lataus
downloadBtn.addEventListener("click", async () => {
  await ensureFontLoaded();
  draw();
  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "husupuffigen.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png", 1.0);
});
