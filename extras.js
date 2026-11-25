import { renderTrackDesk } from './trackdesk.js';
import { mountConsole } from './console.js';

// A quiet card at the start of a track: the kinds of tools it asks for, never which step uses which.
export function toolsCard(el, items) {
  const card = el('details', 'tools');
  card.append(el('summary', '', "what you'll need"));
  const list = el('ul');
  for (const item of items) list.append(el('li', '', item));
  card.append(list);
  return card;
}

const WARDEN_TOOLS = [
  'a desktop browser and its developer tools',
  "a terminal, or the keeper's console (bottom right)",
  'something that shows raw bytes',
  'a video player you can step frame by frame',
  'enough code to build a small machine, in any language',
];

// The Extras section: a list of tracks, and WARDEN's desk. Each track keeps its own progress.

const TRACKS = [
  { id: 'warden', title: 'WARDEN', line: "the keeper's machine. for those who read source." },
  { id: 'lostworld', title: 'the lost world', line: 'a world, rebuilt from its colours.' },
  { id: 'year', title: 'the year', line: 'four seasons, in a language nobody taught you.' },
];

const OBJECTS = [
  { label: 'a floppy disk', caption: 'WARDEN 0.9. do not run.', note: () => 'the disk holds one program. it is already running.' },
  { label: 'a rack key', caption: 'a paper tag on a ring.', note: (d) => `the tag reads: ${d.api}/status` },
  { label: 'a memory card', caption: 'v0.9.1. it never loaded.', note: () => 'the last release. it came back from the mirror wrong.' },
  { label: 'a circuit board', caption: 'eight ways to think.', note: () => 'hand-soldered. one chip, no markings.' },
  { label: 'a tape reel', caption: 'the end of it is missing.', note: () => 'someone cut the last few feet off the reel.' },
];

const machine = document.createElement('div');
machine.id = 'warden-machine';
machine.className = 'warden-machine';
let started = false;
let panel = null; // the console keeps its screen and loaded file across redraws
let dock = null;
let launcher = null;

// The console lives in a dock fixed to the bottom-right corner: an icon that opens the terminal
// window, and a minimize button that folds it back. Shown only on WARDEN's desk.
function setConsoleOpen(open) {
  dock.classList.toggle('open', open);
  launcher.setAttribute('aria-expanded', String(open));
  if (open) panel.querySelector('input')?.focus();
  else launcher.focus();
}

function showDock(el) {
  if (!dock) {
    panel = mountConsole(el, { onMinimize: () => setConsoleOpen(false) });
    launcher = el('button', 'console-launcher', '>_');
    launcher.type = 'button';
    launcher.title = "the keeper's console";
    launcher.setAttribute('aria-label', "open the keeper's console");
    launcher.setAttribute('aria-expanded', 'false');
    launcher.addEventListener('click', () => setConsoleOpen(true));
    dock = el('div', 'console-dock');
    dock.append(panel, launcher);
    document.body.append(dock);
  }
  dock.hidden = false;
}
let holder = null;

// The machine script looks for #warden-machine when it finishes loading, which may be after the
// player has left #warden. Keep the element in the document, hidden, whenever it is not on the desk.
function parkMachine() {
  if (!holder) {
    holder = document.createElement('div');
    holder.style.display = 'none';
  }
  if (!holder.isConnected) document.body.append(holder);
  if (machine.parentNode !== holder) holder.append(machine);
}

export function leaveWarden() {
  if (dock) dock.hidden = true;
  if (started) parkMachine();
}

function startMachine() {
  if (started) return;
  started = true;
  parkMachine();
  const s = document.createElement('script');
  s.src = 'build/warden.min.js';
  document.body.append(s);
}

export function renderExtras(app, { el }, open) {
  app.replaceChildren();
  const list = el('section', 'tracks');
  for (const t of TRACKS) {
    const live = Boolean(open?.[t.id]);
    const item = el(live ? 'a' : 'div', live ? 'track' : 'track locked');
    if (live) item.href = `#${t.id}`;
    item.append(el('h2', '', t.title), el('p', '', live ? t.line : 'not yet.'));
    list.append(item);
  }
  const back = el('a', 'plain back', 'back to the archive');
  back.href = '#';
  app.append(el('h1', '', 'extras'), el('p', 'note', 'harder doors. each one stands alone.'), list, back);
}

export function renderWarden(app, ui, data, storage) {
  showDock(ui.el);
  startMachine();
  // WARDEN's status light: the machine script fills #warden-machine with a cursor and a heartbeat dot.
  const machineHolder = ui.el('div', 'warden-status');
  machineHolder.title = 'WARDEN is running on this page';
  machineHolder.append(ui.el('span', 'warden-status-label', 'WARDEN'));
  return renderTrackDesk(
    app,
    ui,
    { title: 'WARDEN', route: '#warden', key: 'warden-progress', className: 'warden', objects: OBJECTS, data, extras: (el) => [toolsCard(el, WARDEN_TOOLS), (machineHolder.append(machine), machineHolder)] },
    storage,
  );
}
