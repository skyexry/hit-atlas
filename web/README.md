# web

保存交互可视化代码。用 song_id 连接榜位与分析结果，用 line_id 定位逐词贡献对应的原句。

[Hit Atlas 小样本预览](hit-atlas-demo.html) 可直接在浏览器打开。它用实际汇总展示全球趋势、四个地区和四位歌手，榜单列表只显示前六首。词级联动收录三首歌的五个短片段。

## 音频统一口径

音乐性数值视图统一读取 [ReccoBeats 同来源表](../analysis/song_audio_reccobeats.csv)，包括年份、市场、歌手比较和同一组指标的雷达图。按 `song_id` 连接，缺值在图上留空，聚合提示框显示有效数和榜单总数。[音频归档表](../Spotify基础数据集/音乐特征/song_audio_features.csv)保留已有的 Spotify 数据及逐项来源，供回查。拍号作为单曲资料的可选字段。

工作分支为 `web-visualization`。[返回项目说明](../README.md)
