// © 2026 김용현
/**
 * featureInfoModel - 선택한 피처를 속성 카드가 그릴 수 있는 형태로 바꾼다.
 *
 * DOM 과 OpenLayers 에 기대지 않는 순수 로직이라 여기서 단위 테스트한다.
 * (legendModel.js 와 같은 분리 방식)
 */

// 라벨 필드가 없을 때 제목으로 쓸 이름 후보. 앞에 있는 것부터 찾는다.
const NAME_FIELD_CANDIDATES = [
  'name', 'NAME', 'Name', '이름', '명칭', '지명', 'title',
  '시도명', '시군구명', '읍면동명', 'adm_nm', 'SIG_KOR_NM'
];

/**
 * @param {Array} features - 선택된 피처 (선택 순서)
 * @param {{findLayer:Function, getLabelField:Function}} deps
 * @returns {Array<{key:string, title:string, layerName:string, attributes:Array<{name:string,value:string}>}>}
 */
export function buildFeatureInfoSections(features, deps = {}) {
  const findLayer = deps.findLayer || (() => null);
  const getLabelField = deps.getLabelField || (() => null);

  return (features || []).map((feature, index) => {
    const entries = rawEntries(feature);
    const layer = findLayer(feature) || null;
    const labelField = layer ? getLabelField(layer.id) : null;

    return {
      key: featureKey(feature, index),
      title: pickTitle(entries, labelField, index),
      layerName: layer && layer.name ? layer.name : '',
      attributes: entries.map((e) => ({ name: e.name, value: displayValue(e.raw) }))
    };
  });
}

/** 도형을 뺀 속성 목록 (원본 값 그대로) */
function rawEntries(feature) {
  const props = feature && typeof feature.getProperties === 'function'
    ? feature.getProperties()
    : {};

  return Object.keys(props)
    .filter((name) => name !== 'geometry')
    .filter((name) => !isGeometryValue(props[name]))
    .map((name) => ({ name, raw: props[name] }));
}

// geometryName 을 바꾼 레이어에서는 도형이 'geometry' 가 아닌 이름으로 들어온다.
function isGeometryValue(value) {
  return !!value && typeof value === 'object' && typeof value.getType === 'function';
}

function displayValue(raw) {
  if (raw === null || raw === undefined) return '-';
  const text = String(raw).trim();
  return text === '' ? '-' : text;
}

function pickTitle(entries, labelField, index) {
  const valueOf = (name) => {
    const hit = entries.find((e) => e.name === name);
    if (!hit) return null;
    const text = displayValue(hit.raw);
    return text === '-' ? null : text;
  };

  if (labelField) {
    const byLabel = valueOf(labelField);
    if (byLabel) return byLabel;
  }

  for (const candidate of NAME_FIELD_CANDIDATES) {
    const byName = valueOf(candidate);
    if (byName) return byName;
  }

  const firstText = entries.find((e) => typeof e.raw === 'string' && e.raw.trim() !== '');
  if (firstText) return firstText.raw.trim();

  return `피처 ${index + 1}`;
}

function featureKey(feature, index) {
  if (feature && feature.ol_uid !== undefined && feature.ol_uid !== null) {
    return String(feature.ol_uid);
  }
  if (feature && typeof feature.getId === 'function' && feature.getId() !== undefined) {
    return String(feature.getId());
  }
  return `idx-${index}`;
}
