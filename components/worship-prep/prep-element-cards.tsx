import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Conti } from '@/lib/types';
import type { WorshipPrepSummary } from '@/lib/queries/worship-prep';

interface PrepElementCardsProps {
  item: WorshipPrepSummary;
  conti: Conti | null;
}

function statusBadge(hasValue: boolean) {
  return <Badge variant={hasValue ? 'default' : 'outline'}>{hasValue ? '완료' : '미입력'}</Badge>;
}

function valueOrDash(value: string | null): string {
  return value && value.trim() ? value : '-';
}

export function PrepElementCards({ item, conti }: PrepElementCardsProps) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      <Card>
        <CardHeader>
          <CardDescription>역할</CardDescription>
          <CardTitle>설교자</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(item.preacher))}
          <p className='text-sm text-muted-foreground'>{valueOrDash(item.preacher)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>역할</CardDescription>
          <CardTitle>인도자</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(item.leader))}
          <p className='text-sm text-muted-foreground'>{valueOrDash(item.leader)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>역할</CardDescription>
          <CardTitle>찬양 인도자</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(item.worshipLeader))}
          <p className='text-sm text-muted-foreground'>{valueOrDash(item.worshipLeader)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>설교</CardDescription>
          <CardTitle>설교 제목</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(item.title))}
          <p className='text-sm text-muted-foreground'>{valueOrDash(item.title)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>설교</CardDescription>
          <CardTitle>말씀 본문</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(item.scripture))}
          <p className='text-sm text-muted-foreground'>{valueOrDash(item.scripture)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>찬양</CardDescription>
          <CardTitle>찬양 목록</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(item.songs.length > 0)}
          <p className='text-sm text-muted-foreground'>{item.songs.length > 0 ? item.songs.join(', ') : '-'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>연결</CardDescription>
          <CardTitle>콘티</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {statusBadge(Boolean(conti))}
          {conti ? (
            <Link href={`/contis/${conti.id}`} className='text-sm text-primary underline-offset-4 hover:underline'>
              {conti.title || `${conti.date} 콘티`}
            </Link>
          ) : (
            <p className='text-sm text-muted-foreground'>연결된 콘티 없음</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
