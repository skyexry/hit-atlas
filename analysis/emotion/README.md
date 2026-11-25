# Archived Spotify Lyric Emotion Analysis

This page documents the archived Spotify prototype. The current project uses the U.S. Billboard Year-End Hot 100. [Current project](https://github.com/skyexry/hit-atlas#hit-atlas)

The [song-level output](lyric_emotions.csv) uses `lyrics_version_id`. The [token output](lyric_emotion_tokens.csv) uses `line_id` and a token position. Its offsets are zero-based Unicode code-point indexes with an exclusive end. Repeated lines contribute each time they occur.

The tokenizer uses macOS NaturalLanguage and applies NFKC, case folding, and apostrophe normalization before matching NRC EmoLex v0.92. Scoring requires at least 0.60 language confidence, 12 eligible tokens, and three dictionary matches. Each emotion is reported per 100 eligible tokens. Lexicon coverage includes neutral entries. The archived check found 2,742 scored lyric versions and 53,679 traceable token positions.

Compare rates within the same lyric language and show sample counts and dictionary coverage. The [negation flags](lyric_negation_flags.csv) and [context pilot](context_pilot.csv) illustrate why lexical scores can miss context. [Recovered lyric scores](recovered_lyric_scores.csv) retain the later LRCLIB source IDs.

Run from the repository root with the [NRC release](https://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip):

```bash
swiftc -O analysis/emotion/tokenize.swift -o /tmp/hit-atlas-tokenize
python3 analysis/emotion/score.py --tokenizer /tmp/hit-atlas-tokenize --nrc /path/to/NRC-Emotion-Lexicon.zip
```

[Original technical notes and source audit](https://github.com/skyexry/hit-atlas/blob/f9d4887460e2e6fe39439b58d3ab0591d8fe0c25/analysis/emotion/README.md)
