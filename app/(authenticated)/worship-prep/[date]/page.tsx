import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWorshipPrepDetail } from '@/lib/queries/worship-prep';

export const dynamic = 'force-dynamic';

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}년 ${month}월 ${day}일`;
}

export default async function WorshipPrepDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const detail = await getWorshipPrepDetail(date);

  if (!detail) {
    notFound();
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader title={`${formatDate(detail.date)} 예배 준비`} description='선택한 주의 Google Sheets 설정 값을 표시합니다' backHref='/worship-prep' />

      <Card>
        <CardHeader>
          <CardTitle>준비 현황</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <div className='text-sm text-muted-foreground'>준비율 {detail.status.completionRate}%</div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant={detail.status.hasPreacher ? 'default' : 'outline'}>설교자</Badge>
            <Badge variant={detail.status.hasLeader ? 'default' : 'outline'}>인도자</Badge>
            <Badge variant={detail.status.hasWorshipLeader ? 'default' : 'outline'}>찬양인도자</Badge>
            <Badge variant={detail.status.hasTitle ? 'default' : 'outline'}>설교제목</Badge>
            <Badge variant={detail.status.hasScripture ? 'default' : 'outline'}>말씀본문</Badge>
            <Badge variant={detail.status.hasSongs ? 'default' : 'outline'}>찬양</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>주차 설정 값</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <div>설교자: {detail.preacher || '-'}</div>
          <div>인도자: {detail.leader || '-'}</div>
          <div>찬양 인도자: {detail.worshipLeader || '-'}</div>
          <div>설교 제목: {detail.title || '-'}</div>
          <div>말씀 본문: {detail.scripture || '-'}</div>
          <div>찬양 목록: {detail.songs.length > 0 ? detail.songs.join(', ') : '-'}</div>
        </CardContent>
      </Card>
    </div>
  );
}
