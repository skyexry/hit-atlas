# Billboard chart extension, 2024–2026

The extension adds 300 entries and links them to 273 distinct song records, 255 of which are new to Hit Atlas. The 2024 and 2025 rows transcribe the published US Billboard Year-End Hot 100. The 2026 rows are a project estimate from the calendar year's published weekly ranks, through the chart dated **November 28, 2026**. [2024 year-end source](https://www.billboard.com/charts/year-end/2024/hot-100-songs/) · [2025 year-end source](https://www.billboard.com/charts/year-end/2025/hot-100-songs/) · [2024 transcription](https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2024) · [2025 transcription](https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2025) · [Weekly chart archive](https://github.com/mhollingshead/billboard-hot-100)

## 2026 ranking

The input contains 48 consecutive weekly charts, dated January 3 through November 28, and 4,800 weekly entries. A song earns **101 minus its weekly rank** whenever it appears. Songs are grouped by normalized title and full artist credit. Ties in total points are broken by more chart weeks, then best weekly rank, then normalized title and credit. The estimate weights chart positions and can differ from Billboard's published year-end method and eligibility window. [Weekly snapshot](weekly-2026.csv) · [Top 100 scores and tie-break fields](scores-2026.csv)

## Coverage

| Chart | Usable lyrics | ReccoBeats audio | Artists with known origins |
|---|---:|---:|---:|
| 2024 year-end | 88 / 100 | 97 / 100 | 83 / 83 |
| 2025 year-end | 91 / 100 | 96 / 100 | 75 / 77 |
| 2026 estimate | 93 / 100 | 58 / 100 | 80 / 80 |

The three charts add 82 artist records, 80 with confirmed origins. Among the 255 new song records, 227 have usable lyrics, 18 have missing text, and 10 require match review. Counts across years include songs and artists that charted in more than one year.

## Public CSV downloads

[Chart entries](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/chart_entries.csv) · [2026 weekly ranks](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/weekly-2026.csv) · [2026 estimated ranks](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/scores-2026.csv) · [Artist origins](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/artists.csv) · [Lyrics metrics](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/lyric_metrics.csv) · [Audio features](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/reccobeats-2024-2026.csv) · [Coverage](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/extension-2024-2026/coverage.csv)

## Files and joins

| File | Contents |
|---|---|
| [chart_entries.csv](chart_entries.csv) | 100 ranked entries per year. `entry_id` identifies a chart row and `song_id` links to the historical or added song record. |
| [songs.csv](songs.csv) | New song records. Previously identified songs keep their IDs in the historical [songs table](../songs.csv). |
| [lyrics.csv](lyrics.csv) and [lyric_metrics.csv](lyric_metrics.csv) | Lyrics, source URLs, match status, and primary-language and word-count estimates in the historical format. Existing usable versions are reused by song ID. For overlapping IDs use the extension row when available. New text matches require a title and credit match with a consistent lyric transcript. [LRCLIB](https://lrclib.net/) |
| [artists.csv](artists.csv) and [song_artists.csv](song_artists.csv) | New artist records and song-to-artist links for new songs. Join against these tables and their historical counterparts. Origin fields describe birthplaces for people and formation locations or documented origins for groups. Each confirmed origin has a source link. [Wikidata birthplace](https://www.wikidata.org/wiki/Property:P19) · [Wikidata formation place](https://www.wikidata.org/wiki/Property:P740) |
| [reccobeats-2024-2026.csv](reccobeats-2024-2026.csv) | Same columns and units as the 2021–2023 pilot. One row per chart entry, joined by year and rank. Includes matched recording metadata, source URLs, and nine numeric features when available. Where useful, Spotify catalog IDs from public playlist metadata were checked against ReccoBeats title, artist credits, and recording identifiers. `unresolved` includes search misses and unconfirmed variants. [ReccoBeats track lookup](https://reccobeats.com/docs/apis/get-tracks) · [Audio features](https://reccobeats.com/docs/apis/get-audio-features) |
| [coverage.csv](coverage.csv) | Annual chart type, lyrics and audio coverage by entry, and origin coverage by distinct credited artist. |

The extension follows the historical table formats. Its separate chart type keeps the 2026 estimate distinct from published year-end charts. Artist and song names retain source spelling where possible. Genre labels for newly added songs are pending.

Run `python3 verify.py` from this directory to validate the annual ranks, reproduce the 2026 estimate, check table joins, and recount coverage.
