# Scripture Parsing Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Korean chapter/verse notation, preserve combined source-verse ranges such as Romans 9:1-2, and remove all BSKorea annotation DOM from preview and PPT text.

**Architecture:** Add one pure notation normalizer shared by both reference parsers. Treat every fetched scripture row as an inclusive `verseStart`–`verseEnd` block throughout provider selection, preview labeling, and weighted pagination. Remove BSKorea annotation anchors and note bodies structurally in the provider before extracting text.

**Tech Stack:** TypeScript, Vitest, Cheerio, Next.js 16, pnpm

## Global Constraints

- Preserve existing abbreviated/full-name and colon-based scripture inputs.
- Preserve the user's requested reference while labeling an indivisible combined source block with its actual included range.
- Never split, duplicate, or clip combined source text.
- Remove annotation DOM at the provider boundary; do not globally strip Hangul characters with a string regex.
- Keep ordinary links and annotation-free verse text unchanged apart from existing whitespace and duplicated-verse-number normalization.
- Write and run a failing regression test before each production change.
- Do not refactor the two complete scripture parsers or the book alias maps in this change.

---

## File Structure

- Create `lib/scripture/notation.ts`: pure Korean `장`/`절` to colon notation normalization.
- Create `lib/discord-parser/parser.test.ts`: Discord line-level regression tests for the exact user input and existing syntax.
- Modify `lib/discord-parser/scripture.ts`: call the shared notation normalizer before splitting the book and range.
- Modify `lib/scripture/reference.ts`: call the same normalizer and format inclusive verse blocks.
- Modify `lib/scripture/reference.test.mjs`: Korean notation regression and loader wiring for `notation.ts`.
- Modify `lib/scripture/preview.test.ts`: loader wiring plus combined-block preview contract.
- Modify `lib/scripture/provider.ts`: remove annotation DOM, parse verse ranges, select by interval overlap, validate interval coverage.
- Modify `lib/scripture/provider.test.mjs`: realistic annotation/no-annotation fixtures and combined-range selection tests.
- Modify `lib/scripture/types.ts`: replace point-only `ScriptureVerse.verse` with required `verseStart` and `verseEnd`.
- Modify `lib/scripture/pagination.ts`: range labels, weighted page capacity, and weighted 80-verse limit.
- Modify `lib/scripture/pagination.test.mjs`: combined-block rendering and capacity regressions.

---

### Task 1: Shared Korean Chapter/Verse Notation

**Files:**
- Create: `lib/scripture/notation.ts`
- Create: `lib/discord-parser/parser.test.ts`
- Modify: `lib/discord-parser/scripture.ts`
- Modify: `lib/scripture/reference.ts`
- Modify: `lib/scripture/reference.test.mjs`
- Modify: `lib/scripture/preview.test.ts`

**Interfaces:**
- Produces: `normalizeScriptureNotation(input: string): string`
- Consumers: `splitBookAndReference()` and `splitBookAndRange()`

- [ ] **Step 1: Write failing Discord and reference tests**

Create `lib/discord-parser/parser.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { extractWorshipData } from './parser.ts';

test('normalizes a full Korean book name with chapter and verse words', () => {
  assert.deepEqual(extractWorshipData('말씀: 로마서 10장 14~21절'), {
    scripture: '롬 10:14~21',
  });
});

test('normalizes Korean single-verse and hyphen forms', () => {
  assert.deepEqual(extractWorshipData('말씀: 롬10장14절'), {
    scripture: '롬 10:14',
  });
  assert.deepEqual(extractWorshipData('말씀: 로마서 10장 14-21절'), {
    scripture: '롬 10:14~21',
  });
});

test('preserves existing colon notation behavior', () => {
  assert.deepEqual(extractWorshipData('말씀: 로마서 10:14~21'), {
    scripture: '롬 10:14~21',
  });
});
```

Append to `lib/scripture/reference.test.mjs`:

```js
test('parses Korean chapter and verse notation', async () => {
  const { parseScriptureReference, formatScriptureReference } = await loadReferenceModule();

  assert.equal(
    formatScriptureReference(parseScriptureReference('로마서 10장 14~21절')),
    '롬 10:14~21',
  );
  assert.equal(
    formatScriptureReference(parseScriptureReference('롬10장14절')),
    '롬 10:14',
  );
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm vitest run lib/discord-parser/parser.test.ts lib/scripture/reference.test.mjs
```

