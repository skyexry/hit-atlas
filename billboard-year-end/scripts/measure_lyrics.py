"""Build lyric metrics for published Billboard year-end charts."""

import argparse
import csv
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BRACKETED = re.compile(r"\[[^\]\n]{0,200}\]")
WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)*")
TOP_WORDS = 20
MIN_SONGS_PER_TERM = 2


def read(table):
    with (DATA / f"{table}.csv").open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def write(path, rows):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def stop_words():
    # Reuse the vocabulary exclusions from the existing keyword demo.
    demo = (ROOT / "demos/lyric-words-demo/index.html").read_text(encoding="utf-8")
    definition = re.search(r"const stop=new Set\(\((.*?)\)\.split", demo, re.S)
    if definition is None:
        raise ValueError("Could not find the keyword demo's stopword list")
    pieces = re.findall(r'"([^"]*)"', definition.group(1))
    return set("".join(pieces).split())


def lyric_tokens(cleaned):
    normalized = unicodedata.normalize("NFKC", cleaned).lower().replace("’", "'")
    return WORD.findall(normalized)


def song_metrics(raw, analyzer):
    cleaned = " ".join(BRACKETED.sub(" ", raw).split())
    counts = Counter(lyric_tokens(cleaned))
    total = sum(counts.values())
    if not total:
        return counts, {}
    return counts, {
        "word_tokens": total,
        "unique_word_tokens": len(counts),
        "ttr": round(len(counts) / total, 6),
        "vader_compound": analyzer.polarity_scores(cleaned)["compound"],
    }


def term_metrics(period, groups, song_counts, stop, top_words=TOP_WORDS):
    documents = {}
    for genre, song_ids in sorted(groups.items()):
        counts, prevalence, rates = Counter(), Counter(), Counter()
        for sid in sorted(song_ids):
            words = song_counts[sid]
            total = sum(words.values())
            for term, count in words.items():
                if term not in stop and len(term) >= 2:
                    counts[term] += count
                    prevalence[term] += 1
                    rates[term] += 1000 * count / total / len(song_ids)
        documents[genre] = counts, prevalence, rates

    # The all-genres view is a frequency summary and is outside the IDF corpus.
    df = Counter(
        term for genre, (counts, _, _) in documents.items()
        if genre != "All genres" for term in counts
    )
    genre_count = len(documents) - 1
    for genre, (counts, prevalence, rates) in documents.items():
        candidates = [term for term in counts if prevalence[term] >= MIN_SONGS_PER_TERM]
        common = sorted(candidates, key=lambda term: (-rates[term], term))[:top_words]
        tokens = sum(counts.values())
        scores = {
            term: counts[term] / tokens * (math.log((1 + genre_count) / (1 + df[term])) + 1)
            for term in candidates if genre != "All genres" and genre_count > 1
        }
        distinct = sorted(scores, key=lambda term: (-scores[term], term))[:top_words]
        frequency_ranks = {term: rank for rank, term in enumerate(common, 1)}
        tfidf_ranks = {term: rank for rank, term in enumerate(distinct, 1)}
        for term in dict.fromkeys(common + distinct):
            yield {
                "period": period, "genre": genre, "term": term,
                "eligible_songs": len(groups[genre]), "songs_with_term": prevalence[term],
                "occurrences": counts[term], "mean_per_1000_words": round(rates[term], 6),
                "frequency_rank": frequency_ranks.get(term, ""),
                "tfidf": round(scores[term], 9) if term in tfidf_ranks else "",
                "tfidf_rank": tfidf_ranks.get(term, ""),
            }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=1959)
    parser.add_argument("--end", type=int, default=2026)
    parser.add_argument("--include-estimates", action="store_true")
    args = parser.parse_args()
    entries = [
        row for row in read("chart_entries")
        if args.start <= int(row["year"]) <= args.end
        and (args.include_estimates or row["chart_kind"] == "billboard_year_end")
    ]
    if not entries:
        parser.error("No published year-end chart entries in the selected range")
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

    language = {row["song_id"]: row["estimated_primary_language"] for row in read("lyric_metrics")}
    lyrics = {row["song_id"]: row for row in read("lyrics")}
    genres = {row["entry_id"]: row["genres"].split("|") for row in read("genres")}
    analyzer = SentimentIntensityAnalyzer()
    song_counts, computed = {}, {}
    for sid in sorted({row["song_id"] for row in entries}):
        lyric = lyrics[sid]
        if lyric["status"] == "usable" and language[sid] == "en":
            counts, metrics = song_metrics(lyric["lyrics"], analyzer)
            if metrics:
                song_counts[sid] = counts
                computed[sid] = metrics

    if not computed:
        parser.error("No usable English lyrics in the selected range")
    empty_metrics = dict.fromkeys(next(iter(computed.values())), "")
    chart_metrics = []
    periods = defaultdict(lambda: defaultdict(set))
    period_all = f"{min(int(row['year']) for row in entries)}-{max(int(row['year']) for row in entries)}"
    published_years = {int(row["year"]) for row in entries if row["chart_kind"] == "billboard_year_end"}
    published_period = f"{min(published_years)}-{max(published_years)}" if published_years else ""
    for row in entries:
        year, sid = row["year"], row["song_id"]
        fields = {key: row[key] for key in ("entry_id", "year", "rank", "song_id", "title", "artist_credit")}
        if args.include_estimates:
            fields["chart_kind"] = row["chart_kind"]
        metrics = computed.get(sid, empty_metrics)
        chart_metrics.append({
            **fields, "lyrics_status": lyrics[sid]["status"], "estimated_primary_language": language[sid],
            "genres": "|".join(genres[row["entry_id"]]), **metrics,
        })
        if sid in computed:
            pooled_period = (published_period,) if row["chart_kind"] == "billboard_year_end" else ()
            for period in dict.fromkeys((year, *pooled_period)):
                for genre in ["All genres", *filter(None, genres[row["entry_id"]])]:
                    periods[period][genre].add(sid)

    stop = stop_words()
    terms = [row for period in sorted(periods) for row in term_metrics(period, periods[period], song_counts, stop)]
    write(DATA / f"lyric_features_{period_all}.csv", chart_metrics)
    if terms:
        write(DATA / f"lyric_keywords_{period_all}.csv", terms)
    print(f"{len(entries)} chart entries, {len(computed)} scored songs, {len(terms)} keyword rows")


if __name__ == "__main__":
    main()
