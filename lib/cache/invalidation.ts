import { revalidateTag, updateTag } from 'next/cache';
import { cacheTags, toIsoDateFromYYMMDD } from '@/lib/cache/tags';

function unique(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

export function updateCacheTags(...tags: string[]) {
  for (const tag of unique(tags)) {
    updateTag(tag);
  }
}

export function expireCacheTags(...tags: string[]) {
  for (const tag of unique(tags)) {
    revalidateTag(tag, { expire: 0 });
  }
}

export function invalidateSongs() {
  updateCacheTags(cacheTags.songs());
}

export function invalidateSong(songId: string) {
  updateCacheTags(cacheTags.songs(), cacheTags.song(songId), cacheTags.songPresets(songId), cacheTags.contis());
}

export function invalidateSongDetail(songId: string) {
  updateCacheTags(cacheTags.song(songId));
}

export function invalidateSongPresets(songId: string) {
  updateCacheTags(cacheTags.song(songId), cacheTags.songPresets(songId), cacheTags.contis());
}

export function invalidateContis() {
  updateCacheTags(cacheTags.contis());
}

export function invalidateConti(contiId: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.conti(contiId));
}

export function invalidateContiDate(date: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.contiByDate(date));
}

export function invalidateContiPdfExport(contiId: string) {
  // Purge for future reads only — never read-your-writes refresh. This fires on
  // the open PDF editor's background autosave, which already owns the latest
  // layout in local state. updateTag() would re-send this route's RSC to the
  // client, hand the editor fresh conti/existingExport prop references, and force
  // a full rebuild mid-edit (the "keeps refreshing" bug). expire marks the tag
  // stale so the next time the editor is opened it refetches the saved layout.
  expireCacheTags(cacheTags.contiPdfExport(contiId));
}

export function invalidateContiWithDate(contiId: string, date: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.conti(contiId), cacheTags.contiByDate(date));
}

export function invalidateWorshipPrepDate(date: string) {
  updateCacheTags(cacheTags.worshipPrep(date), cacheTags.worshipPrepList());
}

export function invalidateWorshipPrepSundayDate(sundayDate: string) {
  invalidateWorshipPrepDate(toIsoDateFromYYMMDD(sundayDate));
}

export function expireWorshipPrepDate(date: string) {
  expireCacheTags(cacheTags.worshipPrep(date), cacheTags.worshipPrepList());
}

export function expireWorshipPrepSundayDate(sundayDate: string) {
  expireWorshipPrepDate(toIsoDateFromYYMMDD(sundayDate));
}
