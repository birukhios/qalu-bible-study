'use strict';

// ---------- small helpers ----------
const root = document.getElementById('app');
const fileInput = document.getElementById('file');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ls = {
  get(key, fallback) {
    try { const v = localStorage.getItem('qalu.' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('qalu.' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable: keep going in memory */ }
  }
};

// IndexedDB holds what is too big for localStorage: imported Bibles and voice recordings.
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('qalu', 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('bibles', { keyPath: 'id' }); req.result.createObjectStore('audio'); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const idb = (store, mode, fn) => dbReady.then((db) => new Promise((resolve, reject) => {
  const tx = db.transaction(store, mode);
  const req = fn(tx.objectStore(store));
  tx.oncomplete = () => resolve(req && req.result);
  tx.onerror = () => reject(tx.error);
}));

// ---------- state ----------
const DEFAULT_PASS = { b: 41, c: 15, f: 11, to: 32, title: ['የጠፋው ልጅ', 'The Prodigal Son'] };
const S = {
  en: ls.get('en', false),
  dark: ls.get('dark', true),
  screen: ls.get('screen', 'browse'),
  browse: ls.get('browse', 'timeline'),
  pass: ls.get('pass', DEFAULT_PASS),
  sel: ls.get('sel', null),
  tab: ls.get('tab', 'fathers'),
  split: ls.get('split', true),
  layout: ls.get('layout', 'stack'),
  focus: false,
  size: ls.get('size', 1),
  primary: ls.get('primary', ''),
  secondary: ls.get('secondary', 'kjv'),
  highlights: ls.get('highlights', {}),
  notes: ls.get('notes', []),
  draft: '',
  more: 8,
  picker: false,
  intro: false,
  place: ls.get('place', 0),
  theme: null, // the concept whose detail is open
  tiles: ls.get('tiles', false), // show the present-day map tiles in place of the illustrated map
  recording: false,
  msg: '',
  game: ls.get('game', { xp: 0, streak: 0, last: '', done: {} }), // done: story number -> stars earned (1 to 3)
  play: null, // the story lesson in progress on the Journey screen
  jump: true,
  openBook: ls.get('openBook', null), // the book whose chapter list is open on the Bible screen
  q: ls.get('q', ''),                // the search box
  qv: ls.get('qv', ''),              // the version being searched
  searchOn: ls.get('searchOn', false),
  results: null,                     // verses found by the last search
  searchNote: '',
  shown: 60,
  scrolls: ls.get('scrolls', {}),    // where each screen was scrolled to
  goVerse: null,                     // a verse to bring into view once its chapter is on screen
  user: ls.get('user', null), // { name, email, picture, sub } from Google sign-in
  guest: ls.get('guest', false) // chose to use the app without signing in
};
let C = null; // stories, book names and study content
// The interactive map is created once and moved into place on each render, so it keeps its zoom.
let lmap = null, lmarkers = [], mapEl = null, ltiles = null, lart = null;
const versions = {
  amulb: { id: 'amulb', name: 'አማርኛ ULB (Unlocked Literal Bible)', language: 'am', dir: 'data/amulb', books: {},
    credit: 'Amharic Unlocked Literal Bible. Original work available at https://door43.org/. Licensed CC BY-SA 4.0.' },
  web: { id: 'web', name: 'World English Bible', language: 'en', dir: 'data/web', books: {} },
  kjv: { id: 'kjv', name: 'King James Version', language: 'en', dir: 'data/kjv', books: {} },
  asv: { id: 'asv', name: 'American Standard Version', language: 'en', dir: 'data/asv', books: {} },
  ylt: { id: 'ylt', name: 'Young’s Literal Translation', language: 'en', dir: 'data/ylt', books: {} },
  bbe: { id: 'bbe', name: 'Bible in Basic English', language: 'en', dir: 'data/bbe', books: {} }
};
// Church fathers' commentary, one file per chapter, listed in an index so missing chapters are not requested.
const F = { index: {}, cache: {}, pending: {} };
// Book introductions and chapter notes for the Context tab, one file per book.
const X = { cache: {}, pending: {} };
let opens = []; // passages that tiles on the current screen open
let vids = []; // videos that links on the current screen open in the video window
let recorder = null;

const t = (am, en) => (S.en ? en : am);
const tp = (pair) => (S.en ? pair[1] : pair[0]);
const bookName = (i) => tp(C.books[i].n);
const hasAmharic = () => Object.values(versions).some((v) => v.language === 'am');

function save(...keys) { keys.forEach((k) => ls.set(k, S[k])); }

function pickVersions() {
  const ids = Object.keys(versions);
  if (!versions[S.primary]) S.primary = (Object.values(versions).find((v) => v.language === 'am') || versions.web).id;
  if (!versions[S.secondary] || S.secondary === S.primary) S.secondary = ids.find((id) => id !== S.primary) || S.primary;
}

// Bundled versions are stored one file per book, so only the book being read is downloaded.
function loadBook(id, b) {
  const v = versions[id];
  v.pending = v.pending || {};
  v.failed = v.failed || {};
  if (v.pending[b]) return;
  v.pending[b] = true;
  fetch(v.dir + '/' + b + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((chapters) => { v.books[b] = chapters; delete v.failed[b]; })
    .catch(() => { v.failed[b] = true; })
    .then(() => { v.pending[b] = false; render(); });
}

// Returns { state: 'ok' | 'loading' | 'error', verses: [] } for the current chapter in one version.
function chapter(id) {
  const v = versions[id];
  if (!v) return { state: 'error', verses: [] };
  const b = S.pass.b;
  if (v.dir && !v.books[b]) {
    if (v.failed && v.failed[b] && !v.pending[b]) return { state: 'error', verses: [] };
    loadBook(id, b);
    return { state: 'loading', verses: [] };
  }
  return { state: 'ok', verses: (v.books[b] || [])[S.pass.c - 1] || [] };
}

// Returns { state, list } with the fathers' comments on the current chapter.
function fathers() {
  const b = S.pass.b, c = S.pass.c, key = b + '/' + c;
  if (!(F.index[b] || []).includes(c)) return { state: 'ok', list: [] };
  if (F.cache[key]) return { state: 'ok', list: F.cache[key] };
  if (!F.pending[key]) {
    F.pending[key] = true;
    fetch('data/fathers/' + key + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((list) => { F.cache[key] = list; })
      .catch(() => { F.cache[key] = []; })
      .then(() => { F.pending[key] = false; render(); });
  }
  return { state: 'loading', list: [] };
}

// Returns the book's background file ({ intro, chapters }) or null while it loads.
function background() {
  const b = S.pass.b;
  if (X.cache[b]) return X.cache[b];
  if (!X.pending[b]) {
    X.pending[b] = true;
    fetch('data/context/' + b + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { X.cache[b] = d; })
      .catch(() => { X.cache[b] = { intro: '', chapters: {} }; })
      .then(() => { X.pending[b] = false; render(); });
  }
  return null;
}

// A small Markdown renderer for the notes: headings, lists, paragraphs, bold and italic.
function md(text) {
  const inline = (x) => esc(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
  return text.split('\n').map((line) => {
    if (!line.trim()) return '';
    let m = /^(#{2,4})\s+(.*)$/.exec(line);
    if (m) return m[1].length === 2 ? `<h3>${inline(m[2])}</h3>` : `<h4>${inline(m[2])}</h4>`;
    m = /^(\s*)(\d+\.|[*-])\s+(.*)$/.exec(line);
    if (m) return `<p class="li" style="margin-left:${Math.min(3, Math.floor(m[1].length / 2)) * 16}px">${/\d/.test(m[2]) ? m[2] : '•'} ${inline(m[3])}</p>`;
    return `<p>${inline(line)}</p>`;
  }).join('');
}

function passRef(p) {
  const base = bookName(p.b) + ' ' + p.c;
  const sep = t('፥', ':');
  if (p.to) return base + sep + (p.f || 1) + '–' + p.to;
  if (p.f > 1) return base + sep + p.f + '–';
  return base;
}
const passTitle = (p) => (p.title ? tp(p.title) : bookName(p.b) + ' ' + p.c);
const study = () => C.study.find((s) => s.b === S.pass.b && s.c === S.pass.c);
const hlKey = (n) => S.pass.b + '.' + S.pass.c + '.' + n;

function notePlace(n) {
  const parts = [bookName(n.b) + ' ' + n.c];
  if (n.v) parts.push(t('ቁ. ' + n.v, 'v. ' + n.v));
  parts.push(n.audio ? t('የድምፅ ማስታወሻ', 'Voice note') : t('ማስታወሻ', 'Note'));
  return parts.join(' · ');
}
const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

// ---------- icons ----------
const ICONS = {
  logo: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M12 7v7M9 10h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  book: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/>',
  focus: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  exit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const icon = (name, size = 18) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ---------- views ----------
// ---------- sign-in ----------
// "Sign in with Google" runs entirely in the browser: Google returns a signed ID token and the app reads
// the name, email and picture from it. This greets the reader and labels the session; it does not protect
// anything, because the site and its data are public.
const CLIENT_ID = (window.QALU_CONFIG || {}).googleClientId || '';
let gsiState = '';      // '', 'loading', 'ready' or 'failed'

function onCredential(response) {
  try {
    const part = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(part), (ch) => ch.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    S.user = { name: data.name || data.email || '', email: data.email || '', picture: data.picture || '', sub: data.sub || '' };
    S.guest = false;
    save('user', 'guest');
  } catch (e) {
    S.msg = t('መግባት አልተቻለም። እንደገና ይሞክሩ።', 'Sign-in did not work. Please try again.');
  }
  render();
}

function mountGoogleButton() {
  const slot = document.getElementById('gbtn');
  if (!slot || !CLIENT_ID) return;
  const draw = () => {
    if (!document.getElementById('gbtn')) return;
    if (!mountGoogleButton.started) {
      google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true });
      mountGoogleButton.started = true;
    }
    google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: S.dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: S.en ? 'en' : 'am', width: 280 });
  };
  if (gsiState === 'ready') { draw(); return; }
  if (gsiState === 'loading') return;
  gsiState = 'loading';
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => { gsiState = 'ready'; draw(); };
  script.onerror = () => { gsiState = 'failed'; render(); };
  document.head.appendChild(script);
}

function loginView() {
  let google;
  if (!CLIENT_ID) google = `<p class="muted small">${t('በGoogle መግባት ገና አልተዘጋጀም።', 'Google sign-in has not been set up yet.')}</p>`;
  else if (gsiState === 'failed') google = `<p class="small" role="alert">${t('የGoogle መግቢያን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱ።', 'Google sign-in could not be loaded. Check your connection.')}</p>`;
  else google = `<div id="gbtn" class="gbtn" aria-label="${t('በGoogle ይግቡ', 'Sign in with Google')}"></div>`;
  return `<main class="login"><div class="card stack logincard">
<div class="brand" style="padding:0;font-size:26px">${icon('logo', 38)}<span>ቃሉ</span></div>
<h1>${t('እንኳን ደህና መጡ', 'Welcome')}</h1>
<p class="muted">${t('መጽሐፍ ቅዱስን ከቀደሙት አባቶች ጋር ያጥኑ። ለመጀመር ይግቡ ወይም አዲስ መለያ ይፍጠሩ፤ ሁለቱም በGoogle መለያዎ ነው።', 'Study the Bible alongside the early church fathers. Sign in or sign up to begin; both use your Google account.')}</p>
${google}
${S.msg ? `<p class="small" role="alert">${esc(S.msg)}</p>` : ''}
<button class="btn" data-a="guest" data-k="guest">${t('ያለ መግቢያ ቀጥል', 'Continue without signing in')}</button>
<p class="muted small">${t('ስምዎ፣ ኢሜይልዎና ሥዕልዎ በዚህ አሳሽ ውስጥ ብቻ ይቀመጣሉ። ማስታወሻዎችዎም በዚህ መሣሪያ ላይ ይቆያሉ።', 'Your name, email and picture are kept only in this browser. Your notes also stay on this device.')}</p>
<button class="btn" style="align-self:center;background:transparent" data-a="lang" data-k="lang">${icon('globe')}${t('English', 'አማርኛ')}</button>
</div></main>`;
}

function sideMenu() {
  const nav = (screen, ic, label) => `<button class="nav" data-a="nav" data-v="${screen}" data-k="nav-${screen}" ${S.screen === screen ? 'aria-current="page"' : ''}>${icon(ic, 20)}${esc(label)}</button>`;
  return `<nav class="side" aria-label="${t('ዋና ማውጫ', 'Main')}">
<div class="brand">${icon('logo', 26)}<span>ቃሉ</span></div>
${nav('journey', 'flag', t('ጉዞ', 'Journey'))}
${nav('browse', 'grid', t('መጽሐፍ ቅዱስ', 'Bible'))}
${nav('study', 'book', t('ጥናት', 'Study'))}
${nav('map', 'pin', t('ካርታ', 'Map'))}
${nav('notes', 'note', t('ማስታወሻዎች', 'Notes'))}
<div class="spacer"></div>
${S.user
    ? `<div class="who">${S.user.picture ? `<img src="${esc(S.user.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span><b>${esc(S.user.name || '')}</b><span class="muted small">${esc(S.user.email || '')}</span></span></div>
<button class="nav" data-a="signOut" data-k="signout">${icon('exit', 20)}${t('ውጣ', 'Sign out')}</button>`
    : `<button class="nav" data-a="signIn" data-k="signin">${icon('user', 20)}${t('ግባ', 'Sign in')}</button>`}
<button class="nav" data-a="lang" data-k="lang">${icon('globe', 20)}${t('English', 'አማርኛ')}</button>
<button class="nav" data-a="theme" data-k="theme">${icon('moon', 20)}${S.dark ? t('ብሩህ ገጽታ', 'Light mode') : t('ጨለማ ገጽታ', 'Dark mode')}</button>
</nav>`;
}

function tile(title, sub, pass, pic = '') {
  opens.push(pass);
  return `<button class="tile" data-a="open" data-v="${opens.length - 1}" data-k="tile-${opens.length - 1}">${pic}<b>${esc(title)}</b><span class="muted small">${esc(sub)}</span></button>`;
}

// BibleProject's overview video for a book (and the part of the book a chapter falls in).
// Thumbnails are shown from BibleProject's own server and link to their page; nothing of theirs is stored here.
const BP_IMG = (set, slug) => `https://ik.imagekit.io/bpweb1/web/media/video-images/${set}/${slug}/tr:q-90,w-600/${slug}_16.9.jpg`;
function videoFor(b, c) {
  const list = C.videos[b] || [];
  const v = list.find((x) => c >= x.from && c <= x.to) || list[0];
  if (!v) return null;
  // Most thumbnails are named after the page; these two were found to differ on BibleProject's pages.
  const image = { 'song-songs': 'song-of-songs', '1-3-john': '123-john' }[v.slug] || v.slug;
  return { title: v.title, yt: v.yt, url: `https://bibleproject.com/videos/${v.slug}/`, img: BP_IMG(b < 39 ? 'old-testament-overview' : 'new-testament-overview', image) };
}
// A 16:9 picture that falls back to a plain play mark (and an optional title) when the image cannot load.
const thumb = (img, label = '') => `<span class="thumb"><span class="thumb-fallback" aria-hidden="true">${icon('play', 28)}${label ? `<b>${esc(label)}</b>` : ''}</span><img src="${img}" alt="" loading="lazy" onerror="this.remove()"></span>`;

// A link that opens a video in the video window. It stays a real link, so it still works without the script.
const vlink = (v, cls, key, inner, label = '') => { vids.push(v); return `<a class="${cls}" href="${v.url}" target="_blank" rel="noopener" data-a="video" data-v="${vids.length - 1}" data-k="${key}"${label ? ` aria-label="${esc(label)}"` : ''}>${inner}</a>`; };

// The video window sits outside the app's main element, so re-rendering the screen never restarts a playing video.
const modal = document.createElement('div');
modal.id = 'modal';
document.body.appendChild(modal);
let modalReturn = null;
function openVideo(v) {
  modalReturn = document.activeElement;
  const player = v.yt
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}?autoplay=1&rel=0&modestbranding=1" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
    : `${thumb(v.img, v.title)}<p class="player-note">${t('ይህ ቪዲዮ እዚህ ገና መጫወት አይችልም፤ በBibleProject ድረ ገጽ ይከፈታል።', 'This video cannot play here yet. It opens on BibleProject’s website.')}</p>`;
  modal.innerHTML = `<div class="modal-back" data-close></div>
<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(v.title)}">
<div class="modal-head"><b>${esc(v.title)}</b><button class="modal-btn" data-close aria-label="${t('ዝጋ', 'Close')}" title="${t('ዝጋ', 'Close')}">${icon('close', 22)}</button></div>
<div class="player">${player}</div>
<div class="modal-foot"><span class="small">BibleProject${v.yt ? '' : ''}</span><a class="modal-btn${v.yt ? '' : ' main'}" href="${v.url}" target="_blank" rel="noopener">${t('በBibleProject ድረ ገጽ ክፈት', 'Open on BibleProject')}</a></div></div>`;
  modal.dataset.open = '1';
  document.body.style.overflow = 'hidden';
  modal.querySelector('[data-close].modal-btn').focus();
}
function closeVideo() {
  if (!modal.dataset.open) return;
  modal.innerHTML = '';
  delete modal.dataset.open;
  document.body.style.overflow = '';
  if (modalReturn && document.contains(modalReturn)) modalReturn.focus();
}
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeVideo(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeVideo(); });

function themesView() {
  // An older copy of the content file (kept by the browser for a few minutes after an update) has no concepts yet.
  if (!C.themes) return `<div class="card stack" style="align-items:flex-start"><p class="prose">${t('ጽንሰ ሐሳቦቹ ገና አልተጫኑም። ገጹን እንደገና ይጫኑ።', 'The concepts have not loaded yet. Reload the page.')}</p><button class="btn fill" data-a="reload" data-k="reload-app">${t('እንደገና ጫን', 'Reload')}</button></div>`;
  return `<div class="grid themes">${C.themes.map((th, i) => {
    const url = `https://bibleproject.com/videos/${th.slug}/`;
    const open = S.theme === i;
    // The detail: a short commentary and the passages it rests on, each opening in the Study screen.
    const detail = open ? `<p class="prose">${esc(tp(th.c))}</p>
<b class="small muted">${t('ዋቢ ጥቅሶች', 'Bible references')}</b>
<div class="row">${th.refs.map((p, j) => { opens.push({ b: p.b, c: p.c, f: p.f, to: p.to, title: th.n }); return `<button class="btn" data-a="open" data-v="${opens.length - 1}" data-k="theme-ref-${i}-${j}">${icon('book')}${esc(passRef(p))}</button>`; }).join('')}</div>` : '';
    const v = { title: tp(th.n), url, img: th.img, yt: th.yt };
    return `<div class="tile theme${open ? ' open' : ''}">${vlink(v, 'pic', 'theme-pic-' + i, thumb(th.img, th.n[1]), tp(th.n) + ': ' + t('ቪዲዮውን ተመልከት', 'watch the video'))}
<b>${esc(tp(th.n))}</b><span class="muted small">${esc(tp(th.d))}</span>
<div class="row">${vlink(v, 'btn fill', 'theme-vid-' + i, icon('play') + t('ቪዲዮ', 'Video'))}
<button class="btn" data-a="concept" data-v="${i}" data-k="theme-more-${i}" aria-expanded="${open}">${icon('note')}${open ? t('ዝጋ', 'Close') : t('ዝርዝር', 'Details')}</button></div>${detail}</div>`;
  }).join('')}</div>
<p class="muted small">${t('ቪዲዮዎቹ የBibleProject ናቸው (በእንግሊዝኛ)። ሥዕሎቹም ከእነሱ አገልጋይ ይታያሉ፤ በዚህ መተግበሪያ ውስጥ አይቀመጡም። ማብራሪያዎቹ ለዚህ መተግበሪያ የተጻፉ አጫጭር ረቂቆች ናቸው፤ የBibleProject ጽሑፍ አይደሉም።', 'The videos are BibleProject’s (in English). The pictures are shown from their server and are not stored in this app. The commentaries are short drafts written for this app; they are not BibleProject’s text.')}</p>`;
}

// ---------- search ----------
// Amharic has letters that sound alike and are often interchanged in spelling (ሀ ሐ ኀ, ሰ ሠ, አ ዐ, ጸ ፀ).
// Search treats each set as one letter. The mapping keeps the text the same length, so match positions
// in the folded text line up with the original.
const FOLD = [[0x1210, 0x1200], [0x1280, 0x1200], [0x1220, 0x1230], [0x12D0, 0x12A0], [0x1340, 0x1338]];
function fold(text) {
  let out = '';
  for (const ch of text.toLowerCase()) {
    const code = ch.charCodeAt(0);
    const row = FOLD.find((r) => code >= r[0] && code < r[0] + 8);
    out += row ? String.fromCharCode(row[1] + code - row[0]) : ch;
  }
  return out.length === text.length ? out : text.toLowerCase();
}

// "love mercy" finds verses with both words; "love, mercy" finds verses with either.
function parseQuery(q) {
  return q.split(/[,،፣]/).map((g) => fold(g).split(/\s+/).filter(Boolean)).filter((g) => g.length);
}

async function loadWholeVersion(id, progress) {
  const v = versions[id];
  if (!v.dir) return;
  const missing = [];
  for (let b = 0; b < 66; b++) if (!v.books[b]) missing.push(b);
  let done = 66 - missing.length;
  const worker = async () => {
    while (missing.length) {
      const b = missing.shift();
      try { const r = await fetch(v.dir + '/' + b + '.json'); if (r.ok) v.books[b] = await r.json(); } catch (e) { /* skip this book */ }
      progress(++done);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

async function runSearch() {
  const groups = parseQuery(S.q);
  S.searchOn = groups.length > 0;
  save('q', 'qv', 'searchOn');
  if (!groups.length) { S.results = null; render(); return; }
  const id = versions[S.qv] ? S.qv : S.primary;
  const run = (runSearch.run = (runSearch.run || 0) + 1);
  S.results = null;
  S.shown = 60;
  S.searchNote = t('መጽሐፍ ቅዱሱ እየተጫነ ነው…', 'Loading the Bible…');
  render();
  await loadWholeVersion(id, (n) => {
    if (run !== runSearch.run) return;
    const note = document.getElementById('searchnote');
    if (note) note.textContent = t('እየተጫነ ነው… ' + n + ' / 66 መጻሕፍት', 'Loading… ' + n + ' of 66 books');
  });
  if (run !== runSearch.run) return;
  const found = [];
  const books = versions[id].books;
  for (let b = 0; b < 66; b++) {
    const chapters = books[b] || [];
    for (let c = 0; c < chapters.length; c++) {
      const verses = chapters[c] || [];
      for (let v = 0; v < verses.length; v++) {
        const text = verses[v];
        if (!text) continue;
        const folded = fold(text);
        const group = groups.find((g) => g.every((term) => folded.includes(term)));
        if (group) found.push({ b, c: c + 1, v: v + 1, text, terms: group });
      }
    }
  }
  S.results = found;
  S.searchNote = '';
  render();
}

function markTerms(text, terms) {
  const folded = fold(text);
  const spans = [];
  terms.forEach((term) => { for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + term.length)) spans.push([i, i + term.length]); });
  spans.sort((x, y) => x[0] - y[0]);
  let out = '', at = 0;
  spans.forEach(([from, to]) => {
    if (from < at) return;
    out += esc(text.slice(at, from)) + '<mark>' + esc(text.slice(from, to)) + '</mark>';
    at = to;
  });
  return out + esc(text.slice(at));
}

function searchBar() {
  const verOpts = Object.values(versions).map((v) => [v.id, v.name]);
  return `<form class="card searchbar" role="search" data-search>
<div class="field wide" style="flex:3 1 260px"><label for="q">${t('በመጽሐፍ ቅዱስ ውስጥ ፈልግ', 'Search the Bible')}</label>
<input id="q" data-k="q" type="search" value="${esc(S.q)}" placeholder="${t('ለምሳሌ፦ ፍቅር ወይም ምሕረት, ይቅርታ', 'For example: love, or mercy, forgive')}" autocomplete="off"></div>
<div class="field" style="flex:1 1 180px"><label for="qv">${t('ትርጉም', 'Version')}</label><select id="qv" data-c="qv" data-k="qv">${options(verOpts, versions[S.qv] ? S.qv : S.primary)}</select></div>
<button class="btn fill" type="submit" data-k="q-go">${icon('search')}${t('ፈልግ', 'Search')}</button>
${S.searchOn ? `<button class="btn" type="button" data-a="clearSearch" data-k="q-clear">${t('አጽዳ', 'Clear')}</button>` : ''}
<p class="muted small" style="flex:1 1 100%;margin:0">${t('ክፍተት ያላቸው ቃላት ሁሉም ያሉባቸውን ቁጥሮች ያመጣሉ፤ በነጠላ ሰረዝ (,) የተለዩት ከአንዳቸው አንዱ ያለባቸውን።', 'Words separated by spaces must all be in the verse; words separated by commas find verses with any of them.')}</p>
</form>`;
}

function searchResults() {
  if (S.results === null) return `<p id="searchnote" class="muted prose" role="status">${esc(S.searchNote || t('እየፈለገ ነው…', 'Searching…'))}</p>`;
  const id = versions[S.qv] ? S.qv : S.primary;
  if (!S.results.length) return `<div class="card"><p class="prose">${t('በ' + versions[id].name + ' ውስጥ ምንም አልተገኘም። ሌላ ቃል ወይም ሌላ ትርጉም ይሞክሩ።', 'Nothing found in the ' + versions[id].name + '. Try another word or another version.')}</p></div>`;
  const rows = S.results.slice(0, S.shown).map((r, i) => `<button class="result" data-a="openResult" data-v="${i}" data-k="res-${i}"><b>${esc(bookName(r.b))} ${r.c}${t('፥', ':')}${r.v}</b><span lang="${versions[id].language}">${markTerms(r.text, r.terms)}</span></button>`).join('');
  return `<p class="muted" role="status"><b>${S.results.length}</b> ${t('ቁጥሮች ተገኝተዋል በ', 'verses found in the ')}${esc(versions[id].name)}</p>
<div class="stack" style="gap:8px">${rows}</div>
${S.results.length > S.shown ? `<button class="btn" data-a="moreResults" data-k="res-more">${t('ተጨማሪ አሳይ', 'Show more')} (${S.results.length - S.shown})</button>` : ''}`;
}

function browseView() {
  const modes = [['timeline', t('የታሪክ መስመር', 'Story timeline')], ['chrono', t('በጊዜ ቅደም ተከተል', 'Chronological')], ['canon', t('መደበኛ ቅደም ተከተል', 'Traditional order')], ['themes', t('ጽንሰ ሐሳቦች', 'Concepts')]];
  const notes = {
    timeline: t('ዋና ዋና ታሪኮች በተፈጸሙበት ቅደም ተከተል።', 'Key stories in the order they happened.'),
    chrono: t('መጻሕፍቱ በሚተርኩት ዘመን ቅደም ተከተል፤ ግምታዊ ነው፥ ሊቃውንትም በአንዳንዶቹ ይለያያሉ።', 'Books by the period they describe. The order is approximate and scholars differ on some.'),
    canon: t('66ቱ መጻሕፍት በመጽሐፍ ቅዱስ ውስጥ ባሉበት ቅደም ተከተል።', 'The 66 books in the order they appear in the Bible.'),
    themes: t('የመጽሐፍ ቅዱስ ዋና ዋና ጽንሰ ሐሳቦች፤ እያንዳንዱ ከአንድ የBibleProject ቪዲዮና ከአንድ ቁልፍ ምንባብ ጋር።', 'Key ideas of the Bible, each with a BibleProject video and a key passage to read.')
  };
  const groups = S.browse === 'themes' ? [themesView()] : C[S.browse].map((g, gi) => {
    let items;
    if (g.items) {
      items = g.items.map((it) => { const v = videoFor(it.p.b, it.p.c); return tile(tp(it.n), tp(it.sub), { b: it.p.b, c: it.p.c, f: it.p.f, to: it.p.to, title: it.n, pl: it.pl }, v ? thumb(v.img) : ''); }).join('');
    } else {
      // A book tile opens its list of chapters, so any chapter is two clicks away.
      items = g.books.map((b) => {
        const open = S.openBook === b;
        const card = `<button class="tile" data-a="book" data-v="${b}" data-k="book-${b}" aria-expanded="${open}" aria-pressed="${open}"><b>${esc(bookName(b))}</b><span class="muted small">${C.books[b].ch} ${t('ምዕራፍ', C.books[b].ch === 1 ? 'chapter' : 'chapters')}</span></button>`;
        if (!open) return card;
        const chapters = Array.from({ length: C.books[b].ch }, (_, i) => `<button class="chap" data-a="chapter" data-v="${b}.${i + 1}" data-k="ch-${b}-${i + 1}" ${S.pass.b === b && S.pass.c === i + 1 ? 'aria-current="true"' : ''}>${i + 1}</button>`).join('');
        return card + `<div class="chapters" role="group" aria-label="${esc(bookName(b))}">${chapters}</div>`;
      }).join('');
    }
    return `<section class="group" id="g-${gi}"><h2>${esc(tp(g.n))}</h2><div class="grid">${items}</div></section>`;
  });
  const shortcuts = S.browse !== 'themes' ? `<div class="row" role="group" aria-label="${t('ወደ ክፍል ዝለል', 'Jump to a section')}">${C[S.browse].map((g, gi) => `<button class="chip" data-a="jumpTo" data-v="g-${gi}" data-k="jump-${gi}">${esc(tp(g.n))}</button>`).join('')}</div>` : '';
  const main = S.searchOn
    ? searchResults()
    : `<div class="seg" role="group" aria-label="${t('የማሰሻ መንገድ', 'Browse by')}">${modes.map((m) => `<button data-a="browse" data-v="${m[0]}" data-k="mode-${m[0]}" aria-pressed="${S.browse === m[0]}">${m[1]}</button>`).join('')}</div>
<p class="muted">${notes[S.browse]}</p>
<div class="card row between"><div class="stack" style="gap:4px"><span class="muted small"><b>${t('ካቆሙበት ይቀጥሉ', 'Continue where you left off')}</b></span><span style="font-size:21px;font-weight:700">${esc(passTitle(S.pass))}</span><span class="muted small">${esc(passRef(S.pass))}</span></div>
<button class="btn fill" data-a="nav" data-v="study" data-k="continue">${t('ክፈት', 'Open')}</button></div>
${shortcuts}
${groups.join('')}`;
  return `<div class="wrap" style="max-width:980px">
<h1>${t('መጽሐፍ ቅዱስ', 'Bible')}</h1>
${searchBar()}
${main}
</div>`;
}

function options(list, selected) {
  return list.map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function voiceButton(key) {
  return S.recording
    ? `<button class="btn rec" data-a="stop" data-k="${key}">${icon('stop')}${t('አቁም', 'Stop')}</button>`
    : `<button class="btn" data-a="rec" data-k="${key}">${icon('mic')}${t('የድምፅ ማስታወሻ', 'Voice note')}</button>`;
}

function noteCard(n) {
  const body = n.audio
    ? `<button class="btn" data-a="play" data-v="${n.id}" data-k="play-${n.id}">${icon('play')}${t('አጫውት', 'Play')} · ${mmss(n.dur || 0)}</button>`
    : `<p class="prose">${esc(n.text)}</p>`;
  return `<div class="card row between" style="align-items:flex-start"><div class="stack" style="gap:6px;flex:1 1 200px;min-width:0"><span class="muted small"><b>${esc(notePlace(n))}</b></span>${body}</div>
<div class="row"><button class="btn" data-a="openNote" data-v="${n.id}" data-k="go-${n.id}" aria-label="${t('ክፍሉን ክፈት', 'Open the passage')}" title="${t('ክፍሉን ክፈት', 'Open the passage')}">${icon('book')}</button>
<button class="btn" data-a="del" data-v="${n.id}" data-k="del-${n.id}" aria-label="${t('ሰርዝ', 'Delete')}" title="${t('ሰርዝ', 'Delete')}">${icon('trash')}</button></div></div>`;
}

function sidePanel() {
  const tabs = [['fathers', t('አባቶች', 'Fathers')], ['context', t('ዳራ', 'Context')], ['notes', t('ማስታወሻ', 'Notes')]];
  const st = study();
  let body = '';
  if (S.tab === 'fathers') {
    const fa = fathers();
    const lo = S.sel || S.pass.f || 1, hi = S.sel || S.pass.to || 999;
    const list = fa.list.filter((e) => e.f <= hi && e.t >= lo);
    const scope = S.sel ? t('ቁ. ' + S.sel, 'v. ' + S.sel) : passRef(S.pass);
    const quote = (e) => `<div class="card stack" style="gap:8px"><div class="row between" style="align-items:baseline"><b style="font-size:17px">${esc(e.a)}</b><span class="muted small">${t(e.y + ' ገደማ (እ.ኤ.አ.)', 'c. AD ' + e.y)} · ${t('ቁ. ', 'v. ')}${e.f}${e.t > e.f && e.t < 999 ? '–' + e.t : ''}</span></div><p class="prose" lang="en">${esc(e.q)}</p><span class="muted small" lang="en">${esc(e.s)}</span></div>`;
    const summaries = st
      ? `<h2>${t('አጭር ማጠቃለያ', 'Summaries')}</h2>` + st.fathers.map((f) => `<div class="card stack" style="gap:8px"><div class="row between" style="align-items:baseline"><b style="font-size:18px">${esc(tp(f.name))}</b><span class="muted small">${esc(tp(f.era))}</span></div><span class="pill">${esc(tp(f.theme))}</span><p class="prose">${esc(tp(f.text))}</p><span class="muted small">${esc(tp(f.source))}</span></div>`).join('') +
        `<p class="muted small">${t('ረቂቅ ማጠቃለያዎች፦ ከምንጮቹ ጋር መመሳከር ያስፈልጋቸዋል።', 'Draft summaries: each still needs checking against its source.')}</p>`
      : '';
    let own;
    if (fa.state === 'loading') own = `<p class="muted prose" role="status">${t('እየተጫነ ነው…', 'Loading…')}</p>`;
    else if (!list.length) own = `<div class="card"><p class="muted prose">${t('ለ' + scope + ' በነጻ የሚገኝ የአባቶች ትርጓሜ አልተገኘም።', 'No public-domain commentary from the fathers was found for ' + scope + '.')}</p></div>`;
    else own = list.slice(0, S.more).map(quote).join('') + (list.length > S.more ? `<button class="btn" data-a="more" data-k="more">${t('ተጨማሪ አሳይ', 'Show more')} (${list.length - S.more})</button>` : '');
    body = summaries + `<h2>${t('በራሳቸው ቃል', 'In their own words')} · ${esc(scope)}</h2><p class="muted small">${t('ጥቅሶቹ በእንግሊዝኛ ናቸው፤ ከነጻ (public domain) ትርጉሞች የተወሰዱ።', 'Quotations are in English, from public-domain translations.')}</p>` + own;
  } else if (S.tab === 'context') {
    const about = C.bookContext[S.pass.b];
    const bg = background();
    const chapterNote = bg ? bg.chapters[S.pass.c] : '';
    const inGroup = (groups) => (groups.find((g) => g.books.includes(S.pass.b)) || { n: ['', ''] }).n;
    const facts = [
      [t('የመጽሐፉ ዓይነት', 'Kind of book'), tp(inGroup(C.canon))],
      [t('የታሪኩ ዘመን', 'Period'), tp(inGroup(C.chrono))],
      [t('ርዝመት', 'Length'), C.books[S.pass.b].ch + ' ' + t('ምዕራፍ', C.books[S.pass.b].ch === 1 ? 'chapter' : 'chapters')],
      [t('አሁን ያሉበት', 'You are in'), t('ምዕራፍ ' + S.pass.c, 'chapter ' + S.pass.c) + ' / ' + C.books[S.pass.b].ch]
    ];
    body = `<div class="card stack"><b style="font-size:18px">${t('ስለ ', 'About ')}${esc(bookName(S.pass.b))}</b><p class="prose">${esc(tp(about))}</p>
<dl class="facts">${facts.map((f) => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl></div>` +
      (bg === null ? `<p class="muted prose" role="status">${t('እየተጫነ ነው…', 'Loading…')}</p>` : '') +
      (chapterNote ? `<div class="card stack"><b style="font-size:18px">${t('ስለ ምዕራፍ ' + S.pass.c, 'About chapter ' + S.pass.c)}</b><div class="notes" lang="en">${md(chapterNote)}</div></div>` : '') +
      (st ? `<h2>${t('ስለዚህ ክፍል', 'About this passage')}</h2>` + st.context.map((e) => `<div class="card stack" style="gap:6px"><b>${esc(tp(e.head))}</b><p class="prose">${esc(tp(e.body))}</p></div>`).join('') : '') +
      (bg && bg.intro ? `<button class="btn" data-a="intro" data-k="intro" aria-expanded="${S.intro}">${t('የመጽሐፉ ሙሉ መግቢያ', 'Full introduction to the book')}${icon(S.intro ? 'left' : 'right')}</button>` +
        (S.intro ? `<div class="card stack"><b style="font-size:18px">${t('የ' + bookName(S.pass.b) + ' መግቢያ', 'Introduction to ' + bookName(S.pass.b))}</b><div class="notes" lang="en">${md(bg.intro)}</div></div>` : '') : '') +
      `<p class="muted small">${t('የምዕራፍና የመጽሐፍ ማብራሪያዎቹ በእንግሊዝኛ ናቸው፤ ከunfoldingWord Translation Notes የተወሰዱ (CC BY-SA 4.0)። ዋናው ሥራ በ unfoldingword.org/utn ይገኛል። አጭሩ የአማርኛ ማጠቃለያ ረቂቅ ነው።', 'Chapter and book notes are selected from the unfoldingWord Translation Notes (CC BY-SA 4.0). The original work by unfoldingWord is available from unfoldingword.org/utn. The short summary at the top is a draft.')}</p>`;
  } else {
    const place = S.sel ? t('ቁ. ' + S.sel, 'v. ' + S.sel) : bookName(S.pass.b) + ' ' + S.pass.c;
    const label = t('ማስታወሻ፦ ', 'Note on: ') + place;
    body = (st && st.questions.length ? `<div class="card stack"><b>${t('ለማሰላሰል', 'To reflect on')}</b>${st.questions.map((q) => `<p class="prose">${esc(tp(q.body))}</p>`).join('')}</div>` : '') +
      `<div class="card stack"><label for="draft"><b>${esc(label)}</b></label><textarea id="draft" data-k="draft" rows="4">${esc(S.draft)}</textarea>
<div class="row"><button class="btn fill" data-a="saveNote" data-k="save">${t('አስቀምጥ', 'Save')}</button>${voiceButton('rec-tab')}</div>
${S.msg ? `<p class="prose" role="status">${esc(S.msg)}</p>` : ''}</div>` +
      S.notes.filter((n) => n.b === S.pass.b && n.c === S.pass.c).map(noteCard).join('');
  }
  return `<aside class="sidepanel" aria-label="${t('ተጨማሪ ጥናት', 'Study sides')}">
${videoCard()}
<div class="seg" role="group">${tabs.map((x) => `<button data-a="tab" data-v="${x[0]}" data-k="tab-${x[0]}" aria-pressed="${S.tab === x[0]}">${x[1]}</button>`).join('')}</div>${body}</aside>`;
}

// The card for BibleProject's overview video of a book (and the part of the book a chapter falls in).
function videoCard(b = S.pass.b, c = S.pass.c) {
  const v = videoFor(b, c);
  if (!v) return '';
  return vlink(v, 'card video', 'video', `${thumb(v.img, v.title)}
<span class="stack" style="gap:4px"><span class="muted small"><b>BibleProject</b></span><b style="font-size:18px">${esc(v.title)}</b><span class="muted small">${t('የመጽሐፉ አጠቃላይ ቪዲዮ (በእንግሊዝኛ)።', 'Book overview video (in English).')}</span><span class="btn fill" style="align-self:flex-start">${icon('play')}${t('ቪዲዮውን ተመልከት', 'Watch the video')}</span></span>`);
}

function studyView() {
  const p = S.pass;
  const stacked = S.split && S.layout === 'stack';
  const main = chapter(S.primary);
  const alt = S.split ? chapter(S.secondary) : { state: 'ok', verses: [] };
  const count = main.verses.length;
  const lo = Math.max(1, p.f || 1);
  const hi = p.to ? Math.min(p.to, count) : count;
  const nums = [];
  for (let n = lo; n <= hi; n++) nums.push(n);

  const verOpts = Object.values(versions).map((v) => [v.id, v.name]);
  const verseNums = Array.from({ length: Math.max(count, 1) }, (_, i) => [i + 1, i + 1]);
  const picker = `<div class="card stack" role="group" aria-label="${t('ክፍል ይምረጡ', 'Choose a passage')}">
<div class="row" style="align-items:flex-end">
<div class="field wide"><label for="pk-book">${t('መጽሐፍ', 'Book')}</label><select id="pk-book" data-c="book" data-k="pk-book">${options(C.books.map((b, i) => [i, tp(b.n)]), p.b)}</select></div>
<div class="field"><label for="pk-chap">${t('ምዕራፍ', 'Chapter')}</label><select id="pk-chap" data-c="chap" data-k="pk-chap">${options(Array.from({ length: C.books[p.b].ch }, (_, i) => [i + 1, i + 1]), p.c)}</select></div>
<div class="field"><label for="pk-from">${t('ከቁጥር', 'From verse')}</label><select id="pk-from" data-c="from" data-k="pk-from">${options(verseNums, lo)}</select></div>
<div class="field"><label for="pk-to">${t('እስከ ቁጥር', 'To verse')}</label><select id="pk-to" data-c="to" data-k="pk-to">${options([[0, t('መጨረሻ', 'End')]].concat(verseNums), p.to && p.to <= count ? p.to : 0)}</select></div>
</div>
<div class="row" style="align-items:flex-end">
<div class="field wide"><label for="pk-v1">${t('ትርጉም', 'Version')}</label><select id="pk-v1" data-c="primary" data-k="pk-v1">${options(verOpts, S.primary)}</select></div>
${S.split ? `<div class="field wide"><label for="pk-v2">${t('ሁለተኛ ትርጉም', 'Second version')}</label><select id="pk-v2" data-c="secondary" data-k="pk-v2">${options(verOpts, S.secondary)}</select></div>` : ''}
${S.split ? `<div class="seg" role="group" aria-label="${t('የሁለቱ ትርጉሞች አቀማመጥ', 'Layout of the two versions')}"><button data-a="layout" data-v="stack" data-k="lay-stack" aria-pressed="${S.layout === 'stack'}">${t('ላይና ታች', 'Top and bottom')}</button><button data-a="layout" data-v="side" data-k="lay-side" aria-pressed="${S.layout === 'side'}">${t('ጎን ለጎን', 'Side by side')}</button></div>` : ''}
<button class="btn" data-a="import" data-k="import">${t('የመጽሐፍ ቅዱስ ፋይል አስገባ…', 'Import a Bible file…')}</button>
</div></div>`;

  const importCard = hasAmharic() ? '' : `<div class="card stack"><b>${t('የአማርኛ መጽሐፍ ቅዱስ ገና አልገባም', 'No Amharic Bible imported yet')}</b><p class="muted prose">${t('ለጊዜው የእንግሊዝኛ ትርጉሞች ብቻ አሉ። የአማርኛ ጽሑፍ ፋይል (JSON) ሲኖርዎት “የመጽሐፍ ቅዱስ ፋይል አስገባ” የሚለውን ይጫኑ፤ ጽሑፉ በዚህ ኮምፒውተር ላይ ብቻ ይቀመጣል።', 'Only the English versions are available for now. When you have an Amharic text file (JSON), use “Import a Bible file”. The text stays on this computer only.')}</p></div>`;

  let verses;
  if (main.state === 'loading') verses = `<p class="muted prose" style="padding:12px" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
  else if (main.state === 'error') verses = `<p class="prose" style="padding:12px" role="alert">${t('ጽሑፉን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱና ገጹን እንደገና ይክፈቱ።', 'The text could not be loaded. Check your connection and reload the page.')}</p>`;
  else if (!nums.length) verses = `<p class="prose" style="padding:12px">${t('ለዚህ ክፍል በተመረጠው ትርጉም ጽሑፍ የለም።', 'The selected version has no text for this passage.')}</p>`;
  else {
    verses = nums.map((n) => `<button class="verse" data-a="verse" data-v="${n}" data-k="v-${n}" aria-pressed="${S.sel === n}" data-hl="${S.highlights[hlKey(n)] || ''}"><span lang="${versions[S.primary].language}"><sup>${n} </sup>${esc(main.verses[n - 1] || '')}</span>${S.split && !stacked ? `<span class="alt" lang="${versions[S.secondary].language}">${alt.state === 'loading' ? '…' : esc(alt.verses[n - 1] || '')}</span>` : ''}</button>`).join('');
  }
  if (stacked) {
    // The second version gets its own pane under the first, with the same verse range.
    let lower;
    const hi2 = p.to ? Math.min(p.to, alt.verses.length) : alt.verses.length;
    if (alt.state === 'loading') lower = `<p class="muted prose" style="padding:12px" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
    else if (alt.state === 'error') lower = `<p class="prose" style="padding:12px" role="alert">${t('ጽሑፉን መጫን አልተቻለም።', 'The text could not be loaded.')}</p>`;
    else if (lo > hi2) lower = `<p class="prose" style="padding:12px">${t('ይህ ትርጉም ለዚህ ክፍል ጽሑፍ የለውም።', 'This version has no text for this passage.')}</p>`;
    else {
      lower = '';
      for (let n = lo; n <= hi2; n++) lower += `<button class="verse" data-a="verse" data-v="${n}" data-k="w-${n}" aria-pressed="${S.sel === n}" data-hl="${S.highlights[hlKey(n)] || ''}"><span lang="${versions[S.secondary].language}"><sup>${n} </sup>${esc(alt.verses[n - 1] || '')}</span></button>`;
    }
    verses = `<div class="panes"><div class="pane" data-pane="1"><div class="pane-head">${esc(versions[S.primary].name)}</div>${verses}</div><div class="pane" data-pane="2"><div class="pane-head">${esc(versions[S.secondary].name)}</div>${lower}</div></div>`;
  }

  const credits = [S.primary].concat(S.split ? [S.secondary] : []).map((id) => versions[id].credit).filter(Boolean).join(' ');
  const colors = [['yellow', t('ቢጫ', 'Yellow')], ['green', t('አረንጓዴ', 'Green')], ['blue', t('ሰማያዊ', 'Blue')], ['pink', t('ሮዝ', 'Pink')]];
  const selbar = S.sel
    ? `<div class="row selbar" role="toolbar" aria-label="${t('የቁጥር መሣሪያዎች', 'Verse tools')}"><b class="small">${t('ቁ. ' + S.sel, 'v. ' + S.sel)}</b>
${colors.map((c) => `<button class="dot" data-a="hl" data-v="${c[0]}" data-k="hl-${c[0]}" aria-label="${c[1]}" title="${c[1]}"><span style="background:var(--hl-${c[0]})"></span></button>`).join('')}
<button class="btn" data-a="clearHl" data-k="hl-clear">${t('አጥፋ', 'Clear')}</button>
<button class="btn" data-a="noteTab" data-k="note-open">${icon('pen')}${t('ማስታወሻ', 'Note')}</button>${voiceButton('rec-bar')}</div>`
    : `<p class="muted small" style="padding:6px 12px">${t('ለማቅለም ወይም ማስታወሻ ለመያዝ አንድ ቁጥር ይንኩ።', 'Click a verse to highlight it or add a note.')}</p>`;
  const heads = S.split && !stacked ? `<div class="row muted small" style="padding:0 12px;gap:16px"><b style="flex:1 1 220px">${esc(versions[S.primary].name)}</b><b style="flex:1 1 220px">${esc(versions[S.secondary].name)}</b></div>` : '';

  const title = passTitle(p), ref = passRef(p);
  const first = p.b === 0 && p.c === 1, last = p.b === 65 && p.c === C.books[65].ch;
  const stepper = (key) => `<div class="row">
<button class="btn" data-a="prevCh" data-k="prev-${key}" ${first ? 'disabled' : ''}>${icon('left')}${t('ያለፈው ምዕራፍ', 'Previous chapter')}</button>
<button class="btn" data-a="nextCh" data-k="next-${key}" ${last ? 'disabled' : ''}>${t('ቀጣዩ ምዕራፍ', 'Next chapter')}${icon('right')}</button></div>`;
  return `<div class="wrap">
<div class="row between"><div class="stack" style="gap:2px"><h1>${esc(title)}</h1>${ref !== title ? `<span class="muted small">${esc(ref)}</span>` : ''}</div>
<div class="row" role="toolbar" aria-label="${t('የንባብ መሣሪያዎች', 'Reading tools')}">
${p.pl ? `<button class="btn" data-a="showPlace" data-k="show-place">${icon('pin')}${t('ካርታ ላይ አሳይ', 'Show on the map')}</button>` : ''}
<button class="btn" data-a="picker" data-k="picker" aria-expanded="${S.picker}" aria-pressed="${S.picker}">${icon('sliders')}${t('ክፍልና ትርጉም', 'Passage and version')}</button>
<button class="btn" data-a="smaller" data-k="smaller" aria-label="${t('ጽሑፉን አሳንስ', 'Smaller text')}"><b style="font-size:13px">A−</b></button>
<button class="btn" data-a="larger" data-k="larger" aria-label="${t('ጽሑፉን አሳድግ', 'Larger text')}"><b style="font-size:18px">A+</b></button>
<button class="btn" data-a="split" data-k="split" aria-pressed="${S.split}">${icon('split')}${t('ሁለት ትርጉም', 'Two versions')}</button>
<button class="btn" data-a="focus" data-k="focus" aria-pressed="${S.focus}">${icon('focus')}${t('ትኩረት', 'Focus')}</button>
</div></div>
${S.picker ? picker : ''}
<div class="cols"><article class="card stack reader${S.split || !S.focus ? '' : ' single'}">${selbar}${heads}<div class="verses" style="font-size:${[16, 19, 22, 25][S.size]}px">${verses}</div>${stepper('bottom')}</article>${S.focus ? '' : sidePanel()}</div>
${credits ? `<p class="muted small" lang="en">${esc(credits)}</p>` : ''}
</div>`;
}

function pinIcon(i) {
  const pl = C.places[i];
  return L.divIcon({ className: '', html: `<span class="spot${S.place === i ? ' on' : ''}"><span class="em">${pl.ic || '📍'}</span><b>${esc(tp(pl.n))}</b></span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
}

const MAP_VIEWS = {
  all: () => C.places.map((p) => [p.lat, p.lon]),
  lands: () => [[24, 28], [40, 49]],
  land: () => [[30.9, 34.2], [33.6, 36.4]],
  city: () => [[31.6, 34.9], [31.95, 35.6]]
};

// The illustrated map: names, rivers, lakes and small pictures drawn over the land outline.
// Everything here is approximate and for orientation only; country names are present-day.
const MAP_ART = {
  labels: [
    [38.9, 33.5, ['ቱርክ', 'Turkey'], 'land'], [35.1, 38.6, ['ሶርያ', 'Syria'], 'land'], [33.4, 42.2, ['ኢራቅ', 'Iraq'], 'land'],
    [33.2, 52, ['ኢራን', 'Iran'], 'land'], [26.2, 42.5, ['ሳዑዲ ዓረቢያ', 'Saudi Arabia'], 'land'], [30.6, 37.2, ['ዮርዳኖስ', 'Jordan'], 'land'],
    [30.3, 34.85, ['እስራኤል', 'Israel'], 'land'], [26.6, 29.2, ['ግብፅ', 'Egypt'], 'land'], [34.1, 36.1, ['ሊባኖስ', 'Lebanon'], 'small'],
    [39.4, 22, ['ግሪክ', 'Greece'], 'land'], [43, 12.6, ['ጣሊያን', 'Italy'], 'land'], [35, 33.2, ['ቆጵሮስ', 'Cyprus'], 'small'],
    [33.9, 25.5, ['ሜዲትራኒያን ባሕር', 'Mediterranean Sea'], 'sea'], [23.2, 36.6, ['ቀይ ባሕር', 'Red Sea'], 'sea'], [43.3, 34.5, ['ጥቁር ባሕር', 'Black Sea'], 'sea'],
    [27.2, 51.2, ['የፋርስ ባሕረ ሰላጤ', 'Persian Gulf'], 'sea'], [41.5, 50.8, ['ካስፒያን ባሕር', 'Caspian Sea'], 'sea'],
    [27.6, 31.9, ['ናይል', 'Nile'], 'small'], [35.2, 40.9, ['ኤፍራጥስ', 'Euphrates'], 'small'], [35.2, 44.4, ['ጤግሮስ', 'Tigris'], 'small']
  ],
  decor: [
    [27.6, 38.6, '🐫'], [30.4, 40.2, '🐪'], [25.4, 28.2, '🐫'], [24.4, 32.4, '🌴'], [23.8, 43.8, '🌴'], [30.6, 46.6, '🌴'], [28.4, 35.4, '🌴'],
    [34.4, 37.6, '🐑'], [31.4, 38.4, '🐑'], [36.4, 41.4, '🐐'], [34.6, 30.2, '⛵'], [36.6, 18.4, '⛵'], [35.2, 22.6, '🐬'], [32.6, 28.6, '🐟'],
    [34.5, 36.4, '🌲'], [40.2, 31.2, '🌲'], [40.4, 37.2, '🌲'], [37.8, 35.2, '⛰️'], [37.6, 46.2, '⛰️'], [34.2, 48.6, '🐐'], [26.4, 50.6, '🐠'], [28.9, 30.2, '🏜️']
  ],
  rivers: [
    [[22, 31.4], [24.09, 32.9], [25.69, 32.64], [26.16, 32.72], [27.18, 31.18], [28.1, 30.75], [30.04, 31.24], [31.42, 31.81]],
    [[30.04, 31.24], [31.4, 30.42]],
    [[33.25, 35.62], [32.9, 35.6], [32.72, 35.58], [32.2, 35.56], [31.76, 35.55]],
    [[37.9, 38.6], [37, 38], [35.95, 39], [35.33, 40.14], [34.45, 40.92], [34.13, 42.38], [33.43, 43.3], [32.48, 44.43], [31.05, 46.26], [31, 47.43], [29.95, 48.5]],
    [[37.9, 40.2], [37.33, 42.19], [36.34, 43.13], [34.6, 43.68], [33.31, 44.36], [32.5, 45.82], [31.84, 47.15], [31, 47.43]]
  ],
  lakes: [
    [[32.9, 35.6], [32.87, 35.65], [32.78, 35.65], [32.71, 35.6], [32.72, 35.56], [32.8, 35.53], [32.87, 35.54]],
    [[31.76, 35.5], [31.76, 35.58], [31.4, 35.57], [31.08, 35.5], [31.08, 35.4], [31.4, 35.4]]
  ]
};

function ensureMap() {
  if (!window.L) return null;
  if (!mapEl) {
    mapEl = document.createElement('div');
    mapEl.className = 'lmap';
    const sheet = [[20.0, 5.0], [48.0, 56.0]]; // the edges of the land outline in data/land.json: the map is drawn as a sheet this size
    lmap = L.map(mapEl, { minZoom: 4, maxZoom: 14, maxBounds: L.latLngBounds(sheet).pad(0.15), maxBoundsViscosity: 0.8 });
    // The land outline, rivers and lakes sit under everything else, so they are also what shows without a connection.
    lmap.createPane('base').style.zIndex = 100;
    L.rectangle(sheet, { pane: 'base', interactive: false, color: '#8A5A2B', weight: 5, fillColor: '#9ED7EA', fillOpacity: 1 }).addTo(lmap);
    const water = { pane: 'base', interactive: false, color: '#6FBFDD', weight: 3, lineCap: 'round', lineJoin: 'round' };
    fetch('data/land.json').then((r) => (r.ok ? r.json() : null)).then((g) => {
      if (!g) return;
      L.geoJSON(g, { pane: 'base', interactive: false, style: { color: '#C29A5B', weight: 1.5, fillColor: '#F5E3B8', fillOpacity: 1 } }).addTo(lmap);
      L.rectangle(sheet, { pane: 'base', interactive: false, color: '#8A5A2B', weight: 5, fill: false }).addTo(lmap);
      MAP_ART.rivers.forEach((line) => L.polyline(line, water).addTo(lmap));
      MAP_ART.lakes.forEach((ring) => L.polygon(ring, Object.assign({}, water, { weight: 1.5, fillColor: '#A6DBEC', fillOpacity: 1 })).addTo(lmap));
    }).catch(() => {});
    ltiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    });
    lart = L.layerGroup();
    const sticker = (lat, lon, html) => L.marker([lat, lon], { interactive: false, keyboard: false, zIndexOffset: -1000, icon: L.divIcon({ className: '', html, iconSize: [0, 0] }) }).addTo(lart);
    MAP_ART.decor.forEach((d) => sticker(d[0], d[1], `<span class="art">${d[2]}</span>`));
    MAP_ART.labels.forEach((l, i) => sticker(l[0], l[1], `<span class="maplabel ${l[3]}" data-label="${i}"></span>`));
    C.places.forEach((pl, i) => {
      const marker = L.marker([pl.lat, pl.lon], { icon: pinIcon(i), keyboard: true, alt: pl.n[1] }).addTo(lmap);
      marker.on('click', () => { S.place = i; render(); });
      lmarkers.push(marker);
    });
    // Place names show once the map is close enough for them not to pile up.
    const zoomed = () => { mapEl.dataset.zoom = lmap.getZoom() >= 9 ? 'near' : lmap.getZoom() >= 7 ? 'mid' : 'far'; };
    lmap.on('zoomend', zoomed);
    lmap.fitBounds(MAP_VIEWS.lands());
    zoomed();
  }
  if (S.tiles) { ltiles.addTo(lmap); lart.remove(); } else { ltiles.remove(); lart.addTo(lmap); }
  mapEl.dataset.tiles = S.tiles ? '1' : '';
  mapEl.querySelectorAll('[data-label]').forEach((el) => { el.textContent = tp(MAP_ART.labels[+el.dataset.label][2]); });
  return mapEl;
}

function mapView() {
  const pl = C.places[S.place];
  const here = [];
  C.timeline.forEach((g) => g.items.forEach((it) => { if (it.pl === pl.id) here.push(it); }));
  const chosen = `<div class="card stack"><div class="row"><span class="spot on static" aria-hidden="true"><span class="em">${pl.ic || '📍'}</span></span><b style="font-size:20px">${esc(tp(pl.n))}</b></div>
${pl.note ? `<p class="muted prose">${esc(tp(pl.note))}</p>` : ''}
<div class="grid">${here.map((it) => tile(tp(it.n), tp(it.sub), { b: it.p.b, c: it.p.c, f: it.p.f, to: it.p.to, title: it.n, pl: it.pl })).join('')}</div></div>`;
  const list = C.places.map((p, i) => `<button class="btn place" data-a="place" data-v="${i}" data-k="place-${i}" aria-pressed="${S.place === i}"><span aria-hidden="true">${p.ic || '📍'}</span>${esc(tp(p.n))}</button>`).join('');
  const links = C.links.map((l, i) => `<a class="tile" href="${esc(l.url)}" target="_blank" rel="noopener" data-k="link-${i}"><b>${esc(tp(l.n))}</b><span class="muted small">${esc(tp(l.d))}</span></a>`).join('');
  return `<div class="wrap">
<div class="stack"><h1>${t('የመጽሐፍ ቅዱስ ታሪክ ካርታ', 'Bible story map')}</h1><p class="muted">${t('ታሪኮቹ የተፈጸሙባቸው ስፍራዎች። ካርታውን ይጎትቱ፣ ያጉሉ፤ ሥዕል ይንኩ፤ ከዚያ ታሪኩን ይክፈቱ።', 'Where the stories took place. Drag and zoom the map, choose a picture, then open its story.')}</p></div>
<div class="row" role="group" aria-label="${t('የካርታ እይታ', 'Map view')}">
<button class="btn" data-a="mapView" data-v="lands" data-k="mv-lands">${t('የመጽሐፍ ቅዱስ አገሮች', 'Bible lands')}</button>
<button class="btn" data-a="mapView" data-v="all" data-k="mv-all">${t('ሁሉም ስፍራዎች', 'All places')}</button>
<button class="btn" data-a="mapView" data-v="land" data-k="mv-land">${t('ቅድስት አገር', 'The Holy Land')}</button>
<button class="btn" data-a="mapView" data-v="city" data-k="mv-city">${t('ኢየሩሳሌምና አካባቢዋ', 'Around Jerusalem')}</button>
<button class="btn" data-a="tiles" data-k="tiles" aria-pressed="${S.tiles}">${icon('globe')}${t('የዛሬ ካርታ', 'Present-day map')}</button></div>
<div class="maps"><div id="mapslot"><p class="muted prose" style="padding:16px">${t('ካርታውን መጫን አልተቻለም።', 'The map could not be loaded.')}</p></div>
<div class="stack mapside">${chosen}<div class="row placelist">${list}</div></div></div>
<p class="muted small">${t('የሥዕሎቹ ስፍራ ግምታዊ ነው፤ አንዳንዶቹም በትውፊት የሚታወቁ ናቸው። የአገሮቹ ስሞች የዛሬዎቹ ናቸው። ስፍራቸው የማይታወቅ ወይም ምሳሌ የሆኑ ታሪኮች ሥዕል የላቸውም። “የዛሬ ካርታ” የኢንተርኔት ግንኙነት ያስፈልገዋል (OpenStreetMap)።', 'Picture positions are approximate and some are traditional sites; country names are present-day. Stories whose location is unknown, and parables, have no picture. “Present-day map” needs an internet connection (OpenStreetMap).')}</p>
<h2>${t('ጠቃሚ ማስፈንጠሪያዎች', 'Helpful links')}</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${links}</div>
</div>`;
}

function notesView() {
  const body = S.notes.length
    ? S.notes.map(noteCard).join('')
    : `<div class="card stack" style="align-items:flex-start"><p class="prose">${t('እስካሁን ማስታወሻ የለም። በጥናት ገጽ አንድ ቁጥር ይንኩና ማስታወሻ ይያዙ።', 'No notes yet. Click a verse on the Study screen and add one.')}</p><button class="btn fill" data-a="nav" data-v="study" data-k="to-study">${t('ጥናት', 'Study')}</button></div>`;
  return `<div class="wrap narrow"><h1>${t('ማስታወሻዎች', 'Notes')}</h1><p class="muted">${t('በጥናት ጊዜ የያዟቸው ማስታወሻዎች ሁሉ በአንድ ቦታ።', 'Every note you take while studying, in one place.')}</p>${body}</div>`;
}

// ---------- journey: the story timeline as a game ----------
// Each story is a lesson: read the passage, then answer questions made from its own verses.
// Hearts left at the end become stars; finishing a story opens the next one.
const ERA_COLORS = ['#58B368', '#4A9FE0', '#E0A23A', '#E0705A', '#A58BEA', '#3CB6B0', '#E487B6', '#8DBB52', '#E8935A'];
const DX = [0, 46, 66, 46, 0, -46, -66, -46];
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const streakNow = () => (S.game.last === dayKey() || S.game.last === dayKey(new Date(Date.now() - 864e5)) ? S.game.streak : 0);
let storyList = null;
const stories = () => storyList || (storyList = C.timeline.flatMap((g, e) => g.items.map((it) => Object.assign({ era: e }, it))));
const shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bare = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const clip = (s, n = 110) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n) > 40 ? s.lastIndexOf(' ', n) : n) + '…' : s);
const marks = (cls, name, got, of, size) => `<span class="${cls}" role="img" aria-label="${got} / ${of}">${Array.from({ length: of }, (_, i) => `<span class="${i < got ? 'on' : ''}">${icon(name, size)}</span>`).join('')}</span>`;

