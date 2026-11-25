# Hit Atlas

Hit Atlas explores how the genres, credited artists, lyrics, and recorded sound of U.S. Billboard Year-End Hot 100 hits have changed.

[Open the interactive project on GitHub Pages](https://skyexry.github.io/hit-atlas/)

## Data

The [HitAtlas dataset](billboard-year-end/data/README.md) provides all nine CSVs, original source links, field types, and a public Gist sample. See [coverage and percentages by year](billboard-year-end/data/README.md#coverage-by-year).

## Interactive views

| Task | Views | Data used |
| --- | --- | --- |
| Chart composition | [Genres Over Time](https://skyexry.github.io/hit-atlas/#genres) and [Artist Origins](https://skyexry.github.io/hit-atlas/#origins), with a linked artist treemap and song list | 1959–2025 year-end charts and the 2026 year-to-date estimate |
| Lyrical trends | [Keyword Trends](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/lyric-words-demo/index.html#trend), [Keywords by Genre](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/lyric-words-demo/index.html#genre), and [Discover Words by Year](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/lyric-words-demo/index.html#bubble) | Standalone demo with 149 usable lyrics from the annual top 15, 2014–2023 |
| Musical characteristics | [Compare Sound Profiles](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/sound-demo/2023.html), [Feature Trends](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/sound-demo/2023.html#trendPanel), and [Feature Correlations](https://skyexry.github.io/hit-atlas/billboard-year-end/demos/sound-demo/2023.html#corrTitle) | Standalone demo with 2023 profiles and correlations, and 2021–2023 trends |

To run the D3 site locally, run `python3 -m http.server` from the repository root and open `http://localhost:8000`.

### Earlier Billboard demos

The earlier [genre explorer](billboard-year-end/explorer.html) and [artist-origin sketch](billboard-year-end/demos/artist-origin-sketch/map-to-artists.html) use the 1959–2023 release.

## Archived Spotify prototype

The earlier prototype covers Spotify global and regional charts. Its data, dates, and analysis outputs describe a separate sample.

- [Spotify project snapshot](https://github.com/skyexry/hit-atlas/blob/7ab8053bdad4b21ddef28280db66e944adfb7bc4/README.md)
- [Spotify demo](web/hit-atlas-demo.html)
- [Spotify data and coverage](docs/visualization-data.md)

## License

The [MIT License](LICENSE) covers the Hit Atlas team's original D3 visualization and Python data-processing code, including original D3 code embedded in HTML. Third-party code, datasets, lyrics, and other source material are outside this grant. See the [data sources](billboard-year-end/data/README.md#sources-and-what-we-did) for provenance and the [bundled D3 license](billboard-year-end/site/D3-LICENSE.txt) for D3's terms.
