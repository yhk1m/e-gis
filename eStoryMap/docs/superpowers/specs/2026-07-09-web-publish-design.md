# 스토리맵 웹 게시(공유 링크) — 설계

2026-07-09 승인. 목적: 데스크톱(e-GIS)에서 만든 스토리맵을 `https://e-gis.kr/{handle}/{seq}` 링크로 누구나 볼 수 있게 게시한다.

## 결정 요약

- **URL**: `e-gis.kr/{handle}/{seq}`. handle은 이메일에서 자동 파생 — 앞부분 + 도메인 첫 단어, 소문자, 영숫자만 (`fkv777@gmail.com` → `fkv777gmail`, `john.doe@naver.com` → `johndoenaver`). 영숫자 제거 후 비면 `u` + user_id 앞 8자로 대체. seq는 사용자별 게시 번호(첫 게시 때 max+1, 불변, 결번 재사용 안 함).
- **뷰어 경험**: 발표 모드 그대로 (실제 지도 + 레이아웃 밴드/패널/카드 + 이전/다음 + 카메라 애니메이션 + 범례 + 슬라이드 글꼴).
- **게시 모델**: 명시적 게시/재게시(스냅샷). 수정해도 재게시 전까지 게시본 불변. 게시 취소 가능.
- **배포**: 뷰어는 eStoryMap의 두 번째 Vite 빌드 → 산출물을 `eGIS/public/story/`에 복사 → 기존 Vercel 배포에 편승. GitHub Pages 불가(rewrite 미지원, 도메인이 Vercel).

## 데이터 모델 (Supabase)

새 테이블 `published_storymaps` — SQL 파일 `supabase-published-storymaps.sql`(eGIS 루트, page_views SQL과 같은 방식으로 SQL Editor에서 1회 실행):

| 칼럼 | 내용 |
|---|---|
| `id` uuid PK | 행 식별자 |
| `user_id` uuid | 소유자 (auth.users) |
| `handle` text | 이메일 파생 공개 아이디 |
| `seq` int | 사용자별 게시 번호 |
| `title` text | 제목 |
| `doc` jsonb | 게시 시점 스냅샷 (`serializeStoryDoc` 재사용) |
| `published_at` / `updated_at` | 최초 게시 / 마지막 재게시 |

- 유니크: `(handle, seq)` — 뷰어 조회 키. `(user_id, seq)`도 유니크.
- RLS: SELECT는 anon 포함 전체 허용, INSERT/UPDATE/DELETE는 `auth.uid() = user_id`.
- 문서 쪽: 게시 성공 시 `doc.meta.publish = { id, handle, seq }` 저장(.esm·클라우드에 함께 영속). 게시 취소 시 제거.
- 게시는 클라우드 동기화 토글과 독립(동기화=비공개 백업, 게시=공개 스냅샷).

## 데스크톱: 게시 UX

- 툴바 `🌐 게시` 버튼. 미로그인 → 안내만. 첫 게시 → 확인("누구나 볼 수 있는 링크로 게시") → 성공 대화상자(링크 + [복사] + [브라우저에서 열기]). 게시됨 → 대화상자(링크 + [재게시] [링크 복사] [게시 취소]).
- `src/core/Publisher.js` — CloudSync 패턴의 주입식. `deriveHandle(email)`(순수), `publish(doc)`, `unpublish(doc)`, `publicUrl(meta.publish)`.
- `src/editor/publishDialog.js` — confirmDialog 스타일 UI.
- 게시/취소 후 `scheduleSave()`.

## 웹 뷰어

- `viewer.html` + `src/webviewer/main.js`, 별도 `vite.viewer.config.js`(Electron 플러그인 없음, `base: '/story/'`, 산출물 `dist-viewer/`).
- 부팅: pathname 파싱(`/{handle}/{seq}`, seq 숫자만) → Supabase anon 조회 → `deserializeStoryDoc` → MapView + SourceRegistry 구성 → 발표 모드 1페이지부터.
- 재사용: MapView, SourceRegistry, StoryMapRenderer, PresentationShell(+`standalone` 옵션: 종료 버튼/Esc 숨김, 자체 지도), CameraAnimator, mediaEmbed, markdown, color, 범례, Noto 글꼴 번들.
- 화면: 로딩 → 발표. 하단에 작게 "e-GIS로 제작" 링크. 문서 없음 → "스토리맵을 찾을 수 없습니다"(+홈 링크). 네트워크 실패 → 재시도 버튼.
- CSP meta: 데스크톱과 동일 취지(img https:/data:/blob:, YouTube frame, Supabase connect).
- 빌드·배치: `npm run build:viewer` = 뷰어 빌드 + `eGIS/public/story/`로 복사(index.html로 개명 포함, 스크립트 자동화). 산출물은 eGIS 레포에 커밋 → 기존 `npx vercel deploy --prod`에 실림. `.vercelignore` 변경 없음.

## 라우팅 (Vercel)

`eGIS/vercel.json`:

```json
{
  "cleanUrls": true,
  "rewrites": [{ "source": "/:handle/:seq(\\d+)", "destination": "/story" }]
}
```

⚠️ 목적지는 `/story`(클린 URL)여야 한다 — `cleanUrls: true`가 `.html`로 끝나는 rewrite 목적지를 404로 만든다(2026-07-09 배포에서 확인).

실제 파일이 우선이므로 기존 사이트 경로 영향 없음. 스토리맵 수가 늘어도 Vercel 파일은 불변(문서는 Supabase 행) — 한계는 Supabase 용량이며, 필요 시 게시 용량 경고·Storage 이전으로 대응(현 설계 범위 밖).

## 오류 처리

- seq 경합(두 기기 동시 첫 게시): unique 위반 시 번호 재취득 후 1회 재시도.
- 다른 기기에서 취소된 문서 재게시: UPDATE 0행이면 저장된 seq로 INSERT(링크 유지).
- 문서 >10MB: 게시 전 경고(차단 안 함).
- 게시 오류 메시지는 `authErrorMessage` 한국어화 재사용.

## 테스트

- `Publisher.test.js`: deriveHandle 규칙, 첫 게시(번호·meta), 재게시(같은 행), 취소, 미로그인, 경합 재시도, publicUrl.
- 뷰어: 주소 파싱 순수 함수(비정상 거부), 가짜 fetcher로 로딩/성공/404 전환.
- 수동: 로컬 preview 렌더 확인 → 배포 후 실링크 확인.

## 작업 순서

1. Supabase SQL 실행(테이블+RLS)
2. eStoryMap 구현(Publisher·게시 UI·뷰어) → 데스크톱 v0.2.0 릴리스(자동 릴리스 규칙)
3. 뷰어 산출물 배치 + vercel.json rewrite → Vercel 배포
