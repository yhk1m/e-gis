// © 2026 김용현
// @vitest-environment jsdom
/**
 * 저장 대화상자: MediaRecorder 가 없으면 동영상 선택지를 숨긴다, 만들기 버튼에 실제
 * 확장자를 적는다, 만들기는 capture → encode → save 순으로 주입된 함수를 부르고 진행률을
 * 보이며, 취소는 AbortController 를 중단시키고 파일을 만들지 않는다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationExportDialog } from './AnimationExportDialog.js';

function deps(overrides = {}) {
  return {
    layerName: '구_시계열_2015~2025',
    fields: ['2015', '2020', '2025'],
    speed: 1,
    isTypeSupported: () => false,
    hasMediaRecorder: false,
    beforeCapture: vi.fn(async () => {}),
    captureFrames: vi.fn(async ({ onProgress }) => { onProgress(1, 3); onProgress(2, 3); onProgress(3, 3); return ['f1', 'f2', 'f3']; }),
    encodeGif: vi.fn(async () => new Blob(['gif'], { type: 'image/gif' })),
    recordVideo: vi.fn(async () => new Blob(['vid'], { type: 'video/webm' })),
    saveBlobAs: vi.fn(async () => true),
    onMessage: vi.fn(),
    ...overrides
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('AnimationExportDialog', () => {
  it('MediaRecorder 가 없으면 GIF 만, 버튼 글자는 GIF 만들기', () => {
    const d = new AnimationExportDialog(deps());
    d.show();
    expect(document.querySelector('.anim-export-modal')).toBeTruthy();
    expect(document.querySelector('#anim-format-video')).toBeNull();
    expect(document.querySelector('#anim-run').textContent).toBe('GIF 만들기');
    expect(document.querySelector('#anim-hold').value).toBe('1.2');
    d.close();
  });

  it('MediaRecorder 가 있고 mp4 를 지원하면 동영상 선택지와 MP4 글자', () => {
    const d = new AnimationExportDialog(deps({ hasMediaRecorder: true, isTypeSupported: () => true, speed: 2 }));
    d.show();
    expect(document.querySelector('#anim-hold').value).toBe('0.6');
    document.querySelector('#anim-format-video').click();
    expect(document.querySelector('#anim-run').textContent).toBe('MP4 만들기');
    document.querySelector('#anim-format-gif').click();
    expect(document.querySelector('#anim-run').textContent).toBe('GIF 만들기');
    d.close();
  });

  it('만들기: beforeCapture → captureFrames → encodeGif → saveBlobAs, 진행률 표시', async () => {
    const seen = [];
    const progressText = () => document.querySelector('#anim-progress').textContent;
    const p = deps({
      captureFrames: vi.fn(async ({ onProgress }) => {
        onProgress(2, 3); seen.push(progressText());
        onProgress(3, 3); seen.push(progressText());
        return ['f1', 'f2', 'f3'];
      }),
      encodeGif: vi.fn(async (frames, delay, { onProgress }) => {
        onProgress(3, 3); seen.push(progressText());
        return new Blob(['gif'], { type: 'image/gif' });
      })
    });
    const d = new AnimationExportDialog(p);
    d.show();
    document.querySelector('#anim-scale').value = '2';
    document.querySelector('#anim-label').checked = false;
    await d.run();
    expect(p.beforeCapture).toHaveBeenCalled();
    expect(p.captureFrames).toHaveBeenCalledWith(expect.objectContaining({ scale: 2, includeLabel: false, includeLegend: true }));
    expect(p.encodeGif).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 1200, expect.anything());
    expect(p.saveBlobAs).toHaveBeenCalledWith('구_시계열_2015~2025.gif', expect.any(Blob));
    expect(seen).toEqual(['2/3 프레임', '3/3 프레임', 'GIF 만드는 중… 3/3']);
    expect(document.querySelector('.anim-export-modal')).toBeNull();   // 끝나면 닫힌다
  });

  it('프레임 유지는 10초로 막는다 (GIF 지연은 16비트 센티초)', async () => {
    const p = deps();
    const d = new AnimationExportDialog(p);
    d.show();
    document.querySelector('#anim-hold').value = '999';
    await d.run();
    expect(p.encodeGif).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 10000, expect.anything());
  });

  it('동영상은 recordVideo 와 실제 확장자', async () => {
    const p = deps({ hasMediaRecorder: true, isTypeSupported: (m) => m === 'video/webm' });
    const d = new AnimationExportDialog(p);
    d.show();
    document.querySelector('#anim-format-video').click();
    expect(document.querySelector('#anim-run').textContent).toBe('WEBM 만들기');
    await d.run();
    expect(p.recordVideo).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 1200, 'video/webm', expect.anything());
    expect(p.saveBlobAs).toHaveBeenCalledWith('구_시계열_2015~2025.webm', expect.any(Blob));
  });

  it('취소하면 signal 이 중단되고 저장하지 않는다', async () => {
    let seenSignal = null;
    const p = deps({
      captureFrames: vi.fn(async ({ signal, onProgress }) => {
        seenSignal = signal;
        onProgress(1, 3);
        document.querySelector('#anim-cancel').click();
        if (signal.aborted) throw new DOMException('취소', 'AbortError');
        return [];
      })
    });
    const d = new AnimationExportDialog(p);
    d.show();
    await d.run();
    expect(seenSignal.aborted).toBe(true);
    expect(p.encodeGif).not.toHaveBeenCalled();
    expect(p.saveBlobAs).not.toHaveBeenCalled();
    expect(document.querySelector('.anim-export-modal')).toBeNull();
  });

  it('실패하면 상태줄 메시지를 내고 닫는다', async () => {
    const p = deps({ captureFrames: vi.fn(async () => { throw new Error('외부 이미지 때문에 캔버스를 읽을 수 없습니다'); }) });
    const d = new AnimationExportDialog(p);
    d.show();
    await d.run();
    expect(p.onMessage).toHaveBeenCalledWith('애니메이션 저장 실패: 외부 이미지 때문에 캔버스를 읽을 수 없습니다');
    expect(p.saveBlobAs).not.toHaveBeenCalled();
  });
});
