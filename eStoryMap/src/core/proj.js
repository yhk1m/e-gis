// © 2026 김용현
// eStoryMap/src/core/proj.js
// 한국 TM 좌표계 proj4 정의 등록(부수효과 모듈). 이식 원본: e-GIS CoordinateSystem.js.
// 생 GeoTIFF(경로②)의 transformExtent(한국TM → 3857)에 필요.
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

const KOREAN_CRS_DEFS = {
  'EPSG:5179': '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5186': '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5187': '+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
  'EPSG:5188': '+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
};

for (const [code, def] of Object.entries(KOREAN_CRS_DEFS)) {
  if (!proj4.defs(code)) proj4.defs(code, def);
}
register(proj4);
