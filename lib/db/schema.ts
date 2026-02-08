import { pgTable, text, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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

export const contis = pgTable('contis', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
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
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_song_unique').on(table.contiId, table.songId),
]);
