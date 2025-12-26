/**
 * CoordinateSystem - 좌표계 관리 및 변환
 */

import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { eventBus, Events } from '../utils/EventBus.js';

// 한국에서 자주 사용하는 좌표계 정의
const CRS_DEFINITIONS = {
  'EPSG:4326': {
    name: 'WGS 84 (경위도)',
    proj4: '+proj=longlat +datum=WGS84 +no_defs',
    units: 'degrees'
  },
  'EPSG:3857': {
    name: 'Web Mercator',
    proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
    units: 'meters'
  },
  'EPSG:5179': {
    name: 'Korea 2000 / UTM',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5186': {
    name: 'Korea 2000 / 중부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5187': {
    name: 'Korea 2000 / 동부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5188': {
    name: 'Korea 2000 / 서부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  }
};

export class CoordinateSystem {
  constructor() {
    this.displayCRS = 'EPSG:4326';  // 좌표 표시용 좌표계
    this.mapCRS = 'EPSG:3857';      // 지도 내부 좌표계 (Web Mercator)
    this.initialized = false;
  }

  /**
   * 초기화 - proj4 좌표계 등록
   */
  init() {
    if (this.initialized) return;

    // proj4에 좌표계 정의 등록
    Object.entries(CRS_DEFINITIONS).forEach(([code, def]) => {
      if (!proj4.defs(code)) {
        proj4.defs(code, def.proj4);
      }
    });

    // OpenLayers에 proj4 등록
    register(proj4);

    this.initialized = true;
    console.log('좌표계 시스템 초기화 완료');
  }

  /**
   * 사용 가능한 좌표계 목록 반환
   */
  getAvailableCRS() {
    return Object.entries(CRS_DEFINITIONS).map(([code, def]) => ({
      code,
      name: def.name,
      units: def.units
    }));
  }

  /**
   * 좌표계 정보 반환
   */
  getCRSInfo(code) {
    return CRS_DEFINITIONS[code] || null;
  }

  /**
   * 표시용 좌표계 설정
   */
  setDisplayCRS(code) {
    if (!CRS_DEFINITIONS[code]) {
      console.warn(`Unknown CRS: ${code}`);
      return false;
    }

    this.displayCRS = code;
    eventBus.emit(Events.CRS_CHANGED, { crs: code });
    return true;
  }

  /**
   * 현재 표시용 좌표계 반환
   */
  getDisplayCRS() {
    return this.displayCRS;
  }

  /**
   * 좌표 변환
   * @param {number[]} coords - [x, y] 좌표
   * @param {string} fromCRS - 원본 좌표계
   * @param {string} toCRS - 대상 좌표계
   * @returns {number[]} 변환된 좌표
   */
  transform(coords, fromCRS, toCRS) {
    if (fromCRS === toCRS) return coords;

    try {
      // proj4를 직접 사용하여 변환
      const result = proj4(fromCRS, toCRS, coords);
      return result;
    } catch (error) {
      console.error('좌표 변환 오류:', error);
      return coords;
    }
  }

  /**
   * 지도 좌표를 표시용 좌표로 변환
   */
  toDisplay(coords) {
    return this.transform(coords, this.mapCRS, this.displayCRS);
  }

  /**
   * 표시용 좌표를 지도 좌표로 변환
   */
  fromDisplay(coords) {
    return this.transform(coords, this.displayCRS, this.mapCRS);
  }

  /**
   * 좌표를 포맷된 문자열로 반환
   */
  formatCoords(coords, crs = null) {
    const targetCRS = crs || this.displayCRS;
    const info = CRS_DEFINITIONS[targetCRS];

    if (!info) return `${coords[0]}, ${coords[1]}`;

    if (info.units === 'degrees') {
      // 경위도: 소수점 5자리
      return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
    } else {
      // 미터: 소수점 2자리
      return `${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}`;
    }
  }

  /**
   * 좌표계 단위 반환
   */
  getUnits(crs = null) {
    const targetCRS = crs || this.displayCRS;
    return CRS_DEFINITIONS[targetCRS]?.units || 'unknown';
  }
}

// 싱글톤 인스턴스
export const coordinateSystem = new CoordinateSystem();
