import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorshipPrepSummary } from '@/lib/queries/worship-prep';

interface PrepComparisonGridProps {
  items: WorshipPrepSummary[];
}

function mark(ok: boolean): string {
  return ok ? '완료' : '미완료';
}

function weekLabel(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

export function PrepComparisonGrid({ items }: PrepComparisonGridProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>주차별 준비 비교</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        <div className='hidden grid-cols-[96px_repeat(6,minmax(0,1fr))_88px] gap-2 rounded-md border bg-muted/30 p-2 text-xs font-semibold text-muted-foreground md:grid'>
          <span>주차</span>
          <span>설교자</span>
          <span>인도자</span>
          <span>찬양인도</span>
          <span>제목</span>
          <span>말씀</span>
          <span>찬양</span>
          <span>진행률</span>
        </div>
        {items.map((item) => (
          <div key={item.date} className='grid gap-2 rounded-md border p-2 md:grid-cols-[96px_repeat(6,minmax(0,1fr))_88px] md:items-center'>
            <div className='text-sm font-medium'>{weekLabel(item.date)}</div>
            <div className='text-sm'>{mark(item.status.hasPreacher)}</div>
            <div className='text-sm'>{mark(item.status.hasLeader)}</div>
            <div className='text-sm'>{mark(item.status.hasWorshipLeader)}</div>
            <div className='text-sm'>{mark(item.status.hasTitle)}</div>
            <div className='text-sm'>{mark(item.status.hasScripture)}</div>
            <div className='text-sm'>{mark(item.status.hasSongs)}</div>
            <div>
              <Badge variant='outline'>{item.status.completionRate}%</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
