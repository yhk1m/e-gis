/**
 * ExportTool - 지도 내보내기 도구 (확장 버전)
 * html2canvas와 jsPDF를 사용하여 PNG/JPG/PDF로 내보내기
 * 제목, 축척, 방위표, 범례, 텍스트 박스 오버레이 지원
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { mapManager } from '../core/MapManager.js';

class ExportTool {
  constructor() {
    this.formats = [
      { value: 'png', label: 'PNG 이미지' },
      { value: 'jpg', label: 'JPG 이미지' },
      { value: 'pdf', label: 'PDF 문서' }
    ];
  }

  /**
   * 오버레이 포함 지도 내보내기
   */
  async exportMapWithOverlays(options = {}) {
    const {
      format = 'png',
      filename = 'e-GIS_map',
      quality = 0.92,
      scale = 2,
      overlays = {},
      includeBasemap = true
    } = options;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('지도 요소를 찾을 수 없습니다.');
    }

    const map = mapManager.getMap();
    const baseLayer = mapManager.baseLayer;
    const restoreBasemap = !includeBasemap && baseLayer && baseLayer.getVisible();

    if (restoreBasemap) {
      baseLayer.setVisible(false);
      if (map) map.renderSync();
    }

    // 지도 렌더링 완료 대기
    await this.waitForMapRender();
    document.body.classList.add('exporting');

    try {
      // html2canvas로 지도 캡처
      const mapCanvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: scale,
        logging: false,
        backgroundColor: includeBasemap ? '#ffffff' : null
      });

      // 오버레이 그리기
      const finalCanvas = this.drawOverlays(mapCanvas, overlays, scale);

      // 포맷에 따라 내보내기
      switch (format) {
        case 'png':
          this.downloadAsPNG(finalCanvas, filename);
          break;
        case 'jpg':
          this.downloadAsJPG(finalCanvas, filename, quality);
          break;
        case 'pdf':
          this.downloadAsPDF(finalCanvas, filename);
          break;
        default:
          throw new Error('지원하지 않는 형식입니다.');
      }

      return { success: true, format, filename };
    } catch (error) {
      console.error('내보내기 실패:', error);
      throw error;
    } finally {
      document.body.classList.remove('exporting');
      if (restoreBasemap) {
        baseLayer.setVisible(true);
        if (map) map.renderSync();
      }
    }
  }

  /**
   * 오버레이 그리기
   */
  drawOverlays(sourceCanvas, overlays, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    // 원본 지도 그리기
    ctx.drawImage(sourceCanvas, 0, 0);

    const width = canvas.width;
    const height = canvas.height;
    const s = scale; // 스케일 팩터

    // 제목
    if (overlays.title) {
      this.drawTitle(ctx, overlays.title, width, height, s);
    }

    // 방위표
    if (overlays.compass) {
      this.drawCompass(ctx, overlays.compass, width, height, s);
    }

    // 범례
    if (overlays.legend) {
      this.drawLegend(ctx, overlays.legend, width, height, s);
    }

    // 텍스트 박스
    if (overlays.textBox) {
      this.drawTextBox(ctx, overlays.textBox, width, height, s);
    }

    return canvas;
  }

  /**
   * 제목 그리기
   */
  drawTitle(ctx, options, width, height, scale) {
    const {
      text,
      fontSize = 24,
      fontWeight = 'bold',
      fontFamily = 'Malgun Gothic',
      color = '#333333',
      background = true,
      backgroundColor = '#ffffff',
      backgroundOpacity = 0.85,
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.3)',
      stroke = false,
      strokeColor = '#ffffff',
      strokeWidth = 2,
      x = 0.5,
      y = 0.08
    } = options;

    const scaledFontSize = fontSize * scale;
    const posX = x * width;
    const posY = y * height;

    ctx.save();

    // 배경
    ctx.font = `${fontWeight} ${scaledFontSize}px "${fontFamily}", sans-serif`;
    if (background) {
      const textWidth = ctx.measureText(text).width + 40 * scale;
      ctx.fillStyle = this.hexToRgba(backgroundColor, backgroundOpacity);
      ctx.fillRect(posX - textWidth / 2, posY - scaledFontSize / 2 - 10 * scale, textWidth, scaledFontSize + 20 * scale);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 그림자
    if (shadow) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 6 * scale;
      ctx.shadowOffsetX = 3 * scale;
      ctx.shadowOffsetY = 3 * scale;
    }

    // 테두리
    if (stroke) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * scale;
      ctx.strokeText(text, posX, posY);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, posX, posY);

    ctx.restore();
  }

  /**
   * 축척 바 그리기
   */
  drawScaleBar(ctx, options, width, height, scale) {
    const map = mapManager.getMap();
    if (!map) return;

    const {
      fontSize = 12,
      fontFamily = 'Malgun Gothic',
      color = '#333333',
      background = true,
      backgroundColor = '#ffffff',
      backgroundOpacity = 0.85,
      x = 0.05,
      y = 0.92
    } = options;

    // 현재 뷰에서 축척 계산
    const view = map.getView();
    const resolution = view.getResolution();
    const mpu = view.getProjection().getMetersPerUnit();
    const metersPerPixel = resolution * mpu;

    // 적절한 축척 값 선택
    const scaleOptions = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
    const targetWidth = 100 * scale;
    let scaleValue = scaleOptions[0];
    let barWidth = targetWidth;

    for (const opt of scaleOptions) {
      const w = opt / metersPerPixel;
      if (w >= 50 * scale && w <= 200 * scale) {
        scaleValue = opt;
        barWidth = w;
        break;
      }
    }

    const posX = x * width;
    const posY = y * height;
    const barHeight = 8 * scale;
    const scaledFontSize = fontSize * scale;

    // 배경
    ctx.save();
    if (background) {
      ctx.fillStyle = this.hexToRgba(backgroundColor, backgroundOpacity);
      ctx.fillRect(posX - 5 * scale, posY - 25 * scale, barWidth + 20 * scale, 45 * scale);
    }

    // 축척 바
    ctx.fillStyle = '#333';
    ctx.fillRect(posX, posY, barWidth, barHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(posX, posY, barWidth / 2, barHeight);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = scale;
    ctx.strokeRect(posX, posY, barWidth, barHeight);

    // 눈금
    ctx.beginPath();
    ctx.moveTo(posX, posY - 3 * scale);
    ctx.lineTo(posX, posY + barHeight + 3 * scale);
    ctx.moveTo(posX + barWidth / 2, posY - 3 * scale);
    ctx.lineTo(posX + barWidth / 2, posY + barHeight + 3 * scale);
    ctx.moveTo(posX + barWidth, posY - 3 * scale);
    ctx.lineTo(posX + barWidth, posY + barHeight + 3 * scale);
    ctx.stroke();

    // 레이블
    ctx.fillStyle = color;
    ctx.font = `${scaledFontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('0', posX, posY - 8 * scale);
    ctx.fillText(this.formatDistance(scaleValue / 2), posX + barWidth / 2, posY - 8 * scale);
    ctx.fillText(this.formatDistance(scaleValue), posX + barWidth, posY - 8 * scale);

    ctx.restore();
  }

  /**
   * 미리보기용 지도 캡처
   */
  async captureMap({ scale = 1.5, includeBasemap = true } = {}) {
    const mapElement = document.getElementById('map');
    if (!mapElement) return null;

    const map = mapManager.getMap();
    const baseLayer = mapManager.baseLayer;
    const restoreBasemap = !includeBasemap && baseLayer && baseLayer.getVisible();

    if (restoreBasemap) {
      baseLayer.setVisible(false);
      if (map) map.renderSync();
    }

    await this.waitForMapRender();
    document.body.classList.add('exporting');

    try {
      return await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale,
        logging: false,
        backgroundColor: includeBasemap ? '#ffffff' : null
      });
    } finally {
      document.body.classList.remove('exporting');
      if (restoreBasemap) {
        baseLayer.setVisible(true);
        if (map) map.renderSync();
      }
    }
  }

  hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * 거리 포맷
   */
  formatDistance(meters) {
    if (meters >= 1000) {
      return (meters / 1000) + ' km';
    }
    return meters + ' m';
  }

  /**
   * 방위표 그리기
   */
  drawCompass(ctx, options, width, height, scale) {
    const { size = 50, x = 0.92, y = 0.12, style = 'basic', image = null } = options;
    const s = size * scale;
    const cx = x * width;
    const cy = y * height;

    ctx.save();

    // 지도 방위(뷰 회전)와 연동 — 화면 나침반(transform: rotate(-rotation))과 동일하게
    // 나침반 중심을 기준으로 -rotation 만큼 회전시켜 N이 실제 북쪽을 가리키게 한다.
    const rotation = mapManager.getMap()?.getView().getRotation() || 0;
    if (rotation) {
      ctx.translate(cx, cy);
      ctx.rotate(-rotation);
      ctx.translate(-cx, -cy);
    }

    if (style === 'custom') {
      // 커스텀 이미지 방위표 — 지름(2s)에 맞춰 비율 유지하며 중앙 배치.
      // 이미지가 아직 없으면 아무것도 그리지 않음.
      if (image && image.complete && image.naturalWidth > 0) {
        const maxDim = s * 2;
        const iw = image.naturalWidth;
        const ih = image.naturalHeight;
        const ratio = Math.min(maxDim / iw, maxDim / ih);
        const dw = iw * ratio;
        const dh = ih * ratio;
        ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
      }
    } else if (style === 'arrow') {
      this._drawCompassArrow(ctx, cx, cy, s, scale);
    } else if (style === 'rose') {
      this._drawCompassRose(ctx, cx, cy, s, scale);
    } else if (style === 'classic') {
      this._drawCompassClassic(ctx, cx, cy, s, scale);
    } else {
      this._drawCompassBasic(ctx, cx, cy, s, scale);
    }

    ctx.restore();
  }

  _drawCompassBasic(ctx, cx, cy, s, scale) {
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.2, cy);
    ctx.lineTo(cx, cy - s * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#d32f2f'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.2, cy);
    ctx.lineTo(cx, cy - s * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#b71c1c'; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.lineTo(cx - s * 0.2, cy);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = scale;
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.lineTo(cx + s * 0.2, cy);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#eee'; ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = `bold ${14 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - s - 10 * scale);
  }

  _drawCompassArrow(ctx, cx, cy, s, scale) {
    // 굵은 화살표 + N
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s * 0.35, cy + s * 0.6);
    ctx.lineTo(cx, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.35, cy + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s * 0.5}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - s * 0.35);
  }

  _drawCompassRose(ctx, cx, cy, s, scale) {
    // 8방위 별
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = scale;
    ctx.stroke();

    const tips = 8;
    for (let i = 0; i < tips; i++) {
      const ang = (i * Math.PI * 2) / tips - Math.PI / 2;
      const ang1 = ang - Math.PI / tips;
      const ang2 = ang + Math.PI / tips;
      const long = i % 2 === 0 ? s * 0.95 : s * 0.55;
      const short = s * 0.18;
      const tipX = cx + Math.cos(ang) * long;
      const tipY = cy + Math.sin(ang) * long;
      const sxA = cx + Math.cos(ang1) * short;
      const syA = cy + Math.sin(ang1) * short;
      const sxB = cx + Math.cos(ang2) * short;
      const syB = cy + Math.sin(ang2) * short;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(sxA, syA);
      ctx.lineTo(cx, cy);
      ctx.lineTo(sxB, syB);
      ctx.closePath();
      ctx.fillStyle = i === 0 ? '#d32f2f' : (i % 2 === 0 ? '#333' : '#aaa');
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();
    }

    ctx.fillStyle = '#222';
    ctx.font = `bold ${12 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - s - 8 * scale);
  }

  _drawCompassClassic(ctx, cx, cy, s, scale) {
    // 두 겹 원 + 4방위 화살표 + 눈금
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = scale;
    ctx.stroke();

    // 4방위 다이아몬드
    const dirs = [
      { ang: -Math.PI / 2, color: '#c0392b' },
      { ang: 0, color: '#444' },
      { ang: Math.PI / 2, color: '#999' },
      { ang: Math.PI, color: '#444' }
    ];
    dirs.forEach(d => {
      const tipX = cx + Math.cos(d.ang) * s * 0.85;
      const tipY = cy + Math.sin(d.ang) * s * 0.85;
      const left = d.ang + Math.PI / 2;
      const lxA = cx + Math.cos(left) * s * 0.12;
      const lyA = cy + Math.sin(left) * s * 0.12;
      const lxB = cx - Math.cos(left) * s * 0.12;
      const lyB = cy - Math.sin(left) * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(lxA, lyA);
      ctx.lineTo(cx, cy);
      ctx.lineTo(lxB, lyB);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();
    });

    // 작은 눈금
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI * 2) / 16;
      const inner = s * 0.78;
      const outer = i % 4 === 0 ? s * 0.95 : s * 0.86;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
      ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.7 * scale;
      ctx.stroke();
    }

    ctx.fillStyle = '#222';
    ctx.font = `bold ${11 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - s * 1.05 - 6 * scale);
    ctx.fillText('S', cx, cy + s * 1.05 + 6 * scale);
    ctx.fillText('E', cx + s * 1.05 + 6 * scale, cy);
    ctx.fillText('W', cx - s * 1.05 - 6 * scale, cy);
  }

  /**
   * 범례 그리기
   *
   * 박스 왼쪽 위 모서리가 (x, y) 기준 — 제목·방위표와 같은 비율 좌표라 드래그 코드를
   * 그대로 쓴다. 폭·높이는 내용에 맞춰 재므로, 히트 테스트가 쓸 수 있도록 실제로 그린
   * 사각형을 돌려준다.
   *
   * @param {Object} options - { models, headerText, showHeader, 스타일…, x, y }
   *   models: legendModel.buildLegendModel의 결과 배열
   * @returns {{x, y, w, h}|null} 그려진 박스 (캔버스 픽셀). 그릴 게 없으면 null.
   */
  drawLegend(ctx, options, width, height, scale) {
    const {
      models,
      headerText = '범례',
      showHeader = true,
      fontSize = 12,
      fontFamily = 'Malgun Gothic',
      color = '#333333',
      background = true,
      backgroundColor = '#ffffff',
      backgroundOpacity = 0.9,
      x = 0.78,
      y = 0.5
    } = options;

    if (!models || models.length === 0) return null;

    const pad = 10 * scale;
    const fs = fontSize * scale;
    const rowH = fs * 1.6;          // 항목 한 줄 높이
    const symbolW = 16 * scale;     // 기호 칸 폭
    const gap = 6 * scale;          // 기호와 라벨 사이
    const indent = 8 * scale;       // 묶음 레이어의 구간 들여쓰기

    const headerFont = `bold ${fs}px "${fontFamily}", sans-serif`;
    const titleFont = `bold ${fs * 0.95}px "${fontFamily}", sans-serif`;
    const labelFont = `${fs * 0.9}px "${fontFamily}", sans-serif`;

    // 1) 레이아웃 계산 — 그리기 전에 박스 크기를 확정한다.
    const rows = [];
    let maxTextW = 0;

    if (showHeader && headerText) {
      ctx.font = headerFont;
      maxTextW = Math.max(maxTextW, ctx.measureText(headerText).width);
      rows.push({ kind: 'header', text: headerText });
    }

    models.forEach(model => {
      if (model.grouped) {
        ctx.font = titleFont;
        maxTextW = Math.max(maxTextW, ctx.measureText(model.title).width);
        rows.push({ kind: 'title', text: model.title });

        ctx.font = labelFont;
        model.items.forEach(item => {
          maxTextW = Math.max(maxTextW, indent + symbolW + gap + ctx.measureText(item.label).width);
          rows.push({ kind: 'item', text: item.label, symbol: item.symbol, indent: true });
        });
      } else {
        ctx.font = labelFont;
        model.items.forEach(item => {
          maxTextW = Math.max(maxTextW, symbolW + gap + ctx.measureText(item.label).width);
          rows.push({ kind: 'item', text: item.label, symbol: item.symbol, indent: false });
        });
      }
    });

    const boxW = maxTextW + pad * 2;
    const boxH = rows.length * rowH + pad * 2;
    const boxX = x * width;
    const boxY = y * height;

    ctx.save();

    // 2) 배경
    if (background) {
      ctx.fillStyle = this.hexToRgba(backgroundColor, backgroundOpacity);
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = scale;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    // 3) 줄 그리기
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    rows.forEach((row, i) => {
      const cy = boxY + pad + i * rowH + rowH / 2;

      if (row.kind === 'header' || row.kind === 'title') {
        ctx.fillStyle = color;
        ctx.font = row.kind === 'header' ? headerFont : titleFont;
        ctx.fillText(row.text, boxX + pad, cy);
        return;
      }

      const symX = boxX + pad + (row.indent ? indent : 0);
      this.drawLegendSymbol(ctx, row.symbol, symX, cy, symbolW, rowH, scale);

      ctx.fillStyle = color;
      ctx.font = labelFont;
      ctx.fillText(row.text, symX + symbolW + gap, cy);
    });

    ctx.restore();

    return { x: boxX, y: boxY, w: boxW, h: boxH };
  }

  /**
   * 범례 항목의 기호 하나 — 도형 종류에 맞춰 그린다.
   * 지도와 같아 보이도록 레이어 스타일(색·투명도·테두리 굵기·점선)을 그대로 쓴다.
   */
  drawLegendSymbol(ctx, symbol, x, cy, boxW, rowH, scale) {
    const {
      kind,
      fillColor = '#3b82f6',
      fillOpacity = 0.3,
      strokeColor = '#3b82f6',
      strokeOpacity = 1,
      strokeWidth = 2,
      strokeDash = 'solid',
      pointRadius = 6
    } = symbol || {};

    ctx.save();
    ctx.fillStyle = this.hexToRgba(fillColor, fillOpacity);
    ctx.strokeStyle = this.hexToRgba(strokeColor, strokeOpacity);
    // 기호가 칸을 넘지 않게 테두리 굵기를 제한한다.
    ctx.lineWidth = Math.max(0.5, Math.min(strokeWidth, 3)) * scale;
    ctx.setLineDash(this.dashPattern(strokeDash, scale));

    if (kind === 'point') {
      // 실제 반지름을 쓰되 칸 안에 들어오게 줄인다.
      const r = Math.min(pointRadius * scale * 0.7, boxW / 2);
      ctx.beginPath();
      ctx.arc(x + boxW / 2, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + boxW, cy);
      ctx.stroke();
    } else {
      const h = Math.min(boxW * 0.75, rowH * 0.7);
      const top = cy - h / 2;
      ctx.fillRect(x, top, boxW, h);
      ctx.strokeRect(x, top, boxW, h);
    }

    ctx.restore();
  }

  /**
   * strokeDash 이름 → 캔버스 점선 패턴.
   * LayerManager의 STROKE_DASH_OPTIONS와 같은 값을 캔버스 배율에 맞춘다.
   */
  dashPattern(strokeDash, scale) {
    const patterns = {
      dashed: [10, 10],
      dotted: [2, 6],
      'dash-dot': [10, 5, 2, 5]
    };
    const p = patterns[strokeDash];
    return p ? p.map(v => v * scale) : [];
  }

  /**
   * 텍스트 박스 그리기
   */
  drawTextBox(ctx, options, width, height, scale) {
    const {
      text,
      fontSize = 12,
      fontWeight = 'normal',
      fontFamily = 'Malgun Gothic',
      color = '#333333',
      background = true,
      backgroundColor = '#ffffff',
      backgroundOpacity = 0.9,
      shadow = false,
      stroke = false,
      strokeColor = '#ffffff',
      strokeWidth = 1,
      x = 0.5,
      y = 0.85
    } = options;

    if (!text) return;

    const padding = 10 * scale;
    const lines = text.split('\n').map(l => l.substring(0, 60));
    const scaledFontSize = fontSize * scale;
    const lineHeight = (fontSize + 4) * scale;

    const posX = x * width;
    const posY = y * height;

    ctx.save();

    ctx.font = `${fontWeight} ${scaledFontSize}px "${fontFamily}", sans-serif`;

    const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxWidth = maxLineWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding;
    const boxX = posX - boxWidth / 2;
    const boxY = posY - boxHeight / 2;

    // 배경
    if (background) {
      ctx.fillStyle = this.hexToRgba(backgroundColor, backgroundOpacity);
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 그림자
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4 * scale;
      ctx.shadowOffsetX = 2 * scale;
      ctx.shadowOffsetY = 2 * scale;
    }

    const firstLineY = posY - (lines.length - 1) * lineHeight / 2;

    // 텍스트
    lines.forEach((line, index) => {
      const lineY = firstLineY + index * lineHeight;

      if (stroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * scale;
        ctx.strokeText(line, posX, lineY);
      }

      ctx.fillStyle = color;
      ctx.fillText(line, posX, lineY);
    });

    ctx.restore();
  }


  /**
   * 지도 내보내기 (기본 버전 - 하위 호환)
   */
  async exportMap(options = {}) {
    const {
      format = 'png',
      filename = 'e-GIS_map',
      quality = 0.92,
      scale = 2,
      noBasemap = false
    } = options;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('지도 요소를 찾을 수 없습니다.');
    }

    const map = mapManager.getMap();
    let hiddenLayers = [];

    if (noBasemap && map) {
      map.getLayers().forEach(layer => {
        if (layer.constructor.name === 'TileLayer' ||
            (layer.getSource && layer.getSource().constructor.name.includes('Tile'))) {
          if (layer.getVisible()) {
            hiddenLayers.push(layer);
            layer.setVisible(false);
          }
        }
      });
      map.renderSync();
    }

    await this.waitForMapRender();

    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: scale,
        logging: false,
        backgroundColor: noBasemap ? null : '#ffffff'
      });

      hiddenLayers.forEach(layer => layer.setVisible(true));
      if (hiddenLayers.length > 0 && map) {
        map.renderSync();
      }

      switch (format) {
        case 'png':
          this.downloadAsPNG(canvas, filename);
          break;
        case 'jpg':
          this.downloadAsJPG(canvas, filename, quality);
          break;
        case 'pdf':
          this.downloadAsPDF(canvas, filename);
          break;
        default:
          throw new Error('지원하지 않는 형식입니다.');
      }

      return { success: true, format, filename };
    } catch (error) {
      hiddenLayers.forEach(layer => layer.setVisible(true));
      throw error;
    }
  }

  /**
   * 지도 렌더링 완료 대기
   */
  waitForMapRender() {
    return new Promise((resolve) => {
      const map = mapManager.getMap();
      if (map) {
        map.once('rendercomplete', resolve);
        map.renderSync();
      } else {
        resolve();
      }
    });
  }

  /**
   * PNG로 다운로드
   */
  downloadAsPNG(canvas, filename) {
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * JPG로 다운로드
   */
  downloadAsJPG(canvas, filename, quality) {
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', quality);
    link.click();
  }

  /**
   * PDF로 다운로드
   */
  downloadAsPDF(canvas, filename) {
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [imgWidth, imgHeight]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
  }

  /**
   * 사용 가능한 포맷 목록
   */
  getFormats() {
    return this.formats;
  }
}

export const exportTool = new ExportTool();
