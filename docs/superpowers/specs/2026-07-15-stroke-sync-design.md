# 단계구분도·카토그램 테두리 색 제어 설계

작성일: 2026-07-15

## 목표

단계구분도와 카토그램에서 **테두리 색을 사용자가 정할 수 있게** 한다.
"테두리를 분류색에 동기화" 체크박스를 두고, 해제하면 단일 테두리 색을 지정한다.

채우기 색은 분류 설정이 소유한다. 사용자가 바꿀 수 있는 건 **투명도와 테두리**뿐이다.

## 문제

**단계구분도**: 테두리가 `cfg.tool.darkenColor(분류색)`으로 고정돼 있고
(`LayerManager.js:587`), `setLayerStrokeColor`가 `type === 'choropleth'`면 early return
하므로 아예 바꿀 수 없다.

**카토그램**: 사용자가 처음 보고한 "동기화되어 있다"는 사실이 아니다.
테두리는 `'#333'` 하드코딩이다(`CartogramTool.js:89`). 진짜 문제는 다른 데 있다 —
**색을 바꾸면 분류가 통째로 풀린다.**

프로브로 실측한 결과:
```
applyCartogramStyle 직후 스타일: function   (속성값 기반 분류색)
setLayerColor 후    스타일: object     (단색 Style — 분류색 파괴)
_cartogramConfig 살아있나: true
```

원인: 카토그램 레이어의 `type`은 `'cartogram'`이 아니라 **`'vector'`**다
(`CartogramTool.js:205`). 코드베이스는 `_cartogramConfig` 존재로 카토그램을 식별한다.
그래서 `setLayerColor`의 `choropleth` 가드를 통과하고, `updateLayerStyle`에는
카토그램 분기가 없어 일반 경로로 떨어져 분류색 스타일 함수를 단색 Style로 덮어쓴다.
`_cartogramConfig`는 남아 있어 새로고침하면 되살아나는, 더 헷갈리는 상태가 된다.

## 현재 상태 정리

| | 단계구분도 | 카토그램 |
|---|---|---|
| 식별 | `type === 'choropleth'` | `type === 'vector'` + `_cartogramConfig` |
| 테두리 색 | `darkenColor(분류색)` 고정 | `'#333'` 하드코딩 |
| 채우기 투명도 | `layerInfo.fillOpacity` 반영 | `0.85` 하드코딩 |
| 테두리 두께 | `layerInfo.strokeWidth` 반영 | `1` 하드코딩 |
| 선 스타일(dash) | 반영 안 함 (죽은 컨트롤) | 반영 안 함 |
| `updateLayerStyle` 분기 | 있음 | **없음 → 편집 시 분류색 파괴** |

## 범위

- **포함**: `strokeSyncToFill` 플래그, 두 도구의 테두리 색 제어, 카토그램
  `updateLayerStyle` 분기 신설(= 분류 파괴 버그 수정), 카토그램 투명도·두께를
  `layerInfo`에서 읽기, 선 스타일(dash) 반영, `STYLE_FIELDS` 상수 정리
- **제외**:
  - 테두리 투명도(`strokeOpacity`) — 요청에 없고 현재도 두 도구가 무시한다
  - 도형표현도(chartmap) — 구운 차트 아이콘이 스타일의 전부라 성격이 다르다
  - 분류색 램프 편집 — 생성 패널의 몫

## 결정 사항

**체크박스 기본값은 두 도구 모두 ON** (사용자 결정). 카토그램 테두리가
`#333` → 분류색 어둡게로 바뀌지만 두 도구가 일관된다.

**선 스타일(dash)은 숨기지 않고 동작하게 한다** (사용자 결정). 이미 UI에 있고
저장·복원도 되는 컨트롤이라, 어차피 고치는 `Stroke` 생성자에 한 줄 넣는 편이
숨기는 것보다 낫다.

## 데이터 모델

**새 필드**: `layerInfo.strokeSyncToFill` (boolean, 기본 `true`).
기존 스타일 필드(`strokeColor`/`strokeWidth`/`strokeDash`/`strokeOpacity`)와 같은
무리라 `styleFields` 배열에 자연스럽게 얹힌다.

읽을 때는 항상 `layerInfo.strokeSyncToFill !== false`로 판정한다.
`undefined`(기존 레이어·기존 저장본)를 기본 ON으로 흡수하기 위해서다.

### `STYLE_FIELDS` 상수 정리

같은 7개 필드 목록이 **세 곳에 복제**돼 있다:

| 위치 | 현재 |
|------|------|
| `LayerManager.duplicateLayer:457` | 배열 리터럴 |
| `ProjectManager.js:290` | 배열 리터럴 |
| `AutoSaveManager.restoreLayer` | 배열 리터럴 |

한 곳만 빠뜨리면 **"복원하면 체크가 풀리는"** 버그가 조용히 생긴다.
`LayerManager`에서 `export const STYLE_FIELDS = [...]`로 내보내고 세 곳이 import한다.
이번에 정확히 그 배열에 필드를 추가하므로 지금 정리한다.

