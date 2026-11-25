# HitAtlas dataset

The HitAtlas dataset contains **nine relational tables stored as CSV files**. The data contain **6,801 chart entries, 6,451 song records, and 2,838 credited artist or group records**. They cover the U.S. Billboard Year-End Hot 100 for 1959–2025 and a separate 2026 year-to-date estimate based on weekly Hot 100 charts through the chart dated November 28, 2026.

The full CSVs are publicly downloadable in the table below. A [public GitHub Gist] provides the [three-row sample CSV] and [annual coverage CSV] as raw text for quick inspection and D3 testing. The Gist is a sample and coverage snapshot of the unified release.

## CSV data dictionary

| Public CSV | Unit and size | Relevant fields and types | Sources, coverage, and missing values |
|---|---|---|---|
| [chart_entries.csv][chart] | One song appearance per chart year. **6,801** | `entry_id`, `song_id`, title, artist credit, source URL, and chart type (text); `year`, `rank` (integers) | [Historical transcriptions], [Billboard 2024], [Billboard 2025], and [weekly Hot 100 archive]. All rows have year and rank. The 1969 snapshot has a tie at rank 100. The 2026 estimate has its own chart type. |
| [songs.csv][songs] | One project song or combined-single record. **6,451** | `song_id`, title, artist credit (text) | Derived from [chart entries][chart] by reconciling titles and credits across years. All chart rows link to a song. Unresolved recording variants and compound singles remain at their source granularity. |
| [song_artists.csv][credits] | One song–artist pair. **7,696** | `song_id`, `artist_id` (text, composite key) | Derived from [chart credits][chart] and [Wikidata identities]. Every song has a linked credit. Some group, soundtrack, and ensemble credits still need identity review. |
| [artists.csv][artists] | One credited artist or group record. **2,838** | `artist_id`, name, Wikidata ID, `origin_type`, place, `country_code`, `artist_genres`, source URLs (text) | [Wikidata birthplace], [group formation place], and [artist genre statements], supplemented by documented artist and label sources. Origin codes cover **2,793** records and artist genres cover **2,656**. Empty values remain unknown. |
| [genres.csv][genres] | One chart entry's song-genre assignment. **6,801** | `entry_id`, `song_id`, source labels, normalized labels, source URL (text) | [Perot genre data], previously annotated appearances of the same song, [song articles], [Apple Music], and [Beatport]. All entries have labels. Some catalog tags describe the parent release. Source labels and links are retained. |
| [lyrics.csv][lyrics] | One lyric match result per song record. **6,451** | `song_id`, status, source URL, match rule, lyrics (text) | [Blakely], [LRCLIB], [Pavlik], and [Melo]. **6,299** records have usable text, **42** are missing, **42** await match review, **44** are instrumental, and **24** are compound singles. Match states stay explicit. |
| [lyric_metrics.csv][metrics] | One lyric metrics row per song record. **6,451** | `song_id`, lyric status, estimated primary language (text); `word_tokens` (integer) | Derived from [lyrics.csv][lyrics]. A usable lyric is tokenized after removing bracketed markers. Unavailable lyrics have zero tokens and a blank language. They are excluded from keyword-rate denominators. |
| [audio_features.csv][audio] | One audio lookup or reused match per covered chart entry. **759** | `entry_id`, `song_id`, status, ReccoBeats ID, ISRC (text); seven 0–1 scores, tempo in BPM, loudness in dB (numbers) | [ReccoBeats]. **629** rows have features and **130** are unresolved. Unresolved rows have blank scores. Entries outside completed lookups have no feature row. |
| [coverage.csv][coverage] | One annual coverage summary. **68** | `year` (integer), chart type (text), counts of entries, lyric coverage, origins, and audio matches (integers) | Recomputed from the joined tables above. `audio_eligible` counts entries with a completed lookup or reused match. `audio_matched` counts entries with usable feature values. |

## Preparation and joins

Start with `chart_entries.csv`. Join song genres and audio by `entry_id`. Join songs and lyrics by `song_id`. For artist details, follow `song_id` through `song_artists.csv` to `artists.csv` by `artist_id`. Year and rank identify chart positions for most years. Use `entry_id` as the primary join key, including the 1969 tie.

