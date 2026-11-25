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

// The Extras section: sectioned into a newcomer's guide, the hackathon challenge (WARDEN), and the
// tracks played for fun. Each track keeps its own progress.

const TRACKS = [
  {
    id: 'warden',
    title: 'WARDEN',
    line: "the keeper's machine. for those who read source.",
    level: 'hard',
    involves: 'browser developer tools, web requests, files and bytes, a little code',
    reward: 'a chat about joining my hackathon team',
  },
  {
    id: 'lostworld',
    title: 'the lost world',
    line: 'a world, rebuilt from its colours.',
    level: 'medium',
    involves: 'Minecraft knowledge, images, maps and a video',
    reward: 'a phrase to claim at the end',
  },
  {
    id: 'year',
    title: 'the year',
    line: 'four seasons, in a language nobody taught you.',
    level: 'hardest',
    involves: 'learning an invented picture language, logic and patience',
    reward: "the author's year, unsealed",
  },
];

// What an ARG is and how these tracks are played, for people who have never played one.
const NEWCOMER = [
  'an ARG (alternate reality game) is a puzzle hunt hidden in ordinary things: web pages, files, images, videos and code.',
  'nothing tells you exactly what to do. the objects on each desk are your clues. read them closely, and follow anything that looks out of place.',
  'expect to leave the page: search the web, download files, open them in other tools. that is part of the game.',
  'every object is sealed by one word. find the word, type it in, and the next object unlocks.',
  'keep notes as you go. your progress is saved in this browser, so you can stop and come back.',
  'stuck? step away, re-read everything, and look up anything you do not recognise. please do not post answers publicly.',
];

export const HACKATHON = {
  lead: 'WARDEN is how I find teammates for my hackathon team.',
  points: [
    ['what you get', 'everyone who solves WARDEN gets a chat with me about joining the team.'],
    ['how to apply', 'the last log gives you a claim phrase and tells you where to send it on Instagram. send it, and we will talk.'],
    ['what it tests', 'curiosity and persistence more than knowing everything. you will read code, poke at web requests and look at raw files. you can learn each tool as you go.'],
    ['ground rules', 'solve it yourself. look things up as much as you like, but do not share answers or the claim phrase.'],
  ],
  approach: [
    'start with the object that has the start-here tag, and read its note slowly.',
    'a web page is more than what it shows. look at everything it is made of and everything it loads.',
    'when something looks encoded or broken, it probably is on purpose. work out what it is before what it says.',
    'the console in the bottom-right corner does conversions and requests for you, so you do not need to install anything at the start. type help in it.',
  ],
};

function trackCard(el, t, live) {
  const item = el(live ? 'a' : 'div', `track${live ? '' : ' locked'}${t.id === 'warden' ? ' featured' : ''}`);
  if (live) item.href = `#${t.id}`;
  const head = el('div', 'track-head');
  head.append(el('h3', '', t.title), el('span', `level level-${t.level}`, t.level));
  item.append(head, el('p', '', live ? t.line : 'not yet. check back later.'));
  if (live) {
    const facts = el('dl', 'track-facts');
    facts.append(el('dt', '', 'involves'), el('dd', '', t.involves), el('dt', '', 'at the end'), el('dd', '', t.reward));
    item.append(facts, el('span', 'track-go', 'open the desk →'));
  }
  return item;
}

// The hackathon panel at the top of WARDEN's desk: what solving earns, how to apply, how to begin.
export function hackathonPanel(el) {
  const box = el('section', 'hackathon');
  box.setAttribute('aria-label', 'the hackathon challenge');
  box.append(el('p', 'hackathon-kicker', 'the hackathon challenge'), el('p', 'hackathon-lead', HACKATHON.lead));
  const facts = el('dl', 'hackathon-facts');
  for (const [k, v] of HACKATHON.points) facts.append(el('dt', '', k), el('dd', '', v));
  box.append(facts);
  const approach = el('details', 'hackathon-approach');
  approach.append(el('summary', '', 'never played anything like this? read this first'));
  const list = el('ul');
  for (const line of HACKATHON.approach) list.append(el('li', '', line));
  approach.append(list);
  box.append(approach);
  return box;
}

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
  const section = (title, intro, ...body) => {
    const s = el('section', 'extras-section');
    s.append(el('h2', '', title));
    if (intro) s.append(el('p', 'section-intro', intro));
    s.append(...body);
    return s;
  };
  const byId = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
  const live = (id) => Boolean(open?.[id]);

  // 1. for newcomers
  const guide = el('details', 'newcomer');
  guide.open = true;
  guide.append(el('summary', '', 'what is an ARG, and how do I play?'));
  const steps = el('ol');
  for (const line of NEWCOMER) steps.append(el('li', '', line));
  guide.append(steps);

  // 2. the hackathon challenge
  const challenge = el('div', 'tracks');
  challenge.append(trackCard(el, byId.warden, live('warden')));

  // 3. for fun
  const fun = el('div', 'tracks two');
  for (const id of ['lostworld', 'year']) fun.append(trackCard(el, byId[id], live(id)));

  const back = el('a', 'plain back', 'back to the archive');
  back.href = '#';
  const head = el('header', 'desk-head');
  head.append(el('h1', '', 'extras'), el('p', '', 'harder doors. each one stands alone, so start with any of them.'));
  app.append(
    head,
    section('new to ARGs? start here', '', guide),
    section('the hackathon challenge', HACKATHON.lead + ' solve it, and we talk about joining the team.', challenge),
    section('for fun', 'no team spot at stake here, just the story. play them in any order.', fun),
    back,
  );
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
    { title: 'WARDEN', route: '#warden', key: 'warden-progress', className: 'warden', objects: OBJECTS, data, intro: (el) => [hackathonPanel(el)], extras: (el) => [toolsCard(el, WARDEN_TOOLS), (machineHolder.append(machine), machineHolder)] },
    storage,
  );
}
