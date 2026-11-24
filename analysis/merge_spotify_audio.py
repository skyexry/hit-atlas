"""Fill recording-level Spotify features from additional exact-ID archive matches."""

import argparse
import csv
import gzip
import io
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

from reccobeats_coverage import METRICS, ROOT, SONGS, have_core, read_csv


ZENODO = "https://zenodo.org/records/11453410"
KAGGLE = "https://www.kaggle.com/datasets/serkantysz/550k-spotify-songs-audio-lyrics-and-genres/versions/1"
DATA = ROOT / "Spotify基础数据集/音乐特征/song_audio_features.csv"
METHOD = "Spotify Audio Features"
COLUMNS = ["spotify_id", "title", "duration_ms", *METRICS, "time_signature", "audio_source", "source_url", "source_record"]


def as_number(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return math.nan


def valid_features(row):
    decoded = {k: as_number(row.get(k)) for k in METRICS}
    if not have_core(decoded):
        return {}
    values = {column: row[k] for k, column in METRICS.items() if k not in {"key", "mode"}}
    for field, valid in (("key", range(12)), ("mode", (0, 1)), ("time_signature", range(3, 8))):
        value = as_number(row.get(field))
        if value in valid:
            values[field] = str(int(value))
    return values


def title_key(title):
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", title).casefold()))


def same_recording(row, song):
    duration = as_number(row.get("duration_ms"))
    if math.isfinite(duration):
        return abs(duration / 1000 - float(song["duration_s"])) <= 3
    return bool(row["title"]) and title_key(row["title"]) == title_key(song["title"])


def extract(stream, songs_by_id, id_col, label, url, filename):
    csv.field_size_limit(2_000_000)
    reader = csv.DictReader(stream)
    for index, row in enumerate(reader, start=2):
        if None in row.values() or None in row or row.get(id_col) not in songs_by_id:
            continue
        identifier = row[id_col]
        row["title"] = row["name"]
        if any(same_recording(row, song) for song in songs_by_id[identifier]) and valid_features(row):
            yield dict(spotify_id=identifier, audio_source=label, source_url=url,
                source_record=f"{filename}:record={index}",
                **{k: row.get(k) or "" for k in COLUMNS[1:-3]})


def dump(path, rows, fields, encoding="utf-8"):
    with path.open("w", encoding=encoding, newline="") as handle:
        writer = csv.DictWriter(handle, fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zenodo", type=Path)
    parser.add_argument("--kaggle", type=Path)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, default=DATA)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    songs = read_csv(SONGS)
    songs_by_id = defaultdict(list)
    for row in songs:
        songs_by_id[row["spotify_id"]].append(row)
    if args.zenodo or args.kaggle:
        archive_rows = []
        if args.zenodo:
            with args.zenodo.open(encoding="utf-8-sig", newline="", errors="replace") as handle:
                archive_rows.extend(extract(handle, songs_by_id, "track_id", "Fostenko 2024 Spotify archive", ZENODO, "tracks.csv"))
        if args.kaggle:
            with ZipFile(args.kaggle) as archive, io.TextIOWrapper(archive.open("songs.csv"), encoding="utf-8-sig", newline="") as handle:
                archive_rows.extend(extract(handle, songs_by_id, "id", "Tüysüz Spotify archive", KAGGLE, "songs.csv"))
        dump(args.evidence, archive_rows, COLUMNS)
    else:
        archive_rows = read_csv(args.evidence)

    candidates = defaultdict(list)
    for row in archive_rows:
        candidates[row["spotify_id"]].append(row)
    if args.baseline.suffix == ".gz":
        with gzip.open(args.baseline, "rt", encoding="utf-8-sig", newline="") as handle:
            original = list(csv.DictReader(handle))
    else:
        original = read_csv(args.baseline)
    baseline = {r["song_id"]: r for r in original}
    fields = list(original[0])
    updated = []
    changes = defaultdict(int)
    for song in songs:
        song_id, spotify_id = song["song_id"], song["spotify_id"]
        existing = baseline.get(song_id, {})
        for candidate in candidates[spotify_id]:
            values = valid_features(candidate)
            if not values or not same_recording(candidate, song):
                continue
            if existing.get("feature_method") == METHOD:
                # Update an existing Spotify row only when all populated values
                # agree and the replacement can also document a missing field.
                if not any(not existing.get(k) for k in values) or any(
                    k not in values or not math.isclose(float(value), float(values[k]), abs_tol=1e-8)
                    for k in (*METRICS.values(), "time_signature") if (value := existing.get(k))
                ):
                    continue
            remaining_recco = set(existing.get("reccobeats_fields", "").split("|")) - set(values) - {""}
            changes[("upgraded" if existing else "new", candidate["audio_source"])] += 1
            existing = dict(existing, song_id=song_id, matched_spotify_id=spotify_id, **values,
                feature_method=METHOD, audio_source=candidate["audio_source"], audio_source_url=candidate["source_url"],
                audio_source_record=candidate["source_record"], reccobeats_fields="|".join(sorted(remaining_recco)),
                reccobeats_source_url=existing.get("reccobeats_source_url", "") if remaining_recco else "")
            break
        if existing:
            updated.append(existing)
    dump(args.output, updated, fields, encoding="utf-8-sig")
    print(f"Exact-ID source records: {len(archive_rows)}; project music rows: {len(original)} → {len(updated)}")
    for (action, source), count in sorted(changes.items()):
        print(f"{action}: {count} with {source}")


if __name__ == "__main__":
    main()
