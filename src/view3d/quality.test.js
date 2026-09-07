// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { qualityFor, DESKTOP, TABLET, PHONE } from './quality.js';

describe('qualityFor', () => {
  it('넓은 화면에 마우스면 데스크톱 등급이다', () => {
    const q = qualityFor({ width: 1920, coarsePointer: false, devicePixelRatio: 1 });
    expect(q.name).toBe('desktop');
    expect(q.maxGrid).toBe(DESKTOP.maxGrid);
  });

  it('아이패드 가로(1024)는 태블릿 등급이다', () => {
    expect(qualityFor({ width: 1024, coarsePointer: true }).name).toBe('tablet');
  });

  it('터치 디바이스는 1366px까지 태블릿으로 본다', () => {
    expect(qualityFor({ width: 1280, coarsePointer: true }).name).toBe('tablet');
    // 같은 폭이라도 마우스면 데스크톱이다
    expect(qualityFor({ width: 1280, coarsePointer: false }).name).toBe('desktop');
  });

  it('휴대폰 폭은 가장 낮은 등급이다', () => {
    const q = qualityFor({ width: 390, coarsePointer: true });
    expect(q.name).toBe('phone');
    expect(q.maxGrid).toBe(PHONE.maxGrid);
    expect(q.maxTexture).toBe(PHONE.maxTexture);
  });

  it('등급이 낮아질수록 격자와 텍스처가 작아진다', () => {
    expect(DESKTOP.maxGrid).toBeGreaterThan(TABLET.maxGrid);
    expect(TABLET.maxGrid).toBeGreaterThan(PHONE.maxGrid);
    expect(DESKTOP.maxTexture).toBeGreaterThan(TABLET.maxTexture);
    expect(TABLET.maxTexture).toBeGreaterThan(PHONE.maxTexture);
  });

  it('픽셀비는 등급 상한까지만 쓴다', () => {
    // 아이패드는 픽셀비 2지만 태블릿 상한 1.5로 묶는다
    expect(qualityFor({ width: 1024, coarsePointer: true, devicePixelRatio: 2 }).pixelRatio).toBe(1.5);
    // 상한보다 낮으면 그대로 쓴다
    expect(qualityFor({ width: 1920, devicePixelRatio: 1 }).pixelRatio).toBe(1);
    expect(qualityFor({ width: 1920, devicePixelRatio: 3 }).pixelRatio).toBe(2);
  });
});
