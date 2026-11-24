# 音乐性特征

[song_audio_features.csv](song_audio_features.csv) 每行是一条已匹配的录音。用 `song_id` 连到[歌曲母表](../歌曲与歌词/歌曲母表.csv)。`matched_spotify_id` 是实际命中的完整 Spotify 曲目 ID，匹配依据是母表中的同一个 ID。地区榜如果按曲名和署名汇总多个录音，图表应保留原榜位的 `recording_link_status`，并说明声音特征对应选定录音。

### 字段含义

| 字段 | 含义与单位 |
|---|---|
| `song_id` | 项目歌曲编号，用于连接歌曲母表、榜位和歌词特征 |
| `matched_spotify_id` | 特征归档中实际匹配的 Spotify 曲目 ID |
| `tempo_bpm` | 整首录音的估计速度，每分钟拍数 |
| `loudness_db` | 整首录音的整体响度，单位 dB。数值越高，录音整体越响 |
| `energy` | 声音的强度和活跃感，0–1 |
| `danceability` | 根据速度、节奏稳定性等估计的可舞性，0–1 |
| `acousticness` | 录音呈现原声特征的置信程度，0–1 |
| `audio_valence` | 录音的听感正向程度，0–1。可与歌词的措辞情绪分别展示 |
| `instrumentalness` | 录音以器乐为主、缺少可辨唱词的估计，0–1。歌词可用状态以歌词匹配表为准 |
| `speechiness` | 录音中存在近似口语的人声的程度，0–1 |
| `liveness` | 检测到现场观众等线索的程度，0–1 |
| `key` | 估计主音的音级，0 是 C，1 是升 C／降 D，依半音编号，11 是 B |
| `mode` | 估计调式，1 是大调，0 是小调 |
| `time_signature` | 估计每小节拍数，常见值 3、4、5 |
| `feature_method` | 特征的定义体系，Spotify Audio Features 或 ReccoBeats Audio Features |
| `audio_source` | 提供该条数据的归档名称 |
| `audio_source_url` | 原始数据集地址 |
| `audio_source_record` | 归档内的源文件、记录位置或 ReccoBeats 录音 ID |
| `reccobeats_fields` | 实际由 ReccoBeats 补入的字段名，以竖线分隔 |
| `reccobeats_source_url` | 该录音的 ReccoBeats 结果接口 |

这些指标是录音级的汇总估计。要分析具体用了什么乐器、哪一段加入鼓或副歌怎样变化，需要段落级音频分析或逐曲制作资料。 [Spotify Audio Features 字段定义](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)

### 来源优先顺序

