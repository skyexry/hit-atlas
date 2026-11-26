# Lyric emotion annotations

These tables describe emotions expressed in lyrics from the U.S. Billboard Year-End Hot 100. The full corpus includes the published 1959–2025 year-end charts and the 2026 year-to-date estimate. Join the annotations to the [unified Billboard dataset](../README.md) by `song_id`.

## Coverage at a glance

| Measure | Coverage |
|---|---:|
| Song records with segment annotations | 6,301 / 6,451 |
| Chart entries linked to an annotated song | 6,648 / 6,801 |
| Annotated lyric segments | 53,950 |
| Segments flagged for sarcasm | 1,765 |

The 150 song records without annotations include 44 instrumentals, 41 missing lyrics, 41 matches awaiting review, and 24 compound singles. The emotion analysis includes two supplemental transcripts from the [Melo 2024 lyric collection](https://github.com/tmelo-uea/billboard-hot100-lyrics/blob/main/billboard-year-end-2024-lyrics.csv), matched by rank, title, and artist. Their sources are recorded in the segment tables. The [core lyrics table](../README.md#csv-data-dictionary) retains its own coverage and match statuses.

## Data tables

### Full corpus

| File | Unit and size | Contents and use |
|---|---|---|
| [segment_emotions.csv](segment_emotions.csv) | One lyric segment per song record. **53,950** | Start and end positions, section labels and markers, Astra's primary and secondary labels, four-category display fields, sarcasm flags, short rationales where available, and lyric provenance. Use for song timelines and for aggregation by chart year or genre. |
| [song_status.csv](song_status.csv) | One song record. **6,451** | Chart years, chart entry count, core lyric status, annotation status, provenance, and segment counts. Use to show coverage and identify songs that lack usable lyrics. |
| [song_emotion_summary.csv](song_emotion_summary.csv) | One annotated song. **6,301** | Segment count, lyric span percentages for joy, love, sadness, anger, outside the four categories, and insufficient evidence. Sarcasm has separate count and span fields. Join by `song_id` for custom groups. |
| [annual_emotion_summary.csv](annual_emotion_summary.csv) | One full chart year. **68** | Equal-weight averages of song-level shares for all annotated songs on each chart, with total and annotated song counts. The estimated 2026 chart retains its `chart_kind`. |

[Download the full segment CSV](segment_emotions.csv?raw=1) to work with all 53,950 rows.

### Annual top-ten comparison

| File | Unit and size | Contents and use |
|---|---|---|
| [top10_2021-2025_segments.csv](top10_2021-2025_segments.csv) | One segment per chart entry. **532** rows across **50** chart entries and **46** distinct songs | Year, rank, positions, source information, and emotion annotations. Four songs appear in both 2024 and 2025. Each uses the same lyrics and labels in both years. Use for drill-down from a year to its songs and sections. |
| [top10_2021-2025_annual.csv](top10_2021-2025_annual.csv) | One published year-end chart. **5** | Equal-weight shares of lyric text by primary emotion, the unassigned share, and separate sarcasm measures. Use for a comparison of the ten highest-ranked songs each year. |
| [top10_2024_unassigned_segments.csv](top10_2024_unassigned_segments.csv) | One segment outside the four display categories. **49** | Original labels, lyric positions, share of the song, and contribution in percentage points to the annual unassigned share. Use to inspect what the gray portion contains under the original display grouping. |

### Model comparison pilot

All six files below cover the same **122 segments** from the ten highest-ranked songs in 2021.

| File | Contents |
|---|---|
| [pilot_astra_segments.csv](pilot_astra_segments.csv) | Full-song-context Astra labels, section positions, and sarcasm flags. |
| [pilot_astra_four_classes.csv](pilot_astra_four_classes.csv) | The same annotations mapped to the four display categories. |
| [pilot_reference_labels.csv](pilot_reference_labels.csv) | An independent Codex interpretation of the segments, recorded before seeing either model's predictions. Includes evidence and source-noise flags. |
| [pilot_tabularis_scores.csv](pilot_tabularis_scores.csv) | Eleven independent TabularisAI scores per segment, with source line ranges and section positions. |
| [pilot_tabularis_comparison.csv](pilot_tabularis_comparison.csv) | TabularisAI predictions aligned with the reference labels, including labels missed or added at a score threshold of 0.5. |
| [pilot_model_comparison.csv](pilot_model_comparison.csv) | Both model outputs aligned with the same reference, including Astra's primary labels, sarcasm markers, and paraphrased rationales. |

## Preparation and joins

- **Segments and positions.** Recognized lyric section labels, blank lines, and a 300-character chunk limit supply boundaries. The composite key within one song is `song_id`, `section`, and `chunk`. `start_pct` and `end_pct` use cumulative non-whitespace characters in the segmented transcript. They measure text position on a 0–100 scale. `section_label` records the section name where available, and `section_marker` marks its first chunk. Repeated choruses retain their positions.
- **Astra annotations.** GPT-6.2 Astra reads the complete lyric transcript and labels each segment in order. `astra_primary_emotion` and the pipe-delimited `astra_labels` preserve the original choices. The full-corpus release reuses annotations for the 46 songs in the top-ten comparison and adds annotations for 6,255 songs. The [TabularisAI pilot script](../../scripts/score_lyric_sections.py) uses the same segmentation. Its classifier scores each chunk separately and can reuse scores for identical text.
- **Display grouping.** `primary_emotion` and `labels` use joy, love, sadness, and anger, with frustration mapped to anger. `four_class_status` distinguishes a mapped primary label, a primary label outside these categories, and insufficient evidence. The top-ten annual CSV uses this original grouping. A view can optionally count primary contempt as anger when the original labels also include anger. `sarcasm` remains an independent flag in either grouping.
- **Year comparisons.** Join segment results to chart entries by `song_id`. A song that appears in more than one year contributes once in each year. For each song, sum `end_pct − start_pct` by display category, including the share outside the four categories. Average those shares across the covered songs with equal weight. Keep sarcasm measures separate and show the number of covered songs alongside each year's result.

## Visualization uses

| Task | View | Data used |
|---|---|---|
| Explore a song | Lyric progress timeline with verse, chorus, and sarcasm markers | Full-corpus segment positions, labels, and section markers |
| Compare chart years | Stacked bars for the four main categories and an expandable unassigned share | Full-chart annual summary or annual top-ten summary |
| Inspect coverage | Annual coverage counts with a breakdown of missing or unmatched lyrics | [Analysis coverage](../analysis_coverage.csv) and song annotation status |
| Review model behavior | Per-category agreement and missed labels, with examples by segment | Linked 2021 pilot and model comparison tables |

## Known limitations

These are model annotations of lyric expression. Transcript formatting, repeated choruses, and source artifacts can affect segment boundaries or the amount of text assigned to a category. The comparison pilot covers ten songs and uses a single independent interpretation as its reference. It compares two model-and-context setups and does not isolate the effect of whole-song context. The top-ten comparison describes the highest-ranked songs in each year. For full-chart trends, check lyric coverage and report the 2026 estimate separately.
