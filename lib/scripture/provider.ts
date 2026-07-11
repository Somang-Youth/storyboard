import * as cheerio from 'cheerio';
import type { ScriptureBook, ScriptureReference, ScriptureVerse } from './types';

const BSKOREA_LEGACY_URL = 'https://www.bskorea.or.kr/bible/korbibReadpage.php';
const BSKOREA_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REFERENCE_CHAPTERS = 5;
const BSKOREA_NOTE_SELECTOR = '[id^="D_"], .D1, .D2, .D3, .D4, .D5, .D6';
const BSKOREA_MARKER_SELECTOR = 'a.comment';

function cleanVerseText(value: string, verse?: number): string {
  const cleaned = value
    .replace(/\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (verse === undefined) return cleaned;

  return cleaned.replace(new RegExp(`^${verse}\\s+`), '').trim();
}

export function parseBskoreaChapterHtml(
  html: string,
  book: ScriptureBook,
  chapter: number,
): ScriptureVerse[] {
  const $ = cheerio.load(html);
  const verses: ScriptureVerse[] = [];
  const seen = new Set<number>();

  $('.leftCont span').each((_, element) => {
    if ($(element).closest(BSKOREA_NOTE_SELECTOR).length > 0) return;

    const verseNode = $(element).clone();
    verseNode.find(BSKOREA_MARKER_SELECTOR).remove();
    verseNode.find(BSKOREA_NOTE_SELECTOR).remove();

    const text = verseNode.text().replace(/\u00a0/g, ' ').trim();
    const match = text.match(/^(\d+)\s+([\s\S]+)$/);
    if (!match) return;

    const verse = Number.parseInt(match[1], 10);
    if (!Number.isFinite(verse) || seen.has(verse)) return;

    const verseText = cleanVerseText(match[2], verse);
    if (!verseText) return;

    seen.add(verse);
    verses.push({ book, chapter, verse, text: verseText });
  });

  if (verses.length === 0) {
    throw new Error(`${book.abbreviation} ${chapter}장에서 본문을 찾지 못했습니다.`);
  }

  return verses.sort((a, b) => a.verse - b.verse);
}

async function fetchChapterHtml(book: ScriptureBook, chapter: number): Promise<string> {
  const url = new URL(BSKOREA_LEGACY_URL);
  url.searchParams.set('version', 'GAE');
  url.searchParams.set('book', book.bskoreaCode);
  url.searchParams.set('chap', String(chapter));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BSKOREA_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'storyboard-worship-ppt-export/1.0',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`성경 본문 조회 실패 (${response.status})`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`성경 본문 조회 시간이 초과되었습니다. (${BSKOREA_REQUEST_TIMEOUT_MS / 1000}초)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function chaptersInReference(reference: ScriptureReference): number[] {
  const chapterCount = reference.end.chapter - reference.start.chapter + 1;
  if (chapterCount > MAX_REFERENCE_CHAPTERS) {
    throw new Error(`성경 본문 범위는 최대 ${MAX_REFERENCE_CHAPTERS}장까지만 조회할 수 있습니다.`);
  }

  const chapters: number[] = [];
  for (let offset = 0; offset < chapterCount; offset += 1) {
    chapters.push(reference.start.chapter + offset);
  }
  return chapters;
}

function missingVerseError(reference: ScriptureReference, chapter: number, verse: number): Error {
  return new Error(`성경 본문에서 누락된 절을 찾았습니다: ${reference.book.abbreviation} ${chapter}:${verse}`);
}

function expectedStartVerse(reference: ScriptureReference, chapter: number): number {
  return chapter === reference.start.chapter ? reference.start.verse : 1;
}

function expectedEndVerse(
  reference: ScriptureReference,
  chapter: number,
  selectedVerses: ScriptureVerse[],
): number {
  if (chapter === reference.end.chapter) return reference.end.verse;
  return selectedVerses[selectedVerses.length - 1]?.verse ?? expectedStartVerse(reference, chapter);
}

function validateParsedChapterVerses(
  reference: ScriptureReference,
  chapter: number,
  chapterVerses: ScriptureVerse[],
): void {
  const verseNumbers = Array.from(
    new Set(
      chapterVerses
        .filter((verse) => verse.chapter === chapter)
        .map((verse) => verse.verse),
    ),
  ).sort((a, b) => a - b);

  for (let index = 1; index < verseNumbers.length; index += 1) {
    const previous = verseNumbers[index - 1];
    const current = verseNumbers[index];
    for (let verse = previous + 1; verse < current; verse += 1) {
      throw missingVerseError(reference, chapter, verse);
    }
  }
}

export function selectReferenceVerses(
  reference: ScriptureReference,
  versesByChapter: Map<number, ScriptureVerse[]>,
): ScriptureVerse[] {
  const allVerses: ScriptureVerse[] = [];

  for (const chapter of chaptersInReference(reference)) {
    const chapterVerses = versesByChapter.get(chapter) ?? [];
    validateParsedChapterVerses(reference, chapter, chapterVerses);

    const selectedVerses = chapterVerses
      .filter((verse) => {
        if (verse.chapter === reference.start.chapter && verse.verse < reference.start.verse) return false;
        if (verse.chapter === reference.end.chapter && verse.verse > reference.end.verse) return false;
        return true;
      })
      .sort((a, b) => a.verse - b.verse);

    const startVerse = expectedStartVerse(reference, chapter);
    const endVerse = expectedEndVerse(reference, chapter, selectedVerses);
    const presentVerses = new Set(selectedVerses.map((verse) => verse.verse));

    for (let verse = startVerse; verse <= endVerse; verse += 1) {
      if (!presentVerses.has(verse)) {
        throw missingVerseError(reference, chapter, verse);
      }
    }

    allVerses.push(...selectedVerses);
  }

  return allVerses;
}

export async function fetchScriptureVerses(reference: ScriptureReference): Promise<ScriptureVerse[]> {
  const chapterCache = new Map<number, ScriptureVerse[]>();

  for (const chapter of chaptersInReference(reference)) {
    const html = await fetchChapterHtml(reference.book, chapter);
    const chapterVerses = parseBskoreaChapterHtml(html, reference.book, chapter);
    chapterCache.set(chapter, chapterVerses);
  }

  const allVerses = selectReferenceVerses(reference, chapterCache);
  if (allVerses.length === 0) {
    throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
  }

  return allVerses;
}
