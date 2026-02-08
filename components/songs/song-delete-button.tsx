'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { deleteSong } from '@/lib/actions/songs';

interface SongDeleteButtonProps {
  songId: string;
  songName: string;
}

export function SongDeleteButton({ songId, songName }: SongDeleteButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteSong(songId);

      if (result.success) {
        toast('곡이 삭제되었습니다');
        router.push('/songs');
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>곡 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            {songName}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
