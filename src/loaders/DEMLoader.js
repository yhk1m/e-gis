/**
 * DEMLoader - DEM (GeoTIFF) 파일 로더
 * 고도 데이터를 색상으로 시각화하여 표시
 */

import * as GeoTIFF from 'geotiff';
import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import { transformExtent } from 'ol/proj';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';

// 기본 색상 램프 (저고도 -> 고고도)
const DEFAULT_COLOR_RAMP = [
  { value: 0, color: [0, 97, 71] },      // 진한 녹색 (저지대)
  { value: 0.15, color: [34, 139, 34] }, // 녹색
  { value: 0.3, color: [154, 205, 50] }, // 연두색
  { value: 0.45, color: [255, 255, 0] }, // 노란색
  { value: 0.6, color: [255, 165, 0] },  // 주황색
  { value: 0.75, color: [255, 69, 0] },  // 빨간주황
  { value: 0.9, color: [139, 69, 19] },  // 갈색
  { value: 1.0, color: [255, 255, 255] } // 흰색 (고산)
];

class DEMLoader {
  constructor() {
    this.colorRamp = DEFAULT_COLOR_RAMP;
  }

  /**
   * File 객체로부터 DEM 로드
   * @param {File} file - GeoTIFF 또는 IMG 파일
   * @returns {Promise<string>} 생성된 레이어 ID
   */
  async loadFromFile(file) {
    try {
      console.log('DEM 파일 로드 시작:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer 크기:', arrayBuffer.byteLength);

      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      console.log('GeoTIFF 파싱 완료');

      const image = await tiff.getImage();
      console.log('이미지 로드 완료:', image.getWidth(), 'x', image.getHeight());

      // 파일명에서 확장자 제거
      const layerName = file.name.replace(/\.(tif|tiff|geotiff|img)$/i, '');

      return await this.createDEMLayer(image, layerName);
    } catch (error) {
      console.error('DEM 로드 에러:', error);
      // IMG 파일이 GeoTIFF 형식이 아닌 경우 에러 처리
      if (file.name.toLowerCase().endsWith('.img')) {
        throw new Error('IMG 파일을 읽을 수 없습니다. GeoTIFF 형식의 IMG 파일만 지원됩니다.');
      }
      throw new Error('래스터 파일 로드 실패: ' + error.message);
    }
  }

  /**
   * URL로부터 DEM 로드
   * @param {string} url - GeoTIFF URL
   * @param {string} name - 레이어 이름
   * @returns {Promise<string>} 생성된 레이어 ID
   */
  async loadFromUrl(url, name = 'DEM') {
    const tiff = await GeoTIFF.fromUrl(url);
    const image = await tiff.getImage();
    return await this.createDEMLayer(image, name);
  }

  /**
   * GeoTIFF 이미지로부터 DEM 레이어 생성
   * @param {Object} image - GeoTIFF 이미지
   * @param {string} name - 레이어 이름
   * @returns {string} 레이어 ID
   */
  async createDEMLayer(image, name) {
    // 래스터 데이터 읽기
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = rasters[0]; // 첫 번째 밴드 (고도 값)

    // 범위 및 투영 정보
    const bbox = image.getBoundingBox();
    const geoKeys = image.getGeoKeys();

    // 좌표계 확인 (기본적으로 EPSG:4326으로 가정, 필요시 변환)
    let extent = bbox;
    let sourceProj = 'EPSG:4326';

    // GeoKeys에서 투영 정보 확인
    if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) {
      sourceProj = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
    } else if (geoKeys && geoKeys.GeographicTypeGeoKey) {
      sourceProj = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
    }

    console.log('DEM 좌표계:', sourceProj, 'bbox:', bbox);

    // EPSG:3857로 변환 (웹 지도용)
    try {
      // 좌표계가 이미 EPSG:3857인지 확인
      if (sourceProj === 'EPSG:3857') {
        extent = bbox;
      } else {
        extent = transformExtent(bbox, sourceProj, 'EPSG:3857');
      }
    } catch (e) {
      console.warn('좌표계 변환 실패, EPSG:4326으로 시도:', e);
      try {
        extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
      } catch (e2) {
        console.warn('EPSG:4326 변환도 실패, bbox 그대로 사용:', e2);
        // bbox가 이미 EPSG:3857 범위처럼 보이면 그대로 사용
        if (Math.abs(bbox[0]) > 180 || Math.abs(bbox[2]) > 180) {
          extent = bbox; // 이미 미터 단위로 보임
        } else {
          // 수동으로 EPSG:4326 -> EPSG:3857 변환
          const toMercator = (lon, lat) => {
            const x = lon * 20037508.34 / 180;
            let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
            y = y * 20037508.34 / 180;
            return [x, y];
          };
          const min = toMercator(bbox[0], bbox[1]);
          const max = toMercator(bbox[2], bbox[3]);
          extent = [min[0], min[1], max[0], max[1]];
        }
      }
    }

