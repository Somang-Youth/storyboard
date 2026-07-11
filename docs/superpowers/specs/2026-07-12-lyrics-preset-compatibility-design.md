# 프리셋 가사 호환 및 콘티 적용 설계

## 배경

곡 고유 가사의 저장 주체가 `song_presets.lyrics`에서 `songs.lyrics`로 이동했다. 현재 Turso 마이그레이션은 기존 단일 프리셋 가사를 곡으로 옮긴 뒤 모든 단일 프리셋의 `lyrics`를 `[]`로 비운다.

곡 상세의 프리셋 편집기는 이 변경에 맞춰 단일 프리셋 가사가 비었을 때 `songs.lyrics`를 사용한다. 그러나 콘티에서 프리셋을 적용하는 경로는 이전 구현을 유지하고 있다.

- `SongPicker`의 기본 프리셋 및 수동 프리셋 적용
- `ContiSongEditor`의 프리셋 불러오기
- repository의 `getPresetOverridesForSong`
- 이를 사용하는 YouTube 가져오기와 매시업 해제 후 프리셋 복원

이 경로들은 비워진 `preset.lyrics`만 파싱하므로, 다른 편곡 정보는 복원되지만 가사는 `[]`로 콘티에 복사된다. 기존 설계에는 “단일 프리셋 적용 시 resolved lyrics를 `conti_songs.lyrics`로 복사한다”는 요구가 있었지만 구현 계획과 회귀 테스트에서 콘티 적용 경로가 누락됐다.

## 운영 데이터 확인

2026-07-12 Production Turso를 읽기 전용으로 확인한 결과는 다음과 같다.

- 곡: 41개
- 단일 프리셋: 46개
- 매시업 프리셋: 2개
- 가사가 비어 있지 않은 단일 프리셋: 0개
- `songs.lyrics`에 가사가 있는 곡: 31개
- `songs.lyrics`가 비어 있는 곡: 10개
- 잘못된 JSON을 가진 단일 프리셋 가사: 0개

따라서 현재 운영 데이터에는 프리셋에서 곡으로 옮길 대상이 없다. 최근 생성되거나 갱신된 가사 레코드도 `songs.lyrics`에 존재한다. 이번 변경은 데이터 이관이 아니라, 이미 곡에 있는 가사를 콘티 적용 시 올바르게 불러오는 런타임 호환 수정이다.

## 목표

1. 모든 프리셋 적용 경로가 동일한 resolved lyrics 규칙을 사용한다.
2. 프론트엔드는 가사의 저장 위치를 추론하지 않는다.
3. 단일 프리셋 전용 override와 매시업 스냅샷 의미를 보존한다.
4. 프리셋 적용 시점의 resolved lyrics를 `conti_songs.lyrics`에 스냅샷으로 복사한다.
5. 향후 새 적용 경로가 raw `preset.lyrics`만 사용하면 타입 또는 테스트에서 드러나게 한다.

## 비목표

- DB 스키마 변경 또는 추가 Drizzle 마이그레이션
- 기존 콘티 가사의 일괄 변경
- 매시업 가사를 곡 고유 가사로 분해하거나 재배분
- UI에 가사 출처를 표시하는 기능
- `sectionLyricsMap`의 자동 재작성

## 용어

- **raw preset lyrics**: `song_presets.lyrics`에 저장된 원본 값
- **canonical song lyrics**: `songs.lyrics`에 저장된 단일 곡 고유 가사
- **mashup fallback lyrics**: 매시업 멤버 곡의 canonical lyrics를 멤버 순서대로 합친 값
- **resolved lyrics**: 편집 또는 콘티 적용에 실제 사용하는 최종 가사
- **lyrics source**: resolved lyrics가 선택된 이유를 나타내는 명시적 출처

`lyricsSource`는 다음 리터럴 union으로 표현한다.

```ts
type PresetLyricsSource =
  | "preset-override"
  | "song"
  | "mashup-snapshot"
  | "mashup-fallback"
  | "empty"
```

## 가사 결정 규칙

| 프리셋 종류 | raw preset lyrics | fallback | resolved lyrics | source |
|---|---|---|---|---|
| single | 비어 있지 않음 | 무관 | raw preset lyrics | `preset-override` |
| single | 비어 있음 | canonical song lyrics 존재 | canonical song lyrics | `song` |
| mashup | 비어 있지 않음 | 무관 | raw preset lyrics | `mashup-snapshot` |
| mashup | 비어 있음 | mashup fallback 존재 | mashup fallback | `mashup-fallback` |
| single/mashup | 모두 없음 | 없음 | `[]` | `empty` |

raw JSON 파싱에 실패하거나 배열이 아니면 “비어 있음”으로 취급하고 다음 fallback으로 진행한다. 배열에서는 문자열 항목만 사용한다. 현재 저장 정책과 일치하도록 빈 배열은 프리셋 전용 “의도적인 빈 가사 override”로 해석하지 않는다.

