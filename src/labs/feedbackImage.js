// © 2026 김용현
/**
 * 의견에 붙일 이미지 — 파일·붙여넣기·지도 캔버스를 긴 변 1600px 이하 JPEG 로 줄여 base64 로 만든다.
 * (원본 스크린샷은 수 MB 라 Apps Script 로 보내기엔 크다)
 */
import { fitSize } from './feedbackPayload.js';

export const MAX_IMAGE_SIDE = 1600;

/** 캔버스(또는 이미지) → { name, type, data(base64), dataUrl } — 그리지 못하면(교차 출처 지도 타일 등) 예외 */
export function encodeImage(source, name = 'capture.jpg') {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const [tw, th] = fitSize(w, h, MAX_IMAGE_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // 투명한 PNG·지도 빈 곳이 JPEG 에서 검게 나오지 않게
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(source, 0, 0, tw, th);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { name: name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: dataUrl.split(',')[1], dataUrl };
}

/** File/Blob(이미지) → encodeImage 결과 */
export function encodeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('이미지 파일만 붙일 수 있습니다.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try { resolve(encodeImage(img, file.name || 'image.jpg')); } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); };
    img.src = url;
  });
}
