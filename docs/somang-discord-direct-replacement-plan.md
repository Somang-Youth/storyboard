# somang-discord Direct Replacement Plan (Low-Risk/Low-Criticality)

## Objective

`storyboard`가 `somang-discord`를 완전히 대체하도록 구현한다.
엄밀한 무중단 마이그레이션 대신, 짧은 전환 윈도우로 단순하게 교체한다.

## Replacement Strategy

1. `storyboard`에 Discord 인터랙션/크론 엔드포인트를 직접 구현
2. thread state/processed message 상태를 Postgres에 영속 저장
3. parse 결과를 Google Sheets 대신 `contis`/`songs` 도메인에 직접 반영
4. Vercel Cron을 `storyboard`로 이전
5. Discord Interactions URL을 `storyboard`로 변경
6. `somang-discord`를 disable

## Endpoint Ownership (Target)

- Interactions: `/api/discord/interactions`
- Create weekly thread: `/api/cron/discord/create-thread`
- Parse comments: `/api/cron/discord/parse-comments`

## Data Ownership (Target)

- Runtime sync state: `discord_thread_states`
- Deduped messages: `discord_processed_messages`
- Interaction idempotency: `discord_interaction_receipts`
- Worship output: existing `contis`, `conti_songs`, `songs`

## Execution Steps

### Step 1: Backend wiring
- Discord REST client
- Interaction signature verify helper
- DB state store
- Parser merge to conti/song upsert flow

### Step 2: Deployment wiring
- env vars 추가
- middleware bypass 추가 (`/api/discord`, `/api/cron/discord`)
- vercel cron path 등록

### Step 3: Cutover
- `storyboard` 배포
- Discord Developer Portal에서 Interactions URL 교체
- 기존 somang-discord cron disable
- 첫 주차 스레드 생성/파싱 수동 검증

## Operational Checklist (After Cutover)

- [ ] `/api/cron/discord/create-thread` 수동 호출 성공
- [ ] dropdown 선택 시 role 값 저장 확인
- [ ] `/api/cron/discord/parse-comments` 수동 호출 성공
- [ ] title/scripture/songs가 conti에 반영되는지 확인
- [ ] 중복 메시지 재처리되지 않는지 확인

## Rollback (Simple)

- Discord Interactions URL을 기존 somang-discord로 복귀
- storyboard cron 비활성화
- 상태 테이블은 보존(분석용)
