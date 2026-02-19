import { NextRequest, NextResponse } from 'next/server';
import { addMessageReaction, getActiveThread, getProcessedMessageIds, getThreadMessages, markMessageProcessed } from '@/lib/discord-sync';
import { parseDiscordMessages } from '@/lib/discord-parser';
import { correctSpelling } from '@/lib/discord-sync/spell-checker';
import { findRowByDate, updateWorshipData } from '@/lib/discord-sync/google-sheets';

export const maxDuration = 60;
const SHEET_NAME = 'DB';

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.DISCORD_CRON_SECRET;
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

function hasParsedData(data?: { preacher?: string; leader?: string; worshipLeader?: string; title?: string; scripture?: string; songs?: string[] }): boolean {
  if (!data) return false;
  if (data.preacher || data.leader || data.worshipLeader || data.title || data.scripture) return true;
  return Boolean(data.songs && data.songs.length > 0);
}

function toSheetDate(sundayDate: string): string {
  return `20${sundayDate.slice(0, 2)}.${sundayDate.slice(2, 4)}.${sundayDate.slice(4, 6)}`;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeThread = await getActiveThread();
    if (!activeThread) {
      return NextResponse.json({ success: true, message: 'No active thread found' });
    }

    const messages = await getThreadMessages(activeThread.threadId);
    const processedIds = new Set(await getProcessedMessageIds(activeThread.threadId));
    const newMessages = messages.filter((message) => !processedIds.has(message.id) && message.id !== activeThread.threadId);

    if (newMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new messages',
      });
    }

    const formattedDate = toSheetDate(activeThread.sundayDate);
    const targetRow = await findRowByDate(SHEET_NAME, formattedDate);
    if (!targetRow) {
      return NextResponse.json(
        {
          success: false,
          message: `No matching date row for ${formattedDate}`,
        },
        { status: 404 }
      );
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

    for (let index = 0; index < parsedMessages.length; index += 1) {
      const parsed = parsedMessages[index]?.parsedData;
      const message = newMessages[index];
      const parsedSuccess = hasParsedData(parsed);

      if (message && parsedSuccess) {
        try {
          await addMessageReaction(message.channel_id, message.id, '✅');
        } catch {}
      }

      if (!parsedSuccess || !parsed) {
        continue;
      }

      if (parsed.title) mergedData.title = parsed.title;
      if (parsed.scripture) mergedData.scripture = parsed.scripture;
      if (parsed.songs && parsed.songs.length > 0) mergedData.songs = parsed.songs;
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

    return NextResponse.json({
      success: true,
      message: Object.keys(mergedData).length > 0 ? `Processed ${newMessages.length} new messages` : 'No parsable data',
      data: {
        threadId: activeThread.threadId,
        processedCount: newMessages.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
