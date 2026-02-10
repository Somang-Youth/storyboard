'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload04Icon } from '@hugeicons/core-free-icons';
import { uploadSheetMusic } from '@/lib/actions/sheet-music';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface SheetMusicUploaderProps {
  songId: string;
}

export function SheetMusicUploader({ songId }: SheetMusicUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setIsUploading(true);

    try {
      for (const file of fileArray) {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error('지원하지 않는 파일 형식입니다');
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error('파일 크기는 10MB를 초과할 수 없습니다');
          continue;
        }

        // Upload file
        const formData = new FormData();
        formData.append('file', file);

        const result = await uploadSheetMusic(songId, formData);

        if (result.success) {
          toast('악보가 업로드되었습니다');
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndUploadFiles(e.target.files);
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndUploadFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    document.getElementById('sheet-music-input')?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-primary' : 'hover:border-primary/50'
      } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <input
        id="sheet-music-input"
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <div className="flex flex-col items-center gap-2">
        <HugeiconsIcon icon={Upload04Icon} className="size-10 text-muted-foreground" />
        <div>
          <p className="text-base font-medium">
            {isUploading ? '업로드 중...' : '악보 파일을 드래그하거나 클릭하여 업로드'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            PNG, JPG, WebP, PDF (최대 10MB)
          </p>
        </div>
      </div>
    </div>
  );
}
