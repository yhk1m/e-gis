// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { parseVersion, isNewerVersion } from './version.js';

describe('parseVersion', () => {
  it('v 접두사 제거 + 숫자 배열', () => {
    expect(parseVersion('v0.1.2')).toEqual([0, 1, 2]);
    expect(parseVersion('1.0')).toEqual([1, 0]);
    expect(parseVersion('0.1.1-beta')).toEqual([0, 1, 1]); // prerelease 접미사 무시
    expect(parseVersion('')).toEqual([0]);
  });
});

describe('isNewerVersion', () => {
  it('상위 버전이면 true (v 접두사 무시)', () => {
    expect(isNewerVersion('v0.1.1', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });
  it('같거나 낮으면 false', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(false);
    expect(isNewerVersion('v0.1.0', '0.1.0')).toBe(false);
  });
  it('자리수가 달라도 비교', () => {
    expect(isNewerVersion('0.1.0.1', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.1', '0.1.0')).toBe(false);
  });
});
