/**
 * Resolve author/book for EL2 quotes.
 *
 * Matching algorithm (documented; no fuzzy edits to frozen text):
 * 1. Exact UTF-8 equality of frozen `text_zh` against
 *    `pgwhite_weread_import.sql` `quote_translations.content` (zh).
 * 2. Exact UTF-8 equality against `research/annotation-workbench/fixtures/benchmark.v1.json`
 *    `textZh` / `productionQuoteTextZh`.
 * 3. Join SQL `quotes.book_id` → `book_translations` / `author_translations`.
 *    Authors 1 and 2 are reused in the WeRead dump without INSERTs; fill their
 *    names only from the annotation fixture by matching `bookId`.
 * 4. Ambiguous if more than one production quote_id or disagreeing author/book.
 * 5. Unresolved if no exact hit. Do not invent names. Do not drop the quote.
 */

function unescapeSql(value) {
  return String(value).replace(/''/g, "'");
}

function parseNamedInserts(sql, table, columns) {
  const colList = columns.join(", ");
  const rows = [];
  const re = new RegExp(
    `INSERT INTO ${table} \\(${colList}\\) VALUES ([^;]+);`,
    "g",
  );
  for (const match of sql.matchAll(re)) {
    const body = match[1];
    for (const tuple of body.matchAll(/\(([^)]*)\)/g)) {
      rows.push(tuple[1]);
    }
  }
  return rows;
}

export function parseWereadImportSql(sql) {
  const authors = new Map();
  for (const raw of parseNamedInserts(sql, "author_translations", ["author_id", "language_code", "name"])) {
    const m = raw.match(/^(\d+),\s*'([a-z]+)',\s*'((?:[^']|'')*)'$/);
    if (!m) continue;
    if (m[2] !== "zh") continue;
    authors.set(Number(m[1]), unescapeSql(m[3]));
  }
  const books = new Map();
  for (const raw of parseNamedInserts(sql, "books", ["id", "author_id", "emoji"])) {
    const m = raw.match(/^(\d+),\s*(\d+),/);
    if (!m) continue;
    books.set(Number(m[1]), { book_id: Number(m[1]), author_id: Number(m[2]), title_zh: null });
  }
  for (const raw of parseNamedInserts(sql, "book_translations", ["book_id", "language_code", "title"])) {
    const m = raw.match(/^(\d+),\s*'([a-z]+)',\s*'((?:[^']|'')*)'$/);
    if (!m) continue;
    if (m[2] !== "zh") continue;
    const bookId = Number(m[1]);
    const row = books.get(bookId) ?? { book_id: bookId, author_id: null, title_zh: null };
    row.title_zh = unescapeSql(m[3]);
    books.set(bookId, row);
  }
  const quoteBook = new Map();
  for (const raw of parseNamedInserts(sql, "quotes", ["id", "book_id"])) {
    const m = raw.match(/^(\d+),\s*(\d+)$/);
    if (!m) continue;
    quoteBook.set(Number(m[1]), Number(m[2]));
  }
  const quotes = [];
  const byText = new Map();
  const contentRe = /INSERT INTO quote_translations \(quote_id, language_code, content\) VALUES \((\d+), 'zh', '((?:[^']|'')*)'\);/g;
  for (const match of sql.matchAll(contentRe)) {
    const quoteId = Number(match[1]);
    const text = unescapeSql(match[2]);
    const bookId = quoteBook.get(quoteId) ?? null;
    const book = bookId == null ? null : books.get(bookId);
    const row = {
      production_quote_id: quoteId,
      book_id: bookId,
      author_id: book?.author_id ?? null,
      book_title_zh: book?.title_zh ?? null,
      author_name_zh: book?.author_id == null ? null : (authors.get(book.author_id) ?? null),
      text_zh: text,
      provenance: "pgwhite_weread_import.sql",
    };
    quotes.push(row);
    const list = byText.get(text) ?? [];
    list.push(row);
    byText.set(text, list);
  }
  return { authors, books, quotes, byText };
}

export function indexAnnotationFixture(fixture) {
  const byText = new Map();
  const byBookId = new Map();
  for (const quote of fixture.quotes ?? []) {
    const texts = [...new Set([quote.textZh, quote.productionQuoteTextZh].filter(Boolean))];
    for (const text of texts) {
      const list = byText.get(text) ?? [];
      if (!list.some((row) => row.quoteId === quote.quoteId)) list.push(quote);
      byText.set(text, list);
    }
    if (quote.bookId != null) {
      const list = byBookId.get(quote.bookId) ?? [];
      if (!list.some((row) => row.quoteId === quote.quoteId)) list.push(quote);
      byBookId.set(quote.bookId, list);
    }
  }
  return { byText, byBookId };
}

function uniqueNames(values) {
  return [...new Set(values.filter((v) => v != null && String(v).length > 0))];
}

