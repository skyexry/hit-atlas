"""Score lyric word occurrences against NRC EmoLex and retain their positions."""

import argparse
import csv
import io
import json
import subprocess
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


DATA = Path(__file__).resolve().parents[2] / "spotify-base-dataset/songs-and-lyrics"
EMOTIONS = ("anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust")
LANGUAGES = {
    "af": "Afrikaans", "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali",
    "ca": "Catalan", "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "en": "English Word", "es": "Spanish", "et": "Estonian", "fa": "Persian",
    "fi": "Finnish", "fil": "Filipino", "fr": "French", "he": "Hebrew", "hi": "Hindi",
    "hr": "Croatian", "hu": "Hungarian", "id": "Indonesian", "it": "Italian",
    "ja": "Japanese", "ko": "Korean", "lt": "Lithuanian", "lv": "Latvian",
    "ms": "Malay", "nb": "Norwegian", "nl": "Dutch", "no": "Norwegian",
    "pa-Guru": "Punjabi",
    "pl": "Polish", "pt": "Portuguese", "ro": "Romanian", "ru": "Russian",
    "sk": "Slovak", "sv": "Swedish", "sw": "Swahili", "th": "Thai",
    "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu", "vi": "Vietnamese",
    "zh-Hans": "Chinese-Simplified", "zh-Hant": "Chinese-Traditional",
}
METHOD = "nrc092-2022-nltokenizer-word-v2"


def normalize(word):
    return unicodedata.normalize("NFKC", word).casefold().replace("’", "'").strip()


def lexicons(archive, languages):
    votes = {lang: defaultdict(Counter) for lang in languages if lang in LANGUAGES}
    with ZipFile(archive) as source:
        with io.TextIOWrapper(source.open("NRC-Emotion-Lexicon/NRC-Emotion-Lexicon-ForVariousLanguages.txt"),
                              encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                positive = [emotion for emotion in EMOTIONS if row[emotion] == "1"]
                for lang, terms in votes.items():
                    word = normalize(row.get(LANGUAGES[lang]) or "")
                    if word:
                        terms[word].update(("entries", *positive))
    return {
        lang: {word: tuple(e for e in EMOTIONS if counts[e] * 2 > counts["entries"])
               for word, counts in terms.items()} for lang, terms in votes.items()
    }


def read_lyrics():
    grouped = defaultdict(list)
    with (DATA / "lyric-lines.csv").open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            grouped[row["lyrics_version_id"]].append(row)
    for rows in grouped.values():
        rows.sort(key=lambda row: int(row["line_no"]))
    return grouped


def export(tokenized, grouped, dictionaries, output):
    with (output / "lyric_emotions.csv").open("w", encoding="utf-8", newline="") as scores, \
         (output / "lyric_emotion_tokens.csv").open("w", encoding="utf-8", newline="") as evidence:
        score_writer = csv.writer(scores, lineterminator="\n")
        evidence_writer = csv.writer(evidence, lineterminator="\n")
        score_writer.writerow(["lyrics_version_id", "language", "language_confidence",
            "word_count", "lexicon_words", "lex_coverage", "emotion_status", "method_version",
            *[f"{e}_hits" for e in EMOTIONS], *[f"{e}_rate" for e in EMOTIONS]])
        evidence_writer.writerow(["line_id", "token_index", "start_char", "end_char", "emotions"])

        for record in tokenized:
            version, lang, confidence = record["version"], record["language"], record["confidence"]
            dictionary = dictionaries.get(lang, {})
            tokens = []
            for original, words in zip(grouped[version], record["lines"], strict=True):
                for index, token in enumerate(words):
                    word = normalize(token["word"])
                    if any(ch.isalpha() for ch in word):
                        assert original["line_text"][token["start"]:token["end"]] == token["word"]
                        tokens.append((original["line_id"], index, token, word))
            denominator = len(tokens)
            in_dictionary = sum(word in dictionary for _, _, _, word in tokens)
            status = ("uncertain_language" if confidence < 0.60 else "language_unavailable" if not dictionary
                      else "insufficient_words" if denominator < 12 or in_dictionary < 3 else "scored")
            hits = Counter()
            if status == "scored":
                for line_id, index, token, word in tokens:
                    emotions = dictionary.get(word, ())
                    if emotions:
                        hits.update(emotions)
                        evidence_writer.writerow([line_id, index, token["start"], token["end"], "|".join(emotions)])
            score_writer.writerow([version, lang, f"{confidence:.6f}", denominator, in_dictionary,
                f"{in_dictionary / denominator:.8f}" if denominator else "", status, METHOD,
                *[hits[e] if status == "scored" else "" for e in EMOTIONS],
                *[f"{100 * hits[e] / denominator:.8f}" if status == "scored" else "" for e in EMOTIONS]])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tokenizer", required=True, type=Path)
    parser.add_argument("--nrc", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()
    grouped = read_lyrics()
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        raw = Path(work) / "lyrics.jsonl"
        parsed = Path(work) / "tokens.jsonl"
        with raw.open("w", encoding="utf-8") as handle:
            for version, rows in grouped.items():
                handle.write(json.dumps({"version": version, "lines": [r["line_text"] for r in rows]},
                                       ensure_ascii=False) + "\n")
        with raw.open("rb") as source, parsed.open("wb") as result:
            subprocess.run([args.tokenizer.resolve()], stdin=source, stdout=result, check=True)
        with parsed.open(encoding="utf-8") as handle:
            tokenized = [json.loads(line) for line in handle]
    assert set(grouped) == {row["version"] for row in tokenized}
    dictionaries = lexicons(args.nrc, {row["language"] for row in tokenized})
    export(tokenized, grouped, dictionaries, args.output)


if __name__ == "__main__":
    main()
