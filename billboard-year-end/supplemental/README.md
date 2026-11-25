# Supplemental Billboard matches

The unified release applies these CSVs after loading the historical and 2024–2026 source snapshots. Run `python3 scripts/merge_release.py` from the Billboard project directory to recompute `data/` and its annual coverage.

| File | Match and provenance |
| --- | --- |
| `song_genres.csv` | Additional entries annotated from a previous appearance of the same song, a song article, or a matched release in a music catalog. For selected soundtrack or album tracks, the cited catalog genre describes the parent release. The CSV preserves the source label and URL alongside the display label. |
| `artist_genres.csv` | Genres documented for the performer, mostly from Wikidata P136. The song charts use their own genre labels. |
| `artist_origins.csv` | Additional birthplaces, formation places, or documented group origins, with sources and country codes. |
| `lyrics.csv` and `lyric_metrics.csv` | LRCLIB matches with a consistent transcript, matched title and credits, and derived language and token counts. |
| `audio_checks.csv` | Additional ReccoBeats lookups. A matched row has nine numeric audio features and the recording ID. Unresolved rows record the matching issue. |

The historical audio check is in progress. A chart entry with no audio row is outside the completed lookup coverage. The original historical visualizations and the extension's source snapshots still use the data ranges documented beside those views.

To resume the historical checks in batches, run `python3 scripts/backfill_audio.py --limit 100`, then rerun the merge. The script records completed checks by song ID and leaves transient service failures eligible for retry.
