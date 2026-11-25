"""Flag adjacent negation cues for display alongside lexical emotion hits."""

import argparse
import csv
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "spotify-base-dataset/songs-and-lyrics"
NEGATION = {
    "en": re.compile(r"(?:\b(?:not|never|no)\b|n['’]t)\s+(?:(?:very|really|at all)\s+)?$", re.I),
    "zh-Hant": re.compile(r"(?:並不|沒有|不再|不太|不|別|沒)\s*$"),
    "zh-Hans": re.compile(r"(?:并不|没有|不再|不太|不|别|没)\s*$"),
}


def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "lyric_negation_flags.csv")
    args = parser.parse_args()
    by_line = {row["line_id"]: row for row in read(DATA / "lyric-lines.csv")}
    langs = {row["lyrics_version_id"]: row["language"] for row in read(HERE / "lyric_emotions.csv")}
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["line_id", "token_index", "context_flag", "language", "method_version"])
        for token in read(HERE / "lyric_emotion_tokens.csv"):
            line = by_line[token["line_id"]]
            lang = langs[line["lyrics_version_id"]]
            pattern = NEGATION.get(lang)
            if pattern and pattern.search(line["line_text"][:int(token["start_char"])]):
                writer.writerow([token["line_id"], token["token_index"], "nearby_negation", lang, "adjacent-negation-v1"])


if __name__ == "__main__":
    main()
