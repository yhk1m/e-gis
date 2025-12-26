/**
 * GeoPackageLoader - GeoPackage (.gpkg) 파일 로더
 * sql.js 라이브러리 사용
 */

import initSqlJs from 'sql.js';
import GeoJSON from 'ol/format/GeoJSON';
import WKB from 'ol/format/WKB';
import { layerManager } from '../core/LayerManager.js';

class GeoPackageLoader {
  constructor() {
    this.SQL = null;
    this.format = new GeoJSON();
    this.wkbFormat = new WKB();
  }

  /**
   * sql.js 초기화
   */
  async initSQL() {
    if (!this.SQL) {
      this.SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
    }
    return this.SQL;
  }

  /**
   * File 객체로부터 GeoPackage 로드
   * @param {File} file - GeoPackage 파일
   * @returns {Promise<string[]>} 생성된 레이어 ID 배열
   */
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const layerIds = await this.loadFromArrayBuffer(arrayBuffer, file.name);
          resolve(layerIds);
        } catch (error) {
          reject(new Error('GeoPackage 파싱 실패: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('파일 읽기 실패'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * ArrayBuffer로부터 GeoPackage 로드
   * @param {ArrayBuffer} arrayBuffer - GeoPackage 데이터
   * @param {string} fileName - 파일명
   * @returns {Promise<string[]>} 생성된 레이어 ID 배열
   */
  async loadFromArrayBuffer(arrayBuffer, fileName) {
    const SQL = await this.initSQL();
    const db = new SQL.Database(new Uint8Array(arrayBuffer));

    try {
      // 지오메트리 테이블 목록 조회
      const tables = this.getGeometryTables(db);

      if (tables.length === 0) {
        throw new Error('GeoPackage에 지오메트리 레이어가 없습니다.');
      }

      const layerIds = [];
      const baseName = fileName.replace('.gpkg', '');

      for (const table of tables) {
        try {
          const layerId = await this.loadTable(db, table, baseName);
          if (layerId) {
            layerIds.push(layerId);
          }
        } catch (error) {
          console.warn('테이블 로드 실패:', table.table_name, error);
        }
      }

      if (layerIds.length === 0) {
        throw new Error('로드할 수 있는 레이어가 없습니다.');
      }

      return layerIds;
    } finally {
      db.close();
    }
  }

  /**
   * 지오메트리 테이블 목록 조회
   * @param {Object} db - SQL.js 데이터베이스
   * @returns {Array} 테이블 정보 배열
   */
  getGeometryTables(db) {
    try {
      const result = db.exec(`
        SELECT table_name, column_name, geometry_type_name, srs_id
        FROM gpkg_geometry_columns
      `);

      if (!result.length || !result[0].values.length) {
        return [];
      }

      return result[0].values.map(row => ({
        table_name: row[0],
        column_name: row[1],
        geometry_type: row[2],
        srs_id: row[3]
      }));
    } catch (error) {
      console.warn('gpkg_geometry_columns 조회 실패:', error);
      return [];
    }
  }

  /**
   * 테이블 데이터 로드
   * @param {Object} db - SQL.js 데이터베이스
   * @param {Object} tableInfo - 테이블 정보
   * @param {string} baseName - 기본 레이어 이름
   * @returns {string} 생성된 레이어 ID
   */
  loadTable(db, tableInfo, baseName) {
    const { table_name, column_name, srs_id } = tableInfo;

    // 테이블 데이터 조회
    const result = db.exec(`SELECT * FROM "${table_name}"`);

    if (!result.length || !result[0].values.length) {
      return null;
    }

    const columns = result[0].columns;
    const rows = result[0].values;
    const geomColumnIndex = columns.indexOf(column_name);

    if (geomColumnIndex === -1) {
      throw new Error('지오메트리 컬럼을 찾을 수 없습니다: ' + column_name);
    }

    // GeoJSON FeatureCollection 생성
    const features = [];

    for (const row of rows) {
      try {
        const geomBlob = row[geomColumnIndex];
        if (!geomBlob) continue;

        // GeoPackage WKB 파싱
        const geometry = this.parseGpkgGeometry(geomBlob);
        if (!geometry) continue;

        // 속성 추출
        const properties = {};
        columns.forEach((col, idx) => {
          if (idx !== geomColumnIndex && col !== 'fid') {
            properties[col] = row[idx];
          }
        });

        features.push({
          type: 'Feature',
          geometry: geometry,
          properties: properties
        });
      } catch (error) {
        console.warn('피처 파싱 실패:', error);
      }
    }

    if (features.length === 0) {
      return null;
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    // OpenLayers Feature로 변환
    const olFeatures = this.format.readFeatures(geojson, {
      dataProjection: srs_id === 4326 ? 'EPSG:4326' : 'EPSG:' + srs_id,
      featureProjection: 'EPSG:3857'
    });

    // 레이어 추가
    const layerName = baseName + ' - ' + table_name;
    const layerId = layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: olFeatures
    });

    return layerId;
  }

  /**
   * GeoPackage WKB 지오메트리 파싱
   * @param {Uint8Array} blob - WKB 데이터
   * @returns {Object} GeoJSON 지오메트리
   */
  parseGpkgGeometry(blob) {
    if (!blob || blob.length < 8) return null;

    // GeoPackage 헤더 확인 (GP로 시작)
    const header = new Uint8Array(blob.buffer ? blob.buffer : blob);

    // GeoPackage Binary 헤더 파싱
    // Magic: 0x47, 0x50 ("GP")
    if (header[0] === 0x47 && header[1] === 0x50) {
      // GeoPackage 바이너리 형식
      const flags = header[3];
      const envelopeType = (flags >> 1) & 0x07;

      // 엔벨로프 크기 계산
      let envelopeSize = 0;
      switch (envelopeType) {
        case 1: envelopeSize = 32; break; // xy
        case 2: envelopeSize = 48; break; // xyz
        case 3: envelopeSize = 48; break; // xym
        case 4: envelopeSize = 64; break; // xyzm
      }

      // WKB 시작 위치
      const wkbStart = 8 + envelopeSize;
      const wkbData = header.slice(wkbStart);

      return this.wkbToGeoJSON(wkbData);
    } else {
      // 표준 WKB로 시도
      return this.wkbToGeoJSON(header);
    }
  }

  /**
   * WKB를 GeoJSON으로 변환
   * @param {Uint8Array} wkbData - WKB 데이터
   * @returns {Object} GeoJSON 지오메트리
   */
  wkbToGeoJSON(wkbData) {
    try {
      // OpenLayers WKB 포맷 사용
      const feature = this.wkbFormat.readFeature(wkbData, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326'
      });

      if (feature) {
        const geometry = feature.getGeometry();
        const geojsonFormat = new GeoJSON();
        return JSON.parse(geojsonFormat.writeGeometry(geometry));
      }
    } catch (error) {
      // 폴백: 수동 WKB 파싱
      return this.parseWKBManual(wkbData);
    }

    return null;
  }

  /**
   * 수동 WKB 파싱 (폴백)
   * @param {Uint8Array} wkb - WKB 데이터
   * @returns {Object} GeoJSON 지오메트리
   */
  parseWKBManual(wkb) {
    if (!wkb || wkb.length < 5) return null;

    const view = new DataView(wkb.buffer || new ArrayBuffer(wkb.length));
    let offset = 0;

    // 바이트 오더 (1 = little-endian)
    const byteOrder = wkb[offset++];
    const littleEndian = byteOrder === 1;

    // 지오메트리 타입
    const geomType = view.getUint32(offset, littleEndian);
    offset += 4;

    // 간단한 Point 처리
    if (geomType === 1) {
      const x = view.getFloat64(offset, littleEndian);
      offset += 8;
      const y = view.getFloat64(offset, littleEndian);
      return { type: 'Point', coordinates: [x, y] };
    }

    // 다른 타입은 null 반환 (복잡한 파싱 필요)
    return null;
  }
}

// 싱글톤 인스턴스
export const geopackageLoader = new GeoPackageLoader();