// Returns { state, list: [{ n, text }] } with the story's verses in the first version.
function storyVerses(p) {
  const v = versions[S.primary];
  if (v.dir && !v.books[p.b]) {
    if (v.failed && v.failed[p.b] && !v.pending[p.b]) return { state: 'error', list: [] };
    loadBook(S.primary, p.b);
    return { state: 'loading', list: [] };
  }
  const all = (v.books[p.b] || [])[p.c - 1] || [];
  const list = [];
  for (let n = Math.max(1, p.f || 1); n <= (p.to ? Math.min(p.to, all.length) : all.length); n++) if (all[n - 1]) list.push({ n, text: all[n - 1] });
  return { state: 'ok', list };
}

// Up to three "missing word" and two "which verse comes next" questions, all taken from the passage itself,
// so every story has a quiz in whichever version is being read.
function makeQuiz(list) {
  const qs = [];
  const words = [...new Set(list.flatMap((v) => v.text.split(/\s+/).map(bare)).filter((w) => w.length >= 3))];
  for (const v of shuffle(list)) {
    if (qs.length >= 3) break;
    const parts = v.text.split(/\s+/);
    const cands = parts.map((w, i) => [bare(w), i]).filter((c) => c[0].length >= 3).sort((a, b) => b[0].length - a[0].length).slice(0, 3);
    if (parts.length < 5 || !cands.length) continue;
    const [word, at] = cands[Math.floor(Math.random() * cands.length)];
    const inVerse = new Set(parts.map(bare));
    const wrong = shuffle(shuffle(words.filter((w) => !inVerse.has(w))).sort((a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length)).slice(0, 6)).slice(0, 3);
    if (wrong.length < 3) continue;
    qs.push({ kind: 'word', n: v.n, text: parts.map((w, i) => (i === at ? w.replace(word, '\u0000') : w)).join(' '), full: v.text, options: shuffle([word].concat(wrong)), answer: word });
  }
  if (list.length >= 4) {
    for (const i of shuffle(list.map((_, k) => k).slice(0, -1)).slice(0, 2)) {
      const next = list[i + 1];
      const wrong = shuffle(list.filter((v, k) => k !== i && k !== i + 1 && v.text !== next.text)).slice(0, 2);
      if (wrong.length < 2) continue;
      qs.push({ kind: 'next', n: list[i].n, text: list[i].text, full: next.text, fullN: next.n, options: shuffle([next].concat(wrong)).map((v) => clip(v.text)), answer: clip(next.text) });
    }
  }
  return shuffle(qs);
}

