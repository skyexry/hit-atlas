# US Billboard Year-End Hot 100, 1959–2023

[Historical explorer](explorer.html) · [Annual coverage](coverage.csv) · [Chart entries](chart_entries.csv)

The dataset contains **6,501 entries across 65 year-end charts**. The 1969 chart contains 101 entries because Paul Revere & the Raiders' “Let Me” and The Box Tops' “Sweet Cream Ladies” share rank 100. All other years contain 100 entries.

| Measure | Coverage |
|---|---:|
| Distinct song or combined-single records | 6,196 |
| Credited artists or groups | 2,756 |
| Entries with usable lyrics | 6,337 / 6,501 |
| Entries with genre tags | 6,486 / 6,501 |
| Artists with a known country or territory of origin | 2,612 / 2,756 |
| Entries with usable, predominantly English lyrics | 6,261 / 6,501 |

## Sources and preparation

- **Chart entries.** Public transcriptions of the US Billboard Year-End Hot 100 supply chart year, rank, title, and performer credits. For joins to the lyrics and genre sources, year-end rank is the first checkpoint. Differences in rank require a unique title and artist match. [Example year-end transcription](https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_1969)
- **Lyrics.** The Blakely collection supplies most versions. Other Billboard lyrics collections and LRCLIB fill gaps. Matching uses titles, credits, and source references where available. Among 6,196 song records, 6,035 have usable text, 44 are instrumental, 55 need match review, 38 lack lyrics, and 24 combine tracks without a single representative lyric. Automated checks exclude empty text, likely commentary, and unusually long transcriptions. Transcriptions can differ in punctuation and repeated choruses. [Blakely](https://www.kaggle.com/datasets/brianblakely/top-100-songs-and-lyrics-from-1959-to-2019) · [tmelo-uea](https://github.com/tmelo-uea/billboard-hot100-lyrics) · [Kaylin Pavlik](https://github.com/walkerkq/musiclyrics) · [LRCLIB](https://lrclib.net/)
- **Genres.** The Perot dataset supplies entry-level genre labels. The original labels are retained alongside standardized display labels. For genre shares, each entry contributes a total weight of one, split evenly across its tags. Untagged entries form an explicit category, and annual denominators include them. [Harvard Dataverse](https://doi.org/10.7910/DVN/KRQMKU)
- **Artist origins.** Artist identities come from chart credits and are reconciled with Wikidata aliases and redirects. Origin is the birth location for an individual and the formation place or documented origin for a group. The 2,612 known origins consist of 1,628 birthplaces, 806 formation places, and 178 documented origins. Map counts describe credited performers and their geographic origins. [Wikidata birthplace](https://www.wikidata.org/wiki/Property:P19) · [Wikidata formation place](https://www.wikidata.org/wiki/Property:P740) · [Natural Earth map](https://github.com/nvkelso/natural-earth-vector)
- **Audio.** ReccoBeats queries start from Billboard chart entries and match title, artist, and recording version. Feature coverage is **96/100 in 2021, 99/100 in 2022, and 99/100 in 2023**. Tempo uses BPM, loudness uses dB, and the radar features use their original 0–1 scales. Missing audio values are blank. Genre medians include each entry once per applicable genre. Small genre groups can produce unstable medians or correlations. [ReccoBeats track search](https://reccobeats.com/docs/apis/search-tracks) · [2021–2023 audio table](demos/sound-demo/reccobeats-2021-2023.csv) · [2023 audio table](demos/sound-demo/reccobeats-2023.csv)

## Data tables

| File | Rows and join keys |
|---|---|
| [chart_entries.csv](chart_entries.csv) | One row per year-end entry. Unique text key `entry_id`, integer year and rank, source title, artist credit, and chart link. Join to songs with `song_id`. |
| [songs.csv](songs.csv) and [song_links.csv](song_links.csv) | Distinct song or combined-single records and their source links. `song_id` groups chart records by title and artist identity. Recording-level identifiers are available for the audio pilot. |
| [artists.csv](artists.csv) and [song_artists.csv](song_artists.csv) | Artist identities and the many-to-many song–artist relationship. Origin fields include place, origin type, country code, and a source link. |
| [genres.csv](genres.csv) | Original and standardized genres per `entry_id`. Multiple standardized tags are pipe-delimited. |
| [lyrics.csv](lyrics.csv) and [lyric_metrics.csv](lyric_metrics.csv) | Text, sources, match status, estimated primary language, and word counts keyed by `song_id`. |
| [coverage.csv](coverage.csv) | Annual counts for chart entries, lyrics, genres, artists, and known origins. Across-year artist counts require deduplication. |
| [source_review.csv](source_review.csv) | Match discrepancies and source links for follow-up review. |
| [reccobeats-2021-2023.csv](demos/sound-demo/reccobeats-2021-2023.csv) | 300 chart entries joined by year and rank. Includes match status, ReccoBeats ID, ISRC, links, and numeric recording features. |

## Visualization views

Download or clone the repository and open the HTML files in a browser.

| Task | View | Sample and interaction |
|---|---|---|
| 1 · Genres and artist origins | [1. Genres Over Time](explorer.html) | Stacked area chart for 1959–2023 and a pie chart for the selected year. Select a genre to explore its songs or jump to the lyrics view. |
| 1 · Genres and artist origins | [2. Where Artists Came From](demos/artist-origin-sketch/map-to-artists.html) | Select years and regions, then drill into the artist treemap and ranked songs. [Map preview](demos/artist-origin-sketch/map-to-artists.png) |
| 2 · Lyrics | [1. Keyword Trends](demos/lyric-words-demo/index.html#trend) | Enter multiple words and compare their annual frequencies. [Trend preview](demos/lyric-words-demo/preview.png) |
| 2 · Lyrics | [2. Explore Keywords by Genre](demos/lyric-words-demo/index.html#genre) | Filter by genre and date range to explore common and distinctive words. |
| 2 · Lyrics | [3. Discover Words by Year](demos/lyric-words-demo/index.html#bubble) | Play or scrub through annual word bubbles. [Axis layout](demos/lyric-words-demo/bubble-axis.png) · [Packed layout](demos/lyric-words-demo/bubble-packed.png) |
| 3 · Audio features | [1. Compare Sound Profiles](demos/sound-demo/2023.html) | Overlay multiple genres on a radar chart of 2023 median features. |
| 3 · Audio features | [2. Explore Features Over Time](demos/sound-demo/2023.html#trendPanel) | Select a radar axis to open a 2021–2023 trend with sample counts by genre and year. |
| 3 · Audio features | [3. Explore Feature Correlations](demos/sound-demo/2023.html#corrTitle) | Compare two features across the 2023 sample or within a genre. Supports scatterplots and [Hexbin](demos/sound-demo/2023.html#hexbin). [Hexbin preview](demos/sound-demo/hexbin-2023.png) |

The dedicated lyrics demo uses 149 usable English-lyrics entries out of 150 selected from the top 15 of each year from 2014 to 2023. The historical explorer also includes an artist-origin comparison and keyword search across 1959–2023. Its keyword index skips bracketed section markers and matches whole words. Five-year smoothing uses the current year and up to four preceding years. The selected-year details show the annual values.

The historical origin comparison includes 10 origins in 1959–1963 (260 of 293 artists located), 24 in 2012–2016 (294 of 302), and 21 in 2019–2023 (276 of 290). Compare these counts alongside coverage and sample size.

## Verification and rebuild

Run `python3 scripts/verify.py` from this directory to verify rank ties, table joins, annual coverage, and the historical explorer's index. The rebuild uses Python 3, requests, Beautiful Soup, lxml, xlrd, Babel, langid, and NumPy. Live sources may change between rebuilds. The following commands use a temporary source cache.

```sh
python3 scripts/fetch_sources.py /tmp/hit-atlas-bb65-sources
python3 scripts/artist_places.py /tmp/hit-atlas-bb65-sources
python3 scripts/build.py /tmp/hit-atlas-bb65-sources
python3 scripts/supplement.py /tmp/hit-atlas-bb65-sources
python3 scripts/build.py /tmp/hit-atlas-bb65-sources
python3 scripts/build_views.py /tmp/hit-atlas-bb65-sources
python3 scripts/verify.py
```
