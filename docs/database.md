# pgWhite 数据库交接说明

本文给协作者说明：**库在哪、表怎么拆、为什么这样拆、本地怎么连、数据从哪来**。  
仓库里**没有**已提交的 `CREATE TABLE` 脚本；真实 DDL 目前只存在于本机、且被 gitignore。下面把现状和原因写清楚，避免下一个人再猜。

---

## 1. 先说结论：schema 在哪

| 文件 | Git 状态 | 作用 |
|------|----------|------|
| `pgwhite DDL.sql` | **被 `.gitignore` 忽略**，只在本机 | 建库 `pgwhite` + 全部表结构。含 `DROP DATABASE IF EXISTS`，执行会清空整个库。 |
| `pgwhite_testing_data.sql` | **同样被 gitignore** | Demo 数据（来自早期 `data/*.json`）。会 `TRUNCATE` 再插入，可重复跑。 |
| `pgwhite_weread_import.sql` | **已进仓库** | 微信读书划线的**增量 INSERT**，不是建表脚本。 |
| `data/*.json` | 已进仓库 | 最早的前端静态数据集。筛选栏和卡片文案**不再以它为准**。 |
| `.env.example` | 已进仓库 | 连接变量模板。真实密码只放 `.env`（已 gitignore）。 |

所以：

- **协作者 clone 下来，拿不到建表 SQL。** 表结构以本文第 4 节为准；本机若还有 `pgwhite DDL.sql`，以那个文件为权威。
- **线上 Railway 里已经按这套表在跑。** 应用代码（`server/api/*.ts`）是按规范化表写的，不是按一张大 `quotes` 表写的。

建议后续把 DDL **去掉 `DROP DATABASE`** 后提交进仓库（例如 `docs/pgwhite.schema.sql`），否则新环境只能靠人工拷贝。当前忽略它，多半是因为脚本会整库销毁，不适合随手执行。

---

## 2. 产品要什么，所以库长这样

pgWhite 是读者向的**多维 quote 库**，不是普通全文搜索框。一条 quote 要能按这些 context 被找到：

- 作者 / 书 / 人物
- 场景时间 / 主题 / 修辞
- 当前语言下的正文（中 / 英）
- 可选的全文子串

前端（Vercel 上的 Nuxt）**不直连数据库**。浏览器只打：

- `GET /api/facets?lang=zh|en` — 筛选栏选项
- `GET /api/quotes?...` — 分页检索
- `GET /api/quote-count` — 早期连库探活（`SELECT COUNT(*) FROM quotes`）

Nitro 服务端用 `mysql2` 连接池查 Railway MySQL。敏感信息走 `runtimeConfig` / 环境变量，不会打进前端包。

### 为什么不用「一张 quotes 表塞所有字段」

早期 API 草稿曾经假设：

```text
quotes(id, text, language, author_id, book_id, character_ids JSON, ...)
```

真实库不是这样。实体与译文拆开，原因是：

1. **中英切换时，作者、书、人物、标签、正文是同一条记录的不同语言行**，不应复制整棵对象树。
2. 一条 quote 可以只有中文、暂无英文；筛选某语言时用 `INNER JOIN ... language_code = ?`，缺译文的行自然不会出现。
3. 人物、标签是多对多，JSON 数组会让筛选、约束、去重都变差。
4. 场景时间 / 主题 / 修辞语义相近（都是「打在 quote 上的标签」），用一张 `tags` + `source_code` 区分种类，避免三套几乎相同的表。

这是**有意的规范化**，不是历史包袱。改 API 去迁就这套表，而不是把库压扁成 JSON 列。

---

## 3. 部署与连接

### 3.1 谁跑在哪

```text
浏览器  →  Nuxt（Vercel 或本地 pnpm dev）
                │
                │  server/utils/db.ts（mysql2 连接池）
                ▼
           Railway MySQL（库名 pgwhite）
```

