"""Rebuild the song and chart-position denominators used in the visualization inventory."""

import csv
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "Spotify基础数据集"
LYRICS = DATA / "歌曲与歌词"
ANALYSIS = ROOT / "analysis"
AUDIO = "tempo_bpm energy danceability loudness_db acousticness audio_valence instrumentalness speechiness liveness".split()
EMOTIONS = "anger anticipation disgust fear joy sadness surprise trust".split()


def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def covered(rows, key, predicate):
    return {row[key] for row in rows if row[key] and predicate(row)}


def coverage_sets(songs):
    lines = read(LYRICS / "逐行歌词.csv")
    lyric_with_lines = {r["lyrics_version_id"] for r in lines if r["line_text"].strip()}
    line_version = {r["line_id"]: r["lyrics_version_id"] for r in lines}
    evidence = read(ANALYSIS / "emotion/lyric_emotion_tokens.csv")
    scores = read(ANALYSIS / "emotion/lyric_emotions.csv")
    audio = read(DATA / "音乐特征/song_audio_features.csv")
    recco = read(ANALYSIS / "song_audio_reccobeats.csv")
    pmemo = read(ANALYSIS / "song_listener_ratings.csv")
    pmemo_axes = {m: covered(pmemo, "song_id", lambda r: r["metric_id"] == m and r["value_raw"] != "")
                  for m in ("pmemo_arousal", "pmemo_valence")}

    def via_lyric(versions):
        return covered(songs, "song_id", lambda r: r["lyrics_version_id"] in versions)

    features = {
        "catalogue_metadata": covered(songs, "song_id", lambda r: all(r[k] for k in ("title", "artist", "spotify_id", "duration_s"))),
        "lyrics_lines": via_lyric(lyric_with_lines),
        "lyrics_confirmed": covered(read(LYRICS / "歌词匹配.csv"), "song_id", lambda r: r["lyrics_status"] == "元数据匹配已确认"),
        "lyrics_primary_language": via_lyric(covered(scores, "lyrics_version_id", lambda r:
            r["language"] not in {"", "und"} and float(r["language_confidence"]) >= 0.60)),
        "lyrics_emotion": via_lyric(covered(scores, "lyrics_version_id", lambda r: r["emotion_status"] == "scored")),
        "lyrics_token_highlight": via_lyric({line_version[r["line_id"]] for r in evidence}),
        "lyrics_repeat": via_lyric(covered(read(ANALYSIS / "repetition/lyric_repetition.csv"), "lyrics_version_id", lambda r: r["repeat_lz_ratio"] != "")),
        "audio_preferred_9": covered(audio, "song_id", lambda r: all(r[k] for k in AUDIO)),
        "audio_recco_9": covered(recco, "song_id", lambda r: all(r[k] for k in AUDIO)),
        "audio_key_mode": covered(audio, "song_id", lambda r: r["key"] in {str(i) for i in range(12)} and r["mode"] in {"0", "1"}),
        "audio_time_signature": covered(audio, "song_id", lambda r: r["time_signature"] in {"3", "4", "5", "6", "7"}),
        "pmemo_chorus_both_axes": set.intersection(*pmemo_axes.values()),
        "lyrics_theme_pilot": via_lyric(covered(read(ANALYSIS / "theme/lyric_themes_pilot.csv"), "lyrics_version_id", lambda r: r["status"] == "model_supported")),
    }
    for emotion in EMOTIONS:
        versions = {line_version[r["line_id"]] for r in evidence if emotion in r["emotions"].split("|")}
        features[f"lyrics_highlight_{emotion}"] = via_lyric(versions)
    for metric in AUDIO:
        features[f"audio_spotify_{metric}"] = covered(audio, "song_id", lambda r: r[metric] != "" and
            r["feature_method"] == "Spotify Audio Features" and metric not in r["reccobeats_fields"].split("|"))
    similarities = ANALYSIS / "theme/lyric_similarity.csv"
    features["lyrics_semantic_similarity"] = via_lyric(covered(read(similarities), "lyrics_version_id",
        lambda r: r["rank"] == "1")) if similarities.exists() else set()
    return features


def main():
    songs = read(LYRICS / "歌曲母表.csv")
    chart = read(LYRICS / "榜位对应.csv")
    song_ids = {row["song_id"] for row in songs}
    assert len(song_ids) == len(songs)
    assert all(r["song_id"] in song_ids for r in chart)
    groups = defaultdict(list)
    groups["master", "", "", "song"] = songs
    for row in chart:
        year, market = row["year"], row["market"]
        groups["all_chart_positions", "", "", "position"].append(row)
        if market == "Global" and row["analysis_set"] == "主样本" and "2017" <= year <= "2026":
            groups["global_top50", "", "", "position"].append(row)
            groups["global_top50", year, market, "position"].append(row)
            if year >= "2024":
                groups["global_recent_top50", "", "", "position"].append(row)
        if row["source_file"] == "地区同期Top50_2024-2026.csv":
            groups["regional_ytd_top50", "", "", "position"].append(row)
            groups["regional_ytd_top50", year, "", "position"].append(row)
            groups["regional_ytd_top50", year, market, "position"].append(row)
        if row["source_file"] == "榜单明细.csv" and market != "Global":
            groups["regional_annual_or_historical", year, market, "position"].append(row)

    # A repeated song counts once in the master and once per chart position elsewhere.
    with (ANALYSIS / "visualization_coverage.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["scope", "year", "market", "unit", "feature_id", "covered", "total", "coverage"])
        features = coverage_sets(songs)
        for (scope, year, market, unit), rows in sorted(groups.items()):
            total = len(rows)
            if unit == "position":
                writer.writerow([scope, year, market, unit, "chart_position", total, total, "1.000000"])
                for field in ("observed_weekly_top200_streams", "observed_daily_chart_streams"):
                    count = sum(bool(row[field]) for row in rows)
                    writer.writerow([scope, year, market, unit, field, count, total, f"{count/total:.6f}"])
            for feature, valid in features.items():
                count = sum(row["song_id"] in valid for row in rows)
                writer.writerow([scope, year, market, unit, feature, count, total, f"{count/total:.6f}"])


if __name__ == "__main__":
    main()
