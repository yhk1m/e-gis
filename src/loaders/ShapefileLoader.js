/**
 * ShapefileLoader - Shapefile (.shp, .zip) 파일 로더
 * shpjs 라이브러리 사용
 *
 * 좌표계 판정은 CrsDetector가 한다. 예전에는 이 파일이 proj4.defs를 따로 등록하고
 * .prj를 문자열 부분일치로 훑었는데, CoordinateSystem의 정의와 어긋나 있었다.
 */

import shp from 'shpjs';
import GeoJSON from 'ol/format/GeoJSON';
import { layerManager } from '../core/LayerManager.js';
import { resolveSourceCrs } from '../core/crsResolver.js';
import { sampleCoordsFromGeoJSON } from '../core/CrsDetector.js';

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
   * 여러 File을 basename별로 묶어 완전한 세트로 한 번에 로드한다.
   * (드롭/선택 순서·타이밍과 무관하게 shp+dbf+shx+prj+cpg를 짝지어 처리)
   *
   * 폴더 드래그·다중 선택·폴더 선택에서 들어온 파일 목록에 사용한다.
   * 하나의 목록에 여러 shapefile(서로 다른 basename)이 섞여 있어도 각각 로드한다.
   *
   * @param {File[]} files - shapefile 구성 파일들이 포함된 목록
   * @returns {Promise<Array>} 생성된 layerId 목록
   */
  async loadFromFiles(files) {
    const EXTS = ['shp', 'dbf', 'shx', 'prj', 'cpg'];
    const groups = new Map(); // key(소문자 basename) -> { baseName, shp, dbf, shx, prj, cpg }

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!EXTS.includes(ext)) continue;
      const baseName = file.name.replace(/\.(shp|dbf|shx|prj|cpg)$/i, '');
      const key = baseName.toLowerCase();
      if (!groups.has(key)) groups.set(key, { baseName });
      groups.get(key)[ext] = file;
    }

    const layerIds = [];
    for (const group of groups.values()) {
      // .shp이 없으면 지오메트리를 만들 수 없으므로 건너뜀
      if (!group.shp) continue;

      const components = {};
      components.shp = await this.readFileAsArrayBuffer(group.shp);
      if (group.dbf) components.dbf = await this.readFileAsArrayBuffer(group.dbf);
      if (group.shx) components.shx = await this.readFileAsArrayBuffer(group.shx);
      if (group.cpg) components.cpg = await this.readFileAsArrayBuffer(group.cpg);
      if (group.prj) components.prj = await this.readFileAsText(group.prj);

      const res = await this.loadFromComponents(components, group.baseName);
      if (Array.isArray(res)) layerIds.push(...res);
      else if (res != null) layerIds.push(res);
    }

    return layerIds;
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
   * 구성 파일들로부터 Shapefile 로드
   */
  async loadFromComponents(components, baseName) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    if (components.shp) zip.file(baseName + '.shp', components.shp);
    if (components.dbf) zip.file(baseName + '.dbf', components.dbf);
    if (components.shx) zip.file(baseName + '.shx', components.shx);
    if (components.prj) zip.file(baseName + '.prj', components.prj);
    if (components.cpg) zip.file(baseName + '.cpg', components.cpg);

    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });
    const geojson = await shp(zipBlob);

    if (Array.isArray(geojson)) {
      const layerIds = [];
      for (let i = 0; i < geojson.length; i++) {
        const layerId = await this.createLayerFromGeoJSON(geojson[i], baseName + '_' + (i + 1), components.prj);
        if (layerId) layerIds.push(layerId);
      }
      return layerIds;
    }
    return await this.createLayerFromGeoJSON(geojson, baseName, components.prj);
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
          const name = file.name.replace('.zip', '');

          if (Array.isArray(geojson)) {
            const layerIds = [];
            for (let i = 0; i < geojson.length; i++) {
              const layerId = await this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1), prjContent);
              if (layerId) layerIds.push(layerId);
            }
            resolve(layerIds);
          } else {
            resolve(await this.createLayerFromGeoJSON(geojson, name, prjContent));
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
   *
   * @param {Object} geojson - shpjs가 뱉은 GeoJSON (원본 좌표계 그대로)
   * @param {string} name - 레이어 이름
   * @param {string|null} prj - .prj 파일 내용(WKT). 없으면 좌표로 판정한다
   * @returns {Promise<string|null>} 레이어 ID, 취소하면 null
   */
  async createLayerFromGeoJSON(geojson, name, prj = null) {
    const { crs, cancelled } = await resolveSourceCrs(
      { prj, sampleCoords: sampleCoordsFromGeoJSON(geojson) },
      { name, previewGeoJSON: geojson }
    );
    if (cancelled) return null;

    const features = this.format.readFeatures(geojson, {
      dataProjection: crs,
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('Shapefile에 피처가 없습니다.');
    }

    const layerId = layerManager.addLayer({
      name: name,
      type: 'vector',
      features: features,
      sourceCrs: crs
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
          const layerId = await this.createLayerFromGeoJSON(geojson[i], name + '_' + (i + 1));
          if (layerId) layerIds.push(layerId);
        }
        return layerIds;
      }
      return await this.createLayerFromGeoJSON(geojson, name);
    } catch (error) {
      throw new Error('Shapefile 로드 실패: ' + error.message);
    }
  }
}

export const shapefileLoader = new ShapefileLoader();
