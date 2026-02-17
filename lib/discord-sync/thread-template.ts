function pad2(num: number): string {
  return String(num).padStart(2, '0');
}

export function getUpcomingSundayDate(baseDate = new Date()): Date {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatToYYMMDD(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  return `${yy}${mm}${dd}`;
}

export function formatToISODate(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function buildThreadName(yymmdd: string): string {
  return `${yymmdd} 예배 준비`;
}

export function buildInitialMessage(sundayDate: Date): string {
  const date = formatToISODate(sundayDate);
  return [
    `이번 주 예배 준비 스레드입니다. (${date})`,
    '',
    '아래 형식으로 입력해주세요:',
    '- 말씀: 갈라디아서 1:2-3',
    '- 제목: 설교 제목',
    '- 찬양: 곡1 - 곡2 - 곡3',
  ].join('\n');
}

export function getDropdownOptions(): string[] {
  const raw = process.env.DISCORD_ROLE_OPTIONS || '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
