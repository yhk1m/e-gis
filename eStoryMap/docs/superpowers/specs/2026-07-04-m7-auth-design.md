# M7 로그인 (AuthManager) 설계 — 2026-07-04

> **상태: 확정 (2026-07-04 사용자 승인).** 아래 2건 모두 승인됨: ① M7 범위를 로그인만으로 축소 ② 회원가입은 e-GIS 웹 안내로 대체. (같은 날 M6 스모크 통과 확인.)

## 0. 승인된 결정 (구 "확인 필요")

1. **범위 축소 가정**: 마스터 스펙 M7의 "CloudSync — e-GIS `projects` 목록에서 .egis 직접 로드"를 **폐기**한다.
   근거: e-GIS 본체에서 클라우드 프로젝트 저장 기능이 제거됨(커밋 `ece5de2` "Restore login functionality without cloud storage", CloudPanel 주석 "클라우드 저장 기능 제거됨"). `SupabaseManager.saveProject/listProjects`는 호출부가 없는 데드코드다. 채워지지 않는 테이블을 읽는 UI를 만드는 것은 낭비(YAGNI). 클라우드 기능은 M8에서 `e-gistory` 전용 테이블로 구현한다(테이블명 2026-07-04 사용자 지시로 storymaps에서 개명).
   (참고: 살리더라도 클라우드 직렬화 `{mapState, layers}`는 `.egis` 파일 포맷 `{view, displayCRS, layers}`와 달라 어댑터가 필요했음.)
2. **회원가입 미지원 가정**: 앱에서는 **로그인만** 지원하고, 가입은 e-GIS 웹(`e-gis.kr`)으로 안내한다.
   근거: e-GIS 가입은 개인정보 동의 플로우(`ConsentManager`, `signUpWithConsent`)와 결합돼 있다. 이를 Electron에서 중복 구현하면 법적 고지문 유지보수 지점이 두 곳이 된다.

## 1. 목표

- e-GIS와 **같은 Supabase 프로젝트** 계정으로 이메일/비밀번호 로그인.
- 시작 화면에서 로그인 상태 표시·전환(§8.4 "오프라인/온라인 시작 화면 분기" 해소).
- **오프라인 퍼스트 유지**: 로그인 없이 모든 로컬 기능 동작. 로그인은 M8 클라우드 동기화의 전제일 뿐.
- 세션 유지: 앱 재시작 시 자동 로그인(supabase-js localStorage 세션).

비목표(M7에서 안 함): 회원가입, Google OAuth(e-GIS에도 UI 없음 — 데드코드), 비밀번호 재설정, 클라우드 저장/불러오기(M8), 에디터 내 계정 UI(M8에서 클라우드 토글과 함께).

## 2. 검토한 접근법

| | 접근 | 판정 |
|---|---|---|
| ① | **npm 번들 supabase-js + 주입식 AuthManager** | **채택** |
| ② | CDN 동적 `<script>` 로드 (e-GIS 방식 그대로 이식) | 기각 — 오프라인 시작 시 로그인 UI 자체가 죽음, sandbox 렌더러에 외부 스크립트 주입은 보안·CSP상 나쁨, 테스트 불가 |
| ③ | main 프로세스 인증 + IPC 브리지 | 기각 — 과설계. supabase-js는 브라우저 우선 설계이고 anon key는 공개 전제, 보안 경계는 RLS. IPC 배관 비용만 큼 |

⚠️ ①의 리스크: 렌더러 dev 사전번들이 supabase-js의 Node 지향 의존을 물면 M2의 geotiff 사고(렌더러 전체 사망) 재연 가능. supabase-js v2는 브라우저 필드가 정리된 isomorphic 패키지라 문제없을 것으로 예상하지만, **배선 직후 dev 모드 스모크를 1순위로 확인**한다. (vite-plugin-electron의 `renderer` 플러그인은 계속 금지.)

## 3. 아키텍처

```
src/core/supabaseClient.js   // createClient(URL, ANON_KEY) 생성만. 상수 하드코딩(e-GIS와 동일 프로젝트/키)
src/core/AuthManager.js      // 얇은 래퍼(접착): createAuthManager({ client })
src/editor/StartScreen.js    // 확장: 하단 auth 섹션 (로그인 폼 ↔ 상태 표시)
src/main.js                  // 배선: authManager 생성·init, StartScreen에 auth 핸들러 전달
```

