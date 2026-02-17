const BIBLE_BOOK_MAP: Record<string, string> = {
  창세기: '창',
  출애굽기: '출',
  레위기: '레',
  민수기: '민',
  신명기: '신',
  여호수아: '수',
  사사기: '삿',
  룻기: '룻',
  사무엘상: '삼상',
  사무엘하: '삼하',
  열왕기상: '왕상',
  열왕기하: '왕하',
  역대상: '대상',
  역대하: '대하',
  에스라: '스',
  느헤미야: '느',
  에스더: '에',
  욥기: '욥',
  시편: '시',
  잠언: '잠',
  전도서: '전',
  아가: '아',
  이사야: '사',
  예레미야: '렘',
  예레미야애가: '애',
  애가: '애',
  에스겔: '겔',
  다니엘: '단',
  호세아: '호',
  요엘: '욜',
  아모스: '암',
  오바댜: '옵',
  요나: '욘',
  미가: '미',
  나훔: '나',
  하박국: '합',
  스바냐: '습',
  학개: '학',
  스가랴: '슥',
  말라기: '말',
  마태복음: '마',
  마가복음: '막',
  누가복음: '눅',
  요한복음: '요',
  사도행전: '행',
  로마서: '롬',
  고린도전서: '고전',
  고린도후서: '고후',
  갈라디아서: '갈',
  에베소서: '엡',
  빌립보서: '빌',
  골로새서: '골',
  데살로니가전서: '살전',
  데살로니가후서: '살후',
  디모데전서: '딤전',
  디모데후서: '딤후',
  디도서: '딛',
  빌레몬서: '몬',
  히브리서: '히',
  야고보서: '약',
  베드로전서: '벧전',
  베드로후서: '벧후',
  요한일서: '요일',
  요한이서: '요이',
  요한삼서: '요삼',
  유다서: '유',
  요한계시록: '계',
};

const ABBREVIATED_BOOKS = new Set(Object.values(BIBLE_BOOK_MAP));
const FULL_BOOK_NAMES = Object.keys(BIBLE_BOOK_MAP).sort((a, b) => b.length - a.length);

export interface ScriptureReference {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter?: number;
  endVerse?: number;
}

function normalizeBookName(bookName: string): string | null {
  const trimmed = bookName.trim();

  if (ABBREVIATED_BOOKS.has(trimmed)) {
    return trimmed;
  }

  if (BIBLE_BOOK_MAP[trimmed]) {
    return BIBLE_BOOK_MAP[trimmed];
  }

  for (const fullName of FULL_BOOK_NAMES) {
    if (trimmed.includes(fullName) || fullName.includes(trimmed)) {
      return BIBLE_BOOK_MAP[fullName];
    }
  }

  return null;
}

function splitBookAndReference(input: string): { book: string; reference: string } | null {
  const trimmed = input.trim();
  const spaceMatch = trimmed.match(/^(.+?)\s+(\d+.*)$/);
  if (spaceMatch) {
    return { book: spaceMatch[1], reference: spaceMatch[2] };
  }

  const noSpaceMatch = trimmed.match(/^([가-힣]+)(\d+.*)$/);
  if (noSpaceMatch) {
    return { book: noSpaceMatch[1], reference: noSpaceMatch[2] };
  }

  return null;
}

function parseChapterVerse(reference: string): {
  startChapter: number;
  startVerse: number;
  endChapter?: number;
  endVerse?: number;
} | null {
  const normalized = reference.replace(/[-~]/g, '~');

  const crossChapterMatch = normalized.match(/^(\d+)\s*:\s*(\d+)\s*~\s*(\d+)\s*:\s*(\d+)$/);
  if (crossChapterMatch) {
    return {
      startChapter: parseInt(crossChapterMatch[1], 10),
      startVerse: parseInt(crossChapterMatch[2], 10),
      endChapter: parseInt(crossChapterMatch[3], 10),
      endVerse: parseInt(crossChapterMatch[4], 10),
    };
  }

  const sameChapterRangeMatch = normalized.match(/^(\d+)\s*:\s*(\d+)\s*~\s*(\d+)$/);
  if (sameChapterRangeMatch) {
    return {
      startChapter: parseInt(sameChapterRangeMatch[1], 10),
      startVerse: parseInt(sameChapterRangeMatch[2], 10),
      endVerse: parseInt(sameChapterRangeMatch[3], 10),
    };
  }

  const singleVerseMatch = normalized.match(/^(\d+)\s*:\s*(\d+)$/);
  if (singleVerseMatch) {
    return {
      startChapter: parseInt(singleVerseMatch[1], 10),
      startVerse: parseInt(singleVerseMatch[2], 10),
    };
  }

  return null;
}

export function parseScripture(input: string): ScriptureReference | null {
  const split = splitBookAndReference(input);
  if (!split) {
    return null;
  }

  const normalizedBook = normalizeBookName(split.book);
  if (!normalizedBook) {
    return null;
  }

  const chapterVerse = parseChapterVerse(split.reference);
  if (!chapterVerse) {
    return null;
  }

  return {
    book: normalizedBook,
    ...chapterVerse,
  };
}

export function formatScripture(ref: ScriptureReference): string {
  const { book, startChapter, startVerse, endChapter, endVerse } = ref;

  if (endVerse === undefined) {
    return `${book} ${startChapter}:${startVerse}`;
  }

  if (endChapter !== undefined && endChapter !== startChapter) {
    return `${book} ${startChapter}:${startVerse}~${endChapter}:${endVerse}`;
  }

  return `${book} ${startChapter}:${startVerse}~${endVerse}`;
}

export function normalizeScripture(input: string): string {
  const parsed = parseScripture(input);
  if (parsed) {
    return formatScripture(parsed);
  }

  return input.replace(/-/g, '~');
}
