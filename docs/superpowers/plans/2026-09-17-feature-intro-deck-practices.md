# e-GIS 기능 소개 덱 — 따라하기 실습 추가 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 46장짜리 `바탕화면\e-GIS 기능 소개\e-GIS_기능소개.html`에 실습 개요 1장 + 실습 8개 × 2장을 맨 뒤 「09 따라하기 실습」 섹션으로 붙여 63장으로 만들고, 실습 ② 재료(2호선 역 · 승하차)를 e-GIS 내장 데이터에 추가해 배포한다.

**Architecture:** 덱은 단일 HTML(CSS · JS 인라인)이고 슬라이드는 `<section class="slide">` 순서가 곧 쪽 번호다. 기존 4~45쪽은 손대지 않고 45쪽(e-GIStory) 뒤 · 마무리 앞에 17장을 끼운다. 새 CSS는 `.data` `.steps` `.ref` `.compare` `table.grid.overview` 다섯 개. 캡처 9장은 e-GIS dev 서버(포트 3000)를 Chrome으로 찍는다. 앱 쪽은 `public/data/builtin/`에 파일 2개 + `practice_catalog.json` 항목 2개.

**Tech Stack:** HTML/CSS(Pretendard), Node(check.js), Python 3(sqlite3 · csv · json 표준 라이브러리 — gpkg 변환), vitest(카탈로그 테스트), Chrome(MCP 캡처 · 헤드리스 인쇄).

**스펙:** `docs/superpowers/specs/2026-09-17-feature-intro-deck-practices-design.md`

**경로 약어:** `DECK` = `C:\Users\김용현\Desktop\e-GIS 기능 소개`, `EGIS` = `C:\Users\김용현\Desktop\vibecoding\eGIS`, `SCRATCH` = 세션 스크래치 디렉터리.

**주의 사항(메모리에서):** Write 훅이 새 파일 머리에 `© 2026 김용현` 주석을 넣는다 — 지우지 말 것. 이 PC 한글 경로에서 Node의 재귀 fs(cpSync/rmSync recursive)가 크래시하니 파일 복사는 Bash `cp`로. 슬라이드 문구는 명사형 · 키워드 중심, 이모지 금지, 카드 · 글래스 스타일 금지.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `EGIS\public\data\builtin\practice\Point Data\서울_지하철_2호선_역.geojson` | 새로 만듦. 2호선 역 51개 Point(EPSG:4326), 속성 `sub_nm` |
| `EGIS\public\data\builtin\practice\Attribute Data\서울_지하철_2호선_8-9시_승하차.csv` | 새로 만듦. UTF-8 BOM, 열 `stn_nm,boarding,getting off` |
| `EGIS\public\data\builtin\practice_catalog.json` | Point Data · Attribute Data에 항목 1개씩 추가 |
| `EGIS\src\core\practiceCatalog.test.js` | 새로 만듦. 카탈로그의 모든 파일이 실제로 존재하고 2호선 항목이 있는지 |
| `DECK\실습자료\` | 새 폴더. 실습 ⑤ 배포 파일 4개 |
| `DECK\check.js` | 63장 · 49장 · `.ref` 범위 검사로 갱신 |
| `DECK\e-GIS_기능소개.html` | CSS 추가, 목차 · 7쪽 수정, 46~62쪽 삽입 |
| `DECK\images\48-p1-… 62-p8-….png` | 새 캡처 9장 |
| `SCRATCH\convert_line2.py` | gpkg · CSV 변환 스크립트(일회성) |
| `SCRATCH\geocode_for_capture.py` | 캡처용 광주 매장 좌표(배포 안 함) |

---

### Task 1: e-GIS 내장 데이터 — 2호선 역 · 승하차 추가

**Files:**
- Create: `EGIS\src\core\practiceCatalog.test.js`
- Create: `EGIS\public\data\builtin\practice\Point Data\서울_지하철_2호선_역.geojson`
- Create: `EGIS\public\data\builtin\practice\Attribute Data\서울_지하철_2호선_8-9시_승하차.csv`
- Modify: `EGIS\public\data\builtin\practice_catalog.json`

- [ ] **Step 1: 실패하는 테스트 작성**

`EGIS\src\core\practiceCatalog.test.js`:

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve(__dirname, '../../public/data/builtin');
const catalog = JSON.parse(fs.readFileSync(path.join(base, 'practice_catalog.json'), 'utf8'));
const datasets = catalog.flatMap((g) => (g.datasets || []).map((d) => ({ ...d, group: g.id })));

describe('practice_catalog.json', () => {
  it('등록된 파일이 모두 public/data/builtin 아래에 있다', () => {
    const missing = datasets.filter((d) => !fs.existsSync(path.join(base, d.file))).map((d) => d.file);
    expect(missing).toEqual([]);
  });

  it('2호선 역(점, spatial)과 8~9시 승하차(속성)가 등록돼 있다', () => {
    const stations = datasets.find((d) => d.id === 'seoul-subway-line2');
    const rush = datasets.find((d) => d.id === 'seoul-subway-line2-rush');
    expect(stations).toMatchObject({ group: 'point-data', type: 'spatial' });
    expect(stations.file).toMatch(/\.geojson$/);
    expect(rush).toMatchObject({ group: 'attribute-data', type: 'attribute' });
    expect(rush.file).toMatch(/\.csv$/);
  });

  it('2호선 역 GeoJSON은 EPSG:4326 Point 51개이고 sub_nm을 가진다', () => {
    const d = datasets.find((x) => x.id === 'seoul-subway-line2');
    const gj = JSON.parse(fs.readFileSync(path.join(base, d.file), 'utf8'));
    expect(gj.features).toHaveLength(51);
    for (const f of gj.features) {
      expect(f.geometry.type).toBe('Point');
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThan(126.7); expect(lon).toBeLessThan(127.3);
      expect(lat).toBeGreaterThan(37.4); expect(lat).toBeLessThan(37.7);
      expect(typeof f.properties.sub_nm).toBe('string');
    }
  });

  it('승하차 CSV는 UTF-8 BOM이고 49행 · 열 stn_nm,boarding,getting off', () => {
    const d = datasets.find((x) => x.id === 'seoul-subway-line2-rush');
    const buf = fs.readFileSync(path.join(base, d.file));
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = buf.toString('utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    expect(lines[0]).toBe('stn_nm,boarding,getting off');
    expect(lines).toHaveLength(50);
    expect(lines[1]).toBe('강남,2766,13890');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run (EGIS에서): `npx vitest run src/core/practiceCatalog.test.js`
Expected: FAIL — `2호선 역…등록돼 있다`에서 `stations`가 undefined (나머지 두 개도 그로 인해 실패), `등록된 파일이 모두…`는 PASS.

- [ ] **Step 3: 변환 스크립트 작성 · 실행**

`SCRATCH\convert_line2.py`:

```python
# gpkg(MultiPoint, EPSG:3857) -> GeoJSON(Point, EPSG:4326), CSV(cp949) -> UTF-8 BOM
import sqlite3, struct, json, math, csv, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DECK = r"C:\Users\김용현\Desktop\e-GIS 기능 소개"
OUT = r"C:\Users\김용현\Desktop\vibecoding\eGIS\public\data\builtin\practice"

def merc_to_lonlat(x, y):
    R = 6378137.0
    lon = x / R * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / R)) - math.pi / 2) * 180 / math.pi
    return round(lon, 6), round(lat, 6)

def gpkg_point(blob):
    # GeoPackage binary: magic(2) version(1) flags(1) srs_id(4) envelope(0/32/48/48/64) + WKB
    flags = blob[3]
    env = (flags >> 1) & 7
    hdr = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    wkb = blob[hdr:]
    little = wkb[0] == 1
    fmt = '<' if little else '>'
    gtype = struct.unpack(fmt + 'I', wkb[1:5])[0]
    if gtype == 1:  # Point
        x, y = struct.unpack(fmt + 'dd', wkb[5:21])
    elif gtype == 4:  # MultiPoint -> 첫 점
        n = struct.unpack(fmt + 'I', wkb[5:9])[0]
        assert n >= 1
        x, y = struct.unpack(fmt + 'dd', wkb[14:30])  # 9 + point header(5)
    else:
        raise ValueError(f'unexpected wkb type {gtype}')
    return x, y

