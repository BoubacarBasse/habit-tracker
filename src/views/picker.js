import { drawSprite, SPRITE_W, SPRITE_H } from './characters.js';

// Left sprite (briefcase) = Boubacar, right sprite (drumstick) = Nawel.
const CHARACTERS = [
  { owner: 'boubacar', sprite: 'man', plate: 'BRIEFCASE', name: 'Boubacar' },
  { owner: 'nawel', sprite: 'woman', plate: 'DRUMSTICK', name: 'Nawel' },
];
const FRAME_MS = 340;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Integer pixel scale (2-4) so two cards always fit side by side, even on a 360px phone.
function pickScale() {
  const vw = document.documentElement.clientWidth;
  const wide = vw >= 640;
  const gap = wide ? 80 : 16;
  const pad = wide ? 22 : 10;
  const avail = (vw - 40 - gap) / 2 - pad * 2 - 4;
  return Math.max(2, Math.min(4, Math.floor(avail / SPRITE_W)));
}

function makeCard(c, onChoose) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'char-card';
  btn.setAttribute('aria-label', `${c.plate}, ${c.name}`);

  const canvas = document.createElement('canvas');
  canvas.className = 'char-canvas';
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  canvas.setAttribute('aria-hidden', 'true');

  const plate = document.createElement('div');
  plate.className = 'char-plate';
  plate.textContent = c.plate;
  btn.append(canvas, plate);

  let timer = null;
  let frame = 0;
  let locked = false;
  const paint = (f) => { frame = f; drawSprite(canvas, c.sprite, f); };

  const card = {
    btn,
    setScale(s) {
      canvas.style.width = `${SPRITE_W * s}px`;
      canvas.style.height = `${SPRITE_H * s}px`;
    },
    start() {
      if (btn.classList.contains('is-active')) return;
      btn.classList.add('is-active');
      paint(1);
      if (!reduceMotion()) timer = setInterval(() => paint(frame ? 0 : 1), FRAME_MS);
    },
    stop() {
      if (locked) return;
      clearInterval(timer);
      timer = null;
      btn.classList.remove('is-active');
      paint(0);
    },
    lock() { locked = true; },
    destroy() { clearInterval(timer); },
  };

  paint(0);
  btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') card.start(); });
  btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') card.stop(); });
  btn.addEventListener('pointerdown', () => card.start());
  btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) card.start(); });
  btn.addEventListener('blur', () => card.stop());
  btn.addEventListener('click', () => onChoose(c, card));
  return card;
}

// Renders the character select into `root`. Calls onPick(owner) after a short animation.
// Returns a cleanup function.
export function showPicker(root, onPick) {
  root.textContent = '';

  const heading = document.createElement('h1');
  heading.className = 'picker-title';
  heading.textContent = 'Select your character';

  const row = document.createElement('div');
  row.className = 'picker-row';

  let chosen = false;
  let pickTimer = null;
  const cards = CHARACTERS.map((c) => makeCard(c, (ch, card) => {
    if (chosen) return;
    chosen = true;
    card.start();
    cards.forEach((k) => k.lock());
    pickTimer = setTimeout(() => onPick(ch.owner), reduceMotion() ? 150 : 700);
  }));
  row.append(...cards.map((k) => k.btn));
  root.append(heading, row);

  const applyScale = () => { const s = pickScale(); cards.forEach((k) => k.setScale(s)); };
  applyScale();
  window.addEventListener('resize', applyScale);

  // Touch/pen: sliding a finger across the cards animates whichever one is under it.
  row.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || chosen) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.char-card');
    cards.forEach((k) => (k.btn === hit ? k.start() : k.stop()));
  });
  const settle = (e) => {
    if (e.pointerType === 'mouse') return;
    setTimeout(() => { if (!chosen) cards.forEach((k) => { if (document.activeElement !== k.btn) k.stop(); }); }, 700);
  };
  row.addEventListener('pointerup', settle);
  row.addEventListener('pointercancel', settle);

  // Arrow keys move between the two cards.
  row.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = cards.findIndex((k) => k.btn === document.activeElement);
    const next = cards[e.key === 'ArrowRight' ? Math.min(i + 1, cards.length - 1) : Math.max(i - 1, 0)];
    if (next) { e.preventDefault(); next.btn.focus(); }
  });

  return () => {
    clearTimeout(pickTimer);
    window.removeEventListener('resize', applyScale);
    cards.forEach((k) => k.destroy());
  };
}
