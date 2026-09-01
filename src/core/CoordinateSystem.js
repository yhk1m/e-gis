/**
 * CoordinateSystem - 좌표계 관리 및 변환
 */

import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { eventBus, Events } from '../utils/EventBus.js';

// 한국에서 자주 쓰는 좌표계. 이 객체가 정의의 유일한 출처다.
// 로더에서 따로 proj4.defs를 부르지 않는다 — 예전에 ShapefileLoader가 같은 코드를
// 다른 towgs84로 중복 등록했고, init()의 `if (!proj4.defs(code))` 가드 때문에
// 먼저 평가되는 로더 쪽이 이겨서 이 파일의 정의가 조용히 묻혔다.
//
// 파싱 라이브러리에도 좌표계를 넘기지 않는다. shpjs는 .prj를 받으면 스스로
// 재투영하는데, .prj에 적힌 것만 쓰므로 TOWGS84가 빠진 국내 자료에서 데이텀 이동이
// 통째로 생략된다(제주 지적도 기준 약 360m). 변환은 여기 정의로 우리가 한다.
//
// 순서 = 우선순위. 역검증에서 후보가 여럿일 때 앞의 것이 기본값이 된다.
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
    name: 'Korea 2000 / UTM-K (통합원점)',
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
  'EPSG:5185': {
    name: 'Korea 2000 / 서부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5188': {
    // 예전에는 이 자리에 lon_0=125(서부원점 값)가 들어 있었다. EPSG:5188은 동해원점이다.
    name: 'Korea 2000 / 동해원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5181': {
    // 5186과 원점은 같고 y_0만 다르다(50만/60만). 서울시 공원 등 옛 자료가 이 계열을 쓴다.
    name: 'Korea 2000 / 중부원점 (y_0=500000)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:5174': {
    // 서울시 인허가(LOCALDATA) 자료가 쓰는 옛 좌표계. 병원 79곳을 위경도 자료와
    // 이름으로 대조해 확인했다 — 5174는 중앙값 21m, 5181은 314m, 2097은 259m였다.
    //
    // towgs84는 국내 공공데이터 .prj가 선언하는 7파라미터 그대로 쓴다.
    // 예전에는 앞 세 개(평행이동)만 썼는데, 7파라미터는 회전·축척까지 함께 맞춰진
    // 한 벌이라 일부만 떼어 쓰면 어긋난다. 제주 지적도로 확인하니 14m 차이였고,
    // 7파라미터 쪽이 위성영상과 맞았다. 위 21m 중앙값도 그 3파라미터 시절 값이다.
    // 이 값으로 맞추면 같은 .prj를 읽는 QGIS 등과 결과가 같아진다.
    name: 'Korean 1985 / 중부원점 (서울 인허가)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:2097': {
    // 아래 5173·5176·5177·5178도 이 좌표계와 같은 Bessel/Korean 1985 데이텀이고
    // 원점(lon_0)만 다르다. 그래서 towgs84는 전부 5174와 같은 값을 쓴다.
    // EPSG 공식값(-145.907, 505.034, 685.756, …)은 이것과 다른 한 벌이다.
    // 섞어 쓰지 말 것 — 한 벌 안에서만 뜻이 있다.
    name: 'Korean 1985 / 중부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:5173': {
    name: 'Korean 1985 / 서부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=125.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:5176': {
    name: 'Korean 1985 / 동부원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=129.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:5177': {
    name: 'Korean 1985 / 동해원점',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=131.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:5178': {
    name: 'Korean 1985 / UTM-K (통합원점)',
    proj4: '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43',
    units: 'meters'
  },
  'EPSG:32652': {
    name: 'WGS 84 / UTM 52N',
    proj4: '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs',
    units: 'meters'
  },
  'EPSG:32651': {
    name: 'WGS 84 / UTM 51N',
    proj4: '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs',
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

  /**
   * 정의에 있는 좌표계인지 확인한다.
   * 파일이 알려준 EPSG 코드를 근거로 삼아도 되는지 판단하는 데 쓴다 —
   * 우리가 변환할 수 없는 좌표계라면 근거가 아니다.
   */
  isSupported(code) {
    return Boolean(this.getCRSInfo(code));
  }
}

// 싱글톤 인스턴스
export const coordinateSystem = new CoordinateSystem();
