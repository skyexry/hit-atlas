# Archived Spotify Song and Lyric Tables

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

| Table | Record and join |
| --- | --- |
| [Song master](song-master.csv) | One project recording, keyed by `song_id`, with the selected lyric version |
| [Chart positions](chart-positions.csv) | One source position, joined to the recording by `song_id` |
| [Lyric matches](lyric-matches.csv) | The selected version and verification status for each `song_id` |
| [Lyric versions](lyric-versions.csv) | Transcription provenance, keyed by `lyrics_version_id` |
| [Lyric lines](lyric-lines.csv) | Ordered source text, keyed by `line_id`, grouped by `lyrics_version_id` |

Analyze each lyric version once and rejoin to chart positions when summarizing by year or market. [Field dictionary](../../docs/data-field-sources.md) and [analysis methods](../../docs/lyrics-analysis-notes.md).

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/Spotify%E5%9F%BA%E7%A1%80%E6%95%B0%E6%8D%AE%E9%9B%86/%E6%AD%8C%E6%9B%B2%E4%B8%8E%E6%AD%8C%E8%AF%8D/%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
