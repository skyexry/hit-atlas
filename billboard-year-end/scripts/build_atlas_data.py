"""Build the compact data file for the Hit Atlas story page (atlas/).

Reads the published CSVs in billboard-year-end/data/ and writes atlas/data/atlas.json.
Run from the repository root:

    python3 billboard-year-end/scripts/build_atlas_data.py

The script re-derives every share and count it exports and stops if a value disagrees
with the published summaries, so the page shows the same numbers as the CSVs.
"""

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT.parent / "atlas" / "data" / "atlas.json"

# Artist records that are pieces of a parsed credit rather than performers
# ("…and the Encanto cast", "The Anxiety : Willow and Tyler Cole"). They have no
# Wikidata ID or origin and are left out of the origin views.
FRAGMENT_NAMES = {"the", "cast", ":"}
ORIGIN_TYPES = {"birthplace": "b", "formation": "f", "artist_origin": "o", "": ""}

# Original Astra labels, stored per segment as one character each.
ASTRA = {
    "love": "l", "joy": "j", "sadness": "s", "anger": "a", "frustration": "f", "contempt": "c",
    "fear": "r", "neutral": "n", "surprise": "u", "gratitude": "g", "disgust": "d", "": "i",
}
# Display grouping documented in data/emotion/README.md: frustration counts as anger.
DISPLAY = {"l": "love", "j": "joy", "s": "sadness", "a": "anger", "f": "anger", "i": "insufficient"}
SHARES = ("love", "joy", "sadness", "anger", "outside", "insufficient")
SUMMARY_FIELDS = {
    "love": "love_pct", "joy": "joy_pct", "sadness": "sadness_pct", "anger": "anger_pct",
    "outside": "outside_four_classes_pct", "insufficient": "insufficient_evidence_pct",
}
AUDIO_FIELDS = ("valence", "energy", "danceability", "acousticness", "speechiness", "tempo", "loudness")


def read(name):
    with (DATA / f"{name}.csv").open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def display(code):
    return DISPLAY.get(code, "outside")


SECTION = re.compile(
    r"^(pre[ -]?chorus|post[ -]?chorus|chorus|verse|bridge|hook|refrain|intro|outro|interlude|"
    r"instrumental|breakdown|drop|skit|spoken|break|coda|rap|vamp)\b\s*(\d+)?",
    re.I,
)


def clean_label(marker):
    """Reduce a transcript marker such as 'Verse 2: Drake' to 'Verse 2'."""
    text = re.sub(r"\s+", " ", marker.split(":")[0]).strip()
    match = SECTION.match(text)
    if not match:
        return "Section"
    family = match.group(1).lower().replace(" ", "-")
    family = {"pre-chorus": "Pre-Chorus", "prechorus": "Pre-Chorus",
              "post-chorus": "Post-Chorus", "postchorus": "Post-Chorus"}.get(family, family.capitalize())
    return f"{family} {match.group(2)}" if match.group(2) else family


def close(a, b, tolerance, what):
    if abs(a - b) > tolerance:
        raise ValueError(f"{what}: {a} != {b}")


