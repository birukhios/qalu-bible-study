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
  sel: null,
  tab: 'fathers',
  split: ls.get('split', true),
  focus: false,
  size: ls.get('size', 1),
  primary: ls.get('primary', ''),
  secondary: ls.get('secondary', 'kjv'),
  highlights: ls.get('highlights', {}),
  notes: ls.get('notes', []),
  draft: '',
  recording: false,
  msg: ''
};
let C = null; // stories, book names and study content
const versions = {
  web: { id: 'web', name: 'World English Bible', language: 'en', file: 'data/web.json', books: null },
  kjv: { id: 'kjv', name: 'King James Version', language: 'en', file: 'data/kjv.json', books: null }
};
let opens = []; // passages that tiles on the current screen open
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

function loadVersion(id) {
  const v = versions[id];
  if (!v || v.books || v.loading || !v.file) return;
  v.loading = true;
  fetch(v.file).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => { v.books = j.books; v.loading = false; render(); })
    .catch(() => { v.loading = false; v.error = true; render(); });
}

// Returns { state: 'ok' | 'loading' | 'error', verses: [] } for the current chapter in one version.
function chapter(id) {
  const v = versions[id];
  if (!v) return { state: 'error', verses: [] };
  if (!v.books) { loadVersion(id); return { state: v.error ? 'error' : 'loading', verses: [] }; }
  const ch = (v.books[S.pass.b] || [])[S.pass.c - 1] || [];
  return { state: 'ok', verses: ch };
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
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};
const icon = (name, size = 18) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ---------- views ----------
function sideMenu() {
  const nav = (screen, ic, label) => `<button class="nav" data-a="nav" data-v="${screen}" data-k="nav-${screen}" ${S.screen === screen ? 'aria-current="page"' : ''}>${icon(ic, 20)}${esc(label)}</button>`;
  return `<nav class="side" aria-label="${t('ዋና ማውጫ', 'Main')}">
<div class="brand">${icon('logo', 26)}<span>ቃሉ</span></div>
${nav('browse', 'grid', t('መጽሐፍ ቅዱስ', 'Bible'))}
${nav('study', 'book', t('ጥናት', 'Study'))}
${nav('notes', 'note', t('ማስታወሻዎች', 'Notes'))}
<div class="spacer"></div>
<button class="nav" data-a="lang" data-k="lang">${icon('globe', 20)}${t('English', 'አማርኛ')}</button>
<button class="nav" data-a="theme" data-k="theme">${icon('moon', 20)}${S.dark ? t('ብሩህ ገጽታ', 'Light mode') : t('ጨለማ ገጽታ', 'Dark mode')}</button>
</nav>`;
}

function tile(title, sub, pass) {
  opens.push(pass);
  return `<button class="tile" data-a="open" data-v="${opens.length - 1}" data-k="tile-${opens.length - 1}"><b>${esc(title)}</b><span class="muted small">${esc(sub)}</span></button>`;
}

