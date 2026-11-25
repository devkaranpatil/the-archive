import { openLink } from './lib/seal.js';
import { loadProgress, saveProgress, restore } from './progress.js';

export const LOCKED = 'locked. opens after the one before it.';

// Five dots under a desk's title: open, next, locked. Read out as "2 of 5 opened".
export function progressPips(el, states) {
  const list = el('ol', 'pips');
  const opened = states.filter((s) => s === 'open').length;
  list.setAttribute('aria-label', `${opened} of ${states.length} opened`);
  for (const s of states) list.append(el('li', `pip ${s}`));
  return list;
}

// A plain-language guide for first-time players. Open until the first seal breaks, then folded.
export function howToPlay(el, open) {
  const box = el('details', 'guide');
  box.open = open;
  box.append(el('summary', '', 'how this works'));
  const steps = el('ol');
  for (const step of [
    'the object with the glowing seal is the one to open next. click it.',
    'everything you need is inside: read it, play it, download it, look closely.',
    "the answer is a single word. type it into the box. capitals, spaces and punctuation don't matter.",
    'each opened object unlocks the next one. your progress is saved in this browser.',
  ])
    steps.append(el('li', '', step));
  box.append(steps);
  return box;
}

// One track's desk: five sealed objects, each opened by its answer; progress under its own key.
// Keeps WARDEN's behaviour: no redraw once the route has changed, dialogs close on route change,
// a dialog closed while its seal breaks does not reopen, and opened logs carry the 'log' class.
export async function renderTrackDesk(app, { el, answerForm, storyPage }, { title, route, key, objects, data, extras, className = '', page = null }, storage) {
  const saved = loadProgress(storage, key);
  const logs = await restore(data.logs, saved, openLink);
  const answers = saved.slice(0, logs.length);

  const draw = () => {
    if (location.hash !== route) return; // a draw that outlived its route must not overwrite the page
    app.replaceChildren();
    const head = el('header', 'desk-head');
    const states = objects.map((_, i) => (logs[i] ? 'open' : i === logs.length ? 'ready' : 'locked'));
    head.append(el('h1', '', title), el('p', '', logs.length === 5 ? 'every log is open.' : `${5 - logs.length} of five logs still sealed.`), progressPips(el, states));
    const row = el('section', `objects ${className}`);
    objects.forEach((o, i) => {
      const state = states[i];
      const button = el('button', `object ${state}`);
      button.type = 'button';
      const thing = el('div', 'thing');
      thing.append(el('div', 'chip'), el('div', 'seal'));
      if (state === 'ready') thing.append(el('span', 'badge', logs.length ? 'next' : 'start here'));
      button.append(thing, el('span', 'label', o.label), el('span', 'caption', state === 'locked' ? LOCKED : o.caption));
      if (state === 'locked') {
        button.disabled = true;
        button.setAttribute('aria-label', `${o.label}, locked until the one before it is open`);
      } else button.addEventListener('click', () => openObject(i));
      row.append(button);
    });
    const nav = el('nav', 'back-links');
    const toExtras = el('a', 'plain back', 'extras');
    toExtras.href = '#extras';
    const toArchive = el('a', 'plain back', 'back to the archive');
    toArchive.href = '#';
    nav.append(toExtras, toArchive);
    app.append(head, howToPlay(el, logs.length === 0), ...extras(el), row, nav);
  };

  const openObject = (i) => {
    const dialog = el('dialog');
    let gone = false;
    const leave = () => dialog.close(); // route changed away: put it back
    window.addEventListener('hashchange', leave, { once: true });
    const record = el('div', 'record');
    const close = el('button', 'quiet close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'put it back');
    close.addEventListener('click', () => dialog.close());
    record.append(close, el('h2', '', objects[i].label), el('p', 'note', objects[i].note(data)));
    const material = objects[i].material?.(el);
    if (material) record.append(material);
    if (logs[i]) {
      const opened = page ? page(logs[i], answers[i]) : storyPage(logs[i]); // a track may render its own reward
      opened.classList.add('log');
      record.append(opened);
    } else {
      record.append(
        answerForm(`the word that opens ${objects[i].label}`, 'the word', async (value) => {
          const text = await openLink(data.logs[i].sealed, value);
          if (!text) return false;
          answers[i] = value;
          logs[i] = text;
          saveProgress(storage, answers, key);
          if (!gone) {
            dialog.close();
            openObject(i);
          } else {
            draw(); // closed while the seal was breaking: show the opened object
          }
          return true;
        }),
      );
    }
    dialog.append(record);
    dialog.addEventListener('close', () => {
      gone = true;
      window.removeEventListener('hashchange', leave);
      dialog.remove();
      draw();
    });
    document.body.append(dialog);
    dialog.showModal();
  };

  draw();
}
