import { renderTrackDesk } from './trackdesk.js';
import { toolsCard } from './extras.js';

const TOOLS = ['minecraft java 1.21', 'the minecraft wiki', 'a colour picker', 'a tuner app, or a good ear', 'paper and patience'];

// A link the author has not published yet shows as plain text, never a dead anchor.
const link = (el, href, text) => {
  if (!href) return el('span', 'lw-closed', `${text}: not yet open`);
  const a = el('a', 'plain', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
};

const img = (el, src, alt) => {
  const i = el('img');
  i.src = src;
  i.alt = alt;
  return i;
};

export function renderLostWorld(app, ui, data, storage) {
  const { el, script } = ui;
  const links = data.links ?? {};
  const box = (...nodes) => {
    const b = el('div', 'lw-material');
    b.append(...nodes.filter(Boolean));
    return b;
  };
  const objects = [
    {
      label: 'a torn banner', caption: "the server's flag.", note: () => 'someone dyed their tunic to match it, one layer at a time.',
      material: () => box(img(el, 'files/lw/banner.png', 'a torn banner of coloured stripes'), link(el, links.paste, 'the server log')),
    },
    {
      label: 'a brewing stand', caption: 'a cracked bottle beside it.', note: () => 'the brewer kept a book. one page was torn out.',
      material: () => {
        const page = el('div', 'lw-torn');
        page.style.color = data.torn.color;
        page.append(script(data.torn.words));
        return box(link(el, links.doc, "brewer's book"), page);
      },
    },
    {
      label: 'a faded map', caption: 'a music disc tucked behind it.', note: () => 'the disc is labelled track 3.',
      material: () => box(img(el, 'files/lw/map.png', 'a faded map with a row of coloured squares'), link(el, links.video, 'track 3')),
    },
    {
      label: 'a redstone notebook', caption: 'west and north of spawn.', note: () => 'six pages. the lamps are drawn unlit.',
      material: () => box(...data.notebook.map((src, i) => img(el, src, `notebook page ${i + 1}`))),
    },
    {
      label: 'a firework star', caption: 'it has not been fired.', note: () => 'the label is in runes. five letters are missing.',
      material: () => {
        const label = el('p', 'lw-star');
        data.star.runes.forEach((r, at) => {
          const gap = data.star.gaps.find((g) => g.at === at);
          if (!gap) {
            label.append(el('span', 'glyph', r));
            return;
          }
          const g = el('span', gap.fade ? 'lw-gap fade' : 'lw-gap', String(gap.pos));
          if (gap.color) g.style.background = gap.color;
          label.append(g);
        });
        return box(label, link(el, links.tour, 'world tour'));
      },
    },
  ];
  return renderTrackDesk(app, ui, { title: 'the lost world', route: '#lostworld', key: 'lostworld-progress', className: 'lostworld', objects, data, extras: (e) => [toolsCard(e, TOOLS)] }, storage);
}
