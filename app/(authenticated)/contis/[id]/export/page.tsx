import { notFound } from 'next/navigation';
import { getContiForExport, getContiPdfExport } from '@/lib/queries/contis';
import { PdfEditorLoader } from '@/components/contis/pdf-export/pdf-editor-loader';

export default async function ContiExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [conti, pdfExport] = await Promise.all([
    getContiForExport(id),
    getContiPdfExport(id),
  ]);

  if (!conti) {
    notFound();
  }

  return (
    <PdfEditorLoader
      conti={conti}
      existingExport={pdfExport}
    />
  );
}
