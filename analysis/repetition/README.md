# analysis/repetition

[lyric_repetition.csv](lyric_repetition.csv) 按歌词版本记录 `repeat_lz_ratio`。通过 `lyrics_version_id` 接回母表。

先按行序拼接原文，保留重复、标点和分行。对跑过 NFC 的 UTF‑8 字节做 gzip 9 级压缩，用 infgen 拆解 DEFLATE 的匹配记录。有效压缩字节等于「字面保留字节数 + 3 × 匹配段数」，重复度为 `1 − 有效压缩字节 / 原文字节`。本轮使用 infgen 3.6。UTF‑8 的字宽和转录格式会影响不同语种间的绝对分数，跨市场比较时可筛选共同语种。 [The Pudding 作品](https://pudding.cool/2017/05/song-repetition/) · [原作者的方法说明](https://github.com/colinmorris/lalala) · [infgen](https://github.com/madler/infgen)

从仓库根目录复跑 `python3 analysis/repetition/score.py --infgen /path/to/infgen`。

工作分支为 `analysis-repetition`。[返回项目说明](../../README.md)
