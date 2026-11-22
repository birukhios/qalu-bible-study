# ቃሉ (Qalu): Amharic Bible study

A personal Bible study web app with an Amharic interface (English toggle), built for reading a passage with the early church fathers alongside it.

## What it does

- **Story journey:** the 135 timeline stories as a game. Read a story, answer up to five questions made from its own verses (a missing word, or which verse comes next), and earn stars, XP and a daily streak; each finished story opens the next. Progress is kept in the browser.
- **Browse four ways:** a timeline of 135 stories in nine eras (each with the thumbnail of its book's BibleProject overview video), the books in chronological order, the traditional order of the 66 books, or **Concepts**: 21 Bible themes such as God (the Trinity), the Spirit of God and the Messiah, each with its BibleProject video and a detail: a short commentary, four or five Bible references that open in the Study screen, and how the Ethiopian Orthodox Tewahedo, Catholic and Protestant churches understand it. The commentaries and perspectives are short drafts written for this app, in Amharic and English, and still need review by teachers of each tradition.
- **Two versions verse by verse:** with two versions open, each verse shows in the main version with the second version right under it (also available: two panes top and bottom, or side by side). The arrow keys turn the chapter; on phones the main screens sit in a bar at the bottom.
- **Each account keeps its own study:** highlights, notes, voice notes and Journey progress are stored per account (Google account or guest) in a small database in the browser (IndexedDB). They stay on that device; they do not sync between devices.
- **Search:** type a word or a whole question ("where does it say money is the root of evil?"). The search drops filler words, finds the verses containing the key words, and shows the closest verse first, in a Bible of the language you typed in. Words separated by commas find verses with any of them. Amharic letters that sound alike (ሀ ሐ ኀ, ሰ ሠ, አ ዐ, ጸ ፀ) are treated as the same letter. It matches words, not meaning.
- **Picks up where you left off:** the screen, passage, selected verse, side tab, last search and scroll position are remembered in the browser.
- **Study screen:** pick any book, chapter and verse range; click a verse to highlight it or attach a note.
- **Original languages (interlinear):** the Hebrew or Greek words of every verse, each with its pronunciation, a word-for-word English meaning, its dictionary form and meaning, its grammar in plain words and its Strong's number. Turn them on under every verse with the אב / αβ button, or tap a verse and open the **ዋና ቃላት** (Original) tab. Each chapter's words load only when it is opened (about 8 KB). Data from [STEPBible](https://github.com/STEPBible/STEPBible-Data) (TAHOT and TAGNT, Tyndale House Cambridge, CC BY 4.0), converted by `tools/build_interlinear.py`; the Greek follows the Nestle-Aland text. Glosses are in English only.
- **Bible story map:** an illustrated map (drag and zoom) with a small picture for each place in the story timeline; choosing a picture lists the stories set there. The land outline is built from [Natural Earth](https://www.naturalearthdata.com/) data (public domain, `tools/build_land.py`); the rivers, lakes, names and pictures are drawn over it in `app.js`, so the map works offline. A “Present-day map” button switches to map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright) through [Leaflet](https://leafletjs.com/) (BSD 2-Clause, in `vendor/leaflet/`), which needs a connection. Positions are approximate, several are traditional sites, and the country names are present-day.
- **Reading comes first, like any Bible app:** the app opens on the reader. Tap the book name at the top to choose a book (Old or New Testament), then a chapter, then a verse, from grids of buttons; tap the version name beside it to choose from the full list of versions, add a second version, or change how the two are laid out. Explore, Journey, Map and Notes support that reading: the side tabs under the text (Context, Maps, Fathers, Original words, Notes) always follow the chapter on screen.
- **Bible maps:** the 515 [Biblica Open Bible Maps](https://bibleimagelibrary.org/collections?id=2) (© Biblica, Inc., CC BY-SA 4.0, served by Bible Image Library) are linked to the chapters they show (`data/maps.json`, built by `tools/build_maps.py`). The Maps tab shows the maps for the chapter being read first, then those for the whole book; the Map screen lists them by book above the story-places map. Tap a map to see it large, zoom in, open the full PDF, or jump to its passage. The pictures need a connection.
- **Our own interactive Bible map:** every chapter's places are numbered on the app's map in the order the text names them, from [OpenBible.info's Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data) (CC BY 4.0; 1,309 places, `tools/build_geo.py` → `data/geo/`). Tapping a pin lists the verses that name it, and each verse opens in the reader. Places whose location is uncertain have a dashed ring. Nine journeys (Abraham, the Exodus, the wilderness, two of Jesus' journeys in John, Paul's three journeys and his voyage to Rome) are drawn as animated routes with arrows, traced using the Biblica maps as the reference (`tools/routes.json`). The Maps tab shows the chapter's map above the Biblica reference maps; the map viewer's Live map and Both views use the same layer; and the Map screen has a “Places in …” switch. Place names are in English.
- **Quick version switching:** under the reading tools, a row of one-tap buttons holds the versions read lately; with two versions open, ⇅ swaps them, and “More versions…” opens the full list.
- **Versions (41):** 20 modern English versions from Beblia (NIV, ESV, NLT, NKJV, NASB, CSB, NRSV, RSV, AMP, AMPC, NET, GNT, MEV, LSB, ERV, GW, NIrV, EasyEnglish, The Living Bible, HCSB), all copyrighted by their publishers and included for personal study; five Amharic Bibles from [Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format) (the 1954 Bible, which opens by default, Amharic 2000, the New Standard Translation 2005, the NASV and the Catholic version), converted by `tools/convert_beblia.py`; these are copyrighted by their publishers (Bible Society of Ethiopia, Biblica), so check their terms before sharing the app publicly. Also Amharic ULB; the Hebrew Old Testament and Greek New Testament (STEPBible, CC BY 4.0; Hebrew reads right to left); and 14 English versions: Berean Standard Bible (CC0), World English Bible, King James Version, New Heart English Bible, Updated King James Version, A Conservative Version, American Standard Version, Bible in Basic English, Young’s Literal Translation, Darby (1889), Rotherham’s Emphasised Bible (1902), Webster (1833), the Twentieth Century New Testament (1904) and the Geneva Bible (1599), all public domain. The newer ones are built by `tools/convert_more.py` from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases). Where the first version lacks a verse, the app marks it and still shows the second version.
- **Verse of the day and verse pictures:** the Bible screen shows a verse of the day; any verse (tap it, then the share button) can be turned into a square picture to send on Telegram or WhatsApp, through the phone's share sheet or as a download on a computer.
- **Two versions at once:** the second version in its own pane under the first, or side by side verse by verse.
- **Fathers, Context, Notes:** side tabs for the early fathers' readings, background, and your own notes.
- **Voice notes:** recorded with the microphone and kept in the browser.
- **Charcoal theme** with a light mode, adjustable text size, and a focus mode.
- **Installable and works offline:** in Safari use File › Add to Dock (or Share › Add to Home Screen on a phone); in Chrome use the install button in the address bar. The **Offline** screen (download icon in the menu) saves whole Bible versions, the fathers' commentary, the book backgrounds and the Hebrew and Greek words on the device, with sizes and progress; anything opened while online is also kept. Saved material is stored apart from the app files (`sw.js`), so app updates do not delete it. Lists of files per pack are in `data/offline.json` (`tools/build_offline_manifest.py`; run it again after adding data). Videos, Google sign-in and sync, BibleProject pictures and the present-day map still need a connection.
- **Mobile first:** a bottom bar for the five main screens, compact video cards, one swipeable row for map views and section shortcuts, and every screen checked at 360 px wide.

## Sign-in

The app opens on a login page with "Sign in with Google" and a "Continue without signing in" option. Sign-up and sign-in are the same step: Google creates the session the first time someone uses the button.

To switch the Google button on, create an OAuth client ID in the Google Cloud Console (APIs & Services › Credentials › Create credentials › OAuth client ID › Web application), add the site's address (for example `https://birukhios.github.io`) under Authorized JavaScript origins, and paste the client ID into `config.js`. The client ID is public by design.

### Sync between devices

With a Firebase project named in `config.js`, a Google account's notes, highlights and Journey progress follow it to every device where it signs in (voice recordings stay on the device that made them). Guests keep everything on their own device. The Google sign-in token is exchanged for a Firebase session through Firebase's REST API, and each account's data is one Firestore document that only that account can read or write (`firestore.rules`). Changes made offline sync when the connection returns; the side menu shows the sync state.

To switch it on:

1. In the [Firebase console](https://console.firebase.google.com/), choose **Add project** and pick the existing Google Cloud project that holds the sign-in client ID (so Firebase accepts its sign-in tokens). If you use a new project instead, add the client ID from `config.js` under Authentication › Sign-in method › Google › *Safelist client IDs from external projects*.
2. **Authentication** › Get started › Sign-in method › enable **Google**. Under Settings › Authorized domains, add `birukhios.github.io`.
3. **Firestore Database** › Create database (production mode, a nearby location such as `europe-west`). Under Rules, paste the contents of `firestore.rules` and publish.
4. **Project settings** › Your apps › add a **Web** app, and copy its `apiKey` and `projectId` into `config.js`: `firebase: { apiKey: '…', projectId: '…' }`.

The free Spark plan covers a personal study app comfortably. Without these settings the app works exactly as before, with everything kept on each device.

## Running it

It is a static site with no build step. Serve the folder with any web server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk will not work, because browsers block the data files from loading that way.

## Bible texts

| Version | Language | Licence | Where it lives |
|---|---|---|---|
| World English Bible | English | Public domain | `data/web/` (one file per book) |
| King James Version | English | Public domain | `data/kjv/` (one file per book) |
| American Standard Version | English | Public domain | `data/asv/` |
| Young's Literal Translation | English | Public domain | `data/ylt/` |
| Bible in Basic English | English | Public domain | `data/bbe/` |
| Amharic Unlocked Literal Bible | Amharic | CC BY-SA 4.0 | `data/amulb/` |
| Other Amharic translations | Amharic | Usually copyrighted | Not in this repository. Import them inside the app. |

The built-in Amharic text is the Amharic Unlocked Literal Bible by the Door43 World Missions Community. Original work available at https://door43.org/. It is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and the files in `data/amulb/` are shared under the same licence. Changes made: the USFM markup and footnotes were removed and the text was split into one file per book (`tools/convert_usfm.py`); the wording is unchanged.

Most other Amharic translations are copyrighted, so they are not included. You can load one from a file you import (Study › Import a Bible file). The imported text is stored only in that browser on that computer and is never uploaded.

### Import format

A JSON file with all 66 books in the traditional order. `books[book][chapter][verse]` is the verse text, each index starting at 0:

```json
{
  "id": "am-mine",
  "name": "አማርኛ",
  "language": "am",
  "books": [ [ ["ቁጥር 1", "ቁጥር 2"], ["..."] ], ["..."] ]
}
```

`tools/convert_english.py` shows how the English versions were produced from their sources.

### Converting old Amharic Bible PDFs

`tools/convert_amharic_pdf.py` builds an import file from per-book PDFs set in the pre-Unicode Visual Ge'ez (VG2) fonts, as many Amharic Bible PDFs from the early 2000s are. It needs `pdfplumber` and the `VisualGeez.txt` mapping table from [geezorg/geez-lib](https://github.com/geezorg/geez-lib) (`src/main/resources/tables/monodirectional/`):

```sh
pip install pdfplumber
python3 tools/convert_amharic_pdf.py PDF_FOLDER VisualGeez.txt my-bible.private.json
```

The result is for your own use on your own computer. Do not commit or publish a copyrighted translation; `*.private.json` is ignored by git for that reason. The conversion is not perfect: expect occasional words wrongly split or joined at line breaks, and a few verses merged into their neighbour where the PDF itself lacks a verse number.

## Study content

- **The fathers in their own words** (`data/fathers/`, one file per chapter): about 8,700 quotations from early church fathers (authors up to AD 750), shown for the verse or passage you are reading. They are in English. Most come from the Catena Aurea, so the four Gospels are covered verse by verse and the rest of the Bible only thinly. Built by `tools/build_fathers.py` from the [HistoricalChristianFaith Commentaries-Database](https://github.com/HistoricalChristianFaith/Commentaries-Database), keeping only entries whose translation is clearly public domain.
- **Book and chapter notes** (`data/context/`, one file per book): an introduction to each of the 66 books and notes on 1,130 chapters, shown in the Context tab in English. Selected from the [unfoldingWord Translation Notes](https://git.door43.org/unfoldingWord/en_tn), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the original work by unfoldingWord is available from [unfoldingword.org/utn](https://www.unfoldingword.org/utn). Changes made: only the book and chapter introductions are used, sections written for translators are left out, and links are turned into plain text (`tools/build_context.py`). These files are shared under the same licence.
- **Book summaries** (`data/content.json`): a short note on each of the 66 books, shown in the Context tab. These are brief drafts that follow traditional views on authors and dates.
- **Summaries, passage background and questions** (`data/content.json`): written for Luke 15 (the Prodigal Son) only so far. The summaries of Chrysostom, Ambrose and Augustine are drafts that have not been checked against the source texts.

## Where your data is kept

Highlights, notes, voice recordings and imported Bibles stay in the browser's storage on your computer. Clearing the browser's site data deletes them.

## Credits

- The five English versions are public domain. Source files from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) and [thiagobodruk/bible](https://github.com/thiagobodruk/bible).
- The Study screen, the story timeline, the story lessons and the Concepts section show cards for [BibleProject](https://bibleproject.com/)'s videos. The cards link to their pages and load the thumbnails from their server; none of their content is stored in this app. Each theme thumbnail's address was taken from that video's page on bibleproject.com; a card whose picture does not load shows a plain play mark with the video's title.
