# Hit Atlas

Hit Atlas is an interactive D3.js story about how the lyrics, genres, credited artists, and recorded sound of U.S. Billboard Year-End Hot 100 hits have changed. It covers the published 1959–2025 charts and a 2026 year-to-date estimate.

[Open the interactive project on GitHub Pages](https://skyexry.github.io/hit-atlas/atlas/)

[![Hit Atlas homepage with a vinyl record and the title “Where did our love go?”](assets/hit-atlas-preview.jpg)](https://skyexry.github.io/hit-atlas/atlas/)

## Data

The [Hit Atlas data dictionary](billboard-year-end/data/README.md) documents the nine core CSVs, original sources, field types, and a public Gist sample. See [coverage and percentages by year](billboard-year-end/data/README.md#coverage-by-year).

The derived lyric data include [word counts, vocabulary diversity, and keyword rankings](billboard-year-end/data/README.md#lyric-features-and-keywords-19592026) and [53,950 segment-level emotion annotations](billboard-year-end/data/emotion/README.md). The emotion tables support song timelines, a five-year comparison of annual top-ten songs, and inspection of model disagreements.

[Download the full segment-level emotion CSV](https://raw.githubusercontent.com/skyexry/hit-atlas/main/billboard-year-end/data/emotion/segment_emotions.csv).

## Interactive views

| Track | What to explore |
| --- | --- |
| [01 · The heart of the chart](https://skyexry.github.io/hit-atlas/atlas/#heart) | Follow model-annotated lyric emotions over time and explore each year's songs, genre mix, and song-level emotion timelines. |
| [02 · The words](https://skyexry.github.io/hit-atlas/atlas/#words) | Browse annual word bubbles, trace word frequency and the share of songs using a word, and open the songs behind each count. |
| [03 · Who sang them](https://skyexry.github.io/hit-atlas/atlas/#origins) | Explore artist origins by era, then select a place or artist to see their chart appearances. |
| [04 · Sad words, happy sound](https://skyexry.github.io/hit-atlas/atlas/#sound) | Compare audio features by lyric emotion or genre for songs with matched recordings and lyric annotations from 2021 through the 2026 estimate. |

To run the D3 site locally, run `python3 -m http.server` from the repository root and open <http://localhost:8000/atlas/>. See the [Atlas build notes](atlas/README.md) for details, or open the [earlier views and demos](https://skyexry.github.io/hit-atlas/).

## License

The [MIT License](LICENSE) covers the Hit Atlas team's original D3 visualization and Python data-processing code, including original D3 code embedded in HTML. Third-party code, datasets, lyrics, and other source material are outside this grant. See the [data sources](billboard-year-end/data/README.md#sources-and-what-we-did) for provenance and the [bundled D3 license](billboard-year-end/site/D3-LICENSE.txt) for D3's terms.
