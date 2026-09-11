# flowmap.gl 확인 (2026-09-11)

목적: 2차(줌별 군집)에서 deck.gl + @flowmap.gl/layers 로 갈아탈 수 있는지만 본다. 제품 코드와 무관.
페이지: `docs/spikes/flowmap-gl-check.html` (배포 안 함). 관찰 환경: Playwright 헤드리스 Chromium(chromium-1234) + SwiftShader(WebGL 2), 1000×700, dev 서버(:3000)에서 `시도간_인구이동_예시.json`(locations 16, flows 240) 수신.

## 먼저 확인한 사실 (npm registry, 2026-09-11)

| 항목 | 값 |
|---|---|
| `@flowmap.gl/layers` dist-tags | `latest: 9.4.0`, `next: 8.0.0-alpha.27` (정식 8.x 는 8.0.1~8.0.3, 9.x 는 9.0.0~9.4.0) |
| 9.4.0 peerDependencies | `@deck.gl/core ^9.0.0`, `@deck.gl/layers ^9.0.0`, `@luma.gl/core ^9.0.0`, `@luma.gl/engine ^9.0.0`, `@luma.gl/shadertools ^9.0.0` |
| 9.4.0 dependencies | `@flowmap.gl/data ^9.4.0` → d3-array/color/geo/interpolate/scale/scale-chromatic/time/time-format, kdbush, reselect, seedrandom |
| 8.0.3 peerDependencies | `@deck.gl/core ^8.6.5`, `@deck.gl/layers ^8.6.5`, `@luma.gl/core ^8.5.10`, `@luma.gl/constants ^8.5.10` |
| 배포 파일 (tarball 목록) | 8.0.3 / 9.4.0 모두 `dist/index.js` 등 ESM(`"type":"module"`, main=module=dist/index.js)과 `.d.ts` 뿐. **UMD/IIFE 브라우저 번들 없음.** |
| `deck.gl` latest | 9.4.0 (`dist.min.js` UMD 있음, 전역 `deck`). 8.9 계열 최신 8.9.36 |
| `@luma.gl/core` latest | 9.4.1 |

→ 계획서의 조합 "deck.gl 9 + @flowmap.gl/layers 8" 은 peer 가 맞지 않고(8.x 는 deck 8 전용), `@flowmap.gl/layers@8/dist/index.umd.js` 는 존재하지 않는다. 실제 비교 대상은 **deck.gl 9 + flowmap.gl 9.4.0** 과 **deck.gl 8.9 + flowmap.gl 8.0.3** 이다.

## 시도한 URL 과 결과

| URL | 결과 |
|---|---|
| `https://cdn.jsdelivr.net/npm/deck.gl@9/dist.min.js` | 200 (UMD 2,073,497 B / gzip 575,653 B). 단독으론 뜸 |
| `https://cdn.jsdelivr.net/npm/@flowmap.gl/layers@8/dist/index.umd.js` (계획서) | **404** |
| `https://cdn.jsdelivr.net/npm/@flowmap.gl/layers@9/dist/index.umd.js` | **404** |
| `https://cdn.jsdelivr.net/npm/@flowmap.gl/layers@9.4.0/+esm` | 200 이지만 evaluate 실패 (아래 A) |
| `https://cdn.jsdelivr.net/npm/@deck.gl/core@9.3.4/+esm` + `@deck.gl/layers@9.3.4/+esm` | 200 이지만 evaluate 실패 (아래 A) |
| `https://cdn.jsdelivr.net/npm/@deck.gl/core@9.4.0/+esm` + `@deck.gl/layers@9.4.0/+esm` | 200, deck 단독 로딩 OK. flowmap 과 합치면 실패 (아래 A′) |
| `https://esm.sh/@deck.gl/core@9.4.0?deps=@luma.gl/core@9.4.0,@luma.gl/engine@9.4.0,@luma.gl/shadertools@9.4.0` | 200, **뜸** (아래 B) |
| `https://esm.sh/@deck.gl/layers@9.4.0?deps=@deck.gl/core@9.4.0,@luma.gl/core@9.4.0,@luma.gl/engine@9.4.0,@luma.gl/shadertools@9.4.0` | 200, 뜸 |
| `https://esm.sh/@flowmap.gl/layers@9.4.0?deps=@deck.gl/core@9.4.0,@deck.gl/layers@9.4.0,@luma.gl/core@9.4.0,@luma.gl/engine@9.4.0,@luma.gl/shadertools@9.4.0` | 200, 뜸 |
| `https://cdn.jsdelivr.net/npm/deck.gl@8.9/dist.min.js` | 200 (8.9.36, gzip 399,169 B), 전역 `deck` 생김 |
| `https://cdn.jsdelivr.net/npm/@flowmap.gl/layers@8.0.3/+esm` | 200 이지만 evaluate 실패 (아래 C) |

