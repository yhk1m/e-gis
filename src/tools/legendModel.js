// © 2026 김용현
/**
 * legendModel - 레이어 정보를 범례 데이터로 옮기는 순수 모듈
 *
 * OpenLayers·DOM에 의존하지 않는다. "무엇을 어떤 기호로 그릴지"만 정하고,
 * 실제 그리기는 ExportTool.drawLegend가 맡는다. 덕분에 분류 로직을 DOM 없이
 * 단위 테스트할 수 있고, 미리보기와 내보내기가 같은 모델을 공유한다.
 */

/**
 * 숫자 포맷
 * - 'comma'   : 1,234,567 (정수로 반올림 후 천 단위 구분)
 * - 'short'   : 1.2K / 1.5M
 * - 'decimal2': 1,234.56 (항상 소수점 2자리)
 *
 * 지도 위 주제도 범례(ChoroplethTool)와 내보내기 범례가 이 함수를 공유한다.
 * 규칙이 갈라지면 같은 지도에서 두 범례의 숫자가 달라 보인다.
 */
export function formatNumber(num, format = 'comma', rounding = 0) {
  let n = Number(num);
  if (rounding && rounding > 0) {
    n = Math.round(n / rounding) * rounding;
  }
  if (format === 'short') {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2);
  }
  if (format === 'decimal2') {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // 'comma' — 항상 정수로 반올림
  return Math.round(n).toLocaleString();
}

/** 범례 기호로 요약할 수 없는 레이어 종류 (자체 범례를 지도 위에 띄운다) */
const UNSUMMARIZABLE_TYPES = ['raster', 'heatmap', 'chartmap'];

/**
 * 색을 어둡게 (각 채널 -40).
 *
 * 분류 레이어의 테두리 색 규칙이라 지도(LayerManager.updateLayerStyle)와 같아야 한다.
 * ChoroplethTool.darkenColor와 같은 계산 — 그쪽은 OpenLayers를 끌고 오므로
 * 순수 모듈에서 import하지 않고 여기 둔다.
 */
function darkenColor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const ch = (i) => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - 40)
    .toString(16).padStart(2, '0');
  return '#' + ch(1) + ch(3) + ch(5);
}

/**
 * 도형 종류 → 기호 모양. Multi- 접두는 단일과 같게 본다.
 */
function symbolKind(geometryType) {
  const t = String(geometryType || '').replace(/^Multi/, '');
  if (t === 'Point') return 'point';
  if (t === 'LineString' || t === 'LinearRing') return 'line';
  return 'polygon';
}

/**
 * 레이어 스타일을 기호로 옮긴다.
 *
 * 분류 색(classColor)을 주면 주제도의 구간 기호가 된다. 이때 테두리는 지도와 같은 규칙을
 * 따른다 — 테두리 동기화가 켜져 있으면(기본) 구간 색을 어둡게 한 색, 꺼져 있으면 레이어의
 * 테두리 색. 지도(LayerManager.updateLayerStyle)가 그렇게 그리므로 범례도 같아야 한다.
 */
function makeSymbol(layerInfo, classColor) {
  const fillColor = classColor || layerInfo.fillColor || layerInfo.color;
  // undefined(기존 레이어·기존 저장본)를 기본 ON으로 흡수한다 — 지도와 같은 판정
  const syncStroke = layerInfo.strokeSyncToFill !== false;

  return {
    kind: symbolKind(layerInfo.geometryType),
    fillColor,
    fillOpacity: layerInfo.fillOpacity,
    strokeColor: classColor && syncStroke
      ? darkenColor(classColor)
      : (layerInfo.strokeColor || layerInfo.color),
    strokeOpacity: layerInfo.strokeOpacity,
    strokeWidth: layerInfo.strokeWidth,
    strokeDash: layerInfo.strokeDash,
    pointRadius: layerInfo.pointRadius
  };
}

/**
 * 분류 설정을 꺼낸다.
 *
 * 카토그램은 type이 'cartogram'이 아니라 'vector'라(CartogramTool.js:205) type만
 * 봐서는 못 잡는다. LayerManager.isClassified와 같이 설정 객체의 존재로 식별한다.
 */
function classifiedConfig(layerInfo) {
  return layerInfo._choroplethConfig || layerInfo._cartogramConfig || null;
}

/**
 * 분류 레이어 → 구간마다 한 항목.
 * breaks는 경계값이라 구간 수는 breaks.length - 1이다.
 */
function classifiedItems(layerInfo, config) {
  const { breaks, colors = [], unit = '', format = 'comma', rounding = 0 } = config;
  const items = [];

  for (let i = 0; i < breaks.length - 1; i++) {
    const min = formatNumber(breaks[i], format, rounding);
    const max = formatNumber(breaks[i + 1], format, rounding);
    items.push({
      label: `${min} - ${max}${unit ? ' ' + unit : ''}`,
      symbol: makeSymbol(layerInfo, colors[i])
    });
  }

  return items;
}

/**
 * 레이어 하나를 범례 모델로 옮긴다.
 *
 * @param {Object} layerInfo - LayerManager의 layerInfo
 * @returns {{layerId: string, title: string, grouped: boolean,
 *            items: Array<{label: string, symbol: Object}>} | null}
 *   범례로 요약할 수 없는 레이어면 null.
 *
 * grouped가 true면 제목 줄 아래 구간 항목을 들여쓰고, false면 기호 옆에 이름을
 * 한 줄로 붙인다 (항목이 하나뿐인 레이어에서 제목과 라벨이 겹치지 않게).
 */
export function buildLegendModel(layerInfo) {
  if (!layerInfo) return null;
  if (UNSUMMARIZABLE_TYPES.includes(layerInfo.type)) return null;
  if (layerInfo._heatmapConfig || layerInfo._chartMapConfig) return null;

  const config = classifiedConfig(layerInfo);

  if (config && Array.isArray(config.breaks)) {
    const items = classifiedItems(layerInfo, config);
    // 구간이 하나도 안 나오는 설정(breaks가 1개 이하)은 범례로 쓸 수 없다.
    if (items.length === 0) return null;

    return {
      layerId: layerInfo.id,
      title: config.title || layerInfo.name,
      grouped: true,
      items
    };
  }

  return {
    layerId: layerInfo.id,
    title: layerInfo.name,
    grouped: false,
    items: [{ label: layerInfo.name, symbol: makeSymbol(layerInfo) }]
  };
}
