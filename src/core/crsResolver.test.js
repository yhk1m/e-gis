// © 2026 김용현
/**
 * 좌표계 확정 지점 검증.
 *
 * 확신하면 묻지 않고, 애매하면 주입된 프롬프트에 묻는다.
 * 프롬프트가 없을 때(테스트·스크립트)도 동작해야 한다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';
import { resolveSourceCrs, setCrsPrompt } from './crsResolver.js';

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

const SEOUL = [126.9784, 37.5667];
let SEOUL_5186;
beforeAll(() => {
  SEOUL_5186 = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
});

describe('resolveSourceCrs', () => {
  it('확신하면 프롬프트를 부르지 않는다', async () => {
    const prompt = vi.fn();
    setCrsPrompt(prompt);
    const r = await resolveSourceCrs({ srsId: 5186, sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('애매하면 프롬프트가 고른 값을 쓴다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5181');
    setCrsPrompt(prompt);
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5181');
    expect(prompt).toHaveBeenCalledOnce();
    // 프롬프트는 판정 결과를 첫 인자로 받는다
    expect(prompt.mock.calls[0][0].confidence).toBe('ambiguous');
  });

  it('프롬프트가 취소하면 cancelled다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.cancelled).toBe(true);
    expect(r.crs).toBeNull();
  });

  it('프롬프트가 없으면 최선의 후보로 진행한다', async () => {
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
  });

  it('프롬프트가 터져도 가져오기를 막지 않는다', async () => {
    setCrsPrompt(vi.fn().mockRejectedValue(new Error('DOM 없음')));
    const r = await resolveSourceCrs({ sampleCoords: [SEOUL_5186] });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.cancelled).toBe(false);
  });

  it('두 번째 인자(미리보기 재료)를 프롬프트에 그대로 넘긴다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    const context = { name: '학교', previewGeoJSON: { type: 'FeatureCollection', features: [] } };
    await resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, context);
    expect(prompt.mock.calls[0][1]).toBe(context);
  });
});

// CrsConfirmDialog는 창이 하나뿐이라 동시에 열리면 앞선 창이 취소(null)로 닫힌다.
// 지금은 모든 호출부가 await로 직렬 처리해 겹칠 일이 없지만, 다중 파일 가져오기를
// Promise.all로 바꾸는 순간 애매한 판정 둘이 동시에 프롬프트를 불러 먼저 들어온
// 파일이 조용히 취소되는 사고가 난다. resolveSourceCrs가 내부에서 직렬화하는지 검증한다.
describe('resolveSourceCrs — 프롬프트 직렬화', () => {
  // "지금 실행 중" 플래그로 겹침을 감지하고, 실제 호출 순서와 반환값도 함께 추적한다
  function trackingPrompt(resultsByName) {
    let running = false;
    const overlaps = [];
    const order = [];
    const fn = vi.fn(async (detection, context) => {
      if (running) overlaps.push(context.name);
      running = true;
      order.push(context.name);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running = false;
      return resultsByName[context.name];
    });
    return { fn, overlaps, order };
  }

  it('동시에 부른 프롬프트가 겹치지 않고 차례로 뜬다', async () => {
    const { fn, overlaps, order } = trackingPrompt({ A: 'EPSG:5186', B: 'EPSG:5181' });
    setCrsPrompt(fn);

    await Promise.all([
      resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, { name: 'A' }),
      resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, { name: 'B' })
    ]);

    // 겹쳤다면 overlaps에 이름이 쌓인다 — 비어 있어야 한 번에 하나만 떴다는 뜻이다
    expect(overlaps).toEqual([]);
    // 먼저 resolveSourceCrs를 부른 쪽(A)의 프롬프트가 먼저 끝나야 B가 시작된다
    expect(order).toEqual(['A', 'B']);
  });

  it('직렬화되어도 둘 다 각자 고른 값을 제대로 돌려받는다', async () => {
    const { fn } = trackingPrompt({ A: 'EPSG:5186', B: 'EPSG:5181' });
    setCrsPrompt(fn);

    const [a, b] = await Promise.all([
      resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, { name: 'A' }),
      resolveSourceCrs({ sampleCoords: [SEOUL_5186] }, { name: 'B' })
    ]);

    expect(a.crs).toBe('EPSG:5186');
    expect(b.crs).toBe('EPSG:5181');
    expect(a.cancelled).toBe(false);
    expect(b.cancelled).toBe(false);
  });
});