## 아키텍처

### 공통 resolver

`lib/utils/preset-lyrics.ts`에 DB와 React에 의존하지 않는 순수 resolver를 둔다. 입력은 프리셋 종류, raw preset lyrics, canonical song lyrics, mashup fallback lyrics이며 출력은 다음 구조다.

```ts
interface ResolvedPresetLyrics {
  lyrics: string[]
  source: PresetLyricsSource
}
```

가사 우선순위와 JSON 방어 로직은 이 함수에서만 관리한다. `songPresetToDraft`와 `songPresetToContiOverrides`가 각자 `preset.lyrics`를 파싱하지 않는다.

### 서버 응답 계약

프론트엔드에 raw 필드만 보내고 판단을 맡기지 않는다. 프리셋 상세 또는 적용용 응답에 다음 필드를 추가한다.

```ts
interface ResolvedSongPresetWithSheetMusic extends SongPresetWithSheetMusic {
  resolvedLyrics: string[]
  lyricsSource: PresetLyricsSource
}
```

repository가 canonical/fallback 데이터를 조회한 뒤 공통 resolver를 호출해 두 필드를 채운다. raw `lyrics`는 프리셋 편집과 저장 범위 판단을 위해 유지한다. 콘티 프론트엔드는 `resolvedLyrics`만 사용하며 `lyricsSource`로 저장 위치를 분기하지 않는다. `lyricsSource`는 타입 검증, 회귀 테스트, 진단에 사용한다.

### 변환기 경계

`songPresetToDraft`는 편집기 draft 변환만 담당한다. 기존 프리셋에는 서버가 제공한 `resolvedLyrics`를 사용하고, 새 프리셋 draft에는 소유 곡의 canonical lyrics를 명시적으로 전달한다.

`songPresetToContiOverrides`는 프리셋을 콘티 스냅샷으로 바꾸는 유일한 변환기가 된다. 입력 타입은 `resolvedLyrics`가 필수인 적용용 프리셋으로 제한한다. 따라서 raw `SongPreset`을 넘겨 가사를 잃는 호출은 TypeScript에서 실패한다.

## 적용 경로별 변경

### SongPicker

- `getPresetsForSong` 대신 resolved lyrics와 악보 선택을 포함한 적용용 프리셋을 조회한다.
- 기본 프리셋 자동 적용과 수동 프리셋 선택 모두 `songPresetToContiOverrides`를 호출한다.
- 컴포넌트 내부의 반복 `JSON.parse`와 별도 가사 조립을 제거한다.

### ContiSongEditor

- 로컬 `presetToDraft`를 제거한다.
- 적용용 프리셋 응답을 받아 공통 draft 변환기를 사용한다.
- 콘티의 곡명, `isDefault` 등 콘티 편집에 필요한 표시 필드만 변환 결과 위에 명시적으로 덮는다.

### Turso repository

- `getSongPresetsWithSheetMusic`와 `getSongPresetWithSheetMusic`이 resolved fields를 제공한다.
- `getPresetOverridesForSong`은 raw preset row가 아니라 canonical/fallback까지 포함한 적용용 프리셋을 만든 뒤 공통 콘티 변환기를 호출한다.
- YouTube 가져오기와 매시업 해제 복원은 기존처럼 `getPresetOverridesForSong`을 사용하므로 같은 수정이 전파된다.
- 매시업 콘티 적용은 저장된 snapshot을 우선하고, snapshot이 비었을 때만 멤버 곡 fallback을 사용한다.

## 데이터 흐름

### 프론트엔드에서 프리셋 적용

1. FE가 곡의 적용용 프리셋 목록을 요청한다.
2. repository가 raw preset, canonical song lyrics, mashup fallback, 악보 선택을 조회한다.
3. 서버가 `resolvedLyrics`와 `lyricsSource`를 계산해 응답한다.
4. FE가 `songPresetToContiOverrides`로 resolved lyrics를 포함한 override를 만든다.
5. 서버 액션이 override를 `conti_songs.lyrics`에 스냅샷으로 저장한다.

### 서버 내부 적용 및 복원

1. import 또는 복원 로직이 preset id와 song id로 `getPresetOverridesForSong`을 호출한다.
2. repository가 적용용 프리셋을 구성하고 resolver를 실행한다.
3. 공통 콘티 변환기가 resolved lyrics를 포함한 override를 반환한다.
4. 호출자가 콘티 row를 생성하거나 갱신한다.

기존 콘티 row는 자동으로 바꾸지 않는다. 곡 가사가 변경돼도 이미 작성된 콘티는 스냅샷을 유지하며, 사용자가 프리셋을 다시 적용한 경우에만 최신 resolved lyrics를 받는다.

## 오류 처리

