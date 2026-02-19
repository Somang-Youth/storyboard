import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorshipPrepSummary } from '@/lib/queries/worship-prep';

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}년 ${month}월 ${day}일`;
}

function completionLabel(rate: number): string {
  if (rate >= 100) return '완료';
  if (rate >= 60) return '진행 중';
  return '준비 필요';
}

export function PrepStatusCard({ item }: { item: WorshipPrepSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{formatDate(item.date)}</CardDescription>
        <CardTitle>{item.title || `${formatDate(item.date)} 예배`}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm text-muted-foreground'>준비율</span>
          <Badge variant='outline'>
            {item.status.completionRate}% · {completionLabel(item.status.completionRate)}
          </Badge>
        </div>
        <div className='text-sm text-muted-foreground'>
          설교자: {item.preacher || '-'} / 인도자: {item.leader || '-'} / 찬양인도자: {item.worshipLeader || '-'}
        </div>
        <div className='text-sm text-muted-foreground'>찬양: {item.songs.length > 0 ? item.songs.join(', ') : '-'}</div>
      </CardContent>
    </Card>
  );
}
