# Hit Atlas 可视化数据与覆盖

全球、地区和歌手入口都从榜位开始。点开一条榜位后，通过 `song_id` 取歌曲、录音特征和人工听感。歌词通过母表中的 `lyrics_version_id` 连接原文与分析结果。点选情绪，再用 `line_id` 定位原词。

## 主视图使用哪些数据

「母表」按 2,963 条项目歌曲计数。三个榜单列按榜位计数，同一首歌跨年或跨市场会在多个榜位中出现。近三年指 2024–2026 年。地区同期榜的三个年度分别有 20、25、24 个市场，每份榜 50 首。页面的地区入口共 27 个，实际可选年份和榜单类型跟随 [地区年份入口.csv](../Spotify基础数据集/地区年份入口.csv)。

| 视图与信息 | 由哪张表提供，怎么连 | 母表 | 全球 2017–2026 | 全球近三年 | 地区近三年同期 |
|---|---|---:|---:|---:|---:|
| 榜单、市场、年份、名次、榜单原始艺人署名 | [榜位对应.csv](../Spotify基础数据集/歌曲与歌词/榜位对应.csv)，`song_id` 连歌曲。歌手入口可先用母表的显示署名搜索，再回到该歌曲的榜位。 | — | 500/500 | 150/150 | 3,450/3,450 |
| 曲名、艺人、Spotify 跳转和时长 | [歌曲母表.csv](../Spotify基础数据集/歌曲与歌词/歌曲母表.csv)，按 `song_id`。录音匹配依据和时长来源见 [歌曲元数据核验.csv](../Spotify基础数据集/歌曲与歌词/歌曲元数据核验.csv)。 | 2,963/2,963 | 500/500 | 150/150 | 3,450/3,450 |
| 单曲的逐行歌词、行号和匹配状态 | [逐行歌词.csv](../Spotify基础数据集/歌曲与歌词/逐行歌词.csv)按 `lyrics_version_id`，核验状态由[歌词匹配.csv](../Spotify基础数据集/歌曲与歌词/歌词匹配.csv)按 `song_id` 提供，来源链接由[歌词版本.csv](../Spotify基础数据集/歌曲与歌词/歌词版本.csv)按版本提供。 | 2,950/2,963 | 500/500 | 150/150 | 3,439/3,450 |
| 歌词八类情绪、词典覆盖，支撑单曲雷达和聚合分布 | [lyric_emotions.csv](../analysis/emotion/lyric_emotions.csv)，按 `lyrics_version_id`。本行覆盖按八类分数均可用统计。 | 2,799/2,963 | 482/500 | 142/150 | 3,291/3,450 |
| 歌词主语种 | 同上，按 `language` 和 `language_confidence`，覆盖按识别置信度至少 0.60 统计。 | 2,838/2,963 | 482/500 | 142/150 | 3,326/3,450 |
| 选情绪后高亮歌词里的词，查出现位置与贡献 | [lyric_emotion_tokens.csv](../analysis/emotion/lyric_emotion_tokens.csv)，按 `line_id` 连原文，`emotions` 决定高亮哪些位置。覆盖按至少有一个情绪词可高亮统计。 | 2,716/2,963 | 480/500 | 142/150 | 3,220/3,450 |
| 歌词整体重复度 | [lyric_repetition.csv](../analysis/repetition/lyric_repetition.csv)，按 `lyrics_version_id`，使用 `repeat_lz_ratio`。 | 2,950/2,963 | 500/500 | 150/150 | 3,439/3,450 |
| 和这首歌措辞相近的歌词 | [lyric_similarity.csv](../analysis/theme/lyric_similarity.csv)，按 `lyrics_version_id` 查五个相似版本，再由 `similar_lyrics_version_id` 连回歌曲母表。 | 2,950/2,963 | 500/500 | 150/150 | 3,439/3,450 |
| 九项音乐特征的来源归档 | [song_audio_features.csv](../Spotify基础数据集/音乐特征/song_audio_features.csv)，按 `song_id` 回查 Spotify 或 ReccoBeats 来源。 | 2,397/2,963 | 489/500 | 139/150 | 2,784/3,450 |
| 数值视图使用的九项录音特征，包括 BPM、响度、能量、可舞性、听感愉悦度 | [song_audio_reccobeats.csv](../analysis/song_audio_reccobeats.csv)，按 `song_id`。图表和雷达图统一此来源。 | 2,251/2,963 | 432/500 | 136/150 | 2,738/3,450 |

## 补充信息与使用范围