- raw preset lyrics가 잘못된 JSON이면 canonical 또는 mashup fallback으로 진행한다.
- canonical/fallback도 없으면 유효한 빈 가사 `[]`를 반환한다.
- 빈 가사는 오류가 아니므로 새 사용자 오류 메시지를 추가하지 않는다.
- 프리셋 조회 자체가 실패한 경우 기존 액션 오류를 유지하며 빈 가사로 성공 처리하지 않는다.
- `sectionLyricsMap`은 프리셋의 arrangement 데이터이므로 기존 값을 유지한다.
- 가사 페이지 수가 바뀌어 map index가 범위를 벗어나는 문제는 이번 범위에서 자동 보정하지 않는다.

## 데이터 이관 안전 정책

현재 운영 이관 대상은 0건이므로 데이터 변경을 실행하지 않는다. 이후 같은 점검을 다시 수행해야 한다면 다음 규칙을 적용한다.

1. 읽기 전용 정합성 보고서를 먼저 만들고 사용자가 후보 목록을 명시적으로 승인한 뒤에만 쓴다.
2. `preset_type = 'single'`이며 raw preset lyrics가 비어 있지 않은 row만 후보로 삼는다.
3. 곡 가사가 비어 있고 모든 후보 프리셋 가사가 동일하면 한 트랜잭션에서 곡으로 복사하고 후보 프리셋을 `[]`로 비운다.
4. 곡 가사와 프리셋 가사가 동일하면 곡은 유지하고 중복 프리셋 값만 `[]`로 비운다.
5. 곡 가사와 프리셋 가사가 다르거나 한 곡의 프리셋끼리 다르면 자동 덮어쓰지 않고 검토 목록으로 남긴다.
6. 매시업 프리셋은 항상 제외한다.
7. 쓰기 전후 후보 수, 곡별 hash, 변경 row 수를 비교하고 불일치 시 트랜잭션을 롤백한다.

## 테스트

### 단위 테스트

- single raw override가 canonical보다 우선한다.
- single raw가 비면 canonical을 사용한다.
- mashup snapshot이 fallback보다 우선한다.
- mashup snapshot이 비면 멤버 순서 fallback을 사용한다.
- 잘못된 raw JSON과 배열이 아닌 값은 fallback으로 진행한다.
- 모든 입력이 비면 `[]`와 `empty`를 반환한다.
- `songPresetToDraft`와 `songPresetToContiOverrides`가 동일한 resolved lyrics를 사용한다.
- `preset.lyrics = []`이고 canonical lyrics가 있는 단일 프리셋을 콘티로 변환하면 canonical lyrics가 보존된다.
- 프리셋 전용 override는 canonical lyrics보다 우선한다.

### 경로 회귀 테스트

- `SongPicker`의 기본 프리셋 자동 적용이 공통 변환기를 사용한다.
- `SongPicker`의 수동 프리셋 선택이 공통 변환기를 사용한다.
- `ContiSongEditor`가 raw `preset.lyrics`를 직접 파싱하지 않는다.
- `getPresetOverridesForSong`이 single canonical lyrics를 포함한다.
- YouTube import에서 기존 프리셋을 적용할 때 canonical lyrics를 복사한다.
- 매시업 해제 후 이전 단일 프리셋을 복원할 때 canonical lyrics를 복사한다.
- 매시업 snapshot/fallback 정책은 기존 테스트와 함께 유지된다.

### 검증 명령과 smoke test

- 관련 Vitest 실행
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- 기존 콘티는 변경되지 않는지 확인
- 곡 추가에서 기본/수동 단일 프리셋을 적용하면 곡 가사가 들어오는지 확인
- 기존 콘티 곡 편집에서 프리셋을 다시 불러오면 곡 가사가 보이는지 확인
- 프리셋 전용 override가 있는 테스트 데이터에서는 override가 우선하는지 확인

## 고려한 대안

### 각 화면에 fallback을 개별 추가

변경량은 작지만 가사 결정 규칙이 중복되고 서버 import/복원 경로가 다시 누락될 수 있어 제외한다.

### 프리셋 적용 전용 서버 서비스로 모든 API 재구성

가장 강한 중앙화지만 현재 UI와 액션 계약을 넓게 바꿔야 한다. 이번 결함에는 공통 resolver와 적용용 DTO로 충분하므로 제외한다.

### 곡 가사를 모든 단일 프리셋에 다시 복제

이전 소비자는 동작하지만 가사 주체를 곡으로 옮긴 목적을 되돌리고, 프리셋 전용 override와 중복 데이터의 의미가 충돌하므로 제외한다.

## 완료 기준

- 콘티의 모든 프리셋 적용 경로가 서버가 계산한 `resolvedLyrics`를 사용한다.
- FE 코드가 가사 저장 위치를 추론하거나 raw `preset.lyrics`를 직접 콘티에 복사하지 않는다.
- 단일 곡 canonical, 단일 프리셋 override, 매시업 snapshot/fallback 우선순위가 테스트로 고정된다.
- Production 데이터 감사 결과에 따라 불필요한 DB 쓰기를 수행하지 않는다.
- 관련 테스트, 타입 검사, lint가 통과한다.
