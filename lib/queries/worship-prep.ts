import { readRecentWorshipData, readWorshipDataByDate, type SheetWorshipRow } from '@/lib/discord-sync/google-sheets';

export interface WorshipPrepStatus {
  hasPreacher: boolean;
  hasLeader: boolean;
  hasWorshipLeader: boolean;
  hasTitle: boolean;
  hasScripture: boolean;
  hasSongs: boolean;
  completionRate: number;
}

export interface WorshipPrepSummary extends SheetWorshipRow {
  status: WorshipPrepStatus;
}

function toStatus(row: SheetWorshipRow): WorshipPrepStatus {
  const checks = [
    Boolean(row.preacher),
    Boolean(row.leader),
    Boolean(row.worshipLeader),
    Boolean(row.title),
    Boolean(row.scripture),
    row.songs.length > 0,
  ];

  const completedCount = checks.filter(Boolean).length;

  return {
    hasPreacher: checks[0],
    hasLeader: checks[1],
    hasWorshipLeader: checks[2],
    hasTitle: checks[3],
    hasScripture: checks[4],
    hasSongs: checks[5],
    completionRate: Math.round((completedCount / checks.length) * 100),
  };
}

export async function getWorshipPrepList(weeks = 8): Promise<WorshipPrepSummary[]> {
  const rows = await readRecentWorshipData(weeks);
  return rows.map((row) => ({
    ...row,
    status: toStatus(row),
  }));
}

export async function getWorshipPrepDetail(isoDate: string): Promise<WorshipPrepSummary | null> {
  const row = await readWorshipDataByDate(isoDate);
  if (!row) {
    return null;
  }

  return {
    ...row,
    status: toStatus(row),
  };
}