con = sqlite3.connect(DECK + r"\seoul_subway_line2.gpkg")
rows = con.execute("select sub_nm, geom from seoul_subway_line2 order by fid").fetchall()
features = []
for name, blob in rows:
    x, y = gpkg_point(blob)
    lon, lat = merc_to_lonlat(x, y)
    features.append({"type": "Feature", "properties": {"sub_nm": name},
                     "geometry": {"type": "Point", "coordinates": [lon, lat]}})
gj = {"type": "FeatureCollection", "name": "서울 지하철 2호선 역", "features": features}
with open(OUT + r"\Point Data\서울_지하철_2호선_역.geojson", "w", encoding="utf-8") as f:
    json.dump(gj, f, ensure_ascii=False, separators=(',', ':'))
print('geojson', len(features), features[0])

with open(DECK + r"\서울 지하철 2호선 8-9시 승하차 현황.csv", encoding="cp949", newline="") as f:
    data = list(csv.reader(f))
with open(OUT + r"\Attribute Data\서울_지하철_2호선_8-9시_승하차.csv", "w", encoding="utf-8-sig", newline="") as f:
    csv.writer(f, lineterminator="\n").writerows(data)
print('csv rows', len(data) - 1, data[0], data[1])
```

Run: `python "SCRATCH\convert_line2.py"`
Expected: `geojson 51 {... 'sub_nm': '홍대입구' ... [126.92xx, 37.55xx]}` 와 `csv rows 49 ['stn_nm','boarding','getting off'] ['강남','2766','13890']`.

- [ ] **Step 4: 카탈로그에 항목 추가**

`EGIS\public\data\builtin\practice_catalog.json` — `point-data` 그룹 `datasets` 배열 끝(`korea-mcdonalds` 뒤)에:

```json
{
  "id": "seoul-subway-line2",
  "name": "서울 지하철 2호선 역",
  "description": "2호선 역 51개 지점(지선 포함) — 역명(sub_nm). '2호선 8~9시 승하차'와 결합해 도형표현도로",
  "type": "spatial",
  "file": "practice/Point Data/서울_지하철_2호선_역.geojson"
}
```

`attribute-data` 그룹 `datasets` 배열 끝(`korea-sido-grdp-20260701` 뒤)에:

```json
{
  "id": "seoul-subway-line2-rush",
  "name": "2호선 8~9시 승하차",
  "description": "역별 8~9시 승차 · 하차 인원(49역) — '서울 지하철 2호선 역'과 결합 (sub_nm ↔ stn_nm)",
  "type": "attribute",
  "file": "practice/Attribute Data/서울_지하철_2호선_8-9시_승하차.csv"
}
```

기존 항목들의 필드 순서 · 들여쓰기(2칸)를 그대로 따른다. 기존 항목에 `latColumn`/`lonColumn`/`source` 같은 부가 필드가 있으면 그 이름을 맞춰 쓰되, spatial · attribute 항목에는 필요 없다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/core/practiceCatalog.test.js`
Expected: 4 passed.

- [ ] **Step 6: dev 서버에서 눈으로 확인**

Run (EGIS, 백그라운드): `npm run dev` → http://localhost:3000. 메뉴 바 → 데이터 불러오기 → 점 데이터 탭에 「서울 지하철 2호선 역」이 보이고 클릭하면 레이어가 바로 추가되는지, 속성 데이터 탭에 「2호선 8~9시 승하차」가 있고 「레이어에 결합」에서 키 `sub_nm` ↔ `stn_nm`을 골라 결합되는지 확인. 결합 후 속성 테이블에 `boarding` · `getting off`가 49행에 채워지고 까치산 · 양천구청은 빈칸이면 정상.

- [ ] **Step 7: 커밋**

