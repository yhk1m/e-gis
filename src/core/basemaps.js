// © 2026 김용현
/**
 * 배경지도 카탈로그
 *
 * 두 묶음이다. 한국은 국토교통부 VWorld(한글·지번·건물명, 키 필요, 한국 밖은 비어 있음),
 * 세계는 키 없이 되는 OSM·OpenTopoMap·Esri. 기본값은 키 없이도 어디서나 나오는 OSM.
 *
 * 항목 모양: { key, label, group, source(), labels?() }
 *  - labels 가 있으면 "베이스 + 라벨 오버레이" 항목이다 (위성 위에 지명·도로명).
 *  - group 'hidden' 은 팝오버 목록에는 안 나오고 3D 패널에서만 고를 수 있다 (NONE).
 *
 * 왜 뺐나 (2026-09-14 서울 z12·z15 타일 실측):
 *  - Esri World_Street_Map / World_Topo_Map / Light Gray 는 한국이 z13 까지만 나온다.
 *  - CARTO light_all / dark_all 은 키 없이는 "API KEY REQUIRED" 워터마크가 찍힌다.
 *    (라벨 전용 타일 voyager_only_labels 는 정상이라 위성+라벨에 계속 쓴다)
 *
 * 설계: docs/superpowers/specs/2026-09-14-basemap-catalog-design.md
 */
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

// 배경 타일은 예외 없이 익명 CORS 로 받는다.
// crossOrigin 을 주지 않으면 타일 이미지가 캔버스를 오염시켜(tainted canvas)
// 지도 내보내기의 canvas.toDataURL() 이 SecurityError 로 막힌다.
// ol/source/OSM 만 기본값이 'anonymous' 이고 ol/source/XYZ 는 지정하지 않으면 null 이다.
const TILE_CROSS_ORIGIN = 'anonymous';

export const DEFAULT_BASEMAP = 'OSM';

/** 빌드 때 주입되는 VWorld 인증키 (.env.local / Vercel 환경변수). 없으면 한국 묶음이 빠진다. */
export const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY || '';

export const BASEMAP_GROUPS = [
  { id: 'korea', label: '한국 (VWorld)' },
  { id: 'world', label: '세계' }
];

/** VWorld WMTS 타일 주소. 경로가 z/y/x 순서라 OL 기본({z}/{x}/{y})과 다르다. */
export function vworldTileUrl(layer, ext, key) {
  return `https://api.vworld.kr/req/wmts/1.0.0/${key}/${layer}/{z}/{y}/{x}.${ext}`;
}

const VWORLD_ATTRIBUTION = '&copy; <a href="https://www.vworld.kr/">VWorld</a>(국토교통부)';

// VWorld 는 줌 6~19 만 제공한다. 그 밖의 줌은 요청하지 않는다 (404 대신 빈 화면).
const vworldSource = (layer, ext, key) => () => new XYZ({
  url: vworldTileUrl(layer, ext, key),
  minZoom: 6,
  maxZoom: 19,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: VWORLD_ATTRIBUTION
});

function koreaBasemaps(key) {
  return [
    { key: 'VW_BASE', label: '일반', group: 'korea', source: vworldSource('Base', 'png', key) },
    { key: 'VW_GRAY', label: '회색', group: 'korea', source: vworldSource('gray', 'png', key) },
    { key: 'VW_MIDNIGHT', label: '야간', group: 'korea', source: vworldSource('midnight', 'png', key) },
    { key: 'VW_SATELLITE', label: '위성', group: 'korea', source: vworldSource('Satellite', 'jpeg', key) },
    {
      key: 'VW_HYBRID', label: '위성 + 라벨', group: 'korea',
      source: vworldSource('Satellite', 'jpeg', key),
      labels: vworldSource('Hybrid', 'png', key)
    }
  ];
}

const esriImagery = () => new XYZ({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: '&copy; Esri'
});

// 라벨(지명/도로명) 오버레이 타일 — 위성+라벨 모드에서만 표시
// Esri World_Boundaries_and_Places 는 광역 지명만 있어 확대 시 라벨이 사라지므로,
// 거리·동네까지 촘촘한 CARTO(OSM 기반) 라벨 전용 타일을 쓴다.
// voyager_only_labels: 도로·지명이 서로 다른 색(+흰 외곽선)이라 위성 위에서 잘 보임.
// @2x 레티나 타일(tilePixelRatio:2)로 고해상도 화면에서도 선명.
const cartoLabels = () => new XYZ({
  url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
  tilePixelRatio: 2,
  maxZoom: 20,
  crossOrigin: TILE_CROSS_ORIGIN,
  attributions: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const WORLD_BASEMAPS = [
  {
    key: 'OSM', label: 'OSM 표준', group: 'world',
    source: () => new OSM({ crossOrigin: TILE_CROSS_ORIGIN })
  },
  {
    key: 'OPENTOPO', label: '지형도 (OpenTopoMap)', group: 'world',
    source: () => new XYZ({
      url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17,
      crossOrigin: TILE_CROSS_ORIGIN,
      attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | map style &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)'
    })
  },
  { key: 'SATELLITE', label: '위성 (Esri)', group: 'world', source: esriImagery },
  { key: 'SATELLITE_LABELS', label: '위성 + 라벨', group: 'world', source: esriImagery, labels: cartoLabels },
  {
    key: 'ESRI_DARK', label: '어두운 지도 (Esri)', group: 'world',
    source: () => new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 16,
      crossOrigin: TILE_CROSS_ORIGIN,
      attributions: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors'
    })
  },
  {
    key: 'NONE', label: '없음', group: 'hidden',
    source: () => new XYZ({ url: '', crossOrigin: TILE_CROSS_ORIGIN })
  }
];

/**
 * 키 유무를 반영한 카탈로그. 한국 묶음은 키가 있을 때만 들어간다.
 * @param {{ vworldKey?: string }} [opts]
 */
export function getBasemapCatalog({ vworldKey = VWORLD_KEY } = {}) {
  return [...(vworldKey ? koreaBasemaps(vworldKey) : []), ...WORLD_BASEMAPS];
}

/** 키로 항목 찾기. 없으면 null. */
export function findBasemap(key, opts) {
  return getBasemapCatalog(opts).find((b) => b.key === key) || null;
}
