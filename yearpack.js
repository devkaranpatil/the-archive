// Reads an opened year reward. Anything malformed shows as plain text rather than breaking the desk.
export function readPack(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    return { paragraphs: [String(text)], media: [], video: '' };
  }
  const paragraphs = String(p.chapter ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const media = [];
  if (p.voice?.src) media.push({ kind: 'voice', src: p.voice.src, type: p.voice.type });
  for (const ph of p.photos ?? []) if (ph?.src) media.push({ kind: 'photo', src: ph.src, type: ph.type, caption: ph.caption ?? '' });
  if (p.fragment?.src) media.push({ kind: 'fragment', src: p.fragment.src, type: 'image/png' });
  return { paragraphs, media, video: /^https:\/\//.test(p.video ?? '') ? p.video : '' };
}
