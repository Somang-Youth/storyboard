import type {
  OverlayElement,
  PageLayout,
  PresetPdfFileMetadata,
  PresetPdfMetadata,
  PresetPdfPageMetadata,
} from '@/lib/types';

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

export function mergePresetOverlays(
  overlays: OverlayElement[] | undefined,
  songIndex: number,
  sectionOrder: string[],
  tempos: number[],
): OverlayElement[] {
  const defaults = buildDefaultOverlays(songIndex, sectionOrder, tempos);
  if (!overlays || overlays.length === 0) {
    return defaults;
  }

  return overlays;
}

export function extractPresetPdfMetadataFromLayout(
  pageLayouts: PageLayout[],
  songIndex: number,
): PresetPdfMetadata | null {
  const songLayouts = pageLayouts.filter(
    (layout) => layout.songIndex === songIndex && layout.sheetMusicFileId,
  );

  if (songLayouts.length === 0) {
    return null;
  }

  const fileMap = new Map<string, PresetPdfPageMetadata[]>();

  for (const layout of songLayouts) {
    if (!layout.sheetMusicFileId) continue;
    const pages = fileMap.get(layout.sheetMusicFileId) ?? [];
    pages.push({
      pdfPageIndex: layout.pdfPageIndex ?? null,
      cropX: layout.cropX,
      cropY: layout.cropY,
      cropWidth: layout.cropWidth,
      cropHeight: layout.cropHeight,
      imageScale: layout.imageScale,
      imageOffsetX: layout.imageOffsetX,
      imageOffsetY: layout.imageOffsetY,
      overlays: layout.overlays,
    });
    fileMap.set(layout.sheetMusicFileId, pages);
  }

  const files: PresetPdfFileMetadata[] = Array.from(fileMap.entries()).map(
    ([sheetMusicFileId, pages]) => ({ sheetMusicFileId, pages }),
  );

  return files.length > 0 ? { files } : null;
}

export function findPresetPdfPageMetadata(
  preset: PresetPdfMetadata | null | undefined,
  sheetMusicFileId: string,
  pdfPageIndex: number | null,
): PresetPdfPageMetadata | null {
  if (!preset) {
    return null;
  }

  const file = preset.files.find((item) => item.sheetMusicFileId === sheetMusicFileId);
  if (!file) {
    return null;
  }

  return file.pages.find((page) => page.pdfPageIndex === pdfPageIndex) ?? null;
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
