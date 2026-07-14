// © 2026 김용현
/**
 * fileCollector - 드롭된 파일/폴더에서 모든 File을 재귀적으로 수집
 *
 * 폴더를 통째로 드래그하면 그 안의 shp/dbf/shx/prj/cpg 등을 모두 가져와,
 * QGIS처럼 "폴더만 넣어도 속성까지" 불러올 수 있게 한다.
 */

/**
 * DataTransfer에서 모든 File을 수집한다 (드롭된 폴더는 재귀 탐색).
 *
 * ⚠️ 반드시 drop 이벤트 핸들러에서 동기적으로 호출해야 한다.
 *    (DataTransferItemList는 이벤트 종료 후 무효화되므로, webkitGetAsEntry는
 *     첫 await 이전에 동기적으로 모두 호출해 엔트리를 확보한다.)
 *
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<File[]>}
 */
export async function collectFilesFromDrop(dataTransfer) {
  const entries = [];
  const items = dataTransfer && dataTransfer.items;

  // 폴더 엔트리를 동기적으로 먼저 확보 (이 시점엔 await 이전)
  if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind && item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length) {
    const files = [];
    for (const entry of entries) {
      await readEntry(entry, files);
    }
    if (files.length) return files;
  }

  // 폴백: 일반 파일 목록 (폴더 지원이 없거나 파일만 드롭된 경우)
  return Array.from((dataTransfer && dataTransfer.files) || []);
}

/**
 * FileSystemEntry를 재귀적으로 읽어 out 배열에 File을 채운다.
 */
function readEntry(entry, out) {
  return new Promise((resolve) => {
    if (!entry) {
      resolve();
      return;
    }
    if (entry.isFile) {
      entry.file(
        (file) => {
          out.push(file);
          resolve();
        },
        () => resolve()
      );
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => {
        reader.readEntries(
          async (batch) => {
            if (!batch.length) {
              resolve();
              return;
            }
            for (const e of batch) {
              await readEntry(e, out);
            }
            // readEntries는 한 번에 최대 100개만 반환하므로 빌 때까지 반복
            readBatch();
          },
          () => resolve()
        );
      };
      readBatch();
    } else {
      resolve();
    }
  });
}

/** 파일명이 shapefile 구성 파일(.shp/.dbf/.shx/.prj/.cpg)인지 여부 */
export function isShapefileComponent(name) {
  return /\.(shp|dbf|shx|prj|cpg)$/i.test(name);
}
