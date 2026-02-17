import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { discordThreadStates } from '@/lib/db/schema';
import { sendDropdownMessage, setActiveThread } from '@/lib/discord-sync';
import { readRoleOptionsFromSheet } from '@/lib/discord-sync/google-sheets';

type ThreadControlAction =
  | 'set_active'
  | 'clear_active'
  | 'send_worship_leader_dropdown'
  | 'send_leader_dropdown';

interface ThreadControlBody {
  action?: ThreadControlAction;
  threadId?: string;
  sundayDate?: string;
}

function getControlSecret(): string | null {
  return process.env.CRON_SECRET ?? process.env.DISCORD_CRON_SECRET ?? null;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getControlSecret();
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

function isValidSundayDate(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const activeRows = await db
    .select()
    .from(discordThreadStates)
    .where(eq(discordThreadStates.isActive, true))
    .orderBy(desc(discordThreadStates.updatedAt))
    .limit(1);

  const recentRows = await db
    .select()
    .from(discordThreadStates)
    .orderBy(desc(discordThreadStates.updatedAt))
    .limit(10);

  return NextResponse.json({
    success: true,
    data: {
      active: activeRows[0] ?? null,
      recent: recentRows,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ThreadControlBody;

    if (body.action === 'clear_active') {
      await db
        .update(discordThreadStates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(discordThreadStates.isActive, true));

      return NextResponse.json({
        success: true,
        message: 'Cleared active thread state',
      });
    }

    if (body.action === 'set_active') {
      const threadId = body.threadId?.trim();
      const sundayDate = body.sundayDate?.trim();

      if (!threadId || !sundayDate) {
        return NextResponse.json(
          { success: false, message: 'threadId and sundayDate are required for set_active' },
          { status: 400 }
        );
      }

      if (!isValidSundayDate(sundayDate)) {
        return NextResponse.json(
          { success: false, message: 'sundayDate must be YYMMDD format' },
          { status: 400 }
        );
      }

      await setActiveThread(threadId, sundayDate);

      return NextResponse.json({
        success: true,
        message: 'Active thread updated',
        data: { threadId, sundayDate },
      });
    }

    if (body.action === 'send_worship_leader_dropdown') {
      const threadId = body.threadId?.trim();
      if (!threadId) {
        return NextResponse.json(
          { success: false, message: 'threadId is required for send_worship_leader_dropdown' },
          { status: 400 }
        );
      }

      const options = (await readRoleOptionsFromSheet()).map((value) => ({ label: value, value }));
      if (options.length === 0) {
        return NextResponse.json({ success: false, message: 'DB_Options is empty' }, { status: 400 });
      }

      const message = await sendDropdownMessage(
        threadId,
        '찬양 인도자를 선택하세요',
        'worship-leader-select',
        '찬양 인도자 선택',
        options
      );

      return NextResponse.json({
        success: true,
        message: 'Worship leader dropdown sent',
        data: {
          threadId,
          messageId: message.id,
        },
      });
    }

    if (body.action === 'send_leader_dropdown') {
      const threadId = body.threadId?.trim();
      if (!threadId) {
        return NextResponse.json(
          { success: false, message: 'threadId is required for send_leader_dropdown' },
          { status: 400 }
        );
      }

      const options = (await readRoleOptionsFromSheet()).map((value) => ({ label: value, value }));
      if (options.length === 0) {
        return NextResponse.json({ success: false, message: 'DB_Options is empty' }, { status: 400 });
      }

      const message = await sendDropdownMessage(
        threadId,
        '인도자를 선택하세요',
        'leader-select',
        '인도자 선택',
        options
      );

      return NextResponse.json({
        success: true,
        message: 'Leader dropdown sent',
        data: {
          threadId,
          messageId: message.id,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'action must be one of: set_active, clear_active, send_worship_leader_dropdown, send_leader_dropdown',
      },
      { status: 400 }
    );
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
