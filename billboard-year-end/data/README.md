# Hit Atlas dataset

The Hit Atlas dataset contains **nine core relational tables** with **6,801 chart entries, 6,451 song records, and 2,838 credited artist or group records**. It combines the U.S. Billboard Year-End Hot 100 for 1959–2025 with a 2026 year-to-date estimate based on weekly Hot 100 charts through the chart dated November 28, 2026.

This page documents the core tables and the derived lyric features and keywords. The [lyric emotion tables](emotion/README.md) document the segment annotations, chart samples, and model comparison. The [public GitHub Gist] also provides a [three-row sample CSV] and a snapshot of the [annual coverage CSV].

## Coverage at a glance

| CSV | Rows | Coverage metric | Covered / total | Coverage (%) |
|---|---:|---|---:|---:|
| [chart_entries.csv][chart] | 6,801 | Entries with year, rank, and song ID | 6,801/6,801 | 100.0% |
| [songs.csv][songs] | 6,451 | Chart entries linked to a song record | 6,801/6,801 | 100.0% |
| [song_artists.csv][credits] | 7,696 | Songs with at least one linked credit | 6,451/6,451 | 100.0% |
| [artists.csv][artists] | 2,838 | Artist records with a documented origin<br>Artist records with a genre | 2,793/2,838<br>2,656/2,838 | 98.4%<br>93.6% |
| [genres.csv][genres] | 6,801 | Chart entries with a song genre | 6,801/6,801 | 100.0% |
| [lyrics.csv][lyrics] | 6,451 | Song records with usable lyrics<br>Chart entries with usable lyrics | 6,299/6,451<br>6,646/6,801 | 97.6%<br>97.7% |
| [lyric_metrics.csv][metrics] | 6,451 | Songs with estimated language and token counts | 6,299/6,451 | 97.6% |
| [audio_features.csv][audio] | 759 | Entries with audio features among completed lookups or reused matches<br>Entries with audio features across the full chart dataset | 629/759<br>629/6,801 | 82.9%<br>9.2% |
| [coverage.csv][coverage] | 68 | Chart years with a coverage summary, including the 2026 estimate | 68/68 | 100.0% |

**Audio coverage depends on the source data.** The original ReccoBeats extract targeted chart years 2021–2026. For earlier years, we ran targeted lookups, and missing recording identifiers made it harder to verify the charted version. [ReccoBeats]

## Sources and what we did

- **Chart rankings, songs, and credits.** Billboard compiled the year-end rankings. We extracted them from [annual Wikipedia transcriptions] and retained the original titles, artist credits, and page URLs on each chart row. We assigned stable song IDs across years and linked songs to their credited performers, checking artist identities against [Wikidata identities]. The 1969 chart includes two entries at rank 100.
- **2026 estimate.** We used 4,800 positions across 48 weekly charts from the [weekly Hot 100 archive]. An appearance earns `101 − weekly rank` points. We sum the points by normalized title and artist credit and take the top 100. Ties are resolved by weeks on the chart, best weekly rank, then title and credit. The [weekly input] and [score audit] make the estimate reproducible.
- **Song genres.** We used the [Perot genre data] for the historical charts, including 14 rows recovered by reviewing title and rank differences across sources. In the combined 1959–2026 dataset, this left 301 entries without genre tags. We filled them using a prior match for the same song, song articles, and music catalogs. Coverage increased from **6,500/6,801 (95.6%)** to **6,801/6,801 (100.0%)**. The CSV keeps the original labels and sources. Selected soundtrack or album tracks use the parent release's catalog label. [Song article example][song articles] · [Apple Music] · [Beatport]
- **Artist origins and genres.** We use a solo artist's birthplace or a group's formation place or documented origin. We added **101 origins** using Wikidata place relationships and documented biographies, increasing coverage from **2,692/2,838 (94.9%)** to **2,793/2,838 (98.4%)**. Artist genre is a separate field, primarily from Wikidata genre statements with a documented biography supplement. Empty fields remain unknown. [Wikidata birthplace] · [Group formation place] · [Artist genre statements] · [Supplemental sources](../supplemental/README.md)
- **Lyrics and lyric metrics.** We matched lyrics by title and credited performers and verified consistent transcripts. An additional **37 LRCLIB matches** raised usable song-level coverage from **6,262/6,451 (97.1%)** to **6,299/6,451 (97.6%)**. We remove bracketed section markers before tokenization, estimate the primary language, and retain separate statuses for 42 missing lyrics, 42 awaiting review, 44 instrumental records, and 24 compound singles. Unavailable lyrics are excluded from keyword-rate denominators. [Blakely] · [LRCLIB] · [Pavlik] · [Melo]
- **Audio.** We matched recordings against [ReccoBeats] using titles, credits, and recording identifiers where available. We reused matches for the same song when the previous results identified a single recording, and queried additional recordings. The initial 2021–2026 sample had **545/600 (90.8%)** matches. The final dataset has **553/600 (92.2%)** for those years and **76/6,201 (1.2%)** for earlier years. Ambiguous versions and unmatched recordings retain blank scores.

