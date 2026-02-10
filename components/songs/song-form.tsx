'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createSong, updateSong } from '@/lib/actions/songs';
import type { SongWithSheetMusic } from '@/lib/types';

interface SongFormProps {
  song?: SongWithSheetMusic;
}

export function SongForm({ song }: SongFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = song
        ? await updateSong(song.id, formData)
        : await createSong(formData);

      if (result.success) {
        toast('곡이 저장되었습니다');
        if (song) {
          router.push(`/songs/${song.id}`);
        } else if (result.data) {
          router.push(`/songs/${result.data.id}`);
        }
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="name">곡 이름</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={song?.name}
              required
              disabled={isPending}
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              저장
            </Button>
            <Button variant="outline" render={<Link href="/songs" />}>
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
