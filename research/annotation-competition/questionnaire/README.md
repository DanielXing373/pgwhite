# AC1 真人问卷 `/ac1test`

在 `/el2test` 的基础上改出来的第二版问卷。排版、流程、匿名和限流机制沿用上一版；区别是参与者不再“四组里选一组”，而是对每个标签勾选“合适”。

状态（2026-11-12）：代码写完，单元测试和本地浏览器实测通过（内存存储）。**没有部署，迁移 0008 没有执行，MySQL 路径没有在真实数据库上跑过。**

## 设计

| 项目 | 做法 |
| --- | --- |
| 题库 | 从 holdout60 按书分层抽 20 段（13 本书），每人随机分到 10 段，两页各 5 段 |
| 标签 | 三个入选配置（Flash 不推理、Luna 低档推理、Luna 中档推理）对该段给出的标签合并、去重，共 95 个：主题 64、修辞 15、描写手法 16；每段 2–8 个 |
| 展示 | 按主题 / 修辞 / 描写手法分三行，只显示标签名；顺序在生成题库时固定打乱一次，所有人相同 |
| 作答 | 每个标签一个勾选框：勾 = 合适，不勾 = 不合适，没有第三种状态 |
| 必答 | 每段至少勾一个，或点「都不合适」；否则不能翻页或提交，并在该段下方提示 |
| 出处 | 每段显示“——作者《书名》”。书名去掉了导入时带的版本说明，如“（译文经典）” |
| 分组 | 对照组和提示组各一半；只有提示组的第 2 页显示“请注意，本页包含 AI 生成的标签。” |
| 证据 | 不展示，也不进题库 |
| 匿名 | 不收集任何联系方式；请求里出现多余字段直接拒绝；不存原始 IP |

所以每人的作答里，第 1 页（两组）和对照组的第 2 页没有 AI 提示，占 75%；提示组的第 2 页占 25%。

## 和上一版的差异

| | `/el2test` | `/ac1test` |
| --- | --- | --- |
| 每段的选项 | A–D 四组主题，单选，另有 E「都不满意」 | 一组标签，多选，另有「都不合适」 |
| 维度 | 主题 | 主题、修辞、描写手法 |
| 来源 | 人工、Embedding、Luna、Flash 各占一个选项，每人随机排到 A–D | 三个配置的标签合并，参与者看不出来源 |
| 作答存储 | 每段一个字母 | 每段一组被勾选的标签编号，加一个“都不合适”标记 |
| 草稿 | 逐段覆盖 | 整份替换（取消全部勾选后该段回到未答） |
| 题库加载 | 运行时读 `research/` 下的 JSON 文件 | 生成的 TS 模块，随服务端一起打包，无服务器环境也能用 |
| 本地测试模式 | 可写 MySQL | 默认只用内存，`AC1_HS_LOCAL_TEST_MYSQL=1` 才写 MySQL |
| 数据表 | `el2_hs_*` | `ac1_hs_*`（迁移 0008），互不影响 |

分组、抽题、限流、cookie、提交幂等、质量标记的逻辑没有改。

### 文案改动（`ac1-hs-copy.v1`，对照 `el2-hs-copy.v3`）

| 位置 | 上一版 | 这一版 |
| --- | --- | --- |
| 研究说明 | ……读者更认可哪一种主题标签……每段有四组主题标签，请选出您认为最合适的一组 | ……读者认为哪些标签是合适的……每段下面有若干标签，分为主题、修辞、描写手法三类，请勾选您认为合适的标签 |
| 页面说明 | 请凭个人理解，选出您认为最贴合主题的一组标签。如果都不满意，请选「都不满意」。 | 请凭个人理解，勾选您认为合适的标签，可以多选。如果都不合适，请选「都不合适」。 |
| AI 提示 | 请注意，本页包含 AI 生成的标签组。 | 请注意，本页包含 AI 生成的标签。 |
| 兜底选项 | 都不满意 | 都不合适 |
| 漏答提示 | 还有摘录没有选择。 | 还有摘录没有作答（每段必答）。请至少勾选一个合适的标签；如果都不合适，请选「都不合适」。 |
| 段内提示 | 无 | 本段必答：请至少勾选一个标签，或选「都不合适」。 |
| 进度 | 已选 x / 10 | 已答 x / 10 |