function browseView() {
  const modes = [['timeline', t('የታሪክ መስመር', 'Story timeline')], ['chrono', t('በጊዜ ቅደም ተከተል', 'Chronological')], ['canon', t('መደበኛ ቅደም ተከተል', 'Traditional order')]];
  const notes = {
    timeline: t('ዋና ዋና ታሪኮች በተፈጸሙበት ቅደም ተከተል።', 'Key stories in the order they happened.'),
    chrono: t('መጻሕፍቱ በሚተርኩት ዘመን ቅደም ተከተል፤ ግምታዊ ነው፥ ሊቃውንትም በአንዳንዶቹ ይለያያሉ።', 'Books by the period they describe. The order is approximate and scholars differ on some.'),
    canon: t('66ቱ መጻሕፍት በመጽሐፍ ቅዱስ ውስጥ ባሉበት ቅደም ተከተል።', 'The 66 books in the order they appear in the Bible.')
  };
  const groups = C[S.browse].map((g) => {
    const items = g.items
      ? g.items.map((it) => tile(tp(it.n), tp(it.sub), { b: it.p.b, c: it.p.c, f: it.p.f, to: it.p.to, title: it.n }))
      : g.books.map((b) => tile(bookName(b), C.books[b].ch + ' ' + t('ምዕራፍ', C.books[b].ch === 1 ? 'chapter' : 'chapters'), { b, c: 1, f: 1, to: 0 }));
    return `<section class="group"><h2>${esc(tp(g.n))}</h2><div class="grid">${items.join('')}</div></section>`;
  });
  return `<div class="wrap" style="max-width:980px">
<div class="stack"><h1>${t('መጽሐፍ ቅዱስን ያስሱ', 'Browse the Bible')}</h1><p class="muted">${notes[S.browse]}</p></div>
<div class="seg" role="group" aria-label="${t('የማሰሻ መንገድ', 'Browse by')}">${modes.map((m) => `<button data-a="browse" data-v="${m[0]}" data-k="mode-${m[0]}" aria-pressed="${S.browse === m[0]}">${m[1]}</button>`).join('')}</div>
<div class="card row between"><div class="stack" style="gap:4px"><span class="muted small"><b>${t('ካቆሙበት ይቀጥሉ', 'Continue where you left off')}</b></span><span style="font-size:21px;font-weight:700">${esc(passTitle(S.pass))}</span><span class="muted small">${esc(passRef(S.pass))}</span></div>
<button class="btn fill" data-a="nav" data-v="study" data-k="continue">${t('ክፈት', 'Open')}</button></div>
${groups.join('')}
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
    body = st
      ? st.fathers.map((f) => `<div class="card stack" style="gap:8px"><div class="row between" style="align-items:baseline"><b style="font-size:18px">${esc(tp(f.name))}</b><span class="muted small">${esc(tp(f.era))}</span></div><span class="pill">${esc(tp(f.theme))}</span><p class="prose">${esc(tp(f.text))}</p><span class="muted small">${esc(tp(f.source))}</span></div>`).join('') +
        `<p class="muted small">${t('ረቂቅ ማጠቃለያዎች፦ ከምንጮቹ ጋር መመሳከር ያስፈልጋቸዋል።', 'Draft summaries: each still needs checking against its source.')}</p>`
      : `<div class="card"><p class="muted prose">${t('ለዚህ ክፍል የአባቶች ትርጓሜ ገና አልተዘጋጀም።', 'The fathers’ readings for this passage have not been prepared yet.')}</p></div>`;
  } else if (S.tab === 'context') {
    body = `<div class="card stack"><b>${t('ቪዲዮና ሥዕላዊ ማብራሪያ', 'Videos and visual guides')}</b><p class="prose">${t('BibleProject ስለ እያንዳንዱ መጽሐፍና ጭብጥ አጫጭር ቪዲዮዎች አሉት። በድረ ገጻቸው ይከፈታል።', 'BibleProject has short videos on each book and theme. This opens on their website.')}</p><a class="btn fill" style="align-self:flex-start" href="https://bibleproject.com/" target="_blank" rel="noopener" data-k="bp">${t('BibleProjectን ክፈት', 'Open BibleProject')}</a></div>` +
      (st ? st.context.map((e) => `<div class="card stack" style="gap:6px"><b>${esc(tp(e.head))}</b><p class="prose">${esc(tp(e.body))}</p></div>`).join('') : '');
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
<div class="seg" role="group">${tabs.map((x) => `<button data-a="tab" data-v="${x[0]}" data-k="tab-${x[0]}" aria-pressed="${S.tab === x[0]}">${x[1]}</button>`).join('')}</div>${body}</aside>`;
}

