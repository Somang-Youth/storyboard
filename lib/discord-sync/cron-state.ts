export interface ActiveForumThread {
  id: string;
  name: string;
  parent_id?: string;
}

export interface SelectedWorshipThread extends ActiveForumThread {
  sundayDate: string;
}

export interface DiscordReactionLike {
  emoji?: {
    name?: string | null;
  } | null;
  count?: number;
  me?: boolean;
}

export interface DiscordMessageReactionState {
  reactions?: DiscordReactionLike[];
}

export interface DiscordChannelGuildState {
  guild_id?: string | null;
}

const WORSHIP_THREAD_PATTERN = /^(\d{6})\s+예배 준비$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const PARSED_REACTION = '✅';
export const IGNORED_REACTION = '☑️';
export const PROCESSED_REACTIONS = [PARSED_REACTION, IGNORED_REACTION] as const;

export function resolveGuildId({
  configuredGuildId,
  channel,
}: {
  configuredGuildId?: string | null;
  channel?: DiscordChannelGuildState | null;
}): string | null {
  const configured = configuredGuildId?.trim();
  if (configured) return configured;

  const resolved = channel?.guild_id?.trim();
  return resolved || null;
}

export function parseWorshipThreadName(threadName: string): string | null {
  return threadName.match(WORSHIP_THREAD_PATTERN)?.[1] ?? null;
}

export function toSheetDateFromYYMMDD(sundayDate: string): string {
  return `20${sundayDate.slice(0, 2)}.${sundayDate.slice(2, 4)}.${sundayDate.slice(4, 6)}`;
}

function toKstDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

function yymmddToUtcDay(sundayDate: string): number {
  const year = Number(`20${sundayDate.slice(0, 2)}`);
  const month = Number(sundayDate.slice(2, 4));
  const day = Number(sundayDate.slice(4, 6));
  return Date.UTC(year, month - 1, day);
}

function kstDateToUtcDay(date: Date): number {
  const parts = toKstDateParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function selectTargetWorshipThread(
  threads: ActiveForumThread[],
  baseDate = new Date(),
): SelectedWorshipThread | null {
  const today = kstDateToUtcDay(baseDate);
  const candidates = threads
    .map((thread) => {
      const sundayDate = parseWorshipThreadName(thread.name);
      if (!sundayDate) return null;

      const diffDays = Math.round((yymmddToUtcDay(sundayDate) - today) / DAY_MS);
      return { ...thread, sundayDate, diffDays };
    })
    .filter((thread): thread is SelectedWorshipThread & { diffDays: number } => thread !== null);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aIsFutureOrToday = a.diffDays >= 0;
    const bIsFutureOrToday = b.diffDays >= 0;

    if (aIsFutureOrToday && bIsFutureOrToday) return a.diffDays - b.diffDays;
    if (!aIsFutureOrToday && !bIsFutureOrToday) return b.diffDays - a.diffDays;
    return aIsFutureOrToday ? -1 : 1;
  });

  const selected = candidates[0];
  return {
    id: selected.id,
    name: selected.name,
    parent_id: selected.parent_id,
    sundayDate: selected.sundayDate,
  };
}

export function selectWorshipThreadBySundayDate(
  threads: ActiveForumThread[],
  sundayDate: string,
): SelectedWorshipThread | null {
  const selected = threads.find((thread) => parseWorshipThreadName(thread.name) === sundayDate);
  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    name: selected.name,
    parent_id: selected.parent_id,
    sundayDate,
  };
}

/**
 * Every still-open worship thread for a Sunday before the target one, nearest
 * first. Returns all of them rather than just last week's: a week whose cron
 * failed leaves its thread open forever otherwise, which is exactly what
 * happened when the 260906 run timed out.
 */
export function selectPreviousWorshipThreads(
  threads: ActiveForumThread[],
  targetSundayDate: string,
): SelectedWorshipThread[] {
  return threads
    .map((thread) => {
      const sundayDate = parseWorshipThreadName(thread.name);
      if (!sundayDate) return null;

      const diff = yymmddToUtcDay(targetSundayDate) - yymmddToUtcDay(sundayDate);
      if (diff <= 0) return null;

      return { ...thread, sundayDate, diff };
    })
    .filter((thread): thread is SelectedWorshipThread & { diff: number } => thread !== null)
    .sort((a, b) => a.diff - b.diff)
    .map((thread) => ({
      id: thread.id,
      name: thread.name,
      parent_id: thread.parent_id,
      sundayDate: thread.sundayDate,
    }));
}

export function selectPreviousWorshipThread(
  threads: ActiveForumThread[],
  targetSundayDate: string,
): SelectedWorshipThread | null {
  return selectPreviousWorshipThreads(threads, targetSundayDate)[0] ?? null;
}

export function hasProcessedReaction(message: DiscordMessageReactionState): boolean {
  return Boolean(
    message.reactions?.some(
      (reaction) =>
        reaction.me === true &&
        PROCESSED_REACTIONS.includes(reaction.emoji?.name as (typeof PROCESSED_REACTIONS)[number]) &&
        (reaction.count ?? 0) > 0,
    ),
  );
}
