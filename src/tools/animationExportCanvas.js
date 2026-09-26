// © 2026 김용현
/**
 * 시계열 애니메이션 저장 — 브라우저 부분 (프레임 캡처 · GIF · 동영상).
 *
 * 순수 규칙(mime·라벨 배치·파일명)은 animationExport.js 에 있다. 이 파일은 OpenLayers·
 * 캔버스·MediaRecorder 를 쓰므로 노드 테스트가 없고, 대화상자(jsdom)는 주입으로 이 함수들을
 * 흉내 낸다. 실제 동작은 Electron 하네스(GIF)와 배포 뒤 크롬(MP4)에서 본다.
 *
 * 프레임은 html2canvas 가 아니라 3D 가 쓰는 composeMapCanvas(OL 레이어 캔버스 합성)로 뽑는다.
 * `.ol-layer canvas` 만 합치므로 #map 위의 DOM 오버레이(슬라이더 박스·HTML 범례·버튼)는
 * 프레임에 들어가지 않는다 — 범례·연도 라벨은 캔버스에 직접 그린다.
 * 배경 타일은 익명 CORS 라 캔버스가 오염되지 않는다. 오염됐으면(외부 이미지 오버레이 등)
 * getImageData 가 던지므로 그때 사용자에게 이유를 적고 멈춘다.
 *
 * gifenc 는 encodeGif 안에서 동적 import — 저장하지 않는 사용자는 내려받지 않고,
 * 노드 테스트가 이 파일을 간접으로 불러도 인코더를 끌고 오지 않는다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */
import { unByKey } from 'ol/Observable';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { composeMapCanvas } from '../view3d/mapTexture.js';
import { exportTool } from './ExportTool.js';
import { buildLegendModel } from './legendModel.js';
import { labelLayout } from './animationExport.js';

/** 프레임 한 변의 최대 픽셀 — 30프레임을 메모리에 들고 있어야 한다 */
const MAX_FRAME_SIZE = 4096;

