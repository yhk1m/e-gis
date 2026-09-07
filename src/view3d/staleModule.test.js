// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { isStaleModuleError } from './staleModule.js';

describe('isStaleModuleError', () => {
  it('크롬의 청크 로드 실패를 알아본다', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://www.e-gis.kr/assets/View3DController-CyYcJFZ9.js'
    );
    expect(isStaleModuleError(error)).toBe(true);
  });

  it('파이어폭스·사파리 문구도 알아본다', () => {
    expect(isStaleModuleError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isStaleModuleError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('문자열로 와도 본다', () => {
    expect(isStaleModuleError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('다른 오류는 아니라고 한다', () => {
    expect(isStaleModuleError(new Error('WebGL context lost'))).toBe(false);
    expect(isStaleModuleError(new TypeError('x is not a function'))).toBe(false);
  });

  it('빈 값은 아니라고 한다', () => {
    expect(isStaleModuleError(null)).toBe(false);
    expect(isStaleModuleError(undefined)).toBe(false);
  });
});
