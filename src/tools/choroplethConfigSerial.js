// © 2026 김용현
/**
 * 단계구분도 설정(_choroplethConfig)의 저장·복사 규약.
 *
 * 자동 저장(StateManager.saveLayer)·.egis(ProjectManager.serialize)·레이어 복제
 * (LayerManager.duplicateLayer)가 모두 여기를 거친다. tool 참조는 싣지 않는다.
 * 복원(AutoSaveManager.restoreLayer · ProjectManager.deserialize)은 restoreChoroplethConfig 로
 * `{ ...saved, tool }` 를 펼치므로 여기 실린 키가 그대로 돌아온다.
 * timeSeries(실험실 4단계)는 fills 와 같은 자리에서, 시계열일 때만 실린다.
 */
import { timeSeriesRecord, normalizeTimeSeries } from './timeSeriesModel.js';

function hasRealFill(fills) {
  return Array.isArray(fills) && fills.some((f) => f && f.kind && f.kind !== 'solid');
}

/** fills 배열의 깊은 복사. 빈 자리는 단색으로. */
export function cloneFills(fills) {
  return fills.map((f) => (f ? { ...f } : { kind: 'solid' }));
}

/**
 * 저장용 평문 객체. fills 는 실제 채움이 하나라도 있을 때만 싣는다.
 * @returns {Object|null}
 */
export function serializeChoroplethConfig(cfg) {
  if (!cfg) return null;
  const out = {
    attribute: cfg.attribute,
    breaks: cfg.breaks,
    colors: cfg.colors,
    title: cfg.title,
    unit: cfg.unit,
    format: cfg.format,
    rounding: cfg.rounding,
    controlsHidden: cfg.controlsHidden
  };
  if (hasRealFill(cfg.fills)) out.fills = cloneFills(cfg.fills);
  const ts = timeSeriesRecord(cfg.timeSeries);
  if (ts) out.timeSeries = ts;
  return out;
}

/** 복제용 — 얕은 복사에 fills·timeSeries 만 깊게. tool 은 같은 참조를 둔다. */
export function cloneChoroplethConfig(cfg) {
  const copy = { ...cfg };
  if (Array.isArray(cfg.fills)) copy.fills = cloneFills(cfg.fills);
  // 얕은 복사는 배열을 공유한다 — 복제본의 연도를 넘기면 원본도 따라 움직인다
  if (cfg.timeSeries) {
    copy.timeSeries = {
      fields: Array.isArray(cfg.timeSeries.fields) ? cfg.timeSeries.fields.slice() : cfg.timeSeries.fields,
      index: cfg.timeSeries.index
    };
  }
  return copy;
}

/**
 * 복원용 — 저장본을 펼치고 tool 을 단다. timeSeries 는 저장본이 지저분해도
 * 정돈된 값만 붙이고, 망가졌거나 없으면 떼어 정적 단계구분도로 선다.
 */
export function restoreChoroplethConfig(saved, tool) {
  const cfg = { ...saved, tool };
  const ts = normalizeTimeSeries(saved.timeSeries);
  if (ts) cfg.timeSeries = ts;
  else delete cfg.timeSeries;
  return cfg;
}
