"""Build a comparable ReccoBeats-only view without changing the priority audio table."""

import argparse
import csv
import gzip
import hashlib
import json
import math
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode


ROOT = Path(__file__).resolve().parents[1]
SONGS = ROOT / "Spotify基础数据集/歌曲与歌词/歌曲母表.csv"
BASE = "https://api.reccobeats.com/v1"
METRICS = {
    "tempo": "tempo_bpm", "energy": "energy", "danceability": "danceability",
    "loudness": "loudness_db", "acousticness": "acousticness", "valence": "audio_valence",
    "instrumentalness": "instrumentalness", "speechiness": "speechiness",
    "liveness": "liveness", "key": "key", "mode": "mode",
}
CORE = list(METRICS)[:9]


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def track_id(row):
    prefix = "https://open.spotify.com/track/"
    href = row.get("href", "")
    return href.removeprefix(prefix) if href.startswith(prefix) else ""


def collect_legacy(payloads, wanted):
    found = {}
    for payload in payloads:
        requested = set(payload["ids"]) & wanted
        for row in payload["content"]:
            if track_id(row) in requested:
                found[track_id(row)] = row
    return found


def collect_snapshots(payloads, wanted):
    found = {}
    for payload in payloads:
        if payload["url"].startswith(BASE + "/audio-features?"):
            rows = payload["result"]["content"]
        elif "/track/" in payload["url"] and payload["url"].endswith("/audio-features"):
            rows = [payload["result"]]
        else:
            continue
        for row in rows:
            if track_id(row) in wanted and have_core(row):
                found[track_id(row)] = row
    return found


def snapshots(directory):
    return [json.loads(path.read_text()) for path in sorted(directory.glob("*.json"))] if directory else []


def fetch(path, ids, cache):
    url = BASE + path + ("?" + urlencode({"ids": ",".join(ids)}) if ids else "")
    digest = hashlib.sha256(url.encode()).hexdigest()
    snapshot = cache / f"{digest}.json"
    if snapshot.exists():
        return json.loads(snapshot.read_text())["result"]
    for attempt in range(5):
        response = subprocess.run(["curl", "--silent", "--show-error", "--max-time", "18",
                                   "--write-out", "\n%{http_code}", url], capture_output=True)
        body, _, status = response.stdout.rpartition(b"\n")
        if response.returncode == 0:
            if status == b"200":
                data = json.loads(body)
            elif status == b"404" and not ids:
                data = {}
            elif status not in {b"429", b"500", b"502", b"503", b"504"}:
                raise RuntimeError(f"ReccoBeats HTTP {status.decode()} for {path}")
            else:
                time.sleep(2 ** attempt)
                continue
            snapshot.write_text(json.dumps({"url": url, "result": data}, ensure_ascii=False))
            time.sleep(0.65)
            return data
        time.sleep(2 ** attempt)
    raise RuntimeError(f"ReccoBeats request failed after retries: {snapshot.name}")


def have_core(row):
    return all(isinstance(row.get(k), (int, float)) and math.isfinite(row[k])
               and (row[k] > 0 if k == "tempo" else k == "loudness" or 0 <= row[k] <= 1)
               for k in CORE)


def batches(ids, size=35):
    order = sorted(ids)
    for start in range(0, len(order), size):
        yield order[start:start + size]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--legacy-cache", type=Path)
    parser.add_argument("--cache-only", action="store_true")
    parser.add_argument("--archive", type=Path, help="Replay a saved API response archive offline")
    parser.add_argument("--save-archive", type=Path, help="Export the raw response caches for reproducibility")
    parser.add_argument("--output", type=Path, default=ROOT / "analysis/song_audio_reccobeats.csv")
    args = parser.parse_args()
    if args.archive and args.save_archive:
        parser.error("Choose either --archive or --save-archive")
    if not (args.cache or args.archive):
        parser.error("Either --cache or --archive is required")
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)
    songs = read_csv(SONGS)
    wanted = {s["spotify_id"] for s in songs if len(s["spotify_id"]) == 22}
    legacy = snapshots(args.legacy_cache)
    current = snapshots(args.cache)
    if args.archive:
        with gzip.open(args.archive, "rt", encoding="utf-8") as handle:
            archived = json.load(handle)
        legacy = archived["legacy"]
        current = archived["current"]
    found = collect_legacy(legacy, wanted)
    found = {key: row for key, row in found.items() if have_core(row)}
    found.update(collect_snapshots(current, wanted))
    if not (args.cache_only or args.archive):
        for batch in batches(wanted - found.keys()):
            for row in fetch("/audio-features", batch, args.cache)["content"]:
                if track_id(row) in batch and have_core(row):
                    found[track_id(row)] = row
        print(f"Exact batch matches: {len(found)} unique Spotify IDs", flush=True)

        catalog = {}
        for batch in batches(wanted - found.keys()):
            for row in fetch("/track", batch, args.cache)["content"]:
                if track_id(row) in batch and row.get("id"):
                    catalog[track_id(row)] = row["id"]
        print(f"Remaining tracks present in the catalogue: {len(catalog)}", flush=True)
        for spotify_id, recco_id in sorted(catalog.items()):
            row = fetch(f"/track/{recco_id}/audio-features", None, args.cache)
            if track_id(row) == spotify_id and have_core(row):
                found[spotify_id] = row

    if args.save_archive:
        archive = {"legacy": legacy, "current": snapshots(args.cache)}
        args.save_archive.write_bytes(gzip.compress(json.dumps(archive, ensure_ascii=False,
            separators=(",", ":")).encode(), mtime=0))

    columns = ["song_id", "matched_spotify_id", *METRICS.values(), "isrc", "source_url"]
    covered = 0
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, columns, lineterminator="\n")
        writer.writeheader()
        for song in songs:
            spotify_id = song["spotify_id"]
            row = found.get(spotify_id)
            if row is None:
                continue
            values = {column: row.get(key) for key, column in METRICS.items()}
            if values["key"] not in range(12):
                values["key"] = None
            if values["mode"] not in (0, 1):
                values["mode"] = None
            writer.writerow(dict(song_id=song["song_id"], matched_spotify_id=spotify_id, **values,
                isrc=row.get("isrc"), source_url=f'{BASE}/track/{row["id"]}/audio-features'))
            covered += 1
    print(f"ReccoBeats-only coverage: {covered}/{len(songs)} project songs", flush=True)


if __name__ == "__main__":
    main()
