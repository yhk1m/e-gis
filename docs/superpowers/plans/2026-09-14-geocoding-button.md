# Geocoding 안내창 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 툴바 3D 버튼 오른쪽에 `Geocoding` 버튼을 두고, 누르면 구글 시트 지오코딩 도구를 사본으로 쓰는 3단계 안내창을 연다.

**Architecture:** 새 모달 `GeocodingPanel`(순수 DOM, 기존 `.modal-overlay` 스타일 재사용)이 "사본 만들기" 링크와 "구글 시트 불러오기" 버튼을 제공한다. 불러오기는 기존 `BuiltinDataDialog`를 스프레드시트 탭으로 여는 것이라, `show(tab)` 인자만 추가한다. 백엔드·키·방침 변경 없음.

**Tech Stack:** Vanilla JS(ES 모듈), Vite, Vitest(jsdom). 설계: `docs/superpowers/specs/2026-09-14-geocoding-button-design.md`

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/ui/panels/GeocodingPanel.js` (신규) | 시트 ID 상수, `geocodingCopyUrl()`, 안내 모달 `GeocodingPanel { show, close }`, 싱글턴 `geocodingPanel` |
| `src/ui/panels/GeocodingPanel.test.js` (신규) | 위 모듈의 동작 검증 (jsdom, BuiltinDataDialog는 mock) |
| `src/ui/dialogs/BuiltinDataDialog.js` | `show(tab = 'basic')` |
| `src/ui/dialogs/BuiltinDataDialog.showTab.test.js` (신규) | `show('sheets')`가 스프레드시트 탭을 켜는지 |
| `src/ui/layout/AppLayout.js` | 툴바 3D 그룹 뒤에 Geocoding 그룹 |
| `src/main.js` | 툴바 클릭 처리 `case 'geocoding'` |
| `src/styles/main.css` | `.geocoding-content`, `.geocoding-steps` 스타일 |

주의: Write 훅이 새 js 파일 맨 위에 `// © 2026 김용현` 헤더를 넣는다. 그대로 둔다.

---

### Task 1: GeocodingPanel — 사본 주소와 3단계 렌더

**Files:**
- Create: `src/ui/panels/GeocodingPanel.js`
- Test: `src/ui/panels/GeocodingPanel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment jsdom
/**
 * Geocoding 안내창 검증.
 * 창은 링크 두 개가 전부다 — 사본 주소가 맞는지, 불러오기가 시트 탭으로 가는지,
 * 종료 경로(X·바깥 클릭·Esc)마다 창이 사라지는지 본다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../dialogs/BuiltinDataDialog.js', () => ({
  builtinDataDialog: { show: vi.fn() }
}));

import { builtinDataDialog } from '../dialogs/BuiltinDataDialog.js';
import { geocodingPanel, geocodingCopyUrl, GEOCODING_SHEET_ID } from './GeocodingPanel.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  geocodingPanel.close();
  vi.restoreAllMocks();
  builtinDataDialog.show.mockClear();
});

describe('geocodingCopyUrl', () => {
  it('시트 ID로 구글 시트 "사본 만들기" 주소를 만든다', () => {
    expect(geocodingCopyUrl()).toBe(`https://docs.google.com/spreadsheets/d/${GEOCODING_SHEET_ID}/copy`);
    expect(geocodingCopyUrl('abc')).toBe('https://docs.google.com/spreadsheets/d/abc/copy');
  });
});