Expected: the new Korean `장`/`절` assertions fail because both parsers currently pass the untranslated text into their colon-only range parsers; the existing colon assertion passes.

- [ ] **Step 3: Implement the shared normalizer**

Create `lib/scripture/notation.ts`:

```ts
const KOREAN_SCRIPTURE_NOTATION =
  /^(.+?)\s*(\d+)\s*장\s*(\d+)(?:\s*[-~–—]\s*(\d+))?\s*절$/;

export function normalizeScriptureNotation(input: string): string {
  const match = input.trim().match(KOREAN_SCRIPTURE_NOTATION);
  if (!match) return input;

  const [, book, chapter, startVerse, endVerse] = match;
  const range = endVerse ? `~${endVerse}` : '';
  return `${book.trim()} ${chapter}:${startVerse}${range}`;
}
```

In `lib/discord-parser/scripture.ts`, import the helper and normalize before matching:

```ts
import { normalizeScriptureNotation } from '@/lib/scripture/notation';

function splitBookAndReference(input: string): { book: string; reference: string } | null {
  const trimmed = normalizeScriptureNotation(input).trim();
  // Keep the existing spaceMatch and noSpaceMatch branches unchanged.
}
```

In `lib/scripture/reference.ts`, import the helper and normalize before matching:

```ts
import { normalizeScriptureNotation } from './notation';

function splitBookAndRange(input: string): { book: string; range: string } {
  const trimmed = normalizeScriptureNotation(input).trim().replace(/\s+/g, ' ');
  // Keep the existing withSpace, withoutSpace, and error branches unchanged.
}
```

Update the `loadReferenceModule()` source list in `lib/scripture/reference.test.mjs` to compile `notation.ts` before `reference.ts`:

```js
const sources = [
  ['types.ts', ''],
  ['books.ts', await readFile(new URL('./books.ts', import.meta.url), 'utf8')],
  ['notation.ts', await readFile(new URL('./notation.ts', import.meta.url), 'utf8')],
  ['reference.ts', await readFile(new URL('./reference.ts', import.meta.url), 'utf8')],
];
```

Add this import rewrite to the compiled output chain:

```js
.replaceAll("from './notation';", "from './notation.mjs';")
```

Update the source list in `lib/scripture/preview.test.ts` by inserting:

```ts
['notation.ts', await readFile(new URL('./notation.ts', import.meta.url), 'utf8')],
```

before `reference.ts`, and add the same `./notation` → `./notation.mjs` import rewrite because its dynamically compiled `reference.ts` now imports `notation.ts`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
pnpm vitest run lib/discord-parser/parser.test.ts lib/scripture/reference.test.mjs lib/scripture/preview.test.ts
```

Expected: all focused tests pass with the exact user input normalized to `롬 10:14~21`.

- [ ] **Step 5: Commit the notation change**

```bash
git add lib/scripture/notation.ts lib/discord-parser/parser.test.ts lib/discord-parser/scripture.ts lib/scripture/reference.ts lib/scripture/reference.test.mjs lib/scripture/preview.test.ts
git commit -m "feat: parse Korean scripture notation"
```

---

### Task 2: Structural BSKorea Annotation Removal

**Files:**
- Modify: `lib/scripture/provider.test.mjs`
- Modify: `lib/scripture/provider.ts`

**Interfaces:**
- Consumes: BSKorea verse HTML.
- Produces: `ScriptureVerse.text` without `a.comment` markers or `D_*`/`D1`–`D6` note bodies.

- [ ] **Step 1: Add realistic failing annotation and control fixtures**

Append to `lib/scripture/provider.test.mjs`:

```js
test('removes Hangul and numeric annotation anchors with their note bodies', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(
    `
      <div class="leftCont">
        <span>
          <span class="number">8&nbsp;&nbsp;&nbsp;</span>
          성경에 기록된 대로 <font size="2"><a class="comment"><font size="2">ㄱ)</font></a></font>네 이웃을 사랑하라
          <font size="2"><a class="comment"><font size="2">1)</font></a></font> 하셨느니라
          <div id="D_8_1" class="D2">레 19:18</div>
          <div id="D_8_2" class="D3">또는 다른 번역</div>
        </span>
        <span>
          <span class="number">9&nbsp;&nbsp;&nbsp;</span>
          <font size="2"><a class="comment"><font size="2">ㅂ)</font></a></font>본문 시작 관주와
          문장 중간 <a class="comment"><font size="2">ㅌ)</font></a>관주
        </span>
      </div>
    `,
    john,
    2,
  );

  assert.deepEqual(verses.map((item) => item.text), [
    '성경에 기록된 대로 네 이웃을 사랑하라 하셨느니라',
    '본문 시작 관주와 문장 중간 관주',
  ]);
});

