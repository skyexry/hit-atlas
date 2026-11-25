# Archived Spotify Lyric Repetition

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

[Lyric repetition scores](lyric_repetition.csv) contain one row per `lyrics_version_id`. The method retains repeated lines, punctuation, and line order, encodes NFC text as UTF-8, and uses gzip level 9 and infgen to inspect DEFLATE matches. The score is `1 − (literal bytes + 3 × match count) / original bytes`. UTF-8 byte widths and transcription conventions matter when comparing languages.

Run `python3 analysis/repetition/score.py --infgen /path/to/infgen` from the repository root. [Method and original implementation](https://github.com/colinmorris/lalala)

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/analysis/repetition/README.md)
