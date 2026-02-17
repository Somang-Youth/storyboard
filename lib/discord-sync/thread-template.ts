function pad2(num: number): string {
  return String(num).padStart(2, '0');
}

export function getUpcomingSundayDate(baseDate = new Date()): Date {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? 7 : 7 - day;
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
  const yymmdd = formatToYYMMDD(sundayDate);
  const year = `20${yymmdd.slice(0, 2)}`;
  const month = yymmdd.slice(2, 4);
  const day = yymmdd.slice(4, 6);
  return `**${year}년 ${month}월 ${day}일** 예배 준비 스레드입니다. 예배 준비 관련 내용은 본 스레드에서 나눠주세요.

\`말씀 본문\`, \`설교 제목\`, \`찬양\`은 다음 형식대로 본 스레드에 입력하면 주보 시트에 자동으로 반영됩니다.

**복사/붙여넣기로 작성 부탁드립니다. 형식을 준수해주세요**.

말씀: 창1:1~3
제목: 설교 제목 예시
찬양: 찬양1 - 찬양2 - 찬양3`;
}
