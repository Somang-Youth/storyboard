'use server';

import { db } from '@/lib/db';
import { songs, contiSongs } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, Song } from '@/lib/types';

const songSchema = z.object({
  name: z.string().min(1, '곡 이름을 입력해주세요'),
});

export async function createSong(formData: FormData): Promise<ActionResult<Song>> {
  try {
    const name = formData.get('name');
    const validation = songSchema.safeParse({ name });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const now = new Date();
    const song = {
      id: generateId(),
      name: validation.data.name,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songs).values(song);
    revalidatePath('/songs');

    return {
      success: true,
      data: song,
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 생성 중 오류가 발생했습니다',
    };
  }
}

export async function updateSong(id: string, formData: FormData): Promise<ActionResult<Song>> {
  try {
    const name = formData.get('name');
    const validation = songSchema.safeParse({ name });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const updatedSong = {
      name: validation.data.name,
      updatedAt: new Date(),
    };

    await db.update(songs).set(updatedSong).where(eq(songs.id, id));
    revalidatePath('/songs');

    const result = await db.select().from(songs).where(eq(songs.id, id)).limit(1);

    return {
      success: true,
      data: result[0],
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 수정 중 오류가 발생했습니다',
    };
  }
}

export async function deleteSong(id: string): Promise<ActionResult> {
  try {
    // Check if song is used in any conti
    const usedInConti = await db
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.songId, id))
      .limit(1);

    if (usedInConti.length > 0) {
      return {
        success: false,
        error: '이 곡은 콘티에서 사용 중이므로 삭제할 수 없습니다',
      };
    }

    await db.delete(songs).where(eq(songs.id, id));
    revalidatePath('/songs');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 삭제 중 오류가 발생했습니다',
    };
  }
}
