import type { ScriptureSlidePage, ScriptureVerse } from './types';

export const DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT = '{절번호}\\t{절}';

const MAX_SCRIPTURE_VERSES = 80;

interface ScripturePaginationOptions {
  verseTextFormat?: string;
}

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

function normalizeVerseTextFormat(format?: string): string {
  if (!format || format.trim().length === 0) {
    return DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT.replaceAll('\\t', '\t');
  }
  return format.replaceAll('\\t', '\t');
}

function formatVerseText(block: ScriptureVerse, format: string): string {
  return format
    .replaceAll('{절번호}', verseNumberLabel(block))
    .replaceAll('{절}', block.text);
}

export function paginateScriptureVerses(
  verses: ScriptureVerse[],
  versesPerSlide = 2,
  options: ScripturePaginationOptions = {},
): ScriptureSlidePage[] {
  if (!Number.isInteger(versesPerSlide) || versesPerSlide < 1 || versesPerSlide > 5) {
    throw new Error('절/슬라이드 값은 1에서 5 사이여야 합니다.');
  }
  const coveredVerseCount = verses.reduce((sum, block) => sum + blockWeight(block), 0);
  if (coveredVerseCount > MAX_SCRIPTURE_VERSES) {
    throw new Error(`말씀 본문은 최대 ${MAX_SCRIPTURE_VERSES}절까지만 내보낼 수 있습니다.`);
  }

  const verseTextFormat = normalizeVerseTextFormat(options.verseTextFormat);
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
}
