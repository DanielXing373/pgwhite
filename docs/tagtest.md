# `/tagtest` — 一次一句标注原型（v1）

内部页，首页无入口。Wizard of Oz：预处理与提交都是假接口，**不写 Railway**。  
打开：`http://localhost:3000/tagtest`（部署后即域名 + `/tagtest`）。

---

## 理念

- **先跑通人怎么标，再接真模型。** 自动 tag 用剧本假装 API，才能稳定覆盖「打错、重复、空 tag、新建人物」。
- **v1 的气质是工整。** 少装饰、一屏一句、区块对齐，给需要条理的用户。以后对照的「夜色 / 温暖伙伴」版应更自由、多彩——差异是**同一套任务的视觉性格**，不只是和首页比功能。
- **能复用首页的交互就复用。** 点选、点删、飞入动画与词表来源和检索页同一套，避免测试页教会另一套肌肉记忆。

---

## 用户流程

选语言（左中 / 右英，背景模糊）→ 假预处理 → 逐句改 tag / 原文 / 作者书名 → 完成并「发送」（假成功）。

状态不手选：无自动 tag → `raw`；有自动 tag → `preprocessed`；全部提交时末句 → `reviewed`。  
Flag（错别字 / tag / 其他）可叠加，收在底栏。

---

## 和首页：相同 vs 不同

**相同**

- `FilterGroup` 点选、`SelectedBar` 点删、`FlyingGhosts` 飞入
- 场景 / 主题 / 修辞来自 `data/times|themes|devices.json`（中英随语言切换）
- 帮助按钮；chip 颜色体系（theme.css）

**不同（v1）**

- 无 TopBar；投稿按钮隐藏
- 一屏一句（词表格内部可滚，整页尽量不滚）
- 作者书名可改；人物默认空（测试书没有人物），空文案「右侧新建人物」——首页筛选仍是「无匹配项」
- 新建 tag 置顶（`FilterGroup` 的 `pinnedIds`）
- 轮换提示 + 左右翻；下一句锁定 + 闪一下
- 浅例句 + 故意错 tag / 重复 hash / 错别字

---

## 剧本（10 句）

| # | 在测什么 |
|---|---|
| 1 | 太阳像苹果 → 隐喻（合理） |
| 2 | 他哭了很久 → 主题故意打成「时间」 |
| 3–4 | 「风是一把刀」标点不同 → 重复 |
| 5 | 天气很好 → 无自动 tag |
| 6 | 小明站在门口 → 人物留空 |
| 7 | 夜色吞小镇 → 可新建 tag |
| 8 | 太杨 / 苹菓 → 改正文 |
| 9 | 河水在笑 → 修辞可能不准，可 flag |
| 10 | 雨点敲窗 → 提交 |

作者 / 书统一为「测试作者」/「《测试书》」。

---

## 代码地图

| 路径 | 职责 |
|------|------|
| `pages/tagtest.vue` | 布局与样式 |
| `composables/useTagtestSession.ts` | 会话、草稿、导航 |
| `data/tagtest/fixture.ts` | 十句剧本 + 词表 |
| `utils/tagHash.ts` | 去标点后的近似重复 |
| `server/api/tagtest/preprocess.post.ts` | 假自动 tag（延迟） |
| `server/api/tagtest/commit.post.ts` | 假提交 |
| `layouts/tagtest.vue` | 无 TopBar、无投稿 |
| `components/filters/FilterGroup.vue` | 新增 `pinnedIds`、`emptyLabel`（首页不传则行为不变） |

---

## 以后

- 轮换提示、语言先选、翻页必须有反馈 → 可接到首页
- 一次十条、问卷打分、真 LLM、写库
- 词表：`d_metaphor`「隐喻」拟改为「比喻 / 暗喻」（中英一起改 `data/devices.json`）

首页 `/` 筛选项来自 Railway `GET /api/facets`。本地无 `DB_*` 时筛选为空，与本页无关。
