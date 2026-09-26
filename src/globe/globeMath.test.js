// © 2026 김용현
/**
 * 지구본 조작 수학. d3 를 모른다.
 * - 회전 [λ, φ] 와 화면 가운데 경위도는 부호가 반대다 (d3 규약).
 * - 드래그 감도는 75/scale 도/px. azimuthal 은 두 축, cylindrical 은 λ 만.
 * - φ 는 ±90 을 넘지 않는다. 배율은 [0.5×fit, 8×fit].
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeLon, rotationFromCenter, centerFromRotation, rotationAfterDrag,
  clampScale, scaleAfterWheel, DRAG_DEG_PER_PX, MIN_ZOOM, MAX_ZOOM
} from './globeMath.js';

describe('normalizeLon', () => {
  it('-180~180 으로 접는다', () => {
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(540)).toBe(-180);   // 540 → 180 은 경계라 -180 으로 접힌다
    expect(normalizeLon(45)).toBe(45);
  });
});

describe('rotationFromCenter · centerFromRotation', () => {
  it('서로 역함수다', () => {
    expect(rotationFromCenter([127, 37])).toEqual([-127, -37, 0]);
    expect(centerFromRotation([-127, -37, 0])).toEqual([127, 37]);
  });

  it('centerFromRotation 은 경도를 접고 위도를 ±90 으로 제한한다', () => {
    const [lon, lat] = centerFromRotation([-200, 95, 0]);
    expect(lon).toBe(-160);
    expect(lat).toBe(-90);
  });
});

describe('rotationAfterDrag', () => {
  it('감도는 scale 에 반비례한다 (scale 75 → 1도/px)', () => {
    expect(DRAG_DEG_PER_PX).toBe(75);
    expect(rotationAfterDrag([0, 0, 0], 10, 0, 75, 'azimuthal')).toEqual([10, 0, 0]);
    expect(rotationAfterDrag([0, 0, 0], 10, 0, 150, 'azimuthal')).toEqual([5, 0, 0]);
  });

  it('아래로 끌면 북쪽이 가운데로 온다 (φ 감소)', () => {
    const [, phi] = rotationAfterDrag([0, 0, 0], 0, 10, 75, 'azimuthal');
    expect(phi).toBe(-10);
    expect(centerFromRotation([0, phi, 0])[1]).toBe(10);
  });

  it('φ 는 ±90 에서 멈춘다', () => {
    expect(rotationAfterDrag([0, -85, 0], 0, 100, 75, 'azimuthal')[1]).toBe(-90);
    expect(rotationAfterDrag([0, 85, 0], 0, -100, 75, 'azimuthal')[1]).toBe(90);
  });

  it('cylindrical 은 λ 만 바뀐다', () => {
    expect(rotationAfterDrag([0, 0, 0], 10, 10, 75, 'cylindrical')).toEqual([10, 0, 0]);
  });

  it('λ 는 접히고 γ 는 유지된다', () => {
    expect(rotationAfterDrag([175, 0, 3], 10, 0, 75, 'azimuthal')).toEqual([-175, 0, 3]);
  });

  it('배율이 0 이하·NaN 이거나 이동량이 유한하지 않으면 회전을 그대로 둔다 (NaN 이 퍼지지 않게)', () => {
    const rot = [10, 20, 0];
    expect(rotationAfterDrag(rot, 10, 10, 0, 'azimuthal')).toEqual(rot);
    expect(rotationAfterDrag(rot, 10, 10, -5, 'azimuthal')).toEqual(rot);
    expect(rotationAfterDrag(rot, 10, 10, NaN, 'azimuthal')).toEqual(rot);
    expect(rotationAfterDrag(rot, NaN, 0, 75, 'azimuthal')).toEqual(rot);
    expect(rotationAfterDrag(rot, 0, Infinity, 75, 'azimuthal')).toEqual(rot);
  });
});

describe('clampScale · scaleAfterWheel', () => {
  it('[0.5×fit, 8×fit] 로 제한한다', () => {
    expect(MIN_ZOOM).toBe(0.5);
    expect(MAX_ZOOM).toBe(8);
    expect(clampScale(10, 100)).toBe(50);
    expect(clampScale(5000, 100)).toBe(800);
    expect(clampScale(300, 100)).toBe(300);
  });

  it('휠을 위로(deltaY<0) 굴리면 커지고 아래로 굴리면 작아진다', () => {
    const up = scaleAfterWheel(100, -100, 100);
    const down = scaleAfterWheel(100, 100, 100);
    expect(up).toBeGreaterThan(100);
    expect(down).toBeLessThan(100);
    expect(up * down).toBeCloseTo(100 * 100, 6);   // 대칭
    expect(scaleAfterWheel(790, -10000, 100)).toBe(800);
  });
});
