"""Measure lyric repetition following Colin Morris's Lempel–Ziv accounting."""

import argparse
import csv
import gzip
import re
import subprocess
import unicodedata
from collections import defaultdict
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO / "Spotify基础数据集/歌曲与歌词/逐行歌词.csv"
MATCH = re.compile(rb"^match (\d+) \d+(?: |$)", re.MULTILINE)


def lyric_bytes(lines):
    return "\n".join(unicodedata.normalize("NFC", line) for line in lines).encode("utf-8")


def score(data, infgen):
    compressed = gzip.compress(data, compresslevel=9, mtime=0)
    result = subprocess.run(
        [infgen, "-q"], input=compressed, capture_output=True, check=True
    )
    matches = [int(length) for length in MATCH.findall(result.stdout)]
    literal_bytes = len(data) - sum(matches)
    if literal_bytes < 0:
        raise ValueError("DEFLATE match lengths exceed the original byte count")
    effective_bytes = literal_bytes + 3 * len(matches)
    return effective_bytes, 1 - effective_bytes / len(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--infgen", default="infgen")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("lyric_repetition.csv"))
    args = parser.parse_args()
    versions = defaultdict(list)
    with args.input.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            versions[row["lyrics_version_id"]].append((int(row["line_no"]), row["line_text"]))

    with args.output.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow([
            "lyrics_version_id", "lyric_bytes", "lz_effective_bytes",
            "repeat_lz_ratio", "method_version",
        ])
        for version_id, lines in versions.items():
            data = lyric_bytes(line for _, line in sorted(lines))
            if data:
                effective, ratio = score(data, args.infgen)
                writer.writerow([version_id, len(data), effective, f"{ratio:.8f}", "pudding-lz-utf8-v1"])


if __name__ == "__main__":
    main()
