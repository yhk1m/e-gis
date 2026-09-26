// © 2026 김용현
/**
 * 애니메이션 저장의 순수 규칙 — 브라우저 API(MediaRecorder·canvas)는 주입받거나 안 쓴다.
 * - mime 우선순위: mp4(avc1) → webm(vp9) → webm. 지원 판정 함수를 주입.
 * - 파일 확장자는 실제 mime 을 따른다(PowerPoint 는 WebM 을 못 넣으므로 사용자가 알아야 한다).
 * - 연도 라벨은 왼쪽 위, 크기는 짧은 변에 비례하되 배율에 따라 커진다.
 */
import { describe, it, expect } from 'vitest';
import {
  pickMimeType, extensionFor, labelLayout, animationFilename, frameDelayMs, MIME_CANDIDATES
} from './animationExport.js';

describe('pickMimeType', () => {
  it('mp4 avc1 → webm vp9 → webm 순으로 처음 지원되는 것', () => {
    expect(pickMimeType((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickMimeType((m) => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9');
    expect(pickMimeType(() => true)).toBe('video/mp4;codecs=avc1');
    expect(MIME_CANDIDATES[0]).toBe('video/mp4;codecs=avc1');
  });
  it('아무것도 지원 안 하거나 판정이 던지면 null', () => {
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(() => { throw new Error('x'); })).toBeNull();
    expect(pickMimeType(null)).toBeNull();
  });
});

describe('extensionFor', () => {
  it('mime → 확장자', () => {
    expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensionFor('video/webm;codecs=vp9')).toBe('webm');
    expect(extensionFor('video/webm')).toBe('webm');
    expect(extensionFor(null)).toBe('gif');
  });
});

describe('labelLayout', () => {
  it('왼쪽 위, 짧은 변의 6%(최소 18·최대 64)에 배율을 곱한다', () => {
    const a = labelLayout(1000, 600, 1);
    expect(a.x).toBe(16);
    expect(a.y).toBe(16);
    expect(a.fontSize).toBe(36);
    expect(a.font).toBe('bold 36px "Malgun Gothic", sans-serif');
    expect(labelLayout(200, 100, 1).fontSize).toBe(18);
    expect(labelLayout(4000, 3000, 1).fontSize).toBe(64);
    const b = labelLayout(2000, 1200, 2);
    expect(b.fontSize).toBe(72);
    expect(b.x).toBe(32);
    expect(b.padX).toBe(20);
  });
});

describe('animationFilename', () => {
  it('레이어이름_시계열.확장자, 파일 이름에 못 쓰는 글자는 _', () => {
    expect(animationFilename('서울 자치구_시계열_2015~2025', 'gif')).toBe('서울 자치구_시계열_2015~2025_시계열.gif');
    expect(animationFilename('a/b:c', 'mp4')).toBe('a_b_c_시계열.mp4');
    expect(animationFilename('', 'webm')).toBe('지도_시계열.webm');
  });
});

describe('frameDelayMs', () => {
  it('초 → ms, 최소 100', () => {
    expect(frameDelayMs(1.2)).toBe(1200);
    expect(frameDelayMs(0.01)).toBe(100);
    expect(frameDelayMs('abc')).toBe(1200);
  });
});