### 직렬화

`StateManager.saveLayer`(자동저장)와 `ProjectManager`의 저장 쪽은 배열이 아니라
**개별 속성 나열**이므로 각각 `strokeSyncToFill: layerInfo.strokeSyncToFill` 한 줄씩 추가한다.
합치면 저장 2곳 + 복원 3곳이 모두 새 필드를 다룬다.

### 순환 import 회피 — `cfg.tool` 패턴

`LayerManager`는 도구를 하나도 import하지 않는다. `CartogramTool`은
`layerManager`를 import하므로 반대 방향 import는 순환이 된다.

기존 코드가 이미 답을 갖고 있다: **설정 객체에 도구 참조를 심는다.**
`_choroplethConfig.tool = choroplethTool`을 두고 `updateLayerStyle`이
`cfg.tool.darkenColor(...)`를 부른다. 카토그램도 `_cartogramConfig.tool = cartogramTool`로
같은 관례를 따른다.

`tool`은 함수 참조라 직렬화에서 자연히 빠진다(설정을 필드별로 골라 저장하므로 추가 조치 불필요).

## 렌더링

### 단계구분도 분기 수정 (`LayerManager.js:571-599`)

```js
const syncStroke = layerInfo.strokeSyncToFill !== false;
const strokeColor = layerInfo.strokeColor || '#666';
const lineDash = this.getLineDash(layerInfo.strokeDash || 'solid');
```

`Stroke`가 조건부가 된다:
```js
stroke: new Stroke({
  color: syncStroke ? cfg.tool.darkenColor(color) : strokeColor,
  width: strokeWidth,
  lineDash: lineDash
})
```

값이 없는 피처(`isNaN`)의 회색 스타일도 같은 규칙을 따른다 —
동기화 ON이면 기존대로 `#666`, OFF면 사용자가 정한 `strokeColor`.

**동기화를 처음 해제하면 무슨 색이 나오나**: `layerInfo.strokeColor`다. `addLayer`가
레이어 생성 시 팔레트 색(`getNextColor()`)을 `strokeColor`에 심어 두므로
(`LayerManager.js:169`) `undefined`인 경우는 사실상 없고, `|| '#666'`은 방어용이다.
따라서 체크를 푸는 순간 팔레트 색 테두리가 나타난다 — 임의의 색이지만 사용자가
바로 옆 색상 선택기로 고르면 되므로 문제되지 않는다. 카토그램은 생성 시
`strokeColor = '#333'`을 심으므로 해제하면 기존 모습(`#333`)이 그대로 나온다.

### 카토그램 분기 신규

`_contourConfig` 분기 옆, 일반 경로 앞에 둔다. `type`이 `'vector'`라 단계구분도
분기에 안 걸리므로 **`_cartogramConfig` 존재로 식별**한다(`_contourConfig`와 같은 방식).

```js
if (layerInfo._cartogramConfig && layerInfo._cartogramConfig.tool) {
  const cfg = layerInfo._cartogramConfig;
  layerInfo.olLayer.setStyle(cfg.tool.cartogramStyle(cfg, {
    fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.85,
    strokeWidth: layerInfo.strokeWidth || 1,
    strokeColor: layerInfo.strokeColor || '#333',
    syncStroke: layerInfo.strokeSyncToFill !== false,
    lineDash: this.getLineDash(layerInfo.strokeDash || 'solid')
  }));
  eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
  return;
}
```

`lineDash`는 이미 해석된 배열로 넘긴다. `getLineDash`가 `LayerManager`의 메서드라
`CartogramTool`이 그걸 알 필요가 없다.

### `CartogramTool.cartogramStyle(config, styleOpts)`

시그니처를 넓혀 하드코딩(0.85 / `#333` / 1)을 **옵션의 기본값**으로 내린다.
라벨 렌더링(`Text`)은 이 함수 안에 그대로 남으므로 중복이 생기지 않는다.

동기화 ON일 때 쓸 `darkenColor`는 `ChoroplethTool.js:503`에만 있는데,
`CartogramTool`이 이미 `choroplethTool`을 import하고 있으므로
(`cartoColorIndex`에서 `getColorIndex` 사용) 그대로 쓴다.

### `applyCartogramStyle` — 도구 참조를 스스로 심는다

```js
applyCartogramStyle(layerId) {
  const layerInfo = layerManager.getLayer(layerId);
  if (!layerInfo || !layerInfo._cartogramConfig || !layerInfo.olLayer) return;
  layerInfo._cartogramConfig.tool = this;   // 순환 import 회피 (late binding)
  layerManager.updateLayerStyle(layerId);
}
```

복원 경로(`AutoSaveManager.restoreLayer`, `ProjectManager.loadProject`)가 이미 이걸
부르므로 **그쪽은 `tool` 관련 수정이 필요 없다.** 스타일 계산 경로도 하나로 모인다.

### 가드 수정 (`LayerManager`)

