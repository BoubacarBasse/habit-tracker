// Pixel-art sprites for the character select screen.
// Ported verbatim from the design handoff (Character Select.dc.html): every pixel is placed
// by these drawing routines into a 64x96 grid, then written to a canvas. Do not "clean up".

export const SPRITE_W = 64;
export const SPRITE_H = 96;

function makeGrid(w, h) {
  const d = []; for (let y = 0; y < h; y++) d.push(new Array(w).fill(null));
  const G = {
    w, h, d,
    px(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) d[y][x] = c; },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) G.px(x + i, y + j, c); },
    ell(cx, cy, rx, ry, c) {
      for (let y2 = Math.ceil(cy - ry); y2 <= cy + ry; y2++)
        for (let x2 = Math.ceil(cx - rx); x2 <= cx + rx; x2++) {
          const dx = (x2 - cx) / rx, dy = (y2 - cy) / ry;
          if (dx * dx + dy * dy <= 1) G.px(x2, y2, c);
        }
    },
    // dither a 2px checker of c over an existing area
    dither(x, y, rw, rh, c) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++)
        if ((i + j) % 2 === 0) G.px(x + i, y + j, c);
    },
  };
  return G;
}

function outline(g, c) {
  const copy = g.d.map(r => r.slice());
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (copy[y][x]) continue;
    const n = (copy[y - 1] && copy[y - 1][x]) || (copy[y + 1] && copy[y + 1][x]) || copy[y][x - 1] || copy[y][x + 1];
    if (n) g.d[y][x] = c;
  }
}

const M = {
  skin: "#8a5731", skinHi: "#a86d3f", skinSh: "#633d22",
  hair: "#1c1610", hairHi: "#2e251b",
  white: "#dfe6ef", whiteSh: "#aeb9c9",
  blue: "#24467e", blueSh: "#182f57",
  pants: "#2c3140", pantsSh: "#1e222e",
  shoe: "#15171d",
  case: "#16181f", caseSh: "#0b0d12", brass: "#b9a04a",
};