test('leaves annotation-free text and ordinary links intact', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(
    `
      <div class="leftCont">
        <span><span class="number">1&nbsp;&nbsp;&nbsp;</span>관주 없는 본문 그대로</span>
        <span><span class="number">2&nbsp;&nbsp;&nbsp;</span><a href="/bible">일반 링크 본문</a> 유지</span>
      </div>
    `,
    john,
    2,
  );

  assert.deepEqual(verses.map((item) => item.text), [
    '관주 없는 본문 그대로',
    '일반 링크 본문 유지',
  ]);
});
```

Keep the existing bare numeric `<font size="2">1)</font>` fixture unchanged as a legacy fallback regression.

- [ ] **Step 2: Run the provider test and verify RED**

Run:

```bash
pnpm vitest run lib/scripture/provider.test.mjs
```

Expected: the annotation test fails because `ㄱ)`, `ㅂ)`, and `ㅌ)` remain in text; the annotation-free control test and existing numeric fixture pass.

- [ ] **Step 3: Remove marker anchors structurally**

Add the selector beside `BSKOREA_NOTE_SELECTOR` in `lib/scripture/provider.ts`:

```ts
const BSKOREA_MARKER_SELECTOR = 'a.comment';
```

Remove both node classes before calling `.text()`:

```ts
const verseNode = $(element).clone();
verseNode.find(BSKOREA_MARKER_SELECTOR).remove();
verseNode.find(BSKOREA_NOTE_SELECTOR).remove();
```

Keep `cleanVerseText()`'s existing numeric `\d+\)` fallback. Do not add a `[ㄱ-ㅎ]` string replacement.

- [ ] **Step 4: Run the provider test and verify GREEN**

Run:

```bash
pnpm vitest run lib/scripture/provider.test.mjs
```

Expected: all provider tests pass; every realistic annotation marker and note body is gone, while the no-annotation and ordinary-link controls are unchanged.

- [ ] **Step 5: Commit the annotation cleanup**

```bash
git add lib/scripture/provider.ts lib/scripture/provider.test.mjs
git commit -m "fix: remove scripture annotations from provider text"
```

---

### Task 3: Inclusive Combined-Verse Blocks End to End

**Files:**
- Modify: `lib/scripture/types.ts`
- Modify: `lib/scripture/provider.ts`
- Modify: `lib/scripture/provider.test.mjs`
- Modify: `lib/scripture/reference.ts`
- Modify: `lib/scripture/preview.test.ts`
- Modify: `lib/scripture/pagination.ts`
- Modify: `lib/scripture/pagination.test.mjs`

**Interfaces:**
- Produces: `ScriptureVerse { book, chapter, verseStart, verseEnd, text }` with inclusive bounds.
- Provider selection: include a block when its range overlaps the requested range.
- Pagination: treat each block as atomic but weight it by `verseEnd - verseStart + 1`.

- [ ] **Step 1: Write failing provider range tests**

In `lib/scripture/provider.test.mjs`, replace the helper with a range-capable helper:

```js
function verse(chapter, verseStart, text = `본문 ${verseStart}`, verseEnd = verseStart) {
  return { book: john, chapter, verseStart, verseEnd, text };
}
```

Update the parsed fixture assertion to include both required bounds:

```js
assert.deepEqual(verses[0], {
  book: john,
  chapter: 3,
  verseStart: 16,
  verseEnd: 16,
  text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니',
});
```

Update the duplicated-number test assertions to:

```js
assert.equal(verses[0].verseStart, 17);
assert.equal(verses[0].verseEnd, 17);
assert.equal(verses[0].text, '유대인이라 불리는 네가 율법을 의지하며');
```

Then append:

```js
test('parses and selects an indivisible combined verse block by either endpoint', async () => {
  const { parseBskoreaChapterHtml, selectReferenceVerses } = await loadProviderModule();
  const romans = { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' };
  const blocks = parseBskoreaChapterHtml(
    `
      <div class="leftCont">
        <span><span class="number">1-2&nbsp;&nbsp;&nbsp;</span>합쳐진 1절과 2절 본문</span>
        <span><span class="number">3&nbsp;&nbsp;&nbsp;</span>3절 본문</span>
      </div>
    `,
    romans,
    9,
  );

  assert.deepEqual(
    blocks.map(({ verseStart, verseEnd }) => [verseStart, verseEnd]),
    [[1, 2], [3, 3]],
  );

  for (const requestedVerse of [1, 2]) {
    const selected = selectReferenceVerses(
      {
        book: romans,
        start: { chapter: 9, verse: requestedVerse },
        end: { chapter: 9, verse: requestedVerse },
      },
      new Map([[9, blocks]]),
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0].verseStart, 1);
    assert.equal(selected[0].verseEnd, 2);
  }

  const throughThree = selectReferenceVerses(
    {
      book: romans,
      start: { chapter: 9, verse: 1 },
      end: { chapter: 9, verse: 3 },
    },
    new Map([[9, blocks]]),
  );
  assert.deepEqual(
    throughThree.map(({ verseStart, verseEnd }) => [verseStart, verseEnd]),
    [[1, 2], [3, 3]],
  );
});
```

- [ ] **Step 2: Write failing preview and pagination contracts**

In `lib/scripture/preview.test.ts`, replace its local helper with:

```ts
function verse(
  reference: TestScriptureReference,
  verseStart: number,
  text: string,
  verseEnd = verseStart,
) {
  return {
    book: reference.book,
    chapter: reference.start.chapter,
    verseStart,
    verseEnd,
    text,
  };
}
```

Then add:

```ts
test('keeps the requested reference while labeling a combined returned block', async () => {
  const { buildScripturePreview } = await loadPreviewModule();
  const result = await buildScripturePreview('롬 9:1', async (reference: TestScriptureReference) => [
    {
      book: reference.book,
      chapter: 9,
      verseStart: 1,
      verseEnd: 2,
      text: '합쳐진 1절과 2절 본문',
    },
  ]);

  assert.equal(result.reference, '롬 9:1');
  assert.deepEqual(result.verses, [
    { label: '롬 9:1-2', text: '합쳐진 1절과 2절 본문' },
  ]);
});
```

In `lib/scripture/pagination.test.mjs`, replace its helper with:

```js
function verse(chapter, verseStart, text = `본문 ${verseStart}`, verseEnd = verseStart) {
  return { book: john, chapter, verseStart, verseEnd, text };
}
```

Update existing point-based expectations to the new helper, then add:

```js
test('renders and bounds a combined verse block without splitting it', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const romans = { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' };
  const combined = {
    book: romans,
    chapter: 9,
    verseStart: 1,
    verseEnd: 2,
    text: '합쳐진 본문',
  };

  const pages = paginateScriptureVerses([combined], 1);
  assert.deepEqual(pages, [
    {
      title: '롬 9:1-2',
      text: '1-2\t합쳐진 본문',
      verseStart: '9:1',
      verseEnd: '9:2',
    },
  ]);
});

