import { NextRequest, NextResponse } from 'next/server';
import {
  buildInitialMessage,
  buildThreadName,
  createForumThread,
  formatToYYMMDD,
  getUpcomingSundayDate,
  markMessageProcessed,
  sendDropdownMessage,
  setActiveThread,
} from '@/lib/discord-sync';
import { readRoleOptionsWithFallback } from '@/lib/discord-sync/google-sheets';

export const maxDuration = 60;

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.DISCORD_CRON_SECRET;
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID is not set');
    }

    const sundayDate = getUpcomingSundayDate();
    const yymmdd = formatToYYMMDD(sundayDate);
    const threadName = buildThreadName(yymmdd);

    const thread = await createForumThread(channelId, threadName, buildInitialMessage(sundayDate));
    if (!dryRun) {
      await setActiveThread(thread.id, yymmdd);
    }

    const options = (await readRoleOptionsWithFallback()).map((value) => ({ label: value, value }));
    if (options.length === 0) {
      throw new Error('DB_Options is empty');
    }
    const messageIds: string[] = [];

    if (thread.message?.id) {
      messageIds.push(thread.message.id);
    }

    if (options.length > 0) {
      const preacher = await sendDropdownMessage(thread.id, '설교자를 선택하세요', 'preacher-select', '설교자 선택', options);
      const leader = await sendDropdownMessage(thread.id, '인도자를 선택하세요', 'leader-select', '인도자 선택', options);
      const worshipLeader = await sendDropdownMessage(
        thread.id,
        '찬양 인도자를 선택하세요',
        'worship-leader-select',
        '찬양 인도자 선택',
        options
      );

      messageIds.push(preacher.id, leader.id, worshipLeader.id);
    }

    if (!dryRun) {
      for (const messageId of messageIds) {
        await markMessageProcessed(thread.id, messageId, '', 'system');
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        threadId: thread.id,
        threadName,
        dryRun,
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