```bash
cd "/c/Users/김용현/Desktop/vibecoding/eGIS"
git add "public/data/builtin/practice/Point Data/서울_지하철_2호선_역.geojson" "public/data/builtin/practice/Attribute Data/서울_지하철_2호선_8-9시_승하차.csv" public/data/builtin/practice_catalog.json src/core/practiceCatalog.test.js
git commit -m "feat(builtin): 서울 지하철 2호선 역(점) · 8~9시 승하차(속성) 실습 데이터 추가

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 실습자료 폴더 · check.js 갱신

**Files:**
- Create: `DECK\실습자료\` (파일 4개 복사)
- Modify: `DECK\check.js`

- [ ] **Step 1: 실습자료 폴더 만들고 복사**

```bash
D="/c/Users/김용현/Desktop/e-GIS 기능 소개/실습자료"
A="/c/Users/김용현/.aside/u/0/sessions/2026-09-17_J2yHx9UGUBBZ24mQ/artifacts"
B="/c/Users/김용현/Desktop/e-GIS 실습 (빛길지리)/260603 빛길지리 연수 실습자료/(2) 벡터 데이터 분석/실습3. 샐러디(Salady)의 입점 전략"
mkdir -p "$D"
cp "$A/옛_광주광역시_써브웨이_매장.xlsx" "$D/광주_써브웨이_매장.xlsx"
cp "$A/옛_광주광역시_샐러디_매장.xlsx"  "$D/광주_샐러디_매장.xlsx"
cp "$B/서울 써브웨이 매장 주소.csv" "$D/서울_써브웨이_매장.csv"
cp "$B/서울 샐러디 매장 주소.csv"  "$D/서울_샐러디_매장.csv"
ls -la "$D"
```

Expected: 파일 4개 (xlsx 약 8KB 둘, csv 약 17KB 둘).

- [ ] **Step 2: check.js를 63장 · .ref 검사로 갱신**

`DECK\check.js` 전체를 다음으로 교체:

```js
// © 2026 김용현
// 덱의 <img src>가 images/ 파일과 1:1인지, 이모지가 없는지, 슬라이드가 63장인지,
// 실습 슬라이드의 참고 쪽수(.ref)가 4~45쪽 기능 슬라이드를 가리키는지 확인한다.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'e-GIS_기능소개.html'), 'utf8');
const refs = [...html.matchAll(/src="images\/([^"]+)"/g)].map(m => m[1]);
const files = fs.readdirSync(path.join(dir, 'images')).filter(f => f.endsWith('.png'));
const missing = refs.filter(r => !files.includes(r));
const unused = files.filter(f => !refs.includes(f));
const slides = (html.match(/<section class="slide/g) || []).length;
const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
// 참고 쪽수: class="ref" data-goto="N" → 4~45, 그리고 N쪽 슬라이드의 h2를 함께 출력
const sections = html.split('<section class="slide');
const h2Of = (n) => ((sections[n] || '').match(/<h2>([^<]*)<\/h2>/) || [])[1] || '';
const refPages = [...html.matchAll(/class="ref" data-goto="(\d+)"/g)].map(m => parseInt(m[1], 10));
const badRefs = refPages.filter(n => n < 4 || n > 45);
const refSummary = [...new Set(refPages)].sort((a, b) => a - b).map(n => n + ':' + h2Of(n)).join(' | ');
console.log('slides:', slides, '| img refs:', refs.length, '| files:', files.length);
console.log('missing:', missing, '| unused:', unused, '| emoji:', emoji);
console.log('refs:', refPages.length, '| bad:', badRefs);
console.log(refSummary);
process.exit(missing.length || unused.length || emoji.length || badRefs.length || slides !== 63 ? 1 : 0);
```

- [ ] **Step 3: 지금은 실패하는지 확인**

Run: `node "DECK\check.js"`
Expected: `slides: 46 …` 출력 후 exit 1 (아직 46장). `refs: 0`.

- [ ] **Step 4: 커밋 없음** — DECK은 git 저장소가 아니다. 다음 Task로.

---

### Task 3: 덱 CSS 추가 · 목차 09 행 · 7쪽 문구

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — `<style>` 블록(`/* 하단 네비 */` 앞), 목차 슬라이드(3쪽), 내장 데이터 슬라이드(7쪽)

- [ ] **Step 1: CSS 추가**

`/* 하단 네비 */` 주석 바로 앞에 삽입:

```css
  /* 따라하기 실습 — 개요 표 */
  table.grid.overview { font-size: 21px; margin-top: 6px; }
  table.grid.overview th { font-size: 17px; padding: 10px 14px; }
  table.grid.overview td { padding: 12px 14px; }
  table.grid.overview td:first-child { color: var(--blue); font-size: 24px; }
  table.grid.overview td:last-child { white-space: nowrap; }

  /* 따라하기 실습 — 단계 슬라이드(목차와 같은 편집형) */
  .data { display: flex; align-items: baseline; gap: 14px; font-size: 20px; color: var(--ink-2); line-height: 1.45; margin: -4px 0 18px; }
  .data b { color: var(--blue); font-weight: 700; flex-shrink: 0; letter-spacing: 0.04em; }
  .steps { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); grid-auto-flow: column; column-gap: 72px; }
  .steps .step { display: grid; grid-template-columns: 76px 1fr; align-items: center; column-gap: 8px; padding: 0 4px; border-bottom: 1px solid var(--line-soft); }
  .steps .step:nth-child(3n), .steps .step:last-child { border-bottom: 0; }
  .steps .n { font-size: 46px; font-weight: 800; color: var(--blue); letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .steps .t { font-size: 27px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; margin-bottom: 6px; }
  .steps .d { font-size: 19px; color: var(--gray); line-height: 1.45; }
  .ref { color: var(--blue); font-weight: 700; font-size: 0.88em; white-space: nowrap; cursor: pointer; margin-left: 8px; text-decoration: none; }
  .ref:hover { text-decoration: underline; }

  /* 따라하기 실습 — 결과 비교(캡처 2장 위 · 두 열 설명 아래) */
  .compare { flex: 1; min-height: 0; display: grid; grid-template-rows: auto 1fr; gap: 20px; }
  .compare .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .compare figure { margin: 0; }
  .compare figure img { width: 100%; border: 1px solid var(--line-soft); border-radius: 10px; box-shadow: 0 14px 40px rgba(0,0,0,0.16); display: block; }
  .compare figcaption { font-size: 17px; font-weight: 700; color: var(--blue); margin: 8px 0 0; }
  .compare .cols2 { gap: 44px; }
  .compare h3 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: var(--blue); }
  .compare ul.points { font-size: 20px; margin-bottom: 0; }
  .compare ul.points li { margin-bottom: 6px; }
  .compare .tip { font-size: 17px; padding: 10px 14px; margin-top: 8px; }
```

- [ ] **Step 2: 목차를 5행 9항목으로**

CSS 두 줄 수정:
- `.toc { … grid-template-rows: repeat(4, 1fr); … }` → `repeat(5, 1fr)`
- `.toc a:nth-child(4), .toc a:nth-child(8) { border-bottom: 0; }` → `.toc a:nth-child(5), .toc a:nth-child(9) { border-bottom: 0; }`
- `.toc .t { font-size: 29px; …` → `27px`, `.toc .d { font-size: 18px; …` → `17px`

목차 슬라이드(3쪽) 마크업:
- `<span class="sum">8개 섹션 · 46장</span>` → `9개 섹션 · 63장`
- 08 행의 `<span class="p">41–46</span>` → `41–45`
- 08 행 바로 뒤에 추가:

```html
    <a data-goto="46"><span class="n">09</span><span><div class="t">따라하기 실습</div><div class="d">고령화 · 2호선 · 맥도날드 · 스타벅스 · 써브웨이 · 등시선 · 지형 · 최적입지</div></span><span class="p">46–63</span></a>
```

- [ ] **Step 3: 7쪽 내장 데이터 문구**

`<li><b>점 데이터</b> — 스타벅스 · 맥도날드 · 의료복지시설</li>` → `<li><b>점 데이터</b> — 스타벅스 · 맥도날드 · 의료복지시설 · 2호선 역</li>`

- [ ] **Step 4: 확인**

Run: `grep -c 'data-goto="46"' "DECK\e-GIS_기능소개.html"` → `1`. `grep -n '2호선 역' "DECK\e-GIS_기능소개.html"` → 7쪽 줄 하나. 브라우저에서 `file:///C:/Users/김용현/Desktop/e-GIS%20기능%20소개/e-GIS_기능소개.html#3` 열어 목차 9행이 900px 안에 들고 마지막 행에 밑줄이 없는지 본다(09 클릭은 아직 마무리 슬라이드로 감 — 정상).

---

### Task 4: 46쪽 실습 개요 슬라이드

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — `<!-- 45 마무리 -->` 주석 바로 앞에 삽입

- [ ] **Step 1: 개요 슬라이드 삽입**

```html
<!-- 46 실습 개요 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 1/17</span><span class="num"></span></div>
  <div class="text">
    <h2>따라하기 실습</h2>
    <p class="lead">내장 데이터로 8가지 — 막히면 참고 쪽으로 (번호 클릭)</p>
  </div>
  <table class="grid overview">
    <tr><th>#</th><th>실습</th><th>데이터</th><th>익히는 기능</th><th>참고 쪽</th></tr>
    <tr><td>①</td><td>서울 자치구 고령화 단계구분도</td><td>내장 — 서울 자치구 + 고령인구비율</td><td>테이블 결합 · 단계구분도 · 내보내기</td><td><a class="ref" data-goto="22">22</a> <a class="ref" data-goto="36">36</a> <a class="ref" data-goto="42">42</a></td></tr>
    <tr><td>②</td><td>2호선 출근길 도형표현도</td><td>내장 — 2호선 역 + 8~9시 승하차</td><td>필드 계산기 · 도형표현도</td><td><a class="ref" data-goto="22">22</a> <a class="ref" data-goto="23">23</a> <a class="ref" data-goto="37">37</a></td></tr>
    <tr><td>③</td><td>전국 맥도날드 격자 집계</td><td>내장 — 전국 맥도날드 404곳</td><td>좌표 불러오기 · 격자 만들기</td><td><a class="ref" data-goto="9">9</a> <a class="ref" data-goto="26">26</a></td></tr>
    <tr><td>④</td><td>서울 스타벅스 히트맵</td><td>내장 — 서울 스타벅스 692곳</td><td>히트맵 · 배경지도</td><td><a class="ref" data-goto="38">38</a> <a class="ref" data-goto="13">13</a></td></tr>
    <tr><td>⑤</td><td>광주 써브웨이 옆 샐러디</td><td>배포 — 광주 매장 주소 xlsx 2개</td><td>Geocoding · 버퍼 · 포인트 추출</td><td><a class="ref" data-goto="11">11</a> <a class="ref" data-goto="27">27</a> <a class="ref" data-goto="29">29</a></td></tr>
    <tr><td>⑥</td><td>광주제일고 등시선 · 최단경로</td><td>직접 그린 점 2개</td><td>점 그리기 · 등시선 · 최단경로</td><td><a class="ref" data-goto="18">18</a> <a class="ref" data-goto="30">30</a> <a class="ref" data-goto="31">31</a></td></tr>
    <tr><td>⑦</td><td>광주 지형 읽기와 3D</td><td>내장 — 광주 5개 구 DEM</td><td>지형 분석 · 등고선 · 3D 보기</td><td><a class="ref" data-goto="32">32</a> <a class="ref" data-goto="33">33</a> <a class="ref" data-goto="34">34</a></td></tr>
    <tr><td>⑧</td><td>조건 중첩 최적입지</td><td>⑦의 DEM</td><td>래스터 계산기 · 불투명도</td><td><a class="ref" data-goto="33">33</a> <a class="ref" data-goto="16">16</a></td></tr>
  </table>
</section>

```

- [ ] **Step 2: 확인**

브라우저 `…html#46`: 표가 한 화면에 들고(아래 여백 남음), 참고 쪽 숫자 클릭 시 해당 기능 슬라이드로 이동. `node check.js`는 아직 47장이라 exit 1 — 정상.

---

### Task 5: 실습 ① · ② 슬라이드 (47~50쪽)

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — 46쪽 뒤 · `<!-- 45 마무리 -->` 앞

- [ ] **Step 1: 실습 ① 단계(47) · 결과(48) 삽입**

```html
<!-- 47 실습 ① 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 2/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ① 서울 자치구 고령화 단계구분도</h2>
    <p class="lead">어느 구가 늙어 가나</p>
    <div class="data"><b>데이터</b><span>내장 면 → 서울 자치구 · 내장 속성 → 서울 자치구별 고령인구비율</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">경계 불러오기</div><div class="d">메뉴 → 데이터 불러오기 → 공간 데이터 → 서울 자치구<a class="ref" data-goto="7">7쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">속성 결합</div><div class="d">같은 창 → 속성 데이터 → 서울 자치구별 고령인구비율 → 레이어에 결합 · 키 <code>name</code> ↔ <code>gu_nm</code><a class="ref" data-goto="22">22쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">결합 확인</div><div class="d">속성 테이블에 <code>rate2026.06</code> · <code>pop2026.06</code> 열이 붙었는지<a class="ref" data-goto="21">21쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">단계구분도</div><div class="d">메뉴 → 주제도 → 단계구분도 · 속성 rate2026.06 · 자연 구분점 · 5단계 · 팔레트<a class="ref" data-goto="36">36쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">범례 · 라벨 다듬기</div><div class="d">범례 제목 클릭 → 고령인구비율(%) · 단위 % · 라벨 <code>name</code> 켜기<a class="ref" data-goto="24">24쪽</a></div></span></div>
    <div class="step"><span class="n">06</span><span><div class="t">지도 내보내기</div><div class="d">메뉴 → 프로젝트 → 지도 내보내기 · 제목 · 범례 · 방위표 → PNG<a class="ref" data-goto="42">42쪽</a></div></span></div>
  </div>
</section>

<!-- 48 실습 ① 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 3/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/48-p1-choropleth.png" alt="서울 자치구 고령인구비율 단계구분도"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">외곽 주거지가 진하고 강남권이 옅다</p>
      <ul class="points">
        <li><b>강북 27.3 · 도봉 26.9 · 중랑 24.1%</b> — 동북부 오래된 주거지</li>
        <li><b>강남 · 마포 17.7 · 서초 17.8%</b> — 젊은 인구 유입 지역</li>
        <li>구간 경계는 분류 방식이 정함 — 동일 간격 · 분위수로 바꿔 인상 비교</li>
      </ul>
      <div class="tip"><b>수업</b>pop2026.06 열로 도형표현도 → 비율과 인구 수를 나란히</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>결합 키는 글자가 정확히 같아야 — 공백 · '구' 유무</div>
    </div>
  </div>
</section>

```

- [ ] **Step 2: 실습 ② 단계(49) · 결과(50) 삽입**

```html
<!-- 49 실습 ② 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 4/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ② 2호선, 출근길에 어디서 타고 어디서 내리나</h2>
    <p class="lead">승차 · 하차 비율로 읽는 주거지와 업무지구</p>
    <div class="data"><b>데이터</b><span>내장 점 → 서울 지하철 2호선 역 · 내장 속성 → 2호선 8~9시 승하차</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">역 불러오기</div><div class="d">메뉴 → 데이터 불러오기 → 점 데이터 → 서울 지하철 2호선 역<a class="ref" data-goto="7">7쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">속성 결합</div><div class="d">같은 창 → 속성 데이터 → 2호선 8~9시 승하차 → 레이어에 결합 · 키 <code>sub_nm</code> ↔ <code>stn_nm</code><a class="ref" data-goto="22">22쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">합계 필드</div><div class="d">메뉴 → 속성 → 필드 계산기 · <code>total = boarding + getting off</code> (도형 크기용)<a class="ref" data-goto="23">23쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">도형표현도</div><div class="d">메뉴 → 주제도 → 도형표현도 · 파이 · 필드 boarding · getting off · 크기 기준 total · 최소 15 / 최대 60px<a class="ref" data-goto="37">37쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">읽기</div><div class="d">라벨 <code>sub_nm</code> 켜기 · 100% 막대로 바꿔 비율만 비교<a class="ref" data-goto="24">24쪽</a></div></span></div>
  </div>
</section>

<!-- 50 실습 ② 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 5/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/50-p2-chartmap.png" alt="2호선 역별 8~9시 승하차 도형표현도"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">내리는 곳은 업무지구, 타는 곳은 주거지</p>
      <ul class="points">
        <li><b>하차 90% 이상</b> — 시청 · 을지로입구 · 삼성 · 역삼 · 성수 → 출근 목적지</li>
        <li><b>승차 80% 이상</b> — 신림 · 신대방 · 봉천 · 낙성대 → 관악 주거지</li>
        <li><b>가장 큰 원</b> — 역삼 · 구로디지털단지 · 을지로입구 · 강남 (1만 6천~1만 9천 명)</li>
      </ul>
      <div class="tip"><b>수업</b>18~19시 자료로 같은 지도 → 흐름이 뒤집히는지 확인</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>결합 안 된 까치산 · 양천구청은 도형 없음 — 정상</div>
    </div>
  </div>
</section>

```

- [ ] **Step 3: 확인**

브라우저 `#47` `#49`: 단계 6개 · 5개가 2열 3행에 들고 마지막 줄 밑줄 없음, 참고 쪽 클릭 이동. `#48` `#50`은 이미지가 없어 깨진 아이콘 — 정상(Task 10에서 채움). 슬라이드 수: `grep -c '<section class="slide' "DECK\e-GIS_기능소개.html"` → `51`.

---

### Task 6: 실습 ③ · ④ 슬라이드 (51~54쪽)

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — 50쪽 뒤 · `<!-- 45 마무리 -->` 앞

- [ ] **Step 1: 실습 ③ 단계(51) · 결과(52) 삽입**

```html
<!-- 51 실습 ③ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 6/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ③ 전국 맥도날드 격자 집계</h2>
    <p class="lead">매장은 어디에 몰려 있나</p>
    <div class="data"><b>데이터</b><span>내장 점 데이터 → 전국 맥도날드 매장 404곳</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">불러오기</div><div class="d">메뉴 → 데이터 불러오기 → 점 데이터 → 전국 맥도날드 → 위도 · 경도 열 확인 → 가져오기<a class="ref" data-goto="9">9쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">둘러보기</div><div class="d">속성 테이블(지점명 · 시도 · 구군) · 점 색 · 크기 조정<a class="ref" data-goto="21">21쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">격자 만들기</div><div class="d">메뉴 → 벡터 분석 → 격자 만들기 · 크기 10km · 집계 개수<a class="ref" data-goto="26">26쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">읽기</div><div class="d">파란색 5단계 자동 채색 · 범례 확인 · 원본 점 레이어 끄기<a class="ref" data-goto="15">15쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">칸 크기 비교</div><div class="d">5km로 한 번 더 → 칸 크기에 따라 달라지는 패턴<a class="ref" data-goto="26">26쪽</a></div></span></div>
  </div>
</section>

<!-- 52 실습 ③ 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 7/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/52-p3-grid.png" alt="전국 맥도날드 10km 격자 집계"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">대도시권에 몰리고, 비어 있는 곳이 더 많다</p>
      <ul class="points">
        <li><b>수도권 · 부산 · 대구 · 대전 · 광주</b> 칸이 진함 — 인구 · 소득 · 교통</li>
        <li>강원 · 전남 내륙 · 경북 북부는 <b>빈 칸</b> — 매장 없는 시군</li>
        <li>같은 점인데 <b>5km</b> 칸에서는 도심 안 차이가, <b>10km</b>에서는 지역 간 차이가 보임</li>
      </ul>
      <div class="tip"><b>수업</b>스타벅스 · 의료복지시설로 같은 절차 → 어떤 시설이 더 고르게 퍼져 있나</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>전국에 500m 칸은 칸 수 초과로 안 그려짐 — 좁은 지역에서만</div>
    </div>
  </div>
</section>

```

- [ ] **Step 2: 실습 ④ 단계(53) · 결과(54) 삽입**

```html
<!-- 53 실습 ④ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 8/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ④ 서울 스타벅스 히트맵과 도시 구조</h2>
    <p class="lead">매장 밀도가 그리는 서울의 핵</p>
    <div class="data"><b>데이터</b><span>내장 점 데이터 → 서울 스타벅스 매장 692곳 (+ 실습 ①의 서울 자치구 경계)</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">불러오기</div><div class="d">메뉴 → 데이터 불러오기 → 점 데이터 → 서울 스타벅스 매장<a class="ref" data-goto="7">7쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">배경 경계</div><div class="d">서울 자치구 레이어 ⋮ → 색상 변경 · 채우기 불투명도 0 · 테두리만<a class="ref" data-goto="16">16쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">히트맵</div><div class="d">메뉴 → 주제도 → 히트맵 · 반경 15px · 흐림 20px · 그라디언트 선택<a class="ref" data-goto="38">38쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">반경 조절</div><div class="d">축척을 바꿔 가며 반경 조절 → 핵이 뚜렷해지는 값 찾기<a class="ref" data-goto="38">38쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">대조</div><div class="d">원본 점 켜고 끄기 · 배경지도 VWorld 야간으로 바꿔 불빛과 비교<a class="ref" data-goto="13">13쪽</a></div></span></div>
  </div>
</section>

<!-- 54 실습 ④ 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 9/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/54-p4-heatmap.png" alt="서울 스타벅스 히트맵"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">세 개의 핵이 떠오른다</p>
      <ul class="points">
        <li><b>강남(테헤란로) · 도심(종로 · 중구) · 여의도</b> — 서울의 3핵 구조</li>
        <li>홍대 · 잠실 · 마곡 · 구로디지털단지 — <b>부도심</b>과 신흥 업무지구</li>
        <li>강북 외곽 · 강서 남부는 옅음 — 주거 위주 지역</li>
      </ul>
      <div class="tip"><b>수업</b>맥도날드 · 의료복지시설로 같은 절차 → 업종마다 핵이 같은가</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>반경이 크면 핵이 뭉개짐 — 축척에 맞춰 다시 조절</div>
    </div>
  </div>
</section>

```

- [ ] **Step 3: 확인**

`grep -c '<section class="slide' "DECK\e-GIS_기능소개.html"` → `55`. 브라우저 `#51` `#53` 레이아웃 확인.

---

### Task 7: 실습 ⑤ · ⑥ 슬라이드 (55~58쪽)

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — 54쪽 뒤 · `<!-- 45 마무리 -->` 앞

- [ ] **Step 1: 실습 ⑤ 단계(55) · 결과 비교(56) 삽입**

```html
<!-- 55 실습 ⑤ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 10/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ⑤ 광주 써브웨이 옆에 샐러디가 있을까</h2>
    <p class="lead">후발 주자는 경쟁 매장 옆에 붙는가</p>
    <div class="data"><b>데이터</b><span>배포 파일 <code>광주_써브웨이_매장.xlsx</code> 18곳 · <code>광주_샐러디_매장.xlsx</code> 3곳 (주소만)</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">지오코딩</div><div class="d">메뉴 바 Geocoding → 안내대로 구글 시트 도구 사본 → 매장주소 붙여넣기 → 위도 · 경도 → 파일 저장 (두 파일 각각)<a class="ref" data-goto="11">11쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">좌표 데이터 가져오기</div><div class="d">메뉴 → 레이어 → 좌표 데이터 가져오기 → 점 레이어 2개 · 색 다르게<a class="ref" data-goto="9">9쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">버퍼</div><div class="d">메뉴 → 벡터 분석 → 버퍼 분석 · 소스 써브웨이 · 200 m · 병합 끔<a class="ref" data-goto="27">27쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">포인트 추출</div><div class="d">메뉴 → 벡터 분석 → 공간 연산 → 포인트 추출 · 레이어 1 샐러디 · 레이어 2 써브웨이 버퍼 · 폴리곤 안<a class="ref" data-goto="29">29쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">세기</div><div class="d">추출 레이어 속성 테이블 → 3곳 중 몇 곳 · <code>poly_</code> 속성으로 어느 써브웨이 옆인지 · 500m로 늘려 다시<a class="ref" data-goto="21">21쪽</a></div></span></div>
  </div>
</section>

<!-- 56 실습 ⑤ 결과 (광주 · 서울 비교) -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 11/17</span><span class="num"></span></div>
  <div class="text"><h2>결과 읽기 — 광주와 서울</h2></div>
  <div class="compare">
    <div class="shots">
      <figure><img src="images/56-p5-buffer-gwangju.png" alt="광주 써브웨이 200m 버퍼와 샐러디"><figcaption>광주 — 써브웨이 18 · 샐러디 3</figcaption></figure>
      <figure><img src="images/56-p5-buffer-seoul.png" alt="서울 써브웨이 200m 버퍼와 샐러디"><figcaption>서울 — 써브웨이 182 · 샐러디 349</figcaption></figure>
    </div>
    <div class="cols2">
      <div>
        <h3>광주</h3>
        <ul class="points">
          <li>샐러디 3곳 중 <b>N곳</b>이 써브웨이 200m 안 — 첨단 · 충장로 · 조선대 상권</li>
          <li>500m로 늘리면 <b>N곳</b> — 같은 상권 안에서는 붙어 있음</li>
        </ul>
      </div>
      <div>
        <h3>서울</h3>
        <ul class="points">
          <li>샐러디 349곳 중 <b>N곳(N%)</b>이 200m 안 — 우연보다 높은 동반 입지</li>
          <li>업무지구(강남 · 여의도 · 도심)에서 겹침이 집중</li>
        </ul>
        <div class="tip"><b>수업</b>우리 동네 두 업종으로 · 거리 바꿔 보기 <b style="margin-left:14px">주의</b>지오코딩 실패 주소는 시트에서 손보기 · 단위 m 확인</div>
      </div>
    </div>
  </div>
</section>

```

`N`은 Task 10에서 캡처하며 실제 값으로 바꾼다(Task 11 Step 1에서 `grep '<b>N'`으로 남은 게 없는지 확인).

- [ ] **Step 2: 실습 ⑥ 단계(57) · 결과(58) 삽입**

```html
<!-- 57 실습 ⑥ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 12/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ⑥ 광주제일고에서 몇 분이면 갈까</h2>
    <p class="lead">도보 생활권과 역까지의 경로</p>
    <div class="data"><b>데이터</b><span>직접 그린 점 2개 — 광주제일고 · 광주송정역 (내장 도로망)</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">위치 찾기</div><div class="d">지도 이동 → 광주제일고(북구 누문동) · 배경지도 VWorld 일반<a class="ref" data-goto="13">13쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">점 그리기</div><div class="d">툴바 그리기 → 점 → 학교 클릭 · 광주송정역 클릭 → 점 레이어 생성<a class="ref" data-goto="18">18쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">등시선</div><div class="d">메뉴 → 벡터 분석 → 등시선 분석 · 도로망 전체 도로 · 포인트 레이어 → 학교 피처 · 도보 4km/h · 5, 10, 15<a class="ref" data-goto="30">30쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">최단경로</div><div class="d">메뉴 → 벡터 분석 → 최단경로 분석 · 출발 학교 · 도착 광주송정역 · 자동차 → 레이어 이름의 거리 · 시간<a class="ref" data-goto="31">31쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">비교</div><div class="d">이동 수단 자전거로 다시 · 등시선 레이어 불투명도 낮춰 배경 보이게<a class="ref" data-goto="16">16쪽</a></div></span></div>
  </div>
</section>

<!-- 58 실습 ⑥ 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 13/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/58-p6-network.png" alt="광주제일고 도보 등시선과 광주송정역 최단경로"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">생활권은 원이 아니라 도로 모양</p>
      <ul class="points">
        <li><b>도보 15분권</b> — 광주역 · 유동 · 임동 일대, 큰길 따라 길쭉하게</li>
        <li>강 · 철도 · 대로가 <b>경계</b>가 됨 — 직선거리와 다른 도달 범위</li>
        <li>송정역까지 자동차 <b>약 N km · N분</b> — 자전거 · 도보와 비교</li>
      </ul>
      <div class="tip"><b>수업</b>학생 집을 점으로 찍어 통학권 · 생활권 조사</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>전체 도로망은 첫 로드에 시간 — 주요도로로 먼저 해 보기</div>
    </div>
  </div>
</section>

```

`N km · N분`도 Task 10에서 실제 값으로.

- [ ] **Step 3: 확인**

`grep -c '<section class="slide' …` → `59`. 브라우저 `#56`: 그림 2장 자리(깨진 아이콘)와 두 열 설명이 900px 안에 드는지 — 이미지가 없어 높이가 0이므로 최종 확인은 Task 10 뒤에.

---

### Task 8: 실습 ⑦ · ⑧ 슬라이드 (59~62쪽)

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` — 58쪽 뒤 · `<!-- 45 마무리 -->` 앞

- [ ] **Step 1: 실습 ⑦ 단계(59) · 결과(60) 삽입**

```html
<!-- 59 실습 ⑦ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 14/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ⑦ 광주 지형 읽기와 3D</h2>
    <p class="lead">무등산과 영산강 사이</p>
    <div class="data"><b>데이터</b><span>내장 래스터 → 전남광주통합특별시 광산 · 남 · 동 · 북 · 서구 DEM(90m)</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">DEM 불러오기</div><div class="d">메뉴 → 데이터 불러오기 → 래스터 → 전남광주통합특별시 폴더 → 5개 구 골라 한꺼번에<a class="ref" data-goto="7">7쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">해발고도</div><div class="d">메뉴 → 래스터 분석 → 해발고도(지형음영) · 입력 북구 · 광원 315° / 45°<a class="ref" data-goto="32">32쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">경사도</div><div class="d">래스터 분석 → 경사도 · 입력 북구 · 단위 도<a class="ref" data-goto="32">32쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">등고선</div><div class="d">래스터 분석 → 등고선 생성 · 북구 · 간격 50m<a class="ref" data-goto="33">33쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">3D 보기</div><div class="d">툴바 → 3D · 전체(5개 이어 붙이기) · 세로 과장 2~3배 · 드래그 회전 → PNG 저장<a class="ref" data-goto="34">34쪽</a></div></span></div>
  </div>
</section>

<!-- 60 실습 ⑦ 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 15/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/60-p7-terrain3d.png" alt="광주 5개 구 DEM 3D 보기"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">동쪽은 산, 서쪽은 강과 들</p>
      <ul class="points">
        <li><b>무등산(1,187m)</b> — 동구 · 북구 동쪽, 급경사 · 등고선 촘촘</li>
        <li><b>영산강 · 황룡강</b> 연안 — 광산구 · 서구의 완경사 저지대</li>
        <li>시가지는 그 사이 <b>해발 30~80m</b> 구릉과 평지에</li>
      </ul>
      <div class="tip"><b>수업</b>우리 지역 DEM으로 같은 절차 → 지형과 취락 입지 잇기</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>래스터 분석은 DEM 한 장씩 — 실습은 북구, 다른 구도 같은 방법</div>
    </div>
  </div>
</section>

```

- [ ] **Step 2: 실습 ⑧ 단계(61) · 결과(62) 삽입**

```html
<!-- 61 실습 ⑧ 단계 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 16/17</span><span class="num"></span></div>
  <div class="text">
    <h2>실습 ⑧ 조건 중첩으로 최적입지 찾기</h2>
    <p class="lead">낮고 · 완만하고 · 남향인 땅</p>
    <div class="data"><b>데이터</b><span>실습 ⑦의 북구 DEM 그대로</span></div>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><span><div class="t">조건 1 — 고도</div><div class="d">메뉴 → 래스터 분석 → 래스터 계산기(값 필터) · 기준 해발고도 · 0 ~ 200 · 노랑<a class="ref" data-goto="33">33쪽</a></div></span></div>
    <div class="step"><span class="n">02</span><span><div class="t">조건 2 — 경사</div><div class="d">래스터 계산기 · 기준 경사도 · 0 ~ 5 · 파랑<a class="ref" data-goto="33">33쪽</a></div></span></div>
    <div class="step"><span class="n">03</span><span><div class="t">조건 3 — 향</div><div class="d">래스터 계산기 · 기준 경사방향 · 135 ~ 225 · 빨강<a class="ref" data-goto="33">33쪽</a></div></span></div>
    <div class="step"><span class="n">04</span><span><div class="t">불투명도</div><div class="d">세 결과 레이어 각각 ⋮ → 색상 변경 → 불투명도 40%<a class="ref" data-goto="16">16쪽</a></div></span></div>
    <div class="step"><span class="n">05</span><span><div class="t">읽기</div><div class="d">세 색이 겹쳐 진한 곳 = 세 조건 모두 만족 · DEM · 지형음영 끄고 배경지도 위성으로 확인<a class="ref" data-goto="13">13쪽</a></div></span></div>
  </div>
</section>

<!-- 62 실습 ⑧ 결과 -->
<section class="slide">
  <div class="meta"><span class="tag" data-goto="46">따라하기 실습 · 17/17</span><span class="num"></span></div>
  <div class="body">
    <div class="shot"><img src="images/62-p8-site.png" alt="북구 고도 · 경사 · 향 조건 중첩"></div>
    <div class="text">
      <h2>결과 읽기</h2>
      <p class="lead">세 색이 겹친 곳만 남는다</p>
      <ul class="points">
        <li><b>영산강 연안 저지대</b>와 구릉 남사면 — 세 조건이 겹치는 곳</li>
        <li>무등산 자락은 고도 · 경사에서 탈락, 북사면은 향에서 탈락</li>
        <li>위성 배경과 대조 — 이미 농경지 · 시가지인 곳이 대부분</li>
      </ul>
      <div class="tip"><b>수업</b>조건 바꿔 보기 — 풍력 = 높고 능선, 태양광 = 남향 완경사, 침수 = 해발 20m 이하</div>
      <div class="tip" style="margin-top:12px"><b>주의</b>범위는 최소 · 최대 둘 다 입력 — 비우면 실행 안 됨</div>
    </div>
  </div>
</section>

```

- [ ] **Step 3: 마무리 슬라이드 주석 갱신 · 개수 확인**

`<!-- 45 마무리 -->` → `<!-- 63 마무리 -->`. `grep -c '<section class="slide' …` → `63`. `node "DECK\check.js"` → `slides: 63`, `missing`에 새 캡처 9개 파일명만 나열, `bad: []`, exit 1(캡처 전이라 정상).

---

### Task 9: 렌더 검사 — 넘침 · 고아 글자 · 인쇄 시뮬 (캡처 전, 텍스트 슬라이드)

**Files:** 없음(검사만). 문제가 나오면 해당 슬라이드 마크업 · CSS를 고친다.

- [ ] **Step 1: 헤드리스 캡처로 단계 슬라이드 훑기**

```bash
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
U="file:///C:/Users/김용현/Desktop/e-GIS%20기능%20소개/e-GIS_기능소개.html"
for n in 3 46 47 49 51 53 55 57 59 61; do
  "$C" --headless=new --disable-gpu --window-size=1600,900 --screenshot="$SCRATCH/s$n.png" "$U#$n" 2>/dev/null
done
```

Read 도구로 `s3.png`(목차 9행), `s46.png`(표), `s47.png` … 을 열어 본다. 기준: 아래 여백이 남고 텍스트가 잘리지 않음, 단계 번호 · 제목 · 세부가 목차와 같은 위계, 참고 쪽수가 파란 작은 글씨로 줄 끝에.

- [ ] **Step 2: 넘침 · 고아 글자 자동 검사**

Chrome MCP로 덱을 연 뒤 `javascript_tool`로:

```js
(() => {
  const out = [];
  const slides = [...document.querySelectorAll('.slide')];
  slides.forEach((s, i) => {
    s.classList.add('active');
    // 넘침
    if (s.scrollHeight > s.clientHeight + 1) out.push(`#${i + 1} overflow ${s.scrollHeight}>${s.clientHeight}`);
    // 고아 글자: 블록 텍스트의 마지막 줄 너비 < 2.6em
    s.querySelectorAll('h2, .lead, li, .d, .t, td, .tip, figcaption').forEach((el) => {
      const r = document.createRange(); r.selectNodeContents(el);
      const rects = [...r.getClientRects()].filter(x => x.width > 0);
      if (rects.length < 2) return;
      const lines = new Map();
      rects.forEach(x => { const k = Math.round(x.top); lines.set(k, (lines.get(k) || 0) + x.width); });
      const last = [...lines.entries()].sort((a, b) => a[0] - b[0]).pop()[1];
      const em = parseFloat(getComputedStyle(el).fontSize);
      if (last < 2.6 * em) out.push(`#${i + 1} orphan "${el.textContent.trim().slice(-12)}" ${Math.round(last)}px`);
    });
    s.classList.remove('active');
  });
  document.querySelector('.slide').classList.add('active');
  return out.join('\n') || 'OK';
})()
```

Expected: `OK`. 고아 글자가 나오면 그 문장의 어순을 바꾸거나 `&nbsp;`로 묶어 해결(글자 크기는 줄이지 않는다).

- [ ] **Step 3: 인쇄 시뮬**

```bash
"$C" --headless=new --disable-gpu --print-to-pdf="$SCRATCH/sim.pdf" --no-pdf-header-footer "$U" 2>/dev/null
python -c "import fitz;d=fitz.open(r'SCRATCH\sim.pdf');print(len(d),[ (round(p.rect.width),round(p.rect.height)) for p in d][:3])"
```

Expected: `63 [(1600, 900), …]`. (PyMuPDF가 없으면 `pip install pymupdf`.)

---

### Task 10: 캡처 9장 (e-GIS dev 서버 + Chrome MCP)

**Files:**
- Create: `DECK\images\48-p1-choropleth.png` `50-p2-chartmap.png` `52-p3-grid.png` `54-p4-heatmap.png` `56-p5-buffer-gwangju.png` `56-p5-buffer-seoul.png` `58-p6-network.png` `60-p7-terrain3d.png` `62-p8-site.png`
- Create: `SCRATCH\geocode_for_capture.py`, `SCRATCH\광주_써브웨이_좌표.csv`, `SCRATCH\광주_샐러디_좌표.csv` (배포 안 함)

이 Task는 브라우저 조작이라 인라인으로 수행한다. 공통 준비(메모리 [egis-feature-intro-deck]):

- [ ] **Step 0: 공통 준비**
  1. EGIS에서 `npm run dev`(백그라운드) → http://localhost:3000.
  2. Chrome MCP: `tabs_context_mcp` → 새 탭 → `http://localhost:3000/guide`에서 `localStorage.egis_last_visit = new Date().toISOString().slice(0,10)` 실행(조회수 방지) → `http://localhost:3000` 이동.
  3. `javascript_tool`로 `document.head.insertAdjacentHTML('beforeend','<style>#app{width:1596px;height:898px}</style>')` 주입. 밝은 테마 확인.
  4. 각 캡처는 `computer` 도구 `zoom` region `[0,0,1414,795]` + `save_to_disk`(scale 없이) → 1456×819 PNG. 저장 파일을 `DECK\images\` 로 옮기고 이름을 맞춘다. 캡처 전 열린 모달 · 드롭다운은 닫고 레이어 패널은 펼친 상태로 둔다(기존 캡처와 같은 모습).
  5. 캡처 사이에는 메뉴 → 프로젝트 → 새 프로젝트(또는 레이어 전부 삭제)로 지도를 비운다.

- [ ] **Step 1: 48-p1-choropleth** — 데이터 불러오기 → 공간 데이터 → 서울 자치구; 속성 데이터 → 서울 자치구별 고령인구비율 → 레이어에 결합(name ↔ gu_nm); 주제도 → 단계구분도(rate2026.06 · 자연 구분점 · 5 · 기본 팔레트); 범례 제목 `고령인구비율(%)`; 라벨 name. 서울 전체가 꽉 차게. 캡처.

- [ ] **Step 2: 50-p2-chartmap** — 새 프로젝트. 점 데이터 → 서울 지하철 2호선 역; 속성 데이터 → 2호선 8~9시 승하차 → 결합(sub_nm ↔ stn_nm); 속성 → 필드 계산기 `total = boarding + getting off`; 주제도 → 도형표현도(파이 · boarding · getting off · 크기 total · 15/60); 라벨 sub_nm. 2호선 순환선 전체가 보이게. 캡처. 도형표현도가 결합 안 된 두 역에서 오류를 내면 그 역 두 피처를 선택 삭제하고 진행하되 60쪽 `주의` 문구를 "결합 안 된 역은 미리 지우기"로 바꾼다.

- [ ] **Step 3: 52-p3-grid** — 새 프로젝트. 점 데이터 → 전국 맥도날드(좌표 가져오기 창 → 가져오기); 벡터 분석 → 격자 만들기(10km · 개수); 원본 점 레이어 끄기. 남한 전체 + 범례. 캡처.

- [ ] **Step 4: 54-p4-heatmap** — 새 프로젝트. 공간 데이터 → 서울 자치구 → 색상 변경(채우기 불투명도 0); 점 데이터 → 서울 스타벅스; 주제도 → 히트맵(15 · 20); 원본 점 끔. 서울 전체. 캡처.

- [ ] **Step 5: 캡처용 광주 좌표 만들기(배포 안 함)**

`SCRATCH\geocode_for_capture.py` — VWorld 지오코더(키는 `EGIS\.env.local`의 `VITE_VWORLD_KEY`):

```python
import openpyxl, csv, json, os, re, sys, io, urllib.parse, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
key = re.search(r'VITE_VWORLD_KEY=(\S+)', open(r"C:\Users\김용현\Desktop\vibecoding\eGIS\.env.local", encoding='utf-8').read()).group(1)
SRC = r"C:\Users\김용현\Desktop\e-GIS 기능 소개\실습자료"
OUT = os.path.dirname(os.path.abspath(__file__))

def geocode(addr):
    addr = re.sub(r'\s*\(.*?\)|,.*$|\s+\d*층.*$|\s+\d+호.*$', '', addr).strip()  # 괄호 · 층 · 호 제거
    for typ in ('road', 'parcel'):
        q = urllib.parse.urlencode({'service': 'address', 'request': 'getcoord', 'version': '2.0', 'crs': 'epsg:4326',
                                    'address': addr, 'refine': 'true', 'simple': 'false', 'format': 'json', 'type': typ, 'key': key})
        r = json.load(urllib.request.urlopen('https://api.vworld.kr/req/address?' + q))
        if r['response']['status'] == 'OK':
            p = r['response']['result']['point']; return float(p['y']), float(p['x'])
    return None, None

for name in ('광주_써브웨이_매장', '광주_샐러디_매장'):
    ws = openpyxl.load_workbook(f"{SRC}\\{name}.xlsx", read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    with open(f"{OUT}\\{name.replace('매장','좌표')}.csv", 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(['name', 'address', 'lat', 'lon'])
        for _, nm, addr in rows[1:]:
            lat, lon = geocode(addr); print(nm, lat, lon); w.writerow([nm, addr, lat, lon])
```

Run: `python "SCRATCH\geocode_for_capture.py"`. 실패(None)한 주소는 VWorld 지도(map.vworld.kr)에서 검색해 CSV에 손으로 채운다. VWorld 키가 API 호출을 거부하면(도메인 제한) 대안: Google Drive MCP로 사용자의 지오코딩 시트(ID `1nW24wsVc_6RKL-rBxlUb5iS24MebZaQtAj4qYdlPmgw`)를 복사해 주소를 넣고 계산된 값을 읽어 온다 — 그것도 안 되면 사용자에게 21개 좌표를 요청한다.

- [ ] **Step 6: 56-p5-buffer-gwangju** — 새 프로젝트. 레이어 → 좌표 데이터 가져오기 창을 열고 `javascript_tool`로 파일 입력에 `SCRATCH\광주_써브웨이_좌표.csv`를 DataTransfer로 주입(지리참조 캡처 때 `#georef-file`에 했던 것과 같은 방법 — 입력 요소는 `document.querySelector('.modal input[type=file]')`; 파일 내용은 fetch 불가하므로 `new File([csvText], name)`로 만든다. csvText는 Read로 읽어 JS 문자열에 넣는다) → lat/lon 열 → 가져오기; 샐러디도 같은 방법. 써브웨이 점은 파랑, 샐러디 점은 빨강 · 크기 크게. 버퍼 분석(써브웨이 · 200 · m · 병합 끔); 공간 연산 → 포인트 추출(샐러디 · 버퍼 · 안). 결과 점 개수를 속성 테이블에서 읽어 기록(`N_gwangju_200`). 500m로도 한 번 더 세어 기록(`N_gwangju_500`)한 뒤 500m 버퍼 레이어는 지운다. 광주 시가지가 꽉 차게(첨단~충장로~조선대가 다 들어오는 축척). 캡처.

- [ ] **Step 7: 56-p5-buffer-seoul** — 새 프로젝트. `DECK\실습자료\서울_써브웨이_매장.csv`(열 Latitude · Longitude) · `서울_샐러디_매장.csv`를 같은 방법으로 주입 → 점 레이어 2개(같은 색 규칙); 버퍼 200m; 포인트 추출; 결과 개수 기록(`N_seoul_200`, 비율 = N/349). 서울 전체. 캡처.

- [ ] **Step 8: 58-p6-network** — 새 프로젝트. 배경지도 VWorld 일반. 광주제일고(북구 독립로 237 부근) 로 이동 · 축척 약 1:25,000. 툴바 그리기 → 점 → 학교 · 광주송정역(광산구 송정동) 클릭. 등시선(전체 도로 · 학교 피처 · 도보 · 4 · `5, 10, 15`); 최단경로(학교 → 송정역 · 자동차). 결과 레이어 이름에서 거리 · 시간 기록(`route_km`, `route_min`). 등시선과 경로가 다 보이는 축척. 캡처.

- [ ] **Step 9: 60-p7-terrain3d** — 새 프로젝트. 래스터 → 전남광주통합특별시 폴더에서 광산구 · 남구 · 동구 · 북구 · 서구 5개 선택 → 불러오기. 툴바 → 3D(전체 · 과장 2.5) → `__egisDebug.view3dPanel.controller.scene`의 camera/controls로 남서쪽 상공에서 무등산을 바라보는 각도로 맞춘다. 3D 뷰가 화면을 채운 상태로 캡처(3D 패널이 별도 창이면 그 창 영역을 zoom).

- [ ] **Step 10: 62-p8-site** — 같은 프로젝트에서 3D 닫기. 래스터 분석 → 래스터 계산기 3회(북구 · 해발고도 0~200 노랑 `#F5C400` / 경사도 0~5 파랑 `#296EF9` / 경사방향 135~225 빨강 `#E53935`); 각 결과 ⋮ → 불투명도 40%; DEM 5개 끔; 배경지도 VWorld 위성. 북구 전체가 차게. 캡처.

- [ ] **Step 11: 파일 배치 · 검사**

캡처 9장을 `DECK\images\`에 정확한 이름으로 두고:
```bash
python -c "from PIL import Image;import glob;[print(f.split('\\\\')[-1],Image.open(f).size) for f in glob.glob(r'C:\Users\김용현\Desktop\e-GIS 기능 소개\images\*-p*.png')]"
node "DECK\check.js"
```
Expected: 9장 모두 `(1456, 819)`, `missing: [] | unused: []`, exit 0.

---

### Task 11: 결과 문구 확정 · 최종 검사 · PDF 2종

**Files:**
- Modify: `DECK\e-GIS_기능소개.html` (56 · 58쪽의 N 값, 60쪽 주의 문구 필요 시)
- Create: `DECK\e-GIS_기능소개.pdf`, `DECK\e-GIS_기능소개_경량.pdf` (덮어쓰기)

- [ ] **Step 1: N 값 채우기**

Task 10에서 기록한 `N_gwangju_200` `N_gwangju_500` `N_seoul_200`(과 비율) `route_km` `route_min`을 56 · 58쪽에 넣는다. 확인: `grep -n '<b>N\|N km' "DECK\e-GIS_기능소개.html"` → 출력 없음.

- [ ] **Step 2: 렌더 검사 재실행**

Task 9 Step 1(이번엔 48~62 짝수 쪽 포함 `for n in 46 47 … 62`)과 Step 2 스크립트를 다시 돌린다. Expected: 넘침 · 고아 글자 `OK`, 56쪽 두 캡처 + 두 열 설명이 900px 안.

- [ ] **Step 3: check.js 최종**

`node "DECK\check.js"` → exit 0, `slides: 63 | img refs: 49 | files: 49`.

- [ ] **Step 4: PDF 원본**

```bash
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
U="file:///C:/Users/김용현/Desktop/e-GIS%20기능%20소개/e-GIS_기능소개.html"
"$C" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="/c/Users/김용현/Desktop/e-GIS 기능 소개/e-GIS_기능소개.pdf" "$U" 2>/dev/null
```

- [ ] **Step 5: PDF 경량**

스크래치에 덱 사본을 만들고 캡처를 JPEG(품질 85)로 바꿔 인쇄한다(PyMuPDF로 PDF 안 이미지를 바꾸면 글리프가 깨지므로 금지):

```bash
S="$SCRATCH/light"; mkdir -p "$S/images"
cp "/c/Users/김용현/Desktop/e-GIS 기능 소개/e-GIS_기능소개.html" "$S/deck.html"
# 스크래치 경로를 Windows 형식으로 넘긴다(중첩 heredoc 금지 — 스크립트는 파일로 저장해 실행)
cat > "$S/to_jpg.py" <<'PY'
from PIL import Image; import glob, os, sys
src = r"C:\Users\김용현\Desktop\e-GIS 기능 소개\images"; dst = sys.argv[1]
for f in glob.glob(src + r"\*.png"):
    Image.open(f).convert('RGB').save(os.path.join(dst, os.path.basename(f)[:-4] + '.jpg'), quality=85)
PY
python "$S/to_jpg.py" "$(cygpath -w "$S/images")"
sed -i 's/\(images\/[^"]*\)\.png"/\1.jpg"/g' "$S/deck.html"
"$C" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="/c/Users/김용현/Desktop/e-GIS 기능 소개/e-GIS_기능소개_경량.pdf" "file:///$S/deck.html" 2>/dev/null
ls -la "/c/Users/김용현/Desktop/e-GIS 기능 소개/"*.pdf
```

Expected: 원본 40MB 안팎, 경량 15~20MB, 둘 다 63쪽(`python -c "import fitz;print(len(fitz.open(r'…\e-GIS_기능소개.pdf')),len(fitz.open(r'…\e-GIS_기능소개_경량.pdf')))"` → `63 63`).

---

### Task 12: 배포 · 메모리

- [ ] **Step 1: e-GIS 배포**

Task 1 커밋이 아직 푸시 전이다. 사용자에게 `/cpd` 실행 여부를 확인받고 실행(커밋 · 푸시 · Vercel). 배포 뒤 https://e-gis.kr 에서 데이터 불러오기 → 점 데이터에 「서울 지하철 2호선 역」이 보이는지 확인(조회수 방지: `/guide`에서 `localStorage.egis_last_visit` 먼저).

- [ ] **Step 2: 메모리 갱신**

`C:\Users\김용현\.claude\projects\C--Users----\memory\egis-feature-intro-deck.md`를 63장 구성(46 개요 · 47~62 실습 8개 · 63 마무리), 새 캡처 9장, `실습자료\` 폴더, `.ref` 참고 쪽수 방식, check.js 63 기준으로 고치고, `MEMORY.md`의 한 줄 요약도 맞춘다. `egis-project.md`에는 내장 데이터 2건 추가 사실(2026-09-17)을 한 줄 덧붙인다.