test('weights combined blocks by covered verses for page capacity', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const blocks = [
    verse(9, 1, '합쳐진 본문', 2),
    verse(9, 3),
    verse(9, 4),
  ];

  assert.deepEqual(
    paginateScriptureVerses(blocks, 3).map((page) => page.title),
    ['요 9:1-3', '요 9:4'],
  );
  assert.deepEqual(
    paginateScriptureVerses(blocks, 1).map((page) => page.title),
    ['요 9:1-2', '요 9:3', '요 9:4'],
  );
});

test('counts covered verses rather than source blocks for the 80-verse limit', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const blocks = Array.from({ length: 40 }, (_, index) =>
    verse(119, index * 2 + 1, `본문 ${index}`, index * 2 + 2),
  );

  assert.doesNotThrow(() => paginateScriptureVerses(blocks, 5));
  assert.throws(
    () => paginateScriptureVerses([...blocks, verse(119, 81)], 5),
    /최대 80절/,
  );
});
```

- [ ] **Step 3: Run all combined-block tests and verify RED**

Run:

```bash
pnpm vitest run lib/scripture/provider.test.mjs lib/scripture/preview.test.ts lib/scripture/pagination.test.mjs
```

Expected: the provider skips `1-2`, preview cannot label ranges, and pagination counts/labels point-only records.

- [ ] **Step 4: Replace the point-only verse type**

In `lib/scripture/types.ts`, replace `ScriptureVerse` with:

```ts
export interface ScriptureVerse {
  book: ScriptureBook;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
}
```

- [ ] **Step 5: Parse and select inclusive ranges in the provider**

In `parseBskoreaChapterHtml()`, parse a single number or range and store both bounds:

```ts
const match = text.match(/^(\d+)(?:\s*[-~–—]\s*(\d+))?\s+([\s\S]+)$/);
if (!match) return;

