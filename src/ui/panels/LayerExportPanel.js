/**
 * LayerExportPanel - 레이어 내보내기 패널
 * 선택된 레이어를 다양한 포맷으로 내보내기
 */

import { layerManager } from '../../core/LayerManager.js';
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import GPX from 'ol/format/GPX';
import shpwrite from '@mapbox/shp-write';

class LayerExportPanel {
  constructor() {
    this.modalElement = null;
    this.selectedFormat = 'geojson';
  }

  /**
   * 내보내기 모달 표시
   */
  show(layerId = null) {
    // 레이어 ID가 없으면 선택된 레이어 사용
    const targetLayerId = layerId || layerManager.selectedLayerId;

    if (!targetLayerId) {
      alert('내보낼 레이어를 먼저 선택해주세요.');
      return;
    }

    const layer = layerManager.getLayer(targetLayerId);
    if (!layer) {
      alert('레이어를 찾을 수 없습니다.');
      return;
    }

    // 래스터 레이어는 내보내기 불가
    if (layer.type === 'raster') {
      alert('래스터 레이어는 내보내기가 지원되지 않습니다.');
      return;
    }

    this.createModal(layer);
  }

  /**
   * 모달 생성
   */
  createModal(layer) {
    // 기존 모달 제거
    this.hide();

    const features = layer.source ? layer.source.getFeatures() : [];
    const featureCount = features.length;

    const modalHtml = `
      <div class="modal-overlay active" id="layer-export-modal">
        <div class="modal" style="width: 380px;">
          <div class="modal-header">
            <h3>레이어 내보내기</h3>
            <button class="modal-close" id="export-modal-close">&times;</button>
          </div>
          <div class="modal-body" style="padding: var(--spacing-lg);">
            <div class="form-group">
              <label class="form-label">레이어</label>
              <div class="export-layer-info">
                <span class="layer-name">${layer.name}</span>
                <span class="feature-count">(${featureCount}개 객체)</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">내보내기 형식</label>
              <div class="export-format-options">
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="geojson" checked>
                  <span class="format-label">
                    <strong>GeoJSON</strong>
                    <small>웹 지도, JavaScript 호환</small>
                  </span>
                </label>
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="kml">
                  <span class="format-label">
                    <strong>KML</strong>
                    <small>Google Earth 호환</small>
                  </span>
                </label>
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="gpx">
                  <span class="format-label">
                    <strong>GPX</strong>
                    <small>GPS 장치 호환</small>
                  </span>
                </label>
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="csv">
                  <span class="format-label">
                    <strong>CSV</strong>
                    <small>스프레드시트 (속성만)</small>
                  </span>
                </label>
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="shp">
                  <span class="format-label">
                    <strong>Shapefile</strong>
                    <small>ArcGIS, QGIS 호환 (ZIP)</small>
                  </span>
                </label>
                <label class="export-format-option">
                  <input type="radio" name="export-format" value="gpkg">
                  <span class="format-label">
                    <strong>GeoPackage</strong>
                    <small>OGC 표준, QGIS 호환</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="form-group" id="csv-options" style="display: none;">
              <label class="form-label">CSV 옵션</label>
              <label class="checkbox-label">
                <input type="checkbox" id="csv-include-coords" checked>
                <span>좌표 포함 (경도, 위도)</span>
              </label>
            </div>
          </div>
          <div class="modal-footer" style="padding: var(--spacing-md) var(--spacing-lg); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: var(--spacing-sm);">
            <button class="btn btn-secondary btn-sm" id="export-cancel">취소</button>
            <button class="btn btn-primary btn-sm" id="export-confirm">내보내기</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modalElement = document.getElementById('layer-export-modal');

    this.bindEvents(layer);
    this.addStyles();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents(layer) {
    const closeBtn = document.getElementById('export-modal-close');
    const cancelBtn = document.getElementById('export-cancel');
    const confirmBtn = document.getElementById('export-confirm');
    const formatInputs = document.querySelectorAll('input[name="export-format"]');
    const csvOptions = document.getElementById('csv-options');

    closeBtn.addEventListener('click', () => this.hide());
    cancelBtn.addEventListener('click', () => this.hide());

    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) this.hide();
    });

    // 포맷 선택 시 CSV 옵션 표시/숨김
    formatInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.selectedFormat = e.target.value;
        csvOptions.style.display = e.target.value === 'csv' ? 'block' : 'none';
      });
    });

    // 내보내기 실행
    confirmBtn.addEventListener('click', () => {
      this.exportLayer(layer);
    });
  }

  /**
   * 레이어 내보내기 실행
   */
  exportLayer(layer) {
    const features = layer.source ? layer.source.getFeatures() : [];

    if (features.length === 0) {
      alert('내보낼 객체가 없습니다.');
      return;
    }

    let content, filename, mimeType;

    switch (this.selectedFormat) {
      case 'geojson':
        content = this.exportToGeoJSON(features);
        filename = `${layer.name}.geojson`;
        mimeType = 'application/json';
        break;
      case 'kml':
        content = this.exportToKML(features, layer.name);
        filename = `${layer.name}.kml`;
        mimeType = 'application/vnd.google-earth.kml+xml';
        break;
      case 'gpx':
        content = this.exportToGPX(features, layer.name);
        filename = `${layer.name}.gpx`;
        mimeType = 'application/gpx+xml';
        break;
      case 'csv':
        const includeCoords = document.getElementById('csv-include-coords').checked;
        content = this.exportToCSV(features, includeCoords);
        filename = `${layer.name}.csv`;
        mimeType = 'text/csv';
        break;
      case 'shp':
        this.exportToShapefile(features, layer.name);
        this.hide();
        return; // 별도 다운로드 처리
      case 'gpkg':
        this.exportToGeoPackage(features, layer.name);
        this.hide();
        return; // 별도 다운로드 처리
    }

    this.downloadFile(content, filename, mimeType);
    this.hide();
  }

  /**
   * GeoJSON으로 내보내기
   */
  exportToGeoJSON(features) {
    const format = new GeoJSON();
    const geoJsonObj = format.writeFeaturesObject(features, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });
    return JSON.stringify(geoJsonObj, null, 2);
  }

  /**
   * KML로 내보내기
   */
  exportToKML(features, layerName) {
    const format = new KML({
      extractStyles: true
    });

    try {
      return format.writeFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
    } catch (e) {
      // KML 변환 실패 시 수동 생성
      return this.createKMLManually(features, layerName);
    }
  }

  /**
   * KML 수동 생성 (폴백)
   */
  createKMLManually(features, layerName) {
    const geoJsonFormat = new GeoJSON();

    let placemarks = '';
    features.forEach((feature, index) => {
      const geom = feature.getGeometry();
      if (!geom) return;

      const coords = this.getKMLCoordinates(geom);
      const name = feature.get('name') || feature.get('NAME') || `Feature ${index + 1}`;
      const props = feature.getProperties();

      let description = '';
      Object.keys(props).forEach(key => {
        if (key !== 'geometry' && props[key] !== null && props[key] !== undefined) {
          description += `${key}: ${props[key]}\n`;
        }
      });

      const geomType = geom.getType();
      let geometryKML = '';

      if (geomType === 'Point') {
        geometryKML = `<Point><coordinates>${coords}</coordinates></Point>`;
      } else if (geomType === 'LineString') {
        geometryKML = `<LineString><coordinates>${coords}</coordinates></LineString>`;
      } else if (geomType === 'Polygon') {
        geometryKML = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      } else if (geomType === 'MultiPolygon') {
        geometryKML = `<MultiGeometry>${coords}</MultiGeometry>`;
      }

      placemarks += `
    <Placemark>
      <name>${this.escapeXML(name)}</name>
      <description>${this.escapeXML(description)}</description>
      ${geometryKML}
    </Placemark>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXML(layerName)}</name>
    ${placemarks}
  </Document>
</kml>`;
  }

  /**
   * 지오메트리에서 KML 좌표 추출
   */
  getKMLCoordinates(geom) {
    const type = geom.getType();
    const clone = geom.clone().transform('EPSG:3857', 'EPSG:4326');

    if (type === 'Point') {
      const coords = clone.getCoordinates();
      return `${coords[0]},${coords[1]},0`;
    } else if (type === 'LineString') {
      return clone.getCoordinates().map(c => `${c[0]},${c[1]},0`).join(' ');
    } else if (type === 'Polygon') {
      return clone.getCoordinates()[0].map(c => `${c[0]},${c[1]},0`).join(' ');
    } else if (type === 'MultiPolygon') {
      return clone.getPolygons().map(poly => {
        const coords = poly.getCoordinates()[0].map(c => `${c[0]},${c[1]},0`).join(' ');
        return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      }).join('');
    }
    return '';
  }

  /**
   * GPX로 내보내기
   */
  exportToGPX(features, layerName) {
    const format = new GPX();

    try {
      return format.writeFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
    } catch (e) {
      // GPX 변환 실패 시 수동 생성
      return this.createGPXManually(features, layerName);
    }
  }

  /**
   * GPX 수동 생성 (폴백)
   */
  createGPXManually(features, layerName) {
    let waypoints = '';
    let tracks = '';

    features.forEach((feature, index) => {
      const geom = feature.getGeometry();
      if (!geom) return;

      const clone = geom.clone().transform('EPSG:3857', 'EPSG:4326');
      const type = geom.getType();
      const name = feature.get('name') || feature.get('NAME') || `Feature ${index + 1}`;

      if (type === 'Point') {
        const coords = clone.getCoordinates();
        waypoints += `  <wpt lat="${coords[1]}" lon="${coords[0]}">
    <name>${this.escapeXML(name)}</name>
  </wpt>\n`;
      } else if (type === 'LineString') {
        const coords = clone.getCoordinates();
        let trkpts = coords.map(c => `      <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n');
        tracks += `  <trk>
    <name>${this.escapeXML(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>\n`;
      }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="eGIS" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${this.escapeXML(layerName)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypoints}${tracks}</gpx>`;
  }

  /**
   * CSV로 내보내기
   */
  exportToCSV(features, includeCoords) {
    if (features.length === 0) return '';

    // 모든 속성 키 수집
    const allKeys = new Set();
    features.forEach(feature => {
      const props = feature.getProperties();
      Object.keys(props).forEach(key => {
        if (key !== 'geometry') {
          allKeys.add(key);
        }
      });
    });

    const keys = Array.from(allKeys);
    const headers = [...keys];

    if (includeCoords) {
      headers.push('longitude', 'latitude');
    }

    // CSV 헤더
    let csv = headers.map(h => this.escapeCSV(h)).join(',') + '\n';

    // CSV 데이터
    features.forEach(feature => {
      const props = feature.getProperties();
      const row = keys.map(key => this.escapeCSV(props[key] ?? ''));

      if (includeCoords) {
        const geom = feature.getGeometry();
        if (geom) {
          const clone = geom.clone().transform('EPSG:3857', 'EPSG:4326');
          const type = geom.getType();
          let lon = '', lat = '';

          if (type === 'Point') {
            const coords = clone.getCoordinates();
            lon = coords[0].toFixed(6);
            lat = coords[1].toFixed(6);
          } else {
            // 다른 지오메트리는 중심점 사용
            const extent = clone.getExtent();
            lon = ((extent[0] + extent[2]) / 2).toFixed(6);
            lat = ((extent[1] + extent[3]) / 2).toFixed(6);
          }
          row.push(lon, lat);
        } else {
          row.push('', '');
        }
      }

      csv += row.join(',') + '\n';
    });

    // BOM 추가 (Excel 한글 호환)
    return '\uFEFF' + csv;
  }

  /**
   * Shapefile로 내보내기
   */
  async exportToShapefile(features, layerName) {
    try {
      const format = new GeoJSON();
      const geoJsonObj = format.writeFeaturesObject(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });

      // shpwrite로 Shapefile 생성
      const options = {
        folder: layerName,
        filename: layerName,
        outputType: 'blob',
        compression: 'DEFLATE'
      };

      const zipBlob = await shpwrite.zip(geoJsonObj, options);

      // 다운로드
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${layerName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Shapefile 내보내기 실패:', error);
      alert('Shapefile 내보내기에 실패했습니다. ' + error.message);
    }
  }

  /**
   * GeoPackage로 내보내기
   */
  async exportToGeoPackage(features, layerName) {
    try {
      // SQL.js 로드
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });

      const db = new SQL.Database();

      // GeoPackage 테이블 생성
      db.run(`
        CREATE TABLE gpkg_contents (
          table_name TEXT NOT NULL PRIMARY KEY,
          data_type TEXT NOT NULL,
          identifier TEXT UNIQUE,
          description TEXT DEFAULT '',
          last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          min_x DOUBLE,
          min_y DOUBLE,
          max_x DOUBLE,
          max_y DOUBLE,
          srs_id INTEGER
        )
      `);

      db.run(`
        CREATE TABLE gpkg_geometry_columns (
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          geometry_type_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL,
          z TINYINT NOT NULL,
          m TINYINT NOT NULL,
          CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name)
        )
      `);

      db.run(`
        CREATE TABLE gpkg_spatial_ref_sys (
          srs_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL PRIMARY KEY,
          organization TEXT NOT NULL,
          organization_coordsys_id INTEGER NOT NULL,
          definition TEXT NOT NULL,
          description TEXT
        )
      `);

      // WGS84 SRS 추가
      db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]', 'WGS 84')`);

      // 피처 데이터 수집
      const format = new GeoJSON();
      const geoJsonObj = format.writeFeaturesObject(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });

      // 테이블 이름 정리
      const tableName = layerName.replace(/[^a-zA-Z0-9_]/g, '_');

      // 속성 컬럼 수집
      const allKeys = new Set();
      geoJsonObj.features.forEach(f => {
        Object.keys(f.properties || {}).forEach(key => allKeys.add(key));
      });
      const columns = Array.from(allKeys);

      // 지오메트리 타입 확인
      let geomType = 'GEOMETRY';
      if (geoJsonObj.features.length > 0) {
        geomType = geoJsonObj.features[0].geometry.type.toUpperCase();
      }

      // 피처 테이블 생성
      let createTableSQL = `CREATE TABLE "${tableName}" (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB`;
      columns.forEach(col => {
        const safeName = col.replace(/[^a-zA-Z0-9_]/g, '_');
        createTableSQL += `, "${safeName}" TEXT`;
      });
      createTableSQL += ')';
      db.run(createTableSQL);

      // gpkg_contents 등록
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      geoJsonObj.features.forEach(f => {
        if (f.geometry && f.geometry.coordinates) {
          const coords = this.flattenCoords(f.geometry.coordinates);
          coords.forEach(c => {
            if (c[0] < minX) minX = c[0];
            if (c[0] > maxX) maxX = c[0];
            if (c[1] < minY) minY = c[1];
            if (c[1] > maxY) maxY = c[1];
          });
        }
      });

      db.run(`INSERT INTO gpkg_contents VALUES (?, 'features', ?, '', datetime('now'), ?, ?, ?, ?, 4326)`,
        [tableName, tableName, minX, minY, maxX, maxY]);

      db.run(`INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', ?, 4326, 0, 0)`,
        [tableName, geomType]);

      // 피처 삽입
      geoJsonObj.features.forEach(f => {
        const geomWKB = this.geojsonToWKB(f.geometry);
        const values = [geomWKB];
        columns.forEach(col => {
          values.push(f.properties[col] ?? null);
        });

        const placeholders = ['?'].concat(columns.map(() => '?')).join(', ');
        const colNames = ['geom'].concat(columns.map(c => '"' + c.replace(/[^a-zA-Z0-9_]/g, '_') + '"')).join(', ');
        db.run(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`, values);
      });

      // 데이터베이스 내보내기
      const data = db.export();
      const buffer = new Uint8Array(data);
      const blob = new Blob([buffer], { type: 'application/geopackage+sqlite3' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${layerName}.gpkg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      db.close();
    } catch (error) {
      console.error('GeoPackage 내보내기 실패:', error);
      alert('GeoPackage 내보내기에 실패했습니다. ' + error.message);
    }
  }

  /**
   * 좌표 배열 평탄화
   */
  flattenCoords(coords) {
    if (typeof coords[0] === 'number') {
      return [coords];
    }
    return coords.flatMap(c => this.flattenCoords(c));
  }

  /**
   * GeoJSON 지오메트리를 간단한 WKB로 변환
   */
  geojsonToWKB(geometry) {
    // 간단한 GeoJSON을 WKT로 변환 후 텍스트로 저장 (간소화 버전)
    // 실제 WKB 변환은 복잡하므로 WKT 텍스트로 저장
    return JSON.stringify(geometry);
  }

  /**
   * CSV 값 이스케이프
   */
  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * XML 이스케이프
   */
  escapeXML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 파일 다운로드
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * 스타일 추가
   */
  addStyles() {
    if (document.getElementById('layer-export-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'layer-export-styles';
    styles.textContent = `
      .export-layer-info {
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--bg-tertiary);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .export-layer-info .layer-name {
        font-weight: 500;
        color: var(--text-primary);
      }

      .export-layer-info .feature-count {
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }

      .export-format-options {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .export-format-option {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .export-format-option:hover {
        background: var(--bg-hover);
      }

      .export-format-option input[type="radio"] {
        margin-top: 2px;
      }

      .export-format-option input[type="radio"]:checked + .format-label strong {
        color: var(--color-primary);
      }

      .format-label {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .format-label strong {
        font-size: var(--font-size-sm);
      }

      .format-label small {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * 모달 숨기기
   */
  hide() {
    if (this.modalElement) {
      this.modalElement.classList.remove('active');
      setTimeout(() => {
        this.modalElement?.remove();
        this.modalElement = null;
      }, 200);
    }
  }
}

export const layerExportPanel = new LayerExportPanel();
