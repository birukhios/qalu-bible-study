# ቃሉ (Qalu): Amharic Bible study

A personal Bible study web app with an Amharic interface (English toggle), built for reading a passage with the early church fathers alongside it.

## What it does

- **Browse three ways:** a story timeline, the books in chronological order, or the traditional order of the 66 books.
- **Study screen:** pick any book, chapter and verse range; click a verse to highlight it or attach a note.
- **Split view:** a second version beside the first, verse by verse.
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
| World English Bible | English | Public domain | `data/web.json` |
| King James Version | English | Public domain | `data/kjv.json` |
| Amharic | Amharic | Depends on the translation | Not in this repository. Import it inside the app. |

No Amharic text is included. Most Amharic translations are copyrighted, so the app loads an Amharic Bible from a file you import (Study › Import a Bible file). The imported text is stored only in that browser on that computer and is never uploaded.

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

`tools/convert_english.py` shows how the two English files were produced from their sources.

## Study content

The fathers' readings, background notes and questions are in `data/content.json`. Only Luke 15 (the Prodigal Son) has study content so far. The summaries of Chrysostom, Ambrose and Augustine are drafts that have not been checked against the source texts.

## Where your data is kept

Highlights, notes, voice recordings and imported Bibles stay in the browser's storage on your computer. Clearing the browser's site data deletes them.

## Credits

- World English Bible and King James Version: public domain. Source files from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) and [thiagobodruk/bible](https://github.com/thiagobodruk/bible).
- The Context tab links to [BibleProject](https://bibleproject.com/); none of their content is copied into this app.
