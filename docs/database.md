# pgWhite 数据库交接说明

本文给协作者说明：**库在哪、表怎么拆、schema 如何演进、本地怎么连、数据从哪来**。

**从 Sprint 0 起，schema 的权威演进历史是 `database/migrations/`。**  
遗留的本机 `pgwhite DDL.sql`（gitignore，含 `DROP DATABASE`）仅作考古参考，**不要再对共享/生产库执行**。

---

## 1. Schema 源真相（Source of truth）

| 资产 | 角色 |
|------|------|
| `database/migrations/*.sql` | **权威** schema 演进；按版本顺序应用 |
| `schema_migrations` 表 | 记录已应用的 migration version |
| `scripts/migrate.mjs` | 迁移 runner（status / up / mark / new） |
| `database/README.md` | 迁移命令与安全约定 |
| Railway MySQL `pgwhite` | 运行时数据 + 已应用 schema |
| `pgwhite DDL.sql`（本地、gitignore） | 历史破坏性建库脚本；已由 baseline migration 取代 |
| `pgwhite_testing_data.sql`（gitignore） | Demo seed（TRUNCATE）；非 schema |
| `pgwhite_weread_import.sql` | WeRead **Import** 增量 INSERT（已进仓库） |
| `data/*.json` | 早期前端静态数据；筛选栏以 API 为准 |

### 1.1 迁移怎么用

```bash
pnpm db:migrate:status          # 已应用 / 待应用
pnpm db:migrate                 # 应用 pending（已应用的不会重跑）
pnpm db:migrate:mark 0001       # 只记账、不跑 SQL（库已有表时）
pnpm db:migrate:new add_foo         # 新建空 migration 文件
pnpm db:seed:dev-users              # 幂等写入 R&D users（非认证；远端需 MIGRATE_ALLOW_REMOTE=1）
```

远端（Railway / `*.rlwy.net`）默认拒绝**写**操作，需：

```bash
MIGRATE_ALLOW_REMOTE=1 pnpm db:migrate
```

现有生产库若表已存在：可先 `MIGRATE_ALLOW_REMOTE=1 pnpm db:migrate`（baseline 为 `CREATE TABLE IF NOT EXISTS`，并写入 `schema_migrations`），或 `db:migrate:mark 0001` 仅记账。

详细说明见 [`database/README.md`](../database/README.md)。

### 1.2 环境隔离

| 环境 | 连接 | 注意 |
|------|------|------|
| Production | Railway `DB_*` | 迁移需 `MIGRATE_ALLOW_REMOTE=1` |
| Development | 本地 MySQL 或个人远端 | 不要把测试指到生产 |
| Tests（`pnpm test`） | **不连库** | Sprint 0 为纯 unit tests |

---

## 2. 产品与表设计（未改语义）

pgWhite 是读者向的**多维 quote 库**。实体与译文拆开：

1. 中英切换时同一实体多语言行，不复制对象树。  
2. 允许只有 `zh`、暂无 `en`；`lang=en` 时 `INNER JOIN quote_translations` → 无英文行的 quote **不出现**（当前行为，已有回归测试）。  
3. 人物/标签多对多。  
4. 场景时间 / 主题 / 修辞共用 `tags.source_code` = 1 / 2 / 3。

前端不直连库：`GET /api/facets`、`GET /api/quotes`、`GET /api/quote-count`。

**术语：** WeRead 划线进入 PGWhite 叫 **Import**，不是 Favorite/收藏。

---

## 3. 部署与连接

```text
浏览器 → Nuxt（Vercel 或 pnpm dev）→ server/utils/db.ts → Railway MySQL（pgwhite）
```

必填：`DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME=pgwhite`。  
不要连空的默认库 `railway`。

可选：`DB_LANG_ZH/EN`、`TAG_KIND_COLUMN`（默认 `source_code`）、`TAG_KIND_TIME/THEME/DEVICE`、`DB_SSL`。

`server/utils/db.ts`：host 含 `.rlwy.net` / `railway.app` 时默认 SSL。

**空库（新环境）：** 创建空数据库 `pgwhite` → 配置 `DB_*` → `pnpm db:migrate`（应用 baseline）。  
**不要**对有数据的库执行旧版 `pgwhite DDL.sql`。

---

## 4. Schema（与 baseline migration / Railway 对齐）

表集合（Sprint 0 验证）：

`authors`, `books`, `characters`, `tags`, `quotes`,  
`author_translations`, `book_translations`, `character_translations`, `tag_translations`, `quote_translations`,  
`quote_characters`, `quote_tags`

另：runner 维护 `schema_migrations`。

```text
authors 1 ──< books 1 ──< quotes
                │            ├──< quote_characters >── characters
                │            └──< quote_tags        >── tags (source_code 1|2|3)
                └── *_translations
```

| `source_code` | 维度 |
|---------------|------|
| 1 | times（场景时间） |
| 2 | themes |
| 3 | devices（修辞） |