    // 최소/최대 고도 값 계산 (nodata 값 제외)
    let minVal = Infinity;
    let maxVal = -Infinity;
    const noDataValue = image.getGDALNoData() || -9999;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val !== noDataValue && !isNaN(val) && isFinite(val)) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    // DEM 데이터 저장
    const demData = {
      data,
      width,
      height,
      extent,
      minVal,
      maxVal,
      noDataValue
    };

    // 이미지 캔버스 소스 생성
    const canvasSource = new ImageCanvasSource({
      canvasFunction: (extent, resolution, pixelRatio, size) => {
        return this.renderDEM(demData, extent, resolution, size);
      },
      ratio: 1
    });

    // 이미지 레이어 생성
    const olLayer = new ImageLayer({
      source: canvasSource,
      extent: extent,
      opacity: 0.8
    });

    // 레이어 매니저에 추가
    const layerId = layerManager.addLayer({
      name: name,
      type: 'raster',
      olLayer: olLayer,
      source: null,
      geometryType: 'Raster'
    });

    // 레이어에 DEM 메타데이터 저장
    const layerInfo = layerManager.getLayer(layerId);
    if (layerInfo) {
      layerInfo.demData = demData;
      layerInfo.featureCount = `${width}×${height}`;
    }

    // 해당 범위로 이동
    mapManager.fitExtent(extent);

    return layerId;
  }

  /**
   * DEM 데이터를 캔버스에 렌더링
   */
  renderDEM(demData, viewExtent, resolution, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size[0];
    canvas.height = size[1];
    const ctx = canvas.getContext('2d');

    const { data, width, height, extent, minVal, maxVal, noDataValue } = demData;

    // DEM 범위와 뷰 범위의 교차 영역 계산
    const demWidth = extent[2] - extent[0];
    const demHeight = extent[3] - extent[1];
    const viewWidth = viewExtent[2] - viewExtent[0];
    const viewHeight = viewExtent[3] - viewExtent[1];

    // 각 픽셀에 대해 고도 값 가져오기
    const imageData = ctx.createImageData(size[0], size[1]);
    const pixels = imageData.data;

    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++) {
        // 캔버스 픽셀을 지도 좌표로 변환
        const mapX = viewExtent[0] + (x / size[0]) * viewWidth;
        const mapY = viewExtent[3] - (y / size[1]) * viewHeight;

        // DEM 좌표로 변환
        const demX = Math.floor(((mapX - extent[0]) / demWidth) * width);
        const demY = Math.floor(((extent[3] - mapY) / demHeight) * height);

        const pixelIndex = (y * size[0] + x) * 4;

        // 범위 내인지 확인
        if (demX >= 0 && demX < width && demY >= 0 && demY < height) {
          const dataIndex = demY * width + demX;
          const value = data[dataIndex];

          if (value !== noDataValue && !isNaN(value) && isFinite(value)) {
            // 정규화된 값 계산
            const normalized = (value - minVal) / (maxVal - minVal);
            const color = this.getColorForValue(normalized);

            pixels[pixelIndex] = color[0];     // R
            pixels[pixelIndex + 1] = color[1]; // G
            pixels[pixelIndex + 2] = color[2]; // B
            pixels[pixelIndex + 3] = 255;      // A
          } else {
            // NoData - 투명
            pixels[pixelIndex + 3] = 0;
          }
        } else {
          // 범위 외 - 투명
          pixels[pixelIndex + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * 정규화된 값에 대한 색상 반환
   * @param {number} normalized - 0~1 사이의 정규화된 값
   * @returns {number[]} [R, G, B]
   */
  getColorForValue(normalized) {
    const ramp = this.colorRamp;

    // 범위 내 색상 찾기
    for (let i = 0; i < ramp.length - 1; i++) {
      if (normalized >= ramp[i].value && normalized <= ramp[i + 1].value) {
        const ratio = (normalized - ramp[i].value) / (ramp[i + 1].value - ramp[i].value);
        const c1 = ramp[i].color;
        const c2 = ramp[i + 1].color;

        return [
          Math.round(c1[0] + (c2[0] - c1[0]) * ratio),
          Math.round(c1[1] + (c2[1] - c1[1]) * ratio),
          Math.round(c1[2] + (c2[2] - c1[2]) * ratio)
        ];
      }
    }

    // 범위 외
    if (normalized <= 0) return ramp[0].color;
    return ramp[ramp.length - 1].color;
  }

  /**
   * 색상 램프 설정
   * @param {Array} ramp - 색상 램프 배열
   */
  setColorRamp(ramp) {
    this.colorRamp = ramp;
  }

  /**
   * 기본 색상 램프로 리셋
   */
  resetColorRamp() {
    this.colorRamp = DEFAULT_COLOR_RAMP;
  }

  /**
   * 미리 정의된 색상 램프들
   */
  static COLOR_RAMPS = {
    terrain: DEFAULT_COLOR_RAMP,
    grayscale: [
      { value: 0, color: [0, 0, 0] },
      { value: 1, color: [255, 255, 255] }
    ],
    viridis: [
      { value: 0, color: [68, 1, 84] },
      { value: 0.25, color: [59, 82, 139] },
      { value: 0.5, color: [33, 145, 140] },
      { value: 0.75, color: [94, 201, 98] },
      { value: 1, color: [253, 231, 37] }
    ],
    cool: [
      { value: 0, color: [0, 0, 139] },
      { value: 0.5, color: [0, 191, 255] },
      { value: 1, color: [255, 255, 255] }
    ],
    hot: [
      { value: 0, color: [0, 0, 0] },
      { value: 0.33, color: [230, 0, 0] },
      { value: 0.66, color: [255, 200, 0] },
      { value: 1, color: [255, 255, 255] }
    ]
  };
}

// 싱글톤 인스턴스
export const demLoader = new DEMLoader();
