// © 2026 김용현
/**
 * crsResolver - 감지 결과를 좌표계 하나로 확정한다.
 *
 * 로더는 이 함수 하나만 부른다. 확신하면 그대로 쓰고, 애매하면 등록된 프롬프트
 * (CrsConfirmDialog)에 묻는다. 프롬프트를 주입받는 이유는 core/가 ui/를
 * import하지 않게 하기 위해서다 — 테스트에서도 DOM 없이 돈다.
 *
 * 프롬프트 호출은 모듈 수준 사슬로 직렬화된다 — CrsConfirmDialog는 창이 하나뿐이라
 * 동시에 두 개를 열면 앞선 창이 취소(null)로 조용히 닫히기 때문이다. 자세한 이유는
 * enqueuePrompt 주석을 보라.
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

// 프롬프트 호출을 이어 붙이는 사슬. 지금은 모든 호출부가 await로 직렬 처리하고
// 있어 겹칠 일이 없지만, 다중 파일 가져오기를 Promise.all로 바꾸는 순간 애매한
// 판정이 둘 이상 동시에 프롬프트를 부르게 된다 — CrsConfirmDialog.pick은 이미 열린
// 창이 있으면 그 창을 취소(null)로 닫고 새 창을 띄우므로, 그러면 먼저 들어온 파일이
// 조용히 취소 처리된다. 이 사슬이 "한 번에 하나만 뜨게" 강제한다.
let promptChain = Promise.resolve();

/**
 * 프롬프트 호출을 promptChain에 이어 붙인다 — 앞선 프롬프트가 끝난 뒤에야
 * 다음 프롬프트가 뜬다. fn을 인자로 받는 이유는, 사슬에서 실제로 실행되는 시점에는
 * 모듈 전역 promptFn이 setCrsPrompt로 바뀌어 있을 수 있어서다 — 호출 시점의 값을
 * 붙잡아 둔다.
 */
function enqueuePrompt(fn, detection, context) {
  const run = () => fn(detection, context);
  const result = promptChain.then(run, run);
  // 이 호출이 실패해도 사슬 자체는 끊이지 않아야 다음 대기자가 진행된다
  promptChain = result.then(() => {}, () => {});
  return result;
}

/**
 * 원본 좌표계를 확정한다.
 *
 * 프롬프트가 reject해도(창을 못 띄우는 등) 가져오기를 취소로 보지 않고 최선의
 * 후보(detection.crs)로 진행한다 — DOM 문제로 확인 창이 안 뜬다고 가져오기 자체가
 * 막히면 사용자 입장에서 더 나쁘다. "틀릴 수 있지만 일단 된다"가 "확실하지만 안 된다"
 * 보다 낫다는 판단이다.
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
    chosen = await enqueuePrompt(promptFn, detection, context);
  } catch (error) {
    // 다이얼로그가 실패해도 가져오기 자체는 살린다 — 최선의 후보로 진행한다.
    // (reject를 취소로 처리하지 않는 이유는 위 함수 설명 참고)
    console.warn('좌표계 확인 창을 띄우지 못했다:', error);
    return { crs: detection.crs, cancelled: false, detection };
  }

  if (!chosen) return { crs: null, cancelled: true, detection };
  return { crs: chosen, cancelled: false, detection };
}
