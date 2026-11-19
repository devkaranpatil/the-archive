import { openLink } from './lib/seal.js';
import { loadProgress, saveProgress, restore } from './progress.js';

// One track's desk: five sealed objects, each opened by its answer; progress under its own key.
// Keeps WARDEN's behaviour: no redraw once the route has changed, dialogs close on route change,
// a dialog closed while its seal breaks does not reopen, and opened logs carry the 'log' class.
export async function renderTrackDesk(app, { el, answerForm, storyPage }, { title, route, key, objects, data, extras, className = '' }, storage) {
  const saved = loadProgress(storage, key);
  const logs = await restore(data.logs, saved, openLink);
  const answers = saved.slice(0, logs.length);

  const draw = () => {
    if (location.hash !== route) return; // a draw that outlived its route must not overwrite the page
    app.replaceChildren();
    const head = el('header', 'desk-head');
    head.append(el('h1', '', title), el('p', '', logs.length === 5 ? 'every log is open.' : `${5 - logs.length} of five logs still sealed.`));
    const row = el('section', `objects ${className}`);
    objects.forEach((o, i) => {
      const state = logs[i] ? 'open' : i === logs.length ? 'ready' : 'locked';
      const button = el('button', `object ${state}`);
      button.type = 'button';
      const thing = el('div', 'thing');
      thing.append(el('div', 'chip'), el('div', 'seal'));
      button.append(thing, el('span', 'label', o.label), el('span', 'caption', state === 'locked' ? '' : o.caption));
      if (state === 'locked') button.disabled = true;
      else button.addEventListener('click', () => openObject(i));
      row.append(button);
    });
    const nav = el('nav', 'back-links');
    const toExtras = el('a', 'plain back', 'extras');
    toExtras.href = '#extras';
    const toArchive = el('a', 'plain back', 'back to the archive');
    toArchive.href = '#';
    nav.append(toExtras, toArchive);
    app.append(head, ...extras(el), row, nav);
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
      const page = storyPage(logs[i]);
      page.classList.add('log');
      record.append(page);
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