`quotes` 无正文/语言；正文在 `quote_translations`。作者经 `books.author_id`。

完整 DDL：`database/migrations/0001_baseline_current_schema.sql`（`IF NOT EXISTS`，无 DROP）。

### Sprint 1A 增量（Users + personal library）

| 表 | 作用 |
|----|------|
| `users` | 身份（`display_name`, `created_at`, optional `seed_key`）。**无密码/认证。** |
| `library_entries` | Personal Library Entry：`(user_id, quote_id)` UNIQUE。**不是 Favorite/收藏。** |

- 同一 `quotes.id` 可被多个用户的 `library_entries` 引用。
- 开发用户：`pnpm db:seed:dev-users`（`seed_key` 幂等）。
- 证明用 API（非生产登录）：`GET/POST /api/dev/users`、`/api/dev/library-entries`（本地默认开；生产需 `DEV_DATA_TOOLS=1`）。

### Sprint 1B 增量（Import provenance）

| 表 | 作用 |
|----|------|
| `imports` | 一次导入事件（`user_id`, `source`, `status`, timestamps, counters） |
| `import_items` | 事件中的一条外部记录（`raw_payload` JSON, nullable `library_entry_id`） |

链：`User → Import → Import Item → (optional) Library Entry → Quote`。  
Item 可无 Library Entry（failed/pending 仍保留 raw）。状态语义见 `server/utils/importStatuses.ts`。  
证明：`pnpm db:proof:import` 与 `/api/dev/imports*`、`/api/dev/import-items*`。  
**不改**现有 WeRead → SQL 人工执行流水线。

### Sprint 1C 增量（Legacy WeRead → Daniel Library）

| 变更 | 作用 |
|------|------|
| `imports.provenance_type` | `runtime`（默认）\| `reconstructed`（法医/历史重建，非原始运行时行） |
| `imports.reconstruction_key` | 重建 Import 幂等键（UNIQUE；runtime 为 NULL） |
| `library_entries.import_id` | 可选批次级来源 Import；`ON DELETE SET NULL`（删 Import 不清空 Library 成员关系） |

- Quotes **1–118**：全局 curated corpus，**不**挂 Daniel。
- Quotes **119–1287**：1169 条历史 WeRead → 各一条 Daniel `library_entries`，指向重建 Import `legacy_weread_batch_2026-07-26`。
- **0** 条 synthetic `import_items`（无逐条划线 raw）。
- 审计产物：`analysis/`（非运行时依赖）。常量见 `server/utils/legacyWereadMigration.ts`。

### Sprint 0 核查摘要

| 项 | 本机旧 DDL | Railway（SHOW CREATE） | 结论 |
|----|------------|------------------------|------|
| 12 张业务表 | 有 | 有且同名 | 一致 |
| `tags.source_code` | `INT(1)` | `int` | 语义一致；显示宽度无影响 |
| 表 collation | 脚本偏 `unicode_ci` | 多为 `utf8mb4_0900_ai_ci` | 不影响当前查询 |
| 破坏性 DROP | 旧 DDL 有 | 无 | baseline **禁止** DROP |

---

## 5. 两套 ID

| 来源 | 形态 |
|------|------|
| `data/*.json` | slug（`a_ishiguro`） |
| MySQL / API | 整型，JSON 里为 `"1"` |

筛选与卡片以 `/api/facets` + `display` 为准。

---

## 6. API 与筛选语义

实现：`server/utils/quoteFilters.ts`、`quoteQueryParts.ts`、`quotes.get.ts`、`facets.get.ts`。

- 未选作者：维度间 AND  
- 已选作者：作者 ∪ 书 ∪ 人物为 OR，再与标签/全文 AND  
- 同维度多选：OR（`IN`）；`*All`：该维度 AND  
- 全文：`LIKE %q%`  
- 无 tag/人物的 quote 仍可返回（LEFT JOIN + COALESCE）— 有回归测试  

---

## 7. 数据从哪来

- Demo seed：本机 `pgwhite_testing_data.sql`（gitignore）  
- WeRead **Import**：`scripts/generate-weread-*.mjs` → SQL 文件 → 人工执行（非应用内流水线）  
- Import 只写 `zh`、不写 `quote_tags` / `quote_characters`  

---

## 8. 协作坑

1. `DB_NAME=railway` 空库  
2. 旧 DDL 的 `DROP DATABASE`  
3. 英文列表因无 `en` 译文变少（当前设计）  
4. 远端迁移忘记 `MIGRATE_ALLOW_REMOTE=1`  
5. CASCADE 删除无软删  

---

## 9. 回归测试

```bash
pnpm test          # Node test runner；不连数据库
pnpm typecheck
pnpm build
pnpm db:migrate:status
```

保护：筛选 AND/OR、`*All`、无 tag/人物仍可查询、zh-only 在 en 下 INNER JOIN 行为、WeRead SQL 生成（文本保留、无 tag）。
