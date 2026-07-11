const KOREAN_SCRIPTURE_NOTATION_SUFFIX =
  /(\d+)\s*장\s*(\d+)(?:\s*[-~–—]\s*(\d+))?\s*절$/;
const KOREAN_BOOK_ALIAS = /^[가-힣0-9]+(?:\s+[가-힣0-9]+)*$/;

export function normalizeScriptureNotation(input: string): string {
  const trimmed = input.trim();
  const match = KOREAN_SCRIPTURE_NOTATION_SUFFIX.exec(trimmed);
  if (!match) return input;

  const book = trimmed.slice(0, match.index).trim();
  if (!KOREAN_BOOK_ALIAS.test(book)) return input;

  const [, chapter, startVerse, endVerse] = match;
  const range = endVerse ? `~${endVerse}` : '';
  return `${book} ${chapter}:${startVerse}${range}`;
}
