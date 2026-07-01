// © 2026 김용현
// eStoryMap/src/main.js
import 'ol/ol.css';
import { MapView } from './core/MapView.js';
import { loadEgisIntoMap } from './core/EgisLoader.js';

const mapView = new MapView('map');
const status = document.getElementById('status');

document.getElementById('btn-import').addEventListener('click', async () => {
  const picked = await window.egisFS.importEgis();
  if (!picked) return;
  try {
    const raw = JSON.parse(picked.text);
    const result = loadEgisIntoMap(raw, mapView);
    const rasterNote = result.skipped ? ` (래스터 ${result.skipped}개는 M2에서)` : '';
    status.textContent = `${picked.filename} — 벡터 ${result.vectorCount}개 로드${rasterNote}`;
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});
