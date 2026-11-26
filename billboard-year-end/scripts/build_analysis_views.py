"""Build view-ready lyric, emotion, and coverage data from the unified release."""

import json
from collections import Counter, defaultdict
from decimal import Decimal
from statistics import mean

from measure_lyrics import BRACKETED, DATA, ROOT, lyric_tokens, read, stop_words, term_metrics, write

EMOTIONS = ("joy", "love", "sadness", "anger", "outside_four_classes", "insufficient_evidence")
SHARE_FIELDS = tuple(f"{name}_pct" for name in EMOTIONS) + ("sarcasm_lyric_pct",)
MATTR_WINDOW = 50


def moving_average_ttr(tokens):
    """Mean type-token ratio over all complete 50-token windows."""
    if len(tokens) < MATTR_WINDOW:
        return ""
    window = Counter(tokens[:MATTR_WINDOW])
    total_types = len(window)
    for outgoing, incoming in zip(tokens, tokens[MATTR_WINDOW:]):
        window[outgoing] -= 1
        if window[outgoing] == 0:
            del window[outgoing]
        window[incoming] += 1
        total_types += len(window)
    return round(total_types / (MATTR_WINDOW * (len(tokens) - MATTR_WINDOW + 1)), 6)


def lexical_data():
    english = {row["song_id"] for row in read("lyric_metrics") if row["estimated_primary_language"] == "en"}
    counts_by_song, vocabulary = {}, []
    postings = defaultdict(list)
    for row in sorted(read("lyrics"), key=lambda row: row["song_id"]):
        song_id = row["song_id"]
        if row["status"] != "usable" or song_id not in english:
            continue
        tokens = lyric_tokens(BRACKETED.sub(" ", row["lyrics"]))
        if not tokens:
            continue
        counts = Counter(tokens)
        counts_by_song[song_id] = counts
        index = len(vocabulary)
        vocabulary.append({
            "song_id": song_id,
            "word_tokens": len(tokens),
            "unique_word_tokens": len(counts),
            "ttr": round(len(counts) / len(tokens), 6),
            "mattr_50": moving_average_ttr(tokens),
        })
        for term, count in counts.items():
            postings[term].extend((index, count))
    word_index = {
        "songs": [[row["song_id"], row["word_tokens"]] for row in vocabulary],
        "terms": dict(sorted(postings.items())),
    }
    return counts_by_song, vocabulary, word_index


def emotion_by_song():
    segments = defaultdict(list)
    for row in read("emotion/segment_emotions"):
        segments[row["song_id"]].append(row)
    status = {row["song_id"]: row for row in read("emotion/song_status")}
    expected_counts = {
        sid: int(row["annotated_chunks"]) for sid, row in status.items() if row["annotation_status"] == "annotated"
    }
    if {sid: len(rows) for sid, rows in segments.items()} != expected_counts:
        raise ValueError("Emotion segments disagree with song annotation status")

    results = {}
    for song_id, rows in sorted(segments.items()):
        rows.sort(key=lambda row: (int(row["section"]), int(row["chunk"])))
        keys = {(row["section"], row["chunk"]) for row in rows}
        if len(keys) != len(rows):
            raise ValueError(f"Duplicate segment for {song_id}")
        shares = dict.fromkeys(EMOTIONS, Decimal(0))
        sarcasm_chunks = 0
        sarcasm_span = Decimal(0)
        previous_end = Decimal(0)
        for row in rows:
            start, end = Decimal(row["start_pct"]), Decimal(row["end_pct"])
            if start != previous_end or not start < end <= 100:
                raise ValueError(f"Invalid segment boundaries for {song_id}")
            previous_end = end
            category = row["primary_emotion"] or row["four_class_status"]
            shares[category] += end - start
            if row["sarcasm"] == "yes":
                sarcasm_chunks += 1
                sarcasm_span += end - start
        if previous_end != 100:
            raise ValueError(f"Incomplete segments for {song_id}")
        results[song_id] = {
            "song_id": song_id,
            "segments": len(rows),
            **{f"{key}_pct": float(value) for key, value in shares.items()},
            "sarcasm_chunks": sarcasm_chunks,
            "sarcasm_lyric_pct": float(sarcasm_span),
        }
    return results, status


