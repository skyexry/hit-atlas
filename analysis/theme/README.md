# analysis/theme

按 `lyrics_version_id` 对已核验的整首歌词做主题分类，通过歌曲母表连回榜位。曲名、艺人和榜位作为展示字段。

用本地模型读整首歌词并概括主要内容，按固定题材例子选择一个主主题，再从原文选一行作为候选证据。最后让同一个模型在独立调用中检查那一行及其前后各两行。主题写入结果的条件是行号有效且证据判断通过。其他题材、证据不足和格式错误各有状态。证据行可供网页点回原文。

候选题材为爱情、失恋、自信与野心、庆祝与玩乐、亲友与支持、个人困境、社会议题及其他。具体提示和输出规则在 [classify.py](classify.py)。方法参照固定主题定义、逐曲离线编码以及追加证据验证的思路。网页只读取结果表。 [流行歌词的 LLM 主题编码研究](https://doi.org/10.1177/03057356261465628) · [歌词 LLM 标注稳定性研究](https://arxiv.org/abs/2609.04428)

[试跑结果](lyric_themes_pilot.csv) 使用 256 份已核验歌词，80 份通过本地模型的证据检查，其中 77 份归为爱情。其余 176 份保留判定状态，正式主题为空。这个偏斜集中在试跑模型的结果中，当前表适合检验逐曲主题与证据的连接。做市场或年份分布前，需要检验模型能否稳定区分爱情、失恋等相近类别。

在 Apple Silicon 上使用 `mlx-lm`。模型固定为 [Qwen2.5-1.5B-Instruct-4bit](https://huggingface.co/mlx-community/Qwen2.5-1.5B-Instruct-4bit/tree/8b403126fc14f14cfc99bb4cfa72ecbc129ea677)。执行 `python3 analysis/theme/classify.py --model-path /path/to/pinned-snapshot` 时，脚本逐批保存，重跑时跳过同方法版本的已有行。

工作分支为 `analysis-theme`。[返回项目说明](../../README.md)

## 主题置信等级试验

[lyric_judge.py](../lyric_judge.py) 会以不同选项顺序做两次分类。两次一致时尝试定位原文 `line_id`，再让模型判断这一行及附近歌词能否支持主题。输出记录「证据支持」「仅两次一致」「两次不一致」或「不明确」，表示这一轮复核结果。一致性用于筛选候选，主题准确率需要独立标注的样本衡量。

用 `python3 analysis/lyric_judge.py theme --limit 16 --model-path /path/to/pinned-snapshot --output /tmp/theme_sample.csv` 可复跑分层小样本。

[16 份歌词的试跑](lyric_themes_agreement_pilot.csv) 中，9 份的两次主题选择一致并通过证据核对，另 7 份选择不一致。9 份中有 7 份归为爱情，2 份归为失恋，主题仍集中在少数类别。预览先展示现有词级证据和声音指标。

## 歌词语义相似度

[lyric_similarity.csv](lyric_similarity.csv) 给每份歌词保留五个最近邻，以余弦相似度降序排列。`lyrics_version_id` 指查询的歌词，`similar_lyrics_version_id` 指相近的歌词。两列都可用母表查到对应歌曲。检索跳过同一版本及文本校验值相同的转录。结果可能包含同语种歌曲及同一歌曲的其他转录。

输入原语逐行歌词，按行号排序，完全相同的歌词行保留第一次出现。使用多语言 MiniLM 处理最多 128 个 token 的块（包括边界符），超长单行按模型词元切分。对每块做带掩码的均值池化并归一化，再按块内有效 token 数加权求和、归一化得到全歌 384 维向量。至少 12 个模型 token 才生成结果。向量在离线计算时使用，网页读取已生成的相似度。 [原始模型卡](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) · [ONNX 权重的固定版本](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tree/2c4055b12046f11709e9df2c122e59ffbdc2f900)

本次环境 Python 3.12.5、NumPy 2.5.5、ONNX Runtime 1.32.0、tokenizers 0.23.3。下载上面固定版本的 `onnx/model_int8.onnx` 和 `tokenizer.json` 放在同一目录，再运行 `python3 analysis/theme/lyric_similarity.py --model-path /path/to/model`。两文件 SHA-256 分别为 `d6ea442ff6a891daefed7c83b2f596fc5dc66bf697e4d006236f64f34bbcf4c8` 和 `b60b6b43406a48bf3638526314f3d232d97058bc93472ff2de930d43686fa441`。
