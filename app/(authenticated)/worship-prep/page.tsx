import { PageHeader } from '@/components/layout/page-header';
import { PrepAutomationPanel } from '@/components/worship-prep/prep-automation-panel';
import { PrepElementCards } from '@/components/worship-prep/prep-element-cards';
import { getWorshipPrepDetail } from '@/lib/queries/worship-prep';
import { Button } from '@/components/ui/button';
import { getContiByDate } from '@/lib/queries/contis';

export const dynamic = 'force-dynamic';

function getNearestFutureSundayIsoDate(baseDate = new Date()): string {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + diff);
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDate(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return getNearestFutureSundayIsoDate();
}

export default async function WorshipPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = normalizeDate(params.date);
  const [item, conti] = await Promise.all([getWorshipPrepDetail(selectedDate), getContiByDate(selectedDate)]);

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader title='예배 준비' description='가장 가까운 일요일 1주차를 기본으로 조회합니다' />
      <form className='flex flex-wrap items-center gap-2' method='GET'>
        <input
          type='date'
          name='date'
          defaultValue={selectedDate}
          className='h-9 rounded-md border border-input bg-background px-3 text-sm'
        />
        <Button type='submit' variant='outline'>
          주차 변경
        </Button>
      </form>
      <PrepAutomationPanel />
      {!item ? (
        <div className='flex flex-col items-center justify-center py-12 text-center'>
          <p className='text-base text-muted-foreground'>선택한 주차 데이터가 없습니다</p>
        </div>
      ) : (
        <PrepElementCards item={item} conti={conti} />
      )}
    </div>
  );
}
