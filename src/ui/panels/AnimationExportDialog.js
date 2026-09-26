// © 2026 김용현
/**
 * AnimationExportDialog - 시계열 애니메이션 저장 (GIF · MP4/WebM)
 *
 * 브라우저 API·캡처·인코딩·저장은 전부 생성자로 주입받아 jsdom 에서 흐름만 테스트한다.
 * 실제 배선은 main.js 의 timeSeriesTool.onSave(슬라이더 「저장」 버튼)가 한다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「애니메이션 저장」
 */
import { escapeHtml } from '../../utils/escapeHtml.js';
import { pickMimeType, extensionFor, animationFilename, frameDelayMs } from '../../tools/animationExport.js';
import { BASE_INTERVAL_MS } from '../../tools/TimeSeriesTool.js';

/** 프레임 유지 상한 (입력 max 와 같다) */
const MAX_HOLD_MS = 10000;

export class AnimationExportDialog {
  /**
   * @param {{layerName: string, fields: string[], speed: number,
   *          hasMediaRecorder: boolean, isTypeSupported: Function,
   *          beforeCapture: () => Promise<void>,   재생 멈춤·3D/지구본/스와이프 끄기 (main.js)
   *          captureFrames: ({scale, includeLabel, includeLegend, signal, onProgress}) => Promise<canvas[]>,
   *          encodeGif: (frames, delayMs, {signal, onProgress}) => Promise<Blob>,
   *          recordVideo: (frames, delayMs, mimeType, {signal, onProgress}) => Promise<Blob>,
   *          saveBlobAs: Function, onMessage: (msg: string) => void}} deps
   */
  constructor(deps) {
    this.d = deps;
    this.modal = null;
    this.controller = null;
    this.mime = deps.hasMediaRecorder ? pickMimeType(deps.isTypeSupported) : null;
  }

  show() {
    this.close();
    const holdDefault = (BASE_INTERVAL_MS / (this.d.speed || 1) / 1000).toFixed(1);
    const videoOption = this.mime
      ? `<label class="anim-radio"><input type="radio" name="anim-format" id="anim-format-video" value="video"><span>동영상 (${extensionFor(this.mime).toUpperCase()})</span></label>`
      : '';

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay anim-export-modal active';
    this.modal.innerHTML = `
      <div class="modal-content anim-export-content" role="dialog" aria-labelledby="anim-title">
        <div class="modal-header">
          <h3 id="anim-title">애니메이션 저장</h3>
          <button class="modal-close" id="anim-close" aria-label="닫기">&times;</button>
        </div>
        <div class="modal-body">
          <p class="anim-intro">${escapeHtml(this.d.layerName)} · ${this.d.fields.length}개 연도</p>
          <div class="anim-row">
            <span class="anim-label">형식</span>
            <label class="anim-radio"><input type="radio" name="anim-format" id="anim-format-gif" value="gif" checked><span>GIF</span></label>
            ${videoOption}
          </div>
          <div class="anim-row">
            <label class="anim-label" for="anim-scale">배율</label>
            <select id="anim-scale"><option value="1">1×</option><option value="2">2×</option></select>
          </div>
          <div class="anim-row">
            <label class="anim-label" for="anim-hold">프레임 유지(초)</label>
            <input type="number" id="anim-hold" min="0.1" max="10" step="0.1" value="${holdDefault}">
          </div>
          <div class="anim-row">
            <label class="anim-check"><input type="checkbox" id="anim-label" checked><span>연도 라벨 포함</span></label>
            <label class="anim-check"><input type="checkbox" id="anim-legend" checked><span>범례 포함</span></label>
          </div>
          <div class="anim-progress" id="anim-progress" hidden></div>
        </div>
        <div class="modal-footer anim-footer">
          <button class="btn btn-secondary" id="anim-cancel">취소</button>
          <button class="btn btn-primary" id="anim-run">GIF 만들기</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.modal.querySelector('#anim-close').addEventListener('click', () => this.cancel());
    this.modal.querySelector('#anim-cancel').addEventListener('click', () => this.cancel());
    this.modal.querySelectorAll('input[name="anim-format"]').forEach((r) => {
      r.addEventListener('change', () => this.updateRunLabel());
    });
    this.modal.querySelector('#anim-run').addEventListener('click', () => this.run());
    this._escHandler = (e) => { if (e.key === 'Escape') this.cancel(); };
    document.addEventListener('keydown', this._escHandler);
    this.updateRunLabel();
  }

  format() {
    const video = this.modal && this.modal.querySelector('#anim-format-video');
    return video && video.checked ? 'video' : 'gif';
  }

  updateRunLabel() {
    const ext = this.format() === 'video' ? extensionFor(this.mime) : 'gif';
    this.modal.querySelector('#anim-run').textContent = `${ext.toUpperCase()} 만들기`;
  }

  setProgress(text) {
    const el = this.modal && this.modal.querySelector('#anim-progress');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
  }

  /** 만들기 — 진행 중에는 입력을 잠그고 취소만 남긴다 */
  async run() {
    if (!this.modal || this.controller) return;
    const format = this.format();
    const scale = parseInt(this.modal.querySelector('#anim-scale').value, 10) || 1;
    // 입력 max 는 강제되지 않는다 — GIF 지연은 16비트 센티초라 10초로 막는다
    const delayMs = Math.min(MAX_HOLD_MS, frameDelayMs(this.modal.querySelector('#anim-hold').value));
    const includeLabel = this.modal.querySelector('#anim-label').checked;
    const includeLegend = this.modal.querySelector('#anim-legend').checked;
    const ext = format === 'video' ? extensionFor(this.mime) : 'gif';
    const filename = animationFilename(this.d.layerName, ext);

    this.controller = new AbortController();
    const { signal } = this.controller;
    this.modal.querySelectorAll('input, select, #anim-run').forEach((el) => { el.disabled = true; });
    this.setProgress('준비 중…');

    try {
      await this.d.beforeCapture();
      const frames = await this.d.captureFrames({
        scale, includeLabel, includeLegend, signal,
        onProgress: (done, total) => this.setProgress(`${done}/${total} 프레임`)
      });
      if (signal.aborted) throw new DOMException('취소', 'AbortError');
      const stage = format === 'video' ? '녹화 중(실시간)' : 'GIF 만드는 중';
      this.setProgress(`${stage}…`);
      const encodeOptions = {
        signal,
        onProgress: (done, total) => this.setProgress(`${stage}… ${done}/${total}`)
      };
      const blob = format === 'video'
        ? await this.d.recordVideo(frames, delayMs, this.mime, encodeOptions)
        : await this.d.encodeGif(frames, delayMs, encodeOptions);
      if (signal.aborted) throw new DOMException('취소', 'AbortError');
      await this.d.saveBlobAs(filename, blob);
      this.d.onMessage(`${filename} 저장`);
    } catch (error) {
      if (!(error && error.name === 'AbortError')) {
        console.error('애니메이션 저장 실패', error);
        this.d.onMessage(`애니메이션 저장 실패: ${error && error.message ? error.message : error}`);
      }
    } finally {
      this.controller = null;
      this.close();
    }
  }

  /** 진행 중이면 중단(만들던 것은 버린다), 아니면 그냥 닫는다 */
  cancel() {
    if (this.controller) {
      this.controller.abort();
      this.setProgress('취소 중…');
      return;   // run() 의 finally 가 닫는다
    }
    this.close();
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
