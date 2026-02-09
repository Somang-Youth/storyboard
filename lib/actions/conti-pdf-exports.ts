'use server';

import { db } from '@/lib/db';
import { contiPdfExports } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';
import type { ActionResult, ContiPdfExport } from '@/lib/types';

export async function saveContiPdfLayout(
  contiId: string,
  layoutState: string,
): Promise<ActionResult<ContiPdfExport>> {
  try {
    // Check if export already exists for this conti
    const existing = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      // Update existing
      await db
        .update(contiPdfExports)
        .set({ layoutState, updatedAt: now })
        .where(eq(contiPdfExports.id, existing[0].id));

      return {
        success: true,
        data: { ...existing[0], layoutState, updatedAt: now },
      };
    }

    // Create new
    const newExport: ContiPdfExport = {
      id: generateId(),
      contiId,
      pdfUrl: null,
      layoutState,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contiPdfExports).values(newExport);

    return {
      success: true,
      data: newExport,
    };
  } catch (error) {
    return {
      success: false,
      error: '레이아웃 저장 중 오류가 발생했습니다',
    };
  }
}

export async function exportContiPdf(
  contiId: string,
  formData: FormData,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: 'PDF 파일이 없습니다',
      };
    }

    // Check for existing export to clean up old blob
    const existing = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    // Delete old blob if exists
    if (existing.length > 0 && existing[0].pdfUrl) {
      try {
        await del(existing[0].pdfUrl);
      } catch {
        // Ignore blob deletion errors (file may already be gone)
      }
    }

    // Upload new PDF to Vercel Blob
    const blob = await put(`conti-exports/${contiId}.pdf`, file, {
      access: 'public',
    });

    const now = new Date();

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(contiPdfExports)
        .set({ pdfUrl: blob.url, updatedAt: now })
        .where(eq(contiPdfExports.id, existing[0].id));
    } else {
      // Create new record
      await db.insert(contiPdfExports).values({
        id: generateId(),
        contiId,
        pdfUrl: blob.url,
        layoutState: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    revalidatePath('/contis');

    return {
      success: true,
      data: { pdfUrl: blob.url },
    };
  } catch (error) {
    return {
      success: false,
      error: 'PDF 내보내기 중 오류가 발생했습니다',
    };
  }
}

export async function deleteContiPdfExport(
  exportId: string,
): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    if (existing.length === 0) {
      return {
        success: false,
        error: 'PDF 내보내기를 찾을 수 없습니다',
      };
    }

    // Delete blob if exists
    if (existing[0].pdfUrl) {
      try {
        await del(existing[0].pdfUrl);
      } catch {
        // Ignore blob deletion errors
      }
    }

    await db.delete(contiPdfExports).where(eq(contiPdfExports.id, exportId));
    revalidatePath('/contis');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'PDF 삭제 중 오류가 발생했습니다',
    };
  }
}
