'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, File01Icon } from '@hugeicons/core-free-icons';
import type { SheetMusicFile } from '@/lib/types';
import { deleteSheetMusic } from '@/lib/actions/sheet-music';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface SheetMusicGalleryProps {
  files: SheetMusicFile[];
  editable?: boolean;
  songId?: string;
}

export function SheetMusicGallery({ files, editable = false }: SheetMusicGalleryProps) {
  const [selectedFile, setSelectedFile] = useState<SheetMusicFile | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    const result = await deleteSheetMusic(fileId);

    if (result.success) {
      toast('악보가 삭제되었습니다');
    } else {
      toast.error(result.error);
    }
  };

  const isImage = (fileType: string) => fileType.startsWith('image/');
  const isPDF = (fileType: string) => fileType === 'application/pdf';

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="relative group"
            onMouseEnter={() => setHoveredFileId(file.id)}
            onMouseLeave={() => setHoveredFileId(null)}
          >
            <div
              onClick={() => setSelectedFile(file)}
              className="cursor-pointer rounded-lg overflow-hidden border hover:border-primary/50 transition-colors"
            >
              {isImage(file.fileType) ? (
                <img
                  src={file.fileUrl}
                  alt={file.fileName}
                  className="w-full aspect-auto object-cover"
                />
              ) : isPDF(file.fileType) ? (
                <div className="aspect-square flex flex-col items-center justify-center bg-muted p-4">
                  <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-12 text-muted-foreground" />
                  <p className="text-xs text-center mt-2 text-muted-foreground line-clamp-2">
                    {file.fileName}
                  </p>
                </div>
              ) : null}
            </div>

            {editable && hoveredFileId === file.id && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>악보 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 악보를 삭제하시겠습니까?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(file.id)}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedFile?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {selectedFile && isImage(selectedFile.fileType) && (
              <img
                src={selectedFile.fileUrl}
                alt={selectedFile.fileName}
                className="max-h-[80vh] w-auto mx-auto"
              />
            )}
            {selectedFile && isPDF(selectedFile.fileType) && (
              <iframe
                src={selectedFile.fileUrl}
                className="w-full h-[80vh]"
                title={selectedFile.fileName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