def annual_views(entries_by_year, songs, song_status, word_counts):
    keywords, emotions, coverage = [], [], []
    base_coverage = {row["year"]: row for row in read("coverage")}
    audio = {row["entry_id"]: row["status"] for row in read("audio_features")}
    artists = {row["artist_id"]: row["country_code"] for row in read("artists")}
    credits = defaultdict(set)
    for row in read("song_artists"):
        credits[row["song_id"]].add(row["artist_id"])
    geojson = json.loads((ROOT / "site/world.geojson").read_text(encoding="utf-8"))
    map_codes = {feature["properties"]["code"] for feature in geojson["features"]}
    stop = stop_words()
    for year, entries in sorted(entries_by_year.items()):
        year_fields = {"year": year, "chart_kind": entries[0]["chart_kind"]}
        song_ids = {row["song_id"] for row in entries}
        yearly_songs = [songs[sid] for sid in sorted(song_ids & songs.keys())]
        english_songs = song_ids & word_counts.keys()
        for term in term_metrics(year, {"All genres": english_songs}, word_counts, stop, top_words=60):
            keywords.append({
                **year_fields,
                "term": term["term"],
                "eligible_songs": term["eligible_songs"],
                "songs_with_term": term["songs_with_term"],
                "occurrences": term["occurrences"],
                "mean_per_1000_words": term["mean_per_1000_words"],
                "frequency_rank": term["frequency_rank"],
            })
        emotions.append({
            **year_fields,
            "chart_songs": len(song_ids),
            "annotated_songs": len(yearly_songs),
            **{field: round(mean(row[field] for row in yearly_songs), 6) if yearly_songs else ""
               for field in SHARE_FIELDS},
            "songs_with_sarcasm": sum(row["sarcasm_chunks"] > 0 for row in yearly_songs),
            "sarcasm_chunks": sum(row["sarcasm_chunks"] for row in yearly_songs),
        })

        origin_codes = [artists[aid] for aid in set().union(*(credits[sid] for sid in song_ids))]
        audio_status = Counter(audio.get(row["entry_id"], "not_processed") for row in entries)
        emotion_status = Counter(
            "annotated" if row["song_id"] in songs else song_status[row["song_id"]]["lyrics_status"]
            for row in entries
        )
        coverage_row = {
            **year_fields,
            "chart_entries": len(entries),
            "english_keyword_eligible_entries": sum(row["song_id"] in word_counts for row in entries),
            "emotion_annotated_entries": emotion_status["annotated"],
            **{f"emotion_{key}_entries": emotion_status[key]
               for key in ("instrumental", "missing", "unverified", "compound")},
            "distinct_artists": len(origin_codes),
            "artists_origin_mappable": sum(code in map_codes for code in origin_codes if code),
            "artists_origin_outside_basemap": sum(code not in map_codes for code in origin_codes if code),
            "artists_origin_unknown": origin_codes.count(""),
            "audio_matched": audio_status["matched"],
            "audio_unresolved": audio_status["unresolved"],
            "audio_not_processed": audio_status["not_processed"],
        }
        baseline = base_coverage[year]
        if (
            sum(coverage_row[f"emotion_{key}_entries"]
                for key in ("annotated", "instrumental", "missing", "unverified", "compound")) != len(entries)
            or sum(coverage_row[f"audio_{key}"] for key in ("matched", "unresolved", "not_processed")) != len(entries)
            or coverage_row["audio_matched"] != int(baseline["audio_matched"])
            or coverage_row["audio_matched"] + coverage_row["audio_unresolved"] != int(baseline["audio_eligible"])
            or len(origin_codes) - origin_codes.count("") != int(baseline["artists_origin_known"])
        ):
            raise ValueError(f"Coverage totals do not reconcile for {year}")
        coverage.append(coverage_row)
    return keywords, emotions, coverage


def main():
    entries_by_year = defaultdict(list)
    for row in read("chart_entries"):
        entries_by_year[row["year"]].append(row)
    word_counts, vocabulary, word_index = lexical_data()
    song_emotions, song_status = emotion_by_song()
    keywords, annual_emotions, coverage = annual_views(entries_by_year, song_emotions, song_status, word_counts)
    write(DATA / "lyric_vocabulary.csv", vocabulary)
    write(DATA / "lyric_year_words.csv", keywords)
    write(DATA / "emotion/song_emotion_summary.csv", list(song_emotions.values()))
    write(DATA / "emotion/annual_emotion_summary.csv", annual_emotions)
    write(DATA / "analysis_coverage.csv", coverage)
    (DATA / "lyric_term_index.json").write_text(
        json.dumps(word_index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print(f"{len(vocabulary):,} vocabulary rows, {len(keywords):,} annual keyword rows, "
          f"{len(word_index['terms']):,} indexed terms, {len(song_emotions):,} song emotion rows, "
          f"{len(annual_emotions)} annual emotion rows, {len(coverage)} annual coverage rows")


if __name__ == "__main__":
    main()