- **`setLayerStrokeColor`** — 지금 `type === 'choropleth'`면 early return 한다.
  **이 가드를 없애야 기능이 성립한다.**
- **`setLayerColor`** — 단계구분도만 막는데 카토그램도 막아야 한다.
  분류색은 설정이 소유하기 때문이다.
- **`isClassified(layerInfo)`** 헬퍼 신설:
  `layerInfo.type === 'choropleth' || !!layerInfo._cartogramConfig`.
  가드와 `LayerPanel`이 공유한다.

### 카토그램 생성 3곳 정리

Dorling(`:203`)·NonContig(`:343`)·Contig(`:480`)가 같은 패턴을 반복한다.
헬퍼로 묶고 거기서 `layerInfo`에 스타일 메타데이터를 심는다:

```js
newLayerInfo._cartogramConfig = config;
newLayerInfo.fillOpacity = 0.85;
newLayerInfo.strokeColor = '#333';   // 동기화 해제 시 쓸 기본값
newLayerInfo.strokeWidth = 1;
this.applyCartogramStyle(newLayerId);
```

지금은 렌더링만 0.85고 메타데이터는 `addLayer` 기본값 0.3이라 **패널이 거짓말을 한다.**

### 레이어 복제 경로 — 추가 수정 불필요

`LayerManager.duplicateLayer:462`가 `copy._cartogramConfig = { ...info._cartogramConfig }`로
설정을 얕은 복사하는데, 이 스프레드가 `tool` 참조까지 함께 옮긴다. 따라서 복제본도
새 카토그램 분기를 정상적으로 탄다. `LayerPanel.js:467`이 복제 후
`applyCartogramStyle`을 부르는 것도 그대로 유효하다.
**확인만 하고 손대지 않는다.**

## UI (`LayerPanel` 스타일 편집 팝업)

분류 레이어(`isClassified`)일 때 폴리곤 섹션(`LayerPanel.js:627-659`)이 바뀐다:

| 섹션 | 처리 |
|------|------|
| 면 색상 | **숨김** + 안내 문구 "면 색상은 분류 설정이 결정합니다" |
| 면 불투명도 | 유지 |
| **테두리를 분류색에 동기화** | **신규 체크박스**, 선 색상 바로 위 |
| 선 색상 | 유지. 체크 ON이면 비활성(회색) |
| 선 두께 | 유지 |
| 선 스타일 | 유지 (이제 실제로 동작) |

면 색상을 숨기는 근거는 분류가 그 색을 소유한다는 것이다. 지금 단계구분도에선
눌러도 아무 일이 없고(죽은 컨트롤), 카토그램에선 분류를 파괴한다.
래스터 분기가 이미 같은 방식으로 안내 문구를 쓴다(`LayerPanel.js:624`).

체크박스를 토글하면 `layerInfo.strokeSyncToFill`을 설정하고
`layerManager.updateLayerStyle(layerId)`를 부른 뒤, 선 색상 섹션의 비활성 상태를 갱신한다.

## 기존 동작 변화

1. **카토그램 테두리**: `#333` → 분류색 어둡게 (기본 ON 선택의 결과)
2. **카토그램 채우기 투명도**: 하드코딩 `0.85` → `layerInfo.fillOpacity` 반영.
   새로 만드는 카토그램은 생성 시 0.85를 심으므로 그대로다. 그러나
   **기존 저장 프로젝트는 저장된 값(`addLayer` 기본 0.3)으로 열려 더 투명해진다.**
   슬라이더로 되돌릴 수 있다. 패널이 줄곧 0.3이라고 표시해 왔으므로 표시와 실제가
   일치하게 되는 셈이지만, 눈에 띄는 변화다.
3. **단계구분도 면 색상 컨트롤 사라짐** — 원래 동작하지 않던 컨트롤이다.
4. **카토그램에서 색을 바꿔도 분류가 안 깨진다** — 버그 수정.
5. **선 스타일이 두 도구에서 동작하기 시작한다** — 기존 저장본의 `strokeDash`가
   `solid`가 아니면 모양이 바뀔 수 있다. 기본값이 `solid`라 대부분 영향 없다.

## 테스트 (jsdom + vitest)

기존 패턴(`AutoSaveManager.restore.test.js`)을 따른다.

**`LayerManager` 스타일 계산**
- 동기화 ON(기본) → 단계구분도 stroke = `darkenColor(분류색)`
- 동기화 OFF + `strokeColor` 지정 → stroke = 그 색
- `strokeSyncToFill`이 `undefined`여도 ON으로 동작 (기존 레이어 흡수)
- `strokeDash`가 `dashed`면 `lineDash`가 실린다

**카토그램 회귀 방지**
- `setLayerColor` 후에도 스타일이 **함수로 유지** (프로브가 잡은 버그)
- `fillOpacity` 변경이 반영된다
- 동기화 OFF + `strokeColor` → 그 색

**저장/복원 왕복**
- `strokeSyncToFill: false`가 자동저장 복원 후에도 유지 (기존 테스트 파일에 추가)
