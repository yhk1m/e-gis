# e-GIS 변경 사항 정리 (2026-03-17)

## 1. 개인정보 처리방침 전용 페이지 생성

### 개요
기존에는 로그인 후 마이페이지에서만 확인 가능했던 개인정보 처리방침을 독립된 페이지로 분리하여, 로그인 없이도 누구나 접근할 수 있도록 변경하였다.

### 변경 파일
- **`privacy.html`** (신규) — 개인정보 처리방침 전용 HTML 엔트리
- **`src/privacy-page.js`** (신규) — 전용 페이지 렌더링 및 스타일 (다크/라이트 테마 지원, 반응형)
- **`vite.config.js`** — 멀티페이지 빌드 설정 추가 (`rollupOptions.input`에 `privacy.html` 등록)
- **`vercel.json`** (신규) — `cleanUrls: true` 설정으로 `/privacy`로 접근 가능
- **`src/ui/layout/AppLayout.js`** — 헤더 `menu-right`에 "개인정보 처리방침" 링크 추가 (`target="_blank"`)
- **`src/styles/layout.css`** — `.header-privacy-link` 스타일 추가

### 접근 URL
- 프로덕션: `https://e-gis.kr/privacy`
- 개발 서버: `http://localhost:3000/privacy.html`

---

## 2. 개인정보 처리방침 조항 재정렬 및 제목 변경

### 변경 파일
- **`src/ui/panels/PrivacyPolicyPanel.js`** — `sections` 배열 순서 및 제목 수정

### 변경 내역

| 변경 전 | 변경 후 |
|---------|---------|
| 제3조 만 14세 미만 아동의 개인정보 처리에 관한 사항 | **제5조** 만 14세 미만 아동의 개인정보 보호 |
| 제4조 개인정보의 처리 및 보유기간 | **제3조** 개인정보의 처리 및 보유기간 |
| 제5조 개인정보의 파기 절차 및 방법 | **제4조** 개인정보의 파기 절차 및 방법 |
| 제8조 개인정보의 안전성 확보조치 | **제10조** 개인정보의 안전성 확보 조치 |
| 제9조 개인정보 자동 수집 장치의 설치·운영 및 거부 | **제8조** 개인정보 자동 수집 장치의 운영 및 거부 |
| 제10조 정보주체와 법정대리인의 권리·의무 및 행사방법 | **제9조** 정보주체와 법정대리인의 권리·의무 및 행사방법 |
| 제11조 개인정보 보호 책임자 | **제11조** 개인정보 보호 책임자 안내 |
| 제12조 권익침해 구제방법 | **제13조** 권익침해 구제방법 |
| 제13조 개인정보 열람청구 | **제14조** 개인정보 열람청구 |
| 제14조 개인정보 처리방침 변경 | **제12조** 개인정보 처리방침의 변경 |

---

## 3. 개인정보 처리방침 메타 정보 수정

### 변경 파일
- **`src/ui/panels/PrivacyPolicyPanel.js`**

### 변경 내역
- 버전: `1.0.0` → `1.1.0`
- 최종 수정일: `2026년 2월 7일` → `2026년 3월 17일`

---

## 4. 이메일 주소 일괄 변경

개인정보 보호책임자 이메일을 `fkv777@gmail.com` → `bgnlkim@gmail.com`으로 변경하였다.

### 변경 위치
| 파일 | 위치 |
|------|------|
| `src/ui/panels/PrivacyPolicyPanel.js` | 제11조 보호책임자 이메일 |
| `src/ui/panels/PrivacyPolicyPanel.js` | 제14조 열람청구 담당자 연락처 |
| `src/ui/panels/MyPagePanel.js` | 마이페이지 > 개인정보 관리 > 보호책임자 이메일 |
| `src/privacy-page.js` | 전용 페이지 푸터 이메일 |

---

## 5. 개인정보 처리방침 전용 페이지 UI 개선

### 변경 파일
- **`src/privacy-page.js`**

### 변경 내역
- 본문 최상단에 "개인정보 처리방침" 제목(`h1`) 추가, 색상은 소제목과 동일한 파란색(`--pp-primary`)
- 메타 정보 순서 변경: 버전 → 시행일 → 최종 수정 순서로 표시
- "e-GIS로 돌아가기" 버튼 동작 변경: 메인 페이지 이동 → 현재 탭 닫기 (`window.close()`)

---

## 6. PDF 파일 교체

### 변경 파일
- **`public/privacy-policy.pdf`** — 최신 개인정보 처리방침 PDF로 3회 교체
- 원본 경로: `C:\Users\김용현\Desktop\학습지원 소프트웨어\260316 개인정보 처리방침(e-GIS).pdf`

---

## 7. 마이페이지 개인정보 열람 모달 수정

### 변경 파일
- **`src/styles/panels.css`** — `.data-modal .data-content` 스타일 수정

### 변경 내역
- 배경이 투명했던 문제 수정: `background`, `border-radius`, `box-shadow` 추가
- 모달 너비: `width: 300px; max-width: 90vw`

---

## 8. 헤더에 커뮤니티 바로가기 버튼 추가

### 변경 파일
- **`src/ui/layout/AppLayout.js`** — 도움말(❓) 버튼 오른쪽에 "커뮤니티" 링크 추가
- **`src/styles/layout.css`** — `.btn-community` 스타일 추가

### 상세
- 사람 아이콘(SVG) + "커뮤니티" 텍스트
- 새 탭에서 `https://cafe.naver.com/egiskr` 열림

---

## 배포
- Vercel 프로덕션 배포 완료: `https://e-gis.kr`
- 개인정보 처리방침 전용 페이지: `https://e-gis.kr/privacy`
