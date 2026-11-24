# 音乐性特征

[song_audio_features.csv](song_audio_features.csv) 每行是一条已匹配的录音。用 `song_id` 连到[歌曲母表](../歌曲与歌词/歌曲母表.csv)。`matched_spotify_id` 是实际命中的完整 Spotify 曲目 ID，匹配依据是母表中的同一个 ID。地区榜如果按曲名和署名汇总多个录音，图表应保留原榜位的 `recording_link_status`，并说明声音特征对应选定录音。

| 字段 | 含义 |
|---|---|
| `tempo_bpm` | 估计速度，每分钟拍数 |
| `loudness_db` | 录音整体响度，单位 dB |
| `energy`、`danceability`、`acousticness`、`audio_valence` | 能量、可舞性、原声程度和音频正向感，取值 0–1 |
| `instrumentalness`、`speechiness`、`liveness` | 偏向纯器乐的程度、口语程度和现场感，取值 0–1 |
| `key`、`mode`、`time_signature` | 主调音级（0 是 C，11 是 B）、大小调（1 是大调，0 是小调）、每小节拍数 |
| `feature_method`、`audio_source`、`audio_source_url`、`audio_source_record` | 特征定义、数据提供方、来源地址和源文件或记录位置 |

匹配时优先保留 BPM、能量、可舞性、响度、原声程度和音频正向感六个基础指标更齐全的同一条来源记录。齐全度相同时，优先用 MGD+ 的全球文件，再用其地区文件，然后用项目已核验的年度榜档案、本地下载的 Kaggle 存档和 P-Arpan 合并库。表中无值的指标留空。P-Arpan 合并库曾填补部分拍号，其来源行的拍号统一留空。播放量、流行度和歌词情绪另外通过榜单与歌词侧取得。

- MGD+ 由 Seufitelli、Oliveira、Silva 与 Moro 发布。[MGD+ 数据记录](https://zenodo.org/records/8086643)
- 年度核验档案与 Kaggle 存档的原始数据集链接逐行记录在 `audio_source_url`。
- P-Arpan 的 *Acoustic Features From Spotify* 是多个导出的合并库。`audio_source_record` 保存它记录的贡献文件名。[合并库的数据来源与授权说明](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search)

## 当前覆盖

601 个歌曲条目具备六项基础音频指标。按 `song_id` 连回榜单后，全球年度 Top 50 的覆盖如下。

| 年份 | 有六项基础音频指标的榜位 |
|---|---:|
| 2017–2022 | 每年 50 / 50 |
| 2023 | 35 / 50 |
| 2024 | 25 / 50 |
| 2025 | 10 / 50 |
| 2026（年内） | 15 / 50 |

2024–2026 地区同期榜共覆盖 479 / 3,450 个榜位。歌曲条目数用来核算补数工作量，榜位数用来说明图表覆盖。