function drawMan(g, f) {
  // shoes
  g.rect(20, 89, 11, 5, M.shoe); g.rect(33, 89, 11, 5, M.shoe);
  // legs
  g.rect(22, 64, 9, 25, M.pants); g.rect(33, 64, 9, 25, M.pantsSh);
  g.rect(31, 64, 2, 25, M.pantsSh);
  // torso
  g.rect(19, 36, 26, 29, M.white);
  // vertical stripes
  for (let x = 19; x < 45; x += 6) { g.rect(x, 36, 3, 29, M.blue); }
  // shading down right side of torso
  for (let y = 36; y < 65; y++) for (let x = 40; x < 45; x++)
    g.d[y][x] = (g.d[y][x] === M.blue) ? M.blueSh : M.whiteSh;
  // shoulders round-off
  g.px(19, 36, null); g.px(44, 36, null);
  // collar
  g.rect(27, 34, 10, 3, M.white); g.px(28, 36, M.blue); g.px(35, 36, M.blue);
  g.rect(30, 34, 4, 4, M.skinSh);
  // chest pocket
  g.rect(35, 44, 6, 6, M.whiteSh); g.rect(35, 44, 6, 1, M.white);
  // buttons placket
  g.rect(31, 37, 2, 27, M.white);
  for (let y = 40; y < 64; y += 6) g.px(32, y, "#6d7787");
  // arms
  // right arm (holds the case) — always down
  g.rect(44, 38, 5, 26, M.whiteSh);
  g.rect(45, 38, 2, 26, M.blueSh); g.rect(48, 38, 1, 26, M.blueSh);
  g.rect(44, 62, 5, 2, M.whiteSh);
  g.ell(46, 66, 3, 3, M.skinSh);
  if (f === 1) {
    // waving: forearm raised beside the head
    g.rect(15, 38, 5, 9, M.white);
    g.rect(15, 38, 2, 9, M.blue); g.rect(18, 38, 2, 9, M.blue);
    g.rect(13, 22, 5, 20, M.white);
    g.rect(13, 22, 2, 20, M.blue); g.rect(16, 22, 2, 20, M.blue);
    g.rect(13, 22, 5, 2, M.whiteSh);
    g.ell(15, 18, 4, 4, M.skin);
    g.px(13, 15, M.skin); g.px(15, 14, M.skin); g.px(17, 15, M.skin);
  } else {
    g.rect(15, 38, 5, 26, M.white);
    g.rect(15, 38, 2, 26, M.blue); g.rect(18, 38, 2, 26, M.blue);
    g.rect(15, 62, 5, 2, M.whiteSh);
    g.ell(17, 66, 3, 3, M.skin);
  }
  // neck
  g.rect(28, 30, 9, 6, M.skinSh);
  // head: full, rounded
  g.ell(32, 22, 10, 12, M.skin);
  g.rect(23, 17, 18, 12, M.skin);
  g.ell(30, 20, 7, 9, M.skinHi);
  // ears
  g.rect(21, 21, 2, 4, M.skinSh); g.rect(41, 21, 2, 4, M.skinSh);
  // full beard along the jaw
  g.rect(22, 22, 3, 10, M.hair); g.rect(39, 22, 3, 10, M.hair);
  g.rect(23, 30, 18, 3, M.hair);
  g.ell(32, 32, 8, 4, M.hair);
  // short fade
  g.ell(32, 13, 10, 7, M.hair);
  g.rect(22, 13, 20, 5, M.hair);
  g.rect(22, 18, 2, 4, M.hairHi); g.rect(40, 18, 2, 4, M.hairHi);
  g.rect(26, 7, 12, 1, M.hairHi);
  // brows
  g.rect(25, 19, 5, 2, M.hair); g.rect(34, 19, 5, 2, M.hair);
  // eyes
  g.rect(26, 22, 4, 2, "#120e0a"); g.rect(34, 22, 4, 2, "#120e0a");
  g.px(27, 22, "#e8e2d8"); g.px(35, 22, "#e8e2d8");
  // nose
  g.rect(31, 24, 3, 3, M.skinSh); g.px(30, 26, M.skinSh); g.px(34, 26, M.skinSh);
  // mustache + smile
  g.rect(27, 27, 10, 2, M.hair);
  g.px(28, 29, M.hair); g.px(35, 29, M.hair);
  g.rect(29, 29, 6, 1, "#e9dfcd");
  g.rect(29, 30, 6, 1, M.skinSh);
  // briefcase (right hand)
  g.rect(42, 68, 18, 14, M.case);
  g.rect(42, 68, 18, 2, "#23262e");
  g.rect(42, 79, 18, 3, M.caseSh);
  g.rect(50, 74, 4, 3, M.brass);
  g.rect(44, 65, 2, 4, M.case); g.rect(47, 65, 2, 4, M.case);
  g.rect(44, 64, 5, 2, M.case);
}

const W = {
  skin: "#8d6446", skinSh: "#6a4a33", skinHi: "#a5795a",
  hat: "#9a8467", hatSh: "#75634a", hatHi: "#b09a7c",
  coat: "#272b36", coatHi: "#343a49", coatSh: "#1a1d25",
  hood: "#1e2129",
  band: "#8b90a0",
  glass: "#0b0d12",
  pants: "#1c1f27", pantsHi: "#262a34",
  shoe: "#101218",
  meat: "#c07f38", crust: "#9c6224", bone: "#efe4cd",
};