function finishStory() {
  const p = S.play, g = S.game, first = !g.done[p.i];
  p.stars = Math.max(1, p.hearts);
  p.gained = p.right * 10 + (first ? 20 : 0);
  g.xp += p.gained;
  g.done[p.i] = Math.max(g.done[p.i] || 0, p.stars);
  if (g.last !== dayKey()) { g.streak = streakNow() + 1; g.last = dayKey(); }
  p.step = 'done';
  save('game');
}

function lessonView() {
  const p = S.play, st = stories()[p.i], era = C.timeline[st.era];
  const lang = versions[S.primary].language;
  const top = (fill, right) => `<div class="row lesson-top"><button class="btn" data-a="storyQuit" data-k="quit" aria-label="${t('ወደ ጉዞው ተመለስ', 'Back to the journey')}" title="${t('ወደ ጉዞው ተመለስ', 'Back to the journey')}">${icon('close')}</button><div class="bar" style="flex:1"><i style="width:${fill}%"></i></div>${right}</div>`;
  let body;
  if (p.step === 'read') {
    const vs = storyVerses(st.p);
    let text;
    if (vs.state === 'loading') text = `<p class="muted prose" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
    else if (vs.state === 'error') text = `<p class="prose" role="alert">${t('ጽሑፉን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱና እንደገና ይሞክሩ።', 'The text could not be loaded. Check your connection and try again.')}</p><button class="btn" data-a="story" data-v="${p.i}" data-k="reload">${t('እንደገና ሞክር', 'Try again')}</button>`;
    else if (!vs.list.length) text = `<p class="prose">${t('ለዚህ ክፍል በተመረጠው ትርጉም ጽሑፍ የለም።', 'The selected version has no text for this passage.')}</p>`;
    else text = `<div class="verses story-text" lang="${lang}">${vs.list.map((v) => `<p><sup>${v.n} </sup>${esc(v.text)}</p>`).join('')}</div>`;
    body = top(0, '') + `<div class="stack" style="gap:4px"><span class="pill" style="background:var(--era);color:#14161A">${esc(tp(era.n))} · ${p.i + 1} / ${stories().length}</span><h1>${esc(tp(st.n))}</h1><span class="muted small">${esc(passRef(st.p))}</span></div>
${videoCard(st.p.b, st.p.c)}
<article class="card stack">${text}</article>
${vs.state === 'ok' ? `<button class="btn fill go" data-a="storyQuiz" data-k="quiz">${vs.list.length ? t('ጥያቄዎቹን ጀምር', 'Start the quiz') : t('ቀጥል', 'Continue')}${icon('right')}</button>` : ''}`;
  } else if (p.step === 'quiz') {
    const q = p.qs[p.q], answered = p.picked != null, right = answered && q.options[p.picked] === q.answer;
    const prompt = q.kind === 'word'
      ? esc(q.text).replace('\u0000', '<span class="blank"></span>')
      : esc(q.text);
    const opts = q.options.map((o, i) => `<button class="opt${answered && o === q.answer ? ' right' : ''}${answered && i === p.picked && o !== q.answer ? ' wrong' : ''}" data-a="answer" data-v="${i}" data-k="opt-${p.q}-${i}" lang="${lang}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`).join('');
    body = top(Math.round(((p.q + (answered ? 1 : 0)) / p.qs.length) * 100), marks('hearts', 'heart', p.hearts, 3, 22)) +
      `<div class="stack" style="gap:4px"><span class="muted small"><b>${t('ጥያቄ', 'Question')} ${p.q + 1} / ${p.qs.length}</b></span><h2>${q.kind === 'word' ? t('የጎደለው ቃል የትኛው ነው?', 'Which word is missing?') : t('ቀጥሎ የሚመጣው ቁጥር የትኛው ነው?', 'Which verse comes next?')}</h2></div>
<div class="card"><p class="prose big" lang="${lang}"><sup class="muted">${q.n} </sup>${prompt}</p></div>
<div class="stack">${opts}</div>
${answered ? `<div class="verdict ${right ? 'good' : 'bad'} stack" role="status"><b>${right ? t('ትክክል!', 'Correct!') : t('ትክክል አይደለም', 'Not quite')}</b><span lang="${lang}"><sup>${q.fullN || q.n} </sup>${esc(q.full)}</span></div>
<button class="btn fill go" data-a="storyNext" data-k="next-q">${t('ቀጥል', 'Continue')}${icon('right')}</button>` : ''}`;
  } else if (p.step === 'fail') {
    body = top(0, marks('hearts', 'heart', 0, 3, 22)) + `<div class="card stack trophy"><span class="hearts big-mark">${icon('heart', 56)}</span><h1>${t('ልቦች አልቀዋል', 'Out of hearts')}</h1><p class="muted prose">${t('ታሪኩን እንደገና ያንብቡና ደግመው ይሞክሩ።', 'Read the story again and have another go.')}</p>
<button class="btn fill go" data-a="story" data-v="${p.i}" data-k="retry">${t('እንደገና ሞክር', 'Try again')}</button></div>`;
  } else {
    const more = p.i + 1 < stories().length;
    const eraDone = era.items.length && stories().every((s, i) => s.era !== st.era || S.game.done[i]);
    body = top(100, '') + `<div class="card stack trophy">${marks('stars big-mark', 'star', p.stars, 3, 48)}<h1>${t('ታሪኩን ጨርሰዋል!', 'Story complete!')}</h1><p class="muted">${esc(tp(st.n))}</p>
${eraDone ? `<span class="pill" style="background:var(--era);color:#14161A">${icon('check', 14)} ${esc(tp(era.n))} · ${t('ዘመኑ ተጠናቋል', 'era complete')}</span>` : ''}
<div class="row" style="justify-content:center"><span class="chip xp">${icon('bolt')}+${p.gained} ${t('ነጥብ', 'XP')}</span><span class="chip fire">${icon('flame')}${streakNow()} ${t('ተከታታይ ቀን', streakNow() === 1 ? 'day streak' : 'day streak')}</span></div>
${more ? `<button class="btn fill go" data-a="story" data-v="${p.i + 1}" data-k="next-story">${t('ቀጣዩ ታሪክ', 'Next story')}${icon('right')}</button>` : ''}
<button class="btn go" data-a="storyStudy" data-k="deeper">${icon('book')}${t('በጥልቀት አጥና', 'Study it in depth')}</button>
<button class="btn go" data-a="storyQuit" data-k="back">${t('ወደ ጉዞው ተመለስ', 'Back to the journey')}</button></div>`;
  }
  return `<div class="wrap lesson" style="--era:${ERA_COLORS[st.era % ERA_COLORS.length]}">${body}</div>`;
}