**A. jsdelivr `/+esm` (deck 9.3.4 + flowmap 9.4.0)** — 세 모듈 모두 import 거부. 콘솔 원문:
```
luma.gl: Found luma.gl 9.3.3 while initialzing 9.3.2
luma.gl: 'yarn why @luma.gl/core' can help identify the source of the conflict
Error: luma.gl - multiple versions detected: see console log
```
원인: jsdelivr 는 패키지마다 `+esm` 을 처음 빌드한 시점의 semver 해석을 URL 에 박아 둔다. `@flowmap.gl/layers@9.4.0/+esm` → `@deck.gl/core@9.3.4` → `@luma.gl/core@9.3.3`, `@luma.gl/engine@9.3.3` 인데 `@luma.gl/engine@9.3.3/+esm` 은 `@luma.gl/core@9.3.2` 를 import 한다. 같은 페이지에 luma.gl core 가 9.3.2 / 9.3.3 두 벌 실리고 deck.gl 의 중복 버전 가드가 던진다.

**A′. jsdelivr `/+esm` (deck 9.4.0 + flowmap 9.4.0)** — deck core/layers 는 로딩되지만 flowmap 이 `@deck.gl/core@9.3.4` 쪽을 끌고 와서 같은 오류: `luma.gl: Found luma.gl 9.4.0 while initialzing 9.3.3`.

**B. esm.sh + `?deps=`** — `?deps=` 가 하위 import 까지 전파되어(`@luma.gl/webgl@^9.4.0?deps=@luma.gl/core@9.4.0`) luma.gl 이 한 벌만 실린다. 단, deps 목록이 URL 해시(`X-…`)에 들어가므로 세 모듈이 같은 `@deck.gl/core` 인스턴스를 받으려면 각 모듈이 실제로 의존하는 것만 정확히 나열해야 한다(core 에 `@deck.gl/layers` 를 넣으면 해시가 달라져 core 가 두 벌이 된다). 페이지 로그: `instanceof core.Layer = true`.

**C. deck.gl 8.9 UMD + flowmap 8.0.3 `/+esm`** — UMD 는 223 ms 에 로딩됐지만 flowmap ESM 이 evaluate 단계에서 죽는다:
```
TypeError: Cannot read properties of undefined (reading 'prototype')
    at H (https://cdn.jsdelivr.net/npm/mjolnir.js@2.7.1/+esm:7:196)
```
`@deck.gl/core@8.9.36/+esm` 단독 import 도 같은 곳에서 죽는다(mjolnir.js 2.x 의 jsdelivr ESM 변환 문제). 설령 됐더라도 UMD 전역 `deck` 과 ESM 의 `@deck.gl/core` 사본은 다른 인스턴스라 FlowmapLayer 를 UMD Deck 에 넣을 수 없다. 즉 "8.9 로 한 번 더" 는 CDN 만으론 성립하지 않는다.

## 결과표

| 항목 | 결과 |
|---|---|
| deck.gl 9 + @flowmap.gl/layers 8 | 조합 불성립 (8.x peer 는 deck 8, UMD 파일 없음 404). 대신 **deck.gl 9.4.0 + @flowmap.gl/layers 9.4.0**: jsdelivr `/+esm` 안 뜸(A/A′ 원문), **esm.sh `?deps=` 뜸**(B) |
| deck.gl 8.9 + @flowmap.gl/layers 8 | 안 뜸 — UMD 는 뜨나 flowmap 8.0.3 ESM 이 `mjolnir.js@2.7.1/+esm` 에서 TypeError (C 원문) |
| UMD 파일 경로 | flowmap.gl 은 UMD 가 없음. 실제로 쓴 경로는 위 esm.sh 세 URL (페이지 기본값 `?cdn=esmsh`; `?cdn=jsdelivr`, `?cdn=umd89` 로 실패 재현 가능) |
| 번들 크기 (네트워크, brotli 전송량) | esm.sh 경로 144 요청 · 총 ≈ 844 KB 전송. deck 스택(@deck.gl+@luma.gl+@math.gl+@loaders.gl+@probe.gl+mjolnir) ≈ **616 KB**, flowmap 스택(@flowmap.gl/layers+data, d3-*, kdbush, reselect, seedrandom) ≈ **111 KB**. 큰 항목: @luma.gl/shadertools 111 KB, @deck.gl/core 99 KB, @luma.gl/webgl 88 KB, @deck.gl/layers 79 KB, apache-arrow 68 KB(loaders.gl 이 끌고 옴), @luma.gl/engine 59 KB. 참고로 deck.gl UMD 단독은 gzip 576 KB(9.4.0) / 399 KB(8.9.36) |
| 번들 크기 (esbuild 트리셰이킹, 제품에 실릴 값에 가까움) | `@deck.gl/core@9.4.0 + @flowmap.gl/layers@9.4.0` 를 npm 설치 후 `esbuild --bundle --minify`: raw 984 KB / **gzip 280 KB** / brotli 233 KB. deck core+layers 만: raw 780 KB / gzip 218 KB → flowmap.gl 몫은 약 +62 KB gz. npm 은 `@luma.gl/core@9.4.1` 한 벌로 dedupe 되어 CDN 의 중복 문제가 없다. 현재 eGIS `dist/assets/main-*.js` 는 gz 942 KB, 3D 청크(three) 137 KB |
| 군집(clusterLocations)·애니메이션 동작 | 둘 다 동작. `clusteringEnabled:true, clusteringAuto:true` 기본값으로 줌에 따라 자동 군집: **줌 4.5 → 원 4·선 12**, **줌 6 → 원 13·선 156**, 줌 8 → 원 16·선 168(뷰포트 밖 흐름 제외, `flowEndpointsInViewportMode:'any'`), `?cluster=0` 줌 6 → 원 16·선 240. 군집 원엔 `"경기도" and 2 others` 식 라벨(영문 고정). 애니메이션은 `flowLinesRenderingMode:'animated-straight'` 로 점선이 흐름 방향으로 이동, 10초에 387~401 프레임(SwiftShader 기준 ≈ 40 fps). `animationEnabled` 는 9.4.0 에서 deprecated(경고 원문: ``FlowmapLayer: `animationEnabled` is deprecated; use `flowLinesRenderingMode` instead.``) |
| 화면 | 그려진 픽셀 4.7~5.3 % (1000×700, alpha>0 기준). 굵은 흐름이 수도권 군집 원에서 충청·경상 쪽으로 뻗고 제주까지 가는 선도 보임 |