We standardize titles and credits for matching, retain original source labels and URLs, and check recording versions before adding audio. Multi-tag song genres split a chart entry's weight across its tags. The map counts each credited artist once in the selected period and reports unknown origins separately. Rebuild with `python3 billboard-year-end/scripts/merge_release.py` from the repository root. The [supplemental audit tables](../supplemental/README.md) preserve later additions and lookup outcomes.

## Preliminary inspection

The Gist sample demonstrates a real join across chart ranks, genres, artist origins, lyric metrics, and audio. For example, 2023 rank 1 is **Last Night**, credited to **Morgan Wallen**, tagged **Country**, with artist origin **US**, **383 lyric tokens**, and **energy 0.673**. The annual totals below come from the [coverage CSV][coverage].

| Chart | Tagged genres | Usable lyrics | Audio matches |
|---|---:|---:|---:|
| 2023 | 100/100 | 100/100 | 99/100 |
| 2024 | 100/100 | 88/100 | 98/100 |
| 2025 | 100/100 | 91/100 | 96/100 |
| 2026 estimate | 100/100 | 94/100 | 65/100 |

## Known limitations and potential bias

- **Chart selection.** The sample represents charting U.S. hits. It reflects Billboard's metrics and eligibility rules, which vary over time. The 2026 estimate uses weekly rank points and a partial-year window.
- **Genre and origin.** Source genre taxonomies and release-level labels can shift genre shares. Origin records use solo performers' birthplaces and groups' formation places or documented origins. Location coverage and imperfect credits can affect the number of origins represented.
- **Lyrics.** Transcription quality and missing matches vary. English-dominant analyses and the top-15 lyric demo underrepresent multilingual and lower-ranked songs.
- **Audio.** Early charts lack stable recording identifiers, and matching can confuse original releases with later versions. Only 76 of 6,201 pre-2021 entries have matched features. In the 2026 estimate, 8 of the top 10 matched, versus 25 of ranks 51–100. Audio summaries may overrepresent high-ranking recent songs.

[Historical source notes](../README.md#sources-and-preparation) and the [2024–2026 source audit](../extension-2024-2026/README.md) document the inputs. The interactive site uses [D3 7.9.0] and [Natural Earth boundaries].

[chart]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/chart_entries.csv
[songs]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/songs.csv
[artists]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/artists.csv
[credits]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/song_artists.csv
[genres]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/genres.csv
[lyrics]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/lyrics.csv
[metrics]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/lyric_metrics.csv
[audio]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/audio_features.csv
[coverage]: https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/coverage.csv
[Historical transcriptions]: https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_1959
[Billboard 2024]: https://www.billboard.com/charts/year-end/2024/hot-100-songs/
[Billboard 2025]: https://www.billboard.com/charts/year-end/2025/hot-100-songs/
[weekly Hot 100 archive]: https://github.com/mhollingshead/billboard-hot-100
[Wikidata identities]: https://www.wikidata.org/
[Wikidata birthplace]: https://www.wikidata.org/wiki/Property:P19
[group formation place]: https://www.wikidata.org/wiki/Property:P740
[artist genre statements]: https://www.wikidata.org/wiki/Property:P136
[Perot genre data]: https://doi.org/10.7910/DVN/KRQMKU
[song articles]: https://en.wikipedia.org/wiki/Pop_That_Thang
[Apple Music]: https://music.apple.com/
[Beatport]: https://www.beatport.com/
[Blakely]: https://www.kaggle.com/datasets/brianblakely/top-100-songs-and-lyrics-from-1959-to-2019
[LRCLIB]: https://lrclib.net/
[Pavlik]: https://github.com/walkerkq/musiclyrics
[Melo]: https://github.com/tmelo-uea/billboard-hot100-lyrics
[ReccoBeats]: https://reccobeats.com/docs/apis/get-audio-features
[D3 7.9.0]: https://github.com/d3/d3/releases/tag/v7.9.0
[Natural Earth boundaries]: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/
[public GitHub Gist]: https://gist.github.com/skyexry/d204b9539099b237dc5424325f32b58c
[three-row sample CSV]: https://gist.githubusercontent.com/skyexry/d204b9539099b237dc5424325f32b58c/raw/3a41dfd1c8a05f3d82985278b9edc37854a7ed2f/billboard-sample.csv
[annual coverage CSV]: https://gist.githubusercontent.com/skyexry/d204b9539099b237dc5424325f32b58c/raw/7bedde701b35c8d04141e89f10ce59d40899d221/billboard-coverage.csv