先按 22 位 Spotify ID 使用已下载的 Spotify Audio Features 档案。母表 ID 补齐后，重配这些档案又找到 285 首。原表已有的数值和来源逐项保留。Spotify 档案仍缺值时，才按同一个 Spotify ID 查询 ReccoBeats，并用 reccobeats_fields 标明补入的字段。ReccoBeats 给 1,509 首补了新的录音特征，还补了 36 首 Spotify 档案条目的部分字段。拍号沿用档案来源，目前使用 3–7 范围内的值统计覆盖。 [Spotify API 公告](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) · [ReccoBeats 接口](https://reccobeats.com/docs/apis/get-track-audio-features)

| 每行的优先来源 | 歌曲数 |
|---|---:|
| MGD+ | 665 |
| Kaggle Spotify 存档 | 68 |
| ReccoBeats | 1,455 |
| 年度榜单核验档案 | 10 |
| P-Arpan Spotify 音频特征合并库 | 76 |
| Fostenko 2024 Spotify 归档 | 121 |
| Tüysüz Spotify 归档 | 2 |

同一个指标跨年份、市场或歌曲比较时，固定使用同一来源。单曲详情逐项查 `reccobeats_fields`，列出的字段来自 ReccoBeats，其余字段使用该行的 `feature_method`。聚合图可用 [ReccoBeats 同来源表](../../analysis/song_audio_reccobeats.csv)，并显示有效榜位数。 [MGD+](https://zenodo.org/records/8086643) · [P-Arpan 合并库](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search)

## 实际覆盖

覆盖从最初的 **601 / 2,963（20.3%）**，经补齐 ID 重配 Spotify 归档增至 **886 / 2,963（29.9%）**，再经 ReccoBeats 回补增至 2,395。两份 Spotify 补充归档接入后，当前为 **2,397 / 2,963（80.9%）**。歌级统计按歌曲母表计数。榜位统计中，同一首歌跨年或跨市场上榜时可以被计入多个榜位。

| 指标 | 歌曲母表 | 全球近三年榜位 | 地区近三年榜位 |
|---|---:|---:|---:|
| 九项基础声音指标均有值 | 2,397/2,963 | 139/150 | 2,784/3,450 |
| 主音、调式均有效 | 2,396/2,963 | 139/150 | 2,784/3,450 |
| 有效拍号 | 824/2,963 | 44/150 | 538/3,450 |
| ReccoBeats 九项同来源 | 2,251/2,963 | 136/150 | 2,738/3,450 |

《greedy》的历史归档拍号为 1，保留原值供追溯，并在有效拍号统计中排除。566 首暂无音频特征，可在歌曲母表查到。

### 按年份分布

下表用九项声音指标齐全的榜位数比较原表和补数结果。原表在全球 2017–2022 年每年覆盖 50/50，近三年降为 50/150。地区榜原有覆盖较集中在厄瓜多尔、日本、澳大利亚和加拿大。

| 年份 | 全球原来 → 现在 | 地区原来 → 现在 |
|---|---:|---:|
| 2017–2022（每年） | 50 → 50 / 50 | — |
| 2023 | 35 → 50 / 50 | — |
| 2024 | 25 → 49 / 50 | 172 → 951 / 1,000 |
| 2025 | 10 → 46 / 50 | 120 → 1,045 / 1,250 |
| 2026 | 15 → 44 / 50 | 187 → 788 / 1,200 |

<details>
<summary>查看地区逐市场分布（2024–2026，合并已收录年份）</summary>

| 市场 | 补数前 → 补数后 |
|---|---:|
| Argentina | 24 → 125 / 150 |
| Australia | 43 → 144 / 150 |
| Austria | 34 → 94 / 100 |
| Brazil | 6 → 106 / 150 |
| Canada | 43 → 147 / 150 |
| Chile | 5 → 65 / 100 |
| Colombia | 25 → 80 / 100 |
| Ecuador | 49 → 117 / 150 |
| Finland | 1 → 110 / 150 |
| France | 11 → 113 / 150 |
| Germany | 28 → 91 / 100 |
| Hong Kong | 13 → 123 / 150 |
| Hungary | 5 → 114 / 150 |
| Italy | 3 → 106 / 150 |
| Japan | 45 → 122 / 150 |
| Nigeria | 2 → 112 / 150 |
| Philippines | 10 → 126 / 150 |
| Poland | 8 → 113 / 150 |
| Portugal | 19 → 125 / 150 |
| Romania | 5 → 105 / 150 |
| Spain | 12 → 110 / 150 |
| Switzerland | 27 → 90 / 100 |
| Taiwan | 23 → 129 / 150 |
| Thailand | 18 → 123 / 150 |
| United States | 20 → 94 / 100 |

</details>

## 2026-11-24 归档补数与复跑

补查两份发布者归档。Kaggle v1 完整下载并读过 `songs.csv`，ZIP 的 SHA-256 为 `05da22d5e6861ee3ac8bab2ff58fe78c6d8016a97109327afc71b8d4ef259107`。Zenodo 下载超时，使用 `tracks.csv` 已取得的前 79,503,660 字节中字段齐全的记录，前缀 SHA-256 为 `986da0a11a795568400744d321a319ff8453054469e128830fc0a3851e147556`。两个来源合计保留 614 条证据记录，其中 Zenodo 418 条，Kaggle 196 条。 [Zenodo 原档](https://zenodo.org/records/11453410) · [Kaggle v1](https://www.kaggle.com/datasets/serkantysz/550k-spotify-songs-audio-lyrics-and-genres/versions/1)

匹配先要求完整 Spotify ID 相同。来源有时长时再要求差距在 3 秒以内，来源缺时长时再查规范化曲名。匹配后校验字段值域。Spotify 已有值可以在原值全部一致时补缺，ReccoBeats 音频值有 Spotify 归档支持时优先采用归档。最终新接入 2 首、已有 54 首由 ReccoBeats 改用 Spotify、67 首已采用 Spotify 的录音补了字段。本次拍号增加 121 条。 [原档匹配证据](../../analysis/spotify-audio-archive-matches.csv) · [合并脚本](../../analysis/merge_spotify_audio.py)

用补数前的 [音频快照](../../analysis/sources/song-audio-before-2026-11-24.csv.gz) 和匹配证据重建本次结果。运行时也可用 `--zenodo` 或 `--kaggle` 重新提取证据。每行的 `source_record` 记录原始 CSV 逻辑记录号，表头为 1。

```bash
python3 analysis/merge_spotify_audio.py \
  --baseline analysis/sources/song-audio-before-2026-11-24.csv.gz \
  --evidence analysis/spotify-audio-archive-matches.csv \
  --output /tmp/hit-atlas-audio.csv
python3 analysis/reccobeats_coverage.py --archive analysis/reccobeats-source.json.gz
python3 analysis/visualization_coverage.py
```
