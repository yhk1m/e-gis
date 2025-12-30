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
      overlays = {}
    } = options;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('지도 요소를 찾을 수 없습니다.');
    }

    // 지도 렌더링 완료 대기
    await this.waitForMapRender();

    try {
      // html2canvas로 지도 캡처
      const mapCanvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: scale,
        logging: false,
        backgroundColor: '#ffffff'
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
      this.drawTitle(ctx, overlays.title, width, s);
    }

    // 축척 바
    if (overlays.scaleBar) {
      this.drawScaleBar(ctx, width, height, s);
    }

    // 방위표
    if (overlays.compass) {
      this.drawCompass(ctx, overlays.compass, width, s);
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
  drawTitle(ctx, options, width, scale) {
    const { text, fontSize = 24 } = options;
    const scaledFontSize = fontSize * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, width, (scaledFontSize + 20 * scale));

    ctx.fillStyle = '#333';
    ctx.font = `bold ${scaledFontSize}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, (scaledFontSize / 2) + 10 * scale);
    ctx.restore();
  }

  /**
   * 축척 바 그리기
   */
  drawScaleBar(ctx, width, height, scale) {
    const map = mapManager.getMap();
    if (!map) return;

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

    const x = 20 * scale;
    const y = height - 30 * scale;
    const barHeight = 8 * scale;

    // 배경
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x - 5 * scale, y - 25 * scale, barWidth + 20 * scale, 45 * scale);

    // 축척 바
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, barWidth / 2, barHeight);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = scale;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // 눈금
    ctx.beginPath();
    ctx.moveTo(x, y - 3 * scale);
    ctx.lineTo(x, y + barHeight + 3 * scale);
    ctx.moveTo(x + barWidth / 2, y - 3 * scale);
    ctx.lineTo(x + barWidth / 2, y + barHeight + 3 * scale);
    ctx.moveTo(x + barWidth, y - 3 * scale);
    ctx.lineTo(x + barWidth, y + barHeight + 3 * scale);
    ctx.stroke();

    // 레이블
    ctx.fillStyle = '#333';
    ctx.font = `${12 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('0', x, y - 8 * scale);
    ctx.fillText(this.formatDistance(scaleValue / 2), x + barWidth / 2, y - 8 * scale);
    ctx.fillText(this.formatDistance(scaleValue), x + barWidth, y - 8 * scale);

    ctx.restore();
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
  drawCompass(ctx, options, width, scale) {
    const { size = 50 } = options;
    const scaledSize = size * scale;
    const cx = width - scaledSize - 20 * scale;
    const cy = scaledSize + 20 * scale;

    ctx.save();

    // 배경 원
    ctx.beginPath();
    ctx.arc(cx, cy, scaledSize, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // 북쪽 화살표 (빨강)
    ctx.beginPath();
    ctx.moveTo(cx, cy - scaledSize * 0.7);
    ctx.lineTo(cx - scaledSize * 0.2, cy);
    ctx.lineTo(cx, cy - scaledSize * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#d32f2f';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy - scaledSize * 0.7);
    ctx.lineTo(cx + scaledSize * 0.2, cy);
    ctx.lineTo(cx, cy - scaledSize * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#b71c1c';
    ctx.fill();

    // 남쪽 화살표 (흰색)
    ctx.beginPath();
    ctx.moveTo(cx, cy + scaledSize * 0.7);
    ctx.lineTo(cx - scaledSize * 0.2, cy);
    ctx.lineTo(cx, cy + scaledSize * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = scale;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy + scaledSize * 0.7);
    ctx.lineTo(cx + scaledSize * 0.2, cy);
    ctx.lineTo(cx, cy + scaledSize * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#eee';
    ctx.fill();
    ctx.stroke();

    // N 글자
    ctx.fillStyle = '#333';
    ctx.font = `bold ${14 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - scaledSize - 10 * scale);

    ctx.restore();
  }

  /**
   * 범례 그리기
   */
  drawLegend(ctx, options, width, height, scale) {
    const { layers } = options;
    if (!layers || layers.length === 0) return;

    const padding = 10 * scale;
    const itemHeight = 20 * scale;
    const legendWidth = 120 * scale;
    const legendHeight = (layers.length * itemHeight) + padding * 3;

    const x = width - legendWidth - 20 * scale;
    const y = 100 * scale;

    ctx.save();

    // 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x, y, legendWidth, legendHeight);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = scale;
    ctx.strokeRect(x, y, legendWidth, legendHeight);

    // 제목
    ctx.fillStyle = '#333';
    ctx.font = `bold ${12 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('범례', x + padding, y + padding + 10 * scale);

    // 레이어 항목
    layers.forEach((layer, index) => {
      const itemY = y + padding * 2 + 10 * scale + (index * itemHeight);

      // 색상 박스
      ctx.fillStyle = layer.color;
      ctx.fillRect(x + padding, itemY, 14 * scale, 14 * scale);
      ctx.strokeStyle = '#666';
      ctx.strokeRect(x + padding, itemY, 14 * scale, 14 * scale);

      // 레이어 이름
      ctx.fillStyle = '#333';
      ctx.font = `${11 * scale}px "Malgun Gothic", sans-serif`;
      ctx.fillText(
        layer.name.length > 10 ? layer.name.substring(0, 10) + '...' : layer.name,
        x + padding + 18 * scale,
        itemY + 11 * scale
      );
    });

    ctx.restore();
  }

  /**
   * 텍스트 박스 그리기
   */
  drawTextBox(ctx, options, width, height, scale) {
    const { text } = options;
    if (!text) return;

    const padding = 10 * scale;
    const lines = text.split('\n');
    const lineHeight = 16 * scale;
    const boxWidth = Math.min(200 * scale, width * 0.4);
    const boxHeight = (lines.length * lineHeight) + padding * 2;

    const x = 20 * scale;
    const y = height - boxHeight - 60 * scale;

    ctx.save();

    // 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = scale;
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    // 텍스트
    ctx.fillStyle = '#333';
    ctx.font = `${12 * scale}px "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'left';

    lines.forEach((line, index) => {
      ctx.fillText(
        line.substring(0, 30),
        x + padding,
        y + padding + lineHeight * (index + 0.8)
      );
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
