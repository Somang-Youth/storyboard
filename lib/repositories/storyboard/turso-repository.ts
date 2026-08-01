import { getTursoDb } from '@/lib/db/turso';
import {
  parseContiSongOverrides,
  parseJsonColumn,
  parsePresetPdfMetadata,
  stringifyContiSongOverrides,
} from '@/lib/db/helpers';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPageImages,
  songPresets,
  songPresetSongs,
  songs,
} from '@/lib/db/turso-schema';
import { dbTextToDate, dateToDbText } from '@/lib/db/time';
import { generateId } from '@/lib/id';
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
  SongPresetMember,
  SongPresetWithSheetMusic,
  SongWithSheetMusic,
} from '@/lib/types';
import type {
  BatchImportSongsToContiItem,
  BatchImportSongsToContiResult,
  ContiInput,
  ResolvedYouTubeMetadata,
  SheetMusicFileInput,
  SongPageImageInput,
  StoryboardRepository,
} from './types';
import { extractPresetPdfMetadataFromLayout } from '@/lib/utils/pdf-export-helpers';
import { buildArrangementItems } from '@/lib/utils/arrangement-items';
import { getOrderedSongPairKey, resolveMashupPresetForImport } from '@/lib/utils/mashup-presets';
import { resolvePresetLyrics } from '@/lib/utils/preset-lyrics';
import { songPresetToContiOverrides } from '@/lib/utils/preset-overrides';
import { normalizeYouTubeReference } from '@/lib/utils/youtube';
import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm';

export function getAdjacentOrderedTursoContiSongPair<T extends { id: string }>(
  orderedRows: T[],
  pairIds: readonly [string, string],
): [T, T] | null {
  const firstIndex = orderedRows.findIndex((row) => row.id === pairIds[0]);
  const secondIndex = orderedRows.findIndex((row) => row.id === pairIds[1]);
  if (firstIndex === -1 || secondIndex === -1) return null;

  const earlierIndex = Math.min(firstIndex, secondIndex);
  const laterIndex = Math.max(firstIndex, secondIndex);
  if (laterIndex !== earlierIndex + 1) return null;

  return [orderedRows[earlierIndex], orderedRows[laterIndex]];
}

type TursoSong = typeof songs.$inferSelect;
type TursoSheetMusicFile = typeof sheetMusicFiles.$inferSelect;
type TursoSongPreset = typeof songPresets.$inferSelect;
type TursoConti = typeof contis.$inferSelect;
type TursoContiSong = typeof contiSongs.$inferSelect;
type TursoContiPdfExport = typeof contiPdfExports.$inferSelect;
type TursoSongPageImage = typeof songPageImages.$inferSelect;

async function getPresetMemberRows(presetId: string): Promise<SongPresetMember[]> {
  const tursoDb = getTursoDb();
  const rows = await tursoDb
    .select({
      id: songPresetSongs.id,
      presetId: songPresetSongs.presetId,
      songId: songPresetSongs.songId,
      sortOrder: songPresetSongs.sortOrder,
      partLabel: songPresetSongs.partLabel,
      songName: songs.name,
    })
    .from(songPresetSongs)
    .leftJoin(songs, eq(songPresetSongs.songId, songs.id))
    .where(eq(songPresetSongs.presetId, presetId))
    .orderBy(songPresetSongs.sortOrder);

  return rows.map((row) => ({
    id: row.id,
    presetId: row.presetId,
    songId: row.songId,
    sortOrder: row.sortOrder,
    partLabel: row.partLabel,
    songName: row.songName ?? undefined,
  }));
}

async function getNextPresetSortOrderForSong(songId: string): Promise<number> {
  const tursoDb = getTursoDb();
  const rows = await tursoDb
    .select({ sortOrder: songPresets.sortOrder })
    .from(songPresetSongs)
    .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
    .where(eq(songPresetSongs.songId, songId));

  return rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0;
}

function mapSong(row: TursoSong): Song {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapSheetMusicFile(row: TursoSheetMusicFile): SheetMusicFile {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
  };
}