### AuthManager (주입식 — e-GIS 싱글턴 답습 안 함, DemRenderer 탈싱글턴 전례)

```js
createAuthManager({ client }) → {
  init(),                    // getSession()으로 세션 복원 + onAuthStateChange 구독. 실패해도 throw 안 함(오프라인)
  signIn(email, password),   // 성공 시 user 반환, 실패 시 Error throw(메시지 한국어화)
  signOut(),
  getUser(),                 // user 객체 | null
  isLoggedIn(),
  onChange(cb),              // cb({ user }) — 로그인/로그아웃/세션복원 모두. 구독 해제 함수 반환
}
```

- 이식 원본: e-GIS `SupabaseManager`의 init/signIn/signOut/onAuthStateChange 계약. 프로필/통계/프로젝트 메서드는 이식하지 않는다.
- 에러 한국어화는 AuthManager 내 순수 함수 `authErrorMessage(error)`로 분리(단위 테스트 대상): `invalid_credentials`→"이메일 또는 비밀번호가 올바르지 않습니다", `fetch failed`류→"네트워크에 연결할 수 없습니다(오프라인)", 그 외→원문.

### StartScreen 확장

- 시그니처: `createStartScreen(container, { onCreate, onOpen, auth })` — `auth = { signIn, signOut, openSignup }` 핸들러 주입 (`openSignup`은 main.js에서 `egisFS.openExternal('https://e-gis.kr')`로 배선). 렌더 상태는 `updateAuth({ user })`로 외부에서 밀어넣는다(기존 `render(projectNames)`와 동일한 단방향 패턴).
- 하단 auth 섹션 3상태:
  - **로그아웃**: 이메일·비밀번호 입력 + "로그인" 버튼 + "계정이 없나요? e-GIS에서 가입" 외부 링크. Enter 제출(기존 IME 가드 패턴 재사용).
  - **로그인**: "○○@○○ 님" + "로그아웃" 버튼.
  - **에러/오프라인**: auth 섹션 내 전용 에러 라인(기존 `start-error`와 별도 — 목록 에러와 섞이지 않게).
- 로그인해도 시작 화면 흐름은 그대로(새로 만들기/열기). M7의 로그인은 상태 확보까지만.

### main.js 배선

- `boot()`에서 `.esm` 목록 로드와 **병렬로** `authManager.init()` — 인증 실패/오프라인이 부팅을 늦추거나 막지 않는다.
- `authManager.onChange(state => startScreen.updateAuth(state))`.
- 외부 링크는 `window.open` 대신 `shell.openExternal` 필요 → preload에 `egisFS.openExternal(url)` 1개 추가(main에서 `shell.openExternal`, http/https만 화이트리스트).

## 4. 데이터 흐름

1. 부팅 → `init()` → localStorage 세션 있으면 복원 → `onChange` → 시작 화면에 이메일 표시.
2. 로그인 폼 제출 → `signIn` → 성공: supabase-js가 세션 저장, `onChange` 발화 / 실패: `authErrorMessage` 결과를 auth 에러 라인에 표시.
3. 로그아웃 → `signOut` → 세션 삭제, `onChange` → 폼 상태로 복귀.
4. 오프라인 부팅 → `createClient`/`getSession`은 로컬 동작이라 정상, 만료 세션 갱신 실패 시에도 앱은 로컬 모드로 정상. 로그인 시도 시에만 네트워크 에러 표시.

## 5. 테스트 전략 (Vitest, 기존 관례)

- `AuthManager.test.js`: 가짜 supabase 클라이언트 주입 — 세션 복원, signIn 성공/실패, signOut, onChange 발화·구독해제, init 실패 무해성(throw 안 함), `authErrorMessage` 매핑.
- `StartScreen.test.js` 확장: 3상태 렌더, 폼 제출 → auth.signIn 호출 인자, 에러 표시, IME 가드, 가입 링크 클릭 → `auth.openSignup` 호출.
- main 배선·실번들(supabase-js dev 사전번들 포함)은 수동 스모크로 확인.

## 6. 마스터 스펙 반영 사항 (승인 시)

- `eStoryMap-PLAN.md` M7 항목에서 CloudSync/projects 로드 제거, M8을 "e-gistory 테이블 저장/불러오기 + 시작 화면 클라우드 목록"으로 확장.
- §5(스토리맵 스키마) 주변의 projects 연동 서술 정리, §8.4 해소 기록.
