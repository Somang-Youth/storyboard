'use server';

import { revalidatePath } from 'next/cache';
import {
  buildInitialMessage,
  buildThreadName,
  createForumThread,
  formatToYYMMDD,
  getActiveThread,
  getProcessedMessageIds,
  getThreadMessages,
  getUpcomingSundayDate,
  markMessageProcessed,
  sendDropdownMessage,
  setActiveThread,
} from '@/lib/discord-sync';
import { parseDiscordMessages } from '@/lib/discord-parser';
import { correctSpelling } from '@/lib/discord-sync/spell-checker';
import { findRowByDate, readRoleOptionsWithFallback, updateWorshipData } from '@/lib/discord-sync/google-sheets';
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

export async function createWeeklyWorshipThread(): Promise<ActionResult<{ threadId: string; threadName: string; sundayDate: string }>> {
  try {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      return { success: false, error: 'DISCORD_CHANNEL_ID is not set' };
    }

    const sundayDate = getUpcomingSundayDate();
    const yymmdd = formatToYYMMDD(sundayDate);
    const threadName = buildThreadName(yymmdd);

    const thread = await createForumThread(channelId, threadName, buildInitialMessage(sundayDate));
    await setActiveThread(thread.id, yymmdd);

    const options = (await readRoleOptionsWithFallback()).map((value) => ({ label: value, value }));
    if (options.length === 0) {
      return { success: false, error: '역할 선택 옵션이 비어 있습니다' };
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
    const activeThread = await getActiveThread();
    if (!activeThread) {
      return { success: false, error: '활성 스레드가 없습니다' };
    }

    const messages = await getThreadMessages(activeThread.threadId);
    const processedIds = new Set(await getProcessedMessageIds(activeThread.threadId));
    const newMessages = messages.filter((message) => !processedIds.has(message.id) && message.id !== activeThread.threadId);

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
    const activeThread = await getActiveThread();
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
