/**
 * ShapefileLoader - Shapefile (.shp, .zip) 파일 로더
 * shpjs 라이브러리 사용
 */

import shp from 'shpjs';
import GeoJSON from 'ol/format/GeoJSON';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';

// 한국 좌표계 정의
proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:5187', '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:5188', '+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:2097', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43');
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43');
register(proj4);

class ShapefileLoader {
  constructor() {
    this.format = new GeoJSON();
    this.pendingFiles = new Map();
  }

  /**
   * File 객체로부터 Shapefile 로드
   */
  async loadFromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'zip') {
      return this.loadFromZip(file);
    } else if (ext === 'shp' || ext === 'dbf' || ext === 'shx' || ext === 'prj') {
      return this.handleShapefileComponent(file);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다.');
    }
  }

  /**
   * Shapefile 구성 파일 처리
   */
  async handleShapefileComponent(file) {
    const baseName = file.name.replace(/\.(shp|dbf|shx|prj)$/i, '');
    const ext = file.name.split('.').pop().toLowerCase();

    if (!this.pendingFiles.has(baseName)) {
      this.pendingFiles.set(baseName, {});
    }

    const pending = this.pendingFiles.get(baseName);

    if (ext === 'prj') {
      // PRJ는 텍스트로 읽기
      pending.prj = await this.readFileAsText(file);
    } else {
      pending[ext] = await this.readFileAsArrayBuffer(file);
    }

    // .shp와 .dbf가 있으면 로드
    if (pending.shp && pending.dbf) {
      const result = await this.loadFromComponents(pending, baseName);
      this.pendingFiles.delete(baseName);
      return result;
    }

    // .shp만 있는 경우 2초 대기 후 로드
    if (pending.shp && !pending.dbf && !pending.timer) {
      pending.timer = setTimeout(async () => {
        if (this.pendingFiles.has(baseName)) {
          const p = this.pendingFiles.get(baseName);
          if (p.shp) {
            console.warn('DBF 파일 없이 SHP 로드');
            try {
              await this.loadFromComponents(p, baseName);
            } catch (e) {
              console.error('SHP 로드 실패:', e);
            }
            this.pendingFiles.delete(baseName);
          }
        }
      }, 2000);
    }

    return null;
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsArrayBuffer(file);
    });
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
  }

  /**
   * PRJ 파일에서 EPSG 코드 추출
   */
  detectProjection(prjContent) {
    if (!prjContent) return 'EPSG:4326';

    const prj = prjContent.toUpperCase();

    // 한국 좌표계 감지
    if (prj.includes('KOREA') || prj.includes('KOREAN')) {
      if (prj.includes('2000') && prj.includes('CENTRAL')) return 'EPSG:5186';
      if (prj.includes('2000') && prj.includes('WEST')) return 'EPSG:5185';
      if (prj.includes('2000') && prj.includes('EAST')) return 'EPSG:5187';
      if (prj.includes('UNIFIED') || prj.includes('5179')) return 'EPSG:5179';
      if (prj.includes('BESSEL')) return 'EPSG:2097';
    }

    // UTM 좌표계
    if (prj.includes('UTM') && prj.includes('52N')) return 'EPSG:32652';
    if (prj.includes('UTM') && prj.includes('51N')) return 'EPSG:32651';

    // WGS84
    if (prj.includes('WGS') && prj.includes('84')) return 'EPSG:4326';

    // GRS80 기반 TM (한국)
    if (prj.includes('GRS') && prj.includes('80') && prj.includes('TRANSVERSE')) {
      if (prj.includes('127.5') || prj.includes('127.50')) return 'EPSG:5179';
      if (prj.includes('127.0') || prj.includes('127')) return 'EPSG:5186';
    }

    // 좌표 범위로 추정
    return 'EPSG:4326';
  }

  /**
   * 좌표 범위로 좌표계 추정
   */
  guessProjectionFromExtent(geojson) {
    if (!geojson.features || geojson.features.length === 0) return 'EPSG:4326';

    // 첫 번째 좌표 확인
    let coords = null;
    const firstFeature = geojson.features[0];
    const geom = firstFeature.geometry;

    if (geom.type === 'Point') {
      coords = geom.coordinates;
    } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
      coords = geom.coordinates[0];
    } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
      coords = geom.coordinates[0][0];
    } else if (geom.type === 'MultiPolygon') {
      coords = geom.coordinates[0][0][0];
    }

    if (!coords) return 'EPSG:4326';

    const [x, y] = coords;

    // 한국 TM 좌표계 범위 (미터 단위, 큰 숫자)
    if (x > 100000 && x < 1500000 && y > 100000 && y < 2500000) {
      // EPSG:5179 (UTM-K)
      if (x > 800000 && x < 1300000 && y > 1400000 && y < 2200000) {
        return 'EPSG:5179';
      }
      // EPSG:5186 (중부원점)
      if (x > 100000 && x < 400000 && y > 300000 && y < 800000) {
        return 'EPSG:5186';
      }
      // EPSG:2097 (구 한국 중부)
      return 'EPSG:5186';
    }

    // WGS84 범위 (경도 124~132, 위도 33~43 - 한국)
    if (x > 124 && x < 132 && y > 33 && y < 43) {
      return 'EPSG:4326';
    }

    return 'EPSG:4326';
  }

  /**
   * 구성 파일들로부터 Shapefile 로드
   */
  async loadFromComponents(components, baseName) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    if (components.shp) zip.file(baseName + '.shp', components.shp);
    if (components.dbf) zip.file(baseName + '.dbf', components.dbf);
    if (components.shx) zip.file(baseName + '.shx', components.shx);
    if (components.prj) zip.file(baseName + '.prj', components.prj);

    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });
    const geojson = await shp(zipBlob);

    // 좌표계 감지
    let sourceProj = this.detectProjection(components.prj);

    // PRJ로 감지 못하면 좌표 범위로 추정
    if (sourceProj === 'EPSG:4326') {
      const gj = Array.isArray(geojson) ? geojson[0] : geojson;
      sourceProj = this.guessProjectionFromExtent(gj);
    }

    console.log('감지된 좌표계:', sourceProj);

    if (Array.isArray(geojson)) {
      const layerIds = [];
      for (let i = 0; i < geojson.length; i++) {
        const layerId = this.createLayerFromGeoJSON(geojson[i], baseName + '_' + (i + 1), sourceProj);
        layerIds.push(layerId);
      }
      return layerIds;
    } else {
      return this.createLayerFromGeoJSON(geojson, baseName, sourceProj);
    }
  }

  /**
   * ZIP 파일로부터 Shapefile 로드
   */
  async loadFromZip(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;

          // ZIP에서 PRJ 파일 읽기
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(arrayBuffer);
          let prjContent = null;

          for (const filename of Object.keys(zip.files)) {
            if (filename.toLowerCase().endsWith('.prj')) {
              prjContent = await zip.files[filename].async('string');
              break;
            }
          }

          const geojson = await shp(arrayBuffer);

          // 좌표계 감지
          let sourceProj = this.detectProjection(prjContent);
          if (sourceProj === 'EPSG:4326') {
            const gj = Array.isArray(geojson) ? geojson[0] : geojson;
            sourceProj = this.guessProjectionFromExtent(gj);
          }

          console.log('감지된 좌표계:', sourceProj);

          const name = file.name.replace('.zip', '');

          if (Array.isArray(geojson)) {
            const layerIds = [];
            for (let i = 0; i < geojson.length; i++) {
              const layerId = this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1), sourceProj);
              layerIds.push(layerId);
            }
            resolve(layerIds);
          } else {
            const layerId = this.createLayerFromGeoJSON(geojson, name, sourceProj);
            resolve(layerId);
          }
        } catch (error) {
          reject(new Error('Shapefile 파싱 실패: ' + error.message));
        }
      };

      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * GeoJSON 객체로부터 레이어 생성
   */
  createLayerFromGeoJSON(geojson, name, sourceProj = 'EPSG:4326') {
    const features = this.format.readFeatures(geojson, {
      dataProjection: sourceProj,
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('Shapefile에 피처가 없습니다.');
    }

    const layerId = layerManager.addLayer({
      name: name,
      type: 'vector',
      features: features
    });

    // 레이어 범위로 지도 이동
    setTimeout(() => {
      layerManager.zoomToLayer(layerId);
    }, 100);

    return layerId;
  }

  /**
   * URL로부터 Shapefile 로드
   */
  async loadFromUrl(url, name = '새 레이어') {
    try {
      const geojson = await shp(url);

      if (Array.isArray(geojson)) {
        const layerIds = [];
        for (let i = 0; i < geojson.length; i++) {
          const layerId = this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1));
          layerIds.push(layerId);
        }
        return layerIds;
      } else {
        return this.createLayerFromGeoJSON(geojson, name);
      }
    } catch (error) {
      throw new Error('Shapefile 로드 실패: ' + error.message);
    }
  }
}

export const shapefileLoader = new ShapefileLoader();
