import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { getContiForExport, getContiPdfExport } from '@/lib/queries/contis';

const PdfEditor = dynamic(
  () => import('@/components/contis/pdf-export/pdf-editor').then(m => ({ default: m.PdfEditor })),
  { ssr: false, loading: () => <PdfEditorSkeleton /> }
);

function PdfEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
      <div className="aspect-[1/1.414] w-full max-w-3xl mx-auto bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

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
    <PdfEditor
      conti={conti}
      existingExport={pdfExport}
    />
  );
}