function journeyView() {
  if (S.play) return lessonView();
  const all = stories(), g = S.game;
  const got = all.filter((_, i) => g.done[i]).length;
  const cur = all.findIndex((_, i) => !g.done[i]);
  const stat = (cls, ic, value, label) => `<div class="stat ${cls}">${icon(ic, 24)}<div class="stack" style="gap:0"><b>${value}</b><span class="muted small">${label}</span></div></div>`;
  let k = 0;
  const eras = C.timeline.map((era, e) => {
    const start = k;
    const nodes = era.items.map((it, j) => {
      const i = k++;
      const state = g.done[i] ? 'done' : i === cur ? 'now' : 'locked';
      return `<div class="node ${state}" style="--dx:${DX[j % DX.length]}px">
<button class="orb" data-a="story" data-v="${i}" data-k="story-${i}" ${state === 'locked' ? 'disabled' : ''} aria-label="${esc(tp(it.n))}${state === 'locked' ? t(' (ተቆልፏል)', ' (locked)') : ''}">${icon(state === 'done' ? 'check' : state === 'now' ? 'play' : 'lock', 28)}</button>
${state === 'done' ? marks('stars', 'star', g.done[i], 3, 16) : state === 'now' ? `<button class="pill start" data-a="story" data-v="${i}" data-k="start-${i}">${t('ጀምር', 'Start')}</button>` : ''}
<b>${esc(tp(it.n))}</b><span class="muted small">${esc(tp(it.sub))}</span></div>`;
    }).join('');
    const n = era.items.filter((_, j) => g.done[start + j]).length;
    return `<section class="era" style="--era:${ERA_COLORS[e % ERA_COLORS.length]}">
<div class="era-head stack" style="gap:8px"><div class="row between"><b style="font-size:19px">${e + 1}. ${esc(tp(era.n))}</b><b class="small">${n === era.items.length ? icon('check', 14) + ' ' : ''}${n} / ${era.items.length}</b></div><div class="bar"><i style="width:${Math.round((n / era.items.length) * 100)}%"></i></div></div>
<div class="path">${nodes}</div></section>`;
  });
  return `<div class="wrap" style="max-width:720px">
<div class="stack"><h1>${t('የታሪክ ጉዞ', 'Story journey')}</h1><p class="muted">${t('ታሪኮቹን በቅደም ተከተል ያንብቡ፣ ጥያቄዎቹን ይመልሱ፣ ኮከቦችን ይሰብስቡ።', 'Read the stories in order, answer the questions, and collect stars.')}</p></div>
<div class="stats">${stat('lvl', 'star', Math.floor(g.xp / 100) + 1, t('ደረጃ', 'Level'))}${stat('xp', 'bolt', g.xp, t('ነጥብ', 'XP'))}${stat('fire', 'flame', streakNow(), t('ተከታታይ ቀናት', 'Day streak'))}${stat('count', 'check', got + ' / ' + all.length, t('ታሪኮች', 'Stories'))}</div>
${eras.join('')}
</div>`;
}