const verseStart = Number.parseInt(match[1], 10);
const verseEnd = match[2] ? Number.parseInt(match[2], 10) : verseStart;
if (
  !Number.isFinite(verseStart) ||
  !Number.isFinite(verseEnd) ||
  verseStart < 1 ||
  verseEnd < verseStart
) return;

const rangeKey = `${verseStart}:${verseEnd}`;
if (seen.has(rangeKey)) return;

const verseText = cleanVerseText(match[3], verseStart);
if (!verseText) return;

seen.add(rangeKey);
verses.push({ book, chapter, verseStart, verseEnd, text: verseText });
```

Change `seen` to `new Set<string>()` and sort by `verseStart`, then `verseEnd`.

Replace gap validation with interval coverage:

```ts
const sorted = chapterVerses
  .filter((block) => block.chapter === chapter)
  .sort((a, b) => a.verseStart - b.verseStart || a.verseEnd - b.verseEnd);

let coveredEnd = sorted[0]?.verseEnd;
for (let index = 1; coveredEnd !== undefined && index < sorted.length; index += 1) {
  const current = sorted[index];
  if (current.verseStart > coveredEnd + 1) {
    throw missingVerseError(reference, chapter, coveredEnd + 1);
  }
  coveredEnd = Math.max(coveredEnd, current.verseEnd);
}
```

Select blocks by overlap and validate requested coverage by expanding their inclusive ranges:

```ts
const requestedStart = expectedStartVerse(reference, chapter);
const requestedEnd = chapter === reference.end.chapter
  ? reference.end.verse
  : Number.POSITIVE_INFINITY;

const selectedVerses = chapterVerses
  .filter((block) =>
    block.chapter === chapter &&
    block.verseEnd >= requestedStart &&
    block.verseStart <= requestedEnd,
  )
  .sort((a, b) => a.verseStart - b.verseStart || a.verseEnd - b.verseEnd);

const endVerse = chapter === reference.end.chapter
  ? reference.end.verse
  : selectedVerses[selectedVerses.length - 1]?.verseEnd ?? requestedStart;
const covered = new Set<number>();
for (const block of selectedVerses) {
  for (let verse = block.verseStart; verse <= block.verseEnd; verse += 1) covered.add(verse);
}
for (let verse = requestedStart; verse <= endVerse; verse += 1) {
  if (!covered.has(verse)) throw missingVerseError(reference, chapter, verse);
}
```

Remove the old point-only `expectedEndVerse()` and `presentVerses` logic.

- [ ] **Step 6: Format range labels and weighted pages**

In `lib/scripture/reference.ts`, use this type import:

```ts
import type { ScripturePoint, ScriptureReference, ScriptureVerse } from './types';
```

Replace `formatVerseLabel()`:

```ts
export function formatVerseLabel(reference: ScriptureReference, block: ScriptureVerse): string {
  const start = `${block.chapter}:${block.verseStart}`;
  if (block.verseStart === block.verseEnd) {
    return `${reference.book.abbreviation} ${start}`;
  }
  return `${reference.book.abbreviation} ${start}-${block.verseEnd}`;
}
```

In `lib/scripture/pagination.ts`, use these helpers:

```ts
function verseNumberLabel(block: ScriptureVerse): string {
  return block.verseStart === block.verseEnd
    ? String(block.verseStart)
    : `${block.verseStart}-${block.verseEnd}`;
}

function startPointLabel(block: ScriptureVerse): string {
  return `${block.chapter}:${block.verseStart}`;
}

function endPointLabel(block: ScriptureVerse): string {
  return `${block.chapter}:${block.verseEnd}`;
}

function blockWeight(block: ScriptureVerse): number {
  return block.verseEnd - block.verseStart + 1;
}
```

Replace `pageTitle()` and `formatVerseText()` with:

```ts
function pageTitle(start: ScriptureVerse, end: ScriptureVerse): string {
  const startLabel = startPointLabel(start);
  if (start.chapter === end.chapter && start.verseStart === end.verseEnd) {
    return `${start.book.abbreviation} ${startLabel}`;
  }
  if (start.chapter === end.chapter) {
    return `${start.book.abbreviation} ${startLabel}-${end.verseEnd}`;
  }
  return `${start.book.abbreviation} ${startLabel}-${endPointLabel(end)}`;
}

