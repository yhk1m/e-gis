// © 2026 김용현
// eStoryMap/src/core/GeoTiffLoader.js
// 생 GeoTIFF(ArrayBuffer) → .egis 형식 문서 (경로②의 파싱 접착부).
// 지도 반영은 하지 않는다 — 소스 추가 플로우(main.js → SourceRegistry)가 담당.
import * as GeoTIFF from 'geotiff';
import { demDataFromGeoTiff, demDataToEgisDoc } from './geotiffParse.js';

/**
 * @param {ArrayBuffer} arrayBuffer - .tif 파일 내용
 * @param {string} filename - 원본 파일명(레이어/소스 이름으로 사용)
 * @returns {Promise<object>} .egis 형식 문서 (parseEgisDoc에 그대로 넣을 수 있음)
 */
export async function parseGeoTiff(arrayBuffer, filename) {
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const demData = await demDataFromGeoTiff(image);
  const name = filename.replace(/\.(tif|tiff|geotiff|img)$/i, '');
  return demDataToEgisDoc(demData, name);
}