// Each screen remembers how far down it was scrolled, also after the app is closed and reopened.
function scrollKey() {
  if (S.screen === 'study') return 'study:' + S.pass.b + '.' + S.pass.c;
  if (S.screen === 'browse') return 'browse:' + (S.searchOn ? 'search' : S.browse);
  return S.screen;
}
function restoreScroll() {
  if (!restoreScroll.want || S.screen === 'journey') { restoreScroll.want = false; return; }
  const top = S.scrolls[scrollKey()] || 0;
  // Content may still be loading; wait until the page is tall enough, for a few renders at most.
  restoreScroll.tries = (restoreScroll.tries || 0) + 1;
  if (document.documentElement.scrollHeight - window.innerHeight >= top - 4 || restoreScroll.tries > 6) {
    restoreScroll.lock = true;
    window.scrollTo(0, top);
    restoreScroll.want = false;
    restoreScroll.tries = 0;
    setTimeout(() => { restoreScroll.lock = false; }, 100);
  }
}
restoreScroll.want = true;       // on opening the app, go back to where the reader was
let scrollTimer = null;
window.addEventListener('scroll', () => {
  if (restoreScroll.lock || restoreScroll.want || !C) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const key = scrollKey();
    S.scrolls[key] = Math.round(window.scrollY);
    const studyKeys = Object.keys(S.scrolls).filter((k) => k.startsWith('study:') && k !== key);
    studyKeys.slice(0, Math.max(0, studyKeys.length - 20)).forEach((k) => delete S.scrolls[k]);   // keep the list short
    save('scrolls');
  }, 250);
}, { passive: true });

