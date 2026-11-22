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

// IndexedDB holds imported Bibles, voice recordings, and each account's own study data
// (highlights, notes and Journey progress), one record per account.
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('qalu', 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('bibles')) db.createObjectStore('bibles', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
    if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' });
  };
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
  screen: ls.get('screen', 'study'),   // the app opens on the reader, like any Bible app
  browse: ls.get('browse', 'timeline'),
  pass: ls.get('pass', DEFAULT_PASS),
  sel: ls.get('sel', null),
  tab: ls.get('tab', 'fathers'),
  split: ls.get('split', true),
  layout: ls.get('layout2', 'verse'), // 'verse' = each verse with its second version under it; 'stack' = two panes; 'side' = two columns
  focus: false,
  size: ls.get('size', 1),
  primary: ls.get('primary', ''),
  secondary: ls.get('secondary', 'kjv'),
  recent: ls.get('recent', []),
  mapLayer: ls.get('mapLayer', 'pic'),
  mapMode: ls.get('mapMode', 'atlas'),
  atlas: ls.get('atlas', {}),
  atlasSel: null,
  picOpacity: ls.get('picOpacity', 0.85),     // versions read lately, shown as one-tap buttons over the text
  highlights: {},   // these three belong to the account in use; see loadAccount()
  notes: [],
  draft: '',
  more: 8,
  picker: false,
  intro: false,
  place: ls.get('place', 0),
  theme: null, // the concept whose detail is open
  persp: null, // the concept whose theological perspectives are open
  inter: ls.get('inter', false), // show the Hebrew or Greek words under each verse
  word: null,   // the word picked in the original-language view: its index in the selected verse
  tiles: ls.get('tiles', false), // show the present-day map tiles in place of the illustrated map
  recording: false,
  msg: '',
  game: { xp: 0, streak: 0, last: '', done: {} }, // done: story number -> stars earned (1 to 3)
  gone: [], updated: 0, // see blankAccount()
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
  am54: { id: 'am54', name: 'መጽሐፍ ቅዱስ 1954 (አማርኛ)', short: 'አማ 1954', language: 'am', dir: 'data/am54', books: {},
    credit: 'Amharic Bible (1954/1962). Text from Beblia/Holy-Bible-XML-Format.' },
  am2000: { id: 'am2000', name: 'አማርኛ 2000 (ሰማንያ አሐዱ)', short: 'አማ 2000', language: 'am', dir: 'data/am2000', books: {},
    credit: 'Amharic 2000, Bible Society of Ethiopia. Text from Beblia/Holy-Bible-XML-Format.' },
  amnst: { id: 'amnst', name: 'አዲሱ መደበኛ ትርጉም 2005 (አማ05)', short: 'አማ 2005', language: 'am', dir: 'data/amnst', books: {},
    credit: 'Amharic New Standard Translation © The Bible Society of Ethiopia, 2005. Text from Beblia/Holy-Bible-XML-Format.' },
  amnasv: { id: 'amnasv', name: 'አዲሱ መደበኛ ትርጒም (NASV)', short: 'NASV', language: 'am', dir: 'data/amnasv', books: {},
    credit: 'Holy Bible, New Amharic Standard Version™ Copyright © 2001 by Biblica, Inc. Used with permission. All rights reserved worldwide.' },
  amcath: { id: 'amcath', name: 'ካቶሊካዊ እትም (ኤማሁስ)', short: 'ካቶሊክ', language: 'am', dir: 'data/amcath', books: {},
    credit: 'Amharic Catholic Version (Emmaus), Bible Society of Ethiopia. Text from Beblia/Holy-Bible-XML-Format.' },
  amulb: { id: 'amulb', name: 'አማርኛ ULB (Unlocked Literal Bible)', short: 'ULB', language: 'am', dir: 'data/amulb', books: {},
    credit: 'Amharic Unlocked Literal Bible. Original work available at https://door43.org/. Licensed CC BY-SA 4.0.' },
  orig: { id: 'orig', name: 'ዕብራይስጥና ግሪክ (ዋናው ጽሑፍ) · Hebrew and Greek', language: 'orig', dir: 'data/orig', books: {},
    credit: 'Hebrew and Greek text from STEPBible TAHOT and TAGNT (Tyndale House, Cambridge), CC BY 4.0; the Greek follows the Nestle-Aland text.' },
  niv: { id: 'niv', name: "New International Version", short: 'NIV', language: 'en', dir: 'data/niv', books: {}, credit: "New International Version (NIV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  esv: { id: 'esv', name: "English Standard Version", short: 'ESV', language: 'en', dir: 'data/esv', books: {}, credit: "English Standard Version (ESV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  nlt: { id: 'nlt', name: "New Living Translation", short: 'NLT', language: 'en', dir: 'data/nlt', books: {}, credit: "New Living Translation (NLT), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  nkjv: { id: 'nkjv', name: "New King James Version", short: 'NKJV', language: 'en', dir: 'data/nkjv', books: {}, credit: "New King James Version (NKJV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  nasb: { id: 'nasb', name: "New American Standard Bible (1995)", short: 'NASB', language: 'en', dir: 'data/nasb', books: {}, credit: "New American Standard Bible (1995) (NASB), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  csb: { id: 'csb', name: "Christian Standard Bible", short: 'CSB', language: 'en', dir: 'data/csb', books: {}, credit: "Christian Standard Bible (CSB), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  nrsv: { id: 'nrsv', name: "New Revised Standard Version", short: 'NRSV', language: 'en', dir: 'data/nrsv', books: {}, credit: "New Revised Standard Version (NRSV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  rsv: { id: 'rsv', name: "Revised Standard Version", short: 'RSV', language: 'en', dir: 'data/rsv', books: {}, credit: "Revised Standard Version (RSV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  amp: { id: 'amp', name: "Amplified Bible", short: 'AMP', language: 'en', dir: 'data/amp', books: {}, credit: "Amplified Bible (AMP), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  ampc: { id: 'ampc', name: "Amplified Bible, Classic Edition", short: 'AMPC', language: 'en', dir: 'data/ampc', books: {}, credit: "Amplified Bible, Classic Edition (AMPC), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  net: { id: 'net', name: "New English Translation (NET)", short: 'NET', language: 'en', dir: 'data/net', books: {}, credit: "New English Translation (NET) (NET), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  gnt: { id: 'gnt', name: "Good News Translation", short: 'GNT', language: 'en', dir: 'data/gnt', books: {}, credit: "Good News Translation (GNT), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  mev: { id: 'mev', name: "Modern English Version", short: 'MEV', language: 'en', dir: 'data/mev', books: {}, credit: "Modern English Version (MEV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  lsb: { id: 'lsb', name: "Legacy Standard Bible", short: 'LSB', language: 'en', dir: 'data/lsb', books: {}, credit: "Legacy Standard Bible (LSB), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  erv: { id: 'erv', name: "Easy-to-Read Version", short: 'ERV', language: 'en', dir: 'data/erv', books: {}, credit: "Easy-to-Read Version (ERV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  gw: { id: 'gw', name: "GOD'S WORD Translation", short: 'GW', language: 'en', dir: 'data/gw', books: {}, credit: "GOD'S WORD Translation (GW), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  nirv: { id: 'nirv', name: "New International Reader's Version", short: 'NIrV', language: 'en', dir: 'data/nirv', books: {}, credit: "New International Reader's Version (NIrV), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  easy: { id: 'easy', name: "EasyEnglish Bible (2024)", short: 'EASY', language: 'en', dir: 'data/easy', books: {}, credit: "EasyEnglish Bible (2024) (EASY), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  tlb: { id: 'tlb', name: "The Living Bible", short: 'TLB', language: 'en', dir: 'data/tlb', books: {}, credit: "The Living Bible (TLB), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  hcsb: { id: 'hcsb', name: "Holman Christian Standard Bible", short: 'HCSB', language: 'en', dir: 'data/hcsb', books: {}, credit: "Holman Christian Standard Bible (HCSB), © its publisher; all rights reserved. Text from Beblia/Holy-Bible-XML-Format, for personal study." },
  bsb: { id: 'bsb', name: 'Berean Standard Bible', language: 'en', dir: 'data/bsb', books: {},
    credit: 'Berean Standard Bible (BSB), dedicated to the public domain (CC0).' },
  web: { id: 'web', name: 'World English Bible', language: 'en', dir: 'data/web', books: {} },
  kjv: { id: 'kjv', name: 'King James Version', language: 'en', dir: 'data/kjv', books: {} },
  asv: { id: 'asv', name: 'American Standard Version', language: 'en', dir: 'data/asv', books: {} },
  ylt: { id: 'ylt', name: 'Young’s Literal Translation', language: 'en', dir: 'data/ylt', books: {} },
  bbe: { id: 'bbe', name: 'Bible in Basic English', language: 'en', dir: 'data/bbe', books: {} },
  darby: { id: 'darby', name: 'Darby Bible (1889)', language: 'en', dir: 'data/darby', books: {} },
  nheb: { id: 'nheb', name: 'New Heart English Bible', language: 'en', dir: 'data/nheb', books: {} },
  webster: { id: 'webster', name: 'Webster Bible (1833)', language: 'en', dir: 'data/webster', books: {} },
  geneva: { id: 'geneva', name: 'Geneva Bible (1599)', language: 'en', dir: 'data/geneva', books: {} },
  acv: { id: 'acv', name: 'A Conservative Version', language: 'en', dir: 'data/acv', books: {} },
  ukjv: { id: 'ukjv', name: 'Updated King James Version', language: 'en', dir: 'data/ukjv', books: {} },
  rotherham: { id: 'rotherham', name: 'Rotherham Emphasised Bible (1902)', language: 'en', dir: 'data/rotherham', books: {} },
  twenty: { id: 'twenty', name: 'Twentieth Century New Testament (1904)', language: 'en', dir: 'data/twenty', books: {} }
};
// Short labels for the one-tap version buttons.
Object.entries({ orig: 'ዕብ/ግሪክ', bsb: 'BSB', web: 'WEB', kjv: 'KJV', asv: 'ASV', ylt: 'YLT', bbe: 'BBE', darby: 'Darby', nheb: 'NHEB',
  webster: 'Webster', geneva: 'Geneva', acv: 'ACV', ukjv: 'UKJV', rotherham: 'Rotherham', twenty: 'TCNT' }).forEach(([id, s]) => { versions[id].short = s; });
// The version lists are grouped by language family.
const VERSION_GROUPS = [
  [['አማርኛ', 'Amharic'], ['am54', 'am2000', 'amnst', 'amnasv', 'amcath', 'amulb']],
  [['ዋናው ጽሑፍ', 'Original languages'], ['orig']],
  [['እንግሊዝኛ (ዘመናዊ)', 'English (modern)'], ['niv', 'esv', 'nlt', 'nkjv', 'nasb', 'csb', 'nrsv', 'rsv', 'amp', 'ampc', 'net', 'gnt', 'mev', 'lsb', 'erv', 'gw', 'nirv', 'easy', 'tlb', 'hcsb']],
  [['እንግሊዝኛ (ነጻ)', 'English (public domain)'], ['bsb', 'web', 'kjv', 'nheb', 'ukjv', 'acv', 'asv', 'bbe', 'ylt', 'darby', 'rotherham', 'webster', 'twenty', 'geneva']]
];
function versionOptions(selected) {
  const listed = new Set(VERSION_GROUPS.flatMap((g) => g[1]));
  const groups = VERSION_GROUPS.map((g) => [tp(g[0]), g[1].filter((id) => versions[id])]);
  const others = Object.keys(versions).filter((id) => !listed.has(id));   // imported files
  if (others.length) groups.push([t('ያስገቧቸው', 'Imported'), others]);
  return groups.filter((g) => g[1].length).map((g) => `<optgroup label="${esc(g[0])}">${options(g[1].map((id) => [id, versions[id].name]), selected)}</optgroup>`).join('');
}
// The lang and dir attributes for a version's text. The Hebrew and Greek version is Hebrew (right to left) in
// the Old Testament and Greek in the New.
function langOf(id, b = S.pass.b) {
  const v = versions[id];
  if (!v) return 'lang="en"';
  if (v.language === 'orig') return b < 39 ? 'lang="he" dir="rtl"' : 'lang="grc"';
  return `lang="${v.language}"`;
}
// Church fathers' commentary, one file per chapter, listed in an index so missing chapters are not requested.
const F = { index: {}, cache: {}, pending: {} };
// Book introductions and chapter notes for the Context tab, one file per book.
const X = { cache: {}, pending: {} };
// The Hebrew and Greek words of each chapter (STEPBible, CC BY 4.0), one file per chapter, and one shared
// dictionary of Strong's numbers that is loaded the first time any chapter's words are needed.
const IL = { cache: {}, pending: {}, lex: null, lexPending: false };
let opens = []; // passages that tiles on the current screen open
let vids = []; // videos that links on the current screen open in the video window
let recorder = null;

const t = (am, en) => (S.en ? en : am);
const tp = (pair) => (S.en ? pair[1] : pair[0]);
const bookName = (i) => tp(C.books[i].n);
const hasAmharic = () => Object.values(versions).some((v) => v.language === 'am');

function save(...keys) {
  keys.forEach((k) => (PERSONAL.includes(k) ? saveAccount() : ls.set(k, S[k])));
}

// ---------- accounts: each one keeps its own highlights, notes and Journey progress ----------
const PERSONAL = ['highlights', 'notes', 'game', 'gone', 'updated'];
// gone: ids of deleted notes, so a deletion also reaches the account's other devices; updated: time of the last change.
const blankAccount = () => ({ highlights: {}, notes: [], game: { xp: 0, streak: 0, last: '', done: {} }, gone: [], updated: 0 });
const accountId = () => (S.user ? 'google:' + (S.user.sub || S.user.email) : S.guest ? 'guest' : '');
let accountReady = '';    // the account whose data is in S

async function loadAccount() {
  const id = accountId();
  if (id === accountReady) return;
  accountReady = '';
  Object.assign(S, blankAccount());
  if (!id) return;
  let rec = null;
  try { rec = await idb('accounts', 'readonly', (store) => store.get(id)); } catch (e) { /* database unavailable */ }
  if (!rec) {
    // Before accounts had their own data, everything sat in one shared place on this device.
    // The first account to open the app here takes it over, and the shared copy is removed.
    const old = { highlights: ls.get('highlights', null), notes: ls.get('notes', null), game: ls.get('game', null) };
    if (old.highlights || old.notes || old.game) {
      rec = Object.assign(blankAccount(), Object.fromEntries(Object.entries(old).filter((e) => e[1])));
      rec.id = id;
      await idb('accounts', 'readwrite', (store) => store.put(rec)).catch(() => {});
      PERSONAL.forEach((k) => { try { localStorage.removeItem('qalu.' + k); } catch (e) { /* ignore */ } });
    }
  }
  if (accountId() !== id) return;      // the reader switched account while this was loading
  if (rec) PERSONAL.forEach((k) => { if (rec[k]) S[k] = rec[k]; });
  accountReady = id;
  render();
  syncSoon(0);   // bring in what this account saved on its other devices
}

function saveAccount(fromSync) {
  const id = accountReady;
  if (!id) return;
  if (!fromSync) { S.updated = Date.now(); syncSoon(); }
  const rec = { id };
  PERSONAL.forEach((k) => { rec[k] = S[k]; });
  idb('accounts', 'readwrite', (store) => store.put(rec)).catch(() => {
    S.msg = t('ማስቀመጥ አልተቻለም።', 'This could not be saved.');
  });
}

function pickVersions() {
  const ids = Object.keys(versions);
  if (!versions[S.primary]) S.primary = (versions.am54 || Object.values(versions).find((v) => v.language === 'am') || versions.web).id;
  if (!versions[S.secondary] || S.secondary === S.primary) S.secondary = ids.find((id) => id !== S.primary) || S.primary;
}

// Bundled versions are stored one file per book, so only the book being read is downloaded.
// Biblica Open Bible Maps (CC BY-SA 4.0), listed in data/maps.json as [id, title, [[book, first ch, last ch]]];
// the pictures come from Bible Image Library's server, so they need a connection.
const MAPS = { list: null, pending: false };
const MAP_CDN = 'https://d12do9t5rj179j.cloudfront.net/';
const MAP_CREDIT = 'Biblica Open Bible Maps, © 2023-2026 Biblica, Inc., CC BY-SA 4.0, via bibleimagelibrary.org.';
function bibleMaps() {
  calib();   // which maps can be made interactive, needed as soon as any map can be opened
  if (!MAPS.list && !MAPS.pending) {
    MAPS.pending = true;
    fetch('data/maps.json').then((r) => r.json()).then((d) => { MAPS.list = d; }).catch(() => { MAPS.list = []; }).then(() => { MAPS.pending = false; render(); });
  }
  return MAPS.list;
}
// Maps for a chapter: those naming that chapter first, then those for the whole book (c = 0 gives the book's maps).
function mapsFor(b, c) {
  const list = bibleMaps() || [];
  const exact = [], book = [];
  list.forEach((m) => {
    if (m[2].some((x) => x[0] === b && x[1] && c >= x[1] && c <= x[2])) exact.push(m);
    else if (m[2].some((x) => x[0] === b)) book.push(m);
  });
  return c ? { exact, book } : { exact: exact.concat(book), book: [] };
}
const mapCard = (m) => `<button class="mapcard" data-a="openMap" data-v="${m[0]}" data-k="map-${m[0]}"><img src="${MAP_CDN}thumb/320/${m[0]}.jpg" alt="" loading="lazy"><span>${esc(m[1])}</span></button>`;
function mapsTab() {
  if (!bibleMaps()) return `<p class="muted prose" role="status">${t('እየተጫነ ነው…', 'Loading…')}</p>`;
  const { exact, book } = mapsFor(S.pass.b, S.pass.c);
  const refs = [[S.pass.b, S.pass.c, S.pass.c]];
  const ours = `<div class="card stack geocard"><div class="row between"><b>${t('የዚህ ምዕራፍ ካርታ', 'This chapter on the map')}</b><button class="btn small" data-a="geoBig" data-k="geo-big">${icon('focus', 16)}${t('አስፋ', 'Expand')}</button></div>
<div data-mapslot="panel" class="geoslot"></div>${geoList(refs)}<p class="muted small" lang="en">${GEO_CREDIT}</p></div>`;
  return ours + (exact.length ? `<h2>${t('ማጣቀሻ ሥዕሎች', 'Reference maps')}</h2>` : '') + (exact.length ? `<h2>${t('ለምዕራፍ ' + S.pass.c, 'For chapter ' + S.pass.c)}</h2><div class="mapgrid">${exact.map(mapCard).join('')}</div>` : `<div class="card"><p class="muted prose">${t('ለዚህ ምዕራፍ የተለየ ካርታ የለም።', 'No map for this chapter in particular.')}</p></div>`) +
    (book.length ? `<h2>${t('ለመጽሐፉ በሙሉ', 'For the whole book')} · ${esc(bookName(S.pass.b))}</h2><div class="mapgrid">${book.slice(0, S.more * 2).map(mapCard).join('')}</div>${book.length > S.more * 2 ? `<button class="btn" data-a="more" data-k="more-maps">${t('ተጨማሪ አሳይ', 'Show more')}</button>` : ''}` : '') +
    `<p class="muted small" lang="en">${MAP_CREDIT} ${t('ሥዕሎቹ ኢንተርኔት ያስፈልጋቸዋል።', 'The pictures need a connection.')}</p>`;
}
// The full-screen viewer for one map.
// The map open in the viewer: a Biblica map, or (id -1) the chapter being read on our own map alone.
function viewerMap() {
  if (S.bigMap === -1) return [-1, bookName(S.pass.b) + ' ' + S.pass.c, [[S.pass.b, S.pass.c, S.pass.c]]];
  return S.bigMap ? (MAPS.list || []).find((x) => x[0] === S.bigMap) : null;
}
function mapViewer() {
  const m = viewerMap();
  if (!m) return '';
  const own = m[0] === -1;
  const first = m[2].find((x) => x[1]);
  const list = S.mapList && S.mapList.includes(m[0]) ? S.mapList : [m[0]];
  const at = list.indexOf(m[0]);
  const canPin = !own && !!calib()[m[0]];
  let layer = own ? 'live' : S.mapLayer || 'pic';
  if (layer === 'overlay' && !canPin) layer = 'live';
  const vrefs = m[2].length ? m[2] : [[S.pass.b, S.pass.c, S.pass.c]];
  const z = S.mapZoom || 1;
  const pic = `<div class="mv-pic" data-zoom="${z}"><img src="${MAP_CDN}thumb/640/${m[0]}.jpg" alt="${esc(m[1])}" style="width:${z * 100}%"></div>`;
  const live = `<div class="mv-live"><div data-mapslot class="mv-slot"></div>${layer === 'overlay' ? picSlider() : ''}<div class="mv-places">${geoList(vrefs)}</div></div>`;
  const seg = (v, label) => `<button data-a="mapLayer" data-v="${v}" data-k="ml-${v}" aria-pressed="${layer === v}">${label}</button>`;
  return `<div class="mapview" role="dialog" aria-modal="true" aria-label="${esc(m[1])}">
<div class="mv-top"><div class="mv-title"><b>${esc(m[1])}</b>${list.length > 1 ? `<span class="small">${at + 1} / ${list.length}</span>` : ''}</div>
<button class="mv-close" data-a="closeMap" data-k="closemap" aria-label="${t('ዝጋ', 'Close')}" title="${t('ዝጋ (Esc)', 'Close (Esc)')}">${icon('close', 22)}</button></div>
${own ? '' : `<div class="mv-seg seg" role="group" aria-label="${t('እይታ', 'View')}">${canPin ? seg('overlay', '✦ ' + t('በይነተገናኝ', 'Interactive')) : ''}${seg('pic', t('ሥዕል', 'Picture'))}${seg('live', t('ተንቀሳቃሽ ካርታ', 'Live map'))}${seg('both', t('ሁለቱም', 'Both'))}</div>`}
<div class="mv-stage mv-${layer}">${layer === 'pic' || layer === 'both' ? pic : ''}${layer !== 'pic' ? live : ''}
${list.length > 1 ? `<button class="mv-nav prev" data-a="mapStep" data-v="-1" data-k="mvprev" ${at === 0 ? 'disabled' : ''} aria-label="${t('ያለፈው ካርታ', 'Previous map')}">${icon('left', 22)}</button><button class="mv-nav next" data-a="mapStep" data-v="1" data-k="mvnext" ${at === list.length - 1 ? 'disabled' : ''} aria-label="${t('ቀጣዩ ካርታ', 'Next map')}">${icon('right', 22)}</button>` : ''}</div>
<div class="mv-tools">
${layer === 'pic' || layer === 'both' ? `<button class="mv-btn" data-a="mapZoom" data-v="-1" data-k="mzout" ${z <= 1 ? 'disabled' : ''} aria-label="${t('አሳንስ', 'Zoom out')}">−</button><button class="mv-btn" data-a="mapZoom" data-v="1" data-k="mzin" ${z >= 4 ? 'disabled' : ''} aria-label="${t('አጉላ', 'Zoom in')}">+</button>` : ''}
${first ? `<button class="mv-btn wide" data-a="mapRead" data-v="${first[0]}.${first[1]}" data-k="mapread">${icon('book', 18)}<span>${t('ክፍሉን አንብብ', 'Read it')}</span></button>` : ''}
${own ? '' : `<a class="mv-btn wide" href="${MAP_CDN}orig/${m[0]}.pdf" target="_blank" rel="noopener">${icon('download', 18)}<span>PDF</span></a>`}
</div>
<p class="mv-credit small" lang="en">${own ? GEO_CREDIT : MAP_CREDIT + ' ' + GEO_CREDIT}</p></div>`;
}
// The story places (on the interactive map) that belong to the passages a Biblica map covers.
function mapPlaces(m) {
  const ids = new Set();
  C.timeline.forEach((g) => g.items.forEach((it) => {
    if (it.pl && m[2].some((x) => x[0] === it.p.b && (!x[1] || (it.p.c >= x[1] && it.p.c <= x[2])))) ids.add(it.pl);
  }));
  return C.places.map((p, i) => (ids.has(p.id) ? i : -1)).filter((i) => i >= 0);
}

// ---------- The app's own Bible map layer ----------
// Places from OpenBible.info's Bible Geocoding Data (CC BY 4.0): every place each chapter mentions, numbered in the
// order the text first names it, plus journeys traced from the Biblica maps (tools/routes.json, tools/build_geo.py).
const GEO = { places: null, routes: null, books: {}, pending: {} };
const GEO_CREDIT = 'Places: OpenBible.info Bible Geocoding Data, CC BY 4.0. Journeys traced from Biblica Open Bible Maps.';
function geoLoad(path, done) {
  if (GEO.pending[path]) return;
  GEO.pending[path] = true;
  fetch(path).then((r) => r.json()).then(done).catch(() => done(null)).then(() => render());
}
// The places and journeys for a list of passages [[book, first chapter, last chapter]], or null while loading.
function geoFor(refs) {
  if (!GEO.places) { geoLoad('data/geo/places.json', (d) => { GEO.places = d || []; }); return null; }
  if (!GEO.routes) { geoLoad('data/geo/routes.json', (d) => { GEO.routes = d || []; }); return null; }
  let waiting = false;
  refs.forEach(([b]) => { if (!GEO.books[b]) { waiting = true; geoLoad('data/geo/' + b + '.json', (d) => { GEO.books[b] = d || {}; }); } });
  if (waiting) return null;
  const seen = new Map();
  refs.forEach(([b, c1, c2]) => {
    const chs = c1 ? Array.from({ length: c2 - c1 + 1 }, (_, i) => c1 + i) : Object.keys(GEO.books[b]).map(Number);
    chs.forEach((c) => (GEO.books[b][c] || []).forEach(([i, vs]) => {
      if (!seen.has(i)) seen.set(i, []);
      vs.forEach((v) => seen.get(i).push([b, c, v]));
    }));
  });
  const places = [...seen].map(([i, refsOf]) => ({ i, p: GEO.places[i], refs: refsOf }));
  const routes = GEO.routes.filter((rt) => rt.ch.some(([b, c1, c2]) => refs.some(([rb, r1, r2]) => rb === b && (!r1 || (r1 <= c2 && r2 >= c1)))));
  return { places, routes };
}
let lgeo = null, lgeoKey = '', lgeoMarks = [];
// Draws (or clears) the layer on the shared map; fit = move the map to show it.
function applyGeo(refs, fit) {
  if (!lmap) return;
  const key = refs ? JSON.stringify(refs) : '';
  const data = refs ? geoFor(refs) : null;
  mapEl.dataset.geo = data && (data.places.length || data.routes.length) ? '1' : '';
  if (key === lgeoKey && (!refs || (data && lgeo))) { if (fit && data) geoFit(data); return; }
  if (lgeo) { lgeo.remove(); lgeo = null; lgeoMarks = []; }
  lgeoKey = refs && data ? key : '';
  if (!data) return;
  lgeo = L.layerGroup().addTo(lmap);
  data.routes.forEach((rt) => {
    const line = rt.pts.map((p) => [p[0], p[1]]);
    L.polyline(line, { color: '#1F2023', weight: 7, opacity: 0.35, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(lgeo);
    L.polyline(line, { color: '#C0392B', weight: 3.5, dashArray: '10 8', lineCap: 'round', lineJoin: 'round', className: 'georoute' }).bindTooltip(tp(rt.n), { sticky: true }).addTo(lgeo);
    for (let k = 1; k < line.length; k++) {   // a small arrow half way along each leg shows the direction of travel
      const [a, b] = [line[k - 1], line[k]];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ang = Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos(mid[0] * Math.PI / 180)) * 180 / Math.PI;
      L.marker(mid, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: `<span class="geoarrow" style="transform:rotate(${ang}deg)">➤</span>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(lgeo);
    }
    rt.pts.forEach((p) => { if (!data.places.some((x) => x.p[0] === p[2])) L.circleMarker([p[0], p[1]], { radius: 5, color: '#C0392B', weight: 2.5, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(p[2], { permanent: true, direction: 'right', offset: [6, 0], className: 'geostop' }).addTo(lgeo); });
  });
  data.places.forEach((x, n) => {
    const [name, lat, lon, kind, conf] = x.p;
    const unsure = conf < 300, area = /region|country|people|nation|kingdom/.test(kind);
    const verses = x.refs.slice(0, 12).map(([b, c, v]) => `<button class="geov" data-a="geoVerse" data-v="${b}.${c}.${v}">${esc(bookName(b))} ${c}:${v}</button>`).join('') + (x.refs.length > 12 ? `<span class="small">+${x.refs.length - 12}</span>` : '');
    const m = L.marker([lat, lon], { keyboard: true, alt: name, zIndexOffset: 2000 - n, icon: L.divIcon({ className: '', html: `<span class="geopin${unsure ? ' unsure' : ''}${area ? ' area' : ''}"><b>${n + 1}</b><i>${esc(name)}</i></span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup(`<div class="geopop"><b>${n + 1}. ${esc(name)}</b><span class="small">${esc(kind)}${unsure ? ' · ' + t('ቦታው እርግጠኛ አይደለም', 'location uncertain') : ''}</span><div class="geovs">${verses}</div></div>`, { maxWidth: 260 })
      .addTo(lgeo);
    lgeoMarks.push(m);
  });
  if (fit) geoFit(data);
}
function geoFit(data) {
  const pts = data.places.filter((x) => !/region|country|people|nation|kingdom/.test(x.p[3])).map((x) => [x.p[1], x.p[2]]).concat(data.routes.flatMap((rt) => rt.pts.map((p) => [p[0], p[1]])));
  const all = pts.length ? pts : data.places.map((x) => [x.p[1], x.p[2]]);
  if (all.length > 1) lmap.fitBounds(all, { padding: [36, 36], maxZoom: 10 }); else if (all.length) lmap.setView(all[0], 9); else lmap.fitBounds(MAP_VIEWS.lands());
}
// The list of numbered places under a map, each opening its pin.
function geoList(refs) {
  const data = geoFor(refs);
  if (!data) return `<p class="small muted">${t('ስፍራዎቹ እየተጫኑ ነው…', 'Loading the places…')}</p>`;
  if (!data.places.length && !data.routes.length) return `<p class="small muted">${t('ይህ ክፍል የተለየ ስፍራ አይጠቅስም።', 'This passage names no places.')}</p>`;
  return `<div class="geolist">${data.routes.map((rt) => `<span class="chip route">〰 ${esc(tp(rt.n))}</span>`).join('')}${data.places.map((x, n) => `<button class="chip geochip${x.p[4] < 300 ? ' unsure' : ''}" data-a="geoPlace" data-v="${n}" data-k="gp-${n}"><b>${n + 1}</b>${esc(x.p[0])}</button>`).join('')}</div>`;
}

// ---------- Pictures made interactive ----------
// Biblica maps lined up with real coordinates (tools/calib_points.json → tools/build_calib.py → data/geo/calib.json):
// such a picture can be laid on our map, under our numbered places and routes, and faded in and out.
const CALIB = { map: null };
function calib() { if (!CALIB.map) geoLoad('data/geo/calib.json', (d) => { CALIB.map = d || {}; }); return CALIB.map || {}; }
let lpic = null, lpicId = null;
function applyPic(id, fit) {
  if (!lmap) return;
  const b = id && calib()[id];
  if (!b) { if (lpic) { lpic.remove(); lpic = null; lpicId = null; } return; }
  if (!lmap.getPane('pic')) lmap.createPane('pic').style.zIndex = 350;
  if (lpicId !== id) {
    if (lpic) lpic.remove();
    lpic = L.imageOverlay(`${MAP_CDN}thumb/640/${id}.jpg`, [[b[0], b[1]], [b[2], b[3]]], { pane: 'pic', opacity: S.picOpacity, interactive: false, className: 'picover' }).addTo(lmap);
    lpicId = id;
    fit = true;
  }
  lpic.setOpacity(S.picOpacity);
  if (fit) lmap.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [10, 10] });
}
const picSlider = () => `<label class="picop"><span>${t('ሥዕሉ', 'Picture')}</span><input id="picop" type="range" min="0" max="100" value="${Math.round(S.picOpacity * 100)}" aria-label="${t('የሥዕሉ ግልጽነት', 'Picture opacity')}"><span>${t('ካርታው', 'Map')}</span></label>`;

// ---------- Atlas ----------
const ATLAS = { list: null };
const km = (a, b) => { const R = 6371, d = Math.PI / 180, x = Math.sin((b[0] - a[0]) * d / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin((b[1] - a[1]) * d / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const routeKm = (rt) => Math.round(rt.pts.reduce((sum, p, i) => (i ? sum + km(rt.pts[i - 1], p) : 0), 0) / 10) * 10;
const refText = (refs) => refs.slice(0, 3).map(([b, c1, c2]) => bookName(b) + (c1 ? ' ' + c1 + (c2 > c1 ? '–' + c2 : '') : '')).join(', ') + (refs.length > 3 ? '…' : '');
function atlasData() {
  if (!ATLAS.list) { geoLoad('data/geo/atlas.json', (d) => { ATLAS.list = d || []; }); }
  if (!GEO.places || !GEO.routes) geoFor([]);
  if (!ATLAS.list || !GEO.places || !GEO.routes || !MAPS.list) { bibleMaps(); return null; }
  return ATLAS.list;
}
// The explanation card a picture or a route shows on hover, and in the side panel when chosen.
function atlasMapCard(a, big) {
  const m = MAPS.list.find((x) => x[0] === a[0]);
  const rts = GEO.routes.filter((rt) => rt.maps.includes(a[0]));
  const names = a[3].map((i) => GEO.places[i][0]);
  return `<div class="atcard${big ? ' big' : ''}"><img src="${MAP_CDN}thumb/${big ? 640 : 320}/${a[0]}.jpg" alt="" loading="lazy">
<b>${esc(m ? m[1] : '')}</b><span class="atref">${esc(m && m[2].length ? refText(m[2]) : '')}</span>
${names.length ? `<span>${t('ስፍራዎች፦ ', 'Places: ')}${esc(names.join(', '))}</span>` : ''}
${calib()[a[0]] ? `<span class="atpinnable">✦ ${t('በካርታው ላይ ሊቀመጥ ይችላል', 'Can be laid on the map')}</span>` : ''}${rts.length ? `<span class="atroute">〰 ${esc(rts.map((rt) => tp(rt.n)).join(' · '))}</span>` : ''}</div>`;
}
function atlasRouteCard(rt, big) {
  return `<div class="atcard route${big ? ' big' : ''}" style="--rc:${rt.color}"><b>〰 ${esc(tp(rt.n))}</b><span class="atref">${esc(refText(rt.ch))} · ${t('ወደ ' + routeKm(rt) + ' ኪ.ሜ. ገደማ', 'about ' + routeKm(rt) + ' km')}</span>
<span>${esc(tp(rt.d))}</span>${big ? `<ol class="atstops">${rt.pts.map((p) => `<li>${esc(p[2])}</li>`).join('')}</ol>` : `<span class="small atstopline">${esc(rt.pts.map((p) => p[2]).filter((x, i, arr) => arr.indexOf(x) === i).join(' → '))}</span>`}</div>`;
}
function atlasSide() {
  if (!atlasData()) return `<p class="muted prose" role="status">${t('እየተጫነ ነው…', 'Loading…')}</p>`;
  const sel = S.atlasSel;
  if (sel && sel.type === 'map') {
    const a = ATLAS.list.find((x) => x[0] === sel.id), m = MAPS.list.find((x) => x[0] === sel.id);
    const first = m && m[2].find((x) => x[1]);
    return `<div class="card stack"><div class="row between"><span class="muted small">${t('የተመረጠ ካርታ', 'Selected map')}</span><button class="btn round" data-a="atlasClear" data-k="at-clear" aria-label="${t('ዝጋ', 'Close')}">${icon('close')}</button></div>${atlasMapCard(a, true)}<div class="row"><button class="btn fill" data-a="atlasOpen" data-v="${sel.id}" data-k="at-open">${icon('focus')}${t('በትልቁ ክፈት', 'Open large')}</button>${first ? `<button class="btn" data-a="mapRead" data-v="${first[0]}.${first[1]}" data-k="at-read">${icon('book')}${t('ክፍሉን አንብብ', 'Read it')}</button>` : ''}</div>
${calib()[sel.id] ? `<button class="btn${S.atlasPin ? ' fill' : ''}" data-a="atlasPin" data-k="at-pin" aria-pressed="${!!S.atlasPin}">✦ ${S.atlasPin ? t('ሥዕሉን ከካርታው አንሳ', 'Take the picture off the map') : t('ሥዕሉን በካርታው ላይ አስቀምጥ', 'Lay the picture on the map')}</button>${S.atlasPin ? picSlider() : ''}` : ''}</div>`;
  }
  if (sel && sel.type === 'group') {
    return `<div class="card stack"><div class="row between"><b>${sel.ids.length} ${t('ካርታዎች በዚህ ስፍራ', 'maps at this spot')}</b><button class="btn round" data-a="atlasClear" data-k="at-clear" aria-label="${t('ዝጋ', 'Close')}">${icon('close')}</button></div>
<div class="mapgrid">${sel.ids.slice(0, 60).map((id) => mapCard(MAPS.list.find((m) => m[0] === id))).join('')}</div></div>`;
  }
  if (sel && sel.type === 'route') {
    const rt = GEO.routes.find((x) => x.id === sel.id);
    const pics = rt.maps.filter((id) => MAPS.list.some((m) => m[0] === id));
    return `<div class="card stack"><div class="row between"><span class="muted small">${t('የተመረጠ ጉዞ', 'Selected journey')}</span><button class="btn round" data-a="atlasClear" data-k="at-clear" aria-label="${t('ዝጋ', 'Close')}">${icon('close')}</button></div>${atlasRouteCard(rt, true)}<div class="row"><button class="btn fill" data-a="mapRead" data-v="${rt.ch[0][0]}.${rt.ch[0][1]}" data-k="at-read">${icon('book')}${t('ክፍሉን አንብብ', 'Read it')}</button></div>
${pics.length ? `<div class="mapgrid">${pics.map((id) => mapCard(MAPS.list.find((m) => m[0] === id))).join('')}</div>` : ''}</div>`;
  }
  const tst = S.atlas.t || 'all';
  const rts = GEO.routes.filter((rt) => tst === 'all' || (tst === 'ot' ? rt.ch[0][0] < 39 : rt.ch[0][0] >= 39));
  return `<div class="card stack"><b>${t('ጉዞዎች', 'Journeys')}</b><div class="atlegend">${rts.map((rt) => `<button class="atleg" data-a="atlasRoute" data-v="${rt.id}" data-k="atr-${rt.id}"><i style="background:${rt.color}"></i><span>${esc(tp(rt.n))}</span><small>${routeKm(rt)} km</small></button>`).join('')}</div>
<p class="muted small">${t('ሥዕሎቹ የተሰበሰቡበት ክብ ቁጥሩ የሥዕሎቹ ብዛት ነው፤ ለማየት ይንኩት ወይም ያጉሉ።', 'A number on a picture means several pictures are there: tap it or zoom in to spread them out.')}</p></div>`;
}
let latlas = null, latlasPics = null, latlasRoutes = {};
function applyAtlas(on) {
  if (!lmap) return;
  if (!on || !atlasData()) { if (latlas) { latlas.remove(); latlas = null; latlasRoutes = {}; } mapEl.dataset.atlas = ''; return; }
  mapEl.dataset.atlas = '1';
  const key = JSON.stringify([S.atlas, S.atlasSel]);
  if (latlas && latlas._key === key) return;
  if (latlas) latlas.remove();
  latlas = L.layerGroup().addTo(lmap); latlas._key = key; latlasRoutes = {};
  const tst = S.atlas.t || 'all';
  const inT = (b) => tst === 'all' || (tst === 'ot' ? b < 39 : b >= 39);
  if (S.atlas.routes !== false) GEO.routes.filter((rt) => inT(rt.ch[0][0])).forEach((rt) => {
    const line = rt.pts.map((p) => [p[0], p[1]]);
    const chosen = S.atlasSel && S.atlasSel.type === 'route' && S.atlasSel.id === rt.id;
    const dim = S.atlasSel && S.atlasSel.type === 'route' && !chosen;
    L.polyline(line, { color: '#fff', weight: chosen ? 10 : 7, opacity: dim ? 0.2 : 0.7, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(latlas);
    const pl = L.polyline(line, { color: rt.color, weight: chosen ? 6 : 4, opacity: dim ? 0.25 : 1, dashArray: '10 8', lineCap: 'round', lineJoin: 'round', className: 'georoute' })
      .bindTooltip(atlasRouteCard(rt), { sticky: true, className: 'attip', direction: 'top', offset: [0, -8] })
      .on('click', () => { S.atlasSel = { type: 'route', id: rt.id }; render(); lmap.fitBounds(line, { padding: [40, 40] }); })
      .on('mouseover', (e) => e.target.setStyle({ weight: 7 })).on('mouseout', (e) => e.target.setStyle({ weight: chosen ? 6 : 4 }))
      .addTo(latlas);
    latlasRoutes[rt.id] = pl;
    if (!dim) for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1], line[k]];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ang = Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos(mid[0] * Math.PI / 180)) * 180 / Math.PI;
      L.marker(mid, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: `<span class="geoarrow" style="color:${rt.color};transform:rotate(${ang}deg)">➤</span>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(latlas);
    }
    if (chosen) rt.pts.forEach((p, n) => L.circleMarker([p[0], p[1]], { radius: 5, color: rt.color, weight: 2.5, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(`${n + 1}. ${esc(p[2])}`, { permanent: true, direction: 'right', offset: [6, 0], className: 'geostop' }).addTo(latlas));
  });
  latlasPics = L.layerGroup().addTo(latlas);
  atlasCluster();
}
// Pictures close together on screen are grouped under one, with a count, and spread out as the map zooms in.
function atlasCluster() {
  if (!latlas || !latlasPics) return;
  latlasPics.clearLayers();
  if (S.atlas.pics === false) return;
  const tst = S.atlas.t || 'all';
  const zoom = Math.round(lmap.getZoom()), cell = 74, cells = new Map(), half = lmap.getSize().y / 2;
  ATLAS.list.forEach((a) => {
    const m = MAPS.list.find((x) => x[0] === a[0]);
    const b = m && m[2][0] ? m[2][0][0] : 0;
    if (tst !== 'all' && (tst === 'ot' ? b >= 39 : b < 39)) return;
    const pt = lmap.project([a[1], a[2]], zoom), k = Math.floor(pt.x / cell) + ':' + Math.floor(pt.y / cell);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(a);
  });
  cells.forEach((group) => {
    const a = group[0], n = group.length;
    const lat = group.reduce((x, g) => x + g[1], 0) / n, lon = group.reduce((x, g) => x + g[2], 0) / n;
    const chosen = S.atlasSel && S.atlasSel.type === 'map' && group.some((g) => g[0] === S.atlasSel.id);
    const mk = L.marker([lat, lon], { keyboard: true, riseOnHover: true, zIndexOffset: chosen ? 3000 : n,
      icon: L.divIcon({ className: '', html: `<span class="atpin${chosen ? ' on' : ''}"><img src="${MAP_CDN}thumb/320/${a[0]}.jpg" alt="" loading="lazy">${n > 1 ? `<b>${n}</b>` : ''}</span>`, iconSize: [54, 54], iconAnchor: [27, 27] }) });
    const cp = lmap.latLngToContainerPoint([lat, lon]), W = lmap.getSize().x;
    const below = cp.y < half;   // near the top the card opens downwards, and near the sides inwards
    const side = cp.x < 150 ? 'right' : cp.x > W - 150 ? 'left' : null;
    mk.bindTooltip(n > 1 ? `<div class="atcard"><b>${n} ${t('ካርታዎች', 'maps')}</b>${group.slice(0, 4).map((g) => { const m = MAPS.list.find((x) => x[0] === g[0]); return `<span>• ${esc(m ? m[1] : '')}</span>`; }).join('')}${n > 4 ? `<span class="small">+${n - 4}</span>` : ''}<span class="small atref">${t('ለመዘርጋት ይንኩ', 'Tap to spread them out')}</span></div>` : atlasMapCard(a), { direction: side || (below ? 'bottom' : 'top'), offset: side ? [side === 'right' ? 24 : -24, 0] : [0, below ? 24 : -24], className: 'attip', opacity: 1 });
    mk.on('click', () => {
      const spread = group.some((g) => g[1] !== a[1] || g[2] !== a[2]);
      if (n > 1 && spread && zoom < 10) { lmap.setView([lat, lon], Math.min(zoom + 2, lmap.getMaxZoom())); return; }
      if (n > 1) { S.atlasSel = { type: 'group', ids: group.map((g) => g[0]) }; render(); return; }
      S.atlasSel = { type: 'map', id: a[0] }; S.atlasPin = !!calib()[a[0]]; render();
    });
    mk.addTo(latlasPics);
  });
}

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

// Returns { state, verses } with the original-language words of a chapter: verses maps a verse number to its
// words, each [original, transliteration, English gloss, Strong's number, grammar code].
function originals(b = S.pass.b, c = S.pass.c) {
  const key = b + '/' + c;
  if (!IL.lex && !IL.lexPending) {
    IL.lexPending = true;
    fetch('data/interlinear/lexicon.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((lex) => { IL.lex = lex; IL.lexPending = false; render(); });
  }
  if (IL.cache[key]) return { state: 'ok', verses: IL.cache[key] };
  if (IL.cache[key] === null) return { state: 'error', verses: {} };
  if (!IL.pending[key]) {
    IL.pending[key] = true;
    fetch('data/interlinear/' + key + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { IL.cache[key] = d; })
      .catch(() => { IL.cache[key] = null; })
      .then(() => { IL.pending[key] = false; render(); });
  }
  return { state: 'loading', verses: {} };
}
const isHebrew = (b) => b < 39;
// The picked word, if it belongs to the verse selected now (choosing another verse or chapter clears it).
const pickedWord = () => (S.wordAt === S.pass.b + '.' + S.pass.c + '.' + S.sel ? S.word : null);

// Grammar codes in plain words. Hebrew codes follow the Open Scriptures Hebrew Bible scheme (HVqp3ms),
// with prefixes and suffixes joined by "/"; Greek codes follow the Robinson scheme (V-AAI-3S).
const HEB_POS = { A: ['ቅጽል', 'adjective'], C: ['መስተጻምር', 'conjunction'], c: ['መስተጻምር', 'conjunction'], D: ['ተውሳከ ግሥ', 'adverb'], N: ['ስም', 'noun'], P: ['ተውላጠ ስም', 'pronoun'], R: ['መስተዋድድ', 'preposition'], S: ['ቅጥያ', 'suffix'], T: ['ቃል አጋዥ', 'particle'], V: ['ግሥ', 'verb'] };
const GRK_POS = { N: ['ስም', 'noun'], V: ['ግሥ', 'verb'], A: ['ቅጽል', 'adjective'], T: ['መወሰኛ', 'article'], P: ['ተውላጠ ስም', 'pronoun'], R: ['ተውላጠ ስም', 'relative pronoun'], D: ['ተውላጠ ስም', 'demonstrative pronoun'], I: ['ተውላጠ ስም', 'interrogative pronoun'], F: ['ተውላጠ ስም', 'reflexive pronoun'], S: ['ተውላጠ ስም', 'possessive pronoun'], C: ['ተውላጠ ስም', 'reciprocal pronoun'], X: ['ተውላጠ ስም', 'indefinite pronoun'], K: ['ተውላጠ ስም', 'correlative pronoun'], Q: ['ተውላጠ ስም', 'correlative pronoun'], PREP: ['መስተዋድድ', 'preposition'], CONJ: ['መስተጻምር', 'conjunction'], ADV: ['ተውሳከ ግሥ', 'adverb'], PRT: ['ቃል አጋዥ', 'particle'], INJ: ['ቃለ አጋኖ', 'interjection'], COND: ['መስተጻምር', 'conditional'], HEB: ['የዕብራይስጥ ቃል', 'Hebrew word'], ARAM: ['የአራማይስጥ ቃል', 'Aramaic word'] };
const G_TENSE = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect', '2': 'second' };
const G_VOICE = { A: 'active', M: 'middle', P: 'passive', E: 'middle or passive', D: 'middle deponent', O: 'passive deponent', N: 'middle or passive deponent' };
const G_MOOD = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle' };
const G_CASE = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const NUM = { S: 'singular', P: 'plural', s: 'singular', p: 'plural', d: 'dual' };
const GEN = { M: 'masculine', F: 'feminine', N: 'neuter', m: 'masculine', f: 'feminine', b: 'both genders', c: 'common gender' };
const H_STEM = { q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil', H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal', r: 'Hithpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal', f: 'Hithpalpel', D: 'Nithpael', j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil', v: 'Hishtaphel', w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel' };
const A_STEM = { q: 'Peal', Q: 'Peil', u: 'Hithpeel', p: 'Pael', P: 'Ithpaal', M: 'Hithpaal', a: 'Aphel', h: 'Haphel', s: 'Saphel', e: 'Shaphel', H: 'Hophal', i: 'Ithpeel', t: 'Hishtaphel', v: 'Ishtaphel', w: 'Hithaphel', o: 'Polel', z: 'Ithpoel', r: 'Hithpolel', f: 'Hithpalpel', b: 'Hephal', c: 'Tiphel', m: 'Poel', l: 'Palpel', L: 'Ithpalpel', O: 'Ithpolel', G: 'Ittaphal' };
const H_CONJ = { p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect', h: 'cohortative', j: 'jussive', v: 'imperative', r: 'active participle', s: 'passive participle', a: 'infinitive absolute', c: 'infinitive construct' };
const H_STATE = { a: 'absolute', c: 'construct', d: 'determined' };
const PERSON = { '1': 'first person', '2': 'second person', '3': 'third person' };

function hebrewGrammar(code) {
  const lang = code[0] === 'A' ? 'Aramaic' : 'Hebrew';
  const parts = code.slice(1).split('/').map((m) => {
    const p = m[0], out = [];
    if (p === 'V') {
      out.push((lang === 'Aramaic' ? A_STEM : H_STEM)[m[1]] || '', H_CONJ[m[2]] || '');
      const rest = m.slice(3);
      if (/^[123]/.test(rest)) out.push(PERSON[rest[0]], GEN[rest[1]] || '', NUM[rest[2]] || '');
      else out.push(GEN[rest[0]] || '', NUM[rest[1]] || '', H_STATE[rest[2]] || '');
      return 'verb, ' + out.filter(Boolean).join(' ');
    }
    if (p === 'N' || p === 'A') {
      const kind = { c: '', g: 'gentilic ', p: 'proper ', a: '', o: 'ordinal ', x: '' }[m[1]] || '';
      if (m[1] === 'p') return 'proper noun' + (GEN[m[2]] ? ', ' + GEN[m[2]] : '');
      return kind + (p === 'N' ? 'noun' : 'adjective') + ', ' + [GEN[m[2]], NUM[m[3]], H_STATE[m[4]]].filter(Boolean).join(' ');
    }
    if (p === 'S' || p === 'P') {
      const tail = m.slice(2);
      const pr = /^[123]/.test(tail) ? [PERSON[tail[0]], GEN[tail[1]], NUM[tail[2]]].filter(Boolean).join(' ') : '';
      return (p === 'S' ? 'suffix' : 'pronoun') + (pr ? ', ' + pr : '');
    }
    if (p === 'T') return ({ a: 'affirmation', d: 'definite article', e: 'exhortation', i: 'interrogative', j: 'interjection', m: 'demonstrative', n: 'negative', o: 'direct object marker', r: 'relative' }[m[1]] || 'particle') + (m[1] === 'd' || m[1] === 'o' ? '' : ' particle');
    return (HEB_POS[p] || ['', p])[1];
  });
  return lang + ': ' + parts.join(' + ');
}

function greekGrammar(code) {
  // Two words written as one (crasis) come as "CONJ + G1565=D": describe each part.
  if (code.includes(' + ')) return code.split(' + ').map((part) => greekGrammar(part.replace(/^G\d+[A-Z]?=/, ''))).join(' + ');
  const [p, a = '', b = ''] = code.split('-');
  if (p === 'V') {
    const tense = a.length > 3 ? G_TENSE[a[0]] + ' ' + G_TENSE[a[1]] : G_TENSE[a[0]];
    const rest = a.length > 3 ? a.slice(2) : a.slice(1);
    const out = ['verb', [tense, G_VOICE[rest[0]], G_MOOD[rest[1]]].filter(Boolean).join(' ')];
    if (/^[123]/.test(b)) out.push([PERSON[b[0]], NUM[b[1]]].filter(Boolean).join(' '));
    else if (b) out.push([G_CASE[b[0]], NUM[b[1]], GEN[b[2]]].filter(Boolean).join(' '));
    return out.join(', ');
  }
  const pos = (GRK_POS[p] || ['', p.toLowerCase()])[1];
  const m = /^([123])?([NGDAV])([SP])([MFN])?/.exec(a || '');
  if (!m) return pos;
  return pos + ', ' + [m[1] ? PERSON[m[1]] : '', G_CASE[m[2]], NUM[m[3]], GEN[m[4]]].filter(Boolean).join(' ');
}
const grammarText = (code, heb) => (heb ? hebrewGrammar(code) : greekGrammar(code));
const posLabel = (code, heb) => {
  if (heb) { const main = code.slice(1).split('/').map((m) => m[0]).filter((x) => x !== 'S' && x !== 'R' && x !== 'C' && x !== 'c').pop() || code[1]; return tp(HEB_POS[main] || ['', '']); }
  return tp(GRK_POS[code.split(' + ')[0].split('-')[0]] || ['', '']);
};

// The words of one verse as a row of small cards: original, pronunciation and English meaning.
function wordRow(n, list, heb, picked) {
  return `<div class="ilrow${heb ? ' heb' : ''}" dir="${heb ? 'rtl' : 'ltr'}">${list.map((w, i) => `<button class="ilw${picked === i ? ' on' : ''}" data-a="word" data-v="${n}:${i}" data-k="w-${n}-${i}" dir="ltr" aria-label="${esc(w[0] + ', ' + w[1] + ': ' + w[2])}">
<span class="ilo" lang="${heb ? 'he' : 'grc'}" dir="${heb ? 'rtl' : 'ltr'}">${esc(w[0])}</span><span class="ilt">${esc(w[1])}</span><span class="ilg" lang="en">${esc(w[2])}</span></button>`).join('')}</div>`;
}

// The Words tab: the selected verse in Hebrew or Greek, with each word's dictionary entry and grammar.
function wordsTab() {
  const heb = isHebrew(S.pass.b);
  const intro = `<p class="muted small">${heb
    ? t('ብሉይ ኪዳን የተጻፈው በዕብራይስጥ ነው (ጥቂት ክፍሎች በአራማይስጥ)። እያንዳንዱ ቃል ከአጠራሩ፣ ከእንግሊዝኛ ትርጉሙና ከሰዋስው መግለጫው ጋር ቀርቧል።', 'The Old Testament was written in Hebrew (with a few passages in Aramaic). Each word is shown with its pronunciation, its English meaning and its grammar.')
    : t('አዲስ ኪዳን የተጻፈው በግሪክ ነው። እያንዳንዱ ቃል ከአጠራሩ፣ ከእንግሊዝኛ ትርጉሙና ከሰዋስው መግለጫው ጋር ቀርቧል።', 'The New Testament was written in Greek. Each word is shown with its pronunciation, its English meaning and its grammar.')}</p>`;
  if (!S.sel) return intro + `<div class="card"><p class="prose">${t('የዋናውን ቋንቋ ቃላት ለማየት በንባቡ ውስጥ አንድ ቁጥር ይንኩ።', 'Tap a verse in the reading to see its words in the original language.')}</p></div>`;
  const o = originals();
  if (o.state === 'loading') return intro + `<p class="muted prose" role="status">${t('እየተጫነ ነው…', 'Loading…')}</p>`;
  if (o.state === 'error') return intro + `<div class="card"><p class="prose" role="alert">${t('ቃላቱን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱ።', 'The words could not be loaded. Check your connection.')}${offlineHint()}</p></div>`;
  const list = o.verses[S.sel];
  if (!list) return intro + `<div class="card"><p class="prose">${t('ይህ ቁጥር በዋናው ጽሑፍ ውስጥ የለም፤ በአንዳንድ ትርጉሞች ብቻ ይገኛል።', 'This verse is not in the original-language text used here; it is found only in some translations.')}</p></div>`;
  const lex = IL.lex || {};
  const entry = (w, i) => {
    const d = lex[w[3]];
    return `<div class="card stack ilcard${pickedWord() === i ? ' on' : ''}" id="ilc-${i}" style="gap:6px">
<div class="row between" style="align-items:baseline"><b class="ilbig" lang="${heb ? 'he' : 'grc'}" dir="${heb ? 'rtl' : 'ltr'}">${esc(w[0])}</b><span class="pill">${esc(posLabel(w[4], heb))}</span></div>
<div class="row" style="gap:10px;align-items:baseline"><i>${esc(w[1])}</i><b lang="en">${esc(w[2])}</b></div>
${d ? `<div class="small"><span class="muted">${t('መዝገበ ቃላት', 'Dictionary')}:</span> <b lang="${heb ? 'he' : 'grc'}">${esc(d[0])}</b> · <span lang="en">${esc(d[1])}</span></div>` : ''}
<div class="small muted" lang="en">${esc(grammarText(w[4], heb))}</div>
<div class="small muted">Strong’s ${esc(w[3])}</div></div>`;
  };
  return intro + `<div class="card stack" style="gap:8px"><b>${esc(passRef({ b: S.pass.b, c: S.pass.c, f: S.sel, to: S.sel }))}</b>${wordRow(S.sel, list, heb, pickedWord())}</div>` + list.map(entry).join('') +
    `<p class="muted small">${t('የዕብራይስጥና የግሪክ ጽሑፍ፣ የቃላቱ ትርጉምና ሰዋስው ከSTEPBible (Tyndale House, Cambridge) የተወሰዱ ናቸው፤ CC BY 4.0። የእንግሊዝኛ ትርጉሞቹ የቃል በቃል ናቸው፤ የአማርኛ ትርጉም ገና የለም።', 'Hebrew and Greek text, glosses and grammar from STEPBible (Tyndale House, Cambridge), CC BY 4.0. The English glosses are word-for-word; Amharic glosses are not available yet.')}</p>`;
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
  if (p.to && p.to === (p.f || 1)) return base + sep + p.to; // a single verse
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
  down: '<path d="M6 9l6 6 6-6"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  exit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.5-2.8M19 12.5a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.7-2.8M22 8.8A15 15 0 0 0 11 5"/><circle cx="12" cy="20" r="1"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'
};
const icon = (name, size = 18) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ---------- sync between devices (Firebase) ----------
// When config.js names a Firebase project, a Google account's highlights, notes, deleted-note list and Journey
// progress are kept in one Firestore document, users/<Firebase user id>, readable and writable only by that user
// (see firestore.rules). The Google sign-in token is exchanged for a Firebase session through the Identity Toolkit
// REST API, so no Firebase library is needed. Voice recordings stay on the device that made them.
const FB = (window.QALU_CONFIG || {}).firebase || null;
const syncOn = () => !!(FB && FB.apiKey && FB.projectId);
const fbHost = (service, port) => (FB && FB.emulator ? `${FB.emulator}:${port}/${service}` : `https://${service}`);
const SY = { state: '', at: 0, timer: 0, running: false, again: false, token: '', exp: 0 };
const fbSession = () => ls.get('fbsession', null);   // { sub, uid, refresh } for the Google account signed in

async function fbSignIn(googleIdToken) {
  if (!syncOn()) return;
  try {
    const r = await fetch(`${fbHost('identitytoolkit.googleapis.com', 9099)}/v1/accounts:signInWithIdp?key=${encodeURIComponent(FB.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(googleIdToken) + '&providerId=google.com', requestUri: location.origin, returnSecureToken: true, returnIdpCredential: false })
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || r.status);
    ls.set('fbsession', { sub: S.user && S.user.sub, uid: d.localId, refresh: d.refreshToken });
    SY.token = d.idToken; SY.exp = Date.now() + (+d.expiresIn || 3600) * 1000;
  } catch (e) {
    SY.state = 'error'; SY.error = String(e.message || e);
  }
}

// A valid Firebase ID token for the account signed in, renewed from the stored refresh token when needed.
async function fbToken() {
  const ses = fbSession();
  if (!ses || !S.user || ses.sub !== S.user.sub) return null;
  if (SY.token && SY.exp > Date.now() + 60000) return SY.token;
  const r = await fetch(`${fbHost('securetoken.googleapis.com', 9099)}/v1/token?key=${encodeURIComponent(FB.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(ses.refresh)
  });
  const d = await r.json();
  if (!r.ok) { if (r.status === 400) ls.set('fbsession', null); throw new Error((d.error && d.error.message) || r.status); }
  ls.set('fbsession', Object.assign(ses, { refresh: d.refresh_token }));
  SY.token = d.id_token; SY.exp = Date.now() + (+d.expires_in || 3600) * 1000;
  return SY.token;
}

// (The Auth emulator keeps the service name in its paths; the Firestore emulator does not.)
const fbDoc = (uid) => `${FB.emulator ? FB.emulator + ':8080' : 'https://firestore.googleapis.com'}/v1/projects/${encodeURIComponent(FB.projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

// Combines this device's copy with the copy in the cloud. Notes are joined by id (a deleted note stays deleted);
// for a highlight changed on both sides, the copy changed last wins ('' marks a cleared highlight); Journey
// progress keeps the best of both.
function mergeRecords(a, b) {
  if (!b) return a;
  const newer = (a.updated || 0) >= (b.updated || 0) ? a : b, older = newer === a ? b : a;
  const gone = [...new Set([...(a.gone || []), ...(b.gone || [])])];
  const notes = {};
  [...(older.notes || []), ...(newer.notes || [])].forEach((n) => { notes[n.id] = n; });
  const ga = a.game || {}, gb = b.game || {};
  const done = Object.assign({}, ga.done);
  Object.entries(gb.done || {}).forEach(([k, v]) => { done[k] = Math.max(done[k] || 0, v); });
  const lastGame = (ga.last || '') > (gb.last || '') ? ga : (gb.last || '') > (ga.last || '') ? gb : ((ga.streak || 0) >= (gb.streak || 0) ? ga : gb);
  return {
    highlights: Object.assign({}, older.highlights, newer.highlights),
    notes: Object.values(notes).filter((n) => !gone.includes(n.id)).sort((x, y) => (y.date || 0) - (x.date || 0)),
    game: { xp: Math.max(ga.xp || 0, gb.xp || 0), streak: lastGame.streak || 0, last: lastGame.last || '', done },
    gone,
    updated: Math.max(a.updated || 0, b.updated || 0)
  };
}

function syncSoon(delay = 1500) {
  if (!syncOn() || !S.user) return;
  clearTimeout(SY.timer);
  SY.timer = setTimeout(syncNow, delay);
}

async function syncNow() {
  if (!syncOn() || !S.user || !accountReady) return;
  if (SY.running) { SY.again = true; return; }
  SY.running = true;
  const account = accountReady;
  const show = (state) => { SY.state = state; const el = document.querySelector('[data-k="sync"]'); if (el) render(); };
  try {
    const token = await fbToken();
    if (!token) { show('signin'); return; }
    show('working');
    const uid = fbSession().uid;
    const got = await fetch(fbDoc(uid), { headers: { Authorization: 'Bearer ' + token } });
    if (!got.ok && got.status !== 404) throw new Error('read ' + got.status);
    const remote = got.status === 404 ? null : JSON.parse((((await got.json()).fields || {}).data || {}).stringValue || 'null');
    if (accountReady !== account) return;   // the reader switched account meanwhile
    const local = {};
    PERSONAL.forEach((k) => { local[k] = S[k]; });
    const merged = mergeRecords(local, remote);
    PERSONAL.forEach((k) => { S[k] = merged[k]; });
    saveAccount(true);
    const upload = Object.assign({}, merged, { notes: merged.notes.filter((n) => !n.audio) });
    const put = await fetch(fbDoc(uid) + '?updateMask.fieldPaths=data&updateMask.fieldPaths=updated', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(upload) }, updated: { integerValue: String(merged.updated || 0) } } })
    });
    if (!put.ok) throw new Error('write ' + put.status);
    SY.at = Date.now();
    show('ok');
  } catch (e) {
    SY.error = String(e.message || e);
    show(navigator.onLine === false || /Failed to fetch|NetworkError/i.test(SY.error) ? 'offline' : 'error');
  } finally {
    SY.running = false;
    render();
    if (SY.again) { SY.again = false; syncSoon(500); }
  }
}
window.addEventListener('online', () => syncSoon(0));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(0); });

function syncLabel() {
  if (!syncOn() || !S.user) return '';
  const text = {
    working: t('በማመሳሰል ላይ…', 'Syncing…'),
    ok: t('ተመሳስሏል', 'Synced'),
    offline: t('ከመስመር ውጭ፤ ሲገናኙ ይመሳሰላል', 'Offline; will sync when connected'),
    signin: t('ለማመሳሰል እንደገና ይግቡ', 'Sign in again to sync'),
    error: t('ማመሳሰል አልተሳካም', 'Sync failed')
  }[SY.state] || t('ማመሳሰል', 'Sync');
  return `<button class="nav extra sync ${SY.state}" data-a="syncNow" data-k="sync" title="${esc(SY.state === 'error' ? SY.error || '' : t('ማስታወሻዎችዎ፣ ቀለሞችዎና የጉዞ ውጤትዎ በሁሉም መሣሪያዎችዎ ላይ ይገኛሉ።', 'Your notes, highlights and Journey progress on all your devices.'))}">${icon('cloud', 20)}<span class="lbl">${text}</span></button>`;
}

// ---------- offline: saving whole Bibles and study material on the device ----------
// data/offline.json lists the files of each pack (a Bible version, the fathers' commentary, the book backgrounds,
// the Hebrew and Greek words). Saved files go into the same storage the service worker reads from (sw.js, DATA),
// so once saved they open without a connection.
const DATA_CACHE = 'qalu-data-1';
const OFF = { packs: null, have: {}, busy: '', done: 0, total: 0, stop: false, used: 0, quota: 0, failed: 0, loading: false, checked: false };
const PACK_NAMES = {
  fathers: ['የአባቶች ትርጓሜ', 'Church fathers’ commentary'],
  context: ['የመጻሕፍቱ ዳራና የምዕራፍ ማብራሪያ', 'Book backgrounds and chapter notes'],
  interlinear: ['የዕብራይስጥና የግሪክ ቃላት (ቃል በቃል)', 'Hebrew and Greek words (word by word)']
};
const mb = (bytes) => (bytes / 1e6 < 10 ? (bytes / 1e6).toFixed(1) : Math.round(bytes / 1e6)) + ' MB';

async function offlineCheck() {
  if (OFF.loading || !('caches' in window)) return;
  OFF.loading = true; OFF.checked = true;
  try {
    if (!OFF.packs) OFF.packs = await fetch('data/offline.json').then((r) => r.json());
    const cache = await caches.open(DATA_CACHE);
    const saved = new Set((await cache.keys()).map((r) => r.url.split('?')[0]));
    Object.entries(OFF.packs).forEach(([name, p]) => { OFF.have[name] = p.files.filter((f) => saved.has(new URL(f, location.href).href)).length; });
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); OFF.used = e.usage || 0; OFF.quota = e.quota || 0; }
  } catch (e) { /* storage unavailable */ }
  OFF.loading = false;
  render();
}

async function offlineSave(names) {
  if (OFF.busy || !OFF.packs) return;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});   // ask the browser not to clear it
  const cache = await caches.open(DATA_CACHE);
  const saved = new Set((await cache.keys()).map((r) => r.url.split('?')[0]));
  const todo = names.flatMap((n) => OFF.packs[n].files).map((f) => new URL(f, location.href).href).filter((u) => !saved.has(u));
  OFF.busy = names.join(','); OFF.done = 0; OFF.total = todo.length; OFF.stop = false; OFF.failed = 0;
  render();
  let next = 0, last = 0;
  const worker = async () => {
    while (next < todo.length && !OFF.stop) {
      const url = todo[next++];
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        await cache.put(url, r);
      } catch (e) { OFF.failed++; }
      OFF.done++;
      if (Date.now() - last > 250) { last = Date.now(); const bar = document.querySelector('[data-k="off-progress"] i'); if (bar) bar.style.width = Math.round((OFF.done / OFF.total) * 100) + '%'; const n = document.querySelector('[data-k="off-count"]'); if (n) n.textContent = OFF.done + ' / ' + OFF.total; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  S.msg = OFF.stop ? t('ማውረዱ ቆሟል።', 'Saving stopped.')
    : OFF.failed ? t(OFF.failed + ' ፋይሎችን ማውረድ አልተቻለም፤ ሲገናኙ እንደገና ይሞክሩ።', OFF.failed + ' files could not be saved. Try again when connected.')
      : t('ተቀምጧል፤ አሁን ያለ ኢንተርኔት ይሠራል።', 'Saved. It now works without internet.');
  OFF.busy = '';
  offlineCheck();
}

async function offlineRemove(name) {
  if (OFF.busy || !OFF.packs) return;
  const cache = await caches.open(DATA_CACHE);
  await Promise.all(OFF.packs[name].files.map((f) => cache.delete(new URL(f, location.href).href)));
  S.msg = '';
  offlineCheck();
}

function offlineView() {
  if (!OFF.checked) offlineCheck();
  const online = navigator.onLine !== false;
  if (!('caches' in window)) return `<div class="wrap narrow"><h1>${t('ከመስመር ውጭ', 'Offline')}</h1><div class="card"><p class="prose">${t('ይህ አሳሽ ከመስመር ውጭ ማስቀመጥን አይደግፍም።', 'This browser cannot save the app for offline use.')}</p></div></div>`;
  const packs = OFF.packs || {};
  const inUse = [S.primary, S.secondary];
  const row = (name, label, note) => {
    const p = packs[name];
    if (!p) return '';
    const have = OFF.have[name] || 0, all = p.files.length, full = have >= all;
    const busy = OFF.busy.split(',').includes(name);
    return `<div class="offrow${full ? ' saved' : ''}"><div class="stack" style="gap:2px;min-width:0;flex:1">
<b>${esc(label)}</b><span class="muted small">${mb(p.bytes)}${note ? ' · ' + esc(note) : ''}${have && !full ? ' · ' + t(have + ' / ' + all + ' ተቀምጧል', have + ' of ' + all + ' saved') : ''}</span></div>
${full ? `<span class="pill ok">${icon('check', 14)}${t('ተቀምጧል', 'Saved')}</span><button class="btn" data-a="offRemove" data-v="${name}" data-k="off-rm-${name}" aria-label="${t('አስወግድ', 'Remove')}: ${esc(label)}" title="${t('አስወግድ', 'Remove')}" ${OFF.busy ? 'disabled' : ''}>${icon('trash')}</button>`
    : `<button class="btn${busy ? '' : ' fill'}" data-a="offSave" data-v="${name}" data-k="off-save-${name}" ${OFF.busy || !online ? 'disabled' : ''}>${busy ? t('በማውረድ ላይ…', 'Saving…') : icon('download') + t('አውርድ', 'Save')}</button>`}</div>`;
  };
  const versionRows = VERSION_GROUPS.flatMap((g) => g[1]).filter((id) => versions[id] && packs[id])
    .sort((a, b) => { const r = (id) => (inUse.indexOf(id) < 0 ? 9 : inUse.indexOf(id)); return r(a) - r(b); })   // the versions in use first
    .map((id) => row(id, versions[id].name, inUse.includes(id) ? t('እያነበቡት ያለ', 'in use') : '')).join('');
  const essentials = [...new Set([S.primary, S.secondary])].filter((id) => packs[id]).concat(['fathers', 'context']);
  const missing = essentials.filter((n) => packs[n] && (OFF.have[n] || 0) < packs[n].files.length);
  const needBytes = missing.reduce((sum, n) => sum + packs[n].bytes, 0);
  return `<div class="wrap narrow">
<h1>${t('ከመስመር ውጭ', 'Offline')}</h1>
<div class="card stack offstatus ${online ? 'on' : 'off'}"><div class="row" style="gap:10px">${icon(online ? 'check' : 'wifiOff', 22)}<b>${online ? t('ከኢንተርኔት ጋር ተገናኝተዋል', 'You are online') : t('ኢንተርኔት የለም', 'You are offline')}</b></div>
<p class="prose" style="margin:0">${t('ያስቀመጧቸው ትርጉሞችና የጥናት ጽሑፎች ያለ ኢንተርኔት ይሠራሉ። ያልተቀመጡት ደግሞ አንድ ጊዜ ሲከፈቱ ይቀመጣሉ።', 'Whatever you save here works without internet. Anything you open while online is also kept for next time.')}</p></div>
${OFF.busy ? `<div class="card stack" role="status"><b>${t('በማውረድ ላይ…', 'Saving…')} <span data-k="off-count">${OFF.done} / ${OFF.total}</span></b><div class="bar" data-k="off-progress"><i style="width:${OFF.total ? Math.round((OFF.done / OFF.total) * 100) : 0}%"></i></div><button class="btn" data-a="offStop" data-k="off-stop">${t('አቁም', 'Stop')}</button></div>`
    : missing.length ? `<div class="card stack"><b>${t('የሚያጠኑትን ሁሉ አስቀምጡ', 'Save what you study with')}</b><p class="muted small" style="margin:0">${t('የሚያነቧቸው ሁለቱ ትርጉሞች፣ የአባቶች ትርጓሜና የመጻሕፍቱ ዳራ', 'Your two versions, the fathers’ commentary and the book backgrounds')} · ${mb(needBytes)}</p><button class="btn fill go" data-a="offEssentials" data-k="off-essentials" ${online ? '' : 'disabled'}>${icon('download')}${t('አሁን አውርድ', 'Save now')}</button></div>` : ''}
${S.msg && !OFF.busy ? `<p class="prose" role="status">${esc(S.msg)}</p>` : ''}
<h2>${t('የመጽሐፍ ቅዱስ ትርጉሞች', 'Bible versions')}</h2><div class="card offlist">${versionRows || `<p class="muted">${t('እየተጫነ ነው…', 'Loading…')}</p>`}</div>
<h2>${t('የጥናት ጽሑፎች', 'Study material')}</h2><div class="card offlist">${['fathers', 'context', 'interlinear'].map((n) => row(n, tp(PACK_NAMES[n]))).join('')}</div>
${OFF.quota ? `<p class="muted small">${t('በዚህ መሣሪያ ላይ የተያዘ ቦታ', 'Space used on this device')}: ${mb(OFF.used)} / ${mb(OFF.quota)}</p>` : ''}
<div class="card stack"><b>${t('ኢንተርኔት የሚያስፈልጋቸው', 'Still needs internet')}</b><p class="muted small" style="margin:0">${t('የBibleProject ቪዲዮዎችና ሥዕሎቻቸው፣ በGoogle መግባትና ማመሳሰል፣ እና “የዛሬ ካርታ”። የተሳለው ካርታ፣ ጉዞው፣ ፍለጋውና ማስታወሻዎችዎ ያለ ኢንተርኔት ይሠራሉ።', 'BibleProject videos and their pictures, Google sign-in and sync, and the “Present-day map”. The illustrated map, the Journey, search and your notes all work offline.')}</p></div>
</div>`;
}
// When something cannot load because there is no connection, say how to have it next time.
const offlineHint = () => (navigator.onLine === false
  ? ` <button class="linkbtn" data-a="nav" data-v="offline" data-k="hint-offline">${t('ኢንተርኔት የለም፤ ያለ ኢንተርኔት እንዲሠራ “ከመስመር ውጭ” ውስጥ ያስቀምጡት።', 'You are offline. Save it on the Offline screen to have it without internet.')}</button>` : '');
window.addEventListener('online', () => render());
window.addEventListener('offline', () => render());

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
    // Exchange the Google token for a sync session first, so the account's cloud copy is read as soon as it opens.
    fbSignIn(response.credential).then(() => { loadAccount(); syncSoon(0); });
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
<div class="navmain">
${nav('study', 'book', t('አንብብ', 'Read'))}
${nav('browse', 'grid', t('ፈልግ', 'Explore'))}
${nav('journey', 'flag', t('ጉዞ', 'Journey'))}
${nav('map', 'pin', t('ካርታ', 'Map'))}
${nav('notes', 'note', t('ማስታወሻዎች', 'Notes'))}
</div>
<div class="spacer"></div>
<button class="nav gear" data-a="menu" data-k="menu" aria-expanded="${!!S.menu}" aria-label="${t('ቅንብሮች', 'Settings')}" title="${t('ቅንብሮች', 'Settings')}">${icon('gear', 22)}</button>
<div class="extras${S.menu ? ' open' : ''}">
${S.user
    ? `<div class="who">${S.user.picture ? `<img src="${esc(S.user.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span><b>${esc(S.user.name || '')}</b><span class="muted small">${esc(S.user.email || '')}</span></span></div>
${syncLabel()}
<button class="nav extra" data-a="signOut" data-k="signout" aria-label="${t('ውጣ', 'Sign out')}">${icon('exit', 20)}<span class="lbl">${t('ውጣ', 'Sign out')}</span></button>`
    : `<button class="nav extra" data-a="signIn" data-k="signin" aria-label="${t('ግባ', 'Sign in')}">${icon('user', 20)}<span class="lbl">${t('ግባ', 'Sign in')}</span></button>`}
<button class="nav extra${S.screen === 'offline' ? ' on' : ''}" data-a="nav" data-v="offline" data-k="nav-offline" aria-label="${t('ከመስመር ውጭ ለመጠቀም', 'Use offline')}" title="${t('ከመስመር ውጭ ለመጠቀም', 'Use offline')}">${icon(navigator.onLine === false ? 'wifiOff' : 'download', 20)}<span class="lbl">${t('ከመስመር ውጭ', 'Offline')}</span></button>
<button class="nav extra" data-a="lang" data-k="lang" aria-label="${t('English', 'አማርኛ')}">${icon('globe', 20)}<span>${t('English', 'አማርኛ')}</span></button>
<button class="nav extra" data-a="theme" data-k="theme" aria-label="${S.dark ? t('ብሩህ ገጽታ', 'Light mode') : t('ጨለማ ገጽታ', 'Dark mode')}">${icon('moon', 20)}<span class="lbl">${S.dark ? t('ብሩህ ገጽታ', 'Light mode') : t('ጨለማ ገጽታ', 'Dark mode')}</span></button>
</div>
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeVideo(); if (S.bigMap || S.picker) { if (S.bigMap) actions.closeMap(); S.picker = false; render(); } }
  if (S.bigMap && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { actions.mapStep(e.key === 'ArrowLeft' ? -1 : 1); render(); return; }
  // On the Study screen the arrow keys turn the chapter, unless the reader is typing or choosing.
  if (S.screen !== 'study' || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const btn = document.querySelector(e.key === 'ArrowLeft' ? '[data-k="prev-top"]' : '[data-k="next-top"]');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  }
});

// How the main Christian traditions understand a concept: short summaries, side by side.
const TRADITIONS = {
  orthodox: ['የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ', 'Ethiopian Orthodox Tewahedo'],
  catholic: ['ካቶሊክ', 'Catholic'],
  protestant: ['ፕሮቴስታንት (ወንጌላውያን)', 'Protestant (evangelical)']
};
function viewsBlock(th) {
  if (!th.views) return '';
  return `<b class="small muted">${t('የአብያተ ክርስቲያናት አመለካከቶች', 'How the churches understand it')}</b>
<div class="views">${th.views.map((v) => `<div class="view ${v.k}"><b>${esc(tp(TRADITIONS[v.k]))}</b><p class="prose">${esc(tp(v.t))}</p></div>`).join('')}</div>
<p class="muted small">${t('አጭር ማጠቃለያዎች ናቸው፤ እያንዳንዱ ትውፊት ሰፊ ነው፤ በውስጡም ያሉ አብያተ ክርስቲያናት ይለያያሉ። ለሙሉ ትምህርቱ የቤተ ክርስቲያንዎን መምህራን ይጠይቁ።', 'Short summaries. Each tradition is broad and its churches differ; ask your own church’s teachers for its full teaching.')}</p>`;
}

function themesView() {
  // An older copy of the content file (kept by the browser for a few minutes after an update) has no concepts yet.
  if (!C.themes) return `<div class="card stack" style="align-items:flex-start"><p class="prose">${t('ጽንሰ ሐሳቦቹ ገና አልተጫኑም። ገጹን እንደገና ይጫኑ።', 'The concepts have not loaded yet. Reload the page.')}</p><button class="btn fill" data-a="reload" data-k="reload-app">${t('እንደገና ጫን', 'Reload')}</button></div>`;
  return `<div class="grid themes">${C.themes.map((th, i) => {
    const url = `https://bibleproject.com/videos/${th.slug}/`;
    const open = S.theme === i;
    // The detail: a short commentary and the passages it rests on, each opening in the Study screen.
    const detail = open ? `<p class="prose">${esc(tp(th.c))}</p>
<b class="small muted">${t('ዋቢ ጥቅሶች', 'Bible references')}</b>
<div class="row">${th.refs.map((p, j) => { opens.push({ b: p.b, c: p.c, f: p.f, to: p.to, title: th.n }); return `<button class="btn" data-a="open" data-v="${opens.length - 1}" data-k="theme-ref-${i}-${j}">${icon('book')}${esc(passRef(p))}</button>`; }).join('')}</div>${viewsBlock(th)}` : '';
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

// Words that carry no meaning in a question such as "where is the verse where Jesus says…".
const STOP = new Set(('a an and are as at be been bible but by can chapter did do does find for from had has have he her him his how i if in is it its ' +
  'me my of on or our passage please quote said say saying says scripture she show so talk talks tell tells that the their them there these they this to us ' +
  'verse verses was we were what when where which who whom why will with you your about into than then also ' +
  'የት ነው ናቸው ያለው የሚለው የሚናገረው ቁጥር ቁጥሩ ጥቅስ ጥቅሱ ስለ ምን ይላል ላይ ውስጥ እና ወይም ያ ይህ የትኛው መጽሐፍ ቅዱስ አሳየኝ ንገረኝ ፈልግ የሚል').split(' ').map(fold));
// Names of speakers say little about which verse is meant, so they count for less.
const LIGHT = new Set(['jesus', 'christ', 'god', 'lord', 'paul', 'ኢየሱስ', 'ክርስቶስ', 'እግዚአብሔር', 'ጌታ', 'ጳውሎስ'].map(fold));

// A query becomes a list of alternatives (separated by commas), each a list of weighted words.
// Without commas there is one alternative: the meaningful words of the question.
function parseQuery(q) {
  return q.split(/[,،፣]/).map((part) => {
    const words = fold(part).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
    const kept = words.filter((w) => !STOP.has(w));
    const terms = (kept.length ? kept : words).map((w) => {
      const stem = /^[a-z]{4,}s$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w;   // plural: "sins" also finds "sin"
      return { term: stem, weight: LIGHT.has(w) ? 0.5 : 1 };
    });
    return { terms, words };
  }).filter((g) => g.terms.length);
}

// The longest run of words that the question and a verse share in the same order. A verse that
// repeats the reader's own phrase ("the Lord is my shepherd") should come before one that only
// has the same words scattered through it.
function sharedRun(a, b) {
  let best = 0, prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) { row[j] = prev[j - 1] + 1; if (row[j] > best) best = row[j]; }
    }
    prev = row;
  }
  return best;
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

// "John 3:16", "1 cor 13", "ዮሐንስ 3፥16", "ዮሐ 3" → { b, c, v }, or null when the text is not a reference.
function parseRef(q) {
  const m = String(q || '').trim().match(/^(.+?)\s*(\d+)(?:\s*[:፥.]\s*(\d+))?$/);
  if (!m) return null;
  const key = (x) => x.toLowerCase().replace(/[\s.]/g, '');
  const want = key(m[1]);
  if (want.length < 2) return null;
  let b = C.books.findIndex((bk) => bk.n.some((n) => key(n) === want));
  if (b < 0) b = C.books.findIndex((bk) => bk.n.some((n) => key(n).startsWith(want)));
  if (b < 0) return null;
  const c = +m[2], v = m[3] ? +m[3] : 0;
  if (c < 1 || c > C.books[b].ch) return null;
  return { b, c, v };
}

async function runSearch() {
  const groups = parseQuery(S.q);
  S.searchOn = groups.length > 0;
  save('q', 'qv', 'searchOn');
  if (!groups.length) { S.results = null; render(); return; }
  // Search a Bible in the language the question was typed in.
  let id = versions[S.qv] ? S.qv : S.primary;
  const ethiopic = /[ሀ-፿]/.test(S.q);
  // Search a Bible written in the script of the question.
  const geez = (vid) => versions[vid] && versions[vid].language === 'am';
  if (ethiopic && !geez(id)) id = (Object.values(versions).find((v) => v.language === 'am') || versions[id]).id;
  if (!ethiopic && /[a-z]/i.test(S.q) && geez(id)) id = versions[S.secondary] && !geez(S.secondary) && versions[S.secondary].language !== 'orig' ? S.secondary : 'web';
  S.qv = id;
  save('qv');
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
  // A verse scores the weight of the words it contains. With one or two words it must contain them all;
  // with a longer question it must contain at least half, and the fullest matches come first.
  const found = [];
  const books = versions[id].books;
  const needs = groups.map((g) => {
    const total = g.terms.reduce((sum, w) => sum + w.weight, 0);
    const solid = g.terms.filter((w) => w.weight === 1).length;     // a speaker's name alone is not required
    return g.terms.length <= 2 ? (solid || total) : Math.max(total / 2, 1.5);
  });
  for (let b = 0; b < 66; b++) {
    const chapters = books[b] || [];
    for (let c = 0; c < chapters.length; c++) {
      const verses = chapters[c] || [];
      for (let v = 0; v < verses.length; v++) {
        const text = verses[v];
        if (!text) continue;
        const folded = fold(text);
        let best = null;
        groups.forEach((g, gi) => {
          const hit = g.terms.filter((w) => folded.includes(w.term));
          let score = hit.reduce((sum, w) => sum + w.weight, 0);
          if (score < needs[gi]) return;
          const run = g.words.length > 1 ? sharedRun(g.words, folded.split(/[^\p{L}\p{N}]+/u)) : 0;
          if (run > 1) score += (run - 1) * 0.75;
          if (!best || score > best.score) best = { score, terms: hit.map((w) => w.term), full: hit.length === g.terms.length };
        });
        if (best) found.push({ b, c: c + 1, v: v + 1, text, terms: best.terms, score: best.score, full: best.full });
      }
    }
  }
  found.sort((x, y) => y.score - x.score);      // the sort is stable, so equal scores stay in Bible order
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
  return `<form class="card searchbar" role="search" data-search>
<div class="field wide" style="flex:3 1 260px"><label for="q">${t('በመጽሐፍ ቅዱስ ውስጥ ፈልግ', 'Search the Bible')}</label>
<input id="q" data-k="q" type="search" value="${esc(S.q)}" placeholder="${t('ቃል ወይም ጥያቄ ይጻፉ', 'A word or a question')}" autocomplete="off"></div>
<div class="field" style="flex:1 1 180px"><label for="qv">${t('ትርጉም', 'Version')}</label><select id="qv" data-c="qv" data-k="qv">${versionOptions(versions[S.qv] ? S.qv : S.primary)}</select></div>
<button class="btn fill" type="submit" data-k="q-go">${icon('search')}${t('ፈልግ', 'Search')}</button>
${S.searchOn ? `<button class="btn" type="button" data-a="clearSearch" data-k="q-clear">${t('አጽዳ', 'Clear')}</button>` : ''}
<details class="muted small searchhelp" style="flex:1 1 100%"><summary>${t('እንዴት መፈለግ ይቻላል?', 'How to search')}</summary><p style="margin:6px 0 0">${t('ቃል ወይም ሙሉ ጥያቄ መጻፍ ይችላሉ፤ ፍለጋው ዋና ዋና ቃላቱን ወስዶ ብዙዎቹን የያዙትን ቁጥሮች ቀድሞ ያሳያል። በነጠላ ሰረዝ (,) የተለዩ ቃላት ከአንዳቸው አንዱ ያለባቸውን ያመጣሉ።', 'Type a word or a whole question. The search takes its key words and shows the verses with most of them first. Words separated by commas find verses with any of them.')}</p></details>
</form>`;
}

function searchResults() {
  if (S.results === null) return `<p id="searchnote" class="muted prose" role="status">${esc(S.searchNote || t('እየፈለገ ነው…', 'Searching…'))}</p>`;
  const id = versions[S.qv] ? S.qv : S.primary;
  if (!S.results.length) return `<div class="card"><p class="prose">${t('በ' + versions[id].name + ' ውስጥ ምንም አልተገኘም። ሌላ ቃል ወይም ሌላ ትርጉም ይሞክሩ።', 'Nothing found in the ' + versions[id].name + '. Try another word or another version.')}</p></div>`;
  const ref = (r) => `${esc(bookName(r.b))} ${r.c}${t('፥', ':')}${r.v}`;
  const top = S.results[0];
  const ranked = S.results.some((r) => !r.full);
  const rows = S.results.slice(1, S.shown).map((r, i) => `<button class="result" data-a="openResult" data-v="${i + 1}" data-k="res-${i + 1}"><b>${ref(r)}</b><span ${langOf(id, r.b)}>${markTerms(r.text, r.terms)}</span></button>`).join('');
  return `<div class="card stack best" role="status"><span class="muted small"><b>${t('በጣም የሚቀርበው ቁጥር', 'Closest verse')}</b></span>
<b style="font-size:22px">${ref(top)}</b><p class="prose" style="font-size:19px" ${langOf(id, top.b)}>${markTerms(top.text, top.terms)}</p>
<button class="btn fill" style="align-self:flex-start" data-a="openResult" data-v="0" data-k="res-0">${t('ምዕራፉን ክፈት', 'Open the chapter')}</button></div>
<p class="muted"><b>${S.results.length}</b> ${t('ቁጥሮች ተገኝተዋል በ', 'verses found in the ')}${esc(versions[id].name)}${ranked ? t('፤ በጣም የሚቀርቡት ቀድመው ተቀምጠዋል።', '; the closest come first.') : ''}</p>
<div class="stack" style="gap:8px">${rows}</div>
${S.results.length > S.shown ? `<button class="btn" data-a="moreResults" data-k="res-more">${t('ተጨማሪ አሳይ', 'Show more')} (${S.results.length - S.shown})</button>` : ''}`;
}

// ---------- verse of the day and verse pictures ----------
// Well-known verses as [book, chapter, verse]; the day of the year picks one, the same for everyone that day.
const DAILY = [[18, 23, 1], [42, 3, 16], [19, 3, 5], [44, 8, 28], [49, 4, 13], [22, 40, 31], [23, 29, 11], [5, 1, 9], [39, 11, 28],
  [18, 46, 1], [44, 12, 2], [47, 5, 22], [18, 119, 105], [42, 14, 6], [39, 6, 33], [49, 4, 6], [57, 11, 1], [61, 4, 8], [19, 18, 10],
  [18, 27, 1], [24, 3, 22], [32, 6, 8], [42, 15, 13], [44, 5, 8], [46, 5, 17], [48, 2, 8], [58, 1, 5], [59, 5, 7], [39, 5, 9],
  [18, 37, 4], [22, 41, 10], [0, 1, 1], [42, 1, 14], [44, 15, 13], [45, 13, 4], [18, 91, 1], [42, 11, 25], [39, 22, 37], [18, 34, 8],
  [5, 24, 15], [19, 16, 3], [22, 26, 3], [35, 3, 17], [40, 10, 27], [41, 1, 37], [43, 1, 8], [50, 3, 23], [57, 13, 8], [65, 21, 4],
  [18, 139, 14], [18, 51, 10], [44, 10, 9], [39, 28, 20], [61, 1, 9], [46, 12, 9], [47, 6, 9], [42, 8, 12], [18, 121, 1], [24, 3, 23]];
function dailyRef(date = new Date()) {
  const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 864e5);
  return DAILY[(day + date.getFullYear()) % DAILY.length];
}
// The text of one verse in a version, or null while its book loads.
function verseText(id, b, c, v) {
  const ver = versions[id];
  if (!ver) return '';
  if (ver.dir && !ver.books[b]) { if (!(ver.failed && ver.failed[b])) loadBook(id, b); return null; }
  return ((ver.books[b] || [])[c - 1] || [])[v - 1] || '';
}
const verseRef = (b, c, v) => bookName(b) + ' ' + c + t('፥', ':') + v;

function dailyCard() {
  const [b, c, v] = dailyRef();
  const text = verseText(S.primary, b, c, v);
  return `<div class="card stack daily"><span class="muted small"><b>${t('የዕለቱ ጥቅስ', 'Verse of the day')}</b></span>
<p class="prose dailytext" ${langOf(S.primary, b)}>${text === null ? '…' : esc(text)}</p>
<div class="row between"><b>${esc(verseRef(b, c, v))}</b><div class="row">
<button class="btn" data-a="shareDaily" data-k="daily-share" aria-label="${t('እንደ ሥዕል አጋራ', 'Share as a picture')}" title="${t('እንደ ሥዕል አጋራ', 'Share as a picture')}">${icon('share')}</button>
<button class="btn fill" data-a="openDaily" data-k="daily-open">${t('ክፍሉን ክፈት', 'Open the passage')}</button></div></div></div>`;
}

// Draws a verse onto a square picture and offers it to the phone's share sheet, or downloads it on a computer.
async function shareVersePicture(id, b, c, v) {
  const text = verseText(id, b, c, v);
  if (!text) return;
  const size = 1080, pad = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const bg = g.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#1F2A44'); bg.addColorStop(1, '#5B3A6E');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(size - 140, 160, 260, 0, Math.PI * 2); g.fill();
  const rtl = versions[id].language === 'orig' && b < 39;
  const family = '"Noto Sans Ethiopic", "Kefa", "Nyala", "Abyssinica SIL", "SBL Hebrew", "Noto Serif", system-ui, sans-serif';
  // Find the largest text size at which the verse fits in the picture.
  const words = text.split(/\s+/);
  let fontSize = 64, lines = [];
  for (; fontSize >= 28; fontSize -= 2) {
    g.font = `600 ${fontSize}px ${family}`;
    lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (g.measureText(next).width > size - pad * 2 && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length * fontSize * 1.5 < size - pad * 2 - 200) break;
  }
  g.fillStyle = '#FFFFFF'; g.textBaseline = 'top'; g.direction = rtl ? 'rtl' : 'ltr';
  g.textAlign = rtl ? 'right' : 'left';
  const x = rtl ? size - pad : pad;
  let y = (size - lines.length * fontSize * 1.5 - 120) / 2;
  lines.forEach((l) => { g.fillText(l, x, y); y += fontSize * 1.5; });
  g.direction = 'ltr'; g.textAlign = 'left';
  g.font = `700 40px ${family}`; g.fillStyle = '#F5C76B';
  g.fillText(verseRef(b, c, v), pad, y + 36);
  g.font = `500 30px ${family}`; g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText(versions[id].name, pad, y + 92);
  g.font = `700 34px ${family}`; g.fillStyle = 'rgba(255,255,255,0.9)'; g.textAlign = 'right';
  g.fillText('ቃሉ · Qalu', size - pad, size - pad);
  const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
  const name = 'qalu-' + bookName(b).replace(/\s+/g, '-') + '-' + c + '-' + v + '.png';
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: verseRef(b, c, v) }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
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
  const shortcuts = S.browse !== 'themes' ? `<div class="row chiprow" role="group" aria-label="${t('ወደ ክፍል ዝለል', 'Jump to a section')}">${C[S.browse].map((g, gi) => `<button class="chip" data-a="jumpTo" data-v="g-${gi}" data-k="jump-${gi}">${esc(tp(g.n))}</button>`).join('')}</div>` : '';
  const main = S.searchOn
    ? searchResults()
    : `<div class="card row between"><div class="stack" style="gap:4px"><span class="muted small"><b>${t('ካቆሙበት ይቀጥሉ', 'Continue where you left off')}</b></span><span style="font-size:21px;font-weight:700">${esc(passTitle(S.pass))}</span><span class="muted small">${esc(passRef(S.pass))}</span></div>
<button class="btn fill" data-a="nav" data-v="study" data-k="continue">${t('ክፈት', 'Open')}</button></div>
${dailyCard()}
<div class="seg" role="group" aria-label="${t('የማሰሻ መንገድ', 'Browse by')}">${modes.map((m) => `<button data-a="browse" data-v="${m[0]}" data-k="mode-${m[0]}" aria-pressed="${S.browse === m[0]}">${m[1]}</button>`).join('')}</div>
<p class="muted">${notes[S.browse]}</p>
${shortcuts}
${groups.join('')}`;
  return `<div class="wrap" style="max-width:980px">
<h1>${t('ፈልግ', 'Explore')}</h1>
${searchBar()}
${main}
</div>`;
}

function options(list, selected) {
  return list.map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function voiceButton(key) {
  return S.recording
    ? `<button class="btn rec" data-a="stop" data-k="${key}" aria-label="${t('አቁም', 'Stop')}">${icon('stop')}<span class="lbl">${t('አቁም', 'Stop')}</span></button>`
    : `<button class="btn" data-a="rec" data-k="${key}" aria-label="${t('የድምፅ ማስታወሻ', 'Voice note')}" title="${t('የድምፅ ማስታወሻ', 'Voice note')}">${icon('mic')}<span class="lbl">${t('የድምፅ ማስታወሻ', 'Voice note')}</span></button>`;
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
  const tabs = [['context', t('ዳራ', 'Context'), icon('book', 18)], ['maps', t('ካርታ', 'Maps'), icon('pin', 18)], ['fathers', t('አባቶች', 'Fathers'), icon('user', 18)], ['words', t('ዋና ቃላት', 'Original'), `<b lang="${isHebrew(S.pass.b) ? 'he' : 'grc'}">${isHebrew(S.pass.b) ? 'א' : 'α'}</b>`], ['notes', t('ማስታወሻ', 'Notes'), icon('pen', 18)]];
  const st = study();
  let body = '';
  if (S.tab === 'maps') {
    body = mapsTab();
  } else if (S.tab === 'words') {
    body = wordsTab();
  } else if (S.tab === 'fathers') {
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
    body = videoCard() + `<div class="card stack"><b style="font-size:18px">${t('ስለ ', 'About ')}${esc(bookName(S.pass.b))}</b><p class="prose">${esc(tp(about))}</p>
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
  return `<aside class="sidepanel" id="study" aria-label="${t('ተጨማሪ ጥናት', 'Study sides')}">
<div class="studytabs" role="tablist" aria-label="${t('ተጨማሪ ጥናት', 'Study')}">${tabs.map((x) => `<button role="tab" data-a="tab" data-v="${x[0]}" data-k="tab-${x[0]}" aria-pressed="${S.tab === x[0]}" aria-selected="${S.tab === x[0]}">${x[2]}<span>${x[1]}</span></button>`).join('')}</div><div class="studybody">${body}</div></aside>`;
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
  // A few verses are missing from some versions (such as Joel 2:28–32 in the Oromo text), so the chapter runs to
  // whichever of the two versions on screen is longer.
  const count = Math.max(main.verses.length, S.split && alt.state === 'ok' ? alt.verses.length : 0);
  const lo = Math.max(1, p.f || 1);
  const hi = p.to ? Math.min(p.to, count) : count;
  const nums = [];
  for (let n = lo; n <= hi; n++) nums.push(n);

  const picker = pickerSheet(count);

  const importCard = hasAmharic() ? '' : `<div class="card stack"><b>${t('የአማርኛ መጽሐፍ ቅዱስ ገና አልገባም', 'No Amharic Bible imported yet')}</b><p class="muted prose">${t('ለጊዜው የእንግሊዝኛ ትርጉሞች ብቻ አሉ። የአማርኛ ጽሑፍ ፋይል (JSON) ሲኖርዎት “የመጽሐፍ ቅዱስ ፋይል አስገባ” የሚለውን ይጫኑ፤ ጽሑፉ በዚህ ኮምፒውተር ላይ ብቻ ይቀመጣል።', 'Only the English versions are available for now. When you have an Amharic text file (JSON), use “Import a Bible file”. The text stays on this computer only.')}</p></div>`;

  let verses;
  if (main.state === 'loading') verses = `<p class="muted prose" style="padding:12px" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
  else if (main.state === 'error') verses = `<p class="prose" style="padding:12px" role="alert">${t('ጽሑፉን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱና ገጹን እንደገና ይክፈቱ።', 'The text could not be loaded. Check your connection and reload the page.')}${offlineHint()}</p>`;
  else if (!nums.length) verses = `<p class="prose" style="padding:12px">${t('ለዚህ ክፍል በተመረጠው ትርጉም ጽሑፍ የለም።', 'The selected version has no text for this passage.')}</p>`;
  else {
    const il = S.inter ? originals() : null;
    const heb = isHebrew(p.b);
    const under = (n) => {
      if (!il) return '';
      if (il.state === 'loading') return `<p class="muted small ilnote" role="status">${t('የዋናው ቋንቋ ቃላት እየተጫኑ ነው…', 'Loading the original words…')}</p>`;
      if (il.state === 'error') return n === nums[0] ? `<p class="small ilnote" role="alert">${t('የዋናው ቋንቋ ቃላትን መጫን አልተቻለም።', 'The original words could not be loaded.')}${offlineHint()}</p>` : '';
      return il.verses[n] ? wordRow(n, il.verses[n], heb, S.sel === n ? pickedWord() : null) : '';
    };
    verses = nums.map((n) => `<div class="vblock">` + `<button class="verse${S.split && S.layout === 'verse' ? ' inter' : ''}" data-a="verse" data-v="${n}" data-k="v-${n}" aria-pressed="${S.sel === n}" data-hl="${S.highlights[hlKey(n)] || ''}"><span ${langOf(S.primary)}><sup>${n} </sup>${main.verses[n - 1] ? esc(main.verses[n - 1]) : `<i class="muted small">${t('(ይህ ቁጥር በዚህ ትርጉም የለም)', '(this verse is not in this version)')}</i>`}</span>${S.split && !stacked ? `<span class="alt" ${langOf(S.secondary)}>${alt.state === 'loading' ? '…' : esc(alt.verses[n - 1] || '')}</span>` : ''}</button>` + under(n) + `</div>`).join('');
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
      for (let n = lo; n <= hi2; n++) lower += `<button class="verse" data-a="verse" data-v="${n}" data-k="w-${n}" aria-pressed="${S.sel === n}" data-hl="${S.highlights[hlKey(n)] || ''}"><span ${langOf(S.secondary)}><sup>${n} </sup>${esc(alt.verses[n - 1] || '')}</span></button>`;
    }
    verses = `<div class="panes"><div class="pane" data-pane="1"><div class="pane-head">${esc(versions[S.primary].name)}</div>${verses}</div><div class="pane" data-pane="2"><div class="pane-head">${esc(versions[S.secondary].name)}</div>${lower}</div></div>`;
  }

  const credits = [S.primary].concat(S.split ? [S.secondary] : []).map((id) => versions[id].credit).filter(Boolean).join(' ');
  const colors = [['yellow', t('ቢጫ', 'Yellow')], ['green', t('አረንጓዴ', 'Green')], ['blue', t('ሰማያዊ', 'Blue')], ['pink', t('ሮዝ', 'Pink')]];
  const selbar = S.sel
    ? `<div class="row selbar" role="toolbar" aria-label="${t('የቁጥር መሣሪያዎች', 'Verse tools')}"><b class="small">${t('ቁ. ' + S.sel, 'v. ' + S.sel)}</b>
${colors.map((c) => `<button class="dot" data-a="hl" data-v="${c[0]}" data-k="hl-${c[0]}" aria-pressed="${S.highlights[hlKey(S.sel)] === c[0]}" aria-label="${c[1]}" title="${S.highlights[hlKey(S.sel)] === c[0] ? t('ቀለሙን አንሳ', 'Remove highlight') : c[1]}"><span style="background:var(--hl-${c[0]})"></span></button>`).join('')}
<button class="btn" data-a="noteTab" data-k="note-open" aria-label="${t('ማስታወሻ', 'Note')}" title="${t('ማስታወሻ', 'Note')}">${icon('pen')}<span class="lbl">${t('ማስታወሻ', 'Note')}</span></button>${voiceButton('rec-bar')}
<button class="btn" data-a="shareVerse" data-k="share-verse" aria-label="${t('እንደ ሥዕል አጋራ', 'Share as a picture')}" title="${t('እንደ ሥዕል አጋራ', 'Share as a picture')}">${icon('share')}<span class="lbl">${t('አጋራ', 'Share')}</span></button>
<button class="btn done" data-a="unsel" data-k="unsel" aria-label="${t('ጨርስ', 'Done')}" title="${t('ጨርስ', 'Done')}">${icon('check')}</button>
<button class="btn" data-a="wordsTab" data-k="words-open" aria-label="${t('ዋና ቃላት', 'Original words')}" title="${t('ዋና ቃላት', 'Original words')}"><b lang="${isHebrew(p.b) ? 'he' : 'grc'}">${isHebrew(p.b) ? 'אב' : 'αβ'}</b><span class="lbl">${t('ዋና ቃላት', 'Original words')}</span></button></div>`
    : ls.get('hintSeen', false) ? '' : `<p class="muted small" style="padding:6px 12px">${t('ለማቅለም፣ ማስታወሻ ለመያዝ ወይም በዋናው ቋንቋ ለማየት አንድ ቁጥር ይንኩ።', 'Tap a verse to highlight it, add a note or see it in the original language.')}</p>`;
  const heads = S.split && S.layout === 'side' ? `<div class="row muted small" style="padding:0 12px;gap:16px"><b style="flex:1 1 220px">${esc(versions[S.primary].name)}</b><b style="flex:1 1 220px">${esc(versions[S.secondary].name)}</b></div>` : '';

  const title = passTitle(p), ref = passRef(p);
  const first = p.b === 0 && p.c === 1, last = p.b === 65 && p.c === C.books[65].ch;
  const stepper = (key) => `<div class="row">
<button class="btn" data-a="prevCh" data-k="prev-${key}" ${first ? 'disabled' : ''}>${icon('left')}${t('ያለፈው ምዕራፍ', 'Previous chapter')}</button>
<button class="btn" data-a="nextCh" data-k="next-${key}" ${last ? 'disabled' : ''}>${t('ቀጣዩ ምዕራፍ', 'Next chapter')}${icon('right')}</button></div>`;
  const tb = (action, key, ic, label, pressed, extra = '') => `<button class="btn tb" data-a="${action}" data-k="${key}" title="${label}" aria-label="${label}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`} ${extra}>${ic}<span class="lbl">${label}</span></button>`;
  return `<div class="wrap">
<div class="readhead">
<div class="row titlebar">
<button class="btn round" data-a="prevCh" data-k="prev-top" ${first ? 'disabled' : ''} aria-label="${t('ያለፈው ምዕራፍ', 'Previous chapter')}" title="${t('ያለፈው ምዕራፍ', 'Previous chapter')} (←)">${icon('left')}</button>
<div class="titlepills"><button class="pill-btn" data-a="picker" data-v="book" data-k="title" aria-expanded="${S.picker === 'book' || S.picker === 'chap' || S.picker === 'verse'}" title="${t('መጽሐፍና ምዕራፍ ምረጥ', 'Choose book and chapter')}"><h1>${esc(bookName(p.b) + ' ' + p.c)}</h1>${icon('down', 16)}</button><button class="pill-btn ver" data-a="picker" data-v="ver" data-k="title-ver" aria-expanded="${S.picker === 'ver'}" title="${esc(versions[S.primary].name)}">${esc(shortName(S.primary))}${icon('down', 14)}</button></div>
<button class="btn round" data-a="nextCh" data-k="next-top" ${last ? 'disabled' : ''} aria-label="${t('ቀጣዩ ምዕራፍ', 'Next chapter')}" title="${t('ቀጣዩ ምዕራፍ', 'Next chapter')} (→)">${icon('right')}</button>
<button class="btn round" data-a="picker" data-v="search" data-k="search-open" aria-expanded="${S.picker === 'search'}" aria-label="${t('ፈልግ ወይም ወደ ጥቅስ ሂድ', 'Search or go to a verse')}" title="${t('ፈልግ ወይም ወደ ጥቅስ ሂድ', 'Search or go to a verse')}">${icon('search')}</button>
<button class="btn round aa" data-a="toolsOpen" data-k="tools-open" aria-expanded="${S.toolsOpen}" aria-label="${t('የንባብ መሣሪያዎች', 'Reading tools')}" title="${t('የንባብ መሣሪያዎች', 'Reading tools')}"><b>Aa</b></button>
</div>
<div class="row tools${S.toolsOpen ? ' open' : ''}" role="toolbar" aria-label="${t('የንባብ መሣሪያዎች', 'Reading tools')}">
${tb('split', 'split', icon('split'), t('ሁለት ትርጉም', 'Two versions'), S.split)}
${tb('inter', 'inter', `<b style="font-size:15px" lang="${isHebrew(p.b) ? 'he' : 'grc'}">${isHebrew(p.b) ? 'אב' : 'αβ'}</b>`, isHebrew(p.b) ? t('ዕብራይስጥ ቃላት', 'Hebrew words') : t('ግሪክ ቃላት', 'Greek words'), S.inter)}
${tb('smaller', 'smaller', '<b style="font-size:13px">A−</b>', t('ጽሑፉን አሳንስ', 'Smaller text'))}
${tb('larger', 'larger', '<b style="font-size:18px">A+</b>', t('ጽሑፉን አሳድግ', 'Larger text'))}
${tb('focus', 'focus', icon('focus'), t('ትኩረት', 'Focus'), S.focus)}
${S.split ? tb('swapVer', 'swap', '<b>⇅</b>', t('ትርጉሞቹን አቀያይር', 'Swap versions')) : ''}
${S.focus ? '' : tb('toStudy', 'to-study', icon('note'), t('ጥናት፦ ዳራ፣ ካርታ፣ አባቶች', 'Study: context, maps, fathers'))}
${p.pl ? tb('showPlace', 'show-place', icon('pin'), t('ካርታ ላይ አሳይ', 'Show on the map')) : ''}
</div></div>
${S.picker ? picker : ''}
<div class="cols"><article class="card stack reader${S.split || !S.focus ? '' : ' single'}">${selbar}${heads}<div class="verses" style="font-size:${[16, 19, 22, 25][S.size]}px">${verses}</div>${stepper('bottom')}</article>${S.focus ? '' : sidePanel()}</div>
${credits ? `<p class="muted small" lang="en">${esc(credits)}</p>` : ''}
</div>`;
}

// One-tap version switching: the versions read lately, a button that swaps the two versions, and "more" for the full list.
const shortName = (id) => versions[id].short || versions[id].name.replace(/\s*\(.*\)$/, '');

// The passage and version chooser, as in most Bible apps: book grid → chapter grid → verse grid, or a version list.
function pickerSheet(count) {
  const step = S.picker;
  if (!step) return '';
  const b = S.pickB == null ? S.pass.b : S.pickB;
  const head = (title, back) => `<div class="row between sheet-head">${back ? `<button class="btn round" data-a="picker" data-v="${back}" data-k="pk-back" aria-label="${t('ተመለስ', 'Back')}">${icon('left')}</button>` : '<span></span>'}<b>${esc(title)}</b><button class="btn round" data-a="picker" data-v="${step}" data-k="pk-close" aria-label="${t('ዝጋ', 'Close')}">${icon('close')}</button></div>`;
  let body;
  if (step === 'search') {
    return `<div class="card stack sheet" role="dialog" aria-label="${t('ፈልግ', 'Search')}">${head(t('ፈልግ ወይም ወደ ጥቅስ ሂድ', 'Search or go to a verse'))}
<p class="muted small">${t('ቃል፣ ጥያቄ ወይም ጥቅስ ይጻፉ፤ ለምሳሌ “ፍቅር”፣ “ዮሐንስ 3:16”', 'Type a word, a question or a reference, e.g. “love” or “John 3:16”')}</p>${searchBar()}${S.searchOn ? searchResults() : ''}</div>`;
  } else if (step === 'book') {
    const testament = S.pickT || (S.pass.b < 39 ? 'ot' : 'nt');
    const ids = C.books.map((_, i) => i).filter((i) => (testament === 'ot' ? i < 39 : i >= 39));
    body = head(t('መጽሐፍ', 'Book')) + `<div class="seg" role="group"><button data-a="pickTest" data-v="ot" data-k="pk-ot" aria-pressed="${testament === 'ot'}">${t('ብሉይ ኪዳን', 'Old Testament')}</button><button data-a="pickTest" data-v="nt" data-k="pk-nt" aria-pressed="${testament === 'nt'}">${t('አዲስ ኪዳን', 'New Testament')}</button></div>
<div class="bookgrid">${ids.map((i) => `<button class="cell book" data-a="pickBook" data-v="${i}" data-k="pb-${i}" aria-pressed="${i === S.pass.b}">${esc(bookName(i))}</button>`).join('')}</div>`;
  } else if (step === 'chap') {
    body = head(bookName(b), 'book') + `<div class="numgrid">${Array.from({ length: C.books[b].ch }, (_, i) => `<button class="cell" data-a="pickChap" data-v="${i + 1}" data-k="pc-${i + 1}" aria-pressed="${b === S.pass.b && i + 1 === S.pass.c}">${i + 1}</button>`).join('')}</div>`;
  } else if (step === 'verse') {
    body = head(bookName(S.pass.b) + ' ' + S.pass.c + ' · ' + t('ቁጥር', 'Verse'), C.books[S.pass.b].ch > 1 ? 'chap' : 'book') +
      `<div class="numgrid">${Array.from({ length: Math.max(count, 1) }, (_, i) => `<button class="cell" data-a="pickVerse" data-v="${i + 1}" data-k="pv-${i + 1}">${i + 1}</button>`).join('')}</div>`;
  } else {
    const which = step === 'ver2' ? S.secondary : S.primary;
    const listed = new Set(VERSION_GROUPS.flatMap((g) => g[1]));
    const groups = VERSION_GROUPS.map((g) => [tp(g[0]), g[1].filter((id) => versions[id])]).concat([[t('ያስገቧቸው', 'Imported'), Object.keys(versions).filter((id) => !listed.has(id))]]).filter((g) => g[1].length);
    body = head(step === 'ver2' ? t('ሁለተኛ ትርጉም', 'Second version') : t('ትርጉም', 'Version')) +
      `<div class="seg" role="group"><button data-a="pickerTo" data-v="ver" data-k="pk-v1" aria-pressed="${step === 'ver'}">${t('ዋና ትርጉም', 'Main version')}</button><button data-a="${S.split ? 'pickerTo' : 'split'}" data-v="ver2" data-k="pk-v2" aria-pressed="${step === 'ver2'}">${S.split ? t('ሁለተኛ ትርጉም', 'Second version') : t('+ ሁለተኛ ትርጉም አክል', '+ Add a second version')}</button></div>` +
      (step === 'ver' && S.recent.length ? `<h2 class="small muted">${t('በቅርቡ የተጠቀሙባቸው', 'Recent')}</h2><div class="row chiprow">${S.recent.filter((id) => versions[id]).map((id) => `<button class="chip" data-a="pickVer" data-v="${id}" data-k="prec-${id}" aria-pressed="${id === which}">${esc(shortName(id))}</button>`).join('')}</div>` : '') +
      groups.map((g) => `<h2 class="small muted">${esc(g[0])}</h2><div class="verlist">${g[1].map((id) => `<button class="verrow" data-a="pickVer" data-v="${id}" data-k="pver-${id}" aria-pressed="${id === which}"><b>${esc(shortName(id))}</b><span>${esc(versions[id].name)}</span></button>`).join('')}</div>`).join('') +
      (S.split ? `<div class="seg" role="group" aria-label="${t('የሁለቱ ትርጉሞች አቀማመጥ', 'Layout of the two versions')}"><button data-a="layout" data-v="verse" data-k="lay-verse" aria-pressed="${S.layout === 'verse'}">${t('ቁጥር በቁጥር', 'Verse by verse')}</button><button data-a="layout" data-v="stack" data-k="lay-stack" aria-pressed="${S.layout === 'stack'}">${t('ላይና ታች', 'Top and bottom')}</button><button data-a="layout" data-v="side" data-k="lay-side" aria-pressed="${S.layout === 'side'}">${t('ጎን ለጎን', 'Side by side')}</button></div>` : '') +
      `<button class="btn" data-a="import" data-k="import">${t('የመጽሐፍ ቅዱስ ፋይል አስገባ…', 'Import a Bible file…')}</button>`;
  }
  return `<div class="card stack sheet" role="dialog" aria-label="${t('ክፍልና ትርጉም', 'Passage and version')}">${body}</div>`;
}

function quickVersions() {
  const ids = [S.primary].concat(S.recent, ['am54', 'kjv', 'bsb']).filter((id, i, a) => versions[id] && a.indexOf(id) === i).slice(0, 5);
  const short = shortName;
  return `<div class="row chiprow qv" role="group" aria-label="${t('ትርጉም ቀይር', 'Switch version')}">${ids.map((id) => `<button class="chip" data-a="useVer" data-v="${id}" data-k="qv-${id}" aria-pressed="${id === S.primary}" title="${esc(versions[id].name)}">${esc(short(id))}</button>`).join('')}
${S.split ? `<button class="chip" data-a="swapVer" data-k="qv-swap" title="${t('ሁለቱን ትርጉሞች አቀያይር', 'Swap the two versions')}">⇅ ${esc(short(S.secondary))}</button>` : ''}
<button class="chip" data-a="picker" data-v="ver" data-k="qv-more" aria-expanded="${S.picker === 'ver'}">${t('ሌሎች ትርጉሞች…', 'More versions…')}</button></div>`;
}
function useVersion(id) {
  if (!versions[id]) return;
  if (id === S.secondary) S.secondary = S.primary;
  S.primary = id;
  S.recent = [id].concat(S.recent.filter((x) => x !== id)).slice(0, 6);
  pickVersions();
  save('primary', 'secondary', 'recent');
}

function pinIcon(i) {
  const pl = C.places[i];
  const hot = false;
  return L.divIcon({ className: '', html: `<span class="spot${S.place === i || hot ? ' on' : ''}"><span class="em">${pl.ic || '📍'}</span><b>${esc(tp(pl.n))}</b></span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
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
    lmap = L.map(mapEl, { minZoom: 4, maxZoom: 14, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, maxBounds: L.latLngBounds(sheet).pad(0.15), maxBoundsViscosity: 0.8 });
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
    lmap.on('moveend', () => atlasCluster());
    lmap.fitBounds(MAP_VIEWS.lands());
    zoomed();
  }
  if (S.tiles) { ltiles.addTo(lmap); lart.remove(); } else { ltiles.remove(); lart.addTo(lmap); }
  mapEl.dataset.tiles = S.tiles ? '1' : '';
  mapEl.querySelectorAll('[data-label]').forEach((el) => { el.textContent = tp(MAP_ART.labels[+el.dataset.label][2]); });
  return mapEl;
}

function bibleMapsSection() {
  const list = bibleMaps();
  if (!list) return `<p class="muted prose" role="status">${t('ካርታዎቹ እየተጫኑ ነው…', 'Loading the maps…')}</p>`;
  const b = S.mapBook == null ? S.pass.b : S.mapBook;
  const books = [...new Set(list.flatMap((m) => m[2].map((x) => x[0])))].sort((x, y) => x - y);
  const shown = b === -1 ? list.filter((m) => !m[2].length) : mapsFor(b, b === S.pass.b ? S.pass.c : 0);
  const items = Array.isArray(shown) ? shown : shown.exact.concat(shown.book);
  return `<h2>${t('የመጽሐፍ ቅዱስ ካርታዎች', 'Bible maps')}</h2>
<div class="row" style="align-items:flex-end"><div class="field wide"><label for="mapbook">${t('መጽሐፍ', 'Book')}</label><select id="mapbook" data-c="mapBook" data-k="mapbook">${options(books.map((i) => [i, bookName(i)]).concat([[-1, t('አጠቃላይ ካርታዎች', 'General maps')]]), b)}</select></div>
${b === S.pass.b ? `<span class="muted small">${t('አሁን ከሚያነቡት ምዕራፍ ' + S.pass.c + ' ጋር የሚሄዱት መጀመሪያ ናቸው', 'Maps for the chapter you are reading (' + S.pass.c + ') come first')}</span>` : ''}</div>
<div class="mapgrid">${items.slice(0, 24 + S.more * 2).map(mapCard).join('')}</div>${items.length > 24 + S.more * 2 ? `<button class="btn" data-a="more" data-k="more-bmaps">${t('ተጨማሪ አሳይ', 'Show more')} (${items.length - 24 - S.more * 2})</button>` : ''}
<p class="muted small" lang="en">${MAP_CREDIT}</p>`;
}

function storyMapView() {
  const pl = C.places[S.place];
  const here = [];
  C.timeline.forEach((g) => g.items.forEach((it) => { if (it.pl === pl.id) here.push(it); }));
  const chosen = `<div class="card stack"><div class="row"><span class="spot on static" aria-hidden="true"><span class="em">${pl.ic || '📍'}</span></span><b style="font-size:20px">${esc(tp(pl.n))}</b></div>
${pl.note ? `<p class="muted prose">${esc(tp(pl.note))}</p>` : ''}
<div class="grid">${here.map((it) => tile(tp(it.n), tp(it.sub), { b: it.p.b, c: it.p.c, f: it.p.f, to: it.p.to, title: it.n, pl: it.pl })).join('')}</div></div>`;
  const list = C.places.map((p, i) => `<button class="btn place" data-a="place" data-v="${i}" data-k="place-${i}" aria-pressed="${S.place === i}"><span aria-hidden="true">${p.ic || '📍'}</span>${esc(tp(p.n))}</button>`).join('');
  const links = C.links.map((l, i) => `<a class="tile" href="${esc(l.url)}" target="_blank" rel="noopener" data-k="link-${i}"><b>${esc(tp(l.n))}</b><span class="muted small">${esc(tp(l.d))}</span></a>`).join('');
  return `
<div class="row chiprow" role="group" aria-label="${t('የካርታ እይታ', 'Map view')}">
<button class="btn" data-a="mapView" data-v="lands" data-k="mv-lands">${t('የመጽሐፍ ቅዱስ አገሮች', 'Bible lands')}</button>
<button class="btn" data-a="mapView" data-v="all" data-k="mv-all">${t('ሁሉም ስፍራዎች', 'All places')}</button>
<button class="btn" data-a="mapView" data-v="land" data-k="mv-land">${t('ቅድስት አገር', 'The Holy Land')}</button>
<button class="btn" data-a="mapView" data-v="city" data-k="mv-city">${t('ኢየሩሳሌምና አካባቢዋ', 'Around Jerusalem')}</button>
<button class="btn" data-a="geoOn" data-k="geo-on" aria-pressed="${!!S.geoOn}">${icon('pin')}${t('የ' + bookName(S.pass.b) + ' ' + S.pass.c + ' ስፍራዎች', 'Places in ' + bookName(S.pass.b) + ' ' + S.pass.c)}</button>
<button class="btn" data-a="tiles" data-k="tiles" aria-pressed="${S.tiles}">${icon('globe')}${t('የዛሬ ካርታ', 'Present-day map')}</button></div>
<div class="maps"><div id="mapslot"><p class="muted prose" style="padding:16px">${t('ካርታውን መጫን አልተቻለም።', 'The map could not be loaded.')}</p></div>
<div class="stack mapside">${chosen}<div class="row placelist">${list}</div></div></div>
<p class="muted small">${t('የሥዕሎቹ ስፍራ ግምታዊ ነው፤ አንዳንዶቹም በትውፊት የሚታወቁ ናቸው። የአገሮቹ ስሞች የዛሬዎቹ ናቸው። ስፍራቸው የማይታወቅ ወይም ምሳሌ የሆኑ ታሪኮች ሥዕል የላቸውም። “የዛሬ ካርታ” የኢንተርኔት ግንኙነት ያስፈልገዋል (OpenStreetMap)።', 'Picture positions are approximate and some are traditional sites; country names are present-day. Stories whose location is unknown, and parables, have no picture. “Present-day map” needs an internet connection (OpenStreetMap).')}</p>
<h2>${t('ጠቃሚ ማስፈንጠሪያዎች', 'Helpful links')}</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${links}</div>`;
}

// The Map screen: the Atlas (pictures pinned where they happen, journeys as routes), the story places, or the gallery.
function mapView() {
  const mode = S.mapMode || 'atlas';
  const seg = (v, label) => `<button data-a="mapMode" data-v="${v}" data-k="mm-${v}" aria-pressed="${mode === v}">${label}</button>`;
  const head = `<div class="stack"><h1>${t('የመጽሐፍ ቅዱስ ካርታ', 'Bible map')}</h1>
<div class="seg" role="group" aria-label="${t('የካርታ ዓይነት', 'Kind of map')}">${seg('atlas', t('አትላስ', 'Atlas'))}${seg('story', t('የታሪክ ስፍራዎች', 'Story places'))}${seg('gallery', t('ሥዕሎች', 'Pictures'))}</div></div>`;
  let body;
  if (mode === 'story') body = storyMapView();
  else if (mode === 'gallery') body = bibleMapsSection();
  else {
    const on = (k) => S.atlas[k] !== false;
    const chip = (k, label, extra = '') => `<button class="chip" data-a="atlasToggle" data-v="${k}" data-k="at-${k}" aria-pressed="${on(k)}">${extra}${label}</button>`;
    const tst = S.atlas.t || 'all';
    body = `<p class="muted">${t('ሥዕሎቹ በታሪካቸው ስፍራ ላይ ተቀምጠዋል፤ መንገዶቹም የጉዞዎቹ ናቸው። ማብራሪያ ለማየት ጠቋሚውን በላያቸው ያሳርፉ (በስልክ ይንኩ)።', 'Each picture sits where its story happens, and the lines are the great journeys. Hover over one for its explanation (tap on a phone).')}</p>
<div class="row chiprow" role="group" aria-label="${t('ማጣሪያ', 'Filters')}">${chip('routes', t('መንገዶች', 'Routes'), '〰 ')}${chip('pics', t('ሥዕሎች', 'Pictures'), '🖼 ')}
<button class="chip" data-a="atlasT" data-v="all" data-k="att-all" aria-pressed="${tst === 'all'}">${t('ሁሉም', 'All')}</button><button class="chip" data-a="atlasT" data-v="ot" data-k="att-ot" aria-pressed="${tst === 'ot'}">${t('ብሉይ', 'Old Testament')}</button><button class="chip" data-a="atlasT" data-v="nt" data-k="att-nt" aria-pressed="${tst === 'nt'}">${t('አዲስ', 'New Testament')}</button>
<button class="chip" data-a="tiles" data-k="tiles" aria-pressed="${S.tiles}">${t('የዛሬ ካርታ', 'Present-day map')}</button></div>
<div class="maps atlas"><div id="mapslot"><p class="muted prose" style="padding:16px">${t('ካርታውን መጫን አልተቻለም።', 'The map could not be loaded.')}</p></div>
<div class="stack mapside">${atlasSide()}</div></div>
<p class="muted small" lang="en">${MAP_CREDIT} ${GEO_CREDIT}</p>`;
  }
  return `<div class="wrap">${head}${body}</div>`;
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
  const langAttr = langOf(S.primary, st.p.b);
  const top = (fill, right) => `<div class="row lesson-top"><button class="btn" data-a="storyQuit" data-k="quit" aria-label="${t('ወደ ጉዞው ተመለስ', 'Back to the journey')}" title="${t('ወደ ጉዞው ተመለስ', 'Back to the journey')}">${icon('close')}</button><div class="bar" style="flex:1"><i style="width:${fill}%"></i></div>${right}</div>`;
  let body;
  if (p.step === 'read') {
    const vs = storyVerses(st.p);
    let text;
    if (vs.state === 'loading') text = `<p class="muted prose" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
    else if (vs.state === 'error') text = `<p class="prose" role="alert">${t('ጽሑፉን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱና እንደገና ይሞክሩ።', 'The text could not be loaded. Check your connection and try again.')}</p><button class="btn" data-a="story" data-v="${p.i}" data-k="reload">${t('እንደገና ሞክር', 'Try again')}</button>`;
    else if (!vs.list.length) text = `<p class="prose">${t('ለዚህ ክፍል በተመረጠው ትርጉም ጽሑፍ የለም።', 'The selected version has no text for this passage.')}</p>`;
    else text = `<div class="verses story-text" ${langAttr}>${vs.list.map((v) => `<p><sup>${v.n} </sup>${esc(v.text)}</p>`).join('')}</div>`;
    body = top(0, '') + `<div class="stack" style="gap:4px"><span class="pill" style="background:var(--era);color:#14161A">${esc(tp(era.n))} · ${p.i + 1} / ${stories().length}</span><h1>${esc(tp(st.n))}</h1><span class="muted small">${esc(passRef(st.p))}</span></div>
${videoCard(st.p.b, st.p.c)}
<article class="card stack">${text}</article>
${vs.state === 'ok' ? `<button class="btn fill go" data-a="storyQuiz" data-k="quiz">${vs.list.length ? t('ጥያቄዎቹን ጀምር', 'Start the quiz') : t('ቀጥል', 'Continue')}${icon('right')}</button>` : ''}`;
  } else if (p.step === 'quiz') {
    const q = p.qs[p.q], answered = p.picked != null, right = answered && q.options[p.picked] === q.answer;
    const prompt = q.kind === 'word'
      ? esc(q.text).replace('\u0000', '<span class="blank"></span>')
      : esc(q.text);
    const opts = q.options.map((o, i) => `<button class="opt${answered && o === q.answer ? ' right' : ''}${answered && i === p.picked && o !== q.answer ? ' wrong' : ''}" data-a="answer" data-v="${i}" data-k="opt-${p.q}-${i}" ${langAttr} ${answered ? 'disabled' : ''}>${esc(o)}</button>`).join('');
    body = top(Math.round(((p.q + (answered ? 1 : 0)) / p.qs.length) * 100), marks('hearts', 'heart', p.hearts, 3, 22)) +
      `<div class="stack" style="gap:4px"><span class="muted small"><b>${t('ጥያቄ', 'Question')} ${p.q + 1} / ${p.qs.length}</b></span><h2>${q.kind === 'word' ? t('የጎደለው ቃል የትኛው ነው?', 'Which word is missing?') : t('ቀጥሎ የሚመጣው ቁጥር የትኛው ነው?', 'Which verse comes next?')}</h2></div>
<div class="card"><p class="prose big" ${langAttr}><sup class="muted">${q.n} </sup>${prompt}</p></div>
<div class="stack">${opts}</div>
${answered ? `<div class="verdict ${right ? 'good' : 'bad'} stack" role="status"><b>${right ? t('ትክክል!', 'Correct!') : t('ትክክል አይደለም', 'Not quite')}</b><span ${langAttr}><sup>${q.fullN || q.n} </sup>${esc(q.full)}</span></div>
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
  const offBanner = navigator.onLine === false && S.screen !== 'offline' ? `<button class="offbanner" data-a="nav" data-v="offline" data-k="offbanner">${icon('wifiOff', 16)}${t('ኢንተርኔት የለም፤ የተቀመጡት ይሠራሉ', 'Offline: saved content still works')}</button>` : '';
  const view = offBanner + (S.screen === 'offline' ? offlineView() : S.screen === 'journey' ? journeyView() : S.screen === 'study' ? studyView() : S.screen === 'notes' ? notesView() : S.screen === 'map' ? mapView() : browseView());
  root.innerHTML = sideMenu() + '<main>' + view + '</main>' + mapViewer();
  const newPanel = root.querySelector('.sidepanel');
  if (newPanel && panelTop) newPanel.scrollTop = panelTop;     // keep the side panel where the reader left it
  if (S.jump && S.screen === 'journey' && !S.play) {
    // On arriving at the journey, bring the next story to play into view.
    const now = root.querySelector('.node.now');
    if (now && S.game.done[0]) now.scrollIntoView({ block: 'center' });
    S.jump = false;
  }
  const slot = root.querySelector('.mapview [data-mapslot]') || root.querySelector('[data-mapslot]') || root.querySelector('#mapslot');
  if (slot) {
    const el = ensureMap();
    if (el) {
      slot.replaceChildren(el);
      lmap.invalidateSize();
      // Our own layer: the viewer shows its map's passages, the Maps tab the chapter being read, the Map screen the
      // chapter too when "This chapter" is on.
      const vm = slot.closest('.mapview') && viewerMap();
      const atlasOn = !vm && !slot.matches('[data-mapslot]') && S.screen === 'map' && (S.mapMode || 'atlas') === 'atlas';
      const refs = vm ? (vm[2].length ? vm[2] : [[S.pass.b, S.pass.c, S.pass.c]]) : slot.matches('[data-mapslot]') || (S.geoOn && !atlasOn) ? [[S.pass.b, S.pass.c, S.pass.c]] : null;
      applyAtlas(atlasOn);
      const picId = vm && vm[0] !== -1 && (S.mapLayer || 'pic') === 'overlay' && calib()[vm[0]] ? vm[0]
        : atlasOn && S.atlasSel && S.atlasSel.type === 'map' && S.atlasPin && calib()[S.atlasSel.id] ? S.atlasSel.id : null;
      if (atlasOn && render.atlasFit !== true && atlasData()) { render.atlasFit = true; lmap.fitBounds(MAP_VIEWS.lands()); }
      if (!atlasOn) render.atlasFit = false;
      const slotKey = (vm ? 'v' + vm[0] : slot.dataset.mapslot || 'screen') + '|' + JSON.stringify(refs);
      const fit = S.mvFit || render.geoSlot !== slotKey;
      applyGeo(refs, fit && !!refs && !picId);
      applyPic(picId, fit);
      if (fit && refs && geoFor(refs)) { render.geoSlot = slotKey; S.mvFit = false; }
      if (!refs) render.geoSlot = slotKey;
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
  nav(v) { S.menu = false; S.screen = v; S.play = null; S.jump = true; if (v === 'offline') { S.msg = ''; offlineCheck(); } save('screen'); restoreScroll.want = true; },
  offSave(v) { offlineSave([v]); return false; },
  offEssentials() { offlineSave([...new Set([S.primary, S.secondary])].filter((id) => OFF.packs && OFF.packs[id]).concat(['fathers', 'context'])); return false; },
  offStop() { OFF.stop = true; return false; },
  offRemove(v) { offlineRemove(v); return false; },
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
  guest() { S.guest = true; S.msg = ''; save('guest'); loadAccount(); },
  signIn() { S.guest = false; S.msg = ''; save('guest'); loadAccount(); },
  signOut() {
    S.user = null; S.guest = false; save('user', 'guest');
    ls.set('fbsession', null); SY.token = ''; SY.state = '';   // forget the sync session on this device
    loadAccount();        // clears this account's highlights and notes from the screen
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();   // do not sign straight back in
  },
  theme() { S.dark = !S.dark; save('dark'); },
  syncNow() {
    // An account signed in before sync was set up has no sync session yet: signing in again creates one.
    if (SY.state === 'signin') { actions.signOut(); return; }
    syncNow(); return false;
  },
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
    S.pass = { b: r.b, c: r.c, f: 1, to: 0 }; S.sel = r.v; S.goVerse = r.v; S.more = 8; S.screen = 'study'; S.picker = false;
    save('pass', 'screen', 'sel', 'primary', 'secondary');
  },
  concept(v) { S.theme = S.theme === +v ? null : +v; },
  open(v) { S.pass = opens[+v]; S.sel = null; S.more = 8; S.screen = 'study'; save('pass', 'screen'); window.scrollTo(0, 0); },
  verse(v) { S.sel = S.sel === +v ? null : +v; S.more = 8; save('sel'); ls.set('hintSeen', true); },
  inter() { S.inter = !S.inter; save('inter'); },
  shareVerse() { if (S.sel) shareVersePicture(S.primary, S.pass.b, S.pass.c, S.sel); return false; },
  shareDaily() { const [b, c, v] = dailyRef(); shareVersePicture(S.primary, b, c, v); return false; },
  openDaily() { const [b, c, v] = dailyRef(); S.pass = { b, c, f: 1, to: 0 }; S.sel = v; S.goVerse = v; S.screen = 'study'; save('pass', 'screen', 'sel'); window.scrollTo(0, 0); },
  wordsTab() {
    S.tab = 'words'; S.focus = false; save('tab');
    // On narrow screens the side panel sits under the reading, so bring it into view.
    if (window.innerWidth < 1000) requestAnimationFrame(() => { const el = document.querySelector('.sidepanel .seg'); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } });
  },
  word(v) {
    const [n, i] = v.split(':').map(Number);
    S.sel = n; S.word = i; S.wordAt = S.pass.b + '.' + S.pass.c + '.' + n; S.tab = 'words'; S.focus = false; save('sel', 'tab');
    requestAnimationFrame(() => { const el = document.getElementById('ilc-' + i); if (el) el.scrollIntoView({ block: 'nearest' }); });
  },
  hl(v) { const k = hlKey(S.sel); S.highlights[k] = S.highlights[k] === v ? '' : v; save('highlights'); },
  unsel() { S.sel = null; save('sel'); },
  clearHl() { S.highlights[hlKey(S.sel)] = ''; save('highlights'); },   // '' rather than delete, so the clearing syncs
  tab(v) { S.tab = v; save('tab'); },
  openMap(v) { if (calib()[+v]) S.mapLayer = 'overlay'; S.mapList = [...root.querySelectorAll('.mapcard')].map((e) => +e.dataset.v).filter((x, i, a) => a.indexOf(x) === i); S.bigMap = +v; S.mapZoom = 1; S.mvFit = true; document.body.style.overflow = 'hidden'; },
  mapStep(v) { const i = S.mapList.indexOf(S.bigMap) + +v; if (S.mapList[i] != null) { S.bigMap = S.mapList[i]; if (calib()[S.bigMap]) S.mapLayer = 'overlay'; S.mapZoom = 1; S.mvFit = true; } },
  mapLayer(v) { S.mapLayer = v; S.mvFit = true; ls.set('mapLayer', v); },
  geoPlace(v) { const m = lgeoMarks[+v]; if (m) { lmap.setView(m.getLatLng(), Math.max(lmap.getZoom(), 8)); m.openPopup(); } return false; },
  geoVerse(v) { const [b, c, n] = v.split('.').map(Number); S.bigMap = null; document.body.style.overflow = ''; setPass({ b, c, f: 1, to: 0 }); S.sel = n; S.goVerse = n; S.screen = 'study'; save('sel', 'screen'); },
  geoBig() { S.mapList = []; S.bigMap = -1; S.mapLayer = 'live'; S.mvFit = true; document.body.style.overflow = 'hidden'; },
  mapMode(v) { S.mapMode = v; ls.set('mapMode', v); render.geoSlot = ''; },
  atlasToggle(v) { S.atlas = Object.assign({}, S.atlas, { [v]: S.atlas[v] === false }); ls.set('atlas', S.atlas); },
  atlasT(v) { S.atlas = Object.assign({}, S.atlas, { t: v }); S.atlasSel = null; ls.set('atlas', S.atlas); },
  atlasRoute(v) { S.atlasSel = { type: 'route', id: v }; const rt = GEO.routes.find((x) => x.id === v); if (rt && lmap) lmap.fitBounds(rt.pts.map((p) => [p[0], p[1]]), { padding: [40, 40] }); },
  atlasClear() { S.atlasSel = null; S.atlasPin = false; },
  atlasPin() { S.atlasPin = !S.atlasPin; if (!S.atlasPin && lmap) lmap.fitBounds(MAP_VIEWS.lands()); },
  atlasOpen(v) { S.mapList = [+v]; actions.openMap(v); S.mapList = [+v]; },
  geoOn() { S.geoOn = !S.geoOn; render.geoSlot = ''; },
  mvPlace(v) { S.place = +v; if (lmap) lmap.setView([C.places[+v].lat, C.places[+v].lon], 9); },
  closeMap() { S.bigMap = null; document.body.style.overflow = ''; },
  mapZoom(v) { S.mapZoom = Math.min(4, Math.max(1, (S.mapZoom || 1) + +v)); },
  mapRead(v) { const [b, c] = v.split('.').map(Number); S.bigMap = null; document.body.style.overflow = ''; setPass({ b, c, f: 1, to: 0 }); S.screen = 'study'; save('screen'); window.scrollTo(0, 0); },
  place(v) { S.place = +v; save('place'); const p = C.places[S.place]; if (lmap) lmap.setView([p.lat, p.lon], Math.max(lmap.getZoom(), 9)); },
  mapView(v) { if (lmap) lmap.fitBounds(MAP_VIEWS[v](), { padding: [30, 30] }); return false; },
  tiles() { S.tiles = !S.tiles; save('tiles'); },
  showPlace() { const i = C.places.findIndex((p) => p.id === S.pass.pl); if (i < 0) return false; S.place = i; S.screen = 'map'; save('screen'); setTimeout(() => { if (lmap) lmap.setView([C.places[i].lat, C.places[i].lon], 10); }, 0); },
  picker(v) { S.picker = S.picker === (v || 'book') ? false : (v || 'book'); window.scrollTo(0, 0); if (S.picker === 'search') setTimeout(() => { const q = document.getElementById('q'); if (q) q.focus(); }, 0); },
  pickBook(v) { S.pickB = +v; S.picker = C.books[+v].ch === 1 ? 'verse' : 'chap'; if (C.books[+v].ch === 1) setPass({ b: +v, c: 1, f: 1, to: 0 }); },
  pickChap(v) { setPass({ b: S.pickB == null ? S.pass.b : S.pickB, c: +v, f: 1, to: 0 }); S.picker = 'verse'; },
  pickVerse(v) { S.picker = false; S.pickB = null; if (+v > 1) { S.sel = +v; S.goVerse = +v; save('sel'); } window.scrollTo(0, 0); },
  pickVer(v) { if (S.picker === 'ver2') { S.secondary = v; save('secondary'); } else useVersion(v); S.picker = false; },
  pickTest(v) { S.pickT = v; },
  pickerTo(v) { S.picker = v; },
  menu() { S.menu = !S.menu; },
  toolsOpen() { S.toolsOpen = !S.toolsOpen; },
  toStudy() { S.toolsOpen = false; setTimeout(() => { const el = document.getElementById('study'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); },
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
  split(v) { S.split = !S.split; if (v === 'ver2') S.picker = S.split ? 'ver2' : 'ver'; save('split'); },
  useVer(v) { useVersion(v); },
  swapVer() { useVersion(S.secondary); },
  layout(v) { S.layout = v; ls.set('layout2', v); },
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
    S.gone = (S.gone || []).concat(v);
    save('notes', 'gone');
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
  primary(v) { useVersion(v); },
  secondary(v) { S.secondary = v; save('secondary'); },
  mapBook(v) { S.mapBook = +v; S.more = 8; },
  qv(v) { S.qv = v; save('qv'); if (S.searchOn) { runSearch(); } }
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
  if (el.tagName === 'A') e.preventDefault(); // links that open in the app, such as videos, stay links only as a fallback
  if (actions[el.dataset.a](el.dataset.v) !== false) render();
});
// On phones a sideways swipe over the text turns the chapter, as in most Bible apps.
let swipe = null;
// In the map viewer, a swipe sideways moves between maps and a swipe down closes it (when the picture is not zoomed).
let mvSwipe = null;
document.addEventListener('touchstart', (e) => { mvSwipe = S.bigMap && e.touches.length === 1 && e.target.closest('.mv-pic') && (S.mapZoom || 1) === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!mvSwipe) return;
  const dx = e.changedTouches[0].clientX - mvSwipe.x, dy = e.changedTouches[0].clientY - mvSwipe.y;
  mvSwipe = null;
  if (dy > 90 && Math.abs(dx) < dy * 0.6) actions.closeMap();
  else if (Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.6) actions.mapStep(dx < 0 ? 1 : -1);
  else return;
  render();
}, { passive: true });
root.addEventListener('touchstart', (e) => {
  swipe = S.screen === 'study' && !S.picker && !S.bigMap && e.touches.length === 1 && e.target.closest('.reader') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
}, { passive: true });
root.addEventListener('touchend', (e) => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
  const quick = Date.now() - swipe.t < 600;
  swipe = null;
  if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  actions[dx < 0 ? 'nextCh' : 'prevCh']();
  render();
}, { passive: true });
root.addEventListener('change', (e) => {
  const el = e.target.closest('[data-c]');
  if (!el) return;
  changes[el.dataset.c](el.value);
  render();
});
root.addEventListener('input', (e) => {
  if (e.target.id === 'draft') S.draft = e.target.value;
  if (e.target.id === 'q') S.q = e.target.value;
  if (e.target.id === 'picop') { S.picOpacity = e.target.value / 100; ls.set('picOpacity', S.picOpacity); if (lpic) lpic.setOpacity(S.picOpacity); }
});
root.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-search]')) return;
  e.preventDefault();
  const ref = parseRef(S.q);
  if (ref) {   // a reference such as "John 3:16" or "ዮሐ 3" opens the passage instead of searching
    setPass({ b: ref.b, c: ref.c, f: 1, to: 0 });
    if (ref.v) { S.sel = ref.v; S.goVerse = ref.v; save('sel'); }
    S.picker = false; S.screen = 'study'; save('screen'); window.scrollTo(0, 0); render();
    return;
  }
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
  await loadAccount();
  render();
  if (S.searchOn && S.screen === 'browse' && (S.user || S.guest)) runSearch();   // bring back the last search
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();

// Phones: the bottom dock slides away while scrolling down through the text and returns on any scroll up,
// near the top, or at the end of the page.
(() => {
  let lastY = window.scrollY, ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY, end = y + innerHeight >= document.documentElement.scrollHeight - 40;
      const hide = innerWidth <= 760 && y > 120 && y > lastY + 4 && !end && !S.picker && !S.menu;
      if (hide) root.classList.add('dock-hidden');
      else if (y < lastY - 4 || y <= 120 || end) root.classList.remove('dock-hidden');
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
})();
