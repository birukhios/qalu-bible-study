# ቃሉ (Qalu): Amharic Bible study

A personal Bible study web app with an Amharic interface (English toggle), built for reading a passage with the early church fathers alongside it.

## What it does

- **Story journey:** the 135 timeline stories as a game. Read a story, answer up to five questions made from its own verses (a missing word, or which verse comes next), and earn stars, XP and a daily streak; each finished story opens the next. Progress is kept in the browser.
- **Browse four ways:** a timeline of 135 stories in nine eras (each with the thumbnail of its book's BibleProject overview video), the books in chronological order, the traditional order of the 66 books, or **Concepts**: 21 Bible themes such as God (the Trinity), the Spirit of God and the Messiah, each with its BibleProject video and a key passage to read.
- **Study screen:** pick any book, chapter and verse range; click a verse to highlight it or attach a note.
- **Bible story map:** an illustrated map (drag and zoom) with a small picture for each place in the story timeline; choosing a picture lists the stories set there. The land outline is built from [Natural Earth](https://www.naturalearthdata.com/) data (public domain, `tools/build_land.py`); the rivers, lakes, names and pictures are drawn over it in `app.js`, so the map works offline. A “Present-day map” button switches to map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright) through [Leaflet](https://leafletjs.com/) (BSD 2-Clause, in `vendor/leaflet/`), which needs a connection. Positions are approximate, several are traditional sites, and the country names are present-day.
- **Two versions at once:** the second version in its own pane under the first, or side by side verse by verse.
- **Fathers, Context, Notes:** side tabs for the early fathers' readings, background, and your own notes.
- **Voice notes:** recorded with the microphone and kept in the browser.
- **Charcoal theme** with a light mode, adjustable text size, and a focus mode.
- **Installable and offline:** in Safari use File › Add to Dock; in Chrome use the install button in the address bar.

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
- The Study screen, the story timeline, the story lessons and the Concepts section show cards for [BibleProject](https://bibleproject.com/)'s videos. The cards link to their pages and load the thumbnails from their server; none of their content is stored in this app. The addresses of the theme thumbnails follow the pattern of the book overviews and have not been checked one by one; a card whose picture does not load shows a plain play mark with the video's title.
