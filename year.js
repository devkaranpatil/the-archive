import { renderTrackDesk } from './trackdesk.js';
import { toolsCard } from './extras.js';
import { openBytes } from './lib/seal.js';
import { readPack } from './yearpack.js';

const TOOLS = ['a printer, or a screen you can draw on', 'pens, paper and scissors', 'everyone you trust to think with', 'time: nothing here can be looked up'];
const BRASS = "carrying a brass key? send its code and the puzzle you're stuck on to the keeper on instagram. each key buys one hint.";
const OBJECTS = [
  { label: 'winter', caption: 'twelve drawings, one line each.', note: 'the last line has no drawing.' },
  { label: 'spring', caption: "a week in someone's diary.", note: 'everyone went somewhere. not everyone says where.' },
  { label: 'summer', caption: 'a town map, and some directions.', note: 'walk them. watch what your pen draws.' },
  { label: 'autumn', caption: 'a page, torn into strips.', note: 'print it. cut it. put it back.' },
  { label: 'the year', caption: 'four lines nobody can read.', note: 'one came with each season.' },
];

function picture(el, src, alt) {
  const a = el('a', 'year-sheet');
  a.href = src; // full size, for printing
  a.target = '_blank';
  a.rel = 'noopener';
  const i = el('img');
  i.src = src;
  i.alt = alt;
  a.append(i);
  return a;
}

function material(el, season) {
  const box = el('div', 'year-material');
  for (const p of season.panels ?? []) {
    const f = el('figure', 'year-panel');
    f.append(picture(el, p.scene, 'a drawn scene'), picture(el, p.line, 'a line of symbols'));
    box.append(f);
  }
  for (const src of season.images) box.append(picture(el, src, 'a printable sheet'));
  box.append(el('p', 'year-bank', season.bank.join(' · ')));
  return box;
}

async function reveal(el, slot, m, answer) {
  try {
    const res = await fetch(m.src);
    const bytes = await openBytes(await res.arrayBuffer(), answer);
    if (!bytes) throw new Error('sealed');
    const url = URL.createObjectURL(new Blob([bytes], { type: m.type }));
    if (m.kind === 'voice') {
      const audio = el('audio');
      audio.controls = true;
      audio.src = url;
      slot.append(audio);
      return;
    }
    const fig = el('figure');
    const img = el('img');
    img.src = url;
    img.alt = m.caption || 'a line nobody can read yet';
    fig.append(img);
    if (m.caption) fig.append(el('figcaption', '', m.caption));
    slot.append(fig);
  } catch {
    slot.append(el('p', 'note', 'this part would not open.'));
  }
}

export function yearPage(el, text, answer) {
  const pack = readPack(text);
  const page = el('article', 'page year-reward');
  for (const p of pack.paragraphs) page.append(el('p', '', p));
  if (pack.video) {
    const a = el('a', 'plain', 'the year, on film');
    a.href = pack.video;
    a.target = '_blank';
    a.rel = 'noopener';
    page.append(a);
  }
  for (const m of pack.media) {
    const slot = el('div', `year-${m.kind}`);
    page.append(slot);
    reveal(el, slot, m, answer); // each file decrypts on its own; the text shows at once
  }
  return page;
}

export function renderYear(app, ui, data, storage) {
  const { el } = ui;
  const objects = OBJECTS.map((o, i) => ({
    label: o.label,
    caption: o.caption,
    note: () => o.note,
    material: () => material(el, i < 4 ? data.seasons[i] : data.finale),
  }));
  return renderTrackDesk(
    app,
    ui,
    {
      title: 'the year',
      route: '#year',
      key: 'year-progress',
      className: 'year',
      objects,
      data,
      page: (text, answer) => yearPage(el, text, answer),
      extras: (e) => [toolsCard(e, TOOLS), e('p', 'note year-brass', BRASS)],
    },
    storage,
  );
}
