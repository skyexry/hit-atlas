# Hit Atlas unified Billboard dataset

The release contains 6,801 chart entries, 6,451 song records, and 2,838 credited artists or groups. Read the tables in this directory to analyze the complete release. The source snapshots remain available in the [historical directory](../README.md) and the [extension directory](../extension-2024-2026/README.md), which includes the weekly inputs and score audit for 2026.

| File | Key and coverage |
|---|---|
| [chart_entries.csv](chart_entries.csv) | `entry_id`, 1959–2026. The `chart_kind` field distinguishes published Billboard year-end ranks from the 2026 estimate based on weekly rank points. |
| [songs.csv](songs.csv), [lyrics.csv](lyrics.csv), [lyric_metrics.csv](lyric_metrics.csv) | `song_id`. Separate songs, lyric text and match status, and language and word-count fields. |
| [artists.csv](artists.csv), [song_artists.csv](song_artists.csv) | Artist metadata and the many-to-many links between songs and artists. Artist genres have their own label and source fields. |
| [genres.csv](genres.csv) | `entry_id`. Original labels and additional song-level labels with their sources. |
| [audio_features.csv](audio_features.csv) | `entry_id` and `song_id`. Rows include the 2021–2026 pilot and earlier entries with a completed match check or a reusable match for the same song. |
| [coverage.csv](coverage.csv) | Year-level counts. `audio_eligible` counts entries with a match or a completed lookup. `audio_matched` counts entries with feature values. |

The [supplemental sources](../supplemental/README.md) include genre labels, recording checks, verified lyric matches, and artist-origin additions. Earlier Billboard chart records supply song titles and artist credits. Matching to audio features requires resolving the recording, which can be ambiguous when several versions share those fields.

Rebuild with `python3 ../scripts/merge_release.py`. The script verifies chart sizes and keys, checks linked records, and recalculates annual coverage.

## Downloads and preliminary inspection

Download [chart entries], [songs], [artist metadata], [song–artist links], [song genres], [lyrics], [lyric metrics], [audio features], and [annual coverage] as CSV. The [historical source notes](../README.md#sources-and-preparation) and [2024–2026 chart extension](../extension-2024-2026/README.md) document upstream sources and availability.

Year and rank are integers. IDs, titles, credits, genre labels, origin codes, sources, and lyric text are strings. Word-token counts are integers. Audio fields are numeric, with tempo in BPM and loudness in dB. The chart table uses one row per year-end appearance. The 2026 estimate uses weekly Hot 100 ranks through the chart dated November 28, 2026.

| Chart | Entries | Genre tagged | Usable lyrics | Audio matched |
|---|---:|---:|---:|---:|
| 2023 | 100 | 100 | 100 | 99 |
| 2024 | 100 | 100 | 88 | 98 |
| 2025 | 100 | 100 | 91 | 96 |
| 2026 estimate | 100 | 100 | 94 | 65 |

Preprocessing reconciles titles and credits, joins by entry, song, and artist IDs, and calculates lyric token counts. A selected period on the map counts each artist once. Unknown origins affect the map denominator, and some source credits require identity review. Genre tags combine different source taxonomies. The keyword demo uses an English-dominant top-15 sample. Earlier chart records lack recording IDs such as ISRCs, and uneven audio coverage limits comparisons across eras.

The public charts use [D3 7.9.0](https://github.com/d3/d3/releases/tag/v7.9.0). The geographic boundaries come from [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/).

[chart entries]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/chart_entries.csv
[songs]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/songs.csv
[artist metadata]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/artists.csv
[song–artist links]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/song_artists.csv
[song genres]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/genres.csv
[lyrics]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/lyrics.csv
[lyric metrics]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/lyric_metrics.csv
[audio features]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/audio_features.csv
[annual coverage]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/coverage.csv
