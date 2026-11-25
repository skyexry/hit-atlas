# Hit Atlas

Hit Atlas explores how the genres, credited artists, lyrics, and recorded sound of U.S. Billboard Year-End Hot 100 hits have changed.

[Open the interactive project on GitHub Pages](https://skyexry.github.io/hit-atlas/)

## Data

The [HitAtlas dataset](billboard-year-end/data/README.md) provides all nine CSVs, original source links, field types, and a public Gist sample. See [coverage and percentages by year](billboard-year-end/data/README.md#coverage-by-year).

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
