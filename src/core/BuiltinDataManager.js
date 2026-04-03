// © 2026 김용현
/**
 * BuiltinDataManager - 내장 데이터 카탈로그 및 로딩
 * 공간정보(GeoJSON) + 속성정보(XLSX) 모두 JSON 카탈로그에서 자동 로드
 *
 * 파일 추가 후 npm run catalog 실행하면 카탈로그 자동 생성
 */

import { geojsonLoader } from '../loaders/GeoJSONLoader.js';
import * as XLSX from 'xlsx';

const BUILTIN_BASE = './data/builtin/';

class BuiltinDataManager {
  constructor() {
    this.spatialCatalog = [];
    this.attributeCatalog = [];
    this._loaded = false;
  }

  /**
   * 카탈로그 로드 (공간+속성 모두)
   */
  async loadCatalogs() {
    if (this._loaded) return;

    const [spatialResp, attrResp] = await Promise.allSettled([
      fetch(BUILTIN_BASE + 'spatial_catalog.json'),
      fetch(BUILTIN_BASE + 'attribute_catalog.json')
    ]);

    if (spatialResp.status === 'fulfilled' && spatialResp.value.ok) {
      this.spatialCatalog = await spatialResp.value.json();
    }
    if (attrResp.status === 'fulfilled' && attrResp.value.ok) {
      this.attributeCatalog = await attrResp.value.json();
    }

    this._loaded = true;
  }

  getSpatialCatalog() {
    return this.spatialCatalog;
  }

  getAttributeCatalog() {
    return this.attributeCatalog;
  }

  /**
   * 키워드 검색 (공간+속성)
   */
  search(keyword) {
    const kw = keyword.toLowerCase();
    const matchSpatial = this.spatialCatalog.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      d.description.toLowerCase().includes(kw) ||
      (d.tags || []).some(t => t.toLowerCase().includes(kw))
    ).map(d => ({ ...d, dataType: 'spatial' }));

    const matchAttr = this.attributeCatalog.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      d.description.toLowerCase().includes(kw) ||
      (d.columns || []).some(c => c.toLowerCase().includes(kw))
    ).map(d => ({ ...d, dataType: 'attribute' }));

    return [...matchSpatial, ...matchAttr];
  }

  /**
   * 공간정보 로드 → 레이어로 추가
   */
  async loadSpatial(datasetId) {
    const dataset = this.spatialCatalog.find(d => d.id === datasetId);
    if (!dataset) throw new Error('데이터셋을 찾을 수 없습니다: ' + datasetId);
    const url = BUILTIN_BASE + dataset.file;
    return await geojsonLoader.loadFromUrl(url, dataset.name);
  }

  /**
   * 속성정보 XLSX 로드 → 파싱된 데이터 반환
   */
  async loadAttribute(datasetId) {
    const dataset = this.attributeCatalog.find(d => d.id === datasetId);
    if (!dataset) throw new Error('속성 데이터를 찾을 수 없습니다: ' + datasetId);

    const url = BUILTIN_BASE + dataset.file;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('파일을 찾을 수 없습니다: ' + dataset.file);

    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    if (jsonData.length < 2) throw new Error('데이터가 없습니다.');

    const headers = jsonData[0].map(h => String(h || '').trim()).filter(h => h);
    const data = [];
    for (let i = 1; i < jsonData.length; i++) {
      const values = jsonData[i];
      if (!values || values.length === 0) continue;
      const row = {};
      headers.forEach((header, idx) => {
        const val = values[idx];
        if (val === undefined || val === null) row[header] = '';
        else if (typeof val === 'number') row[header] = val;
        else {
          const num = parseFloat(val);
          row[header] = (!isNaN(num) && String(val).trim() !== '') ? num : String(val);
        }
      });
      data.push(row);
    }

    return { headers, data, fileName: dataset.name, dataset };
  }
}

export const builtinDataManager = new BuiltinDataManager();
