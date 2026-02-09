import type { OverlayElement } from '@/lib/types';

const SECTION_ABBREVIATIONS: Record<string, string> = {
  'Intro': 'Intro',
  'Verse': 'V',
  'Verse1': 'V1',
  'Verse2': 'V2',
  'Verse3': 'V3',
  'Chorus': 'C',
  'Pre-Chorus': 'Pre-C',
  'Interlude': 'Inter',
  'Bridge': 'B',
  'Outro': 'Outro',
};

export function abbreviateSection(section: string): string {
  return SECTION_ABBREVIATIONS[section] ?? section;
}

export function abbreviateSectionOrder(sections: string[]): string {
  return sections.map(abbreviateSection).join(' → ');
}

export function formatTempos(tempos: number[]): string {
  if (tempos.length === 0) return '';
  if (tempos.length === 1) return `BPM ${tempos[0]}`;
  return `BPM ${tempos.join(' / ')}`;
}

export function buildDefaultOverlays(
  songIndex: number,
  sectionOrder: string[],
  tempos: number[],
): OverlayElement[] {
  return [
    {
      id: 'songNumber',
      type: 'songNumber',
      text: String(songIndex + 1),
      x: 5,
      y: 2,
      fontSize: 28,
    },
    {
      id: 'sectionOrder',
      type: 'sectionOrder',
      text: abbreviateSectionOrder(sectionOrder),
      x: 50,
      y: 2,
      fontSize: 14,
    },
    {
      id: 'bpm',
      type: 'bpm',
      text: formatTempos(tempos),
      x: 95,
      y: 2,
      fontSize: 14,
    },
  ];
}

function formatDateForFilename(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}년 ${month}월 ${day}일`
}

export function generatePdfFilename(
  contiTitle: string | null,
  contiDate: string,
  songNames: string[],
): string {
  const titlePart = contiTitle?.trim() || formatDateForFilename(contiDate)
  const songsPart = songNames.length > 0
    ? `(${songNames.join(',')})`
    : ''
  const raw = `${titlePart}${songsPart}.pdf`
  return raw.replace(/[<>:"/\\|?*]/g, '_')
}
