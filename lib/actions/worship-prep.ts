'use server';

import { revalidatePath } from 'next/cache';
import { invalidateWorshipPrepSundayDate } from '@/lib/cache/invalidation';
import {
  buildInitialMessage,
  buildThreadName,
  archiveThread,
  createForumThread,
  formatToYYMMDD,
  getActiveForumThreads,
  getActiveThread,
  getChannel,
  getProcessedMessageIds,
  getThreadMessages,
  getUpcomingSundayDate,
  markMessageProcessed,
  sendDropdownMessage,
  setActiveThread,
} from '@/lib/discord-sync';
import { parseDiscordMessages } from '@/lib/discord-parser';
import { resolveGuildId, selectPreviousWorshipThreads, selectTargetWorshipThread, selectWorshipThreadBySundayDate } from '@/lib/discord-sync/cron-state';
import { correctSpelling } from '@/lib/discord-sync/spell-checker';
import { findRowByDate, readRoleOptionsWithFallback, updateWorshipData } from '@/lib/discord-sync/google-sheets';
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
import type { ActionResult } from '@/lib/types';

const SHEET_NAME = 'DB';

function hasParsedData(data?: { preacher?: string; leader?: string; worshipLeader?: string; title?: string; scripture?: string; songs?: string[] }): boolean {
  if (!data) return false;
  if (data.preacher || data.leader || data.worshipLeader || data.title || data.scripture) return true;
  return Boolean(data.songs && data.songs.length > 0);
}

function toSheetDate(sundayDate: string): string {
  return `20${sundayDate.slice(0, 2)}.${sundayDate.slice(2, 4)}.${sundayDate.slice(4, 6)}`;
}

async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}

async function getCurrentWorshipThread(): Promise<{ threadId: string; sundayDate: string } | null> {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (channelId) {
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });

    if (guildId) {
      const selected = selectTargetWorshipThread(await getActiveForumThreads(guildId, channelId));
      if (selected) {
        await setActiveThread(selected.id, selected.sundayDate);
        return { threadId: selected.id, sundayDate: selected.sundayDate };
      }
    }
  }

  const activeThread = await getActiveThread();
  return activeThread ? { threadId: activeThread.threadId, sundayDate: activeThread.sundayDate } : null;
}

export async function createWeeklyWorshipThread(): Promise<ActionResult<{ threadId: string; threadName: string; sundayDate: string }>> {
  try {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      return { success: false, error: 'DISCORD_CHANNEL_ID is not set' };
    }

    const sundayDate = getUpcomingSundayDate();
    const yymmdd = formatToYYMMDD(sundayDate);
    const threadName = buildThreadName(yymmdd);

    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });
    if (!guildId) {
      return { success: false, error: 'DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID' };
    }

    const options = (await readRoleOptionsWithFallback()).map((value) => ({ label: value, value }));
    if (options.length === 0) {
      return { success: false, error: '역할 선택 옵션이 비어 있습니다' };
    }

    const activeThreads = await getActiveForumThreads(guildId, channelId);
    const existingThread = selectWorshipThreadBySundayDate(activeThreads, yymmdd);
    if (existingThread) {
      return { success: false, error: `이미 ${existingThread.name} 스레드가 있습니다` };
    }

    const previousThreads = selectPreviousWorshipThreads(activeThreads, yymmdd);

    // Create first. Closing earlier threads is cleanup, and cleanup failing must
    // never cost this week's thread.
    const thread = await createForumThread(channelId, threadName, buildInitialMessage(sundayDate));

    for (const previousThread of previousThreads) {
      try {
        await archiveThread(previousThread.id);
      } catch (error) {
        console.error(`[createWeeklyWorshipThread] failed to close ${previousThread.name}`, error);
      }
    }

    const messageIds: string[] = [];
    if (thread.message?.id) {
      messageIds.push(thread.message.id);
    }

    const preacher = await sendDropdownMessage(thread.id, '설교자를 선택하세요', 'preacher-select', '설교자 선택', options);
    const leader = await sendDropdownMessage(thread.id, '인도자를 선택하세요', 'leader-select', '인도자 선택', options);
    const worshipLeader = await sendDropdownMessage(thread.id, '찬양 인도자를 선택하세요', 'worship-leader-select', '찬양 인도자 선택', options);
    messageIds.push(preacher.id, leader.id, worshipLeader.id);

    for (const messageId of messageIds) {
      await markMessageProcessed(thread.id, messageId, '', 'system');
    }

    await setActiveThread(thread.id, yymmdd);
    invalidateWorshipPrepSundayDate(yymmdd);

    revalidatePath('/worship-prep');
    return {
      success: true,
      data: {
        threadId: thread.id,
        threadName,
        sundayDate: yymmdd,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '주간 스레드 생성 중 오류가 발생했습니다',
    };
  }
}

