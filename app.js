import { openLink } from './lib/seal.js';
import { FILES, GATE, SHRED, SCRIPT5, REPO, WARDEN, LOSTWORLD, YEAR } from './data.js';
import { leaveWarden, renderExtras, renderWarden, toolsCard } from './extras.js';
import { renderLostWorld } from './lostworld.js';
import { renderYear } from './year.js';
import { loadProgress, saveProgress, restore } from './progress.js';
import { LOCKED, howToPlay, progressPips } from './trackdesk.js';

// Stage 0 is the gate and opens the prologue. Stage N opens record N's page of the keeper's story.
const STAGES = [{ sealed: GATE.sealed }, ...FILES];
const REJECTIONS = ['no.', 'the seal holds.', 'that is not what was written.', 'nothing answers.', 'not that word.'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OBJECTS = [
  { kind: 'letter', label: 'a torn letter', caption: 'twenty-four strips, put back in the wrong order.' },
  { kind: 'photo', label: 'a photograph', caption: 'something is written where the light does not reach.' },
  { kind: 'tape', label: 'a cassette', caption: 'no label. one side.' },
  { kind: 'card', label: 'a library card', caption: 'the shelfmark has been scratched out.' },
  { kind: 'page', label: 'a torn page', caption: 'one line survived.' },
];

const app = document.querySelector('#app');
let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null; // blocked: play without saved progress
}
let answers = []; // answers[0] is the gate word, answers[N] is record N's answer
let pages = []; // pages[0] is the prologue, pages[N] is record N's page
let arrangement = [...Array(SHRED.strips).keys()];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function script(words) {
  const p = el('p', 'script');
  for (const word of words) {
    const span = el('span', 'word');
    for (const glyph of word) span.append(el('span', 'glyph', glyph));
    p.append(span, ' ');
  }
  return p;
}

function extrasLink() {
  const a = el('a', 'extras-link', 'extras');
  a.href = '#extras';
  return a;
}

const reject = () => REJECTIONS[Math.floor(Math.random() * REJECTIONS.length)];

// One answer box. `check(value)` resolves true when the word is right.
function answerForm(label, placeholder, check) {
  const form = el('form', 'answer');
  const input = el('input');
  input.name = 'answer';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', label);
  const button = el('button', '', 'unseal');
  const message = el('p', 'reject');
  message.setAttribute('role', 'status');
  const hint = el('p', 'answer-hint', "one word. capitals, spaces and punctuation don't matter.");
  form.append(input, button, message, hint);
  let misses = 0;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = input.value;
    if (!value.trim()) {
      message.textContent = 'type a word first.';
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'checking…';
    message.textContent = '';
    const ok = await check(value);
    if (!ok) {
      misses += 1;
      button.disabled = false;
      button.textContent = 'unseal';
      message.textContent = misses >= 3 ? `${reject()} stuck? look again at everything here, and at the tools in "what you'll need".` : reject();
      input.select();
    }
  });
  return form;
}

// ---------- the gate ----------

