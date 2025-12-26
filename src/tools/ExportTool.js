/**
 * ExportTool - 지도 내보내기 도구
 * html2canvas와 jsPDF를 사용하여 PNG/JPG/PDF로 내보내기
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
   * 지도 내보내기
   * @param {Object} options - 내보내기 옵션
   */
  async exportMap(options = {}) {
    const {
      format = 'png',
      filename = 'eGIS_map',
      quality = 0.92,
      scale = 2,
      includeLegend = false,
      noBasemap = false
    } = options;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('지도 요소를 찾을 수 없습니다.');
    }

    const map = mapManager.getMap();
    let hiddenLayers = [];

    // 배경 지도 제외 옵션 처리
    if (noBasemap && map) {
      map.getLayers().forEach(layer => {
        // 타일 레이어(배경 지도)만 숨김
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

    // 지도 렌더링 완료 대기
    await this.waitForMapRender();

    try {
      // html2canvas로 지도 캡처
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: scale,
        logging: false,
        backgroundColor: noBasemap ? null : '#ffffff'
      });

      // 숨겼던 레이어 복원
      hiddenLayers.forEach(layer => layer.setVisible(true));
      if (hiddenLayers.length > 0 && map) {
        map.renderSync();
      }

      // 포맷에 따라 내보내기
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
      // 에러 발생 시에도 숨긴 레이어 복원
      hiddenLayers.forEach(layer => layer.setVisible(true));
      console.error('내보내기 실패:', error);
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

    // 캔버스 크기에 맞게 PDF 생성
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 또는 캔버스 비율에 맞는 PDF 크기 결정
    const pdfWidth = imgWidth > imgHeight ? imgWidth : imgWidth;
    const pdfHeight = imgWidth > imgHeight ? imgHeight : imgHeight;

    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pdfWidth, pdfHeight]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
