// © 2026 김용현
/**
 * 시계열 애니메이션 저장 — GIF(gifenc) · 동영상(MediaRecorder).
 *
 * 이 파일은 순수 규칙만 — 브라우저 API 없이 노드에서 테스트한다.
 * 캔버스·MediaRecorder 를 쓰는 captureFrames·encodeGif·recordVideo 는 animationExportCanvas.js.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */

/** MediaRecorder mime 우선순위 — mp4 가 되면 PowerPoint 에 바로 넣을 수 있다 */
export const MIME_CANDIDATES = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'];

/**
 * @param {(mime: string) => boolean} isTypeSupported 보통 MediaRecorder.isTypeSupported
 * @returns {string|null} 처음 지원되는 mime, 없으면 null(동영상 선택지를 숨긴다)
 */
export function pickMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // 판정이 던지는 브라우저도 있다 — 다음 후보로
    }
  }
  return null;
}

/** 저장 버튼에 보여 줄 실제 확장자 */
export function extensionFor(mime) {
  if (!mime) return 'gif';
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/**
 * 연도 라벨 배치 — 왼쪽 위, 큰 글자.
 * @param {number} width 프레임 픽셀 너비(이미 배율이 곱해진 값)
 * @param {number} height
 * @param {number} scale 배율(1·2). 여백·글자 최소·최대에 곱한다
 */
export function labelLayout(width, height, scale = 1) {
  const fontSize = Math.round(Math.max(18 * scale, Math.min(64 * scale, Math.min(width, height) * 0.06)));
  return {
    x: 16 * scale,
    y: 16 * scale,
    padX: 10 * scale,
    padY: 6 * scale,
    fontSize,
    font: `bold ${fontSize}px "Malgun Gothic", sans-serif`,
    color: '#111111',
    background: 'rgba(255, 255, 255, 0.85)'
  };
}

/** 파일 이름: 레이어이름_시계열.확장자 (파일 이름에 못 쓰는 글자는 _).
 *  시계열 도구가 만든 레이어(이름_시계열_첫~끝)에는 이미 '시계열'이 있으니 두 번 붙이지 않는다. */
export function animationFilename(layerName, ext) {
  const base = String(layerName || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '지도';
  return base.includes('_시계열') ? `${base}.${ext}` : `${base}_시계열.${ext}`;
}

/** 프레임 유지 시간(초) → ms. 이상한 값은 1.2초, 최소 100ms */
export function frameDelayMs(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 1200;
  return Math.max(100, Math.round(s * 1000));
}
