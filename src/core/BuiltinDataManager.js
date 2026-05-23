// © 2026 김용현
/**
 * BuiltinDataManager - 내장 데이터 카탈로그 및 로딩
 * 공간정보(GeoJSON) + 속성정보(XLSX) 모두 JSON 카탈로그에서 자동 로드
 *
 * 파일 추가 후 npm run catalog 실행하면 카탈로그 자동 생성
 */

import { geojsonLoader } from '../loaders/GeoJSONLoader.js';
import { demLoader } from '../loaders/DEMLoader.js';
import * as XLSX from 'xlsx';

const BUILTIN_BASE = './data/builtin/';

class BuiltinDataManager {
  constructor() {
    this.spatialCatalog = [];
    this.attributeCatalog = [];
    this.rasterCatalog = [];
    this._loaded = false;
  }

  /**
   * 카탈로그 로드 (공간+속성+래스터)
   */
  async loadCatalogs() {
    if (this._loaded) return;

    const [spatialResp, attrResp, rasterResp] = await Promise.allSettled([
      fetch(BUILTIN_BASE + 'spatial_catalog.json'),
      fetch(BUILTIN_BASE + 'attribute_catalog.json'),
      fetch(BUILTIN_BASE + 'raster_catalog.json')
    ]);

    if (spatialResp.status === 'fulfilled' && spatialResp.value.ok) {
      this.spatialCatalog = await spatialResp.value.json();
    }
    if (attrResp.status === 'fulfilled' && attrResp.value.ok) {
      this.attributeCatalog = await attrResp.value.json();
    }
    if (rasterResp.status === 'fulfilled' && rasterResp.value.ok) {
      this.rasterCatalog = await rasterResp.value.json();
    }

    this._loaded = true;
  }

  getSpatialCatalog() {
    return this.spatialCatalog;
  }

  getAttributeCatalog() {
    return this.attributeCatalog;
  }

  getRasterCatalog() {
    return this.rasterCatalog;
  }

  /**
   * 래스터를 광역자치단체별로 그룹핑 (이름의 첫 단어가 광역자치단체)
   * @returns {Array<{ name: string, items: Array }>} 정렬된 그룹 목록
   */
  getRasterCatalogGrouped() {
    const PROVINCE_ORDER = [
      '서울특별시', '부산광역시', '대구광역시', '인천광역시',
      '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
      '경기도', '강원특별자치도', '강원도', '충청북도', '충청남도',
      '전북특별자치도', '전라북도', '전라남도',
      '경상북도', '경상남도', '제주특별자치도'
    ];

    const groups = {};
    for (const item of this.rasterCatalog) {
      const firstSpace = item.name.indexOf(' ');
      const group = firstSpace > 0 ? item.name.substring(0, firstSpace) : '기타';
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }

    const keys = Object.keys(groups).sort((a, b) => {
      const ai = PROVINCE_ORDER.indexOf(a);
      const bi = PROVINCE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'ko');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return keys.map(k => ({ name: k, items: groups[k] }));
  }

  /**
   * 광역자치단체 prefix를 제거한 표시용 이름
   */
  stripProvincePrefix(name) {
    const firstSpace = name.indexOf(' ');
    return firstSpace > 0 ? name.substring(firstSpace + 1) : name;
  }

  /**
   * 키워드 검색 (공간+속성+래스터)
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

    const matchRaster = this.rasterCatalog.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      d.description.toLowerCase().includes(kw) ||
      (d.tags || []).some(t => t.toLowerCase().includes(kw))
    ).map(d => ({ ...d, dataType: 'raster' }));

    return [...matchSpatial, ...matchAttr, ...matchRaster];
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
   * 래스터(GeoTIFF) 로드 → 레이어로 추가
   * @param {string} datasetId
   * @param {Object} options - { fitExtent: true }
   */
  async loadRaster(datasetId, options = {}) {
    const dataset = this.rasterCatalog.find(d => d.id === datasetId);
    if (!dataset) throw new Error('래스터 데이터셋을 찾을 수 없습니다: ' + datasetId);
    const url = BUILTIN_BASE + dataset.file;
    return await demLoader.loadFromUrl(url, dataset.name, options);
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
