# Archived Spotify Lyric Analysis Notes

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

Start with the selected `lyrics_version_id` in the [Spotify song tables](../spotify-base-dataset/songs-and-lyrics/README.md). The lyric-version table supplies source metadata, the line table provides ordered text and stable `line_id` values, and the match table records verification status by `song_id`. Chart positions connect by `song_id`.

| Output | Unit | Method |
| --- | --- | --- |
| [Emotion scores and highlights](../analysis/emotion/README.md) | Lyric version and token position | NRC dictionary hits per 100 tokens with dictionary coverage |
| [Repetition](../analysis/repetition/README.md) | Lyric version | Lempel–Ziv-derived compression score |
| [Themes and similarity](../analysis/theme/README.md) | Lyric version | Evidence-checked theme pilots and multilingual MiniLM neighbors |
| [Sound and listener ratings](visualization-data.md) | Song | Recording features and separately documented listener ratings |

The Billboard project uses a different lyric sample and reports keyword occurrences per 1,000 words. See the [current lyric demo and coverage](../billboard-year-end/README.md#visualization-views).

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/docs/lyrics-analysis-notes.md)
