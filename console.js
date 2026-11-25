// WARDEN's console: a small in-world terminal on WARDEN's desk. Plumbing only: requests, encodings,
// bases, xor, JWT read/sign with a secret the player supplies, and a byte view of a local file.
// It never cracks a secret or runs the CPU; the thinking stays with the player.
// The command functions are pure (no DOM) so they can be tested; mountConsole() adds the panel.

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- small helpers ----------

export function splitArgs(line) {
  const args = [];
  let cur = '';
  let quote = null;
  let any = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      any = true;
    } else if (/\s/.test(ch)) {
      if (cur || any) args.push(cur);
      cur = '';
      any = false;
    } else {
      cur += ch;
    }
  }
  if (quote) throw new Error('unclosed quote');
  if (cur || any) args.push(cur);
  return args;
}

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const toB64url = (bytes) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

export function fromHex(s) {
  const clean = s.replace(/^0x/i, '').replace(/[\s:]/g, '');
  if (!/^([0-9a-f]{2})*$/i.test(clean)) throw new Error(`not hex: ${s}`);
  return Uint8Array.from(clean.match(/../g) ?? [], (h) => parseInt(h, 16));
}

const printable = (bytes) => [...bytes].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function convertBase(value, from, to) {
  if (!(from >= 2 && from <= 36 && to >= 2 && to <= 36)) throw new Error('bases run from 2 to 36');
  const s = value.toLowerCase().replace(/^0x/, '');
  if (!s) throw new Error('nothing to convert');
  let n = 0n;
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= from) throw new Error(`"${ch}" is not a digit in base ${from}`);
    n = n * BigInt(from) + BigInt(d);
  }
  return n.toString(to);
}

export function xorBytes(data, key) {
  if (!key.length) throw new Error('the key is empty');
  return data.map((b, i) => b ^ key[i % key.length]);
}

export function hexdump(bytes, offset = 0, length = 256) {
  const lines = [];
  const end = Math.min(bytes.length, offset + length);
  for (let at = offset; at < end; at += 16) {
    const row = bytes.subarray(at, Math.min(at + 16, end));
    const hex = [...row].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47);
    lines.push(`${at.toString(16).padStart(8, '0')}  ${hex}  ${printable(row)}`);
  }
  return lines.join('\n') || '(nothing there)';
}

// Stored (uncompressed) ZIP entries, found by their local headers, so it also works on a ZIP
// that sits after other data in a file.
export function zipEntries(bytes) {
  const buf = bytes;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = [];
  for (let p = 0; p + 30 <= buf.length; p++) {
    if (view.getUint32(p, true) !== 0x04034b50) continue;
    const method = view.getUint16(p + 8, true);
    const size = view.getUint32(p + 18, true);
    const nameLength = view.getUint16(p + 26, true);
    const extra = view.getUint16(p + 28, true);
    const name = dec.decode(buf.subarray(p + 30, p + 30 + nameLength));
    const start = p + 30 + nameLength + extra;
    out.push({ name, method, size, data: buf.subarray(start, start + size) });
    p = start + size - 1;
  }
  return out;
}

