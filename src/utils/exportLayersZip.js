// © 2026 김용현
/**
 * exportLayersZip - 여러 레이어를 GeoJSON 파일로 바꿔 zip 하나로 저장한다.
 *
 * 레이어 하나를 내보낼 때(레이어 패널 우클릭 「내보내기」)와 같은 방식이다:
 * 지도 좌표(EPSG:3857)를 GeoJSON 표준 좌표(EPSG:4326)로 바꾸고, 파일 이름에 못 쓰는 글자는 _ 로 바꾼다.
 * 이름이 겹치면 _2, _3 을 붙인다. 벡터가 아닌 레이어(래스터, 히트맵 등)는 건너뛰고 알린다.
 */

import GeoJSON from 'ol/format/GeoJSON.js';
import JSZip from 'jszip';
import { isVectorLayer } from './layerSelect.js';

/** 파일 이름에 못 쓰는 글자를 _ 로 (단일 내보내기와 같은 규칙) */
export function safeFileBase(name) {
  return String(name || '레이어').replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * 순수 부분: 레이어 정보 목록 → { files: {파일이름: GeoJSON 글}, skipped: [건너뛴 레이어 이름] }
 * @param {Array} layerInfos layerManager.getLayer() 결과들 (없는 것은 null 이어도 된다)
 */
export function buildGeoJsonFiles(layerInfos) {
  const format = new GeoJSON();
  const files = {};
  const skipped = [];

  for (const info of layerInfos || []) {
    if (!info) continue;
    if (!isVectorLayer(info)) {
      skipped.push(String(info.name || info.id || '레이어'));
      continue;
    }

    const geojson = format.writeFeaturesObject(info.source.getFeatures(), {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });

    const base = safeFileBase(info.name);
    let filename = `${base}.geojson`;
    for (let n = 2; Object.prototype.hasOwnProperty.call(files, filename); n++) {
      filename = `${base}_${n}.geojson`;
    }
    files[filename] = JSON.stringify(geojson, null, 2);
  }

  return { files, skipped };
}

export function zipFileName(count) {
  return `레이어_${count}개.zip`;
}

/** 파일 맵을 zip 으로 묶는다. type 은 jszip generateAsync 의 type ('blob', 'uint8array' 등) */
export async function buildLayersZip(files, type = 'blob') {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(files)) {
    zip.file(name, text);
  }
  return zip.generateAsync({ type, compression: 'DEFLATE', mimeType: 'application/zip' });
}

/**
 * 고른 레이어들을 zip 하나로 저장한다.
 * @param {string[]} layerIds
 * @returns {Promise<{saved: number, skipped: string[]}>}
 */
export async function exportLayersZip(layerIds) {
  // 무거운 모듈은 실제로 내보낼 때만 불러온다 (테스트에서 순수 부분만 쓸 수 있게)
  const [{ layerManager }, { saveBlobAs }, { showAlert }] = await Promise.all([
    import('../core/LayerManager.js'),
    import('./saveFile.js'),
    import('./dialogs.js')
  ]);

  const infos = (layerIds || []).map(id => layerManager.getLayer(id));
  const { files, skipped } = buildGeoJsonFiles(infos);
  const count = Object.keys(files).length;

  if (count === 0) {
    await showAlert('내보낼 수 있는 레이어가 없습니다.\n(점, 선, 면 같은 벡터 레이어만 GeoJSON 으로 내보낼 수 있습니다)');
    return { saved: 0, skipped };
  }

  const blob = await buildLayersZip(files, 'blob');
  await saveBlobAs(zipFileName(count), blob);

  if (skipped.length > 0) {
    await showAlert(
      `레이어 ${count}개를 zip 파일로 저장했습니다.\n` +
      `벡터 레이어가 아닌 ${skipped.length}개는 GeoJSON 으로 바꿀 수 없어 뺐습니다.\n\n` +
      skipped.join('\n')
    );
  }

  return { saved: count, skipped };
}