function wheel() {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const step = 360 / 26;
  const at = (i, r) => {
    const a = ((i * step - 90) * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const svg = make('svg', { viewBox: '-150 -150 300 300', role: 'img', 'aria-label': 'a brass cipher wheel' });
  svg.append(make('circle', { class: 'ring-outer', r: 142 }));
  for (let i = 0; i < 26; i++) {
    const [x1, y1] = at(i + 0.5, 104);
    const [x2, y2] = at(i + 0.5, 142);
    svg.append(make('line', { class: 'tick', x1, y1, x2, y2 }));
    const [x, y] = at(i, 123);
    const t = make('text', { class: 'outer-letter', x, y, transform: `rotate(${i * step} ${x} ${y})` });
    t.textContent = ALPHABET[i];
    svg.append(t);
  }
  const inner = make('g', { class: 'inner' });
  inner.append(make('circle', { class: 'ring-inner', r: 104 }));
  for (let i = 0; i < 26; i++) {
    const [x, y] = at(i, 86);
    const t = make('text', { class: 'inner-letter', x, y, transform: `rotate(${i * step} ${x} ${y})` });
    t.textContent = ALPHABET[i];
    inner.append(t);
  }
  inner.append(make('circle', { class: 'hub', r: 10 }));
  svg.append(inner);

  let turns = 0;
  const count = el('span', 'wheel-count');
  const turn = (by) => {
    turns += by;
    inner.style.transform = `rotate(${-turns * step}deg)`;
    const shown = ((turns % 26) + 26) % 26;
    count.textContent = shown === 0 ? 'untouched' : `turned ${shown}`;
  };
  const back = el('button', 'quiet', '◀');
  back.type = 'button';
  back.setAttribute('aria-label', 'turn the wheel back one place');
  back.addEventListener('click', () => turn(-1));
  const forward = el('button', 'quiet', 'turn ▶');
  forward.type = 'button';
  forward.setAttribute('aria-label', 'turn the wheel one place');
  forward.addEventListener('click', () => turn(1));
  turn(0);

  const box = el('div', 'wheel');
  const controls = el('div', 'wheel-controls');
  controls.append(back, count, forward);
  box.append(svg, controls);
  return box;
}

function renderGate() {
  app.replaceChildren();
  const intro = el('div', 'intro');
  intro.append(
    el('p', '', 'a year has passed. not everything made it through.'),
    el('p', '', 'five fragments remain, each belonging to a different season of what once was. each is sealed behind a single word. find what was hidden, and the memory will remember you.'),
  );
  const drawer = el('section', 'drawer');
  drawer.setAttribute('aria-label', 'a locked drawer');
  const plate = el('div', 'plate');
  plate.append(script(GATE.script));
  const stamp = el('div', 'stamp');
  stamp.setAttribute('aria-label', `stamped letters: ${GATE.stamp.split('').join(' ')}`);
  for (const ch of GATE.stamp) stamp.append(el('span', '', ch));
  drawer.append(
    el('p', 'greeting', 'welcome, stranger.'),
    el('p', 'greeting', "if you've made it this far, perhaps you were meant to find these."),
    plate,
    stamp,
    wheel(),
    answerForm('the word that opens the drawer', 'the word', async (value) => {
      const prologue = await openLink(GATE.sealed, value);
      if (!prologue) return false;
      answers = [value];
      pages = [prologue];
      saveProgress(storage, answers);
      renderDesk();
      readPage('the first page', prologue);
      return true;
    }),
  );
  const tools = toolsCard(el, [
    'pen and paper',
    'a decoder for old ciphers',
    "something that shows a picture's hidden details",
    'something that shows what a sound looks like',
    'patience with old corners of the internet',
  ]);
  app.append(extrasLink(), el('h1', '', 'the archive'), intro, tools, drawer);
}

// ---------- the desk ----------

function stateOf(i) {
  if (pages[i + 1]) return 'open';
  return i === pages.length - 1 ? 'ready' : 'locked';
}

// A page of the keeper's story: paragraphs, kept as written.
function storyPage(text) {
  const page = el('div', 'story');
  for (const para of text.split(/\n\n+/)) page.append(el('p', '', para));
  return page;
}

function readPage(title, text) {
  const dialog = el('dialog');
  const record = el('div', 'record');
  const close = el('button', 'quiet close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'put it back on the desk');
  close.addEventListener('click', () => dialog.close());
  record.append(close, el('h2', '', title), storyPage(text));
  dialog.append(record);
  const leave = () => dialog.close(); // the route changed under it: put it back
  window.addEventListener('hashchange', leave);
  dialog.addEventListener('close', () => {
    window.removeEventListener('hashchange', leave);
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}

function renderDesk() {
  app.replaceChildren();
  const head = el('header', 'desk-head');
  const opened = pages.length - 1;
  const first = el('button', 'quiet first-page', 'the first page');
  first.type = 'button';
  first.addEventListener('click', () => readPage('the first page', pages[0]));
  head.append(
    el('h1', '', 'the archive'),
    el('p', '', opened === 5 ? 'every seal is broken.' : `${['five', 'four', 'three', 'two', 'one'][opened]} of five records still sealed.`),
    progressPips(el, OBJECTS.map((_, i) => stateOf(i))),
    first,
  );
  const objects = el('section', 'objects');
  objects.setAttribute('aria-label', 'the desk');
  OBJECTS.forEach((object, i) => {
    const state = stateOf(i);
    const button = el('button', `object ${state}`);
    button.type = 'button';
    const thing = el('div', 'thing');
    thing.append(el('div', object.kind), el('div', 'seal'));
    if (state === 'ready') thing.append(el('span', 'badge', opened ? 'next' : 'start here'));
    button.append(thing, el('span', 'label', object.label), el('span', 'caption', state === 'locked' ? LOCKED : object.caption));
    if (state === 'locked') {
      button.disabled = true;
      button.setAttribute('aria-label', `${object.label}, still under the others`);
    } else {
      button.addEventListener('click', () => openRecord(i));
    }
    objects.append(button);
  });
  app.append(extrasLink(), head, howToPlay(el, opened === 0), objects);
}

// ---------- a record, opened ----------

function shredder() {
  const frame = el('div', 'shred-frame');
  const row = el('div', 'shred');
  row.style.aspectRatio = `${SHRED.width} / ${SHRED.height}`;
  let picked = -1;
  const draw = () => {
    row.replaceChildren();
    arrangement.forEach((published, at) => {
      const strip = el('button', `strip${at === picked ? ' picked' : ''}`);
      strip.type = 'button';
      strip.setAttribute('aria-label', `strip ${at + 1}`);
      strip.style.backgroundImage = 'url(files/01.png)';
      strip.style.backgroundSize = `${SHRED.strips * 100}% 100%`;
      strip.style.backgroundPosition = `${(published / (SHRED.strips - 1)) * 100}% 0`;
      strip.addEventListener('click', () => {
        if (picked === -1) {
          picked = at;
        } else {
          [arrangement[picked], arrangement[at]] = [arrangement[at], arrangement[picked]];
          picked = -1;
          try {
            storage?.setItem('archive-strips', JSON.stringify(arrangement));
          } catch {
            // not saved; the strips still move for this visit
          }
        }
        draw();
      });
      row.append(strip);
    });
  };
  draw();
  frame.append(row);
  return frame;
}

function material(i) {
  const box = el('div', 'record-body');
  const kind = OBJECTS[i].kind;
  if (kind === 'letter') {
    box.append(el('p', 'note', 'tap one strip, then another, to swap them.'), shredder());
  }
  if (kind === 'photo') {
    const img = el('img');
    img.src = 'files/02.png';
    img.alt = 'a night sky over dark hills, with coordinates in the corner';
    const save = el('a', 'plain', 'download the photograph');
    save.href = 'files/02.png';
    save.download = 'photograph.png';
    box.append(img, save);
  }
  if (kind === 'tape') {
    const audio = el('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = 'files/disc.wav';
    const save = el('a', 'plain', 'download the tape');
    save.href = 'files/disc.wav';
    save.download = 'tape.wav';
    box.append(audio, save);
  }
  if (kind === 'card') {
    const link = el('a', 'plain', 'the maintenance log, and its history');
    link.href = `${REPO}/commits/main`;
    link.target = '_blank';
    link.rel = 'noopener';
    box.append(el('p', 'note', 'on the back, in pencil:'), link);
  }
  if (kind === 'page') {
    const line = el('div', 'page-line');
    line.append(script(SCRIPT5));
    box.append(line);
  }
  box.style.display = 'grid';
  box.style.gap = '14px';
  return box;
}

function openRecord(i) {
  const dialog = el('dialog');
  const render = () => {
    const record = el('div', 'record');
    const close = el('button', 'quiet close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'put it back on the desk');
    close.addEventListener('click', () => dialog.close());
    record.append(close, el('h2', '', OBJECTS[i].label), material(i));
    if (pages[i + 1]) {
      const opened = el('div', 'opened');
      opened.append(el('p', 'note', 'the seal is broken. behind it, a page:'), storyPage(pages[i + 1]));
      record.append(opened);
    } else {
      record.append(
        answerForm(`the word that opens ${OBJECTS[i].label}`, 'the word', async (value) => {
          const page = await openLink(FILES[i].sealed, value);
          if (!page) return false;
          answers[i + 1] = value;
          pages[i + 1] = page;
          saveProgress(storage, answers);
          if (dialog.open) render();
          else route(); // closed while the seal was breaking
          return true;
        }),
      );
    }
    dialog.replaceChildren(record);
  };
  render();
  let moved = false;
  const leave = () => {
    moved = true; // the router already drew the new page
    dialog.close();
  };
  window.addEventListener('hashchange', leave);
  dialog.addEventListener('close', () => {
    window.removeEventListener('hashchange', leave);
    dialog.remove();
    if (!moved) route();
  });
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- start ----------

try {
  const saved = JSON.parse(storage?.getItem('archive-strips') ?? 'null');
  if (Array.isArray(saved) && saved.length === SHRED.strips && new Set(saved).size === SHRED.strips) arrangement = saved;
} catch {
  // keep the published order
}
const saved = loadProgress(storage);
const restored = await restore(STAGES, saved, openLink);
answers = saved.slice(0, restored.length);
pages = restored;
const ui = { el, answerForm, storyPage, script };

function route() {
  if (location.hash !== '#warden') leaveWarden(); // before the page is replaced, so the machine stays in the document
  const open = { warden: Boolean(WARDEN), lostworld: Boolean(LOSTWORLD), year: Boolean(YEAR) };
  if (location.hash === '#extras') return renderExtras(app, ui, open);
  if (location.hash === '#warden') return WARDEN ? renderWarden(app, ui, WARDEN, storage) : renderExtras(app, ui, open);
  if (location.hash === '#lostworld') return LOSTWORLD ? renderLostWorld(app, ui, LOSTWORLD, storage) : renderExtras(app, ui, open);
  if (location.hash === '#year') return YEAR ? renderYear(app, ui, YEAR, storage) : renderExtras(app, ui, open);
  return pages.length ? renderDesk() : renderGate();
}

window.addEventListener('hashchange', route);
route();
