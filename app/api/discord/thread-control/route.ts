import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { discordThreadStates } from '@/lib/db/schema';
import { setActiveThread } from '@/lib/discord-sync';

type ThreadControlAction = 'set_active' | 'clear_active';

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

  return NextResponse.json(
    { success: false, message: 'action must be one of: set_active, clear_active' },
    { status: 400 }
  );
}