| 信息 | 数据表与当前状态 | 母表 | 全球 2017–2026 | 全球近三年 | 地区近三年同期 |
|---|---|---:|---:|---:|---:|
| 歌词元数据已核对 | [歌词匹配.csv](../Spotify基础数据集/歌曲与歌词/歌词匹配.csv)，状态为「元数据匹配已确认」。可在歌词、情绪、重复度视图中用作筛选条件。 | 1,707/2,963 | 202/500 | 58/150 | 1,877/3,450 |
| 调性和调式均有效 | [song_audio_features.csv](../Spotify基础数据集/音乐特征/song_audio_features.csv)，`key` 与 `mode`。 | 2,396/2,963 | 488/500 | 139/150 | 2,784/3,450 |
| 有效拍号 | 同上，`time_signature`，覆盖统计限 3–7。 | 824/2,963 | 378/500 | 44/150 | 538/3,450 |
| 听众给副歌片段打的愉悦度、唤醒度 | [song_listener_ratings.csv](../analysis/song_listener_ratings.csv)，按 `song_id`。72 条项目歌曲对应 62 个 PMEmo 副歌片段，适合放在有评分的单曲详情。 | 72/2,963 | 32/500 | 6/150 | 28/3,450 |
| 歌词主主题与候选证据行 | [lyric_themes_pilot.csv](../analysis/theme/lyric_themes_pilot.csv)，按 `lyrics_version_id`。现有小模型试跑供核对，暂缓年份和市场主题分布。 | 83/2,963 | 10/500 | 0/150 | 81/3,450 |

