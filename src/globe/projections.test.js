// © 2026 김용현
/**
 * 투영법 목록과 맞춤.
 * - 6종, 키는 드롭다운 value 라 안정적이어야 한다.
 * - make() 는 구 전체가 여백 20px 안에 들어오게 맞춘 d3 투영을 준다.
 * - rotate 를 주면 그 경위도가 화면 가운데에 온다.
 */
import { describe, it, expect } from 'vitest';
import { PROJECTIONS, DEFAULT_PROJECTION, FIT_PAD, findProjection, make, fitScale } from './projections.js';

describe('PROJECTIONS', () => {
  it('6종이고 키·이름·종류가 있다', () => {
    expect(PROJECTIONS.map((p) => p.key)).toEqual([
      'orthographic', 'mercator', 'equalEarth', 'naturalEarth', 'azimuthalEqualArea', 'equirectangular'
    ]);
    for (const p of PROJECTIONS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(['azimuthal', 'cylindrical']).toContain(p.kind);
      expect(typeof p.factory).toBe('function');
    }
  });

  it('정사영·방위 등면적만 azimuthal 이다', () => {
    const kinds = Object.fromEntries(PROJECTIONS.map((p) => [p.key, p.kind]));
    expect(kinds.orthographic).toBe('azimuthal');
    expect(kinds.azimuthalEqualArea).toBe('azimuthal');
    expect(kinds.mercator).toBe('cylindrical');
    expect(kinds.equalEarth).toBe('cylindrical');
  });

  it('모르는 키는 기본(정사영)으로 간다', () => {
    expect(findProjection('nope').key).toBe(DEFAULT_PROJECTION);
    expect(DEFAULT_PROJECTION).toBe('orthographic');
  });
});

describe('make · fitScale', () => {
  it('정사영은 짧은 변 - 여백 의 절반이 반지름이다', () => {
    const p = make('orthographic', 800, 600);
    expect(p.scale()).toBeCloseTo((600 - 2 * FIT_PAD) / 2, 6);
    expect(p.translate()).toEqual([400, 300]);
    expect(fitScale('orthographic', 800, 600)).toBeCloseTo(280, 6);
  });

  it('원통 투영도 구 전체가 화면 안에 들어온다', () => {
    const p = make('mercator', 800, 600);
    const [x, y] = p([0, 0]);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
    expect(p.scale()).toBeGreaterThan(0);
  });

  it('rotate 를 주면 그 경위도가 가운데에 온다', () => {
    const p = make('orthographic', 800, 600, { rotate: [-127, -37, 0] });
    const [x, y] = p([127, 37]);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it('scale 을 주면 맞춤 배율 대신 그 배율을 쓰되 가운데는 그대로다', () => {
    const p = make('orthographic', 800, 600, { scale: 560 });
    expect(p.scale()).toBe(560);
    expect(p.translate()).toEqual([400, 300]);
  });

  it('inset 을 주면 그만큼 뺀 상자에 맞춘다 (글래스 막대·패널 밑으로 들어가지 않게)', () => {
    const plain = make('orthographic', 800, 600);
    const p = make('orthographic', 800, 600, { inset: { top: 100 } });
    expect(p.translate()[1]).toBeCloseTo(plain.translate()[1] + 50, 6);
    expect(p.translate()[0]).toBeCloseTo(400, 6);
    expect(p.scale()).toBeLessThan(plain.scale());
    expect(p.scale()).toBeCloseTo((600 - 100 - 2 * FIT_PAD) / 2, 6);
    const left = make('orthographic', 800, 600, { inset: { left: 200 } });
    expect(left.translate()[0]).toBeCloseTo(500, 6);
    expect(fitScale('orthographic', 800, 600, { top: 100 })).toBeCloseTo(p.scale(), 6);
  });

  it('inset 의 음수·NaN 은 0 으로 본다', () => {
    const p = make('orthographic', 800, 600, { inset: { top: -50, left: NaN } });
    expect(p.translate()).toEqual([400, 300]);
  });

  it('여백보다 작은 캔버스에서도 맞춤 배율은 양수다', () => {
    for (const { key } of PROJECTIONS) {
      const s = fitScale(key, 1, 1);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });
});
