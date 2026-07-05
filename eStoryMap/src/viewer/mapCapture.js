// © 2026 김용현
// eStoryMap/src/viewer/mapCapture.js
// 현재 OL 지도를 정적 이미지(dataURL)로 캡처 — 보고서 지도 figure용(M10).
// OL 공식 export 패턴: rendercomplete 시 모든 레이어 캔버스를 opacity·transform 반영해 합성.
// OSM 베이스는 crossOrigin:'anonymous'(MapView)라야 toDataURL이 오염 없이 동작.
// 접착 코드라 단위 테스트 없음 — 수동 스모크.

/**
 * @param {import('ol/Map').default} map
 * @param {{timeout?:number}} [opts]
 * @returns {Promise<string|null>} PNG dataURL (렌더 미완/오염 시 null)
 */
export function captureMapImage(map, { timeout = 5000 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (!done) { done = true; resolve(val); } };

    map.once('rendercomplete', () => {
      try {
        const size = map.getSize();
        if (!size) return finish(null);
        const out = document.createElement('canvas');
        out.width = size[0];
        out.height = size[1];
        const ctx = out.getContext('2d');
        const canvases = map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer');
        canvases.forEach((canvas) => {
          if (canvas.width === 0 || canvas.height === 0) return;
          const opacity = (canvas.parentNode && canvas.parentNode.style.opacity) || canvas.style.opacity;
          ctx.globalAlpha = opacity === '' ? 1 : Number(opacity);
          const tr = canvas.style.transform;
          const m = /^matrix\(([^)]+)\)$/.exec(tr);
          if (m) {
            const t = m[1].split(',').map(Number);
            ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
          } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
          ctx.drawImage(canvas, 0, 0);
        });
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        finish(out.toDataURL('image/png'));
      } catch (e) {
        console.warn('[mapCapture] 캡처 실패:', e);
        finish(null);
      }
    });
    map.render(); // 렌더 사이클 유도 — rendercomplete는 새 뷰 타일 로드 완료 후 발화
    setTimeout(() => finish(null), timeout); // 안전망
  });
}
