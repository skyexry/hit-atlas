"""Create a short list of semantically similar lyrics for each lyric version."""

import argparse
import csv
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

LYRICS = Path(__file__).resolve().parents[2] / "spotify-base-dataset/songs-and-lyrics/lyric-lines.csv"
REVISION = "2c4055b12046f11709e9df2c122e59ffbdc2f900"
METHOD = "multilingual-minilm-l12-int8-lyrics-v1"
LIMIT = 128


def chunks(rows, tokenizer, limit):
    pending = []
    seen = set()
    for row in rows:
        line = row["line_text"].strip()
        if not line or line in seen:
            continue
        seen.add(line)
        pieces = tokenizer.encode(line, add_special_tokens=False).ids
        if len(pending) + len(pieces) > limit and pending:
            yield pending
            pending = []
        while len(pieces) > limit:
            yield pieces[:limit]
            pieces = pieces[limit:]
        pending.extend(pieces)
    if pending:
        yield pending


def normalized(vectors):
    return vectors / np.maximum(np.linalg.norm(vectors, axis=-1, keepdims=True), 1e-12)


def read_lyrics():
    grouped = defaultdict(list)
    with LYRICS.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            grouped[row["lyrics_version_id"]].append(row)
    for rows in grouped.values():
        rows.sort(key=lambda row: int(row["line_no"]))
    return grouped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "lyric_similarity.csv")
    args = parser.parse_args()
    lyrics = read_lyrics()
    tokenizer = Tokenizer.from_file(str(args.model_path / "tokenizer.json"))
    start, end, pad = (tokenizer.token_to_id(t) for t in ("<s>", "</s>", "<pad>"))
    assert None not in (start, end, pad)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 6
    model = ort.InferenceSession(str(args.model_path / "model_int8.onnx"), sess_options=options,
                                 providers=["CPUExecutionProvider"])
    input_names = {value.name for value in model.get_inputs()}
    versions = sorted(lyrics)
    prepared = []
    for index, version in enumerate(versions):
        prepared.extend((index, part) for part in chunks(lyrics[version], tokenizer, LIMIT - 2))
    prepared.sort(key=lambda entry: len(entry[1]))
    vectors = np.zeros((len(versions), 384), dtype=np.float32)
    total_tokens = np.zeros(len(versions), dtype=np.int32)
    batch_size = 40
    for offset in range(0, len(prepared), batch_size):
        batch = prepared[offset:offset + batch_size]
        width = max(len(part) + 2 for _, part in batch)
        ids = np.full((len(batch), width), pad, dtype=np.int64)
        mask = np.zeros_like(ids)
        for row, (_, part) in enumerate(batch):
            ids[row, :len(part) + 2] = [start, *part, end]
            mask[row, :len(part) + 2] = 1
        values = {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)}
        output = model.run(["last_hidden_state"], {name: values[name] for name in input_names})[0]
        pooled = normalized((output * mask[..., None]).sum(axis=1) / mask.sum(axis=1)[:, None])
        for row, (index, part) in enumerate(batch):
            vectors[index] += pooled[row] * len(part)
            total_tokens[index] += len(part)
        if offset % (batch_size * 50) == 0:
            print(f"Embedded {offset + len(batch)}/{len(prepared)} chunks", flush=True)

    keep = np.flatnonzero(total_tokens >= 12)
    vectors = normalized(vectors[keep])
    assert np.all(np.isfinite(vectors)) and np.allclose(np.linalg.norm(vectors, axis=1), 1)
    scores = np.clip(vectors @ vectors.T, -1, 1)
    np.fill_diagonal(scores, -np.inf)
    with LYRICS.with_name("lyric-versions.csv").open(encoding="utf-8-sig", newline="") as handle:
        checksums = {row["lyrics_version_id"]: row["text_sha256"] for row in csv.DictReader(handle)}
    equivalent = defaultdict(list)
    for index, original_index in enumerate(keep):
        equivalent[checksums[versions[original_index]]].append(index)
    for group in equivalent.values():
        scores[np.ix_(group, group)] = -np.inf
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["lyrics_version_id", "similar_lyrics_version_id", "rank", "cosine_similarity",
                         "input_model_tokens", "method_version", "model_revision"])
        for index, neighbors in enumerate(np.argsort(-scores, axis=1, kind="stable")[:, :5]):
            for rank, neighbor in enumerate(neighbors, 1):
                assert np.isfinite(scores[index, neighbor])
                writer.writerow([versions[keep[index]], versions[keep[neighbor]], rank,
                                 f"{scores[index, neighbor]:.6f}", total_tokens[keep[index]], METHOD, REVISION])
    print(f"Exported neighbors for {len(keep)}/{len(versions)} lyric versions", flush=True)


if __name__ == "__main__":
    main()
