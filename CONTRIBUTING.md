# Hit Atlas 小组成员上手指南

我们一起探索「热门歌曲在唱什么，以及这些特征如何随年份和市场变化」。大家在同一个私有仓库工作，共用一份歌曲母表和一套歌词行号。接受 GitHub 邀请后，先找到你的任务。

| 我负责什么 | 在 GitHub 选择的分支 | 从哪里读数据 | 把成果放哪里 |
|---|---|---|---|
| 维护榜单和母表 | `data-maintenance` | 榜单来源、录音及歌词核验依据 | [共享数据目录](Spotify基础数据集/) |
| 歌词情绪和词贡献 | `analysis-emotion` | 歌曲母表、逐行歌词 | [analysis/emotion](analysis/emotion/) |
| 歌词主题 | `analysis-theme` | 歌曲母表、逐行歌词 | [analysis/theme](analysis/theme/) |
| 歌词重复度 | `analysis-repetition` | 逐行歌词，按 line_no 排序 | [analysis/repetition](analysis/repetition/) |
| 交互可视化 | `web-visualization` | 榜位对应、各组已合并的结果表 | [web](web/) |

## 第一次拿数据

打开[歌曲与歌词工作簿](Spotify基础数据集/歌曲与歌词/歌曲与歌词.xlsx)，或者读取对应 CSV。歌词分析默认使用歌曲母表已选的 `lyrics_version_id`，按这个编号在「逐行歌词」取原文，同一版本只分析一次。需要限定已核验样本时，在「歌词匹配」按 `song_id` 查看 `lyrics_status`。音乐特征已放在[音乐特征表](Spotify基础数据集/音乐特征/song_audio_features.csv)，它和榜位对应表都用 `song_id` 连接母表。

- **歌曲级结果**保留 `song_id` 和 `lyrics_version_id`，再加本组算出的指标。
- **行级或词级结果**保留 `line_id`。逐词结果再加词本身和它在该行的位置，方便网页高亮原文。
- **抽查方法**：选一条结果，用它的编号在共享表中找到歌和原句。若同一句副歌出现两次，两次出现应能定位到各自的行号。

## 怎么提交

**直接用 GitHub 网页**：进入仓库首页，在左上的分支菜单选自己的任务分支，打开负责的目录，选择 **Add file → Upload files** 上传文件并提交到该分支。接着打开 **Pull requests → New pull request**，把 **base** 选为 `main`，**compare** 选为自己的任务分支。

**在本地写代码**：下面以情绪组为例。其他组把分支名和目录替换为上表对应项。第一次执行：

```bash
git clone https://github.com/skyexry/hit-atlas.git
cd hit-atlas
git switch analysis-emotion
```

每次开始工作前，在自己的任务分支同步进度：

```bash
git pull --ff-only
git fetch origin
git merge origin/main
```

把脚本和结果放在负责的目录，检查本次改动后提交：

```bash
git status --short
git add analysis/emotion/
git diff --cached --stat
git commit -m "添加歌曲情绪得分与逐词贡献"
git push
```

然后按上面的网页步骤发起 Pull Request。在说明里写清楚用了哪版数据、交付了哪个文件、如何验证结果。分析组给一个可复查的 song_id 或 line_id，网页组说明从哪个视图可以看到改动。请一位组员检查后合并到 main。合并页面保留任务分支，下一轮可以继续使用。

如果发现曲名、署名、录音或歌词版本有疑问，把 song_id、来源和具体问题发给数据负责人，由数据分支统一修订。初始共享快照是 [data-v1](https://github.com/skyexry/hit-atlas/tree/data-v1)。
