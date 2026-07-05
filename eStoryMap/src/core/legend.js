// © 2026 김용현
// eStoryMap/src/core/legend.js
// 범례 순수 로직 — 문서/페이지에서 범례 항목 도출 + 위치 클램프. OL·DOM 의존 없음(테스트 대상).
// 항목 렌더(스와치/DEM 램프 바)와 드래그는 editor/Legend.js.
import { parseEgisDoc } from './egisParse.js';

/** 범례 기본값(구버전 .esm 호환: meta.legend 없으면 이 값). pos는 정규화 좌상단(0~1). */
export const DEFAULT_LEGEND = { visible: true, pos: { x: 0.02, y: 0.04 }, overrides: {} };

/** 정규화 위치를 [0,1]로 클램프. */
export function clampLegendPos(x, y) {
  const c = (v) => Math.max(0, Math.min(1, Number(v)));
  return { x: c(x), y: c(y) };
}

/**
 * 현재 페이지의 보이는 레이어들 → 범례 항목 배열.
 * 레이어 메타는 소스 egis를 정규화(parseEgisDoc)해 조회. override(label) 적용.
 * hidden은 제외하지 않고 플래그로 실어 보낸다(편집기는 흐리게 표시해 되켜기 가능, 발표는 필터).
 * @returns {{key:string, label:string, kind:'swatch'|'ramp', color:string, hidden:boolean}[]}
 */
export function buildLegendItems(doc, page) {
  if (!page) return [];
  const overrides = (doc.meta.legend && doc.meta.legend.overrides) || {};
  const layerIndex = new Map(); // sourceId → Map(layerId → 정규화 레이어)
  const items = [];

  for (const entry of page.layerVisibility) {
    if (!entry.visible) continue;
    let idx = layerIndex.get(entry.sourceId);
    if (!idx) {
      idx = new Map();
      const source = doc.sources.find((s) => s.sourceId === entry.sourceId);
      if (source) {
        try {
          for (const l of parseEgisDoc(source.egis).layers) idx.set(l.id, l);
        } catch { /* 손상 소스 스킵 */ }
      }
      layerIndex.set(entry.sourceId, idx);
    }
    const layer = idx.get(entry.layerId);
    if (!layer) continue; // 조회 실패(고아 가시성) 방어

    const key = `${entry.sourceId}:${entry.layerId}`;
    const ov = overrides[key] || {};
    items.push({
      key,
      label: ov.label != null ? ov.label : layer.name,
      kind: layer.type === 'raster' ? 'ramp' : 'swatch',
      color: layer.color,
      hidden: !!ov.hidden,
    });
  }
  return items;
}
