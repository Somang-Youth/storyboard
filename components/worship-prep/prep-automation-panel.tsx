'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon, Rocket01Icon, Add01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createWeeklyWorshipThread, parseActiveWorshipThreadComments, resendWorshipRoleDropdowns } from '@/lib/actions/worship-prep';

export function PrepAutomationPanel() {
  const [isPending, startTransition] = useTransition();

  function runCreateThread() {
    startTransition(async () => {
      const result = await createWeeklyWorshipThread();
      if (!result.success) {
        toast.error(result.error ?? '스레드 생성 중 오류가 발생했습니다');
        return;
      }
      toast.success(`스레드 생성 완료: ${result.data?.threadName ?? ''}`);
    });
  }

  function runParseComments() {
    startTransition(async () => {
      const result = await parseActiveWorshipThreadComments();
      if (!result.success) {
        toast.error(result.error ?? '댓글 파싱 중 오류가 발생했습니다');
        return;
      }
      toast.success(`파싱 완료: ${result.data?.processedCount ?? 0}개 메시지 처리`);
    });
  }

  function runResendDropdowns() {
    startTransition(async () => {
      const result = await resendWorshipRoleDropdowns();
      if (!result.success) {
        toast.error(result.error ?? '드롭다운 재전송 중 오류가 발생했습니다');
        return;
      }
      toast.success('역할 선택 드롭다운 재전송 완료');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>자동화 실행</CardTitle>
        <CardDescription>디스코드 자동화를 직접 실행하고 결과를 시트 현황에 반영합니다</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-wrap gap-2'>
        <Button onClick={runCreateThread} disabled={isPending}>
          <HugeiconsIcon icon={Rocket01Icon} strokeWidth={2} data-icon='inline-start' />
          이번 주 스레드 생성
        </Button>
        <Button variant='outline' onClick={runParseComments} disabled={isPending}>
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon='inline-start' />
          새 메시지 파싱
        </Button>
        <Button variant='outline' onClick={runResendDropdowns} disabled={isPending}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon='inline-start' />
          역할 드롭다운 재전송
        </Button>
      </CardContent>
    </Card>
  );
}