## Lyric features and keywords, 1959–2026

[Chart-entry lyric features](lyric_features_1959-2026.csv) contain song-level scores joined to all 6,801 chart entries. The `chart_kind` field identifies the 2026 weekly-rank estimate. Metrics are present for usable lyrics estimated to be English. TTR divides the distinct token count by the full lyric token count. VADER 3.3.2 computes the compound score on each whole transcript after collapsing whitespace so flattened and multiline sources share the same scoring unit. Bracketed markers are removed for scoring, and repeated sung lines count each time. Compare TTR alongside lyric lengths because TTR is sensitive to token count. The VADER column is retained as an exploratory result. Of the 6,558 scored entries, 80.7% have an absolute compound score of at least 0.9, so VADER is deferred for the first visualization release.

[Keyword summaries](lyric_keywords_1959-2026.csv) report up to 20 terms by frequency and 20 by TF-IDF for each genre and year, plus a pooled 1959–2025 period for published year-end charts. Songs are counted once within each group, and a song with multiple tags can contribute to each tagged genre. Frequency is the mean number of uses per 1,000 words across eligible songs, including songs with zero uses. TF-IDF treats each genre as a document within the period, divides term count by its non-stopword token count, and applies smoothed IDF. Terms need at least two distinct songs in a group to rank. The all-genres rows report frequency.

To regenerate the tables, run `python3 billboard-year-end/scripts/measure_lyrics.py --include-estimates` from the repository root with `vaderSentiment==3.3.2` available. The [2021–2025 feature pilot](lyric_features_2021-2025.csv) and [keyword pilot](lyric_keywords_2021-2025.csv) use the same rules with the shorter year range.

## Lyric matching and section analysis

The [historical build](../scripts/build.py) checks the title and artist in the source URL and screens candidate transcripts. The [historical audit](../source_review.csv) records source-match evidence. The [supplement lookup](../scripts/supplement.py), [2024–2026 extension](../extension-2024-2026/README.md), and [release merge](../scripts/merge_release.py) document or implement gap filling, source reuse and join rules. The [view build](../scripts/build_views.py) creates normalized tokens from the stored transcripts.

