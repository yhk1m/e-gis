# M8 클라우드 동기화 실행계획 (압축판)

> 스펙: `../specs/2026-07-04-m8-cloudsync-design.md` (확정). 사용자 토큰 절약 지시(2026-07-04)로 서브에이전트 없이 **컨트롤러 인라인 TDD**로 실행 — 태스크별 상세 코드는 스펙 §3이 대신한다. 테이블 `e-gistory`는 Supabase에 생성 확인됨(REST 200).

- [ ] T1 `StoryDoc.setCloudSync(doc, on)` — meta.cloudSync + touch. 테스트 1.
- [ ] T2 `src/core/CloudSync.js` `createCloudSync({client, getUser})` → upsert/list/download. 가짜 client 체인 테스트 ~6 (payload·onConflict·미로그인 throw·{error} 한국어화·reject 한국어화·download 구조검증).
- [ ] T3 StartScreen 클라우드 섹션 — `renderCloud(items|null)`(null=숨김) + `onOpenCloud(id)` 핸들러 + CSS. 테스트 ~4.
- [ ] T4 배선 — index.html `#cloud-toggle`(save-status 앞), main.js: 공유 supabase client(⚠️authManager와 동일 인스턴스 필수 — 세션 공유), doSaveNow 클라우드 편승(saveSeq 토큰으로 늦은 콜백의 상태표시 덮어쓰기 방지), refreshCloudList(onChange+boot), onOpenCloud(다운로드→로컬충돌시 backup→로컬저장→enterEditor), updateCloudToggle(enterEditor·onChange에서).
- [ ] T5 `npm test`(196± 예상) + `npx vite build` + dev 재기동 → 수동 스모크(토글 upsert 확인은 Supabase Table Editor에서) → push.