Railway 会自带一个默认库名 `railway`。**应用必须连 `pgwhite`，不要连空的 `railway`。**  
曾经出现过 `Table 'railway.authors' doesn't exist`：连接成功了，但连错库、表还没建。

### 3.2 环境变量

`.env.example` 里这五项是必填：

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=pgwhite
```

Railway Variables 常见对应关系：`MYSQLHOST` → `DB_HOST`，其余同理。本地开发用 **Public Networking** 的 host（`*.proxy.rlwy.net`）+ 公网端口；不要用只有内网才通的 `mysql.railway.internal`。

可选（`nuxt.config.ts` 的 `runtimeConfig`）：

| 变量 | 默认 | 含义 |
|------|------|------|
| `DB_LANG_ZH` / `DB_LANG_EN` | `zh` / `en` | 与 `*_translations.language_code` 对齐 |
| `TAG_KIND_COLUMN` | `source_code` | tags 上「种类」列名 |
| `TAG_KIND_TIME` / `THEME` / `DEVICE` | `1` / `2` / `3` | 种类数值 |
| `DB_SSL` | 见下 | 强制开/关 SSL |

`server/utils/db.ts`：host 含 `.rlwy.net` 或 `railway.app` 时默认开 SSL（`rejectUnauthorized: false`），因为 Railway 公网代理通常要求 SSL。本地直连无 SSL 的 MySQL 时不要误开。

连接池：`connectionLimit: 10`，`connectTimeout: 20s`，各 API 共用同一个 pool。

### 3.3 空库怎么建（有 DDL 的人）

1. Workbench 连上 Railway 公网地址。
2. 执行 `pgwhite DDL.sql`（会 `DROP` 再 `CREATE DATABASE pgwhite`）。
3. 需要 demo 数据再执行 `pgwhite_testing_data.sql`。
4. `.env` 里 `DB_NAME=pgwhite`，重启 `pnpm dev`。

**不要在已有生产数据的库上重跑 DDL。** 它会删掉整个 `pgwhite`。

---

## 4. Schema（与本机 DDL 一致）

字符集：库级 `utf8mb4` / `utf8mb4_unicode_ci`，为了中文和 emoji。  
引擎：InnoDB。外键一律 `ON DELETE CASCADE`：删作者会级联删书、人物、quote 及其译文和关联。

```text
authors 1 ──< books 1 ──< quotes
                │            │
                │            ├──< quote_characters >── characters（characters.book_id → books）
                │            └──< quote_tags        >── tags（source_code = 1|2|3）
                │
                └── 各实体另有 *_translations（language_code + 文案）
```

### 4.1 实体表（无文案，只有稳定 id 和 emoji）

**`authors`**：`id` PK，`emoji`（国旗等，`VARCHAR(8)`）。

**`books`**：`id` PK，`author_id` → authors，`emoji`。一本书只属于一位作者。

**`characters`**：`id` PK，`book_id` **NOT NULL** → books，`emoji`。人物挂在书上，不挂在 quote 上；quote 通过下面的关联表引用人物。

**`tags`**：`id` PK，`source_code INT(1)`，`emoji`。

`source_code` 不是三张表，而是同表三种类：

| 值 | 前端维度 | 说明 |
|----|----------|------|
| `1` | times | 场景时间 |
| `2` | themes | 主题 |
| `3` | devices | 修辞 |

`INT(1)` 只是显示宽度，**并不限制只能 1 位数**。约束靠约定和 API 的 `TAG_KIND_*`。  
历史上 API 一度把列名默认成 `kind`；**真实列名是 `source_code`**，所以现在 `TAG_KIND_COLUMN` 默认就是 `source_code`。

**`quotes`**：`id` PK，`book_id` → books。  
没有 `chapter`、没有 `language`、没有正文。正文在译文表。作者通过 `quotes.book_id → books.author_id` 间接得到。

### 4.2 译文表（联合主键：实体 id + 语言）

`language_code CHAR(2)`，现用 `zh` / `en`。

| 表 | 文案列 |
|----|--------|
| `author_translations` | `name` |
| `book_translations` | `title` |
| `character_translations` | `name` |
| `tag_translations` | `tag_name` |
| `quote_translations` | `content` TEXT |

同一 quote 可以只有 `zh` 行。微信读书导入就是这样做的：只写中文，英文以后再补。`/api/quotes?lang=en` 用 INNER JOIN，没有英文行的 quote **不会出现在英文列表里**。

### 4.3 关联表

**`quote_characters`** `(quote_id, character_id)`：一条 quote 多个人物。

**`quote_tags`** `(quote_id, tag_id)`：一条 quote 多个标签；种类由 `tags.source_code` 决定，关联表本身不存种类。

### 4.4 建表 SQL（供没有 gitignored 文件时对照）

与本机 `pgwhite DDL.sql` 等价，但把开头的 `DROP DATABASE` 改成了 `CREATE DATABASE IF NOT EXISTS`，避免交接文档变成毁库脚本。

```sql
CREATE DATABASE IF NOT EXISTS pgwhite
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pgwhite;

