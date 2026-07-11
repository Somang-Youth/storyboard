const KOREAN_SCRIPTURE_NOTATION =
  /^(.+?)\s*(\d+)\s*장\s*(\d+)(?:\s*[-~–—]\s*(\d+))?\s*절$/;

export function normalizeScriptureNotation(input: string): string {
  const match = input.trim().match(KOREAN_SCRIPTURE_NOTATION);
  if (!match) return input;

  const [, book, chapter, startVerse, endVerse] = match;
  const range = endVerse ? `~${endVerse}` : '';
  return `${book.trim()} ${chapter}:${startVerse}${range}`;
}
