// © 2026 김용현
/**
 * crsResolver - 감지 결과를 좌표계 하나로 확정한다.
 *
 * 로더는 이 함수 하나만 부른다. 확신하면 그대로 쓰고, 애매하면 등록된 프롬프트
 * (CrsConfirmDialog)에 묻는다. 프롬프트를 주입받는 이유는 core/가 ui/를
 * import하지 않게 하기 위해서다 — 테스트에서도 DOM 없이 돈다.
 */
import { detectCrs } from './CrsDetector.js';

let promptFn = null;

/**
 * 애매할 때 물어볼 함수를 등록한다. main.js가 시작할 때 한 번 부른다.
 * @param {null|function(Object, Object): Promise<string|null>} fn
 *        (detection, context) => 고른 좌표계 코드 또는 null(취소)
 */
export function setCrsPrompt(fn) {
  promptFn = typeof fn === 'function' ? fn : null;
}

/**
 * 원본 좌표계를 확정한다.
 *
 * @param {Object} input - detectCrs에 넘길 근거
 * @param {Object} [context] - 프롬프트에 그대로 전달된다
 * @param {string} [context.name] - 레이어 이름 (다이얼로그 제목용)
 * @param {Object} [context.previewGeoJSON] - 원본 좌표 그대로의 GeoJSON (미리보기용)
 * @returns {Promise<{crs:string|null, cancelled:boolean, detection:Object}>}
 */
export async function resolveSourceCrs(input, context = {}) {
  const detection = detectCrs(input);

  if (detection.confidence === 'certain' || !promptFn) {
    return { crs: detection.crs, cancelled: false, detection };
  }

  let chosen;
  try {
    chosen = await promptFn(detection, context);
  } catch (error) {
    // 다이얼로그가 실패해도 가져오기 자체는 살린다 — 최선의 후보로 진행한다
    console.warn('좌표계 확인 창을 띄우지 못했다:', error);
    return { crs: detection.crs, cancelled: false, detection };
  }

  if (!chosen) return { crs: null, cancelled: true, detection };
  return { crs: chosen, cancelled: false, detection };
}
