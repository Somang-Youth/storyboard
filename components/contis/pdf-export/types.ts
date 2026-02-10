import type {
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
  OverlayElement,
} from "@/lib/types";

export interface EditorPage {
  songIndex: number;
  sheetMusicFileId: string | null;
  /** For image files: the file URL. For PDF pages: a rendered data URL. For metadata-only: null. */
  imageUrl: string | null;
  /** If this page comes from a PDF file, which page of that PDF (0-based) */
  pdfPageIndex: number | null;
  overlays: OverlayElement[];
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  originalImageUrl: string | null;
}

export interface CropSelection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface PdfEditorProps {
  conti: ContiWithSongsAndSheetMusic;
  existingExport: ContiPdfExport | null;
}