function mapSongPreset(row: TursoSongPreset): SongPreset {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function getOrderedMemberSongIds(members: readonly SongPresetMember[]): string[] {
  return Array.from(new Set(
    members
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((member) => member.songId),
  ));
}

function mapConti(row: TursoConti): Conti {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapContiSong(row: TursoContiSong): ContiSong {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapContiPdfExport(row: TursoContiPdfExport): ContiPdfExport {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapSongPageImage(row: TursoSongPageImage): SongPageImage {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

async function insertTursoSong(name: string): Promise<Song> {
  const tursoDb = getTursoDb();
  const now = dateToDbText(new Date());
  const song = {
    id: generateId(),
    name,
    lyrics: '[]',
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(songs).values(song);
  return mapSong(song);
}

async function insertTursoContiSong(
  contiId: string,
  songId: string,
  sortOrder: number,
  overrides?: Partial<ContiSongOverrides>,
): Promise<ContiSong> {
  const tursoDb = getTursoDb();
  const now = dateToDbText(new Date());
  const serialized = overrides
    ? stringifyContiSongOverrides(overrides)
    : { keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}' };
  const contiSong = {
    id: generateId(),
    contiId,
    songId,
    sortOrder,
    keys: serialized.keys ?? '[]',
    tempos: serialized.tempos ?? '[]',
    sectionOrder: serialized.sectionOrder ?? '[]',
    lyrics: serialized.lyrics ?? '[]',
    sectionLyricsMap: serialized.sectionLyricsMap ?? '{}',
    notes: overrides?.notes ?? null,
    sheetMusicFileIds: serialized.sheetMusicFileIds ?? null,
    presetId: serialized.presetId ?? null,
    mashupGroupId: null,
    mashupPartOrder: null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(contiSongs).values(contiSong);
  return mapContiSong(contiSong);
}

async function insertTursoSongPreset(
  songId: string,
  data: { name: string; youtubeReference?: string | null; youtubeTitle?: string | null },
): Promise<SongPreset> {
  const tursoDb = getTursoDb();
  const nextSortOrder = await getNextPresetSortOrderForSong(songId);
  const now = dateToDbText(new Date());
  const preset = {
    id: generateId(),
    songId,
    presetType: 'single' as const,
    displayTitle: null,
    mashupPairKey: null,
    name: data.name,
    keys: '[]',
    tempos: '[]',
    sectionOrder: '[]',
    lyrics: '[]',
    sectionLyricsMap: '{}',
    notes: null,
    youtubeReference: data.youtubeReference ?? null,
    youtubeTitle: data.youtubeTitle ?? null,
    pdfMetadata: null,
    isDefault: false,
    sortOrder: nextSortOrder,
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(songPresets).values(preset);
  await tursoDb.insert(songPresetSongs).values({
    id: `${preset.id}:song:0`,
    presetId: preset.id,
    songId,
    sortOrder: 0,
    partLabel: null,
  });
  return mapSongPreset(preset);
}

async function updateTursoSongPresetYoutubeRef(
  presetId: string,
  youtubeReference: string | null,
  youtubeTitle?: string | null,
) {
  const tursoDb = getTursoDb();
  await tursoDb
    .update(songPresets)
    .set({
      youtubeReference,
      youtubeTitle: youtubeReference ? youtubeTitle ?? null : null,
      updatedAt: dateToDbText(new Date()),
    })
    .where(eq(songPresets.id, presetId));
}

async function getPresetOverridesForSong(presetId: string, songId: string): Promise<ContiSongOverrides | null> {
  const tursoDb = getTursoDb();
  const presetRows = await tursoDb
    .select()
    .from(songPresetSongs)
    .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
    .where(and(eq(songPresetSongs.presetId, presetId), eq(songPresetSongs.songId, songId)))
    .limit(1);

  if (presetRows.length === 0) return null;

  const preset = await hydrateSongPreset(
    mapSongPreset(presetRows[0].song_presets),
  );

  return songPresetToContiOverrides(preset, preset.sheetMusicFileIds);
}

async function getPresetEditorSheetMusicRows(
  members: readonly SongPresetMember[],
  selectedSheetMusicFileIds: readonly string[],
): Promise<SheetMusicFile[]> {
  const tursoDb = getTursoDb();
  const filesById = new Map<string, SheetMusicFile>();
  const memberSongIds = getOrderedMemberSongIds(members);

  for (const songId of memberSongIds) {
    const rows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, songId))
      .orderBy(sheetMusicFiles.sortOrder);
    for (const row of rows.map(mapSheetMusicFile)) {
      filesById.set(row.id, row);
    }
  }

  if (selectedSheetMusicFileIds.length > 0) {
    const selectedRows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(inArray(sheetMusicFiles.id, [...selectedSheetMusicFileIds]));
    const selectedById = new Map(selectedRows.map((row) => [row.id, mapSheetMusicFile(row)]));
    for (const id of selectedSheetMusicFileIds) {
      const row = selectedById.get(id);
      if (row && !filesById.has(row.id)) {
        filesById.set(row.id, row);
      }
    }
  }

  return Array.from(filesById.values());
}

function parseLyricsField(field: string | null): string[] {
  const parsed = parseJsonColumn<unknown>(field, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

async function getSongLyrics(songId: string): Promise<string[]> {
  const tursoDb = getTursoDb();
  const rows = await tursoDb
    .select({ lyrics: songs.lyrics })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  return parseLyricsField(rows[0]?.lyrics ?? null);
}

async function getSongLyricsInOrder(songIds: readonly string[]): Promise<string[]> {
  const tursoDb = getTursoDb();
  if (songIds.length === 0) return [];

  const rows = await tursoDb
    .select({
      id: songs.id,
      lyrics: songs.lyrics,
    })
    .from(songs)
    .where(inArray(songs.id, [...songIds]));
  const lyricsBySongId = new Map(rows.map((row) => [row.id, parseLyricsField(row.lyrics)]));

  return songIds.flatMap((songId) => lyricsBySongId.get(songId) ?? []);
}

async function getMashupFallbackLyrics(members: readonly SongPresetMember[]): Promise<string[]> {
  const memberSongIds = getOrderedMemberSongIds(members);
  return getSongLyricsInOrder(memberSongIds);
}

async function hydrateSongPreset(
  preset: SongPreset,
): Promise<ResolvedSongPresetWithSheetMusic> {
  const tursoDb = getTursoDb();
  const [sheetMusicRows, members] = await Promise.all([
    tursoDb
      .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
      .from(presetSheetMusic)
      .where(eq(presetSheetMusic.presetId, preset.id))
      .orderBy(presetSheetMusic.sortOrder),
    getPresetMemberRows(preset.id),
  ]);
  const sheetMusicFileIds = sheetMusicRows.map((row) => row.sheetMusicFileId);
  let availableSheetMusic: SheetMusicFile[] | undefined;
  let songLyrics: string[] | undefined;
  let fallbackLyrics: string[] | undefined;

  if (preset.presetType === "mashup") {
    [availableSheetMusic, fallbackLyrics] = await Promise.all([
      getPresetEditorSheetMusicRows(members, sheetMusicFileIds),
      getMashupFallbackLyrics(members),
    ]);
  } else {
    songLyrics = await getSongLyrics(preset.songId);
  }

  const hydrated: SongPresetWithSheetMusic = {
    ...preset,
    sheetMusicFileIds,
    members,
    availableSheetMusic,
    songLyrics,
    fallbackLyrics,
  };
  const resolution = resolvePresetLyrics(hydrated);

  return {
    ...hydrated,
    resolvedLyrics: resolution.lyrics,
    lyricsSource: resolution.source,
  };
}

export const tursoStoryboardRepository: StoryboardRepository = {
  async getSongs() {
    const tursoDb = getTursoDb();
    const rows = await tursoDb.select().from(songs).orderBy(desc(songs.createdAt));
    return rows.map(mapSong);
  },

  async getSong(id: string): Promise<SongWithSheetMusic | null> {
    const tursoDb = getTursoDb();
    const song = await tursoDb.select().from(songs).where(eq(songs.id, id)).limit(1);

    if (song.length === 0) {
      return null;
    }

    const sheetMusicRows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, id))
      .orderBy(sheetMusicFiles.sortOrder);

    const presets = await this.getSongPresetsWithSheetMusic(id);

    return {
      ...mapSong(song[0]),
      sheetMusic: sheetMusicRows.map(mapSheetMusicFile),
      presets,
    };
  },

  async getSongPresets(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select({ preset: songPresets })
      .from(songPresetSongs)
      .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
      .where(eq(songPresetSongs.songId, songId))
      .orderBy(songPresets.sortOrder);

    return rows.map((row) => mapSongPreset(row.preset));
  },

  async searchSongs(query: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songs)
      .where(sql`lower(${songs.name}) like lower(${`%${query}%`})`)
      .orderBy(desc(songs.createdAt));

    return rows.map(mapSong);
  },

  async getSongPresetsWithSheetMusic(
    songId: string,
  ): Promise<ResolvedSongPresetWithSheetMusic[]> {
    const presets = await this.getSongPresets(songId);
    return Promise.all(presets.map(hydrateSongPreset));
  },

  async getSongPresetWithSheetMusic(
    presetId: string,
  ): Promise<ResolvedSongPresetWithSheetMusic | null> {
    const tursoDb = getTursoDb();
    const presetRows = await tursoDb
      .select()
      .from(songPresets)
      .where(eq(songPresets.id, presetId))
      .limit(1);

    return presetRows[0]
      ? hydrateSongPreset(mapSongPreset(presetRows[0]))
      : null;
  },

  async getPresetMembers(presetId: string) {
    return getPresetMemberRows(presetId);
  },

  async findMashupPresetBySongs([firstSongId, secondSongId]: [string, string]) {
    const tursoDb = getTursoDb();
    const pairKey = getOrderedSongPairKey([firstSongId, secondSongId]);
    const directRows = await tursoDb
      .select({ id: songPresets.id })
      .from(songPresets)
      .where(and(eq(songPresets.presetType, "mashup"), eq(songPresets.mashupPairKey, pairKey)))
      .orderBy(songPresets.sortOrder)
      .limit(1);
    if (directRows[0]) {
      return this.getSongPresetWithSheetMusic(directRows[0].id);
    }

    const candidateRows = await tursoDb
      .select({ presetId: songPresetSongs.presetId })
      .from(songPresetSongs)
      .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
      .where(eq(songPresets.presetType, "mashup"))
      .orderBy(songPresets.sortOrder);

    const candidateIds = Array.from(new Set(candidateRows.map((row) => row.presetId)));
    for (const presetId of candidateIds) {
      const members = await this.getPresetMembers(presetId);
      const ordered = members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
      if (
        ordered.length === 2 &&
        ordered[0].songId === firstSongId &&
        ordered[1].songId === secondSongId
      ) {
        return this.getSongPresetWithSheetMusic(presetId);
      }
    }

    return null;
  },

  async getPresetSheetMusicFileIds(presetId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
      .from(presetSheetMusic)
      .where(eq(presetSheetMusic.presetId, presetId))
      .orderBy(presetSheetMusic.sortOrder);

    return rows.map((row) => row.sheetMusicFileId);
  },

  async getContis() {
    const tursoDb = getTursoDb();
    const rows = await tursoDb.select().from(contis).orderBy(desc(contis.date));
    return rows.map(mapConti);
  },

  async getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
    const tursoDb = getTursoDb();
    const contiRows = await this.getContis();
    if (contiRows.length === 0) return [];

    const contiIds = contiRows.map((conti) => conti.id);

    const rows = await tursoDb
      .select({
        contiSong: contiSongs,
        songName: songs.name,
        presetName: songPresets.name,
        presetType: songPresets.presetType,
        presetDisplayTitle: songPresets.displayTitle,
        youtubeReference: songPresets.youtubeReference,
        youtubeTitle: songPresets.youtubeTitle,
      })
      .from(contiSongs)
      .leftJoin(songs, eq(contiSongs.songId, songs.id))
      .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
      .where(inArray(contiSongs.contiId, contiIds))
      .orderBy(contiSongs.sortOrder);

    const byContiId = new Map<string, ContiWithSongSummaries["songSummaries"]>();

    for (const row of rows) {
      const parsed = parseContiSongOverrides({
        keys: row.contiSong.keys,
        tempos: row.contiSong.tempos,
        sectionOrder: row.contiSong.sectionOrder,
        lyrics: row.contiSong.lyrics,
        sectionLyricsMap: row.contiSong.sectionLyricsMap,
        notes: row.contiSong.notes,
        sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
        presetId: row.contiSong.presetId,
      });

      const summaries = byContiId.get(row.contiSong.contiId) ?? [];
      summaries.push({
        id: row.contiSong.id,
        songId: row.contiSong.songId,
        sortOrder: row.contiSong.sortOrder,
        songName: row.songName ?? "알 수 없는 곡",
        keys: parsed.keys,
        tempos: parsed.tempos,
        sectionOrder: parsed.sectionOrder,
        presetId: parsed.presetId,
        presetName: row.presetName ?? null,
        presetType: row.presetType ?? null,
        presetDisplayTitle: row.presetDisplayTitle ?? null,
        youtubeReference: row.youtubeReference ?? null,
        youtubeTitle: row.youtubeTitle ?? null,
        hasSheetMusicSelection: parsed.sheetMusicFileIds !== null && parsed.sheetMusicFileIds.length > 0,
        mashupGroupId: row.contiSong.mashupGroupId,
        mashupPartOrder: row.contiSong.mashupPartOrder,
      });
      byContiId.set(row.contiSong.contiId, summaries);
    }

    return contiRows.map((conti) => {
      const songSummaries = byContiId.get(conti.id) ?? [];
      return {
        ...conti,
        songSummaries,
        songCount: songSummaries.length,
      };
    });
  },

  async getContiByDate(date: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb.select().from(contis).where(eq(contis.date, date)).limit(1);
    return result[0] ? mapConti(result[0]) : null;
  },

  async getConti(id: string): Promise<ContiWithSongs | null> {
    const tursoDb = getTursoDb();
    const conti = await tursoDb.select().from(contis).where(eq(contis.id, id)).limit(1);

    if (conti.length === 0) {
      return null;
    }

    const contiSongsData = await tursoDb
      .select({
        contiSong: contiSongs,
        song: songs,
        preset: {
          id: songPresets.id,
          name: songPresets.name,
          presetType: songPresets.presetType,
          displayTitle: songPresets.displayTitle,
          youtubeReference: songPresets.youtubeReference,
          youtubeTitle: songPresets.youtubeTitle,
        },
      })
      .from(contiSongs)
      .leftJoin(songs, eq(contiSongs.songId, songs.id))
      .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
      .where(eq(contiSongs.contiId, id))
      .orderBy(contiSongs.sortOrder);

    const songsWithOverrides = contiSongsData.map((row) => ({
      ...mapContiSong(row.contiSong),
      song: mapSong(row.song!),
      overrides: parseContiSongOverrides({
        keys: row.contiSong.keys,
        tempos: row.contiSong.tempos,
        sectionOrder: row.contiSong.sectionOrder,
        lyrics: row.contiSong.lyrics,
        sectionLyricsMap: row.contiSong.sectionLyricsMap,
        notes: row.contiSong.notes,
        sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
        presetId: row.contiSong.presetId,
      }),
      appliedPreset: row.preset?.id ? row.preset : null,
    }));

    return {
      ...mapConti(conti[0]),
      songs: songsWithOverrides,
    };
  },

  async getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
    const tursoDb = getTursoDb();
    const conti = await this.getConti(id);
    if (!conti) return null;

    const presetIds = Array.from(
      new Set(
        conti.songs
          .map((contiSong) => contiSong.overrides.presetId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const presetRows = presetIds.length > 0
      ? await tursoDb
          .select({
            id: songPresets.id,
            pdfMetadata: songPresets.pdfMetadata,
          })
          .from(songPresets)
          .where(inArray(songPresets.id, presetIds))
      : [];

    const presetPdfMetadataById = new Map(
      presetRows.map((row) => [
        row.id,
        parsePresetPdfMetadata<PresetPdfMetadata>(row.pdfMetadata),
      ]),
    );

    const songsWithSheetMusic = await Promise.all(
      conti.songs.map(async (contiSong) => {
        const selectedIds = contiSong.overrides.sheetMusicFileIds;

        let sheetMusic;
        if (selectedIds && selectedIds.length > 0) {
          // Use selected sheet music only, preserving selection order
          const sheetMusicRows = await tursoDb
            .select()
            .from(sheetMusicFiles)
            .where(inArray(sheetMusicFiles.id, selectedIds));
          // Sort by the order in selectedIds
          const idOrder = new Map(selectedIds.map((smId, i) => [smId, i]));
          sheetMusic = sheetMusicRows
            .map(mapSheetMusicFile)
            .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
        } else {
          // Fallback: all sheet music for the song
          const sheetMusicRows = await tursoDb
            .select()
            .from(sheetMusicFiles)
            .where(eq(sheetMusicFiles.songId, contiSong.songId))
            .orderBy(sheetMusicFiles.sortOrder);
          sheetMusic = sheetMusicRows.map(mapSheetMusicFile);
        }

        return {
          ...contiSong,
          sheetMusic,
          presetPdfMetadata: contiSong.overrides.presetId
            ? presetPdfMetadataById.get(contiSong.overrides.presetId) ?? null
            : null,
        };
      })
    );

    return { ...conti, songs: songsWithSheetMusic };
  },

  async getContiSong(contiSongId: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    return result[0] ? mapContiSong(result[0]) : null;
  },

  async getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    return result.length > 0 ? mapContiPdfExport(result[0]) : null;
  },

  async getContiPdfExportById(exportId: string): Promise<ContiPdfExport | null> {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    return result[0] ? mapContiPdfExport(result[0]) : null;
  },

  async getSheetMusicForSong(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, songId))
      .orderBy(sheetMusicFiles.sortOrder);

    return rows.map(mapSheetMusicFile);
  },

  async getSheetMusicFile(fileId: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    return result[0] ? mapSheetMusicFile(result[0]) : null;
  },

  async getPageImagesForSong(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.songId, songId))
      .orderBy(songPageImages.createdAt);

    return rows.map(mapSongPageImage);
  },

  async getPageImagesForConti(contiId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId))
      .orderBy(songPageImages.createdAt);

    return rows.map(mapSongPageImage);
  },

  async createSong(name: string) {
    return await insertTursoSong(name);
  },

  async updateSong(id: string, data: { name?: string; lyrics?: string[] }) {
    const tursoDb = getTursoDb();
    const updateData: Record<string, unknown> = { updatedAt: dateToDbText(new Date()) };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.lyrics !== undefined) updateData.lyrics = JSON.stringify(data.lyrics);

    await tursoDb
      .update(songs)
      .set(updateData)
      .where(eq(songs.id, id));

    const result = await tursoDb.select().from(songs).where(eq(songs.id, id)).limit(1);
    return result[0] ? mapSong(result[0]) : null;
  },

  async deleteSong(id: string) {
    const tursoDb = getTursoDb();
    const usedInConti = await tursoDb
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.songId, id))
      .limit(1);

    if (usedInConti.length > 0) {
      return { blockedByConti: true };
    }

    await tursoDb.delete(songs).where(eq(songs.id, id));
    return { blockedByConti: false };
  },

  async createConti(data: ContiInput) {
    const tursoDb = getTursoDb();
    const now = dateToDbText(new Date());
    const conti = {
      id: generateId(),
      title: data.title,
      date: data.date,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(contis).values(conti);
    return mapConti(conti);
  },

  async updateConti(id: string, data: ContiInput) {
    const tursoDb = getTursoDb();
    await tursoDb
      .update(contis)
      .set({ ...data, updatedAt: dateToDbText(new Date()) })
      .where(eq(contis.id, id));

    const result = await tursoDb.select().from(contis).where(eq(contis.id, id)).limit(1);
    return result[0] ? mapConti(result[0]) : null;
  },

  async deleteConti(id: string) {
    const tursoDb = getTursoDb();
    await tursoDb.delete(contis).where(eq(contis.id, id));
  },

  async createSheetMusicFile(data: SheetMusicFileInput) {
    const tursoDb = getTursoDb();
    const maxSortOrderResult = await tursoDb
      .select({ maxOrder: max(sheetMusicFiles.sortOrder) })
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, data.songId));

    const sheetMusicFile = {
      id: generateId(),
      ...data,
      sortOrder: (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      createdAt: dateToDbText(new Date()),
    };

    await tursoDb.insert(sheetMusicFiles).values(sheetMusicFile);
    return mapSheetMusicFile(sheetMusicFile);
  },

  async deleteSheetMusicFile(fileId: string) {
    const tursoDb = getTursoDb();
    const file = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    if (file.length === 0) {
      return null;
    }

    await tursoDb.delete(sheetMusicFiles).where(eq(sheetMusicFiles.id, fileId));
    return mapSheetMusicFile(file[0]);
  },

  async reorderSheetMusic(songId: string, orderedIds: string[]) {
    const tursoDb = getTursoDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await tursoDb
        .update(sheetMusicFiles)
        .set({ sortOrder: i })
        .where(and(eq(sheetMusicFiles.songId, songId), eq(sheetMusicFiles.id, orderedIds[i])));
    }
  },

  async addSongToConti(contiId: string, songId: string, initialOverrides?: Partial<ContiSongOverrides>) {
    const tursoDb = getTursoDb();
    const maxSortOrderResult = await tursoDb
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    return await insertTursoContiSong(
      contiId,
      songId,
      (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      initialOverrides,
    );
  },

  async removeContiSong(contiSongId: string) {
    const tursoDb = getTursoDb();
    await tursoDb.delete(contiSongs).where(eq(contiSongs.id, contiSongId));
  },

  async updateContiSong(contiSongId: string, data: Partial<ContiSongOverrides>) {
    const tursoDb = getTursoDb();
    await tursoDb
      .update(contiSongs)
      .set({ ...stringifyContiSongOverrides(data), updatedAt: dateToDbText(new Date()) })
      .where(eq(contiSongs.id, contiSongId));
  },

  async reorderContiSongs(contiId: string, orderedIds: string[]) {
    const tursoDb = getTursoDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await tursoDb
        .update(contiSongs)
        .set({ sortOrder: i })
        .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.id, orderedIds[i])));
    }
  },

  async getContiSongPresetSource(contiSongId: string) {
    const tursoDb = getTursoDb();
    const contiSongRow = await tursoDb
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    if (contiSongRow.length === 0) {
      return null;
    }

    const cs = contiSongRow[0];
    const overrides = parseContiSongOverrides(cs);
    const orderedSongs = await tursoDb
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, cs.contiId))
      .orderBy(asc(contiSongs.sortOrder));
    const songIndex = orderedSongs.findIndex((item) => item.id === contiSongId);
    const contiExport = await tursoDb
      .select({ layoutState: contiPdfExports.layoutState })
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, cs.contiId))
      .limit(1);

    let pdfMetadata: PresetPdfMetadata | null = null;
    if (songIndex >= 0) {
      const layoutStateText = contiExport[0]?.layoutState;
      if (layoutStateText) {
        try {
          const parsed = JSON.parse(layoutStateText) as PdfLayoutState;
          const conti = await this.getConti(cs.contiId);
          const arrangementItems = conti ? buildArrangementItems(conti.songs) : [];
          const itemIndex = arrangementItems.findIndex((item) =>
            item.songs.some((song) => song.id === contiSongId),
          );

          if (itemIndex >= 0) {
            const item = arrangementItems[itemIndex];
            pdfMetadata = extractPresetPdfMetadataFromLayout(
              parsed.pages,
              itemIndex,
              item.key,
            );
          } else {
            pdfMetadata = extractPresetPdfMetadataFromLayout(parsed.pages, songIndex);
          }
        } catch {
          pdfMetadata = null;
        }
      }
    }

    return {
      songId: cs.songId,
      overrides,
      pdfMetadata,
    };
  },

  async syncPresetPdfMetadataFromContiLayout(contiId: string, layoutState: PdfLayoutState) {
    const tursoDb = getTursoDb();
    const conti = await this.getConti(contiId);
    if (!conti) {
      return { updatedPresetCount: 0 };
    }

    let updatedPresetCount = 0;
    const updatedPresetIds = new Set<string>();
    const arrangementItems = buildArrangementItems(conti.songs);

    for (let itemIndex = 0; itemIndex < arrangementItems.length; itemIndex++) {
      const item = arrangementItems[itemIndex];
      const presetId = item.presetId;
      if (!presetId || updatedPresetIds.has(presetId)) continue;

      const metadata = extractPresetPdfMetadataFromLayout(layoutState.pages, itemIndex, item.key);
      await tursoDb
        .update(songPresets)
        .set({
          pdfMetadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: dateToDbText(new Date()),
        })
        .where(eq(songPresets.id, presetId));
      updatedPresetIds.add(presetId);
      updatedPresetCount += 1;
    }

    return { updatedPresetCount };
  },

  async batchImportSongsToConti(
    contiId: string,
    items: BatchImportSongsToContiItem[],
  ): Promise<BatchImportSongsToContiResult> {
    const tursoDb = getTursoDb();
    let created = 0;
    let presetUpdated = 0;
    let mashupsApplied = 0;

    const maxResult = await tursoDb
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    let nextSortOrder = (maxResult[0]?.maxOrder ?? -1) + 1;
    const newSongMap = new Map<string, string>();
    const importedRows: Array<{ contiSongId: string | null; songId: string; songName: string }> = [];

    for (const item of items) {
      let resolvedSongId: string;
      let resolvedSongName: string;
      let appliedPresetId = item.presetId ?? null;
      let appliedPresetOverrides: ContiSongOverrides | null = null;

      if (item.songId) {
        resolvedSongId = item.songId;
        resolvedSongName = item.songName?.trim() || item.newSongName?.trim() || item.title || item.songId;
      } else {
        const trimmedName = item.newSongName!.trim();
        const normalizedKey = trimmedName.toLowerCase();
        resolvedSongName = trimmedName;

        if (newSongMap.has(normalizedKey)) {
          resolvedSongId = newSongMap.get(normalizedKey)!;
        } else {
          const newSong = await insertTursoSong(trimmedName);
          newSongMap.set(normalizedKey, newSong.id);
          resolvedSongId = newSong.id;
          created++;
        }
      }

      if (item.videoId) {
        if (!item.songId && item.createNewPreset !== false) {
          const preset = await insertTursoSongPreset(resolvedSongId, {
            name: item.presetName || 'YouTube Import',
            youtubeReference: item.videoId,
            youtubeTitle: item.title,
          });
          appliedPresetId = preset.id;
        } else if (item.songId && item.presetId) {
          appliedPresetOverrides = await getPresetOverridesForSong(item.presetId, resolvedSongId);
          if (!appliedPresetOverrides) {
            throw new Error('PRESET_NOT_FOUND');
          }
          if (item.replaceExistingYoutube !== false) {
            await updateTursoSongPresetYoutubeRef(item.presetId, item.videoId, item.title);
          }
          appliedPresetId = item.presetId;
        } else if (item.songId && item.createNewPreset) {
          const preset = await insertTursoSongPreset(resolvedSongId, {
            name: item.presetName || 'YouTube Import',
            youtubeReference: item.videoId,
            youtubeTitle: item.title,
          });
          appliedPresetId = preset.id;
        }
      }

      if (appliedPresetId && !appliedPresetOverrides) {
        appliedPresetOverrides = await getPresetOverridesForSong(appliedPresetId, resolvedSongId);
        if (!appliedPresetOverrides) {
          throw new Error('PRESET_NOT_FOUND');
        }
      }

      if (item.alreadyInConti) {
        if (appliedPresetOverrides) {
          await tursoDb
            .update(contiSongs)
            .set({ ...stringifyContiSongOverrides(appliedPresetOverrides), updatedAt: dateToDbText(new Date()) })
            .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, resolvedSongId)));
        }
        const existingRows = await tursoDb
          .select({ id: contiSongs.id })
          .from(contiSongs)
          .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, resolvedSongId)))
          .limit(1);
        importedRows.push({ contiSongId: existingRows[0]?.id ?? null, songId: resolvedSongId, songName: resolvedSongName });
        presetUpdated++;
      } else {
        const contiSong = await insertTursoContiSong(
          contiId,
          resolvedSongId,
          nextSortOrder++,
          appliedPresetOverrides ?? undefined,
        );
        importedRows.push({ contiSongId: contiSong.id, songId: resolvedSongId, songName: resolvedSongName });
      }
    }

    for (let index = 0; index < items.length - 1; index++) {
      const mashupLink = items[index].mashupWithNext;
      if (!mashupLink) continue;

      const first = importedRows[index];
      const second = importedRows[index + 1];
      if (!first?.contiSongId || !second?.contiSongId || first.songId === second.songId) continue;

      try {
        const presetId = await resolveMashupPresetForImport({
          providedPresetId: mashupLink.presetId,
          createNewPreset: mashupLink.createNewPreset,
          songIds: [first.songId, second.songId],
          songNames: [first.songName, second.songName],
          presetName: mashupLink.presetName,
          findPreset: (songIds) => this.findMashupPresetBySongs(songIds),
          createPreset: (input) => this.createMashupPreset(input, null),
        });
        if (!presetId) continue;

        await this.applyMashupToContiSongs({
          contiId,
          firstContiSongId: first.contiSongId,
          secondContiSongId: second.contiSongId,
          presetId,
        });
        mashupsApplied++;
      } catch (error) {
        console.warn("[batchImportSongsToConti:mashup]", {
          contiId,
          firstContiSongId: first.contiSongId,
          secondContiSongId: second.contiSongId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { added: items.length - presetUpdated, created, presetUpdated, mashupsApplied };
  },

  async createSongPreset(songId: string, data, resolvedYoutube: ResolvedYouTubeMetadata | null) {
    const tursoDb = getTursoDb();
    if (data.isDefault) {
      await tursoDb.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const nextSortOrder = await getNextPresetSortOrderForSong(songId);
    const now = dateToDbText(new Date());
    const presetRecord = {
      id: generateId(),
      songId,
      presetType: "single" as const,
      displayTitle: null,
      mashupPairKey: null,
      name: data.name,
      keys: JSON.stringify(data.keys),
      tempos: JSON.stringify(data.tempos),
      sectionOrder: JSON.stringify(data.sectionOrder),
      lyrics: JSON.stringify([]),
      sectionLyricsMap: JSON.stringify(data.sectionLyricsMap),
      notes: data.notes,
      youtubeReference: resolvedYoutube?.videoId ?? null,
      youtubeTitle: resolvedYoutube?.title ?? null,
      pdfMetadata: data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null,
      isDefault: data.isDefault,
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.transaction(async (tx) => {
      await tx.insert(songPresets).values(presetRecord);
      await tx.insert(songPresetSongs).values({
        id: `${presetRecord.id}:song:0`,
        presetId: presetRecord.id,
        songId,
        sortOrder: 0,
        partLabel: null,
      });

      if (data.lyrics.length > 0) {
        await tx.update(songs)
          .set({ lyrics: JSON.stringify(data.lyrics), updatedAt: now })
          .where(eq(songs.id, songId));
      }

      if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
        await tx.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId: presetRecord.id,
            sheetMusicFileId: fileId,
            sortOrder: index,
          })),
        );
      }
    });

    return mapSongPreset(presetRecord);
  },

  async createMashupPreset({ songIds, data }, resolvedYoutube: ResolvedYouTubeMetadata | null) {
    if (songIds.length !== 2) {
      throw new Error("MASHUP_REQUIRES_TWO_SONGS");
    }
    if (songIds[0] === songIds[1]) {
      throw new Error("MASHUP_REQUIRES_DISTINCT_SONGS");
    }

    const tursoDb = getTursoDb();
    const nextSortOrder = await getNextPresetSortOrderForSong(songIds[0]);
    const mashupPairKey = getOrderedSongPairKey(songIds);
    const presetLyrics = data.lyrics.length > 0 ? data.lyrics : await getSongLyricsInOrder(songIds);
    const now = dateToDbText(new Date());
    const presetRecord = {
      id: generateId(),
      songId: songIds[0],
      presetType: "mashup" as const,
      displayTitle: data.displayTitle?.trim() || null,
      mashupPairKey,
      name: data.name,
      keys: JSON.stringify(data.keys),
      tempos: JSON.stringify(data.tempos),
      sectionOrder: JSON.stringify(data.sectionOrder),
      lyrics: JSON.stringify(presetLyrics),
      sectionLyricsMap: JSON.stringify(data.sectionLyricsMap),
      notes: data.notes,
      youtubeReference: resolvedYoutube?.videoId ?? null,
      youtubeTitle: resolvedYoutube?.title ?? null,
      pdfMetadata: data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null,
      isDefault: false,
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.transaction(async (tx) => {
      await tx.insert(songPresets).values(presetRecord);
      await tx.insert(songPresetSongs).values(
        songIds.map((songId, index) => ({
          id: `${presetRecord.id}:song:${index}`,
          presetId: presetRecord.id,
          songId,
          sortOrder: index,
          partLabel: null,
        })),
      );

      if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
        await tx.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId: presetRecord.id,
            sheetMusicFileId: fileId,
            sortOrder: index,
          })),
        );
      }
    });

    return mapSongPreset(presetRecord);
  },

  async applyMashupToContiSongs(input) {
    const tursoDb = getTursoDb();
    const contiRows = await tursoDb
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.contiId, input.contiId))
      .orderBy(asc(contiSongs.sortOrder), asc(contiSongs.id));
    const pair = getAdjacentOrderedTursoContiSongPair(contiRows, [
      input.firstContiSongId,
      input.secondContiSongId,
    ]);

    if (!pair) {
      const foundCount = contiRows.filter(
        (row) => row.id === input.firstContiSongId || row.id === input.secondContiSongId,
      ).length;
      if (foundCount !== 2) throw new Error("MASHUP_PAIR_NOT_FOUND");
      throw new Error("MASHUP_REQUIRES_ADJACENT_ROWS");
    }
    if (pair[0].mashupGroupId || pair[1].mashupGroupId) throw new Error("MASHUP_ALREADY_GROUPED");

    const preset = await this.getSongPresetWithSheetMusic(input.presetId);
    if (!preset || preset.presetType !== "mashup") throw new Error("MASHUP_PRESET_NOT_FOUND");
    const members = preset.members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
    if (members.length !== 2 || members[0].songId !== pair[0].songId || members[1].songId !== pair[1].songId) {
      throw new Error("MASHUP_PRESET_SONGS_MISMATCH");
    }

    const overrides = songPresetToContiOverrides(preset, preset.sheetMusicFileIds);
    const serialized = stringifyContiSongOverrides(overrides);
    const mashupGroupId = generateId();

    await tursoDb.transaction(async (tx) => {
      await tx.update(contiSongs).set({
        ...serialized,
        mashupGroupId,
        mashupPartOrder: 0,
        preMashupPresetId: pair[0].presetId,
        updatedAt: dateToDbText(new Date()),
      }).where(eq(contiSongs.id, pair[0].id));

      await tx.update(contiSongs).set({
        ...serialized,
        mashupGroupId,
        mashupPartOrder: 1,
        preMashupPresetId: pair[1].presetId,
        updatedAt: dateToDbText(new Date()),
      }).where(eq(contiSongs.id, pair[1].id));
    });

    return { mashupGroupId };
  },

  async updateMashupContiSongs(input) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(contiSongs)
      .where(and(eq(contiSongs.contiId, input.contiId), eq(contiSongs.mashupGroupId, input.mashupGroupId)))
      .orderBy(asc(contiSongs.mashupPartOrder));

    if (rows.length !== 2) throw new Error("MASHUP_GROUP_NOT_FOUND");

    // Arrangement fields only — presetId is intentionally omitted so both rows
    // keep pointing at the shared mashup preset and the group stays valid.
    const serialized = stringifyContiSongOverrides(input.overrides);

    await tursoDb.transaction(async (tx) => {
      for (const row of rows) {
        await tx.update(contiSongs).set({
          ...serialized,
          updatedAt: dateToDbText(new Date()),
        }).where(eq(contiSongs.id, row.id));
      }
    });
  },

  async splitMashup(input) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(contiSongs)
      .where(and(eq(contiSongs.contiId, input.contiId), eq(contiSongs.mashupGroupId, input.mashupGroupId)))
      .orderBy(asc(contiSongs.mashupPartOrder));

    if (rows.length !== 2) throw new Error("MASHUP_GROUP_NOT_FOUND");

    const updates: Array<{ rowId: string; overrides: ReturnType<typeof stringifyContiSongOverrides> }> = [];
    for (const row of rows) {
      const restoredOverrides =
        input.mode === "restore" && row.preMashupPresetId
          ? await getPresetOverridesForSong(row.preMashupPresetId, row.songId)
          : null;
      const overrides =
        input.mode === "restore" && restoredOverrides
          ? stringifyContiSongOverrides(restoredOverrides)
          : stringifyContiSongOverrides({
              keys: [],
              tempos: [],
              sectionOrder: [],
              lyrics: [],
              sectionLyricsMap: {},
              notes: null,
              sheetMusicFileIds: null,
              presetId: null,
            });

      updates.push({ rowId: row.id, overrides });
    }

    await tursoDb.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(contiSongs).set({
          ...update.overrides,
          mashupGroupId: null,
          mashupPartOrder: null,
          preMashupPresetId: null,
          updatedAt: dateToDbText(new Date()),
        }).where(eq(contiSongs.id, update.rowId));
      }
    });
  },

  async updateSongPreset(
    presetId: string,
    data,
    resolvedYoutube?: ResolvedYouTubeMetadata | null,
    options?: { lyricsSaveScope?: 'song' | 'preset' },
  ) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    const songId = existing[0].songId;
    const routeSingleLyricsToSong =
      existing[0].presetType === "single" &&
      data.lyrics !== undefined &&
      options?.lyricsSaveScope !== "preset";

    if (data.isDefault && existing[0].presetType === "mashup") {
      throw new Error("MASHUP_PRESET_CANNOT_BE_DEFAULT");
    }
    if (data.isDefault) {
      await tursoDb.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const updateData: Record<string, unknown> = { updatedAt: dateToDbText(new Date()) };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayTitle !== undefined) updateData.displayTitle = data.displayTitle?.trim() || null;
    if (data.keys !== undefined) updateData.keys = JSON.stringify(data.keys);
    if (data.tempos !== undefined) updateData.tempos = JSON.stringify(data.tempos);
    if (data.sectionOrder !== undefined) updateData.sectionOrder = JSON.stringify(data.sectionOrder);
    if (data.lyrics !== undefined) {
      updateData.lyrics = routeSingleLyricsToSong ? JSON.stringify([]) : JSON.stringify(data.lyrics);
    }
    if (data.sectionLyricsMap !== undefined) updateData.sectionLyricsMap = JSON.stringify(data.sectionLyricsMap);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.youtubeReference !== undefined) {
      updateData.youtubeReference = resolvedYoutube?.videoId ?? null;
      const existingYoutube = normalizeYouTubeReference(existing[0].youtubeReference);
      const shouldPreserveExistingYoutubeTitle =
        resolvedYoutube?.videoId &&
        !resolvedYoutube.title &&
        !data.youtubeTitle?.trim() &&
        existingYoutube?.videoId === resolvedYoutube.videoId &&
        !!existing[0].youtubeTitle?.trim();
      updateData.youtubeTitle = shouldPreserveExistingYoutubeTitle
        ? existing[0].youtubeTitle
        : resolvedYoutube?.title ?? null;
    } else if (data.youtubeTitle !== undefined && existing[0].youtubeReference) {
      updateData.youtubeTitle = data.youtubeTitle?.trim() || null;
    }
    if (data.pdfMetadata !== undefined) updateData.pdfMetadata = data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null;

    await tursoDb.transaction(async (tx) => {
      if (routeSingleLyricsToSong) {
        await tx.update(songs)
          .set({ lyrics: JSON.stringify(data.lyrics), updatedAt: dateToDbText(new Date()) })
          .where(eq(songs.id, songId));
      }

      await tx.update(songPresets).set(updateData).where(eq(songPresets.id, presetId));

      if (data.sheetMusicFileIds !== undefined) {
        await tx.delete(presetSheetMusic).where(eq(presetSheetMusic.presetId, presetId));
        if (data.sheetMusicFileIds.length > 0) {
          await tx.insert(presetSheetMusic).values(
            data.sheetMusicFileIds.map((fileId, index) => ({
              id: generateId(),
              presetId,
              sheetMusicFileId: fileId,
              sortOrder: index,
            })),
          );
        }
      }
    });

    const result = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    return result[0] ? mapSongPreset(result[0]) : null;
  },

  async deleteSongPreset(presetId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    await tursoDb.delete(songPresets).where(eq(songPresets.id, presetId));
    return mapSongPreset(existing[0]);
  },

  async setDefaultPreset(songId: string, presetId: string) {
    const tursoDb = getTursoDb();
    const target = await tursoDb
      .select({ id: songPresets.id })
      .from(songPresets)
      .where(and(
        eq(songPresets.id, presetId),
        eq(songPresets.songId, songId),
        eq(songPresets.presetType, "single"),
      ))
      .limit(1);
    if (!target[0]) {
      throw new Error("DEFAULT_PRESET_NOT_FOUND");
    }

    await tursoDb.transaction(async (tx) => {
      await tx.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
      await tx
        .update(songPresets)
        .set({ isDefault: true, updatedAt: dateToDbText(new Date()) })
        .where(eq(songPresets.id, presetId));
    });
  },

  async upsertContiPdfExport(contiId: string, data: { pdfUrl?: string | null; layoutState?: string | null }) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);
    const now = dateToDbText(new Date());

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = { updatedAt: now };
      if ('pdfUrl' in data) updateData.pdfUrl = data.pdfUrl ?? null;
      if ('layoutState' in data) updateData.layoutState = data.layoutState ?? null;
      await tursoDb.update(contiPdfExports).set(updateData).where(eq(contiPdfExports.id, existing[0].id));
      const result = await tursoDb.select().from(contiPdfExports).where(eq(contiPdfExports.id, existing[0].id)).limit(1);
      return mapContiPdfExport(result[0]);
    }

    const newExport = {
      id: generateId(),
      contiId,
      pdfUrl: data.pdfUrl ?? null,
      layoutState: data.layoutState ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(contiPdfExports).values(newExport);
    return mapContiPdfExport(newExport);
  },

  async deleteContiPdfExport(exportId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    await tursoDb.delete(contiPdfExports).where(eq(contiPdfExports.id, exportId));
    return mapContiPdfExport(existing[0]);
  },

  async createSongPageImage(data: SongPageImageInput) {
    const tursoDb = getTursoDb();
    const now = dateToDbText(new Date());
    const record = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(songPageImages).values(record);
    return mapSongPageImage(record);
  },

  async deletePageImagesForConti(contiId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId));

    await tursoDb.delete(songPageImages).where(eq(songPageImages.contiId, contiId));
    return existing.map(mapSongPageImage);
  },
};