describe('GeocodingPanel.show', () => {
  it('제목 Geocoding 과 3단계, 버튼 두 개를 그린다', () => {
    geocodingPanel.show();
    const modal = document.querySelector('.geocoding-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('.modal-header h3').textContent).toBe('Geocoding');
    expect(modal.querySelectorAll('.geocoding-steps > li')).toHaveLength(3);
    expect(modal.querySelector('#geocoding-copy')).not.toBeNull();
    expect(modal.querySelector('#geocoding-import')).not.toBeNull();
  });

  it('두 번 열어도 창은 하나만 남는다', () => {
    geocodingPanel.show();
    geocodingPanel.show();
    expect(document.querySelectorAll('.geocoding-modal')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/panels/GeocodingPanel.test.js`
Expected: FAIL — `Failed to resolve import "./GeocodingPanel.js"`

- [ ] **Step 3: 최소 구현**

`src/ui/panels/GeocodingPanel.js`:

```js
/**
 * GeocodingPanel - 주소 → 좌표 안내창
 *
 * 지오코딩은 e-GIS 안에서 하지 않는다. 선생님이 배포한 구글 시트 도구
 * (Apps Script GEOCODE 함수)를 학생이 각자 사본으로 쓰도록 안내만 한다.
 * Apps Script 지오코딩 한도는 스크립트 소유 계정마다 하루 1,000건이라, e-GIS가
 * 한 곳에서 대신 호출하면 반 하나로 바닥나지만 사본이면 학생 계정마다 따로 잡힌다.
 * 설계: docs/superpowers/specs/2026-09-14-geocoding-button-design.md
 */
import { builtinDataDialog } from '../dialogs/BuiltinDataDialog.js';

/** 선생님이 배포한 지오코딩 시트 (링크가 있는 모든 사용자: 뷰어) */
export const GEOCODING_SHEET_ID = '1nW24wsVc_6RKL-rBxlUb5iS24MebZaQtAj4qYdlPmgw';

/** 구글 시트의 "사본 만들기" 화면을 바로 여는 주소 */
export function geocodingCopyUrl(sheetId = GEOCODING_SHEET_ID) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/copy`;
}

const EXTERNAL_ICON = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;

class GeocodingPanel {
  constructor() {
    this.modal = null;
    this._escHandler = null;
  }

  show() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay geocoding-modal active';
    this.modal.innerHTML = `
      <div class="modal-content geocoding-content">
        <div class="modal-header">
          <h3>Geocoding</h3>
          <button class="modal-close" id="geocoding-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="geocoding-intro">주소나 장소명 목록을 위도·경도로 바꿔 지도에 올리는 순서입니다.</p>
          <ol class="geocoding-steps">
            <li>
              <div class="geocoding-step-title">지오코딩 시트 사본 만들기</div>
              <p>구글 계정으로 로그인한 뒤 "사본 만들기"를 누르면 내 드라이브에 복사됩니다.</p>
              <button type="button" class="btn btn-primary btn-sm" id="geocoding-copy">사본 만들기 ${EXTERNAL_ICON}</button>
            </li>
            <li>
              <div class="geocoding-step-title">주소 넣고 좌표 채우기</div>
              <p><code>template</code> 시트 B열에 주소나 장소명을 넣고, C열에 <code>=GEOCODE(B2)</code>를 입력하면 위도·경도가 자동으로 채워집니다. 자세한 사용법은 시트 첫 장의 설명서를 보세요.</p>
            </li>
            <li>
              <div class="geocoding-step-title">e-GIS로 가져오기</div>
              <p>완성된 시트를 "링크가 있는 모든 사용자"로 공유한 뒤 시트 주소를 붙여 넣으면 포인트 레이어가 됩니다.</p>
              <button type="button" class="btn btn-secondary btn-sm" id="geocoding-import">구글 시트 불러오기</button>
            </li>
          </ol>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  bindEvents() {
    this.modal.querySelector('#geocoding-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.modal.querySelector('#geocoding-copy').addEventListener('click', () => {
      window.open(geocodingCopyUrl(), '_blank', 'noopener');
    });

    // 불러오기 창이 이 창 위에 겹치지 않도록 먼저 닫는다
    this.modal.querySelector('#geocoding-import').addEventListener('click', () => {
      this.close();
      builtinDataDialog.show('sheets');
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const geocodingPanel = new GeocodingPanel();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/panels/GeocodingPanel.test.js`
Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
git add src/ui/panels/GeocodingPanel.js src/ui/panels/GeocodingPanel.test.js
git commit -m "feat(geocoding): 안내창 — 시트 사본 주소와 3단계 렌더"
```

---

### Task 2: GeocodingPanel — 버튼 동작과 종료 경로

**Files:**
- Modify: `src/ui/panels/GeocodingPanel.test.js` (테스트 추가)
- (구현은 Task 1 코드에 이미 들어 있다 — 이 태스크는 동작을 테스트로 고정한다)

- [ ] **Step 1: 테스트 추가** — 파일 끝에 붙인다

```js
describe('GeocodingPanel 버튼', () => {
  it('사본 만들기는 새 탭(noopener)으로 사본 주소를 연다', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-copy').click();
    expect(window.open).toHaveBeenCalledWith(geocodingCopyUrl(), '_blank', 'noopener');
    // 창은 그대로 — 학생이 2·3단계를 이어서 읽는다
    expect(document.querySelector('.geocoding-modal')).not.toBeNull();
  });

  it('구글 시트 불러오기는 창을 닫고 데이터 불러오기 창을 스프레드시트 탭으로 연다', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-import').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
    expect(builtinDataDialog.show).toHaveBeenCalledWith('sheets');
  });
});

describe('GeocodingPanel 닫기', () => {
  it('X 버튼', () => {
    geocodingPanel.show();
    document.querySelector('#geocoding-close').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
  });

  it('바깥 클릭은 닫히고, 안쪽 클릭은 안 닫힌다', () => {
    geocodingPanel.show();
    document.querySelector('.geocoding-content').click();
    expect(document.querySelector('.geocoding-modal')).not.toBeNull();
    document.querySelector('.geocoding-modal').click();
    expect(document.querySelector('.geocoding-modal')).toBeNull();
  });

  it('Esc 로 닫히고, 닫힌 뒤에는 Esc 리스너가 남지 않는다', () => {
    geocodingPanel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.geocoding-modal')).toBeNull();
    expect(geocodingPanel._escHandler).toBeNull();
  });
});
```

- [ ] **Step 2: 통과 확인**

Run: `npx vitest run src/ui/panels/GeocodingPanel.test.js`
Expected: 8 passed (실패하면 Task 1 구현의 해당 경로를 고친다)

- [ ] **Step 3: 커밋**

```bash
git add src/ui/panels/GeocodingPanel.test.js
git commit -m "test(geocoding): 버튼 동작과 종료 경로 고정"
```

---

### Task 3: BuiltinDataDialog.show(tab)

**Files:**
- Modify: `src/ui/dialogs/BuiltinDataDialog.js:54-58`
- Test: `src/ui/dialogs/BuiltinDataDialog.showTab.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment jsdom
/**
 * 데이터 불러오기 창을 특정 탭으로 여는 경로 검증.
 * Geocoding 안내창이 show('sheets')로 스프레드시트 탭을 바로 연다.
 *
 * 실습 카탈로그가 비면 #builtin-data-list 가 안 그려져 이벤트 바인딩이 죽으므로
 * (운영에서는 항상 채워져 있다) 최소 카탈로그를 흉내낸다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { builtinDataManager } from '../../core/BuiltinDataManager.js';
import { builtinDataDialog } from './BuiltinDataDialog.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(builtinDataManager, 'loadCatalogs').mockResolvedValue();
  vi.spyOn(builtinDataManager, 'getPracticeCatalog').mockReturnValue([
    { id: 'g1', name: '그룹', datasets: [{ id: 'd1', name: '데이터', description: '', type: 'csv', file: 'x.csv' }] }
  ]);
});

afterEach(() => {
  builtinDataDialog.close();
  vi.restoreAllMocks();
});

const activeTab = () => document.querySelector('.builtin-tab.active').dataset.tab;
const tabContent = (tab) => document.querySelector(`[data-tab-content="${tab}"]`);

describe('BuiltinDataDialog.show(tab)', () => {
  it('인자가 없으면 실습 데이터 탭으로 연다', async () => {
    await builtinDataDialog.show();
    expect(activeTab()).toBe('basic');
  });

  it("show('sheets')는 스프레드시트 탭을 켜고 그 내용을 보인다", async () => {
    await builtinDataDialog.show('sheets');
    expect(activeTab()).toBe('sheets');
    expect(tabContent('sheets').style.display).not.toBe('none');
    expect(tabContent('basic').style.display).toBe('none');
  });

  it('닫았다가 인자 없이 다시 열면 실습 데이터 탭으로 돌아간다', async () => {
    await builtinDataDialog.show('sheets');
    builtinDataDialog.close();
    await builtinDataDialog.show();
    expect(activeTab()).toBe('basic');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/dialogs/BuiltinDataDialog.showTab.test.js`
Expected: 1 failed — `show('sheets')` 케이스에서 `expected 'basic' to be 'sheets'`

- [ ] **Step 3: 구현**

`src/ui/dialogs/BuiltinDataDialog.js` 의 `show()`를 바꾼다:

```js
  /**
   * 창 열기
   * @param {'basic'|'public'|'sheets'} [tab='basic'] 처음 보일 탭
   *   — Geocoding 안내창이 'sheets'로 연다
   */
  async show(tab = 'basic') {
    this.close();
    await builtinDataManager.loadCatalogs();
    this._activeTab = tab;
    this._renderMain();
  }
```

(`close()`가 `_activeTab`을 'basic'으로 되돌리므로, close() 뒤에 대입해야 한다. `_renderMain()`은 끝에서 `_switchTab(this._activeTab)`을 부른다.)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/dialogs/BuiltinDataDialog.showTab.test.js`
Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
git add src/ui/dialogs/BuiltinDataDialog.js src/ui/dialogs/BuiltinDataDialog.showTab.test.js
git commit -m "feat(builtin-data): show(tab) — 열 때 탭을 고를 수 있게"
```

---

### Task 4: 툴바 버튼·디스패치·스타일·화면 확인

**Files:**
- Modify: `src/ui/layout/AppLayout.js` (3D 그룹 `data-group="view3d"` 바로 뒤, `toolbar-spacer` 앞)
- Modify: `src/main.js` (툴바 클릭 처리 `switch (tool)` — `case 'view3d'` 뒤)
- Modify: `src/styles/main.css` (`.member-delete-list` 규칙 뒤)

- [ ] **Step 1: 툴바 버튼 마크업** — `AppLayout.js`에서 `<div class="toolbar-group" data-group="view3d">…</div>` 닫는 태그 뒤, `<div class="toolbar-spacer"></div>` 앞에 추가

```html
        <div class="toolbar-group" data-group="geocoding">
          <button class="btn btn-tool-labeled" data-tool="geocoding" title="주소를 좌표로 (Geocoding)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span class="btn-tool-label">Geocoding</span>
          </button>
        </div>
```

- [ ] **Step 2: 디스패치** — `src/main.js` 툴바 클릭 처리의 `case 'view3d': … return;` 바로 뒤에 추가하고, 파일 상단 import 목록(`import { view3dPanel }…` 근처)에 import 를 넣는다

```js
import { geocodingPanel } from './ui/panels/GeocodingPanel.js';
```

```js
      case 'geocoding':
        // 도구 모드를 켜는 게 아니라 안내창을 바로 연다
        geocodingPanel.show();
        return;
```

- [ ] **Step 3: 스타일** — `src/styles/main.css` 의 `.member-delete-list { … }` 규칙 뒤에 추가

```css
/* Geocoding 안내창 */
.geocoding-modal .geocoding-content {
  width: 460px;
  max-width: 92vw;
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.geocoding-intro {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.geocoding-steps {
  margin: 0;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.geocoding-steps > li {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--text-primary);
}

.geocoding-steps > li::marker {
  font-weight: 700;
  color: var(--color-primary);
}

.geocoding-step-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.geocoding-steps p {
  margin: 0 0 6px;
  color: var(--text-secondary);
}

.geocoding-steps code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.92em;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--bg-input);
}

.geocoding-steps .btn svg {
  vertical-align: -2px;
  margin-left: 2px;
}
```

- [ ] **Step 4: 전체 테스트와 빌드**

Run: `npx vitest run`
Expected: 모두 통과 (기존 782 + 새 11)

Run: `node scripts/build.cjs`
Expected: `✓ … modules transformed`, 오류 없음. `grep -a -l "geocoding-copy" dist/assets/*.js` 가 파일 하나를 찍는다

- [ ] **Step 5: 화면 확인** — 헤드리스 Chrome 으로 안내창을 띄워 본다 (임시 하네스는 확인 뒤 지운다)

```bash
cat > _harness-geocoding.html <<'EOF'
<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>harness</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
</head><body>
<script type="module">
  import './src/styles/main.css';
  const { geocodingPanel } = await import('./src/ui/panels/GeocodingPanel.js');
  geocodingPanel.show();
</script>
</body></html>
EOF
npx vite --port 3000 --strictPort &   # 별도 셸/백그라운드
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-first-run \
  --user-data-dir="$(cygpath -w "$TMP/chrome-geocoding")" --window-size=900,700 --virtual-time-budget=8000 \
  --screenshot="$(cygpath -w "$TMP/geocoding-modal.png")" "http://localhost:3000/_harness-geocoding.html"
rm _harness-geocoding.html
```

확인할 것: 제목 `Geocoding`, 번호 1·2·3, 파란 "사본 만들기" 버튼과 회색 "구글 시트 불러오기" 버튼, 글줄이 창 밖으로 넘치지 않음. 툴바 버튼은 `http://localhost:3000/` 스크린샷에서 3D 오른쪽에 핀 아이콘 + `Geocoding` 라벨이 보이면 된다.

- [ ] **Step 6: 커밋**

```bash
git add src/ui/layout/AppLayout.js src/main.js src/styles/main.css
git commit -m "feat(geocoding): 툴바 3D 오른쪽에 Geocoding 버튼 — 시트 사본 안내창 연결"
```

---

## 자체 점검

- 스펙 커버리지: 툴바 버튼(Task 4) · 안내창 3단계와 두 버튼(Task 1·2) · `show(tab)`(Task 3) · 닫기 3경로(Task 2) · `noopener`(Task 2) · 스타일(Task 4) · 백엔드/방침 무변경(해당 태스크 없음, 의도) — 빠진 항목 없음.
- 이름 일치: `geocodingPanel.show()/close()`, `geocodingCopyUrl()`, `GEOCODING_SHEET_ID`, `builtinDataDialog.show('sheets')`, DOM id `geocoding-copy`/`geocoding-import`/`geocoding-close`, 클래스 `geocoding-modal`/`geocoding-content`/`geocoding-steps` — 태스크 간 동일.