function formatVerseText(block: ScriptureVerse, format: string): string {
  return format
    .replaceAll('{절번호}', verseNumberLabel(block))
    .replaceAll('{절}', block.text);
}
```

Replace the `verses.length` limit with:

```ts
const coveredVerseCount = verses.reduce((sum, block) => sum + blockWeight(block), 0);
if (coveredVerseCount > MAX_SCRIPTURE_VERSES) {
  throw new Error(`말씀 본문은 최대 ${MAX_SCRIPTURE_VERSES}절까지만 내보낼 수 있습니다.`);
}
```

Replace fixed array slicing with weighted chunks:

```ts
const chunks: ScriptureVerse[][] = [];
let chunk: ScriptureVerse[] = [];
let chunkWeight = 0;

for (const block of verses) {
  const weight = blockWeight(block);
  if (chunk.length > 0 && chunkWeight + weight > versesPerSlide) {
    chunks.push(chunk);
    chunk = [];
    chunkWeight = 0;
  }

  chunk.push(block);
  chunkWeight += weight;

  if (chunkWeight >= versesPerSlide) {
    chunks.push(chunk);
    chunk = [];
    chunkWeight = 0;
  }
}
if (chunk.length > 0) chunks.push(chunk);
```

Delete the old `const pages: ScriptureSlidePage[] = []` declaration and the fixed `for (index += versesPerSlide)` slicing loop.

Replace the old slicing loop with this complete page mapping:

```ts
return chunks.map((currentChunk) => {
  const start = currentChunk[0];
  const end = currentChunk[currentChunk.length - 1];
  return {
    title: pageTitle(start, end),
    text: currentChunk.map((block) => formatVerseText(block, verseTextFormat)).join('\n'),
    verseStart: startPointLabel(start),
    verseEnd: endPointLabel(end),
  };
});
```

- [ ] **Step 7: Run focused tests and TypeScript verification**

Run:

```bash
pnpm vitest run lib/scripture/provider.test.mjs lib/scripture/preview.test.ts lib/scripture/pagination.test.mjs lib/scripture/reference.test.mjs
pnpm exec tsc --noEmit
```

Expected: all focused tests pass and TypeScript reports no remaining point-only `.verse` consumers.

- [ ] **Step 8: Commit the combined-block implementation**

```bash
git add lib/scripture/types.ts lib/scripture/provider.ts lib/scripture/provider.test.mjs lib/scripture/reference.ts lib/scripture/preview.test.ts lib/scripture/pagination.ts lib/scripture/pagination.test.mjs
git commit -m "fix: support combined scripture verse blocks"
```

---

### Task 4: Full Regression Verification

**Files:**
- Verify: all changed files from Tasks 1–3
- Update only if a verification failure exposes a defect in the approved scope.

**Interfaces:**
- Confirms: Discord input → normalized reference → BSKorea blocks → clean preview/PPT pages.

- [ ] **Step 1: Run the complete scripture test set**

```bash
pnpm vitest run lib/discord-parser/parser.test.ts lib/scripture/reference.test.mjs lib/scripture/provider.test.mjs lib/scripture/preview.test.ts lib/scripture/pagination.test.mjs lib/utils/pptx-helpers.test.mjs
```

Expected: all scripture and PPT payload helper tests pass.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all Vitest tests pass. If pre-existing Python dependency failures reappear, record the exact failures separately and confirm every JS/TS scripture test is green.

- [ ] **Step 3: Run static and production checks**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: TypeScript, ESLint, and the Next.js production build exit successfully.

- [ ] **Step 4: Inspect the final diff**

```bash
git diff --check
git status --short
git log -5 --oneline
```

Expected: no whitespace errors, only approved parser/test/docs changes, and three implementation commits after the design/plan commits.

- [ ] **Step 5: Record implementation results in the vault**

Update the existing vault work unit `AI-Sessions/wiki/dev-tasks/selah-scripture-parsing-improvements/` with an implementation note or plan status, cross-link it from `[[selah]]`, update `index.md`, and append one `log.md` line. Do not overwrite unrelated dirty vault files.
