"""Verify the chart extension against the historical tables and the weekly snapshot."""
import csv
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

EXT = Path(__file__).resolve().parent
BASE = EXT.parent


def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def normalize(text):
    ascii_text = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", ascii_text)


def credit_key(credit):
    names = re.split(r"\s+(?:featuring|feat\.?|with|and|&)\s+|,\s*", credit, flags=re.I)
    return tuple(sorted(normalize(re.sub(r"^the\s+", "", name.strip(), flags=re.I)) for name in names if name.strip()))


entries = read(EXT / "chart_entries.csv")
new_songs = read(EXT / "songs.csv")
assert len({r["entry_id"] for r in entries}) == len(entries) == 300
for year in ("2024", "2025", "2026"):
    assert sorted(int(r["rank"]) for r in entries if r["year"] == year) == list(range(1, 101))

history = {r["song_id"] for r in read(BASE / "songs.csv")}
new = {r["song_id"] for r in new_songs}
assert len(new) == len(new_songs) and history.isdisjoint(new)
assert {r["song_id"] for r in entries} - history == new
lyrics = {r["song_id"]: r for r in read(BASE / "lyrics.csv") + read(EXT / "lyrics.csv")}
metrics = {r["song_id"]: r for r in read(BASE / "lyric_metrics.csv") + read(EXT / "lyric_metrics.csv")}
artists = {r["artist_id"]: r for r in read(BASE / "artists.csv") + read(EXT / "artists.csv")}
credits = defaultdict(set)
for record in read(BASE / "song_artists.csv") + read(EXT / "song_artists.csv"):
    credits[record["song_id"]].add(record["artist_id"])
for song in {r["song_id"] for r in entries}:
    assert lyrics[song]["status"] == metrics[song]["lyrics_status"]
    assert credits[song] and credits[song] <= artists.keys()
    if lyrics[song]["status"] == "usable":
        assert lyrics[song]["lyrics"].strip() and lyrics[song]["source_url"]

raw = read(EXT / "weekly-2026.csv")
dates = sorted({date.fromisoformat(r["chart_date"]) for r in raw})
assert len(dates) == 48 and dates[0] == date(2026, 1, 3) and dates[-1] == date(2026, 11, 28)
assert all(b - a == timedelta(days=7) for a, b in zip(dates, dates[1:]))
weekly_ranks = defaultdict(Counter)
scores = {}
for row in raw:
    rank = int(row["rank"])
    weekly_ranks[row["chart_date"]][rank] += 1
    identity = normalize(row["title"]), credit_key(row["artist_credit"])
    score = scores.setdefault(identity, [row["title"], row["artist_credit"], 0, 0, 100])
    score[2] += 101 - rank
    score[3] += 1
    score[4] = min(score[4], rank)
assert all(c == Counter(range(1, 101)) for c in weekly_ranks.values())
ranking = sorted(scores.values(), key=lambda r: (-r[2], -r[3], r[4], normalize(r[0]), normalize(r[1])))
published = read(EXT / "scores-2026.csv")
assert len(published) == 100
for rank, (row, result) in enumerate(zip(published, ranking), 1):
    assert int(row["rank"]) == rank
    assert [row["title"], row["artist_credit"], *[int(row[k]) for k in ("score", "weeks", "best_rank")]] == result
assert {r["entry_id"] for r in published} == {r["entry_id"] for r in entries if r["year"] == "2026"}

audio = read(EXT / "reccobeats-2024-2026.csv")
assert len(audio) == 300
for entry, row in zip(entries, audio):
    assert (entry["year"], entry["rank"], entry["title"], entry["artist_credit"]) == (
        row["year"], row["rank"], row["billboard_title"], row["billboard_artist"])
    if row["status"] == "matched":
        assert row["reccobeats_id"] and row["isrc"] and row["audio_source_url"]
        for feature in ("energy", "danceability", "acousticness", "valence", "speechiness", "liveness", "instrumentalness"):
            assert 0 <= float(row[feature]) <= 1
        assert float(row["tempo"]) > 0 and float("-inf") < float(row["loudness"]) < float("inf")
for coverage in read(EXT / "coverage.csv"):
    year = coverage["year"]
    sample = [r for r in entries if r["year"] == year]
    cohort = set().union(*(credits[r["song_id"]] for r in sample))
    assert int(coverage["artists_origin_known"]) == sum(bool(artists[i]["country_code"]) for i in cohort)
    assert int(coverage["lyrics_usable"]) == sum(lyrics[r["song_id"]]["status"] == "usable" for r in sample)
    assert int(coverage["audio_matched"]) == sum(r["year"] == year and r["status"] == "matched" for r in audio)
print("Verified 300 chart entries, 48 source weeks, 2026 ranking, table joins and annual coverage.")