export async function parseActiveWorshipThreadComments(): Promise<ActionResult<{ threadId: string; processedCount: number }>> {
  try {
    const activeThread = await getCurrentWorshipThread();
    if (!activeThread) {
      return { success: false, error: '활성 스레드가 없습니다' };
    }

    const messages = await getThreadMessages(activeThread.threadId);
    const processedIds = new Set(await getProcessedMessageIds(activeThread.threadId));
    const newMessages = messages.filter(
      (message) => !message.author.bot && !processedIds.has(message.id) && message.id !== activeThread.threadId,
    );

    if (newMessages.length === 0) {
      return {
        success: true,
        data: { threadId: activeThread.threadId, processedCount: 0 },
      };
    }

    const formattedDate = toSheetDate(activeThread.sundayDate);
    const targetRow = await findRowByDate(SHEET_NAME, formattedDate);
    if (!targetRow) {
      return { success: false, error: `No matching date row for ${formattedDate}` };
    }

    const parsedMessages = parseDiscordMessages(
      newMessages.map((message) => ({
        id: message.id,
        content: message.content,
        timestamp: message.timestamp,
        author: {
          id: message.author.id,
          username: message.author.username,
          globalName: message.author.global_name,
        },
      }))
    );

    const mergedData: {
      preacher?: string;
      leader?: string;
      worshipLeader?: string;
      title?: string;
      scripture?: string;
      songs?: string[];
    } = {};

    for (const parsed of parsedMessages) {
      const parsedData = parsed.parsedData;
      const parsedSuccess = hasParsedData(parsedData);
      if (!parsedSuccess || !parsedData) {
        continue;
      }

      if (parsedData.title) mergedData.title = parsedData.title;
      if (parsedData.scripture) mergedData.scripture = parsedData.scripture;
      if (parsedData.songs && parsedData.songs.length > 0) mergedData.songs = parsedData.songs;
    }

    if (Object.keys(mergedData).length > 0) {
      if (mergedData.title) {
        mergedData.title = await correctSpelling(mergedData.title);
      }
      await updateWorshipData(SHEET_NAME, targetRow, mergedData);
      invalidateWorshipPrepSundayDate(activeThread.sundayDate);
      await safelyCheckWorshipPrepReadyNotification({ sundayDate: activeThread.sundayDate });
    }

    const parseStatus = Object.keys(mergedData).length > 0 ? 'parsed' : 'ignored';
    for (const message of newMessages) {
      await markMessageProcessed(activeThread.threadId, message.id, message.content, parseStatus);
    }

    revalidatePath('/worship-prep');
    return {
      success: true,
      data: {
        threadId: activeThread.threadId,
        processedCount: newMessages.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '댓글 파싱 중 오류가 발생했습니다',
    };
  }
}

export async function resendWorshipRoleDropdowns(): Promise<ActionResult<{ threadId: string }>> {
  try {
    const activeThread = await getCurrentWorshipThread();
    if (!activeThread) {
      return { success: false, error: '활성 스레드가 없습니다' };
    }

    const options = (await readRoleOptionsWithFallback()).map((value) => ({ label: value, value }));
    if (options.length === 0) {
      return { success: false, error: '역할 선택 옵션이 비어 있습니다' };
    }

    await sendDropdownMessage(activeThread.threadId, '설교자를 선택하세요', 'preacher-select', '설교자 선택', options);
    await sendDropdownMessage(activeThread.threadId, '인도자를 선택하세요', 'leader-select', '인도자 선택', options);
    await sendDropdownMessage(activeThread.threadId, '찬양 인도자를 선택하세요', 'worship-leader-select', '찬양 인도자 선택', options);

    return {
      success: true,
      data: { threadId: activeThread.threadId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '드롭다운 재전송 중 오류가 발생했습니다',
    };
  }
}
