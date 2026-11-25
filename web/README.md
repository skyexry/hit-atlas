# Archived Spotify Visualization

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

For the current Billboard demos, see the [visualization index](../billboard-year-end/README.md#visualization-views). The [Spotify prototype](hit-atlas-demo.html) contains a global sample, four markets, and four artists. Its song table shows six rows per list, and the word-level interaction includes five short examples from three songs.

The prototype joins chart positions and analysis outputs by `song_id` and uses `line_id` for word-level evidence. Numeric audio views use the [ReccoBeats-only table](../analysis/song_audio_reccobeats.csv). Aggregations display valid counts alongside chart totals. The [Spotify coverage notes](../docs/visualization-data.md) explain the denominators.

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/web/README.md)
