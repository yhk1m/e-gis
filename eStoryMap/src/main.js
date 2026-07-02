// © 2026 김용현
// eStoryMap/src/main.js
import 'ol/ol.css';
import { MapView } from './core/MapView.js';
import { parseEgisDoc } from './core/egisParse.js';
import { SourceRegistry } from './core/SourceRegistry.js';
import { applyPageVisibility } from './core/StoryMapRenderer.js';
import {
  createStoryDoc, addSource, addPage, removePage, getPage, setLayerVisible, nextSourceId,
} from './core/StoryDoc.js';
import { parseGeoTiff } from './core/GeoTiffLoader.js';
import { createSourcePanel } from './editor/SourcePanel.js';
import { createPageList } from './editor/PageList.js';

const mapView = new MapView('map');
const status = document.getElementById('status');
const registry = new SourceRegistry(mapView);
const doc = createStoryDoc();
let currentPageId = doc.pages[0].id;

const sourcePanel = createSourcePanel(document.getElementById('source-panel'), {
  onToggleLayer(sourceId, layerId, visible) {
    setLayerVisible(doc, currentPageId, sourceId, layerId, visible);
    refresh();
  },
});

const pageList = createPageList(document.getElementById('page-list'), {
  onSelect(pageId) {
    currentPageId = pageId;
    refresh();
  },
  onAdd() {
    const page = addPage(doc, currentPageId); // 직전(현재) 페이지 복제
    currentPageId = page.id;
    refresh();
  },
  onRemove(pageId) {
    const removed = removePage(doc, pageId);
    if (removed && currentPageId === pageId) currentPageId = doc.pages[0].id;
    refresh();
  },
});

/** 문서·페이지 상태를 지도와 패널에 반영(단일 갱신 지점). */
function refresh() {
  const page = getPage(doc, currentPageId) || doc.pages[0]; // 방어: 선택이 어긋나도 자가 복구
  applyPageVisibility(page, registry);
  sourcePanel.render(doc, page, registry);
  pageList.render(doc, currentPageId);
}

/** .egis 형식 문서를 소스로 추가(공통 플로우 — .tif도 래핑 후 여기로). */
function addSourceFromEgis(filename, rawJson) {
  const parsed = parseEgisDoc(rawJson);
  const sourceId = nextSourceId(doc);
  const { builtLayerIds, skipped, olLayers } = registry.addSource(sourceId, parsed);
  addSource(doc, { sourceId, filename, egis: rawJson }, builtLayerIds, currentPageId);
  // 카메라: .egis 저장 뷰 우선, 없으면 새 레이어 범위로. (페이지 카메라는 M4)
  if (parsed.view) mapView.setView(parsed.view.center, parsed.view.zoom);
  else if (olLayers.length) mapView.fitToLayers(olLayers);
  refresh();
  const skippedNote = skipped ? ` (복원 불가 ${skipped}개 건너뜀)` : '';
  status.textContent = `${filename} — 레이어 ${builtLayerIds.length}개 추가${skippedNote}`;
}

document.getElementById('btn-import').addEventListener('click', async () => {
  try {
    const picked = await window.egisFS.importEgis();
    if (!picked) return;
    addSourceFromEgis(picked.filename, JSON.parse(picked.text));
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-tif').addEventListener('click', async () => {
  try {
    const picked = await window.egisFS.importTif();
    if (!picked) return;
    status.textContent = `${picked.filename} 파싱 중…`;
    const egisLike = await parseGeoTiff(picked.data, picked.filename);
    addSourceFromEgis(picked.filename, egisLike);
  } catch (e) {
    status.textContent = `GeoTIFF 로드 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});

refresh();
