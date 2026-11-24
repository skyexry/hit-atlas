"""Score recovered recordings' lyric sources without copying their text into the export."""

import argparse
import csv
import hashlib
import json
import subprocess
import tempfile
import unicodedata
from pathlib import Path

from score import DATA, export, lexicons


RECORDINGS = {
    "S_35f4e76fa217064a": (4225045, "Bella Ciao (HUGEL Remix)", "El Profesor"),
    "S_a40dcb3cc0bbdaa9": (37558619, "B4 B4", "Davido"),
}


def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--nrc", type=Path, required=True)
    parser.add_argument("--raw-cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("recovered_lyric_scores.csv"))
    args = parser.parse_args()
    songs = {r["song_id"]: r for r in read(DATA / "歌曲母表.csv")}
    grouped, provenance, token_requests = {}, {}, []
    for song_id, (source_id, title, artist) in RECORDINGS.items():
        song = songs[song_id]
        row = json.loads((args.raw_cache / f"{source_id}.json").read_text())
        if (row["id"], row["trackName"], row["artistName"]) != (source_id, title, artist):
            raise ValueError(f"Lyrics source identity changed: {source_id}")
        if row["instrumental"] or abs(float(song["duration_s"]) - float(row["duration"])) > 2:
            raise ValueError(f"Lyrics source duration does not match: {source_id}")
        lines = [unicodedata.normalize("NFC", line.strip()) for line in row["plainLyrics"].splitlines()
                 if line.strip() and not (line.strip().startswith("[") and line.strip().endswith("]"))]
        digest = hashlib.sha256("\n".join(lines).encode()).hexdigest()
        version = f"L_{source_id}_{digest[:12]}"
        grouped[version] = [dict(line_id=f"{version}_{i:04}", line_text=text)
                            for i, text in enumerate(lines, 1)]
        token_requests.append(json.dumps(dict(version=version, lines=lines), ensure_ascii=False))
        provenance[version] = dict(song_id=song_id, spotify_id=song["spotify_id"],
            source_url=f"https://lrclib.net/api/get/{source_id}",
            recording_url=f"https://open.spotify.com/track/{song['spotify_id']}",
            source_title=title, source_artist=artist, source_duration_s=row["duration"],
            recording_duration_s=song["duration_s"], text_sha256=digest, line_count=len(lines),
            match_basis="title_version_duration_release_credit")
    parsed = subprocess.run([args.tokenizer.resolve()], text=True, check=True,
        input="\n".join(token_requests) + "\n", capture_output=True)
    tokenized = [json.loads(row) for row in parsed.stdout.splitlines()]
    with tempfile.TemporaryDirectory() as tmp:
        output = Path(tmp)
        export(tokenized, grouped, lexicons(args.nrc, {row["language"] for row in tokenized}), output)
        rows = [dict(**provenance[row["lyrics_version_id"]], **row) for row in read(output / "lyric_emotions.csv")]
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
