# M8 클라우드 동기화 (CloudSync) 설계 — 2026-07-04

> **상태: 사용자 리뷰 대기.** 동기화 UX는 사용자 확정(토글 + 자동 편승). 전제조건: Supabase에 `e-gistory` 테이블 생성(사용자 액션 — §1 SQL, 2026-07-04 REST 확인 결과 미존재). **테이블명은 사용자 지시(2026-07-04)로 storymaps → `e-gistory`로 변경** — 하이픈 포함이라 SQL에서는 `"e-gistory"` 따옴표 식별자 필수, supabase-js `.from('e-gistory')`는 그대로 동작.

## 1. 전제: Supabase 테이블 (사용자가 대시보드 SQL 편집기에서 1회 실행)

```sql
create table public."e-gistory" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  unique(user_id, title)          -- e-GIS projects와 동일 패턴, upsert 충돌 키
);
alter table public."e-gistory" enable row level security;
create policy "own e-gistory rows" on public."e-gistory"
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 2. 확정 UX (사용자 승인)

- **프로젝트별 토글**: 에디터 헤더(저장 상태 옆)에 "클라우드 동기화" 체크박스. 상태는 `doc.meta.cloudSync`(boolean)로 **문서에 저장**(.esm/클라우드 왕복 시 유지, 구버전 .esm은 미존재=false). 미로그인 시 disabled + 안내 title.
- **자동 편승**: 토글 on + 로그인 상태면, 기존 2초 디바운스 자동저장(`doSaveNow`) 성공 후 클라우드 upsert를 **비차단**으로 수행. 성공/실패는 `save-status`에 " · 클라우드 ✓"/" · 클라우드 실패" 부가(로컬 저장 성공 표시는 불변). 충돌 정책 last-write-wins(마스터 §8b 확정).
- **시작 화면 클라우드 목록**: 로그인 시 "클라우드 스토리맵" 섹션(로컬 목록 아래). 항목 클릭 → 다운로드 → **로컬 .esm로 저장 후** 일반 편집 진입(오프라인 연속성). 같은 제목 로컬 파일이 있으면 M6 `backupProject` 스냅샷 후 덮어씀.
- **v2로 연기**: 클라우드 삭제, 래스터 제외 업로드 옵션(용량), 목록 실시간 갱신(부팅·로그인 시 1회 로드), 세밀 머지.

## 3. 구성 (주입식 — AuthManager 전례)

```
src/core/CloudSync.js   createCloudSync({ client, getUser }) → { upsert(doc), list(), download(id) }
src/core/StoryDoc.js    + setCloudSync(doc, on)  (meta.cloudSync + touch)
src/editor/StartScreen.js  + renderCloud(items)·onOpenCloud 핸들러 (로그인 시 섹션)
src/main.js             배선: cloudSync 생성, doSaveNow 편승, 토글 UI, 클라우드 목록 로드
index.html              헤더에 #cloud-toggle 체크박스 + 라벨
```

- `upsert(doc)`: 미로그인 throw '로그인이 필요합니다.'(getUser로 판단, RLS는 2차 방어). payload `{user_id, title: doc.meta.title, doc: JSON.parse(serializeStoryDoc(doc)), updated_at: new Date().toISOString()}`, `onConflict: 'user_id,title'`. 래스터 base64 인코딩은 serializeStoryDoc 재사용(이중 변환은 단순성 우선 — 승인된 트레이드오프).
- `list()`: `select('id,title,updated_at').order('updated_at', {ascending:false})` — RLS가 본인 것만.
- `download(id)`: `select('doc').eq('id',id).single()` → `deserializeStoryDoc(JSON.stringify(row.doc))`로 구조 검증 재사용.
- 에러는 supabase 응답 `{error}`·reject 모두 잡아 `authErrorMessage` 재사용 한국어화.

## 4. 데이터 흐름

1. 토글 on → `setCloudSync(doc,true)` + scheduleSave → 2초 후 로컬 저장 → 클라우드 upsert(비차단).
2. 부팅/로그인 → `cloudSync.list()` → `startScreen.renderCloud(items)` (실패 시 섹션에 에러 라인, 앱 정상).
3. 클라우드 항목 클릭 → download → 같은 제목 로컬 있으면 backup → 로컬 저장 → 기존 열기 경로(enterEditor)로 진입.
4. 오프라인: 토글 상태 무관하게 로컬 저장 정상, 클라우드 부분만 "실패" 표시.

## 5. 테스트 (Vitest)

- `CloudSync.test.js`: 가짜 client(from→upsert/select 체인) — upsert payload·onConflict, 미로그인 throw, list 정렬 인자, download 구조검증 실패 시 throw, {error} 응답 한국어화.
- `StoryDoc.test.js` 추가: setCloudSync가 meta.cloudSync+updated 갱신.
- `StartScreen.test.js` 추가: 로그인+items → 섹션 렌더, 클릭 → onOpenCloud(id), 비로그인 → 섹션 없음.
- 배선(main.js)·토글 UI는 수동 스모크.