function render() {
  if (!C) return;
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  const caret = active === 'draft' || active === 'q' ? document.activeElement.selectionStart : null;
  const panel = root.querySelector('.sidepanel');
  const panelKey = S.screen + '|' + S.tab + '|' + S.pass.b + '.' + S.pass.c;
  const panelTop = panel && render.panelKey === panelKey ? panel.scrollTop : 0;
  render.panelKey = panelKey;
  const paneKey = S.pass.b + '.' + S.pass.c + '|' + S.primary + '|' + S.secondary;
  const paneTops = render.paneKey === paneKey ? [...root.querySelectorAll('.pane')].map((el) => el.scrollTop) : [];
  render.paneKey = paneKey;
  opens = [];
  vids = [];
  root.dataset.theme = S.dark ? 'dark' : 'light';
  root.dataset.play = S.screen === 'journey' && S.play ? '1' : ''; // small screens hide the menu during a lesson
  document.documentElement.lang = S.en ? 'en' : 'am';
  document.body.style.background = S.dark ? '#27292C' : '#F5F5F6';
  if (!S.user && !S.guest) {            // the login page comes first
    root.innerHTML = loginView();
    mountGoogleButton();
    return;
  }
  const view = S.screen === 'journey' ? journeyView() : S.screen === 'study' ? studyView() : S.screen === 'notes' ? notesView() : S.screen === 'map' ? mapView() : browseView();
  root.innerHTML = sideMenu() + '<main>' + view + '</main>';
  const newPanel = root.querySelector('.sidepanel');
  if (newPanel && panelTop) newPanel.scrollTop = panelTop;     // keep the side panel where the reader left it
  if (S.jump && S.screen === 'journey' && !S.play) {
    // On arriving at the journey, bring the next story to play into view.
    const now = root.querySelector('.node.now');
    if (now && S.game.done[0]) now.scrollIntoView({ block: 'center' });
    S.jump = false;
  }
  const slot = root.querySelector('#mapslot');
  if (slot) {
    const el = ensureMap();
    if (el) {
      slot.replaceChildren(el);
      lmap.invalidateSize();
      lmarkers.forEach((m, i) => { m.setIcon(pinIcon(i)); m.setZIndexOffset(S.place === i ? 1000 : 0); m.unbindTooltip(); m.bindTooltip(tp(C.places[i].n)); });
    }
  }
  root.querySelectorAll('.pane').forEach((pane, i) => {
    if (paneTops[i]) pane.scrollTop = paneTops[i];
    // When a verse is chosen, bring the same verse into view in the other pane.
    const el = S.sel && render.lastSel !== S.sel ? pane.querySelector('.verse[data-v="' + S.sel + '"]') : null;
    if (el && (el.offsetTop < pane.scrollTop + 36 || el.offsetTop + el.offsetHeight > pane.scrollTop + pane.clientHeight)) pane.scrollTop = el.offsetTop - 44;
  });
  render.lastSel = S.sel;
  if (S.goVerse) {
    // Arriving from a search result: bring the verse into view once its chapter has loaded.
    const el = root.querySelector('.verse[data-v="' + S.goVerse + '"]');
    if (el) {
      if (!el.closest('.pane')) el.scrollIntoView({ block: 'center' });
      S.goVerse = null;
      restoreScroll.want = false;
    }
  } else restoreScroll();
  if (active) {
    const el = root.querySelector('[data-k="' + active + '"]');
    if (el) { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange(caret, caret); }
  }
}

