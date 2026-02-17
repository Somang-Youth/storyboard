import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contis, discordInteractionReceipts, discordProcessedMessages, discordThreadStates } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

export async function setActiveThread(threadId: string, sundayDate: string) {
  const now = new Date();

  await db.update(discordThreadStates).set({ isActive: false, updatedAt: now }).where(eq(discordThreadStates.isActive, true));

  const existing = await db.select().from(discordThreadStates).where(eq(discordThreadStates.threadId, threadId)).limit(1);
  if (existing.length > 0) {
    await db
      .update(discordThreadStates)
      .set({ sundayDate, isActive: true, updatedAt: now })
      .where(eq(discordThreadStates.threadId, threadId));
    return;
  }

  await db.insert(discordThreadStates).values({
    id: generateId(),
    threadId,
    sundayDate,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getActiveThread() {
  const rows = await db
    .select()
    .from(discordThreadStates)
    .where(eq(discordThreadStates.isActive, true))
    .orderBy(desc(discordThreadStates.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function markMessageProcessed(threadId: string, messageId: string, rawContent: string, parseStatus: string) {
  const now = new Date();
  const existing = await db.select().from(discordProcessedMessages).where(eq(discordProcessedMessages.messageId, messageId)).limit(1);
  if (existing.length > 0) {
    return;
  }

  await db.insert(discordProcessedMessages).values({
    id: generateId(),
    threadId,
    messageId,
    rawContent,
    parseStatus,
    processedAt: now,
  });
}

export async function getProcessedMessageIds(threadId: string): Promise<string[]> {
  const rows = await db
    .select({ messageId: discordProcessedMessages.messageId })
    .from(discordProcessedMessages)
    .where(eq(discordProcessedMessages.threadId, threadId));

  return rows.map((row) => row.messageId);
}

export async function hasInteractionReceipt(interactionId: string): Promise<boolean> {
  const rows = await db
    .select({ id: discordInteractionReceipts.id })
    .from(discordInteractionReceipts)
    .where(eq(discordInteractionReceipts.interactionId, interactionId))
    .limit(1);

  return rows.length > 0;
}

export async function saveInteractionReceipt(interactionId: string, interactionType: number) {
  const now = new Date();
  const exists = await hasInteractionReceipt(interactionId);
  if (exists) {
    return;
  }

  await db.insert(discordInteractionReceipts).values({
    id: generateId(),
    interactionId,
    interactionType,
    processedAt: now,
  });
}

export async function saveRoleSelection(customId: string, selectedValue: string) {
  const active = await getActiveThread();
  if (!active) {
    return;
  }

  const now = new Date();
  if (customId === 'preacher-select') {
    await db
      .update(discordThreadStates)
      .set({ preacher: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
    return;
  }

  if (customId === 'leader-select') {
    await db
      .update(discordThreadStates)
      .set({ leader: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
    return;
  }

  if (customId === 'worship-leader-select') {
    await db
      .update(discordThreadStates)
      .set({ worshipLeader: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
  }
}

export async function upsertContiByDate(date: string, title: string | null, description: string | null): Promise<string> {
  const existing = await db.select().from(contis).where(eq(contis.date, date)).limit(1);
  const now = new Date();

  if (existing.length > 0) {
    const conti = existing[0];
    await db
      .update(contis)
      .set({ title: title ?? conti.title, description: description ?? conti.description, updatedAt: now })
      .where(eq(contis.id, conti.id));
    return conti.id;
  }

  const id = generateId();
  await db.insert(contis).values({
    id,
    title,
    date,
    description,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function attachContiToActiveThread(contiId: string) {
  const active = await getActiveThread();
  if (!active) {
    return;
  }

  await db
    .update(discordThreadStates)
    .set({ contiId, updatedAt: new Date() })
    .where(and(eq(discordThreadStates.id, active.id), eq(discordThreadStates.isActive, true)));
}
