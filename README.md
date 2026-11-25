# Hit Atlas

Hit Atlas explores how the genres, credited artists, lyrics, and recorded sound of U.S. Billboard Year-End Hot 100 hits have changed.

[Open the interactive project on GitHub Pages](https://skyexry.github.io/hit-atlas/)

## Data

- [1959–2023 historical data and methods](billboard-year-end/README.md). The public tables contain 6,501 chart entries and provide song, genre, lyric, and artist-origin data with source links and coverage counts.
- [2024–2026 extension and CSV downloads](billboard-year-end/extension-2024-2026/README.md). Includes the published 2024 and 2025 year-end charts and a 2026 project estimate based on 48 weekly charts through the issue dated November 28. Each appearance earns 101 minus its weekly rank.
- [Unified analysis CSVs and data dictionary](billboard-year-end/data/README.md). The current release has **6,801 chart entries, 6,451 song records, and 2,838 credited artist or group records**. It includes supplemental genre, lyrics, artist, and audio matches. [Download annual coverage CSV](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/coverage.csv).

## Interactive views

The public D3 site reads the unified CSVs for genre shares, artist origins, and the linked artist treemap and chart history. The independent demos below retain their documented samples. To run the public site locally, serve the repository root with `python3 -m http.server` and open http://localhost:8000.

| Task | Views | Demo sample |
| --- | --- | --- |
| Chart composition | [Genres Over Time](billboard-year-end/explorer.html), [Where Artists Came From](billboard-year-end/demos/artist-origin-sketch/map-to-artists.html) | Historical 1959–2023 data |
| Lyrical trends | [Keyword Trends](billboard-year-end/demos/lyric-words-demo/index.html#trend), [Keywords by Genre](billboard-year-end/demos/lyric-words-demo/index.html#genre), [Discover Words by Year](billboard-year-end/demos/lyric-words-demo/index.html#bubble) | 149 usable lyrics from the annual top 15, 2014–2023 |
| Musical characteristics | [Compare Sound Profiles](billboard-year-end/demos/sound-demo/2023.html), [Feature Trends](billboard-year-end/demos/sound-demo/2023.html#trendPanel), [Feature Correlations](billboard-year-end/demos/sound-demo/2023.html#corrTitle) | 2023 profiles and correlations, 2021–2023 trends |

## Archived Spotify prototype

The earlier prototype covers Spotify global and regional charts. Its data, dates, and analysis outputs describe a separate sample.

- [Spotify project snapshot](https://github.com/skyexry/hit-atlas/blob/7ab8053bdad4b21ddef28280db66e944adfb7bc4/README.md)
- [Spotify demo](web/hit-atlas-demo.html)
- [Spotify data and coverage](docs/visualization-data.md)
