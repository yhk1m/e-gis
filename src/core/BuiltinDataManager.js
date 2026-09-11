// © 2026 김용현
/**
 * BuiltinDataManager - 내장 데이터 카탈로그 및 로딩
 *  - practice_catalog.json: 점·선·면·속성 실습 데이터 (직접 등록)
 *  - raster_catalog.json: 래스터 GeoTIFF (npm run catalog 로 자동 생성)
 */

import { geojsonLoader } from '../loaders/GeoJSONLoader.js';
import { demLoader } from '../loaders/DEMLoader.js';
import * as XLSX from 'xlsx';

const BUILTIN_BASE = './data/builtin/';

class BuiltinDataManager {
  constructor() {
    this.rasterCatalog = [];
    this.practiceCatalog = [];
    this._loaded = false;
  }

  /**
   * 카탈로그 로드 (래스터+실습)
   */
  async loadCatalogs() {
    if (this._loaded) return;

    const [rasterResp, practiceResp] = await Promise.allSettled([
      fetch(BUILTIN_BASE + 'raster_catalog.json'),
      fetch(BUILTIN_BASE + 'practice_catalog.json')
    ]);

    if (rasterResp.status === 'fulfilled' && rasterResp.value.ok) {
      this.rasterCatalog = await rasterResp.value.json();
    }
    if (practiceResp.status === 'fulfilled' && practiceResp.value.ok) {
      this.practiceCatalog = await practiceResp.value.json();
    }

    this._loaded = true;
  }

  getRasterCatalog() {
    return this.rasterCatalog;
  }

  /**
   * 실습 데이터 카탈로그 (데이터 형태별 그룹, 화면에 이 순서대로 섹션이 놓인다)
   * 형식: [{ id, name, icon, description, datasets: [{ id, name, description, type, file, folder?, ... }] }]
   *   - 그룹에 type: 'raster' 가 있으면 datasets 대신 rasterCatalog 를 그 자리에 보여준다
   *   - 데이터셋의 folder 는 섹션 안에서 같은 이름끼리 접이식 폴더로 묶인다 (예: 행정경계)
   * type: 'spatial' | 'attribute' | 'coordinate' | 'raster'
   *   coordinate 데이터셋은 latColumn/lonColumn 힌트로 위경도 포인트 레이어를 만듭니다.
   */
  getPracticeCatalog() {
    return this.practiceCatalog;
  }

  /**
   * 실습 데이터셋 조회
   */
  getPracticeDataset(typeId, datasetId) {
    const group = this.practiceCatalog.find(g => g.id === typeId);
    if (!group) return null;
    return (group.datasets || []).find(d => d.id === datasetId) || null;
  }

  /**
   * 실습 데이터셋 로드 (데이터셋의 type에 따라 분기)
   * spatial/raster → 레이어 추가, attribute/coordinate → 파싱된 데이터 반환
   * (coordinate: 위경도 컬럼으로 포인트 레이어를 만들도록 좌표 가져오기 화면으로 전달)
   */
  async loadPracticeDataset(typeId, datasetId) {
    const dataset = this.getPracticeDataset(typeId, datasetId);
    if (!dataset) throw new Error('실습 데이터셋을 찾을 수 없습니다: ' + datasetId);

    const url = BUILTIN_BASE + dataset.file;
    if (dataset.type === 'spatial') {
      const layerId = await geojsonLoader.loadFromUrl(url, dataset.name);
      return { type: 'spatial', layerId };
    }
    if (dataset.type === 'raster') {
      const layerId = await demLoader.loadFromUrl(url, dataset.name);
      return { type: 'raster', layerId };
    }
    if (dataset.type === 'attribute' || dataset.type === 'coordinate') {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('파일을 찾을 수 없습니다: ' + dataset.file);
      const arrayBuffer = await resp.arrayBuffer();
      const { headers, data } = this._parseXlsxBuffer(arrayBuffer);
      return { type: dataset.type, headers, data, fileName: dataset.name, dataset };
    }
    throw new Error('알 수 없는 데이터 유형: ' + dataset.type);
  }

  /**
   * XLSX ArrayBuffer → { headers, data }
   */
  _parseXlsxBuffer(arrayBuffer) {
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

    return { headers, data };
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
      '전북특별자치도', '전라북도', '전라남도', '전남광주통합특별시',
      '경상북도', '경상남도', '제주특별자치도'
    ];

    const provinceSet = new Set(PROVINCE_ORDER);
    const groups = {};
    for (const item of this.rasterCatalog) {
      const firstSpace = item.name.indexOf(' ');
      let group;
      if (firstSpace > 0) {
        group = item.name.substring(0, firstSpace);
      } else if (provinceSet.has(item.name)) {
        // 파일명이 광역자치단체명 그 자체 (예: "세종특별자치시")
        group = item.name;
      } else {
        group = '기타';
      }
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
   * 키워드 검색 (실습 데이터셋 + 래스터)
   */
  search(keyword) {
    const kw = keyword.toLowerCase();
    const matchPractice = this.practiceCatalog.flatMap(g => (g.datasets || [])
      .filter(d =>
        d.name.toLowerCase().includes(kw) ||
        (d.description || '').toLowerCase().includes(kw) ||
        (d.folder || '').toLowerCase().includes(kw)
      )
      .map(d => ({ ...d, dataType: d.type, groupId: g.id }))
    );

    const matchRaster = this.rasterCatalog.filter(d =>
      d.name.toLowerCase().includes(kw) ||
      d.description.toLowerCase().includes(kw) ||
      (d.tags || []).some(t => t.toLowerCase().includes(kw))
    ).map(d => ({ ...d, dataType: 'raster' }));

    return [...matchPractice, ...matchRaster];
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
}

export const builtinDataManager = new BuiltinDataManager();
