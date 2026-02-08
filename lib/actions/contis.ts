'use server';

import { db } from '@/lib/db';
import { contis } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, Conti } from '@/lib/types';

const contiSchema = z.object({
  title: z.string().transform(v => v.trim() || null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)'),
  description: z.string().optional(),
});

export async function createConti(formData: FormData): Promise<ActionResult<Conti>> {
  try {
    const title = formData.get('title');
    const date = formData.get('date');
    const description = formData.get('description');

    const validation = contiSchema.safeParse({ title, date, description });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const now = new Date();
    const conti = {
      id: generateId(),
      title: validation.data.title,
      date: validation.data.date,
      description: validation.data.description || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contis).values(conti);
    revalidatePath('/contis');

    return {
      success: true,
      data: conti,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 생성 중 오류가 발생했습니다',
    };
  }
}

export async function updateConti(id: string, formData: FormData): Promise<ActionResult<Conti>> {
  try {
    const title = formData.get('title');
    const date = formData.get('date');
    const description = formData.get('description');

    const validation = contiSchema.safeParse({ title, date, description });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const updatedConti = {
      title: validation.data.title,
      date: validation.data.date,
      description: validation.data.description || null,
      updatedAt: new Date(),
    };

    await db.update(contis).set(updatedConti).where(eq(contis.id, id));
    revalidatePath('/contis');

    const result = await db.select().from(contis).where(eq(contis.id, id)).limit(1);

    return {
      success: true,
      data: result[0],
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 수정 중 오류가 발생했습니다',
    };
  }
}

export async function deleteConti(id: string): Promise<ActionResult> {
  try {
    await db.delete(contis).where(eq(contis.id, id));
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 삭제 중 오류가 발생했습니다',
    };
  }
}