const parseOffset = (s, label) => {
  const n = /^0x/i.test(s) ? parseInt(s, 16) : parseInt(s, 10);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a number (decimal, or hex with 0x)`);
  return n;
};

export function parseReq(args) {
  const opts = { method: 'GET', headers: {}, include: false, url: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-X') opts.method = (args[++i] ?? '').toUpperCase();
    else if (a === '-A') opts.headers['X-Warden-Agent'] = args[++i] ?? '';
    else if (a === '-H') {
      const h = args[++i] ?? '';
      const at = h.indexOf(':');
      if (at < 1) throw new Error(`a header looks like "Name: value", not "${h}"`);
      opts.headers[h.slice(0, at).trim()] = h.slice(at + 1).trim();
    } else if (a === '-i') opts.include = true;
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else opts.url = a;
  }
  if (!opts.url) throw new Error('usage: req [-X METHOD] [-A agent] [-H "Name: value"] [-i] <url>');
  if (!/^https:\/\//.test(opts.url)) throw new Error('the console only speaks https');
  if (!opts.method) throw new Error('-X needs a method');
  return opts;
}

async function hs256(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export async function jwtSign(payloadJson, secret) {
  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    throw new Error('the payload must be JSON, in quotes, e.g. \'{"access":"read"}\'');
  }
  const head = toB64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toB64url(enc.encode(JSON.stringify(payload)));
  return `${head}.${body}.${await hs256(secret, `${head}.${body}`)}`;
}

export function jwtDecode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('a JWT has three parts separated by dots');
  const [head, body] = parts.slice(0, 2).map((p) => JSON.parse(dec.decode(fromB64(p))));
  return `header:  ${JSON.stringify(head)}\npayload: ${JSON.stringify(body)}\nsignature: ${parts[2]}`;
}

export const HELP = `WARDEN console. commands:
  req [-X METHOD] [-A agent] [-H "Name: value"] [-i] <url>   send a request (-i shows headers)
  b64 enc|dec <text>        base64
  hex enc|dec <text>        hex
  num <n> [from] [to]       convert between bases (default 10 -> 16; 0x.. means 16 -> 10)
  xor <hex> <hexkey>        xor bytes; the key repeats
  jwt decode <token>        read a token
  jwt sign '<json>' <secret>  sign a token (HS256) with a secret you give it
  open                      load a file from your device
  hexdump [offset] [length] view the loaded file's bytes
  insert <offset> <hex>     insert bytes into the loaded file
  xorfile <hexkey> [offset] [length]  xor a stretch of the loaded file in place
  unzip [name]              list stored zip entries in the loaded file, or load one
  save [name]               download the loaded file
  clear                     clear the screen`;

const COMMANDS = ['help', 'req', 'b64', 'hex', 'num', 'xor', 'jwt', 'open', 'hexdump', 'insert', 'xorfile', 'unzip', 'save', 'clear'];

// Levenshtein distance, small and plain: commands are a few letters long.
function distance(a, b) {
  let prev = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

// The closest known command to a typo, or null when nothing is close (within two edits).
export function nearestCommand(word) {
  const w = String(word).toLowerCase();
  let best = null;
  let bestD = 3;
  for (const c of COMMANDS) {
    const d = distance(w, c);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

// Runs one line. `state` holds { file: Uint8Array|null, name: string }. `io` supplies the parts that
// touch the outside: fetch, pickFile, download. Resolves to the text to print.
export async function runCommand(line, state, io) {
  const args = splitArgs(line.trim());
  const [cmd, ...rest] = args;
  const need = (n, usage) => {
    if (rest.length < n) throw new Error(`usage: ${usage}`);
  };
  const needFile = () => {
    if (!state.file) throw new Error('no file loaded. use open first.');
  };
  switch (cmd) {
    case undefined:
      return '';
    case 'help':
      return HELP;
    case 'b64':
      need(2, 'b64 enc|dec <text>');
      if (rest[0] === 'enc') return toB64(enc.encode(rest.slice(1).join(' ')));
      if (rest[0] === 'dec') return dec.decode(fromB64(rest[1]));
      throw new Error('usage: b64 enc|dec <text>');
    case 'hex':
      need(2, 'hex enc|dec <text>');
      if (rest[0] === 'enc') return toHex(enc.encode(rest.slice(1).join(' ')));
      if (rest[0] === 'dec') return dec.decode(fromHex(rest.slice(1).join('')));
      throw new Error('usage: hex enc|dec <text>');
    case 'num': {
      need(1, 'num <n> [from] [to]');
      const hexIn = /^0x/i.test(rest[0]);
      const from = Number(rest[1] ?? (hexIn ? 16 : 10));
      const to = Number(rest[2] ?? (hexIn ? 10 : 16));
      return convertBase(rest[0], from, to);
    }
    case 'xor': {
      need(2, 'xor <hex> <hexkey>');
      const out = xorBytes(fromHex(rest[0]), fromHex(rest[1]));
      return `${toHex(out)}\n${printable(out)}`;
    }
    case 'jwt':
      need(2, "jwt decode <token> | jwt sign '<json>' <secret>");
      if (rest[0] === 'decode') return jwtDecode(rest[1]);
      if (rest[0] === 'sign') {
        need(3, "jwt sign '<json>' <secret>");
        return jwtSign(rest[1], rest[2]);
      }
      throw new Error("usage: jwt decode <token> | jwt sign '<json>' <secret>");
    case 'req': {
      const o = parseReq(rest);
      let res;
      try {
        res = await io.fetch(o.url, { method: o.method, headers: o.headers });
      } catch {
        return `the line is dead. nothing answered at ${o.url}`;
      }
      const lines = [`HTTP ${res.status}`];
      if (o.include) for (const [k, v] of res.headers) lines.push(`${k}: ${v}`);
      const body = await res.text();
      return `${lines.join('\n')}\n\n${body}`.trimEnd();
    }
    case 'open': {
      const picked = await io.pickFile();
      if (!picked) return 'nothing opened.';
      state.file = picked.bytes;
      state.name = picked.name;
      return `opened ${picked.name}: ${picked.bytes.length} bytes`;
    }
    case 'hexdump':
      needFile();
      return hexdump(state.file, rest[0] ? parseOffset(rest[0], 'offset') : 0, rest[1] ? parseOffset(rest[1], 'length') : 256);
    case 'insert': {
      needFile();
      need(2, 'insert <offset> <hex>');
      const at = parseOffset(rest[0], 'offset');
      if (at > state.file.length) throw new Error('offset is past the end of the file');
      const bytes = fromHex(rest[1]);
      const next = new Uint8Array(state.file.length + bytes.length);
      next.set(state.file.subarray(0, at));
      next.set(bytes, at);
      next.set(state.file.subarray(at), at + bytes.length);
      state.file = next;
      return `inserted ${bytes.length} byte(s) at ${at}. file is now ${next.length} bytes.`;
    }
    case 'xorfile': {
      needFile();
      need(1, 'xorfile <hexkey> [offset] [length]');
      const key = fromHex(rest[0]);
      const at = rest[1] ? parseOffset(rest[1], 'offset') : 0;
      const len = rest[2] ? parseOffset(rest[2], 'length') : state.file.length - at;
      const next = Uint8Array.from(state.file);
      next.set(xorBytes(next.subarray(at, at + len), key), at);
      state.file = next;
      return `xored ${Math.min(len, next.length - at)} byte(s) from ${at}.`;
    }
    case 'unzip': {
      needFile();
      const entries = zipEntries(state.file);
      if (!entries.length) return 'no zip entries found in this file.';
      if (!rest[0]) return entries.map((e) => `${e.name}  ${e.size} bytes${e.method ? '  (compressed: not supported here)' : ''}`).join('\n');
      const e = entries.find((x) => x.name === rest[0]);
      if (!e) throw new Error(`no entry named ${rest[0]}`);
      if (e.method) throw new Error('that entry is compressed; the console only reads stored entries');
      state.file = Uint8Array.from(e.data);
      state.name = e.name;
      return `loaded ${e.name}: ${e.size} bytes`;
    }
    case 'save':
      needFile();
      io.download(state.file, rest[0] ?? state.name ?? 'file.bin');
      return `saved ${rest[0] ?? state.name ?? 'file.bin'}`;
    default: {
      const near = nearestCommand(cmd);
      throw new Error(`unknown command: ${cmd}.${near ? ` did you mean ${near}?` : ''} type help to see every command`);
    }
  }
}

// ---------- the panel ----------

// onMinimize, when given, adds a minimize button to the title bar (and Escape does the same).
export function mountConsole(el, { onMinimize } = {}) {
  const state = { file: null, name: '' };
  const panel = el('section', 'console');
  panel.setAttribute('aria-label', "WARDEN's console");
  const screen = el('pre', 'console-out');
  screen.setAttribute('aria-live', 'polite');
  const form = el('form', 'console-line');
  const prompt = el('span', 'console-prompt', 'warden>');
  const input = el('input');
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'console command');
  input.placeholder = 'type a command, then press Enter';
  form.append(prompt, input);
  // One-click starters for people who have never used a terminal.
  const quick = el('div', 'console-quick');
  for (const [label, line] of [['help', 'help'], ['example: base64', 'b64 dec V0FSREVO'], ['open a file', 'open'], ['clear', 'clear']]) {
    const b = el('button', 'console-chip', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      input.value = line;
      form.requestSubmit();
    });
    quick.append(b);
  }
  const title = el('div', 'console-title');
  title.append(el('span', '', "the keeper's console"));
  if (onMinimize) {
    const min = el('button', 'console-min', '_');
    min.type = 'button';
    min.title = 'minimize';
    min.setAttribute('aria-label', 'minimize the console');
    min.addEventListener('click', onMinimize);
    title.append(min);
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') onMinimize();
    });
  }
  panel.append(title, screen, quick, form);

  const history = [];
  let back = 0;
  const print = (text) => {
    screen.textContent += `${text}\n`;
    screen.scrollTop = screen.scrollHeight;
  };
  print('WARDEN console 0.9.\ntype a command below and press Enter. new here? type help, or tap a button.\n↑ and ↓ bring back earlier commands. Esc folds the console away.');

  const io = {
    fetch: (url, init) => fetch(url, { ...init, mode: 'cors' }),
    pickFile: () =>
      new Promise((resolve) => {
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.addEventListener('change', async () => {
          const file = picker.files?.[0];
          resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
        });
        picker.click();
      }),
    download: (bytes, name) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes]));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const line = input.value;
    input.value = '';
    if (line.trim()) history.push(line);
    back = 0;
    print(`warden> ${line}`);
    if (line.trim() === 'clear') {
      screen.textContent = '';
      return;
    }
    input.disabled = true;
    try {
      const out = await runCommand(line, state, io);
      if (out) print(out);
    } catch (error) {
      print(`! ${error.message}`);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      back = Math.min(back + 1, history.length);
      input.value = history[history.length - back];
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      back = Math.max(back - 1, 0);
      input.value = back ? history[history.length - back] : '';
      event.preventDefault();
    }
  });
  return panel;
}