function drawWoman(g, f) {
  // shoes
  g.rect(20, 90, 11, 4, W.shoe); g.rect(33, 90, 11, 4, W.shoe);
  // baggy pants
  g.rect(19, 64, 12, 27, W.pants); g.rect(33, 64, 12, 27, W.pants);
  g.rect(19, 64, 26, 6, W.pantsHi);
  g.rect(31, 64, 2, 27, W.coatSh);
  g.rect(20, 70, 3, 20, W.pantsHi);
  // jacket body (boxy)
  g.rect(18, 34, 28, 30, W.coat);
  g.rect(18, 59, 28, 5, W.band);
  g.dither(18, 59, 28, 5, "#767c8c");
  // light on left panel
  g.rect(18, 34, 8, 25, W.coatHi);
  // zipper
  g.rect(31, 34, 2, 25, "#4b5161");
  // backpack straps
  g.rect(22, 34, 4, 25, W.coatSh); g.rect(38, 34, 4, 25, W.coatSh);
  g.rect(22, 40, 4, 1, W.band); g.rect(38, 40, 4, 1, W.band);
  // shoulders round-off
  g.px(18, 34, null); g.px(45, 34, null);
  // sleeves
  g.rect(14, 36, 5, f === 1 ? 14 : 27, W.coatHi); g.rect(45, 36, 5, 27, W.coatSh);
  // sleeve wordmark stripe (generic)
  g.rect(46, 42, 2, 14, W.band);
  // right hand
  g.ell(47, 65, 3, 3, W.skinSh);
  // hood shell behind head
  g.ell(32, 24, 15, 15, W.hood);
  g.rect(18, 24, 28, 12, W.hood);
  // neck gaiter
  g.rect(25, 29, 14, 6, "#23262f");
  // face opening
  g.ell(32, 22, 8, 9, W.skin);
  g.ell(30, 21, 6, 7, W.skinHi);
  g.rect(24, 15, 16, 5, W.hood);
  // sunglasses
  g.rect(24, 19, 16, 4, W.glass);
  g.rect(24, 18, 16, 1, "#2a2e38");
  g.px(26, 20, "#4a5160"); g.px(27, 20, "#4a5160");
  // mouth
  if (f === 1) { g.rect(29, 25, 6, 3, "#3a2118"); g.rect(29, 25, 6, 1, "#efe4cd"); }
  else g.rect(30, 26, 4, 1, "#6a4635");
  // hood edge over brow
  g.rect(23, 14, 18, 3, W.coat);
  // bucket hat: tapered crown + short downturned brim
  // bucket hat, sitting low on the head
  for (let i = 0; i < 9; i++) {
    const y = 14 - i, half = Math.round(9 - i * 0.5);
    g.rect(32 - half, y, half * 2, 1, i > 5 ? W.hatHi : W.hat);
  }
  g.rect(20, 14, 24, 3, W.hat);
  g.rect(19, 16, 26, 2, W.hatSh);
  g.rect(21, 18, 22, 1, W.hatSh);
  g.rect(24, 12, 16, 1, W.hatSh);
  // left arm + drumstick, gripped by the bone
  if (f === 1) {
    for (let i = 0; i < 9; i++) {
      const x = Math.round(14 + i * 0.9), y = 48 - i * 2;
      g.rect(x, y, 5, 3, "#3d4354");
      g.rect(x, y, 1, 3, W.coatSh);
    }
    g.ell(23, 34, 3, 3, W.skinSh);
    g.rect(23, 29, 2, 6, W.bone);
    g.ell(25, 26, 5, 5, W.meat);
    g.ell(24, 25, 3, 3, "#d29750");
    g.dither(21, 23, 8, 6, W.crust);
  } else {
    g.ell(16, 65, 3, 3, W.skinSh);
    g.rect(15, 66, 2, 8, W.bone);
    g.ell(14, 79, 5, 6, W.meat);
    g.ell(13, 78, 3, 3, "#d29750");
    g.dither(10, 76, 8, 7, W.crust);
  }
}

// Draws `sprite` ('man' | 'woman') at animation `frame` (0 idle, 1 active) onto a 64x96 canvas.
export function drawSprite(canvas, sprite, frame) {
  const g = makeGrid(SPRITE_W, SPRITE_H);
  (sprite === 'man' ? drawMan : drawWoman)(g, frame);
  outline(g, "#05060a");
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
  const img = ctx.createImageData(SPRITE_W, SPRITE_H);
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) {
    const col = g.d[y][x]; const i = (y * SPRITE_W + x) * 4;
    if (!col) continue;
    img.data[i] = parseInt(col.slice(1, 3), 16);
    img.data[i + 1] = parseInt(col.slice(3, 5), 16);
    img.data[i + 2] = parseInt(col.slice(5, 7), 16);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
