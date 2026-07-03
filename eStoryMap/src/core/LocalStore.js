// © 2026 김용현
// eStoryMap/src/core/LocalStore.js
// .esm(StoryMapDoc JSON) 직렬화/역직렬화 + 자동저장 디바운스 — 순수 모듈.
// 파일 I/O는 하지 않는다(window.egisFS IPC는 main.js 접착부 담당 — 상위 스펙 §3b).
import { encodeRasterMeta } from './rasterDecode.js';

/** source.egis 안의 래스터 밴드(TypedArray)를 JSON-safe로 인코딩한 복사본. */
function encodeEgisRasters(egis) {
  if (!egis || !Array.isArray(egis.layers)) return egis;
  return {
    ...egis,
    layers: egis.layers.map((layer) =>
      layer && layer.raster && ArrayBuffer.isView(layer.raster.data)
        ? { ...layer, raster: encodeRasterMeta(layer.raster) }
        : layer),
  };
}

/**
 * StoryMapDoc → .esm JSON 문자열. .tif 유래 소스의 TypedArray를 base64로
 * 인코딩한다(라이브 문서는 변경하지 않음). 로드 시 디코딩은 기존
 * parseEgisDoc→buildRasterLayer→decodeRasterMeta 경로가 처리하므로 별도 없음.
 */
export function serializeStoryDoc(doc) {
  const out = {
    ...doc,
    sources: doc.sources.map((source) => ({
      ...source,
      egis: encodeEgisRasters(source.egis),
    })),
  };
  return JSON.stringify(out);
}

/** .esm 텍스트 → StoryMapDoc. 구조가 어긋나면 명확히 실패한다. */
export function deserializeStoryDoc(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('유효하지 않은 .esm 파일입니다: JSON 아님');
  }
  if (!raw || !raw.meta || !Array.isArray(raw.pages) || raw.pages.length < 1
    || !Array.isArray(raw.sources)) {
    throw new Error('유효하지 않은 .esm 파일입니다: 필수 구조 누락');
  }
  return raw;
}

/**
 * 디바운스 자동저장. 변이 때마다 schedule()을 부르면 마지막 호출 기준
 * delay 후 save()가 1회 실행된다.
 */
export function createAutosaver(save, { delay = 2000 } = {}) {
  let timer = null;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        save();
      }, delay);
    },
  };
}
