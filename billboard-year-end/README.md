# 美国 Billboard 年终 Hot 100 · 1959–2023

[打开离线互动图](explorer.html) · [逐年覆盖](coverage.csv) · [榜单主表](chart_entries.csv)

65 届年终榜共 6,501 个榜位。1969 年两份来源都列出两首并列第 100 名，分别是 Paul Revere & the Raiders 的《Let Me》和 The Box Tops 的《Sweet Cream Ladies》。该年的曲风占比分母为 101。其余年份各有 100 条。

| 统计单位 | 本次覆盖 |
|---|---:|
| 去重歌曲或合榜单曲条目 | 6,196 |
| 榜单署名艺人或组合 | 2,756 |
| 有可用歌词文本的榜位 | 6,337 / 6,501 |
| 有曲风标签的榜位 | 6,486 / 6,501 |
| 有可定位来源国家或地区的艺人 | 2,612 / 2,756 |
| 有可用歌词且自动判为英语主导的榜位 | 6,261 / 6,501 |

## 一、构造数据集

**先固定榜位和身份。** 用各年美国 Billboard 年终 Hot 100 的公开历史榜单转录确定年、排名、曲名和演唱署名。在年内按曲名和艺人对照 Blakely 歌词库与 Perot 曲风库，优先匹配同一排名。排名相异时，只采用能同时对上曲名和艺人且候选唯一的记录。转录之间的差异可从数据表中的来源追查。年度指上榜年。[年榜示例](https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_1969) · [Harvard Dataverse](https://doi.org/10.7910/DVN/KRQMKU)

**再接歌词与曲风。** 歌词优先取 Blakely 原始文件中可通过曲名、艺人与 Genius 地址核对的文本。进入词频样本前剔除标成器乐、空文本、异常长文本、评论链接和无法确认的对应关系。用另外两份年终歌词库补匹配，再对余缺查询 LRCLIB。歌词状态表示自动核对结果，准确度仍受原始转录影响；例如某些来源会简写副歌或删除标点。6,196 个去重条目中，6,035 个有可分析文本，44 个标记纯音乐，55 个匹配待核，38 个缺词，24 个合榜条目没有可代表整个条目的单一歌词。人工逐曲审校尚待开展。[Blakely](https://www.kaggle.com/datasets/brianblakely/top-100-songs-and-lyrics-from-1959-to-2019) · [tmelo-uea](https://github.com/tmelo-uea/billboard-hot100-lyrics) · [Kaylin Pavlik](https://github.com/walkerkq/musiclyrics) · [LRCLIB](https://lrclib.net/)

曲风来自 Emma Perot 等人随年终榜位发布的研究标签。保留原文，展示时合并同义标签，如 Rap 与 Hip Hop、Swing 与 Jazz/Swing。把每个榜位的权重 1 均分到其去重后的展示类别。跨年记录允许保留来源表实际给出的不同标签。少数缩写、曲名变体及专名拼写差异经对照后接入；无法可靠对上的条目保留为“未标注”。[曲风数据 DOI](https://doi.org/10.7910/DVN/KRQMKU)

**最后核对艺人和来源地。** 从榜单艺人链接识别人物及组合，用 Wikidata 条目合并别名和重定向。个人采用出生地，组合优先采用成立地；公开资料明确列出的组合起源地也可补入，并保留类型。多个地点有歧义时保留空值或以有明确地名的艺人资料补录。来源国按地点对应的国家或地区代码存储。2,612 条有国家或地区的记录包括 1,628 条出生地、806 条成立地和 178 条资料所列起源地。地图只表达演唱者的地理来源；族裔、家庭文化、作曲和填词署名属于不同字段。[出生地 P19](https://www.wikidata.org/wiki/Property:P19) · [成立地 P740](https://www.wikidata.org/wiki/Property:P740) · [Natural Earth 地图](https://github.com/nvkelso/natural-earth-vector)

## 二、表之间怎样连接

| 文件 | 一行的含义与连接方式 |
|---|---|
| [chart_entries.csv](chart_entries.csv) | 一个年终榜位，主键 `entry_id`。允许并列。保留原始榜单链接，通过 `song_id` 关联歌曲。 |
| [songs.csv](songs.csv) · [song_links.csv](song_links.csv) | 一个去重歌曲条目及其榜单链接指向的组成曲目。相同的规范化曲名与艺人身份组合跨年复用。这里的 ID 是榜单歌曲归并键，尚未进行 ISRC 或母带级录音核验。双面单曲按榜单原条目保留。 |
| [artists.csv](artists.csv) · [song_artists.csv](song_artists.csv) | 艺人实体及歌曲—艺人的多对多关系。艺人表保存地名、来源类型、国家代码和证据地址。艺人角色与排序以榜单原始署名为准。 |
| [genres.csv](genres.csv) | 一个榜位的来源曲名、艺人、来源排名、原始及统一曲风。通过 `entry_id` 接榜单，`genres` 用竖线分隔。 |
| [lyrics.csv](lyrics.csv) · [lyric_metrics.csv](lyric_metrics.csv) | 以 `song_id` 接入采用的歌词版本、来源、匹配依据、状态，以及估计的主导语言和词数。 |
| [coverage.csv](coverage.csv) | 一年一行，包括榜位、有效歌词、曲风、不同艺人及其来源覆盖。地图窗口的艺人会重新去重，不能把五个年度的艺人数相加。 |
| [source_review.csv](source_review.csv) | 保存歌词或曲风匹配异常记录，包括被排除的原始歌词地址。补配后的最终状态以对应的歌词和曲风表为准。 |

## 三、交互草稿与样本范围

下载本目录后，在浏览器中打开对应 HTML。

| 视图 | 样本与交互 | 静态预览 |
|---|---|---|
| [历史总览](explorer.html) | 1959–2023 全榜，包含曲风、艺人来源和歌词用词 | |
| [艺人来源地图](demos/artist-origin-sketch/map-to-artists.html) | 1959–2023，选择年份和地理来源，从艺人矩形查看对应榜单歌曲 | [地图](demos/artist-origin-sketch/map-to-artists.png) |
| [歌词词频](demos/lyric-words-demo/index.html) | 2014–2023 年每年前 15 名，150 个榜位中有 149 个纳入英语歌词样本。可输入关键词、按曲风探索，以及查看每年的词语气泡 | [关键词趋势](demos/lyric-words-demo/preview.png) · [气泡分布](demos/lyric-words-demo/bubble-axis.png) · [紧凑气泡图](demos/lyric-words-demo/bubble-packed.png) |
| [声音特征](demos/sound-demo/2023.html) | 2023 年曲风雷达和特征相关图。点击雷达轴展开 2021–2023 年趋势，相关图支持散点与 Hexbin 切换 | [Hexbin](demos/sound-demo/hexbin-2023.png) |

声音特征从 Billboard 榜位出发，通过 ReccoBeats 核对曲名、艺人和录音版本。三年分别匹配 **96/100、99/100、99/100** 个榜位。[ReccoBeats 查询接口](https://reccobeats.com/docs/apis/search-tracks) · [三年逐首数据](demos/sound-demo/reccobeats-2021-2023.csv) · [2023 年逐首数据](demos/sound-demo/reccobeats-2023.csv)

音频表以整数年份和年终名次对应榜位，保留榜单曲名、艺人、匹配状态、ReccoBeats ID、ISRC 和来源链接。能量、可舞性、原声感、愉悦度、说话声等是 0–1 数值，响度用 dB，速度用 BPM。未匹配的榜位保留空特征值。雷达和年度折线取曲风中位数。多标签榜位可进入多个曲风组，同一曲风内每个榜位计一次。曲风小样本和版本缺项可结合图中计数解读。

## 四、历史总览的三个视图

- **歌曲曲风**：以年度实际榜位为分母。点年份和色带，看该类涉及的歌曲、榜位数与分配权重后的占比。“未知”保留在分母。
- **艺人来源**：两幅地图共享圆面积刻度。左图固定为 1959–1963，右图取截至所选年的最近五年；每个窗口内按艺人 ID 去重，圆面积以已知来源艺人为分母。下方折线按单年计算。选择国家查看艺人和出生地／成立地来源。若要复查 1959–2016 的比较，可将滑条移到 2016，右图显示 2012–2016。
- **歌词用词**：输入最多六个英文词。可切换“唱到该词的歌曲占比”和“每千词出现次数”。用 langid 对每份歌词估计主导语言，默认基于英语主导的整首歌词；混唱歌曲的词数可能含其他语言。分词保留词内撇号，独立单词匹配，方括号内的段落标签排除。平滑选项取当前及之前最多四年的年度指标平均；下方数字与曲目始终显示选中年份的原值。

在已知来源艺人中，1959–1963 年有 **10 个来源地（260/293 位艺人已知）**，2012–2016 年有 **24 个（294/302）**，2019–2023 年有 **21 个（276/290）**。分母与覆盖率随时期变化，早期缺失更多。来源地数量也是样本量的函数，窗口差异宜结合海外艺人占比和具体艺人解读。

## 五、复核与重建

直接打开本目录的 HTML 可以离线使用。静态页面内嵌图表所用的曲目、艺人、几何和词频索引。运行 `python3 scripts/verify.py` 可核对榜位并列、表间关联、逐年覆盖和视图索引。

如需从公开来源重新获取，构建环境使用 Python 3、requests、beautifulsoup4、lxml、xlrd、Babel、langid 和 NumPy。在本目录按序执行（缓存目录示例为 `/tmp/hit-atlas-bb65-sources`）。网络来源与实体资料会更新，重新获取的结果可能随之变化。

```sh
python3 scripts/fetch_sources.py /tmp/hit-atlas-bb65-sources
python3 scripts/artist_places.py /tmp/hit-atlas-bb65-sources
python3 scripts/build.py /tmp/hit-atlas-bb65-sources
python3 scripts/supplement.py /tmp/hit-atlas-bb65-sources
python3 scripts/build.py /tmp/hit-atlas-bb65-sources
python3 scripts/build_views.py /tmp/hit-atlas-bb65-sources
python3 scripts/verify.py
```
