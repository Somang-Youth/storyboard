# somang-discord -> storyboard Migration Blueprint

## Goal

현재 `storyboard`를 메인 제품으로 유지하면서, `somang-discord`의 검증된 자동화 로직을 단계적으로 이관한다.

핵심 원칙:
- 전체 재작성하지 않는다.
- 현재 도메인 자산(콘티/찬양 라이브러리/악보/PDF/PPT)을 유지한다.
- Discord 자동화는 독립 모듈로 흡수하고 점진 배포한다.

## Scope Decision

### In Scope (Migration)
1. 메시지 파싱 엔진
   - `말씀/본문`, `제목`, `찬양` 추출
   - 성경 구절 정규화
   - 새 메시지 병합(last-write-wins)
2. 주간 스레드 규약
   - `YYMMDD 예배 준비` 네이밍
   - 초기 안내 템플릿
3. Discord 역할 선택 플로우
   - 설교자/인도자/찬양인도자 선택
4. 운영 상태 저장 로직
   - 기존 Redis 키 구조를 참고해 DB 기반으로 재설계

### Out of Scope (Later)
1. 기존 앱 UI 대규모 개편
2. 기존 인증 체계 전면 교체
3. PPT/주보 편집 기능 교체
4. Sheets-only 운영으로 회귀

## Source-to-Target Mapping

| Source (somang-discord) | Target (storyboard) | Phase |
|---|---|---|
| `lib/parser.ts` | `lib/discord-parser/parser.ts` | P1 |
| `lib/scripture-parser.ts` | `lib/discord-parser/scripture.ts` | P1 |
| parse merge logic in `parse-comments/route.ts` | `lib/discord-parser/merge.ts` | P1 |
| `lib/discord.ts` thread/message helpers | `lib/discord-sync/client.ts` | P2 |
| `lib/kv.ts` state keys | `lib/discord-sync/state-store.ts` (DB) | P3 |
| `app/api/cron/*` | `app/api/cron/discord/*` | P4 |
| `app/api/discord/interactions/route.ts` | `app/api/discord/interactions/route.ts` | P4 |

## Phased Plan

## P1. Parser Core Migration (this PR)

### Deliverables
- `lib/discord-parser/scripture.ts`
- `lib/discord-parser/parser.ts`
- `lib/discord-parser/merge.ts`
- 타입 정의/헬퍼

### Acceptance Criteria
- 문자열 파싱으로 `scripture/title/songs`를 추출한다.
- `songs`는 번호/대시/슬래시/쉼표 형식을 처리하고 최대 4개로 제한한다.
- 성경 구절을 표준 형태로 정규화한다.
- 메시지 배열 병합 시 동일 필드는 마지막 값이 우선된다.

## P2. Discord Client Integration

### Deliverables
- Discord REST 클라이언트 모듈
- 스레드 생성/메시지 조회/리액션/드롭다운 전송

### Acceptance Criteria
- Bot token 인증으로 Discord API v10 호출 가능
- 실패 시 일관된 에러 반환

## P3. Persistent State Migration (Redis -> Postgres)

### Deliverables
- DB 테이블: `discord_thread_states`, `discord_processed_messages`(초안)
- 상태 읽기/쓰기 레이어

### Acceptance Criteria
- 현재 활성 스레드 조회 가능
- 중복 처리 방지 위한 processed message 추적 가능
- 운영 이력 감사 가능

## P4. Endpoints + Scheduler

### Deliverables
- `/api/cron/discord/create-thread`
- `/api/cron/discord/parse-comments`
- `/api/discord/interactions`
- `vercel.json` cron 등록

### Acceptance Criteria
- 주간 스레드 생성 자동화
- 신규 메시지 파싱 자동화
- 인터랙션 서명 검증 처리

## P5. Data Sink Expansion

### Deliverables
- Sheets 업데이트 + App DB 업데이트 동시 지원
- feature flag 기반 sink 선택

### Acceptance Criteria
- 초기: Sheets 동기화 유지
- 중기: App DB가 단일 진실원(source of truth)으로 전환 가능

## Risks and Controls

1. API Rate Limit/Quota
- Control: 크론 주기 조정, 배치 처리, 실패 재시도 백오프

2. Date-row coupling in Sheets
- Control: 사전 검증 + 누락 행 경고 알림

3. Parser false positives
- Control: 파싱 성공 리액션/로그 + 샘플 스레드 회귀 케이스 유지

4. Security on Discord webhooks
- Control: Ed25519 서명 검증 필수

## Rollout Strategy

1. P1 코드 머지 (read-only parser)
2. P2/P3 feature flag behind
3. P4 dry-run endpoint 배포
4. 실제 채널 제한 배포(canary)
5. 안정화 후 전체 활성화

## Operational Metrics

- parse success rate
- message processing latency
- duplicate processing count
- sheet/app write failure count
- webhook signature failure count

## Current PR Boundary

이 PR은 P1만 포함한다:
- parser core migration
- blueprint 문서화
- 기존 런타임 동작 변화 없음
