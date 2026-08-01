import type {
  Conti,
  ContiPdfExport,
  ContiSong,
  ContiSongOverrides,
  ContiWithSongSummaries,
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  PdfLayoutState,
  PresetPdfMetadata,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  Song,
  SongPageImage,
  SongPreset,
  SongPresetData,
  SongPresetMember,
  SongWithSheetMusic,
} from '@/lib/types';
import type { SongPresetType } from '@/lib/song-preset-types';

export interface SnapshotSong {
  id: string;
  name: string;
  lyrics?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSheetMusicFile {
  id: string;
  songId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sortOrder: number;
  createdAt: string;
}

export interface SnapshotSongPreset {
  id: string;
  songId: string;
  presetType: SongPresetType;
  displayTitle: string | null;
  mashupPairKey: string | null;
  name: string;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  youtubeReference: string | null;
  youtubeTitle: string | null;
  pdfMetadata: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSongPresetSong {
  id: string;
  presetId: string;
  songId: string;
  sortOrder: number;
  partLabel: string | null;
}

export interface SnapshotPresetSheetMusic {
  id: string;
  presetId: string;
  sheetMusicFileId: string;
  sortOrder: number;
}

export interface SnapshotConti {
  id: string;
  title: string | null;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiSong {
  id: string;
  contiId: string;
  songId: string;
  sortOrder: number;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  sheetMusicFileIds: string | null;
  presetId: string | null;
  mashupGroupId: string | null;
  mashupPartOrder: number | null;
  preMashupPresetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiPdfExport {
  id: string;
  contiId: string;
  pdfUrl: string | null;
  layoutState: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSongPageImage {
  id: string;
  songId: string;
  contiId: string;
  imageUrl: string;
  pageIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex: number | null;
  presetSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSnapshot {
  songs: SnapshotSong[];
  sheetMusicFiles: SnapshotSheetMusicFile[];
  songPresets: SnapshotSongPreset[];
  songPresetSongs: SnapshotSongPresetSong[];
  presetSheetMusic: SnapshotPresetSheetMusic[];
  contis: SnapshotConti[];
  contiSongs: SnapshotContiSong[];
  contiPdfExports: SnapshotContiPdfExport[];
  songPageImages: SnapshotSongPageImage[];
}

export type SnapshotCollectionName = keyof StoryboardSnapshot;

export type SnapshotCounts = {
  [CollectionName in SnapshotCollectionName]: {
    neon: number;
    turso: number;
  };
};

export interface VerificationResult {
  ok: boolean;
  counts: SnapshotCounts;
  errors: string[];
}

export interface ResolvedYouTubeMetadata {
  videoId: string | null;
  title: string | null;
}

export interface ContiInput {
  title: string | null;
  date: string;
  description: string | null;
}

export interface SheetMusicFileInput {
  songId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
}

export interface SongPageImageInput {
  songId: string;
  contiId: string;
  imageUrl: string;
  pageIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex: number | null;
  presetSnapshot: string | null;
}

export interface ContiSongPresetSource {
  songId: string;
  overrides: ContiSongOverrides;
  pdfMetadata: PresetPdfMetadata | null;
}

export interface BatchImportSongsToContiItem {
  songId: string | null;
  songName?: string | null;
  newSongName: string | null;
  videoId?: string | null;
  title?: string | null;
  presetId?: string | null;
  createNewPreset?: boolean;
  presetName?: string | null;
  alreadyInConti?: boolean;
  replaceExistingYoutube?: boolean;
  mashupWithNext?: {
    presetId: string | null;
    createNewPreset: boolean;
    presetName: string;
  } | null;
}

export interface BatchImportSongsToContiResult {
  added: number;
  created: number;
  presetUpdated: number;
  mashupsApplied: number;
}

export interface CreateMashupPresetInput {
  songIds: [string, string];
  data: SongPresetData;
}

export interface ApplyMashupToContiInput {
  contiId: string;
  firstContiSongId: string;
  secondContiSongId: string;
  presetId: string;
}

export interface SplitMashupInput {
  contiId: string;
  mashupGroupId: string;
  mode: 'restore' | 'clear';
}

/**
 * Arrangement fields editable for a mashup group from the conti screen.
 * Excludes presetId so the shared mashup preset stays applied to both rows.
 */
export type MashupContiSongOverrides = Partial<
  Omit<ContiSongOverrides, 'presetId'>
>;

export interface UpdateMashupContiSongsInput {
  contiId: string;
  mashupGroupId: string;
  overrides: MashupContiSongOverrides;
}

export interface StoryboardRepository {
  getSongs(): Promise<Song[]>;
  getSong(id: string): Promise<SongWithSheetMusic | null>;
  getSongPresets(songId: string): Promise<SongPreset[]>;
  getSongPresetsWithSheetMusic(songId: string): Promise<ResolvedSongPresetWithSheetMusic[]>;
  getSongPresetWithSheetMusic(presetId: string): Promise<ResolvedSongPresetWithSheetMusic | null>;
  getPresetMembers(presetId: string): Promise<SongPresetMember[]>;
  findMashupPresetBySongs(songIds: [string, string]): Promise<ResolvedSongPresetWithSheetMusic | null>;
  getPresetSheetMusicFileIds(presetId: string): Promise<string[]>;
  searchSongs(query: string): Promise<Song[]>;
  getContis(): Promise<Conti[]>;
  getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]>;
  getContiByDate(date: string): Promise<Conti | null>;
  getConti(id: string): Promise<ContiWithSongs | null>;
  getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null>;
  getContiSong(contiSongId: string): Promise<ContiSong | null>;
  getContiPdfExport(contiId: string): Promise<ContiPdfExport | null>;
  getContiPdfExportById(exportId: string): Promise<ContiPdfExport | null>;
  getSheetMusicFile(fileId: string): Promise<SheetMusicFile | null>;
  getSheetMusicForSong(songId: string): Promise<SheetMusicFile[]>;
  getPageImagesForConti(contiId: string): Promise<SongPageImage[]>;
  getPageImagesForSong(songId: string): Promise<SongPageImage[]>;

  createSong(name: string): Promise<Song>;
  updateSong(id: string, data: { name?: string; lyrics?: string[] }): Promise<Song | null>;
  deleteSong(id: string): Promise<{ blockedByConti: boolean }>;
  createConti(data: ContiInput): Promise<Conti>;
  updateConti(id: string, data: ContiInput): Promise<Conti | null>;
  deleteConti(id: string): Promise<void>;
  createSheetMusicFile(data: SheetMusicFileInput): Promise<SheetMusicFile>;
  deleteSheetMusicFile(fileId: string): Promise<SheetMusicFile | null>;
  reorderSheetMusic(songId: string, orderedIds: string[]): Promise<void>;
  addSongToConti(contiId: string, songId: string, initialOverrides?: Partial<ContiSongOverrides>): Promise<ContiSong>;
  removeContiSong(contiSongId: string): Promise<void>;
  updateContiSong(contiSongId: string, data: Partial<ContiSongOverrides>): Promise<void>;
  reorderContiSongs(contiId: string, orderedIds: string[]): Promise<void>;
  getContiSongPresetSource(contiSongId: string): Promise<ContiSongPresetSource | null>;
  syncPresetPdfMetadataFromContiLayout(contiId: string, layoutState: PdfLayoutState): Promise<{ updatedPresetCount: number }>;
  batchImportSongsToConti(contiId: string, items: BatchImportSongsToContiItem[]): Promise<BatchImportSongsToContiResult>;
  createSongPreset(songId: string, data: SongPresetData, resolvedYoutube: ResolvedYouTubeMetadata | null): Promise<SongPreset>;
  createMashupPreset(input: CreateMashupPresetInput, resolvedYoutube: ResolvedYouTubeMetadata | null): Promise<SongPreset>;
  applyMashupToContiSongs(input: ApplyMashupToContiInput): Promise<{ mashupGroupId: string }>;
  updateMashupContiSongs(input: UpdateMashupContiSongsInput): Promise<void>;
  splitMashup(input: SplitMashupInput): Promise<void>;
  updateSongPreset(
    presetId: string,
    data: Partial<SongPresetData>,
    resolvedYoutube?: ResolvedYouTubeMetadata | null,
    options?: { lyricsSaveScope?: 'song' | 'preset' },
  ): Promise<SongPreset | null>;
  deleteSongPreset(presetId: string): Promise<SongPreset | null>;
  setDefaultPreset(songId: string, presetId: string): Promise<void>;
  upsertContiPdfExport(contiId: string, data: { pdfUrl?: string | null; layoutState?: string | null }): Promise<ContiPdfExport>;
  deleteContiPdfExport(exportId: string): Promise<ContiPdfExport | null>;
  createSongPageImage(data: SongPageImageInput): Promise<SongPageImage>;
  deletePageImagesForConti(contiId: string): Promise<SongPageImage[]>;
}