// ---------- actions ----------
function setPass(change) {
  Object.values(versions).forEach((v) => { v.failed = {}; });
  S.pass = Object.assign({ b: S.pass.b, c: S.pass.c, f: S.pass.f, to: S.pass.to }, change);
  S.sel = null;
  S.more = 8;
  save('pass', 'sel');
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    const started = Date.now();
    const at = { b: S.pass.b, c: S.pass.c, v: S.sel };
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const id = uid();
      try {
        await idb('audio', 'readwrite', (store) => store.put(new Blob(chunks, { type: rec.mimeType }), id));
        S.notes.unshift(Object.assign({ id, date: Date.now(), text: '', audio: true, dur: Math.max(1, Math.round((Date.now() - started) / 1000)) }, at));
        save('notes');
      } catch (e) {
        S.msg = t('የድምፅ ማስታወሻውን ማስቀመጥ አልተቻለም።', 'The voice note could not be saved.');
      }
      S.recording = false;
      recorder = null;
      render();
    };
    rec.start();
    recorder = rec;
    S.recording = true;
    S.msg = '';
  } catch (e) {
    S.msg = t('ማይክሮፎኑን መጠቀም አልተቻለም። ለዚህ ገጽ የማይክሮፎን ፈቃድ ይስጡና እንደገና ይሞክሩ።', 'The microphone could not be used. Allow microphone access for this page and try again.');
  }
  S.tab = 'notes';
  S.focus = false;
  render();
}