function studyView() {
  const p = S.pass;
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
<button class="btn" data-a="import" data-k="import">${t('የመጽሐፍ ቅዱስ ፋይል አስገባ…', 'Import a Bible file…')}</button>
</div></div>`;

  const importCard = hasAmharic() ? '' : `<div class="card stack"><b>${t('የአማርኛ መጽሐፍ ቅዱስ ገና አልገባም', 'No Amharic Bible imported yet')}</b><p class="muted prose">${t('ለጊዜው የእንግሊዝኛ ትርጉሞች ብቻ አሉ። የአማርኛ ጽሑፍ ፋይል (JSON) ሲኖርዎት “የመጽሐፍ ቅዱስ ፋይል አስገባ” የሚለውን ይጫኑ፤ ጽሑፉ በዚህ ኮምፒውተር ላይ ብቻ ይቀመጣል።', 'Only the English versions are available for now. When you have an Amharic text file (JSON), use “Import a Bible file”. The text stays on this computer only.')}</p></div>`;

  let verses;
  if (main.state === 'loading') verses = `<p class="muted prose" style="padding:12px" role="status">${t('ጽሑፉ እየተጫነ ነው…', 'Loading the text…')}</p>`;
  else if (main.state === 'error') verses = `<p class="prose" style="padding:12px" role="alert">${t('ጽሑፉን መጫን አልተቻለም። ግንኙነትዎን ይመልከቱና ገጹን እንደገና ይክፈቱ።', 'The text could not be loaded. Check your connection and reload the page.')}</p>`;
  else if (!nums.length) verses = `<p class="prose" style="padding:12px">${t('ለዚህ ክፍል በተመረጠው ትርጉም ጽሑፍ የለም።', 'The selected version has no text for this passage.')}</p>`;
  else {
    verses = nums.map((n) => `<button class="verse" data-a="verse" data-v="${n}" data-k="v-${n}" aria-pressed="${S.sel === n}" data-hl="${S.highlights[hlKey(n)] || ''}"><span lang="${versions[S.primary].language}"><sup>${n} </sup>${esc(main.verses[n - 1] || '')}</span>${S.split ? `<span class="alt" lang="${versions[S.secondary].language}">${alt.state === 'loading' ? '…' : esc(alt.verses[n - 1] || '')}</span>` : ''}</button>`).join('');
  }

  const colors = [['yellow', t('ቢጫ', 'Yellow')], ['green', t('አረንጓዴ', 'Green')], ['blue', t('ሰማያዊ', 'Blue')], ['pink', t('ሮዝ', 'Pink')]];
  const selbar = S.sel
    ? `<div class="row selbar" role="toolbar" aria-label="${t('የቁጥር መሣሪያዎች', 'Verse tools')}"><b class="small">${t('ቁ. ' + S.sel, 'v. ' + S.sel)}</b>
${colors.map((c) => `<button class="dot" data-a="hl" data-v="${c[0]}" data-k="hl-${c[0]}" aria-label="${c[1]}" title="${c[1]}"><span style="background:var(--hl-${c[0]})"></span></button>`).join('')}
<button class="btn" data-a="clearHl" data-k="hl-clear">${t('አጥፋ', 'Clear')}</button>
<button class="btn" data-a="noteTab" data-k="note-open">${icon('pen')}${t('ማስታወሻ', 'Note')}</button>${voiceButton('rec-bar')}</div>`
    : `<p class="muted small" style="padding:6px 12px">${t('ለማቅለም ወይም ማስታወሻ ለመያዝ አንድ ቁጥር ይንኩ።', 'Click a verse to highlight it or add a note.')}</p>`;
  const heads = S.split ? `<div class="row muted small" style="padding:0 12px;gap:16px"><b style="flex:1 1 220px">${esc(versions[S.primary].name)}</b><b style="flex:1 1 220px">${esc(versions[S.secondary].name)}</b></div>` : '';

  return `<div class="wrap">
<div class="row between"><div class="stack" style="gap:2px"><h1>${esc(passTitle(p))}</h1><span class="muted small">${esc(passRef(p))}</span></div>
<div class="row" role="toolbar" aria-label="${t('የንባብ መሣሪያዎች', 'Reading tools')}">
<button class="btn" data-a="smaller" data-k="smaller" aria-label="${t('ጽሑፉን አሳንስ', 'Smaller text')}"><b style="font-size:13px">A−</b></button>
<button class="btn" data-a="larger" data-k="larger" aria-label="${t('ጽሑፉን አሳድግ', 'Larger text')}"><b style="font-size:18px">A+</b></button>
<button class="btn" data-a="split" data-k="split" aria-pressed="${S.split}">${icon('split')}${t('ጎን ለጎን', 'Split view')}</button>
<button class="btn" data-a="focus" data-k="focus" aria-pressed="${S.focus}">${icon('focus')}${t('ትኩረት', 'Focus')}</button>
</div></div>
${importCard}${picker}
<div class="cols"><article class="card stack reader">${selbar}${heads}<div style="font-size:${[16, 19, 22, 25][S.size]}px">${verses}</div></article>${S.focus ? '' : sidePanel()}</div>
</div>`;
}

function notesView() {
  const body = S.notes.length
    ? S.notes.map(noteCard).join('')
    : `<div class="card stack" style="align-items:flex-start"><p class="prose">${t('እስካሁን ማስታወሻ የለም። በጥናት ገጽ አንድ ቁጥር ይንኩና ማስታወሻ ይያዙ።', 'No notes yet. Click a verse on the Study screen and add one.')}</p><button class="btn fill" data-a="nav" data-v="study" data-k="to-study">${t('ጥናት', 'Study')}</button></div>`;
  return `<div class="wrap narrow"><h1>${t('ማስታወሻዎች', 'Notes')}</h1><p class="muted">${t('በጥናት ጊዜ የያዟቸው ማስታወሻዎች ሁሉ በአንድ ቦታ።', 'Every note you take while studying, in one place.')}</p>${body}</div>`;
}

function render() {
  if (!C) return;
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  const caret = active === 'draft' ? document.activeElement.selectionStart : null;
  opens = [];
  root.dataset.theme = S.dark ? 'dark' : 'light';
  document.documentElement.lang = S.en ? 'en' : 'am';
  document.body.style.background = S.dark ? '#27292C' : '#F5F5F6';
  const view = S.screen === 'study' ? studyView() : S.screen === 'notes' ? notesView() : browseView();
  root.innerHTML = sideMenu() + '<main>' + view + '</main>';
  if (active) {
    const el = root.querySelector('[data-k="' + active + '"]');
    if (el) { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange(caret, caret); }
  }
}

// ---------- actions ----------
function setPass(change) {
  S.pass = Object.assign({ b: S.pass.b, c: S.pass.c, f: S.pass.f, to: S.pass.to }, change);
  S.sel = null;
  save('pass');
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
  nav(v) { S.screen = v; save('screen'); },
  lang() { S.en = !S.en; save('en'); },
  theme() { S.dark = !S.dark; save('dark'); },
  browse(v) { S.browse = v; save('browse'); },
  open(v) { S.pass = opens[+v]; S.sel = null; S.screen = 'study'; save('pass', 'screen'); window.scrollTo(0, 0); },
  verse(v) { S.sel = S.sel === +v ? null : +v; },
  hl(v) { S.highlights[hlKey(S.sel)] = v; save('highlights'); },
  clearHl() { delete S.highlights[hlKey(S.sel)]; save('highlights'); },
  tab(v) { S.tab = v; },
  split() { S.split = !S.split; save('split'); },
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
  import() { fileInput.click(); return false; }
};

const changes = {
  book(v) { setPass({ b: +v, c: 1, f: 1, to: 0 }); },
  chap(v) { setPass({ c: +v, f: 1, to: 0 }); },
  from(v) { setPass({ f: +v, to: S.pass.to && S.pass.to < +v ? 0 : S.pass.to }); },
  to(v) { setPass({ to: +v, f: +v && S.pass.f > +v ? 1 : S.pass.f }); },
  primary(v) { S.primary = v; pickVersions(); save('primary', 'secondary'); },
  secondary(v) { S.secondary = v; save('secondary'); }
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
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
    const res = await fetch('data/content.json');
    if (!res.ok) throw new Error(res.status);
    C = await res.json();
  } catch (e) {
    root.innerHTML = '<main><p role="alert" style="padding:24px">The app could not load its content. Check your connection and reload the page.</p></main>';
    return;
  }
  if (!C.books[S.pass.b]) S.pass = DEFAULT_PASS;
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
