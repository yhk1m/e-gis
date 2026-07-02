// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { decodeRasterMeta } from './rasterDecode.js';

// Float32Array [0,100,200,300, 150,250,350,450, 400,500,600,700]
const F32_B64 = 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E';

describe('decodeRasterMeta', () => {
  it('base64 인코딩을 dtype에 맞는 TypedArray로 복원한다', () => {
    const out = decodeRasterMeta({
      data: { __encoding: 'base64', dtype: 'Float32Array', base64: F32_B64 },
      width: 4, height: 3,
    });
    expect(out.data).toBeInstanceOf(Float32Array);
    expect(Array.from(out.data)).toEqual([0, 100, 200, 300, 150, 250, 350, 450, 400, 500, 600, 700]);
  });

  it('Int16Array 등 다른 dtype도 복원한다', () => {
    // Int16Array [1, 2, 3]
    const out = decodeRasterMeta({ data: { __encoding: 'base64', dtype: 'Int16Array', base64: 'AQACAAMA' } });
    expect(out.data).toBeInstanceOf(Int16Array);
    expect(Array.from(out.data)).toEqual([1, 2, 3]);
  });

  it('알 수 없는 dtype은 Float32Array로 폴백한다', () => {
    const out = decodeRasterMeta({ data: { __encoding: 'base64', dtype: 'WeirdArray', base64: F32_B64 } });
    expect(out.data).toBeInstanceOf(Float32Array);
  });

  it("__encoding 'array'는 values 배열을 그대로 쓴다", () => {
    const out = decodeRasterMeta({ data: { __encoding: 'array', dtype: 'Array', values: [1, 2, 3] } });
    expect(out.data).toEqual([1, 2, 3]);
  });

  it('메타필드는 보존하고 원본 객체는 변경하지 않는다', () => {
    const encoded = {
      data: { __encoding: 'array', values: [1] },
      extent: [0, 0, 1, 1], colorScheme: 'slope', minVal: 0,
    };
    const out = decodeRasterMeta(encoded);
    expect(out.extent).toEqual([0, 0, 1, 1]);
    expect(out.colorScheme).toBe('slope');
    expect(encoded.data.__encoding).toBe('array'); // 원본 불변
    expect(out).not.toBe(encoded);
  });
});
