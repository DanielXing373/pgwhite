# EL2 问卷 — 文案 v4 与加载性能调整

**Date:** 2026-10-28  
**Branch:** `feature/el2-questionnaire`  
**Copy version:** `el2-hs-copy.v3` → `el2-hs-copy.v4`

不变：20 段冻结数据集、主题标签与选项措辞、Control / Disclosure 分组、随机化与题目分配、知情同意与 session 创建逻辑、草稿保存与提交、数据库 schema、翻页回顶修复。

## 1. Consent 文案（v3 → v4）

| 项 | v3 | v4 |
|----|----|----|
| 标题 | 欢迎参加鸽白词句库的笔记研究。 | 欢迎参加鸽白词句库的阅读研究 |
| 介绍 | 一段：研究想了解……全程匿名，大约需要 8–12 分钟完成。 | 三段：研究目的；10 段文字、四组标签、可选「都不满意」；预计 8–12 分钟 |
| 列表标题 | 参与即表示您同意： | （删除） |
| 参与说明 | 年满 18 岁；仅用于学术研究，不关联姓名或账号；可随时关闭退出，未提交内容不用于正式分析；摘录来自已出版作品 | 年满 18 周岁，自愿参与，可随时退出；无需姓名或账号，以匿名编号保存；仅用于主题标签评估、系统改进及汇总结果展示，不公开个人作答记录；自动保存进度，关闭页面不会立即删除已保存的回答 |
| 同意声明 | 点击「同意并开始」即表示您理解以上说明并自愿参加。 | 点击「同意并开始」，表示您已阅读以上说明，并自愿参与。 |
| 按钮 | 同意并开始 / 不同意，离开 | 不变 |

新增加载提示：「正在加载问卷，首次打开可能需要几秒钟…」。

批准稿中的「答题记录」改为「作答记录」，以保持 copy 中不出现「题」的约束（`tests/unit/el2hs.test.ts`）。

### 元数据

- 每条 `el2_hs_session` 自带 `copy_version`，自本版本起新 session 记录为 `el2-hs-copy.v4`，已有 v3 记录不变。分析时按该列区分文案版本。
- `el2_hs_protocol` 中 `el2-human-preference.protocol.v1` 一行的 `copy_version` 仍为 `el2-hs-copy.v3`（上线时的文案），未修改历史记录。session 只对 `protocol_version` 有外键，因此无需新迁移。
- 私有目录中的 `CONSENT.md` / `COPY-REVISIONS.md` 需手动同步为 v4。

## 2. 页面（`pages/el2test.vue`）

- Consent 屏去掉 logo 与「鸽白词句库 / 阅读研究」标题区；其他屏不变。
- Consent 字号与间距：正文 15px / 行高 1.7，列表 14px，标题 18px；卡片内边距与段距收紧。
- Mobile Safari：Consent 屏 `min-height: 100svh` + `border-box`，上下留白考虑安全区。
- 首次加载：`meta` 与 session 恢复并行请求，两者返回前显示加载卡片（不再先闪 Consent 再跳题目页）。
- `/el2test` 使用系统衬线字体（Songti SC / Noto Serif CJK SC / SimSun 等）。iPhone 无内置中文衬线字体，中文会显示为苹方。

## 3. 加载与服务器

| 改动 | 文件 | 原因 |
|------|------|------|
| `/el2test` 预渲染（`prerender: true`） | `nuxt.config.ts` | SPA 空壳由 CDN 直接返回，不经函数与冷启动 |
| SPA 加载提示 | `spa-loading-template.html`、`nuxt.config.ts` | JS 下载前不再是空白页；只用于 `ssr: false` 路由 |
| `/el2test` 不加载 Google Fonts | `app.vue`、`nuxt.config.ts` | 346 KB 阻塞渲染的样式表，大陆访问常超时；主页不变 |
| Vercel 函数区域 `iad1` → `sin1` | `nuxt.config.ts`（`nitro.vercel.functions.regions`） | Railway MySQL 在新加坡；创建 session 约 30 次串行查询，每次跨太平洋约 215ms，导致「同意并开始」约 10 秒 |

实测：迁到 `sin1` 后「同意并开始」从约 10 秒降到近乎即时（Preview，iPhone Safari）。

合并到 `main` 后，Production 的全部函数（含主页接口）也会运行在 `sin1`。

## 4. 后续

- 主页仍加载 Google Fonts，待评估。
- `createSession` 的 10 条分配记录仍逐条 INSERT；如需进一步提速可合并为一条多行 INSERT。
