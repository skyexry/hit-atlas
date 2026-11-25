# Archived Spotify Lyric Themes and Similarity

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

The [theme pilot](lyric_themes_pilot.csv) classifies verified lyric versions using a fixed codebook. It records a candidate theme and evidence line, then checks that line and its surroundings in a separate model call. In the 256-version pilot, 80 passed the evidence check and 77 of those were labeled love. The [agreement pilot](lyric_themes_agreement_pilot.csv) varies choice order to assess stability. These samples document method behavior and limitations.

[Lyric similarity](lyric_similarity.csv) lists five cosine nearest neighbors per `lyrics_version_id`. It uses 384-dimensional multilingual MiniLM embeddings, removes duplicate lyric lines in each input, and excludes identical transcriptions from retrieval.

The pinned model versions, source links, and rebuild commands are in the original notes. The scripts are [classify.py](classify.py), [lyric_judge.py](../lyric_judge.py), and [lyric_similarity.py](lyric_similarity.py).

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/analysis/theme/README.md)
