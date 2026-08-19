// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { BASEMAPS, REFERENCE_LABELS } from './MapManager.js';

// 배경 타일을 crossOrigin 없이 받으면 지도 캔버스가 오염돼(tainted canvas)
// 지도 내보내기의 canvas.toDataURL() 이 SecurityError 로 막힌다.
// 위성 · 위성+라벨에서 실제로 내보내기가 통째로 실패했던 회귀를 잠근다.
describe('배경 타일 crossOrigin', () => {
  const sources = [
    ...Object.entries(BASEMAPS),
    ['REFERENCE_LABELS', REFERENCE_LABELS]
  ];

  it.each(sources)('%s 소스는 익명 CORS 로 타일을 받는다', (key, def) => {
    expect(def.source().crossOrigin).toBe('anonymous');
  });
});