CREATE TABLE authors (
  id INT AUTO_INCREMENT,
  emoji VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE books (
  id INT AUTO_INCREMENT,
  author_id INT,
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (id),
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE characters (
  id INT AUTO_INCREMENT,
  book_id INT NOT NULL,
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tags (
  id INT AUTO_INCREMENT,
  source_code INT(1),
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quotes (
  id INT AUTO_INCREMENT,
  book_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE author_translations (
  author_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (author_id, language_code),
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE book_translations (
  book_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  title VARCHAR(255) NOT NULL,
  PRIMARY KEY (book_id, language_code),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE character_translations (
  character_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (character_id, language_code),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tag_translations (
  tag_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (tag_id, language_code),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quote_translations (
  quote_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (quote_id, language_code),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quote_characters (
  quote_id INT NOT NULL,
  character_id INT NOT NULL,
  PRIMARY KEY (quote_id, character_id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quote_tags (
  quote_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (quote_id, tag_id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

当前 **没有** 除主键/外键以外的二级索引。`quote_translations.content` 的 `LIKE %...%` 全文检索在数据量变大后会慢，这是已知取舍，不是遗漏的「半成品索引」。

---

## 5. 两套 ID，不要混用

| 来源 | ID 形态 | 例子 |
|------|---------|------|
| `data/*.json`（早期前端） | 字符串 slug | `a_ishiguro`、`b_nocturnes`、`s_zh_11` |
| MySQL | 自增整数 | `1`、`2`、`119` |
| API JSON | 把整数转成字符串 | `"1"`、`"119"` |

测试数据导入时的对照（JSON → 库）：

- 作者：`a_ishiguro`→1，`a_hesse`→2，`a_granin`→3，`a_krasznahorkai`→4
- 书：`b_nocturnes`→1，`b_siddhartha`→2，`b_strange_life`→3，`b_satan_tango`→4
- 前 118 条 quote 对应 `sentences.json`

曾经出现「接口有句子、卡片上没有 tag」：前端用 JSON 的 slug 去 `Map.get(数字 id)`，对不上就整条标签被跳过。因此现在：

- 筛选选项来自 **`/api/facets`**，注释写明与 `data/*.json` 无关。
- `/api/quotes` 的每条 item 带 **`display`**：当前语言下的作者名、书名、人物、三类标签（含 emoji）。卡片优先用 `display`，不再靠本地 JSON 翻名字。

`composables/useDataset.ts` 仍会 import JSON，主要是历史/本地查找残留。新功能不要再把 JSON id 当成数据库 id。

---

## 6. API 与筛选语义

实现：`server/api/quotes.get.ts`、`server/api/facets.get.ts`。种类列封装在 `server/utils/tagKind.ts`。

筛选规则与 `composables/useFilterEngine.ts` 对齐：

- **未选作者**：作者 / 书 / 人物 / 三类标签 / 全文，维度之间 **AND**。
- **已选至少一位作者**：作者 ∪ 书 ∪ 人物 为 **OR**（例如选了作者 A 又选了非 A 的书 B → A 的全部 ∪ B 的全部），再与全文、标签维度 AND。
- **同一维度多选**：默认 OR（SQL `IN`）。
- **timesAll / themesAll / devicesAll**：该维度改为 AND（每条 id 一次 `EXISTS`）。
- 全文：`LOWER(qt.content) LIKE %q%`。
- 列表按 `q.id` 升/降序，分页 `page` / `pageSize`（最大 100）。

标签聚合用 `LEFT JOIN` + `JSON_ARRAYAGG`，避免对每一行再跑相关子查询。

---

## 7. 数据从哪来

### 7.1 Demo（本机 gitignored SQL）

`pgwhite_testing_data.sql`：4 作者、4 书、8 人物、28 标签、118 条 quote，并写入 `quote_characters` / `quote_tags`。  
生成脚本 `scripts/generate-testing-data.mjs` 曾经写过，**当前仓库里已经不在了**；不要假设还能 `node` 出来。

### 7.2 微信读书增量导入（在仓库里）

`scripts/generate-weread-batch-import.mjs` → `pgwhite_weread_import.sql`。

约定（写在 SQL 文件头）：

- 只导入划线 `markText`，不要想法、不要书签。
- 每条 quote **只写 `quote_translations.zh`**，暂不写 `en`。
- **不写** `quote_characters` / `quote_tags`。卡片因此只显示作者+书名（见 `useSentenceTags.hasSecondaryTags`）。
- 起始 id：作者 5、书 5、quote **119**（接在 testing data 的 118 后面）。执行前确认 `MAX(quotes.id) < 119`，否则会主键冲突。
- 石黑一雄复用 `authors.id=1`，黑塞复用 `id=2`；其余作者从 5 起新建。
- 需要 `.env` 里的 `WEREAD_API_KEY`（不要提交）。

这是增量 INSERT，**没有** `ON DUPLICATE KEY`。同一文件跑两遍会主键冲突。testing data 脚本会 TRUNCATE，和 weread 导入不是同一套安全策略。

---

## 8. 协作时容易踩的坑

1. **连上了但没表**：`DB_NAME` 仍是 `railway`，或还没执行过 DDL。
2. **重跑 DDL 清库**：文件以 `DROP DATABASE IF EXISTS pgwhite` 开头。
3. **语言码 / 种类列**：默认 `zh`/`en` 和 `source_code` 1/2/3。库若不同，改环境变量，不要先改表。
4. **英文列表变少**：很多 weread quote 没有 `en` 译文，这是数据状态，不是筛选 bug。
5. **JSON 与 DB 两套 id**：URL、筛选、API 一律用数据库整数（字符串形式的 `"1"`）。
6. **emoji 列偏短**：`authors.emoji` 只有 `VARCHAR(8)`。复合 emoji 若插入失败，先看这一列。
7. **CASCADE**：删一本 `books` 会删掉其 quotes、人物及相关译文。没有软删除。

---

## 9. 建议的后续（不是当前行为）

这些还没做，写在这里以免重复踩坑后以为「文档漏了」：

- 把无破坏性的 schema SQL 提交进 git。
- 给 `quote_tags(quote_id)`、`quote_characters(quote_id)`、`quote_translations(language_code)` 补索引。
- 英文译文补齐策略（机翻占位 vs 人工）。
- 导入改为幂等（`INSERT ... ON DUPLICATE KEY UPDATE` 或先查 MAX(id)）。
- 从 JSON 生成 testing SQL 的脚本若还需要，应重新放进 `scripts/` 并纳入版本管理。
