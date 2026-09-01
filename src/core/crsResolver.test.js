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
