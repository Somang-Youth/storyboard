import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import {
  archiveThread,
  createForumThread,
  getActiveForumThreads,
  getChannel,
  sendDropdownMessage,
  sendThreadMessage,
  type DiscordSelectOption,
} from '@/lib/discord-sync/discord-client';
import {
  resolveGuildId,
  selectPreviousWorshipThreads,
  selectWorshipThreadBySundayDate,
  type SelectedWorshipThread,
} from '@/lib/discord-sync/cron-state';
import { buildInitialMessage, buildThreadName, formatToYYMMDD, getUpcomingSundayDate } from '@/lib/discord-sync/thread-template';
import { readRoleOptionsWithFallback } from '@/lib/discord-sync/google-sheets';

export const maxDuration = 60;

const LOG_PREFIX = '[cron/create-thread]';

const ROLE_DROPDOWNS = [
  { content: '설교자를 선택하세요', customId: 'preacher-select', placeholder: '설교자 선택' },
  { content: '인도자를 선택하세요', customId: 'leader-select', placeholder: '인도자 선택' },
  { content: '찬양 인도자를 선택하세요', customId: 'worship-leader-select', placeholder: '찬양 인도자 선택' },
] as const;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * The dropdown roster is a convenience, not a prerequisite. Reading it used to
 * throw and abort the run — a stalled Sheets request then cost the whole week's
 * thread — so a failure here is now reported, never fatal.
 */
async function readRoleOptions(): Promise<{ options: DiscordSelectOption[]; error: string | null }> {
  try {
    const options = (await readRoleOptionsWithFallback()).map((value) => ({ label: value, value }));
    return { options, error: options.length > 0 ? null : 'Role options are empty' };
  } catch (error) {
    console.error(`${LOG_PREFIX} role options unavailable`, error);
    return { options: [], error: `Role options unavailable: ${toMessage(error)}` };
  }
}

/**
 * Closes (never deletes) the worship threads of earlier Sundays. `archiveThread`
 * only sets `archived: true`, so the posts stay readable and anyone can reopen
 * one. Runs after the new thread exists, so a week that fails to roll over never
 * loses its thread to the cleanup.
 */
async function archivePreviousThreads(
  threads: SelectedWorshipThread[],
): Promise<{ closedIds: string[]; errors: string[] }> {
  const closedIds: string[] = [];
  const errors: string[] = [];

  for (const thread of threads) {
    try {
      await archiveThread(thread.id);
      closedIds.push(thread.id);
    } catch (error) {
      console.error(`${LOG_PREFIX} failed to close ${thread.name}`, error);
      errors.push(`Failed to close ${thread.name}: ${toMessage(error)}`);
    }
  }

  return { closedIds, errors };
}

async function sendRoleDropdowns(threadId: string, options: DiscordSelectOption[]): Promise<string[]> {
  const errors: string[] = [];

  for (const dropdown of ROLE_DROPDOWNS) {
    try {
      await sendDropdownMessage(threadId, dropdown.content, dropdown.customId, dropdown.placeholder, options);
    } catch (error) {
      console.error(`${LOG_PREFIX} failed to send ${dropdown.customId}`, error);
      errors.push(`Failed to send ${dropdown.customId}: ${toMessage(error)}`);
    }
  }

  return errors;
}

/**
 * A weekly cron that half-succeeds is otherwise invisible until someone notices
 * the thread looks wrong days later, so say it in the thread itself.
 */
async function reportWarningsToThread(threadId: string, warnings: string[]): Promise<void> {
  if (warnings.length === 0) return;

  try {
    await sendThreadMessage(
      threadId,
      [
        '⚠️ 스레드는 생성했지만 일부 단계가 실패했습니다.',
        ...warnings.map((warning) => `- ${warning}`),
        '',
        '역할 드롭다운이 없다면 예배 준비 화면의 `역할 드롭다운 재전송`을 실행해주세요.',
      ].join('\n'),
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to report warnings`, error);
  }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const sundayDate = getUpcomingSundayDate();
    const yymmdd = formatToYYMMDD(sundayDate);
    const threadName = buildThreadName(yymmdd);

    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID is not set');
    }

    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });
    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID');
    }

    const activeThreads = await getActiveForumThreads(guildId, channelId);
    const existingThread = selectWorshipThreadBySundayDate(activeThreads, yymmdd);
    const previousThreads = selectPreviousWorshipThreads(activeThreads, yymmdd);

    if (dryRun) {
      // Reads only — the point of a dry run is to prove every dependency answers,
      // including the Sheets call that a dry run used to skip entirely.
      const { options, error: roleOptionsError } = await readRoleOptions();

      return NextResponse.json({
        success: true,
        message: `Dry run: thread not created: ${threadName}`,
        data: {
          threadId: existingThread?.id ?? null,
          threadName,
          sundayDate: yymmdd,
          dryRun: true,
          threadAlreadyExists: Boolean(existingThread),
          wouldArchiveThread: previousThreads[0] ? { id: previousThreads[0].id, name: previousThreads[0].name } : null,
          wouldCloseThreads: previousThreads.map((thread) => ({ id: thread.id, name: thread.name })),
          wouldCreateThread: !existingThread,
          wouldSendDropdowns: options.length > 0,
          roleOptionCount: options.length,
          roleOptionsError,
        },
      });
    }

    if (existingThread) {
      return NextResponse.json({
        success: true,
        message: `Thread already exists: ${existingThread.name}`,
        data: {
          threadId: existingThread.id,
          threadName: existingThread.name,
          sundayDate: yymmdd,
          created: false,
        },
      });
    }

    const { options, error: roleOptionsError } = await readRoleOptions();

    // Create first. Everything below is cleanup or decoration, and none of it is
    // worth losing the thread over.
    const thread = await createForumThread(channelId, threadName, buildInitialMessage(sundayDate));

    const { closedIds, errors: archiveErrors } = await archivePreviousThreads(previousThreads);
    const dropdownErrors = options.length > 0 ? await sendRoleDropdowns(thread.id, options) : [];

    const warnings = [roleOptionsError, ...archiveErrors, ...dropdownErrors].filter(
      (warning): warning is string => Boolean(warning),
    );
    await reportWarningsToThread(thread.id, warnings);

    return NextResponse.json({
      success: true,
      message: `Thread created: ${threadName}`,
      data: {
        threadId: thread.id,
        threadName,
        sundayDate: yymmdd,
        created: true,
        closedThreadIds: closedIds,
        warnings,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} failed`, error);
    return NextResponse.json(
      {
        success: false,
        message: toMessage(error),
      },
      { status: 500 }
    );
  }
}