const actions = {
  nav(v) { S.screen = v; S.play = null; S.jump = true; save('screen'); restoreScroll.want = true; },
  story(v) {
    const i = +v;
    if (i > 0 && !S.game.done[i - 1]) return false;
    Object.values(versions).forEach((ver) => { ver.failed = {}; });
    S.play = { i, step: 'read', qs: [], q: 0, hearts: 3, right: 0, picked: null };
    window.scrollTo(0, 0);
  },
  storyQuit() { S.play = null; S.jump = true; },
  storyQuiz() {
    const vs = storyVerses(stories()[S.play.i].p);
    if (vs.state !== 'ok') return false;
    S.play.qs = makeQuiz(vs.list);
    if (S.play.qs.length) S.play.step = 'quiz'; else finishStory();
    window.scrollTo(0, 0);
  },
  answer(v) {
    const p = S.play, q = p.qs[p.q];
    if (p.picked != null) return false;
    p.picked = +v;
    if (q.options[p.picked] === q.answer) p.right++; else p.hearts--;
  },
  storyNext() {
    const p = S.play;
    p.picked = null;
    if (p.hearts <= 0) p.step = 'fail';
    else if (p.q + 1 < p.qs.length) p.q++;
    else finishStory();
    window.scrollTo(0, 0);
  },
  storyStudy() {
    const st = stories()[S.play.i];
    S.pass = { b: st.p.b, c: st.p.c, f: st.p.f, to: st.p.to, title: st.n, pl: st.pl };
    S.play = null; S.sel = null; S.more = 8; S.screen = 'study';
    save('pass', 'screen');
    window.scrollTo(0, 0);
  },
  lang() { S.en = !S.en; save('en'); },
  guest() { S.guest = true; S.msg = ''; save('guest'); },
  signIn() { S.guest = false; S.msg = ''; save('guest'); },
  signOut() {
    S.user = null; S.guest = false; save('user', 'guest');
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();   // do not sign straight back in
  },
  theme() { S.dark = !S.dark; save('dark'); },
  browse(v) { S.browse = v; save('browse'); },
  book(v) { S.openBook = S.openBook === +v ? null : +v; save('openBook'); },
  chapter(v) { const [b, c] = v.split('.').map(Number); S.pass = { b, c, f: 1, to: 0 }; S.sel = null; S.more = 8; S.screen = 'study'; save('pass', 'screen', 'sel'); window.scrollTo(0, 0); },
  jumpTo(v) { const el = document.getElementById(v); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return false; },
  clearSearch() { S.q = ''; S.searchOn = false; S.results = null; save('q', 'searchOn'); },
  moreResults() { S.shown += 100; },
  openResult(v) {
    const r = S.results[+v];
    // Show the version that was searched without changing the reader's main version.
    const id = versions[S.qv] ? S.qv : S.primary;
    if (id !== S.primary && (id !== S.secondary || !S.split)) { S.secondary = id; S.split = true; save('split'); }
    S.pass = { b: r.b, c: r.c, f: 1, to: 0 }; S.sel = r.v; S.goVerse = r.v; S.more = 8; S.screen = 'study';
    save('pass', 'screen', 'sel', 'primary', 'secondary');
  },
  concept(v) { S.theme = S.theme === +v ? null : +v; },
  open(v) { S.pass = opens[+v]; S.sel = null; S.more = 8; S.screen = 'study'; save('pass', 'screen'); window.scrollTo(0, 0); },
  verse(v) { S.sel = S.sel === +v ? null : +v; S.more = 8; save('sel'); },
  hl(v) { S.highlights[hlKey(S.sel)] = v; save('highlights'); },
  clearHl() { delete S.highlights[hlKey(S.sel)]; save('highlights'); },
  tab(v) { S.tab = v; save('tab'); },
  place(v) { S.place = +v; save('place'); const p = C.places[S.place]; if (lmap) lmap.setView([p.lat, p.lon], Math.max(lmap.getZoom(), 9)); },
  mapView(v) { if (lmap) lmap.fitBounds(MAP_VIEWS[v](), { padding: [30, 30] }); return false; },
  tiles() { S.tiles = !S.tiles; save('tiles'); },
  showPlace() { const i = C.places.findIndex((p) => p.id === S.pass.pl); if (i < 0) return false; S.place = i; S.screen = 'map'; save('screen'); setTimeout(() => { if (lmap) lmap.setView([C.places[i].lat, C.places[i].lon], 10); }, 0); },
  picker() { S.picker = !S.picker; },
  intro() { S.intro = !S.intro; },
  prevCh() {
    const p = S.pass;
    if (p.c > 1) setPass({ c: p.c - 1, f: 1, to: 0 });
    else if (p.b > 0) setPass({ b: p.b - 1, c: C.books[p.b - 1].ch, f: 1, to: 0 });
    window.scrollTo(0, 0);
  },
  nextCh() {
    const p = S.pass;
    if (p.c < C.books[p.b].ch) setPass({ c: p.c + 1, f: 1, to: 0 });
    else if (p.b < 65) setPass({ b: p.b + 1, c: 1, f: 1, to: 0 });
    window.scrollTo(0, 0);
  },
  more() { S.more += 12; },
  split() { S.split = !S.split; save('split'); },
  layout(v) { S.layout = v; save('layout'); },
  focus() { S.focus = !S.focus; },
  smaller() { S.size = Math.max(0, S.size - 1); save('size'); },
  larger() { S.size = Math.min(3, S.size + 1); save('size'); },
  noteTab() { S.tab = 'notes'; S.focus = false; },
  saveNote() {
    const text = S.draft.trim();
    if (!text) return;
    S.notes.unshift({ id: uid(), date: Date.now(), b: S.pass.b, c: S.pass.c, v: S.sel, text });
    S.draft = '';
    save('notes');
  },
  rec() { startRecording(); return false; },
  stop() { if (recorder) recorder.stop(); return false; },
  play(v) {
    idb('audio', 'readonly', (store) => store.get(v)).then((blob) => { if (blob) new Audio(URL.createObjectURL(blob)).play(); });
    return false;
  },
  del(v) {
    const note = S.notes.find((n) => n.id === v);
    S.notes = S.notes.filter((n) => n.id !== v);
    save('notes');
    if (note && note.audio) idb('audio', 'readwrite', (store) => store.delete(v)).catch(() => {});
  },
  openNote(v) {
    const note = S.notes.find((n) => n.id === v);
    if (!note) return;
    S.pass = { b: note.b, c: note.c, f: 1, to: 0 };
    S.sel = note.v || null;
    S.screen = 'study';
    S.tab = 'notes';
    save('pass', 'screen');
  },
  reload() { location.reload(); return false; },
  video(v) { openVideo(vids[+v]); return false; },
  import() { fileInput.click(); return false; }
};

const changes = {
  book(v) { setPass({ b: +v, c: 1, f: 1, to: 0 }); },
  chap(v) { setPass({ c: +v, f: 1, to: 0 }); },
  from(v) { setPass({ f: +v, to: S.pass.to && S.pass.to < +v ? 0 : S.pass.to }); },
  to(v) { setPass({ to: +v, f: +v && S.pass.f > +v ? 1 : S.pass.f }); },
  primary(v) { S.primary = v; pickVersions(); save('primary', 'secondary'); },
  secondary(v) { S.secondary = v; save('secondary'); },
  qv(v) { S.qv = v; save('qv'); if (S.searchOn) { runSearch(); } }
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
  if (el.tagName === 'A') e.preventDefault(); // links that open in the app, such as videos, stay links only as a fallback
  if (actions[el.dataset.a](el.dataset.v) !== false) render();
});
root.addEventListener('change', (e) => {
  const el = e.target.closest('[data-c]');
  if (!el) return;
  changes[el.dataset.c](el.value);
  render();
});
root.addEventListener('input', (e) => {
  if (e.target.id === 'draft') S.draft = e.target.value;
  if (e.target.id === 'q') S.q = e.target.value;
});
root.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-search]')) return;
  e.preventDefault();
  runSearch();
});

// Importing a Bible file keeps it in this browser only; nothing is uploaded.
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ok = data && typeof data.id === 'string' && data.id && typeof data.name === 'string' && Array.isArray(data.books) && data.books.length === 66 && data.books.every(Array.isArray);
    if (!ok) throw new Error('format');
    const version = { id: data.id, name: data.name, language: data.language || 'am', books: data.books };
    await idb('bibles', 'readwrite', (store) => store.put(version));
    versions[version.id] = version;
    S.primary = version.id;
    pickVersions();
    save('primary', 'secondary');
    S.msg = '';
  } catch (e) {
    alert(t('ፋይሉ ትክክለኛ የመጽሐፍ ቅዱስ ቅርጸት የለውም። README ውስጥ ያለውን ቅርጸት ይመልከቱ።', 'This file is not in the app’s Bible format. See the format described in the README.'));
  }
  render();
});

// ---------- start ----------
async function start() {
  try {
    const imported = await idb('bibles', 'readonly', (store) => store.getAll());
    (imported || []).forEach((v) => { versions[v.id] = v; });
  } catch (e) { /* no stored Bibles */ }
  pickVersions();
  try {
    const res = await fetch('data/content.json', { cache: 'no-cache' }); // always ask the server, so content and code stay in step
    if (!res.ok) throw new Error(res.status);
    C = await res.json();
  } catch (e) {
    root.innerHTML = '<main><p role="alert" style="padding:24px">The app could not load its content. Check your connection and reload the page.</p></main>';
    return;
  }
  try { const r = await fetch('data/fathers/index.json'); if (r.ok) F.index = await r.json(); } catch (e) { /* fathers data unavailable */ }
  if (!C.books[S.pass.b]) S.pass = DEFAULT_PASS;
  if (!C[S.browse]) S.browse = 'timeline';
  render();
  if (S.searchOn && S.screen === 'browse' && (S.user || S.guest)) runSearch();   // bring back the last search
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