同意页的四条说明、按钮文字、提交确认、感谢语没有改。

## 文件

| 文件 | 作用 |
| --- | --- |
| `pages/ac1test.vue` | 页面 |
| `server/api/ac1test/*` | 6 个接口：`meta`、`session`（GET/POST）、`draft`、`submit`、`export` |
| `server/utils/ac1hs/*` | 服务端逻辑；`dataset.generated.ts` 是生成的题库 |
| `database/migrations/0008_ac1_human_study.sql` | 8 张 `ac1_hs_*` 表，只新增，可重复执行 |
| `tests/unit/ac1hs.test.ts` | 20 个单元测试，已接入 `pnpm test` |
| `research/annotation-competition/scripts/build-questionnaire-set.mjs` | 题库生成脚本 |
| `research/annotation-competition/questionnaire/ac1-hs-questions.internal.v1.json` | 题库存档，内容与 `dataset.generated.ts` 相同 |
| `app.vue`、`nuxt.config.ts` | 各加一处，让 `/ac1test` 和 `/el2test` 一样独立渲染 |

题库两个文件都含“标签来自哪个配置”的对照，只能在服务端使用。页面只引用 `copy.ts`，有测试守着。

重新生成题库（不调用模型，需要本机的 `runs/`）：

```powershell
node research/annotation-competition/scripts/build-questionnaire-set.mjs
```

题库变了，`content_sha256` 就会变，需要同步改 `server/utils/ac1hs/constants.ts` 里的 `INTERNAL_MASTER_CONTENT_SHA256` 和迁移 0008 末尾的同一个值，否则服务端拒绝启动问卷、测试也会失败。已有答卷之后不要再改题库。

## 本地试用（不碰数据库）

```powershell
$env:AC1_HS_STORE = 'memory'
pnpm dev
```

打开 `http://localhost:3000/ac1test?mode=test`。`AC1_HS_STORE=memory` 让所有会话只存在进程内存里，完全不连数据库；重启服务器后数据清空。页面顶部会有黄色的“测试模式”横幅。

想再填一次：测试会话提交后，清掉浏览器里 `localhost` 的 cookie `ac1_hs_sid` 再刷新。

## 上线步骤

1. **代码**：提交 `feature/ac1test` 分支，合并到 Vercel 的生产分支。
2. **看迁移状态**（只读，可以直接对 Railway 跑）：

   ```powershell
   pnpm db:migrate:status
   ```

   确认待执行的只有预期的那几个。**如果 `0007_el2_human_study` 也显示未执行，下一步会把它一起执行**（它同样只新增 `el2_hs_*` 表）。不想要的话先停下来。
3. **执行迁移**（写生产库，`.env` 的 `DB_*` 指向 Railway）：

   ```powershell
   $env:MIGRATE_ALLOW_REMOTE = '1'
   pnpm db:migrate
   ```

   执行后 Railway 里应有 8 张 `ac1_hs_*` 表，`ac1_hs_protocol` 1 行、`ac1_hs_assign_lock` 2 行。也可以不用脚本，把 `0008_ac1_human_study.sql` 的内容贴到 Railway 的 MySQL 查询窗口里执行，再运行 `pnpm db:migrate:mark 0008` 记账。
4. **用真实数据库走一遍测试模式**（推荐，写入的是 `study_mode='test'` 的行，正式分析会排除）：

   ```powershell
   $env:AC1_HS_LOCAL_TEST_MYSQL = '1'
   pnpm dev
   ```

   打开 `http://localhost:3000/ac1test?mode=test`，完整填一份并提交。这是 MySQL 路径第一次真正执行，出错会在这一步暴露。测试完关掉这个终端，避免环境变量留着。
5. **Vercel 环境变量**（Project → Settings → Environment Variables，只加到 Production）：

   | 变量 | 值 | 说明 |
   | --- | --- | --- |
   | `AC1_HS_EXPORT_TOKEN` | 自己生成的 32 位以上随机串 | 不设就无法导出；接口对错误口令返回 404 |
   | `AC1_HS_RATE_LIMIT_PER_CLIENT` | 可不设，默认 20 | 同一来源 10 分钟内最多新开几份问卷 |
   | `AC1_HS_RATE_LIMIT_GLOBAL` | 可不设，默认 300 | 全站 10 分钟内最多新开几份 |

   `DB_*` 沿用现有的。**不要**在 Production 设 `AC1_HS_STORE=memory`，否则正式问卷会报“暂时无法开始”。
