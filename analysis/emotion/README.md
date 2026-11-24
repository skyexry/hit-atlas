# 歌词情绪与词级高亮

保存情绪分析脚本与结果。歌曲得分使用 song_id 和 lyrics_version_id；逐词贡献使用 line_id 和词在行内的位置。

工作分支为 `analysis-emotion`。[返回项目说明](../../README.md)
## 输出

- [`lyric_emotions.csv`](lyric_emotions.csv) 每份歌词一行，按 `lyrics_version_id` 连歌曲母表。包含主语种、识别置信度、分母 `word_count`、查到词条的次数 `lexicon_words`、词典覆盖率 `lex_coverage`、情绪状态和八类命中数及每百词词次率。
- [`lyric_emotion_tokens.csv`](lyric_emotion_tokens.csv) 每行是一个命中一种或多种情绪的词位置，按 `line_id` 连逐行歌词。`start_char` 从 0 起，`end_char` 为排他终点，单位为 Unicode 码点。网页用 `Array.from(line_text).slice(start_char, end_char)` 取原文。`emotions` 用 `|` 连接。副歌重复出现时，每个位置单独计数。

## 计算

1. 按 `line_no` 连起同一份歌词，使用 macOS NaturalLanguage 识别整份歌词的主语种。`NLTokenizer` 根据该语种逐行分词，保留包含 Unicode 字母的词次。匹配前做 NFKC、大小写折叠和撇号归一化。分母包含所有符合规则的词次，含功能词和在词典中未查到的词。
2. 从 NRC EmoLex v0.92 的 2022 年多语种文件取八类二元标记。多个词条翻译成同一个词时，每个情绪按严格多数决定。置信度至少 0.60、有至少 12 个词次且至少 3 个词次查到词条时才出分；其他状态保留在歌级表。查到中性词也计入词典覆盖。
3. 每类分数为 `100 × 命中该类的词次 ÷ word_count`。同一个词可以命中多类。选中某个情绪后，高亮表里该类的每个位置贡献 `100 / word_count` 分。分数为 0 表示该类命中数为 0，空白表示该版本缺少分数。词典关联衡量情绪用词，跨市场优先在同一种歌词语言内比较并展示 `lex_coverage`。

非英语词表由英文机器翻译而来。混合语歌词统一使用整首的主语种词表，俚语、否定、反讽和语境可能影响匹配。`nrc092-2022-nltokenizer-word-v2` 增加了 `pa-Guru` 到 NRC Punjabi 词表的映射，为一份原有歌词补上分数和三个词位置。其余版本的数值与位置通过重跑比对。 [NRC EmoLex 作者说明](https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm) · [Apple NLTokenizer](https://developer.apple.com/documentation/naturallanguage/nltokenizer)

## 质量检查

- **位置与计算。** 全部 53,679 条词位置都能回指原文，`line_id + token_index` 唯一，按版本和情绪重新数词次可复现八项命中数与词次率。
- **词典覆盖。** 有分数的 2,742 份歌词中，单首歌曲的词典覆盖率中位数为 18.6%。英语为 19.3%，繁体中文为 24.0%，印尼语为 3.5%。在判为印尼语且有分数的 88 份版本里，44 份至少有一处情绪词可高亮。`lex_coverage` 统计查到词条的比例，包含词典中的中性词。分数为 0 且有 `scored` 状态时，前端可显示「该维度无词典命中」。空白分数则显示对应的语言或词典状态。
- **语境抽查。** 繁体「孤獨」作为独立词命中悲伤标签 5 次。「快樂」命中快乐标签 30 次，其中 7 次的前方紧接「不」「没有」或「别」等否定字样。这是词典标签沿用词义、缺少句内语境处理的可见例子，数字用于说明局限，语境分类精确率需要人工标注样本来估算。
- **图表解读。** 图表标题使用「悲伤相关词次率」等措辞，词级提示说明关联来自 NRC。跨市场比较优先控制歌词语种，同时显示有效样本数与词典覆盖。需要对照歌词版本时，使用 `歌词匹配.csv` 的状态。本轮复核前后，全球 2024 年和 2025 年的可评分样本仍分别为 48 和 47 个榜位，已核对文本子样本为 12 和 20 个榜位，两样本给出不同的悲伤词次率变化方向。 [榜单与歌词质量覆盖](../../docs/visualization-data.md)

## 复跑

下载作者归档 `NRC-Emotion-Lexicon.zip` 并遵循其使用条款。输入归档的 SHA-256 是 `4edcbd00b1d38ace19ecebca17a50ce08719785b9476cd12d31532eff0fc34e6`。本次使用 macOS 26.6.2、Swift 6.0.3。 [作者原始下载](https://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip)

```bash
swiftc -O analysis/emotion/tokenize.swift -o /tmp/hit-atlas-tokenize
python3 analysis/emotion/score.py --tokenizer /tmp/hit-atlas-tokenize --nrc /path/to/NRC-Emotion-Lexicon.zip
```

## 语境提示与新找到的歌词来源

一次词在歌词中出现两遍，就计两个词次。「词典覆盖」是查到任何词条的词次除以该歌词纳入计算的全部词次。查到中性词也计入覆盖；八条情绪轴分别用该类命中词次除以同一个分母。它们可以汇总成整首歌词的八维词汇情绪分数，也可以由此解释原文中的具体贡献。

[`lyric_negation_flags.csv`](lyric_negation_flags.csv) 用 `line_id + token_index` 标出英语、繁简中文中 1,066 个紧邻否定提示的命中位置。预览用虚线标记这些词，保留原始命中计数。可用 `python3 analysis/emotion/context_cues.py` 复跑。单看邻近字样有歧义，也会漏掉范围更长的否定。

[`context_pilot.csv`](context_pilot.csv) 记录本地 Qwen2.5 1.5B 在上下文里的词义判断。每个实例换顺序问两次，保存两次结论和一致性。12 个事先设定答案的例子只有 3 个得到两个正确且一致的判断。该模型当前用于探索局部语境，公开的八维分数仍用同一份可复现词典规则。复跑 `python3 analysis/lyric_judge.py emotion --model-path /path/to/pinned-snapshot --output /tmp/context_pilot.csv`。

[`recovered_lyric_scores.csv`](recovered_lyric_scores.csv) 保存新查到的《Bella Ciao (HUGEL Remix)》和《B4 B4》的八维得分及 LRCLIB 记录号。复跑时按表中两个 API 地址下载 JSON，分别命名为 `4225045.json` 和 `37558619.json`，运行 `python3 analysis/emotion/recover_scores.py --tokenizer /tmp/hit-atlas-tokenize --nrc /path/to/NRC-Emotion-Lexicon.zip --raw-cache /path/to/json`。该补充表保存来源和分析得分，主歌词表的逐行原文覆盖单独统计。
