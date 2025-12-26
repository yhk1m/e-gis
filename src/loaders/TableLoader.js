/**
 * TableLoader - CSV/XLSX 파일을 포인트 레이어로 변환
 * 위도/경도 컬럼을 선택하여 공간 데이터로 변환
 */

import * as XLSX from 'xlsx';
import { layerManager } from '../core/LayerManager.js';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';

class TableLoader {
  constructor() {
    this.data = null;
    this.headers = null;
    this.fileName = null;
  }

  /**
   * CSV 파일 파싱
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("CSV 파일에 데이터가 없습니다.");
    }

    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = this.parseCSVLine(lines[0], delimiter);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line, delimiter);
      const row = {};

      headers.forEach((header, idx) => {
        let value = values[idx] || "";
        const num = parseFloat(value);
        if (!isNaN(num) && value.trim() !== "") {
          row[header] = num;
        } else {
          row[header] = value;
        }
      });

      data.push(row);
    }

    return { headers, data };
  }

  /**
   * CSV 라인 파싱 (따옴표 처리)
   */
  parseCSVLine(line, delimiter) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * XLSX 파일 파싱
   */
  parseXLSX(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      throw new Error("XLSX 파일에 데이터가 없습니다.");
    }

    const headers = jsonData[0].map(h => String(h || '').trim());

    const data = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = {};
      const values = jsonData[i];

      if (!values || values.length === 0) continue;

      headers.forEach((header, idx) => {
        if (header) {
          let value = values[idx];
          if (value === undefined || value === null) {
            row[header] = "";
          } else if (typeof value === 'number') {
            row[header] = value;
          } else {
            const num = parseFloat(value);
            if (!isNaN(num) && String(value).trim() !== "") {
              row[header] = num;
            } else {
              row[header] = String(value);
            }
          }
        }
      });

      data.push(row);
    }

    return { headers: headers.filter(h => h), data };
  }

  /**
   * 파일 로드
   */
  async loadFile(file) {
    this.fileName = file.name.replace(/\.[^/.]+$/, "");
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          let result;
          if (isExcel) {
            result = this.parseXLSX(e.target.result);
          } else {
            result = this.parseCSV(e.target.result);
          }
          this.data = result.data;
          this.headers = result.headers;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("파일 읽기 실패"));

      if (isExcel) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, "UTF-8");
      }
    });
  }

  /**
   * 숫자형 컬럼 찾기 (좌표 후보)
   */
  getNumericColumns() {
    if (!this.data || this.data.length === 0) return [];

    return this.headers.filter(header => {
      // 첫 10개 행 확인
      const sampleRows = this.data.slice(0, 10);
      return sampleRows.every(row => {
        const val = row[header];
        return val === "" || val === null || val === undefined || typeof val === 'number';
      });
    });
  }

  /**
   * 좌표 컬럼 자동 감지
   */
  detectCoordinateColumns() {
    const latPatterns = ['lat', 'latitude', '위도', 'y', 'ycoord', 'lat_wgs84'];
    const lonPatterns = ['lon', 'lng', 'longitude', '경도', 'x', 'xcoord', 'lon_wgs84', 'long'];

    let latCol = null;
    let lonCol = null;

    const numericCols = this.getNumericColumns();

    for (const col of numericCols) {
      const lowerCol = col.toLowerCase();

      if (!latCol && latPatterns.some(p => lowerCol.includes(p))) {
        latCol = col;
      }
      if (!lonCol && lonPatterns.some(p => lowerCol.includes(p))) {
        lonCol = col;
      }
    }

    return { latColumn: latCol, lonColumn: lonCol };
  }

  /**
   * 포인트 레이어 생성
   */
  createPointLayer(latColumn, lonColumn, layerName = null) {
    if (!this.data || !latColumn || !lonColumn) {
      throw new Error("데이터와 좌표 컬럼을 지정해주세요.");
    }

    const features = [];
    let skippedCount = 0;

    for (const row of this.data) {
      const lat = parseFloat(row[latColumn]);
      const lon = parseFloat(row[lonColumn]);

      if (isNaN(lat) || isNaN(lon)) {
        skippedCount++;
        continue;
      }

      // 위도/경도 범위 확인
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        skippedCount++;
        continue;
      }

      const coords = fromLonLat([lon, lat]);
      const point = new Point(coords);

      const feature = new Feature({
        geometry: point
      });

      // 모든 속성 추가
      for (const [key, value] of Object.entries(row)) {
        if (key !== latColumn && key !== lonColumn) {
          feature.set(key, value);
        }
      }
      // 좌표도 속성으로 저장
      feature.set(latColumn, lat);
      feature.set(lonColumn, lon);

      features.push(feature);
    }

    if (features.length === 0) {
      throw new Error("유효한 좌표가 있는 행이 없습니다.");
    }

    const name = layerName || this.fileName || '좌표 레이어';

    const layerId = layerManager.addLayer({
      name: name,
      features: features,
      geometryType: 'Point'
    });

    return {
      layerId,
      featureCount: features.length,
      skippedCount,
      layerName: name
    };
  }

  /**
   * 데이터 초기화
   */
  clear() {
    this.data = null;
    this.headers = null;
    this.fileName = null;
  }
}

export const tableLoader = new TableLoader();
