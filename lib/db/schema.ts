import { pgTable, text, integer, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const songs = pgTable('songs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const sheetMusicFiles = pgTable('sheet_music_files', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
});

export const songPresets = pgTable('song_presets', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  youtubeReference: text('youtube_reference'),
  pdfMetadata: text('pdf_metadata'),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const presetSheetMusic = pgTable('preset_sheet_music', {
  id: text('id').primaryKey(),
  presetId: text('preset_id').notNull().references(() => songPresets.id, { onDelete: 'cascade' }),
  sheetMusicFileId: text('sheet_music_file_id').notNull().references(() => sheetMusicFiles.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('preset_sheet_music_unique').on(table.presetId, table.sheetMusicFileId),
]);

export const contis = pgTable('contis', {
  id: text('id').primaryKey(),
  title: text('title'),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const contiSongs = pgTable('conti_songs', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  sheetMusicFileIds: text('sheet_music_file_ids'),  // JSON string[] | null
  presetId: text('preset_id').references(() => songPresets.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_song_unique').on(table.contiId, table.songId),
]);

export const contiPdfExports = pgTable('conti_pdf_exports', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  pdfUrl: text('pdf_url'),
  layoutState: text('layout_state'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_pdf_export_unique').on(table.contiId),
]);

export const songPageImages = pgTable('song_page_images', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  pageIndex: integer('page_index').notNull(),
  sheetMusicFileId: text('sheet_music_file_id').references(() => sheetMusicFiles.id, { onDelete: 'set null' }),
  pdfPageIndex: integer('pdf_page_index'),
  presetSnapshot: text('preset_snapshot'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const discordThreadStates = pgTable('discord_thread_states', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  sundayDate: text('sunday_date').notNull(),
  contiId: text('conti_id').references(() => contis.id, { onDelete: 'set null' }),
  preacher: text('preacher'),
  leader: text('leader'),
  worshipLeader: text('worship_leader'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('discord_thread_states_thread_id_unique').on(table.threadId),
]);

export const discordProcessedMessages = pgTable('discord_processed_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  messageId: text('message_id').notNull(),
  parseStatus: text('parse_status').notNull().default('processed'),
  rawContent: text('raw_content'),
  processedAt: timestamp('processed_at').notNull(),
}, (table) => [
  uniqueIndex('discord_processed_messages_message_id_unique').on(table.messageId),
]);

export const discordInteractionReceipts = pgTable('discord_interaction_receipts', {
  id: text('id').primaryKey(),
  interactionId: text('interaction_id').notNull(),
  interactionType: integer('interaction_type').notNull(),
  processedAt: timestamp('processed_at').notNull(),
}, (table) => [
  uniqueIndex('discord_interaction_receipts_interaction_id_unique').on(table.interactionId),
]);
