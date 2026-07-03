// © 2026 김용현
// eStoryMap/src/core/rasterDecode.js
// .egis 래스터 밴드(base64/array) → TypedArray 복원 — 순수 함수.
// 이식 원본: e-GIS src/core/ProjectManager.js decodeRasterMeta.

const TYPED_ARRAY_CTORS = {
  Int8Array, Uint8Array, Uint8ClampedArray,
  Int16Array, Uint16Array, Int32Array, Uint32Array,
  Float32Array, Float64Array,
};

/**
 * encodeRasterMeta로 직렬화된 래스터 객체를 demData/analysisData 형태로 복원한다.
 * data에 __encoding이 없으면(이미 디코딩된 경우) 그대로 둔다.
 * @param {object} encoded - .egis 레이어의 raster 객체
 * @returns {object} data가 TypedArray/배열로 복원된 얕은 복사본
 */
export function decodeRasterMeta(encoded) {
  const result = { ...encoded };
  const d = encoded.data;

  if (d && d.__encoding === 'base64') {
    const binary = atob(d.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const Ctor = TYPED_ARRAY_CTORS[d.dtype] || Float32Array;
    result.data = new Ctor(bytes.buffer);
  } else if (d && d.__encoding === 'array') {
    result.data = d.values;
  }

  return result;
}

/**
 * 래스터 객체를 JSON 안전한 형태로 인코딩(.esm 저장용).
 * 이식 원본: e-GIS src/core/ProjectManager.js encodeRasterMeta.
 * data가 이미 인코딩(__encoding)돼 있으면 그대로 반환한다(.egis 유래 소스).
 */
export function encodeRasterMeta(rasterObj) {
  const arr = rasterObj.data;
  if (arr && arr.__encoding) return rasterObj; // 이미 JSON-safe

  let encodedData;
  if (ArrayBuffer.isView(arr)) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    encodedData = { __encoding: 'base64', dtype: arr.constructor.name, base64: btoa(binary) };
  } else if (Array.isArray(arr)) {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr };
  } else {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr ? Array.from(arr) : [] };
  }

  return { ...rasterObj, data: encodedData };
}