6. **部署**：推送后 Vercel 自动部署，或在 Vercel 的 Deployments 里对最新提交点 Redeploy。新增环境变量后必须重新部署才生效。
7. **线上验证**：打开 `https://<你的域名>/ac1test`，自己完整填一份。这一份会作为正式答卷存下来，记下提交时间，分析时按时间剔除。
8. **发链接**：只发 `/ac1test`，不要带 `?mode=test`。

各环境的行为：

| 环境 | 正式模式 `/ac1test` | 测试模式 `?mode=test` |
| --- | --- | --- |
| 本地 | 需要数据库 | 内存；加 `AC1_HS_LOCAL_TEST_MYSQL=1` 才写库 |
| Vercel Preview | 关闭；`AC1_HS_ALLOW_PREVIEW_STUDY=1` 才开 | 关闭；`AC1_HS_ALLOW_TEST_MODE=1` 才开，且只用内存 |
| Vercel Production | 开，写数据库 | 始终关闭 |

Preview 上的测试模式用的是单个函数实例的内存，实例一换会话就丢，只适合看页面，不适合验证流程。

## 导出答卷

```powershell
curl.exe -H "x-ac1-hs-export-token: <口令>" "https://<你的域名>/api/ac1test/export?format=csv&mode=study" -o ac1-hs-export.csv
```

只导出已提交的问卷。每行是“一份问卷 × 一段摘抄 × 一个标签”：

| 列 | 含义 |
| --- | --- |
| `ticked` | 1 = 被勾选（合适），0 = 没勾（不合适） |
| `none_selected` | 该段是否选了「都不合适」 |
| `from_deepseek_flash`、`from_gpt_6_luna_low`、`from_gpt_6_luna_medium` | 这个标签是哪些配置给出的（可以多个） |
| `disclosure_shown` | 作答时页面上是否有 AI 提示 |
| `experimental_group`、`section`、`position` | 分组、第几页、第几段 |
| `quality_flags` | `fast_completion`（不到 2 分钟提交）、`all_none`（10 段全选都不合适）、`all_ticked`（所有标签全勾）、`creation_burst`。只是标记，不会自动剔除 |

某个配置的认可率 = 该配置给出的标签里 `ticked=1` 的比例。

## 已验证和未验证

已验证（实测）：

- `pnpm test` 231 个测试通过，其中本问卷 20 个；`pnpm typecheck` 通过；`pnpm build` 成功。
- 构建产物里题库在服务端包中，浏览器包里搜不到来源编号和题库内容。
- 本地浏览器（内存存储）走完：同意页 → 勾选和取消 → 「都不合适」与勾选互斥 → 漏答拦截和提示 → 翻页与返回 → 刷新后恢复 → 提交确认 → 完成页 → 重复提交被拒 → 无口令导出返回 404 → 多余字段被拒。桌面和手机宽度都看过。
- 接口返回里没有来源信息。

未验证：

- MySQL 存储（建会话、草稿、提交、限流、导出）没有在真实数据库上执行过。上线步骤第 4 步就是为此。
- 没有在 Vercel 上部署过；并发下的分组均衡只在内存模拟里测过。
- 没有真人试填，8–12 分钟的预计时长沿用上一版，没有重新估。

## 需要知道的

- 修辞和描写手法的术语（如“侧面描写”“排比”）没有给定义，普通读者可能不熟。
- 题库里 20 段有 2 段只有主题标签，2 段只有 2 个标签。
- 开发时终端会刷大量 `Duplicated imports` 警告：`ac1hs` 和 `el2hs` 有同名导出，Nitro 的自动导入会报重名。两套代码都用显式 import，不受影响。
- 上一版 `/el2test` 的题库是运行时从 `research/` 读文件，在 Vercel 的无服务器函数里很可能读不到。这次没有动它。