PMEmo 的「2019」是归档发布年份。32 个能查到评分的全球榜位里，2017 年占 23 个，2019 年为 0。地区同期三年分别是 3/1,000、9/1,250、16/1,200。原始值、量表和片段 ID 可逐条回查。GlobalMood 和 DEAM 的公开曲目表采用精确曲名和完整艺人署名做过对接，本项目匹配数为 0。 [PMEmo 作者归档](https://github.com/HuiZhangDB/PMEmo) · [GlobalMood](https://github.com/harin-git/GlobalMood) · [DEAM](https://cvml.unige.ch/databases/DEAM/)

主题模型跑完 256 份歌词。153 份证据复核未通过，20 份判为其他或不明确，3 份输出类别格式异常，80 份通过模型判定。其中 77 份归为爱情。80 是歌词版本数，连回母表是 83 条项目歌曲。 [试跑方法](../analysis/theme/README.md)

专业乐评字段当前入库覆盖为 0。以后收录时可用 `review_url`、`critic_score` 和 `review_scope` 记录来源、分数及单曲或专辑范围。Last.fm 曲目标签和社区留言可提供用户描述，作者署名、编辑评语和专辑分数可以从专业乐评来源获取。频谱频段特征当前也未入库。已有的 BPM 是节拍速度，`key` 是音级，`energy`、`danceability` 和 `audio_valence` 是录音级估计。 [Last.fm 曲目 API](https://www.last.fm/api/show/track.getInfo) · [Pitchfork 专辑评分口径](https://pitchfork.com/info/scoring-guidelines/) · [ReccoBeats 音频接口](https://reccobeats.com/docs/apis/get-track-audio-features)

## 读榜单和看联动

- **全球年份。** 2017–2025 按来源歌单或档案顺序保留前 50。2026 是截至 11 月 12 日的年内榜，来自 45 周全球 Top 200 周榜。其播放量是上榜周记录的累计值。 [榜单计算与来源](../README.md#2026-全球榜与地区同期榜怎么算)
- **地区同期。** 每个市场用各年 1 月 1 日至 11 月 12 日的日榜，按原榜曲名和署名累计上榜日播放量，再取 Top 50。可在入口切换 2025 官方年度歌单和项目的同期榜。播放量列分别覆盖 2026 全球榜的 50 个榜位、地区同期榜的 3,450 个榜位。 [地区日榜覆盖核验](../Spotify基础数据集/地区日榜覆盖核验.csv)
- **联动示例。** 一侧是单曲情绪雷达，另一侧显示原歌词。选中「快乐」，在 `emotions` 找到 `joy` 的词位置，根据 `line_id` 和原文偏移高亮。假设全歌 200 个词，每个命中位置贡献 0.5 分。重复副歌的每次出现都会亮起，可悬停查看词次贡献。用 `Array.from(line_text)` 按 Unicode 码点截取，保证外语和混合字符的偏移对得上。 [情绪方法、字段和复跑](../analysis/emotion/README.md)
- **摘要值。** 年份或市场按当前榜位等权汇总，歌手入口按 `song_id` 去重。每个轴显示有值的样本数与候选样本数。情绪词次率跨市场优先在同一种歌词主语种内比较。Black Sherif 同一录音《Konongo Zongo》的能量在 Spotify 归档是 0.373，在 ReccoBeats 是 0.567。各音乐性数值视图统一读 ReccoBeats，观测缺值留空，Spotify 归档供回查。

## 覆盖补充与复跑

| 数据 | 实际提高覆盖的步骤 | 如何核查 |
|---|---|---|
| 歌词情绪与词级证据 | 补上旁遮普语词表映射后，2,742/2,890 个版本有八类分数，共 53,679 个可高亮词次。其余包括 110 份语言置信度偏低、37 份词典命中词次偏少及 1 份语言识别结果需复核。 | [情绪方法、质量检查与复跑](../analysis/emotion/README.md) |
| 歌词匹配复核 | 对全部 1,474 条待复核记录重新比较当前录音元数据和已有的歌词候选。231 条补齐了支持证据，确认覆盖从 1,476 升至 1,707 条。 | [复核结果](../歌词核验依据/歌词再核对.csv) · [通过项的候选 ID 与校验值](../歌词核验依据/歌词再核对证据.csv) |
| 歌词重复度 | The Pudding 的方法已经覆盖 2,890 个歌词版本、2,950 个歌曲条目。计算 `1 − Lempel–Ziv 有效字节数 / 原歌词 UTF-8 字节数`，每个逐字节保留的内容计一字节，每个重复引用计三字节。 | 保存原字节数、有效字节数、方法版本和公式。 [The Pudding 原作](https://pudding.cool/2017/05/song-repetition/) · [脚本和复跑](../analysis/repetition/README.md) |
| 歌词语义相似度 | 多语言 MiniLM 离线编码全部 2,890 份原语歌词，每份输出五个相似版本。实际采用 384 维的 MiniLM，提案中原先计划使用 768 维的 MPNet。主题与语义相似度各有自己的输出。 | 保存模型版本、分块和汇总方法、相似度脚本。 [相似度复跑](../analysis/theme/README.md#歌词语义相似度) |
| 音乐特征 | 601 条 Spotify 归档记录按完整 ID 重配至 886 条。ReccoBeats 回补后有 2,395 条。新增两个 Spotify 归档后有 2,397 条，其中 942 条优先采用 Spotify，拍号从 703 增至 824。另对已用 Spotify 的歌曲查 ReccoBeats，同来源比较表从 1,509 条原有整曲的 ReccoBeats 记录扩展至 2,251 条。 | 保留歌曲 ID、匹配的 Spotify ID、各项来源、接口地址。 [归档匹配与复跑](../Spotify基础数据集/音乐特征/README.md#2026-11-24-归档补数与复跑) · [同口径补数脚本](../analysis/reccobeats_coverage.py) |
| 人工听感 | 先以曲名和艺人得到 56 条歌曲，再通过 PMEmo 曲目编号及完整合作艺人署名补至 72 条。 | 表中 `source_record` 连 PMEmo 片段，`match_basis` 记录对应规则。 [人工听感匹配方法](lyrics-analysis-notes.md#能直接用的人工听感评分) |
| 剩余歌词缺口 | 12 首暂缺曲目已补入候选平台、录音链接和版本疑点。确认同录音和可用正文后可再生成 `line_id`。另有 1 首雨声音轨标为无歌词。 | [12 首记录与候选来源](../歌词核验依据/歌词缺项来源.csv) |

运行 `python3 analysis/visualization_coverage.py` 会重建 [visualization_coverage.csv](../analysis/visualization_coverage.csv)。表可按 `scope,year,market,feature_id` 查覆盖。`unit=song` 是母表歌曲，`unit=position` 是榜位。覆盖 CSV 也提供逐市场、逐年和逐情绪高亮覆盖，对播放量的口径以各来源榜单字段为准。

同口径音频表可用本地快照复跑 `python3 analysis/reccobeats_coverage.py --archive analysis/reccobeats-source.json.gz`。快照保留原始批次 ID 和接口返回。实时重新查询时使用 `--cache` 指定缓存目录，接口目录可能变化。 [本次接口快照](../analysis/reccobeats-source.json.gz) · [ReccoBeats 接口](https://reccobeats.com/docs/apis/get-track-audio-features)