export function resolveAttribution({ textZh, weread, annotationIndex }) {
  const sqlHits = weread.byText.get(textZh) ?? [];
  const fixtureHits = annotationIndex.byText.get(textZh) ?? [];
  const issues = [];

  let author = null;
  let book = null;
  let productionQuoteId = null;
  let bookId = null;
  let authorId = null;
  const provenances = [];

  if (sqlHits.length > 1) {
    issues.push(`ambiguous_weread_quote_ids:${sqlHits.map((h) => h.production_quote_id).join(",")}`);
  }
  if (fixtureHits.length > 1) {
    const ids = uniqueNames(fixtureHits.map((h) => h.quoteId));
    if (ids.length > 1) issues.push(`ambiguous_fixture_quote_ids:${ids.join(",")}`);
  }

  if (sqlHits.length === 1) {
    const hit = sqlHits[0];
    productionQuoteId = hit.production_quote_id;
    bookId = hit.book_id;
    authorId = hit.author_id;
    book = hit.book_title_zh;
    author = hit.author_name_zh;
    provenances.push(`weread_sql:quote_id=${hit.production_quote_id}`);
    if (!author && hit.book_id != null) {
      const bookPeers = annotationIndex.byBookId.get(hit.book_id) ?? [];
      const names = uniqueNames(bookPeers.map((q) => q.authorNameZh));
      const titles = uniqueNames(bookPeers.map((q) => q.bookTitleZh));
      if (names.length === 1) {
        author = names[0];
        provenances.push(`annotation_fixture:author_via_book_id=${hit.book_id}`);
      } else if (names.length > 1) {
        issues.push(`ambiguous_author_for_book_id:${hit.book_id}`);
      }
      if (!book && titles.length === 1) book = titles[0];
    }
  } else if (sqlHits.length === 0 && fixtureHits.length === 1) {
    const hit = fixtureHits[0];
    productionQuoteId = hit.quoteId;
    bookId = hit.bookId ?? null;
    book = hit.bookTitleZh ?? null;
    author = hit.authorNameZh ?? null;
    provenances.push(`annotation_fixture:quoteId=${hit.quoteId}`);
  } else if (sqlHits.length === 0 && fixtureHits.length === 0) {
    issues.push("no_exact_text_match");
    for (const [text, rows] of weread.byText) {
      if (text.startsWith(textZh) && text.length > textZh.length) {
        issues.push(`near_miss_weread_prefix:quote_id=${rows.map((r) => r.production_quote_id).join(",")};not_used`);
      }
    }
    for (const [text, rows] of annotationIndex.byText) {
      if (text.startsWith(textZh) && text.length > textZh.length) {
        issues.push(`near_miss_fixture_prefix:quoteId=${rows.map((r) => r.quoteId).join(",")};not_used`);
      }
    }
  }

  if (sqlHits.length === 1 && fixtureHits.length >= 1) {
    const authorsFix = uniqueNames(fixtureHits.map((h) => h.authorNameZh));
    const booksFix = uniqueNames(fixtureHits.map((h) => h.bookTitleZh));
    if (author && authorsFix.length === 1 && authorsFix[0] !== author) {
      issues.push(`author_conflict:sql=${author};fixture=${authorsFix[0]}`);
    }
    if (book && booksFix.length === 1 && booksFix[0] !== book) {
      issues.push(`book_conflict:sql=${book};fixture=${booksFix[0]}`);
    }
    if (!author && authorsFix.length === 1) {
      author = authorsFix[0];
      provenances.push("annotation_fixture:author_from_exact_text");
    }
    if (!book && booksFix.length === 1) {
      book = booksFix[0];
      provenances.push("annotation_fixture:book_from_exact_text");
    }
  }

  const complete = Boolean(author && book) && issues.length === 0;
  let verification_status = "verified";
  if (!complete) {
    verification_status = issues.some((i) => i.startsWith("no_exact"))
      ? "unresolved"
      : issues.some((i) => i.includes("conflict") || i.startsWith("ambiguous"))
        ? "conflict"
        : "incomplete";
  }

  return {
    author_name_zh: author,
    book_title_zh: book,
    production_quote_id: productionQuoteId,
    book_id: bookId,
    author_id: authorId,
    provenance: provenances,
    sql_hit_count: sqlHits.length,
    fixture_hit_count: fixtureHits.length,
    issues,
    verification_status,
    complete,
  };
}

function applyHumanOverride(row, override) {
  if (!override) return row;
  const issues = [
    ...row.issues,
    "human_adjudicated_non_exact_text",
    `text_relationship:${override.text_relationship}`,
  ];
  return {
    ...row,
    author_name_zh: override.author_name_zh,
    book_title_zh: override.book_title_zh,
    production_quote_id: override.production_quote_id ?? row.production_quote_id,
    book_id: override.book_id ?? row.book_id,
    author_id: override.author_id ?? row.author_id,
    provenance: [...row.provenance, "human-attribution-overrides.v1.json"],
    issues,
    verification_status: "human_adjudicated",
    complete: Boolean(override.author_name_zh && override.book_title_zh),
  };
}

export function attributeQuotes({ quoteRows, wereadSql, annotationFixture, humanOverrides = {} }) {
  const weread = parseWereadImportSql(wereadSql);
  const annotationIndex = indexAnnotationFixture(annotationFixture);
  return quoteRows.map((quote) => {
    const resolved = resolveAttribution({ textZh: quote.text_zh, weread, annotationIndex });
    return applyHumanOverride({
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      ...resolved,
    }, humanOverrides[quote.quote_id]);
  });
}
