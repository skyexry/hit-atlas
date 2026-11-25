"""Plan or score Billboard lyric sections with Hugging Face hosted inference."""

import argparse
import csv
import json
import os
import re
import textwrap
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DATA = Path(__file__).resolve().parents[1] / "data"
MODEL = "tabularisai/multilingual-emotion-classification"
URL = f"https://router.huggingface.co/hf-inference/models/{MODEL}"
EMOTIONS = ("anger", "contempt", "disgust", "fear", "frustration", "gratitude",
            "joy", "love", "neutral", "sadness", "surprise")
MAX_CHARS = 300
SECTION = re.compile(
    r"\[((?:pre[- ]chorus|post[- ]chorus|chorus|verse|intro|outro|bridge|hook|refrain|interlude|instrumental)[^\[\]]*)\]",
    re.IGNORECASE,
)


def lyric_sections(lyrics):
    label, marker_pending, lines = "", False, []
    for number, raw in enumerate(lyrics.splitlines(), 1):
        line = raw.strip()
        if not line:
            if lines:
                yield label, marker_pending, lines
                marker_pending = False
                lines = []
            continue
        pieces = SECTION.split(line)
        for index, piece in enumerate(pieces):
            if index % 2:
                if lines:
                    yield label, marker_pending, lines
                    lines = []
                label = piece.strip()
                marker_pending = True
            elif piece.strip():
                lines.append((number, piece.strip()))
    if lines:
        yield label, marker_pending, lines


def chunks(lines):
    block, start, end = "", 0, 0
    for number, line in lines:
        for piece in textwrap.wrap(line, width=MAX_CHARS, break_on_hyphens=False):
            if block and len(block) + 1 + len(piece) > MAX_CHARS:
                yield start, end, block
                block = ""
            if not block:
                start = number
            block = f"{block}\n{piece}" if block else piece
            end = number
    if block:
        yield start, end, block


def song_locations(song_id, lyrics):
    parts = []
    for section, (label, has_marker, lines) in enumerate(lyric_sections(lyrics), 1):
        for chunk, (start, end, text) in enumerate(chunks(lines), 1):
            length = sum(not char.isspace() for char in text)
            parts.append((section, label, chunk, start, end, has_marker and chunk == 1, length, text))

    total = sum(part[-2] for part in parts)
    offset = 0
    for section, label, chunk, start, end, has_marker, length, text in parts:
        start_pct = round(offset * 100 / total, 6)
        offset += length
        end_pct = round(offset * 100 / total, 6)
        yield (song_id, section, label, chunk, start, end, start_pct, end_pct,
               label if has_marker else "", text)


def score(text, token):
    payload = {"inputs": text, "parameters": {"top_k": len(EMOTIONS), "function_to_apply": "sigmoid"}}
    request = Request(URL, data=json.dumps(payload).encode(),
                      headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urlopen(request, timeout=60) as response:
        rows = json.load(response)
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Expected one flat list of label-score objects from HF Inference")
    scores = {row["label"]: row["score"] for row in rows}
    if set(scores) != set(EMOTIONS) or len(rows) != len(EMOTIONS):
        raise ValueError("HF Inference did not return exactly the 11 expected emotion labels")
    if any(not isinstance(value, (int, float)) or not 0 <= value <= 1 for value in scores.values()):
        raise ValueError("HF Inference returned invalid emotion scores")
    return scores


def read(table):
    with (DATA / f"{table}.csv").open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=2021)
    parser.add_argument("--end", type=int, default=2025)
    parser.add_argument("--limit-songs", type=int, default=10)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--probe", action="store_true", help="Score synthetic text only")
    mode.add_argument("--output", type=Path, help="Submit lyric chunks and write the scored CSV")
    args = parser.parse_args()
    token = os.environ.get("HF_TOKEN")
    if (args.output or args.probe) and not token:
        parser.error("Set HF_TOKEN to a Hugging Face token with Inference Providers permission")
    if args.output and args.output.exists():
        parser.error("Choose a new output path")
    if args.start > args.end or args.limit_songs < 1:
        parser.error("Provide an ordered year range and a positive song limit")
    if args.probe:
        print(json.dumps(score("I am so grateful you came. I was sad and afraid before you arrived.", token)))
        return

    song_ids = dict.fromkeys(row["song_id"] for row in read("chart_entries")
                             if args.start <= int(row["year"]) <= args.end)
    lyric_by_song = {row["song_id"]: row["lyrics"] for row in read("lyrics") if row["status"] == "usable"}
    songs = [(sid, lyric_by_song[sid]) for sid in song_ids if sid in lyric_by_song][:args.limit_songs]
    locations = [location for sid, lyrics in songs for location in song_locations(sid, lyrics)]
    unique_texts = dict.fromkeys(row[-1] for row in locations)
    print(f"{len(songs)} songs, {len(locations)} chunks, {len(unique_texts)} distinct API inputs")
    if not args.output:
        return
    if not locations:
        parser.error("No usable lyric chunks in the selected range")
    predictions = {text: score(text, token) for text in unique_texts}
    with args.output.open("x", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(("song_id", "section", "section_label", "chunk", "start_line", "end_line",
                         "start_pct", "end_pct", "section_marker", "model", *EMOTIONS))
        for *location, text in locations:
            writer.writerow((*location, MODEL, *(predictions[text][label] for label in EMOTIONS)))


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f"HF Inference request failed: HTTP {error.code} {error.reason}") from None
    except (URLError, TimeoutError) as error:
        reason = error.reason if isinstance(error, URLError) else error
        raise SystemExit(f"Network error reaching router.huggingface.co: {reason}") from None
