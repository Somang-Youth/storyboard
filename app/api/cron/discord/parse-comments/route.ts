import { NextRequest, NextResponse } from 'next/server';
import { getActiveThread, getThreadMessages, processDiscordMessages } from '@/lib/discord-sync';

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
    const activeThread = await getActiveThread();
    if (!activeThread) {
      return NextResponse.json({ success: true, message: 'No active thread found' });
    }

    const messages = await getThreadMessages(activeThread.threadId);
    const result = await processDiscordMessages(activeThread.threadId, activeThread.sundayDate, messages);

    return NextResponse.json({
      success: true,
      data: {
        threadId: activeThread.threadId,
        processedCount: result.processedCount,
        contiId: result.contiId,
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
