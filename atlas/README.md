# Where Did Our Love Go? · Hit Atlas story page

A record-sleeve redesign of Hit Atlas built around one finding in the lyric emotion data. Love was the leading feeling on every Year-End chart from 1959 through 2002 (44 charts). Joy led from 2003 through 2017 (15 charts) and peaked at 47.4% in 2011. Since 2018 the lead has never been larger than 3.7 points.

This review build contains the opening and all four tracks:

- **Opening.** A single record with 68 grooves, one per chart year, running from 1959 at the edge to the 2026 estimate at the label. A tonearm moves through a short scroll story with featured songs.
- **Track 01.** Linked views around a selected year:
  - feeling lines with a leader ribbon and a coverage strip;
  - a crate of that year's 100 records, where each groove follows one song's lyric segments from the edge to the label;
  - a tall bar of the year's feelings;
  - the genre pie, with percentages, in the same colors as the genre small multiples;
  - a song dialog with a lyric strip, verified Spotify artwork and play links, and the matched recording's audio features.
- **Track 02.** *Love is still the word. It's just said less.* "Love" was the most-used word on 59 of the 67 published charts, setting aside common function words. Its rate fell from 13.4 uses per 1,000 words (1959–1999) to 5.1 (2020–2025).
  - Word bubbles for the selected year sit at their exact "songs using the word" value on a doubling axis, and collisions push them only up or down. Size is uses per 1,000 words on one scale for every year. A play button steps through the years.
  - Three aligned trend panels show any word's uses per 1,000 words, the share of songs using it, and median song length for context.
  - Search covers the full cleaned index, which loads when the chapter comes near. The song list behind a word and year opens the shared dialog.
  - One racial slur that appears in the annual top words is masked on screen and counted in the data.
- **Track 03.** *How American is the American chart?* Three of every four credited artists since 1959 have a U.S. origin, and Britain supplied half of the rest.
  - A brushable strip shows each year's share of artists from outside the U.S., with the British part marked. Era presets cover the British Invasion, the 1983 peak (51%), "Made in the USA" (1998–2011, under 20% every year), and now.
  - The map draws one vinyl record per origin, sized by distinct artists and nudged apart so none overlap. Origins too small for the basemap (Barbados, the Isle of Man, Singapore, St. Vincent) sit at their coordinates.
  - A treemap shows the selected origin's artists, sized by chart appearances and colored by main chart genre.
  - The artist panel lists the artist's songs as records. Each opens the shared song dialog, which can jump to that year's crate in Track 01.
- **Track 04.** *Do sad songs sound sad?* Of the 155 sampled hits from 2021 through the 2026 estimate with at least half their lyric text labeled sad or angry by Astra, 41% score above 0.5 on ReccoBeats valence. The strongest correlation tested is between joy and danceability (r = 0.26).
  - Stat tiles and a beeswarm of 461 songs, with one row per main lyric feeling or per genre. Each dot sits at its exact value for the chosen feature (valence, energy, danceability, acousticness, tempo, or loudness), and medians are marked.
  - Two lists of the sharpest exceptions ("Sad words, bright sound" and "Bright words, dark sound") have verified Spotify play links.
  - The chapter starts in 2021 because audio is matched for 553 of the 600 entries from then on, and for only a few dozen earlier ones.

## Run locally

```sh
python3 -m http.server
```

Run this from the repository root, then open <http://localhost:8000/atlas/>. The page loads D3 from `billboard-year-end/site/d3.min.js` and the basemap from `billboard-year-end/site/world.geojson`. It works on GitHub Pages without a build step.

## Rebuild the data

```sh
python3 billboard-year-end/scripts/build_atlas_data.py
```

This writes `atlas/data/atlas.json` (1.8 MB, about 0.6 MB gzipped) from the published CSVs.

The script re-derives every song and annual share from the 53,950 segments and stops if any value differs from `song_emotion_summary.csv`, `annual_emotion_summary.csv`, or `analysis_coverage.csv`. It also reconciles each year's distinct artists and known origins with `coverage.csv`, each year's English-lyric count with `lyric_year_words.csv`, and each year's matched-audio count with `analysis_coverage.csv`.

Three artist records that are fragments of parsed credits ("the", "cast", ":") are left out of the origin views. All story numbers on the page are computed from this file in the browser rather than typed into the HTML.

Track 02 reads the cleaned exports from commit `ceb32a5`. The annual word rows and lyric lengths go into `atlas.json`, and the page fetches `billboard-year-end/data/lyric_term_index.json` (5.3 MB, gzip on GitHub Pages) for search and word traces. The in-browser calculation was spot-checked against `lyric_year_words.csv`, including the full annual series for “love.”

## Files

| File | Role |
| --- | --- |
| `index.html`, `atlas.css` | Page structure and the paper, vinyl, and ink identity (Fraunces and Archivo) |
| `js/core.js` | Feeling and genre palettes (CVD-validated), data decoding, tooltip |
| `js/record.js` | Spiral song records and the 68-groove chart record with tonearm |
| `js/opening.js` | Story facts and scroll steps |
| `js/heart.js` | Track 01 views and the shared song dialog |
| `js/words.js` | Track 02 word bubbles, trend panels, search, and song list |
| `js/origins.js` | Track 03 strip, origin map, treemap, and artist panel |
| `js/sound.js` | Track 04 stat tiles, beeswarm, exception lists, and table |
| `js/listen.js` | Spotify links: verified match, otherwise a labeled search |