콘솔 경고(오류 아님): `deck: …componentName not specified` ×2, `luma.gl: layout for attribute "instancePickingColors" not present in buffer layout`, `deck: Attribute instanceColors is normalized`, 그리고 한글 라벨을 켜면 `deck: Missing character: 경 (44221)` 등 29건 — 내부 TextLayer 의 기본 characterSet 이 ASCII 라서다. `_subLayerProps: { 'location-labels': { characterSet: [...], fontFamily } }` 를 넘기면 한글 라벨이 나온다(FlowmapLayer 가 `getSubLayerProps({id:'location-labels'})` 를 쓰므로 deck 표준 경로로 덮어쓰기 가능, 확인함). `FlowmapLegendWidget` 은 widgets 에 넣었지만 화면에 안 보임(deck 위젯 CSS 미포함 탓으로 추정, 더 파지 않음). 페이지 404 하나는 favicon.

## 판단

렌더러를 deck.gl + flowmap.gl 로 바꾸는 것 자체는 **가능**하고, 2차의 핵심인 줌별 군집과 흐름 애니메이션은 라이브러리가 그냥 준다(16개 시도가 줌 4.5/6/8 에서 4/13/16 개로 묶이는 걸 확인). 다만 CDN 으론 안 되고 npm 설치 + Vite 번들이 전제이며(gz 약 280 KB, 3D 청크의 두 배 크기 지연 로딩 청크), OL 위에 deck 캔버스를 얹는 동기화 층은 우리가 써야 한다 — OL 에는 공식 deck 어댑터가 없으므로 `view.on('change')` 마다 `toLonLat(center)`, `zoom − 1`(OL 256px vs deck 512px 타일 기준), `bearing = −rotation` 을 `deck.setProps({viewState})` 로 밀어 넣고, 포인터 이벤트는 OL 이 갖되 호버/클릭 픽킹은 `deck.pickObject` 로 따로 잇고, 리사이즈·devicePixelRatio 도 맞춰야 한다. 그 외 한글 라벨(`_subLayerProps` 로 해결됨), 군집 이름 영문 고정("and N others" — 우리가 라벨을 직접 그리거나 포크), 범례 위젯 CSS, flowmap.gl 이 사실상 1인 유지보수 프로젝트라 deck 메이저 업그레이드 때마다 같이 기다려야 하는 점이 비용이다. 결론: 2차 목표가 "줌별 군집 + 애니메이션" 을 수백 개 이상의 위치에서 요구한다면 OL↔deck 동기화 층(대략 200~300줄)을 직접 쓸 가치가 있고, 시도 수준(16~17개)에서만 군집이 필요하다면 지금 OL 렌더러 위에 줌별 집계를 직접 넣는 쪽이 번들·유지보수 면에서 싸다.

## 재현

```
# dev 서버(:3000) 실행 중인 상태에서
cd docs/spikes && python -m http.server 8765
# http://localhost:8765/flowmap-gl-check.html            (esm.sh, 뜸)
# http://localhost:8765/flowmap-gl-check.html?cdn=jsdelivr (luma.gl 중복 오류)
# http://localhost:8765/flowmap-gl-check.html?cdn=umd89    (deck 8.9 UMD + flowmap 8.0.3, mjolnir TypeError)
# ?zoom=4.5 / ?cluster=0 / ?mode=curved 로 군집·모드 비교, 콘솔에서 __spikeInfo()
```