/** 타일이 끝내 안 오면 이만큼 기다린 뒤 그냥 찍는다 */
const RENDER_TIMEOUT_MS = 3000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function abortError() {
  return new DOMException('취소', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw abortError();
}

/** 지도 한 프레임이 다 그려질 때까지 (타일이 안 오면 RENDER_TIMEOUT_MS 뒤 그냥 간다) */
function waitRender(map) {
  return new Promise((resolve) => {
    let key = null;
    let timer = null;
    const finish = () => {
      if (key) unByKey(key);
      clearTimeout(timer);
      resolve();
    };
    key = map.once('rendercomplete', finish);
    timer = setTimeout(finish, RENDER_TIMEOUT_MS);
    map.render();
  });
}

/** 오염된 캔버스면 getImageData 가 던진다 — 미리 확인해 이유를 사용자 말로 바꾼다 */
function assertReadable(canvas) {
  try {
    canvas.getContext('2d').getImageData(0, 0, 1, 1);
  } catch {
    throw new Error('외부 이미지 때문에 캔버스를 읽을 수 없습니다');
  }
}

function drawLabel(ctx, text, width, height, scale) {
  const L = labelLayout(width, height, scale);
  ctx.save();
  ctx.font = L.font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = L.background;
  ctx.fillRect(L.x, L.y, w + L.padX * 2, L.fontSize + L.padY * 2);
  ctx.fillStyle = L.color;
  ctx.fillText(text, L.x + L.padX, L.y + L.padY);
  ctx.restore();
}

/**
 * 연도마다 지도 캔버스를 뽑는다. 끝나면(취소·실패여도) 슬라이더를 원래 자리로 돌린다.
 *
 * 배율은 composeMapCanvas 의 pixelRatio(기기 픽셀비 × 배율)로 준다. OL 은 기기 픽셀비로만
 * 그리므로 2× 는 지도 비트맵을 늘린 것이고, 범례·연도 라벨만 2× 해상도로 새로 그린다.
 *
 * @param {{tool: {layerId: string, config: Function, setIndex: Function}, layerId: string,
 *          scale?: number, includeLegend?: boolean, includeLabel?: boolean,
 *          onProgress?: (done: number, total: number) => void, signal?: AbortSignal}} options
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function captureFrames({ tool, layerId, scale = 1, includeLegend = true, includeLabel = true, onProgress, signal }) {
  const map = mapManager.getMap();
  const mapEl = document.getElementById('map');
  const layerInfo = layerManager.getLayer(layerId);
  const cfg = tool.config(layerId);
  // setIndex 는 도구가 붙어 있는 레이어(tool.layerId)를 움직인다 — 다른 레이어면 엉뚱한 걸 찍는다
  if (!map || !mapEl || !layerInfo || !cfg || tool.layerId !== layerId) {
    throw new Error('시계열 레이어가 없습니다');
  }

  const fields = cfg.timeSeries.fields.slice();
  const startIndex = cfg.timeSeries.index;
  const pixelRatio = (window.devicePixelRatio || 1) * scale;
  // 크기는 첫 프레임을 그린 뒤 한 번만 잡는다(3D 를 막 끈 직후면 그 전엔 크기가 덜 맞을 수 있다).
  // 모든 프레임이 같은 크기여야 GIF·동영상이 깨지지 않는다
  let size = null;
  const frames = [];

  try {
    for (let i = 0; i < fields.length; i++) {
      throwIfAborted(signal);
      tool.setIndex(i);
      await waitRender(map);
      throwIfAborted(signal);

      const now = map.getSize();
      if (!size) {
        if (!now || !(now[0] > 0) || !(now[1] > 0)) throw new Error('지도 크기를 알 수 없습니다');
        size = now.slice();
      } else if (!now || now[0] !== size[0] || now[1] !== size[1]) {
        throw new Error('캡처 중 지도 크기가 바뀌었습니다');
      }
      const canvas = composeMapCanvas(mapEl, { size, pixelRatio, maxSize: MAX_FRAME_SIZE });
      if (!canvas) throw new Error('지도 캔버스를 합칠 수 없습니다');
      assertReadable(canvas);

      // 상한(MAX_FRAME_SIZE)에 걸려 줄었을 수 있으니 실제 배율(캔버스 픽셀 / CSS 픽셀)로 그린다
      const k = canvas.width / size[0];
      const ctx = canvas.getContext('2d');
      if (includeLegend) {
        const model = buildLegendModel(layerInfo);
        if (model) {
          exportTool.drawLegend(ctx, { models: [model], showHeader: false, x: 0.02, y: 0.6 }, canvas.width, canvas.height, k);
        }
      }
      if (includeLabel) drawLabel(ctx, fields[i], canvas.width, canvas.height, k);

      frames.push(canvas);
      if (onProgress) onProgress(i + 1, fields.length);
    }
  } finally {
    tool.setIndex(startIndex);
  }
  return frames;
}

/**
 * GIF — gifenc 로 오프라인 인코딩. 유지 시간 = 프레임 지연(ms), 무한 반복.
 * gifenc 는 이때 처음 내려받는다(동적 import). ESM 빌드의 default 는 GIFEncoder 자체라
 * 이름으로 꺼낸다.
 *
 * @param {HTMLCanvasElement[]} frames
 * @param {number} delayMs
 * @param {{signal?: AbortSignal, onProgress?: (done: number, total: number) => void}} [options]
 * @returns {Promise<Blob>}
 */
export async function encodeGif(frames, delayMs, { signal, onProgress } = {}) {
  if (!frames.length) throw new Error('프레임이 없습니다');
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    throwIfAborted(signal);
    const { width, height } = frames[i];
    const rgba = frames[i].getContext('2d').getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, { palette, delay: delayMs, repeat: 0 });
    if (onProgress) onProgress(i + 1, frames.length);
    await sleep(0);   // 화면(진행률)이 숨 쉴 틈
  }
  throwIfAborted(signal);
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * 동영상 — 오프스크린 캔버스 captureStream(0) + MediaRecorder.
 * 프레임마다 requestFrame() 뒤 유지 시간만큼 기다리므로 녹화는 실시간이다.
 * 취소하면 녹화를 멈추고 모은 조각은 버린다.
 *
 * @param {HTMLCanvasElement[]} frames
 * @param {number} delayMs
 * @param {string} mimeType pickMimeType 결과
 * @param {{signal?: AbortSignal, onProgress?: (done: number, total: number) => void}} [options]
 * @returns {Promise<Blob>}
 */
export async function recordVideo(frames, delayMs, mimeType, { signal, onProgress } = {}) {
  if (!frames.length) throw new Error('프레임이 없습니다');
  const canvas = document.createElement('canvas');
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  const ctx = canvas.getContext('2d');
  if (typeof canvas.captureStream !== 'function') throw new Error('이 브라우저는 캔버스 녹화를 지원하지 않습니다');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const paint = (frame) => {
    ctx.drawImage(frame, 0, 0);
    if (track && track.requestFrame) track.requestFrame();
  };

  // 녹화기 만들기·시작도 try 안에서 — mime 을 거절(NotSupportedError)해도 캡처 트랙은 멈춘다
  let recorder = null;
  let stopped = null;
  const chunks = [];
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) => reject(e.error || new Error('녹화에 실패했습니다'));
    });
    stopped.catch(() => {});   // 취소로 먼저 빠져나가면 아무도 기다리지 않는다 — 미처리 거부 경고 막기

    // 첫 프레임을 먼저 그려 둔다 — 녹화 시작 직후의 빈(검은) 화면을 막는다
    paint(frames[0]);
    recorder.start();
    for (let i = 0; i < frames.length; i++) {
      throwIfAborted(signal);
      paint(frames[i]);
      await sleep(delayMs);
      if (onProgress) onProgress(i + 1, frames.length);
    }
    // 마지막 프레임이 잘리지 않게 한 번 더
    paint(frames[frames.length - 1]);
    await sleep(150);
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (track) track.stop();
  }
  await stopped;
  throwIfAborted(signal);
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}
