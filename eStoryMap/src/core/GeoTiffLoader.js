// © 2026 김용현
// eStoryMap/src/core/GeoTiffLoader.js
// 생 GeoTIFF(ArrayBuffer) → DEM 레이어로 지도 반영 (경로②).
// buildRasterLayer 이후는 경로①과 렌더 코드 1벌 공유(상위 스펙 §1c).
import * as GeoTIFF from 'geotiff';
import { demDataFromGeoTiff } from './geotiffParse.js';
import { buildRasterLayer } from './DemRenderer.js';

/**
 * @param {ArrayBuffer} arrayBuffer - .tif 파일 내용
 * @param {string} filename - 원본 파일명(레이어 이름으로 사용)
 * @param {import('./MapView.js').MapView} mapView
 * @returns {Promise<{name:string, layer:object}>}
 */
export async function loadGeoTiffIntoMap(arrayBuffer, filename, mapView) {
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const demData = await demDataFromGeoTiff(image); // data가 TypedArray라 decode는 통과
  const name = filename.replace(/\.(tif|tiff|geotiff|img)$/i, '');
  const layer = buildRasterLayer({
    id: `L_tif_${name}`,
    name,
    type: 'raster',
    rasterKind: 'dem',
    visible: true,
    opacity: 0.8, // e-GIS DEM 기본 불투명도
    raster: demData,
  });
  mapView.addLayer(layer);
  mapView.fitToLayers([layer]);
  return { name, layer };
}
