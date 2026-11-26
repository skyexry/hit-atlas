"""Build the unified chart dataset from the historical and extension CSV snapshots."""
import csv
from collections import defaultdict
from pathlib import Path
from measure_lyrics import BRACKETED, lyric_tokens, strip_lyric_page_text

root = Path(__file__).resolve().parents[1]
extension = root / "extension-2024-2026"
output = root / "data"
supplements = root / "supplemental"


def read(file):
    with file.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def keyed(file, field):
    rows = read(file)
    result = {row[field]: row for row in rows}
    assert len(result) == len(rows), file
    return result


def write(name, rows):
    with (output / name).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def supplemental_rows(name, key):
    source = supplements / name
    return keyed(source, key) if source.is_file() else {}


def main():
    historical = read(root / "chart_entries.csv")
    added = read(extension / "chart_entries.csv")
    entries = [dict(row, chart_kind="weekly_rank_points_ytd" if row["year"] == "2026" else "billboard_year_end")
               for row in historical + added]
    tables = {}
    for name, field in (("songs.csv", "song_id"), ("lyrics.csv", "song_id"),
                        ("lyric_metrics.csv", "song_id"), ("artists.csv", "artist_id")):
        old = keyed(root / name, field)
        new = keyed(extension / name, field)
        if name in ("songs.csv", "artists.csv"):
            assert old.keys().isdisjoint(new), name
        tables[name] = old | new
    lyric_updates = supplemental_rows("lyrics.csv", "song_id")
    metric_updates = supplemental_rows("lyric_metrics.csv", "song_id")
    assert lyric_updates.keys() == metric_updates.keys() <= tables["lyrics.csv"].keys()
    for song_id, row in lyric_updates.items():
        if tables["lyrics.csv"][song_id]["status"] in ("missing", "unverified"):
            tables["lyrics.csv"][song_id] = row
            tables["lyric_metrics.csv"][song_id] = metric_updates[song_id]

    for song_id, row in tables["lyrics.csv"].items():
        if row["status"] == "usable":
            cleaned = strip_lyric_page_text(row["lyrics"])
            if cleaned != row["lyrics"]:
                tables["lyric_metrics.csv"][song_id]["word_tokens"] = len(lyric_tokens(BRACKETED.sub(" ", cleaned)))

    artist_genres = supplemental_rows("artist_genres.csv", "artist_id")
    artist_origins = supplemental_rows("artist_origins.csv", "artist_id")
    assert artist_genres.keys() <= tables["artists.csv"].keys()
    assert artist_origins.keys() <= tables["artists.csv"].keys()
    for artist_id, artist in tables["artists.csv"].items():
        if not artist["country_code"] and artist_id in artist_origins:
            artist.update({key: value for key, value in artist_origins[artist_id].items() if key != "artist_id"})
        artist.update(artist_genres="", artist_genre_wikidata_ids="", artist_genre_source_url="")
        artist.update(artist_genres.get(artist_id, {}))

    credits = read(root / "song_artists.csv") + read(extension / "song_artists.csv")
    by_song = defaultdict(set)
    for credit in credits:
        assert credit["artist_id"] in tables["artists.csv"]
        by_song[credit["song_id"]].add(credit["artist_id"])
    assert len(credits) == sum(map(len, by_song.values()))
    songs = {row["song_id"] for row in entries}
    assert songs == set(by_song) == set(tables["songs.csv"]) == set(tables["lyrics.csv"]) == set(tables["lyric_metrics.csv"])
    assert all(tables["lyrics.csv"][sid]["status"] == tables["lyric_metrics.csv"][sid]["lyrics_status"] for sid in songs)
    assert len({row["entry_id"] for row in entries}) == len(entries) == 6801

    genres = read(root / "genres.csv")
    genre_fields = list(genres[0])
    for row in added:
        genres.append({key: row[key] if key in ("entry_id", "song_id") else "" for key in genre_fields})
    genre_updates = supplemental_rows("song_genres.csv", "entry_id")
    assert genre_updates.keys() <= {row["entry_id"] for row in entries}
    for row in genres:
        if not row["genres"] and row["entry_id"] in genre_updates:
            row.update(genre_updates[row["entry_id"]])
    genres_by_entry = {row["entry_id"]: row["genres"] for row in genres}
    assert len(genres_by_entry) == len(genres) == len(entries)

    audio = read(root / "demos/sound-demo/reccobeats-2021-2023.csv") + read(extension / "reccobeats-2024-2026.csv")
    by_rank = {(row["year"], row["rank"]): row for row in entries if int(row["year"]) >= 2021}
    for row in audio:
        entry = by_rank[(row["year"], row["rank"])]
        assert (row["billboard_title"], row["billboard_artist"]) == (entry["title"], entry["artist_credit"])
        row["entry_id"] = entry["entry_id"]
        row["song_id"] = entry["song_id"]
    supplemental_audio = supplemental_rows("audio_checks.csv", "song_id")
    assert supplemental_audio.keys() <= songs
    matched_by_song = defaultdict(dict)
    for row in audio:
        if row["status"] == "matched":
            recording = row["isrc"] or row["reccobeats_id"]
            matched_by_song[row["song_id"]][recording] = row
    audio_fields = tuple(audio[0])
    published_audio = {row["entry_id"]: row for row in audio}
    audio = []
    for entry in entries:
        entry_id, song_id = entry["entry_id"], entry["song_id"]
        current = published_audio.get(entry_id)
        recordings = matched_by_song[song_id]
        result = next(iter(recordings.values())) if len(recordings) == 1 else supplemental_audio.get(song_id)
        if current and (current["status"] == "matched" or not result or result["status"] != "matched"):
            current["genres"] = genres_by_entry[entry_id]
            audio.append(current)
        elif result:
            row = {key: result.get(key, "") for key in audio_fields}
            row.update(entry_id=entry_id, song_id=song_id, year=entry["year"], rank=entry["rank"],
                       billboard_title=entry["title"], billboard_artist=entry["artist_credit"],
                       genres=genres_by_entry[entry_id])
            audio.append(row)
    audio_by_entry = {row["entry_id"]: row["status"] for row in audio}
    assert len(audio_by_entry) == len(audio)

    by_year = defaultdict(list)
    for row in entries:
        by_year[row["year"]].append(row)
    coverage = []
    for year, rows in by_year.items():
        assert len(rows) == (101 if year == "1969" else 100)
        assert sorted(int(row["rank"]) for row in rows) == list(range(1, 101)) + ([100] if year == "1969" else [])
        song_ids = {row["song_id"] for row in rows}
        artist_ids = set().union(*(by_song[sid] for sid in song_ids))
        metrics = [tables["lyric_metrics.csv"][row["song_id"]] for row in rows]
        coverage.append(dict(year=year, chart_kind=rows[0]["chart_kind"], chart_entries=len(rows),
            distinct_songs=len(song_ids), genre_known=sum(bool(genres_by_entry[row["entry_id"]]) for row in rows),
            lyrics_usable=sum(row["lyrics_status"] == "usable" for row in metrics),
            english_primary_lyrics=sum(row["estimated_primary_language"] == "en" for row in metrics),
            distinct_artists=len(artist_ids),
            artists_origin_known=sum(bool(tables["artists.csv"][aid]["country_code"]) for aid in artist_ids),
            audio_eligible=sum(row["entry_id"] in audio_by_entry for row in rows),
            audio_matched=sum(audio_by_entry.get(row["entry_id"]) == "matched" for row in rows)))

    output.mkdir(exist_ok=True)
    for name, rows in tables.items():
        write(name, list(rows.values()))
    for name, rows in (("chart_entries.csv", entries), ("song_artists.csv", credits), ("genres.csv", genres),
                       ("audio_features.csv", audio), ("coverage.csv", coverage)):
        write(name, rows)
    print(f"{len(entries)} entries, {len(songs)} song records, {len(tables['artists.csv'])} artists, "
          f"{sum(row['lyrics_usable'] for row in coverage)} entries with lyrics, "
          f"{sum(row['audio_matched'] for row in coverage)} entries with audio")


if __name__ == "__main__":
    main()
