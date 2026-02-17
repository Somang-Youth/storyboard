import { NextRequest, NextResponse } from 'next/server';
import { getActiveThread, sendDropdownMessage } from '@/lib/discord-sync';
import { readRoleOptionsFromSheet } from '@/lib/discord-sync/google-sheets';

export async function POST(_: NextRequest) {
  const activeThread = await getActiveThread();
  if (!activeThread) {
    return NextResponse.json({ success: false, message: 'No active thread' }, { status: 404 });
  }

  const options = (await readRoleOptionsFromSheet()).map((value) => ({ label: value, value }));
  if (options.length === 0) {
    return NextResponse.json({ success: false, message: 'DB_Options is empty' }, { status: 400 });
  }

  await sendDropdownMessage(activeThread.threadId, '설교자를 선택하세요', 'preacher-select', '설교자 선택', options);
  await sendDropdownMessage(activeThread.threadId, '인도자를 선택하세요', 'leader-select', '인도자 선택', options);
  await sendDropdownMessage(activeThread.threadId, '찬양 인도자를 선택하세요', 'worship-leader-select', '찬양 인도자 선택', options);

  return NextResponse.json({ success: true, threadId: activeThread.threadId });
}
