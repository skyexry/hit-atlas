"""Check additional chart recordings against ReccoBeats and save the audit table."""

import argparse
import math
import csv
import threading
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[1]
data = root / "data"
audit = root / "supplemental" / "audio_checks.csv"


def read(name):
    with (data / (name + ".csv")).open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def key(value):
    return "".join(
        c for c in unicodedata.normalize("NFKD", value).casefold() if c.isalnum()
    )


base = "https://api.reccobeats.com/v1"
lock = threading.Lock()
next_call = 0
client = threading.local()


def request(path, params=None):
    global next_call
    if not hasattr(client, "session"):
        client.session = requests.Session()
        client.session.headers["User-Agent"] = (
            "HitAtlasResearch/1.0 (https://github.com/skyexry/hit-atlas)"
        )
    for attempt in range(3):
        with lock:
            time.sleep(max(0, next_call - time.monotonic()))
            next_call = time.monotonic() + 0.24
        try:
            r = client.session.get(base + path, params=params, timeout=12)
            if r.status_code == 404:
                return {}
            if r.ok:
                return r.json()
            if r.status_code == 429:
                with lock:
                    next_call = max(
                        next_call,
                        time.monotonic() + float(r.headers.get("Retry-After", "5")),
                    )
            else:
                time.sleep(1 + attempt)
        except (requests.RequestException, ValueError):
            time.sleep(1 + attempt)
    return None


artists = {a["artist_id"]: key(a["name"]) for a in read("artists")}
credit = defaultdict(set)
for a in read("song_artists"):
    credit[a["song_id"]].add(artists[a["artist_id"]])
fields = "energy danceability acousticness valence speechiness instrumentalness liveness tempo loudness".split()


def find(s):
    sid = s["song_id"]
    title = s["title"]
    target = key(title)
    allowed = credit[sid]
    seen = {}
    for page in range(2):
        response = request(
            "/track/search", {"searchText": title, "size": 50, "page": page}
        )
        if response is None:
            return None
        for item in response.get("content", []):
            names = {key(a["name"]) for a in item["artists"]}
            if key(item["trackTitle"]) == target and names == allowed:
                seen[item["id"]] = item
        if page + 1 >= response.get("totalPages", 0):
            break
    if len(seen) > 1 and (
        len({v.get("isrc") for v in seen.values()}) != 1
        or not next(iter(seen.values())).get("isrc")
    ):
        outcome = {"reason": "ambiguous_recording"}
    elif seen:
        t = max(seen.values(), key=lambda v: v.get("popularity") or 0)
        url = "/track/" + t["id"] + "/audio-features"
        f = request(url)
        if f is None:
            return
        if all(
            type(f.get(k)) in (int, float)
            and math.isfinite(f[k])
            and (f[k] > 0 if k == "tempo" else k == "loudness" or 0 <= f[k] <= 1)
            for k in fields
        ):
            outcome = dict(
                status="matched",
                reccobeats_title=t["trackTitle"],
                reccobeats_artists=" | ".join(a["name"] for a in t["artists"]),
                reccobeats_id=t["id"],
                isrc=t.get("isrc") or "",
                spotify_url=t.get("href") or "",
                audio_source_url=base + url,
                **{k: f[k] for k in fields},
            )
        else:
            outcome = {"reason": "features_unavailable"}
    else:
        outcome = {"reason": "no_exact_title_and_credit"}
    reason = outcome.pop("reason", "exact_normalized_title_and_full_credit")
    status = "matched" if outcome.get("status") == "matched" else "unresolved"
    return dict(outcome, song_id=sid, status=status, match_reason=reason)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, help="Maximum number of additional song lookups"
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    published = {
        r["song_id"] for r in read("audio_features") if r["status"] == "matched"
    }
    with audit.open(encoding="utf-8-sig") as source:
        rows = csv.DictReader(source)
        columns = rows.fieldnames
        checked = {r["song_id"] for r in rows}
    entries = read("chart_entries")
    plan = {}
    # Interleave years by rank so early eras get checked alongside later ones.
    for row in sorted(entries, key=lambda r: (int(r["rank"]), int(r["year"]))):
        plan.setdefault(row["song_id"], len(plan))
    recent = {r["song_id"] for r in read("audio_features") if r["status"] != "matched"}
    target = sorted(
        (s for s in read("songs") if s["song_id"] not in checked | published),
        key=lambda s: (s["song_id"] not in recent, plan[s["song_id"]]),
    )
    if args.limit is not None:
        target = target[: args.limit]
    added = 0
    with audit.open(
        "a", encoding="utf-8", newline=""
    ) as destination, ThreadPoolExecutor(6) as pool:
        writer = csv.DictWriter(destination, fieldnames=columns, lineterminator="\n")
        for result in pool.map(find, target):
            if result is not None:
                writer.writerow(result)
                destination.flush()
                added += 1
    print(
        f"{added} of {len(target)} lookups returned a result. Rebuild with scripts/merge_release.py."
    )


if __name__ == "__main__":
    main()
