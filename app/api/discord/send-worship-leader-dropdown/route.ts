import { NextRequest, NextResponse } from 'next/server';
import { getActiveThread, getDropdownOptions, sendDropdownMessage } from '@/lib/discord-sync';

function getCronSecret(): string | null {
  return process.env.DISCORD_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getCronSecret();
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

async function resolveThreadId(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { threadId?: string };
      if (body?.threadId?.trim()) {
        return body.threadId.trim();
      }
    } catch {
      return null;
    }
  }

  const activeThread = await getActiveThread();
  return activeThread?.threadId ?? null;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const threadId = await resolveThreadId(request);
    if (!threadId) {
      return NextResponse.json(
        { success: false, message: 'No active thread found and no threadId provided' },
        { status: 400 }
      );
    }

    const options = getDropdownOptions().map((value) => ({ label: value, value }));
    if (options.length === 0) {
      return NextResponse.json(
        { success: false, message: 'DISCORD_ROLE_OPTIONS is empty' },
        { status: 400 }
      );
    }

    const result = await sendDropdownMessage(
      threadId,
      '찬양 인도자를 선택하세요',
      'worship-leader-select',
      '찬양 인도자 선택',
      options
    );

    return NextResponse.json({
      success: true,
      data: {
        threadId,
        messageId: result.id,
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
