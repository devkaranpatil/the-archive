const KEY = 'archive-progress';

export function loadProgress(storage, key = KEY) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return Array.isArray(value) && value.every((x) => typeof x === 'string') ? value : [];
  } catch {
    return []; // storage blocked, missing or corrupt: start locked
  }
}

export function saveProgress(storage, answers, key = KEY) {
  try {
    storage.setItem(key, JSON.stringify(answers));
  } catch {
    // storage blocked: progress lasts for this visit only
  }
}

// Pages for the leading run of saved answers that still open. A rebuild with new answers ends the run.
export async function restore(files, answers, open) {
  const opened = [];
  for (let i = 0; i < files.length && i < answers.length; i++) {
    const url = await open(files[i].sealed, answers[i]);
    if (!url) break;
    opened.push(url);
  }
  return opened;
}
