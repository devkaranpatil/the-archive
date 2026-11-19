import { normalise } from './text.js';

const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(answer, salt) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(normalise(answer)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// `fixed` makes a seal repeatable (for a block uploaded once, like chapter 5's paste).
export async function sealLink(url, answer, fixed = {}) {
  const salt = fixed.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = fixed.iv ?? crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(answer, salt), encoder.encode(url));
  return { salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct) };
}

export async function openLink(sealed, answer) {
  if (!normalise(answer)) return null;
  try {
    const key = await keyFrom(answer, fromBase64(sealed.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.ct));
    return decoder.decode(plain);
  } catch {
    return null; // wrong answer: AES-GCM authentication failed
  }
}
