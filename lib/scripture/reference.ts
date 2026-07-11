import { findScriptureBook } from './books';
import { normalizeScriptureNotation } from './notation';
import type { ScripturePoint, ScriptureReference, ScriptureVerse } from './types';

function splitBookAndRange(input: string): { book: string; range: string } {
  const trimmed = normalizeScriptureNotation(input).trim().replace(/\s+/g, ' ');
  const withSpace = trimmed.match(/^(.+?)\s+(\d+.*)$/);
  if (withSpace) return { book: withSpace[1], range: withSpace[2] };

  const withoutSpace = trimmed.match(/^([가-힣0-9]+?)(\d+\s*:\s*\d+.*)$/);
  if (withoutSpace) return { book: withoutSpace[1], range: withoutSpace[2] };

  throw new Error('성경 본문 형식이 올바르지 않습니다. 예: 요 3:16~18');
}

function parsePoint(value: string): ScripturePoint {
  const match = value.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) {
    throw new Error('장절 형식이 올바르지 않습니다. 예: 요 3:16');
  }
  const chapter = Number.parseInt(match[1], 10);
  const verse = Number.parseInt(match[2], 10);
  if (chapter < 1 || verse < 1) {
    throw new Error('장절은 1 이상의 정수여야 합니다.');
  }
  return {
    chapter,
    verse,
  };
}

function comparePoints(a: ScripturePoint, b: ScripturePoint): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

function parseRange(range: string): { start: ScripturePoint; end: ScripturePoint } {
  const normalized = range.replace(/[-–—]/g, '~');
  const parts = normalized.split('~').map((part) => part.trim());
  if (parts.length > 2) {
    throw new Error('성경 본문 범위 형식이 올바르지 않습니다. 예: 요 3:16~18');
  }

  const [startRaw, endRaw] = parts;
  const start = parsePoint(startRaw);

  if (parts.length === 1) return { start, end: { ...start } };
  if (!endRaw) {
    throw new Error('끝 절 형식이 올바르지 않습니다. 예: 요 3:16~18');
  }

  const end = endRaw.includes(':')
    ? parsePoint(endRaw)
    : { chapter: start.chapter, verse: parseEndVerse(endRaw) };

  if (end.verse < 1) {
    throw new Error('장절은 1 이상의 정수여야 합니다.');
  }

  return validateRangeOrder(start, end);
}

function parseEndVerse(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error('끝 절 형식이 올바르지 않습니다. 예: 요 3:16~18');
  }
  return Number.parseInt(value, 10);
}

function validateRangeOrder(
  start: ScripturePoint,
  end: ScripturePoint,
): { start: ScripturePoint; end: ScripturePoint } {
  if (comparePoints(start, end) > 0) {
    throw new Error('끝 절이 시작 절보다 앞에 있습니다.');
  }

  return { start, end };
}

export function parseScriptureReference(input: string): ScriptureReference {
  const { book: rawBook, range } = splitBookAndRange(input);
  const book = findScriptureBook(rawBook);
  if (!book) {
    throw new Error(`알 수 없는 성경 권입니다: ${rawBook}`);
  }

  const { start, end } = parseRange(range);
  return { book, start, end };
}

function formatPoint(point: ScripturePoint): string {
  return `${point.chapter}:${point.verse}`;
}

export function formatScriptureReference(reference: ScriptureReference): string {
  const { book, start, end } = reference;
  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${book.abbreviation} ${formatPoint(start)}`;
  }
  if (start.chapter === end.chapter) {
    return `${book.abbreviation} ${formatPoint(start)}~${end.verse}`;
  }
  return `${book.abbreviation} ${formatPoint(start)}~${formatPoint(end)}`;
}

export function formatVerseLabel(reference: ScriptureReference, block: ScriptureVerse): string {
  const start = `${block.chapter}:${block.verseStart}`;
  if (block.verseStart === block.verseEnd) {
    return `${reference.book.abbreviation} ${start}`;
  }
  return `${reference.book.abbreviation} ${start}-${block.verseEnd}`;
}