def main():
    entries = read("chart_entries")
    songs_table = {row["song_id"]: row for row in read("songs")}
    genres_by_entry = {row["entry_id"]: [g for g in row["genres"].split("|") if g] for row in read("genres")}
    status = {row["song_id"]: row for row in read("emotion/song_status")}
    summary = {row["song_id"]: row for row in read("emotion/song_emotion_summary")}
    annual = {int(row["year"]): row for row in read("emotion/annual_emotion_summary")}
    coverage = {int(row["year"]): row for row in read("analysis_coverage")}
    base_coverage = {int(row["year"]): row for row in read("coverage")}
    audio = {row["entry_id"]: row for row in read("audio_features") if row["status"] == "matched"}
    love_word = {int(row["year"]): row for row in read("lyric_year_words") if row["term"] == "love"}
    vocabulary = {row["song_id"]: row for row in read("lyric_vocabulary")}
    year_words = defaultdict(list)
    for row in read("lyric_year_words"):
        year_words[int(row["year"])].append(row)
    artist_rows = {row["artist_id"]: row for row in read("artists")}
    credits = defaultdict(list)
    for row in read("song_artists"):
        credits[row["song_id"]].append(row["artist_id"])
    fragments = {aid for aid, row in artist_rows.items()
                 if row["name"].strip().lower() in FRAGMENT_NAMES and not row["wikidata_id"]}

    segments = defaultdict(list)
    for row in read("emotion/segment_emotions"):
        segments[row["song_id"]].append(row)

    # Genre vocabulary ordered by total weight across all entries (ties by name).
    weight = Counter()
    for tags in genres_by_entry.values():
        for tag in tags:
            weight[tag] += 1 / len(tags)
    genre_vocab = sorted(weight, key=lambda g: (-weight[g], g))
    genre_index = {g: i for i, g in enumerate(genre_vocab)}

    # Songs that appear on any chart, in a stable order.
    song_ids = sorted({row["song_id"] for row in entries})
    song_index = {sid: i for i, sid in enumerate(song_ids)}
    labels, label_index = [], {}
    # Credited performers, in a stable order, without credit fragments.
    artist_ids = sorted({aid for sid in song_ids for aid in credits[sid]} - fragments)
    artist_index = {aid: i for i, aid in enumerate(artist_ids)}
    artists_out = []
    for aid in artist_ids:
        row = artist_rows[aid]
        place = re.sub(r"\s+,", ",", " ".join(row["place"].split()))
        item = {"n": row["name"], "c": row["country_code"], "p": place, "o": ORIGIN_TYPES[row["origin_type"]]}
        title = re.sub(r"\s*\([^)]*\)$", "", row["wiki_title"])
        if title and title != row["name"]:
            item["w"] = title
        artists_out.append(item)
    songs_out = []
    for sid in song_ids:
        meta = songs_table[sid]
        record = {"id": sid, "t": meta["title"], "a": meta["artist_credit"],
                  "c": [artist_index[aid] for aid in credits[sid] if aid in artist_index]}
        rows = sorted(segments.get(sid, []), key=lambda r: (int(r["section"]), int(r["chunk"])))
        if not rows:
            record["st"] = status[sid]["lyrics_status"]
            songs_out.append(record)
            continue
        codes, ends, marks, sarcasm = [], [], [], []
        derived = Counter()
        previous = 0.0
        for i, row in enumerate(rows):
            start, end = float(row["start_pct"]), float(row["end_pct"])
            if abs(start - previous) > 1e-6:
                raise ValueError(f"Gap in segments for {sid}")
            previous = end
            code = ASTRA[row["astra_primary_emotion"]]
            expected = row["primary_emotion"] or {
                "outside_four_classes": "outside", "insufficient_evidence": "insufficient"
            }[row["four_class_status"]]
            if display(code) != expected:
                raise ValueError(f"Display grouping differs for {sid}: {code} vs {expected}")
            derived[expected] += end - start
            codes.append(code)
            ends.append(round(end * 10))
            if row["section_marker"]:
                label = clean_label(row["section_marker"])
                if label not in label_index:
                    label_index[label] = len(labels)
                    labels.append(label)
                marks.append([i, label_index[label]])
            if row["sarcasm"] == "yes":
                sarcasm.append(i)
        close(previous, 100.0, 1e-6, f"{sid} segment total")
        published = summary[sid]
        for key in SHARES:
            close(derived[key], float(published[SUMMARY_FIELDS[key]]), 1e-4, f"{sid} {key} share")
        record.update({
            "e": "".join(codes),
            "x": ends,
            "p": [round(float(published[SUMMARY_FIELDS[key]]), 2) for key in SHARES],
        })
        if marks:
            record["m"] = marks
        if sarcasm:
            record["z"] = sarcasm
        songs_out.append(record)

    years_out, entries_out = [], defaultdict(list)
    by_year = defaultdict(list)
    for row in entries:
        by_year[int(row["year"])].append(row)

    for year in sorted(by_year):
        rows = sorted(by_year[year], key=lambda r: (int(r["rank"]), r["entry_id"]))
        published = annual[year]
        # Equal-weight average over distinct annotated songs, as in the published summary.
        distinct = sorted({r["song_id"] for r in rows})
        annotated = [summary[s] for s in distinct if s in summary]
        for key in SHARES:
            mean = sum(float(s[SUMMARY_FIELDS[key]]) for s in annotated) / len(annotated)
            close(mean, float(published[SUMMARY_FIELDS[key]]), 1e-4, f"{year} {key} annual share")
        if len(annotated) != int(published["annotated_songs"]) or len(distinct) != int(published["chart_songs"]):
            raise ValueError(f"Song counts differ for {year}")

        shares = Counter()
        for row in rows:
            tags = genres_by_entry[row["entry_id"]]
            for tag in tags:
                shares[tag] += 1 / len(tags)
        close(sum(shares.values()), len(rows), 1e-9, f"{year} genre weights")

        cov = coverage[year]
        annotated_entries = sum(1 for r in rows if r["song_id"] in summary)
        if annotated_entries != int(cov["emotion_annotated_entries"]):
            raise ValueError(f"Annotated entry count differs for {year}")
        # Distinct credited artists and known origins, reconciled with coverage.csv
        # (whose distinct-artist count still includes the credit fragments).
        year_artists = {aid for r in rows for aid in credits[r["song_id"]]}
        base = base_coverage[year]
        known = sum(1 for aid in year_artists if artist_rows[aid]["country_code"])
        if len(year_artists) != int(base["distinct_artists"]) or known != int(base["artists_origin_known"]):
            raise ValueError(f"Artist counts differ for {year}")

        # Lyric language: the annual word export and lyric lengths over the same eligible
        # songs (usable lyrics estimated to be English, each distinct song once).
        eligible = sorted({r["song_id"] for r in rows} & vocabulary.keys())
        words = sorted(year_words[year], key=lambda r: int(r["frequency_rank"]))
        if any(int(w["eligible_songs"]) != len(eligible) for w in words):
            raise ValueError(f"Word-export eligibility differs for {year}")
        lengths = [int(vocabulary[sid]["word_tokens"]) for sid in eligible]
        mattr = [float(vocabulary[sid]["mattr_50"]) for sid in eligible if vocabulary[sid]["mattr_50"]]

        word = love_word.get(year)
        years_out.append({
            "y": year,
            "est": published["chart_kind"] != "billboard_year_end",
            "songs": int(published["chart_songs"]),
            "ann": int(published["annotated_songs"]),
            "entries": len(rows),
            "annEntries": annotated_entries,
            "gaps": {k: int(cov[f"emotion_{k}_entries"]) for k in ("instrumental", "missing", "unverified", "compound")},
            "audio": [int(cov["audio_matched"]), int(cov["audio_unresolved"]), int(cov["audio_not_processed"])],
            "s": [round(float(published[SUMMARY_FIELDS[key]]), 3) for key in SHARES],
            "sarcasm": round(float(published["sarcasm_lyric_pct"]), 3),
            "sarcasmSongs": int(published["songs_with_sarcasm"]),
            "g": {genre_index[g]: round(v / len(rows), 5) for g, v in sorted(shares.items(), key=lambda kv: genre_index[kv[0]])},
            "lex": {
                "n": len(eligible),
                "len": median(lengths),
                "mattr": round(median(mattr), 4),
                "words": [[w["term"], int(w["songs_with_term"]), int(w["occurrences"]),
                           round(float(w["mean_per_1000_words"]) * 1000), int(w["frequency_rank"])] for w in words],
            },
            "loveWord": None if word is None else {
                "rate": round(float(word["mean_per_1000_words"]), 3),
                "songs": int(word["songs_with_term"]),
                "eligible": int(word["eligible_songs"]),
            },
        })
        for row in rows:
            song = songs_table[row["song_id"]]
            entry = [int(row["rank"]), song_index[row["song_id"]], [genre_index[g] for g in genres_by_entry[row["entry_id"]]]]
            extra = {}
            if row["title"] != song["title"]:
                extra["t"] = row["title"]
            if row["artist_credit"] != song["artist_credit"]:
                extra["a"] = row["artist_credit"]
            match = audio.get(row["entry_id"])
            if match:
                extra["sp"] = match["spotify_url"].rsplit("/", 1)[-1]
                extra["au"] = [round(float(match[f]), 3) for f in AUDIO_FIELDS]
            if extra:
                entry.append(extra)
            entries_out[year].append(entry)

    if sum(len(v) for v in entries_out.values()) != len(entries):
        raise ValueError("Entry count changed")
    for item in years_out:
        with_audio = sum(1 for row in entries_out[item["y"]] if len(row) > 3 and "au" in row[3])
        if with_audio != item["audio"][0]:
            raise ValueError(f"Audio matches differ for {item['y']}")

    payload = {
        "meta": {
            "source": "billboard-year-end/data (Hit Atlas unified release)",
            "shares": list(SHARES),
            "astra": {code: name or "insufficient evidence" for name, code in ASTRA.items()},
            "genres": genre_vocab,
            "labels": labels,
            "audioFields": list(AUDIO_FIELDS),
            "originTypes": {"b": "birthplace", "f": "formation place", "o": "documented origin"},
            "excludedArtists": sorted(artist_rows[aid]["name"] for aid in fragments),
            "estimateNote": "2026 ranks are a project estimate from 48 weekly Hot 100 charts through November 28, 2026.",
        },
        "years": years_out,
        "entries": {str(year): rows for year, rows in sorted(entries_out.items())},
        "songs": songs_out,
        "artists": artists_out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    old = OUT.parent / "heart.json"  # earlier name of this file
    if old.exists():
        old.unlink()
    annotated_songs = sum(1 for s in songs_out if "e" in s)
    print(f"{len(years_out)} years, {len(entries)} entries, {len(songs_out)} songs "
          f"({annotated_songs} annotated, {sum(len(s.get('e', '')) for s in songs_out)} segments), "
          f"{len(artists_out)} artists ({len(fragments)} credit fragments left out), "
          f"{len(labels)} section labels -> {OUT.relative_to(ROOT.parent)} ({OUT.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