The historical and 2024–2026 lyric tables share the same fields after UTF-8 BOM handling. The Blakely/Genius transcripts stored in Atlas are flattened, while the newer LRCLIB transcripts generally retain line breaks. Segment analysis uses recognized section markers, blank lines, and a 300-character chunk limit. The [emotion data dictionary](emotion/README.md#preparation-and-joins) describes the position fields and the TabularisAI and Astra methods.

## Lyric emotion annotations, 1959–2026

The [emotion tables](emotion/README.md#data-tables) contain **53,950 segments for 6,301 song records**, covering **6,648 of 6,801 chart entries**. They include two supplemental lyric matches used for emotion analysis, so coverage is slightly higher than in the core lyrics table. The full-corpus annotations and the 2021–2025 top-ten summaries support [song timelines and year comparisons](emotion/README.md#visualization-uses).

## CSV data dictionary

| Public CSV | Unit and size | Relevant fields and types | Sources, coverage, and missing values |
|---|---|---|---|
| [chart_entries.csv][chart] | One song appearance per chart year. **6,801** | `entry_id`, `song_id`, title, artist credit, source URL, and chart type (text), plus `year` and `rank` (integers) | [Annual Wikipedia transcriptions] of rankings published by Billboard, plus the [weekly Hot 100 archive] for the 2026 estimate. All rows have year and rank. The 1969 snapshot has a tie at rank 100. The 2026 estimate has its own chart type. |
| [songs.csv][songs] | One project song or combined-single record. **6,451** | `song_id`, title, artist credit (text) | Derived from [chart entries][chart] by reconciling titles and credits across years. All chart rows link to a song. Unresolved recording variants and compound singles remain at their source granularity. |
| [song_artists.csv][credits] | One song–artist pair. **7,696** | `song_id`, `artist_id` (text, composite key) | Derived from [chart credits][chart] and [Wikidata identities]. Every song has a linked credit. Some group, soundtrack, and ensemble credits still need identity review. |
| [artists.csv][artists] | One credited artist or group record. **2,838** | `artist_id`, name, Wikidata ID, `origin_type`, place, `country_code`, `artist_genres`, source URLs (text) | [Wikidata birthplace], [group formation place], and [artist genre statements], supplemented by documented artist and label sources. Origin codes cover **2,793** records and artist genres cover **2,656**. Empty values remain unknown. |
| [genres.csv][genres] | One chart entry's song-genre assignment. **6,801** | `entry_id`, `song_id`, source labels, normalized labels, source URL (text) | [Perot genre data], previously annotated appearances of the same song, [song articles], [Apple Music], and [Beatport]. All entries have labels. Some catalog tags describe the parent release. Source labels and links are retained. |
| [lyrics.csv][lyrics] | One lyric match result per song record. **6,451** | `song_id`, status, source URL, match rule, lyrics (text) | [Blakely], [LRCLIB], [Pavlik], and [Melo]. **6,299** records have usable text, **42** are missing, **42** await match review, **44** are instrumental, and **24** are compound singles. Match states stay explicit. |
| [lyric_metrics.csv][metrics] | One lyric metrics row per song record. **6,451** | `song_id`, lyric status, estimated primary language (text), plus `word_tokens` (integer) | Derived from [lyrics.csv][lyrics]. A usable lyric is tokenized after removing bracketed markers. Unavailable lyrics have zero tokens and a blank language. They are excluded from keyword-rate denominators. |
| [audio_features.csv][audio] | One audio lookup or reused match per covered chart entry. **759** | `entry_id`, `song_id`, status, ReccoBeats ID, ISRC (text), plus seven 0–1 scores, tempo in BPM, loudness in dB (numbers) | [ReccoBeats]. **629** rows have features and **130** are unresolved. Unresolved rows have blank scores. Entries outside completed lookups have no feature row. |
| [coverage.csv][coverage] | One annual coverage summary. **68** | `year` (integer), chart type (text), counts of entries, lyric coverage, origins, and audio matches (integers) | Recomputed from the joined tables above. `audio_eligible` counts entries with a completed lookup or reused match. `audio_matched` counts entries with usable feature values. |

## Preparation and joins

Join song genres and audio to `chart_entries.csv` by `entry_id`, and song metadata and lyrics by `song_id`. Join artist metadata through `song_artists.csv` by `artist_id`. A song with multiple genre labels contributes a total weight of one to the genre chart. The map counts each credited artist once per selected period. The merge script checks keys and recomputes coverage.

Run `python3 billboard-year-end/scripts/merge_release.py` from the repository root to rebuild the dataset from the [historical sources](../README.md#sources-and-preparation), [extension](../extension-2024-2026/README.md), and [supplemental audit tables](../supplemental/README.md).

## Preliminary inspection

The [three-row sample CSV] joins chart ranks, genres, artist origins, lyric metrics, and audio. For example, 2023 rank 1 is **Last Night**, credited to **Morgan Wallen**, tagged **Country**, with artist origin **US**, **383 lyric tokens**, and **energy 0.673**.

## Coverage by year

**Audio matches are concentrated in 2021–2026, the years covered by our original ReccoBeats extract, with 553/600 (92.2%) of entries matched in that period and 76/6,201 (1.2%) matched after targeted checks for earlier years.**

Genre, lyric, and audio percentages use chart entries as the denominator. Origin percentages use distinct credited artists within the year. The [coverage CSV][coverage] also includes counts of processed audio lookups and primary-English lyrics.

| Chart year | Genre labeled | Usable lyrics | Known artist origin | Audio matched |
|---|---:|---:|---:|---:|
| 2026 estimate | 100/100 (100.0%) | 94/100 (94.0%) | 80/80 (100.0%) | 65/100 (65.0%) |
| 2025 | 100/100 (100.0%) | 91/100 (91.0%) | 75/77 (97.4%) | 96/100 (96.0%) |
| 2024 | 100/100 (100.0%) | 88/100 (88.0%) | 83/83 (100.0%) | 98/100 (98.0%) |
| 2023 | 100/100 (100.0%) | 100/100 (100.0%) | 88/88 (100.0%) | 99/100 (99.0%) |
| 2022 | 100/100 (100.0%) | 100/100 (100.0%) | 98/103 (95.1%) | 99/100 (99.0%) |
| 2021 | 100/100 (100.0%) | 99/100 (99.0%) | 99/99 (100.0%) | 96/100 (96.0%) |
| 2020 | 100/100 (100.0%) | 100/100 (100.0%) | 98/100 (98.0%) | 53/100 (53.0%) |
| 2019 | 100/100 (100.0%) | 99/100 (99.0%) | 93/93 (100.0%) | 11/100 (11.0%) |
| 2018 | 100/100 (100.0%) | 100/100 (100.0%) | 101/102 (99.0%) | 4/100 (4.0%) |
| 2017 | 100/100 (100.0%) | 100/100 (100.0%) | 103/104 (99.0%) | 0/100 (0.0%) |
| 2016 | 100/100 (100.0%) | 100/100 (100.0%) | 93/95 (97.9%) | 0/100 (0.0%) |
| 2015 | 100/100 (100.0%) | 100/100 (100.0%) | 99/102 (97.1%) | 0/100 (0.0%) |
| 2014 | 100/100 (100.0%) | 100/100 (100.0%) | 108/109 (99.1%) | 0/100 (0.0%) |
| 2013 | 100/100 (100.0%) | 100/100 (100.0%) | 101/101 (100.0%) | 0/100 (0.0%) |
| 2012 | 100/100 (100.0%) | 100/100 (100.0%) | 82/82 (100.0%) | 0/100 (0.0%) |
| 2011 | 100/100 (100.0%) | 100/100 (100.0%) | 99/99 (100.0%) | 1/100 (1.0%) |
| 2010 | 100/100 (100.0%) | 100/100 (100.0%) | 90/90 (100.0%) | 0/100 (0.0%) |
| 2009 | 100/100 (100.0%) | 100/100 (100.0%) | 85/85 (100.0%) | 0/100 (0.0%) |
| 2008 | 100/100 (100.0%) | 100/100 (100.0%) | 88/88 (100.0%) | 0/100 (0.0%) |
| 2007 | 100/100 (100.0%) | 100/100 (100.0%) | 91/91 (100.0%) | 0/100 (0.0%) |
| 2006 | 100/100 (100.0%) | 100/100 (100.0%) | 102/103 (99.0%) | 0/100 (0.0%) |
| 2005 | 100/100 (100.0%) | 100/100 (100.0%) | 95/96 (99.0%) | 0/100 (0.0%) |
| 2004 | 100/100 (100.0%) | 100/100 (100.0%) | 101/103 (98.1%) | 0/100 (0.0%) |
| 2003 | 100/100 (100.0%) | 100/100 (100.0%) | 104/105 (99.0%) | 0/100 (0.0%) |
| 2002 | 100/100 (100.0%) | 100/100 (100.0%) | 96/96 (100.0%) | 0/100 (0.0%) |
| 2001 | 100/100 (100.0%) | 100/100 (100.0%) | 95/96 (99.0%) | 0/100 (0.0%) |
| 2000 | 100/100 (100.0%) | 100/100 (100.0%) | 94/94 (100.0%) | 0/100 (0.0%) |
| 1999 | 100/100 (100.0%) | 98/100 (98.0%) | 95/95 (100.0%) | 0/100 (0.0%) |
| 1998 | 100/100 (100.0%) | 98/100 (98.0%) | 100/103 (97.1%) | 0/100 (0.0%) |
| 1997 | 100/100 (100.0%) | 95/100 (95.0%) | 99/102 (97.1%) | 0/100 (0.0%) |
| 1996 | 100/100 (100.0%) | 92/100 (92.0%) | 95/95 (100.0%) | 0/100 (0.0%) |
| 1995 | 100/100 (100.0%) | 97/100 (97.0%) | 84/85 (98.8%) | 0/100 (0.0%) |
| 1994 | 100/100 (100.0%) | 97/100 (97.0%) | 82/82 (100.0%) | 0/100 (0.0%) |
| 1993 | 100/100 (100.0%) | 99/100 (99.0%) | 84/84 (100.0%) | 0/100 (0.0%) |
| 1992 | 100/100 (100.0%) | 100/100 (100.0%) | 74/74 (100.0%) | 0/100 (0.0%) |
| 1991 | 100/100 (100.0%) | 99/100 (99.0%) | 80/81 (98.8%) | 0/100 (0.0%) |
| 1990 | 100/100 (100.0%) | 100/100 (100.0%) | 81/81 (100.0%) | 0/100 (0.0%) |
| 1989 | 100/100 (100.0%) | 99/100 (99.0%) | 78/78 (100.0%) | 0/100 (0.0%) |
| 1988 | 100/100 (100.0%) | 100/100 (100.0%) | 70/71 (98.6%) | 0/100 (0.0%) |
| 1987 | 100/100 (100.0%) | 99/100 (99.0%) | 82/83 (98.8%) | 0/100 (0.0%) |
| 1986 | 100/100 (100.0%) | 100/100 (100.0%) | 88/88 (100.0%) | 0/100 (0.0%) |
| 1985 | 100/100 (100.0%) | 98/100 (98.0%) | 70/71 (98.6%) | 0/100 (0.0%) |
| 1984 | 100/100 (100.0%) | 99/100 (99.0%) | 79/79 (100.0%) | 0/100 (0.0%) |
| 1983 | 100/100 (100.0%) | 100/100 (100.0%) | 82/82 (100.0%) | 1/100 (1.0%) |
| 1982 | 100/100 (100.0%) | 98/100 (98.0%) | 81/81 (100.0%) | 0/100 (0.0%) |
| 1981 | 100/100 (100.0%) | 100/100 (100.0%) | 81/81 (100.0%) | 0/100 (0.0%) |
| 1980 | 100/100 (100.0%) | 98/100 (98.0%) | 83/84 (98.8%) | 1/100 (1.0%) |
| 1979 | 100/100 (100.0%) | 97/100 (97.0%) | 86/86 (100.0%) | 0/100 (0.0%) |
| 1978 | 100/100 (100.0%) | 97/100 (97.0%) | 90/90 (100.0%) | 0/100 (0.0%) |
| 1977 | 100/100 (100.0%) | 97/100 (97.0%) | 83/83 (100.0%) | 0/100 (0.0%) |
| 1976 | 100/100 (100.0%) | 98/100 (98.0%) | 85/87 (97.7%) | 0/100 (0.0%) |
| 1975 | 100/100 (100.0%) | 98/100 (98.0%) | 83/83 (100.0%) | 1/100 (1.0%) |
| 1974 | 100/100 (100.0%) | 99/100 (99.0%) | 85/85 (100.0%) | 0/100 (0.0%) |
| 1973 | 100/100 (100.0%) | 98/100 (98.0%) | 83/84 (98.8%) | 1/100 (1.0%) |
| 1972 | 100/100 (100.0%) | 95/100 (95.0%) | 92/93 (98.9%) | 1/100 (1.0%) |
| 1971 | 100/100 (100.0%) | 93/100 (93.0%) | 87/87 (100.0%) | 0/100 (0.0%) |
| 1970 | 100/100 (100.0%) | 100/100 (100.0%) | 87/87 (100.0%) | 0/100 (0.0%) |
| 1969 | 101/101 (100.0%) | 98/101 (97.0%) | 82/82 (100.0%) | 0/101 (0.0%) |
| 1968 | 100/100 (100.0%) | 94/100 (94.0%) | 84/84 (100.0%) | 0/100 (0.0%) |
| 1967 | 100/100 (100.0%) | 100/100 (100.0%) | 81/81 (100.0%) | 0/100 (0.0%) |
| 1966 | 100/100 (100.0%) | 96/100 (96.0%) | 82/82 (100.0%) | 1/100 (1.0%) |
| 1965 | 100/100 (100.0%) | 99/100 (99.0%) | 77/77 (100.0%) | 0/100 (0.0%) |
| 1964 | 100/100 (100.0%) | 94/100 (94.0%) | 75/75 (100.0%) | 1/100 (1.0%) |
| 1963 | 100/100 (100.0%) | 89/100 (89.0%) | 86/87 (98.9%) | 0/100 (0.0%) |
| 1962 | 100/100 (100.0%) | 94/100 (94.0%) | 84/85 (98.8%) | 0/100 (0.0%) |
| 1961 | 100/100 (100.0%) | 94/100 (94.0%) | 79/79 (100.0%) | 0/100 (0.0%) |
| 1960 | 100/100 (100.0%) | 91/100 (91.0%) | 75/78 (96.2%) | 0/100 (0.0%) |
| 1959 | 100/100 (100.0%) | 88/100 (88.0%) | 75/77 (97.4%) | 0/100 (0.0%) |

## Known limitations and potential bias

The charts represent U.S. hits under Billboard’s changing rules, and the 2026 estimate uses partial-year weekly rankings. Genre labels vary by source, and missing artist origins can affect country counts. The standalone keyword demo uses the top 15 songs per year for 2014–2023. The full-corpus emotion annotations have [separate coverage and limitations](emotion/README.md#known-limitations). Our original ReccoBeats extract targeted 2021–2026, and missing recording IDs make older charted versions harder to verify. In the 2026 estimate, we matched audio for 8 of the top 10 entries and 25 of ranks 51–100, so audio comparisons may overrepresent higher-ranked songs.

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
[Annual Wikipedia transcriptions]: https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_1959
[weekly input]: ../extension-2024-2026/weekly-2026.csv
[score audit]: ../extension-2024-2026/scores-2026.csv
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
