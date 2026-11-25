# Archived Spotify Field Sources

For the current U.S. Billboard schema, see the [chart and data tables](../billboard-year-end/README.md#data-tables).

![Spotify entity-relationship diagram](hit-atlas-erd.png)

The diagram shows the current song-level joins. A chart position joins to a song via `song_id`. The song can link to one default lyric version and one archived audio record. Multiple songs can share a lyric version. Lyric scores will join by `lyrics_version_id` and word evidence by `line_id`.

## Data sources

- **Chart data.** Earlier global charts use Wrapped playlists, announcements, archived snapshots and published playlist exports. The 2026 global estimate uses weekly Top 200 chart observations. Regional estimates use the daily archive for January 1 through November 12 of each year. [Source register](../spotify-base-dataset/chart-sources.csv) · [Weekly archive](https://zenodo.org/records/23644526) · [Regional daily charts](https://www.kaggle.com/datasets/gonzalopezgil/spotify-charts-daily-updated/versions/173)
- **Recording metadata.** Read the individual `metadata_source` or chart-side provenance for each match. Sources include Spotify track and playlist metadata, Deezer, MGD+, cached Spotify exports and corroborating reports for some historical credits.
- **Lyrics.** Most default transcriptions come from LRCLIB. Gap filling also uses lyrics published by artists or labels and other lyric catalogues, including Uta-Net. The lyric-version table records the selected source for each transcription. [LRCLIB API](https://lrclib.net/docs) · [Matching rules](../spotify-base-dataset/songs-and-lyrics/README.md)
- **Audio.** The feature table imports Spotify Audio Features from MGD+, archived annual data, Kaggle exports, and the P-Arpan combined dataset. ReccoBeats fills residual gaps by exact Spotify track ID and is recorded at field level. [MGD+](https://zenodo.org/records/8086643) · [Merged audio corpus](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search) · [Source priority rules](../spotify-base-dataset/audio-features/README.md)

In 2024–2026, the global Top 50 contains 150 chart positions with 150 default lyric links, 58 metadata-checked lyric links, and 139 links with the core audio features. The regional sample has 3,450 positions with 3,439 default lyric links, 1,877 metadata-checked lyric links, and 2,784 links with core audio features. These are chart-position counts. The working corpus has 2,963 songs. Of these, 2,950 have default lyric links across 2,890 distinct transcriptions, and 2,397 have matched audio features. [Visualization data and coverage](visualization-data.md)

On November 24, 2026, a rebuild from the retained source downloads and the original song-ID snapshot reproduced the original 601 audio rows byte for byte. A separate rebuild from the retained weekly exports reproduced all 50 positions and observed stream totals in the 2026 global year-to-date estimate. The regional same-window table was produced from archived daily chart records. This check reviewed its earlier audit and aggregation rules. [Chart audit](../spotify-base-dataset/chart-audit/README.md)

The lyric audit matched 2,318 of 2,890 version checksums to retained source responses. The other 572 versions carry source URLs and were outside this cache comparison. The lyric-version URL identifies the transcription. The lyric-match status describes the separate check that links it to the song.

The archived analysis includes emotion-word rates and Lempel–Ziv repetition derived from the selected lyric versions. The first-pass theme method applies a fixed codebook to original-language lyrics using an LLM and checks the labels against the cited lines with an independent model call. Multilingual embeddings support semantic navigation. The feature inputs, output keys and calculations are documented in the [lyrics analysis notes](lyrics-analysis-notes.md).

## Chart positions

A chart position in one source. The key is `source_file + year + market + position`. [CSV](../spotify-base-dataset/songs-and-lyrics/chart-positions.csv)

| Field | Type | Source or construction |
|---|---|---|
| `song_id` | ID | Project-generated ID assigned by the recording match. Foreign key to the song master. |
| `year`, `market`, `position` | Integer, text, integer | Spotify Wrapped, playlist archives, or the project aggregation of regional daily or global weekly Spotify charts. For an official playlist, position is its source order. |
| `track_title`, `artist_credit` | Text | Title and credit as carried by the corresponding chart source. |
| `analysis_set` | Category | Project curation of annual sources into main sample, historical supplement, or extended source list. |
| `record_status` | Category | Project label for a historical annual record or an in-year estimate. |
| `market_scope` | Category | Project label from the chart market, global or regional. |
| `chart_id` | ID | Project label for the annual source chart. |
| `spotify_track_id` | ID | Track ID carried by an annual source or recovered from a corroborating source, as recorded in id_provenance. |
| `id_provenance` | Category | Project record of how the chart-side Spotify ID was obtained, such as a source playlist, a corroborating chart or an MGD+ prefix match. |
| `source_type`, `source_url` | Category, URL | Type and URL of the row’s original chart source. See the chart source register. |
| `observed_weekly_top200_streams` | Integer | Sum of observed Spotify Global Top 200 weekly streams for the 2026 year-to-date estimate. |
| `window_start`, `window_end` | Date | Project dates specifying which daily or weekly chart observations enter an aggregate. |
| `source_file` | Text | Project CSV filename from which the chart row was imported. |
| `observed_daily_chart_streams` | Integer | Sum of observed regional daily chart streams within the common period. |
| `chart_entries` | Integer | Number of daily chart records aggregated for the title and artist credit. A date can contribute multiple records. |
| `observed_days` | Integer | Distinct observation dates in the market’s regional chart window. |
| `in_three_year_panel` | Boolean | Project flag for markets that satisfy the common-window coverage rule in each of 2024, 2025, and 2026. |
| `recording_link_status` | Category | Project result describing the chart-to-song link, including direct ID, normalized title/credit or a grouped chart row. |

## Song master

One row per project song or recording entry. A song can appear on several charts, and a live version or remix can have its own project row. The master is the place to look up the track and link it to lyrics or audio. [Song master CSV](../spotify-base-dataset/songs-and-lyrics/song-master.csv)

| Field | Type | What it means and where it comes from |
|---|---|---|
| `song_id` | ID | Hit Atlas assigns this stable internal key. Use it to join a chart position to the master and to look up its audio features. |
| `title` | Text | The track title used for display, taken from a chart or Spotify track metadata. It can include a version label such as “Remix.” The original chart title is in `track_title` on the chart-position row. |
| `artist` | Text | The credited performer or performers used for display, taken from the chart or Spotify catalogue and supplemented where a fuller credit is available. The source chart’s credit is in `artist_credit`. |
| `spotify_id` | ID | The identifier of the matched entry in Spotify’s track catalogue. It comes from the chart, a Spotify playlist or a corroborated match. Use it to look for the same catalogue entry in an audio-feature archive. It is blank when the project lacks a usable full Spotify ID. |
| `duration_s` | Number (seconds) | The duration of the matched track in seconds. It comes from sources such as Spotify, Deezer, MGD+, or archived Spotify catalogue data. It helps compare candidate recordings and lyrics. |
| `metadata_source` | URL | The link recorded when the project retrieved or corroborated metadata for this row. It commonly identifies the source used for duration and sometimes points to a credit or identity check. For the original chart title, credit and ID, consult the corresponding chart-position row and its `source_url` and `id_provenance`. |
| `lyrics_version_id` | ID | Hit Atlas’s key for the default transcription selected for this song. Join to the lyric-version or lyric-line table with this key. The lyric-match table records the status of that choice. It is blank if the song has no selected lyric text. |

**Field coverage.** Counts are distinct `song_id` entries. Spotify ID coverage counts full 22-character track IDs.

| Scope | Title | Artist credit | Full Spotify ID | Duration |
|---|---:|---:|---:|---:|
| All songs | 2,963/2,963 | 2,963/2,963 | 2,963/2,963 | 2,963/2,963 |
| 2024–2026 global Top 50 | 113/113 | 113/113 | 113/113 | 113/113 |
| 2024–2026 regional same-window charts | 2,001/2,001 | 2,001/2,001 | 2,001/2,001 | 2,001/2,001 |

**Sources and version matching.** Display titles, artist credits and track IDs primarily come from chart rows and the track catalogue. A lookup uses title, performer credit and version labels. When older chart rows lack a track ID, the project can select a documented representative catalogue entry. The original chart fields remain available in the chart table.

Duration comes from a separate lookup recorded in `duration_source_url`. The metadata audit distinguishes values tied to a full Spotify ID, direct catalogue lookups, cross-catalogue evidence and lyric-catalogue duration. MusicBrainz, Apple Music and Deezer provide cross-catalogue evidence for matching titles and artist credits. Use the audit status when limiting calculations to durations with stronger recording evidence. [Metadata audit CSV](../spotify-base-dataset/songs-and-lyrics/song-metadata-audit.csv)

**Example.** Artemas’s “i like the way you kiss me” appears at No. 11 on the 2024 global chart. The archived Spotify list supplies the title, artist and Spotify ID. The duration and its separate source are in the song master and metadata audit. [2024 global list snapshot](https://github.com/mackorone/spotify-playlist-archive/blob/d89a503d061cdd75396fb954b9917c18ae4afad9/playlists/pretty/37i9dQZF1DX18jTM2l2fJY.md)

## Song metadata audit

One row per project song, keyed by `song_id`. Added artist credits and Spotify IDs can be traced independently from duration. [CSV](../spotify-base-dataset/songs-and-lyrics/song-metadata-audit.csv)

| Field | Type | Source or construction |
|---|---|---|
| `song_id` | ID | Foreign key to the song master. |
| `artist_source_url` | URL | Corroborating source used for a filled historical credit. |
| `spotify_id_status` | Category | Existing project ID, catalogue title and full-credit match, representative catalogue selection, or corroborated catalogue entry. |
| `spotify_id_source_url` | URL | Chart, archived catalogue or Spotify lookup used to fill the ID. |
| `spotify_id_evidence_url` | URL | Additional corroboration for recorded exceptions. |
| `spotify_id_candidate_count` | Integer | Number of matching candidate IDs considered before the default selection. |
| `duration_status` | Category | Recording evidence behind the populated duration. |
| `duration_source_url` | URL | Source used for the displayed duration. |
| `duration_evidence_url` | URL | Additional catalogues that returned similar durations, where recorded. |
| `lyric_duration_conflict_s` | Number (seconds) | Gap above two seconds when a new Spotify-source duration disagrees with a previously metadata-checked lyric transcription. This field supports analysis filters while retaining the selected lyrics. |

The catalogue filled **339** IDs through title and full credits and **432** through representative selection. **7** additional entries were resolved using track and release evidence. The representative label covers releases that share a title and artist as well as later catalogue reissues and matching an expanded catalogue credit to a shorter chart credit. It describes the selected Spotify entry, with the original chart credit retained separately.

| Duration evidence | Songs |
|---|---:|
| `existing_source` — Previously sourced duration retained | 1,552 |
| `spotify_track` — Read directly from the Spotify track identified by the matched ID | 194 |
| `spotify_id_archive` — Archived duration joined on the full Spotify ID | 307 |
| `spotify_catalogue_display` — Duration shown by Spotify for the matching track or single | 3 |
| `cross_catalogue_agreement` — Two or more external catalogues agree within two seconds | 37 |
| `cross_catalogue_title_credit` — External catalogue match on title and credited artist | 842 |
| `catalogue_duration_candidates_differ` — Default external duration selected from candidates with differing lengths | 4 |
| `lrclib_catalogue_only` — Track duration reported by the selected LRCLIB entry | 24 |

LRCLIB-only durations share their source with the lyrics and are suitable for description. Independent recording or catalogue evidence should be used when using duration to validate the lyrics.

## Lyric match

One decision per song, keyed by `song_id`. [CSV](../spotify-base-dataset/songs-and-lyrics/lyric-matches.csv)

| Field | Type | Source or construction |
|---|---|---|
| `song_id` | ID | Foreign key to the project song master. |
| `lyrics_version_id` | ID | The same selected version as in the song master. Blank where a usable lyric could not be linked. |
| `lyrics_status` | Category | Project outcome for candidate selection and recording-metadata checks. |
| `lyrics_match_rule` | Text | Project explanation of the selection rule applied. |
| `identity` | Category | Project recording-identity or candidate-match status. |

## Lyric versions

One frozen transcription, keyed by `lyrics_version_id`. [CSV](../spotify-base-dataset/songs-and-lyrics/lyric-versions.csv)

| Field | Type | Source or construction |
|---|---|---|
| `lyrics_version_id` | ID | Project version key built from the lyric source’s record identifier and a normalized-text fingerprint. |
| `source_url` | URL | URL for the selected transcription, such as an LRCLIB record, artist or label publication, or lyric catalogue page. |
| `source_title`, `source_artist`, `source_album`, `source_duration_s` | Text, text, text, number (s) | Title, artist, album, and duration from the lyric source where supplied. The album or duration can be blank. |
| `text_sha256` | Text | Project SHA-256 checksum of the stored lyric lines joined by newline characters. |
| `line_count` | Integer | Project count of stored lines after transcript preparation. |

## Lyric lines

One occurrence of a line in a transcription, keyed by `line_id`. [CSV](../spotify-base-dataset/songs-and-lyrics/lyric-lines.csv)

| Field | Type | Source or construction |
|---|---|---|
| `line_id` | ID | Project-generated version-and-line-number identifier. |
| `lyrics_version_id` | ID | Foreign key to the selected transcription. |
| `line_no` | Integer | Project sequence number after extracting lines, starting at 1. |
| `line_text` | Text | Original-language lyric text prepared as lines, with repeated sung lines retained. |

## Audio features

One matched recording per song, keyed by `song_id`. [CSV](../spotify-base-dataset/audio-features/song_audio_features.csv)

| Field | Type | Source or construction |
|---|---|---|
| `song_id` | ID | Foreign key to the project song master. |
| `matched_spotify_id` | ID | Full Spotify ID used for the exact catalogue join. |
| `tempo_bpm`, `loudness_db` | Number (BPM), number (dB) | Estimate from the Spotify archive or the ReccoBeats fallback. |
| `energy`, `danceability`, `acousticness`, `audio_valence`, `instrumentalness`, `speechiness`, `liveness` | Number (0–1) | Estimate from the Spotify archive or the ReccoBeats fallback. Audio valence describes how positive the recording sounds. |
| `key`, `mode`, `time_signature` | Integer | Spotify archive tonal and meter estimates. ReccoBeats can fill key and mode. The project treats meter values in Spotify’s documented 3–7 range as usable. See [audio feature coverage](../spotify-base-dataset/audio-features/README.md#coverage). |
| `feature_method` | Text | Method for the preferred row. Field-level ReccoBeats fills take precedence over this label when tracing a specific value. |
| `audio_source`, `audio_source_url`, `audio_source_record` | Text, URL, text | Provenance of the preferred archived row or the ReccoBeats row, including the source URL and record locator. |
| `reccobeats_fields`, `reccobeats_source_url` | Text, URL | Names of metrics filled by ReccoBeats and their source endpoint. |
