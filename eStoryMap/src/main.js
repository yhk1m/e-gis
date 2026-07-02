// © 2026 김용현
// eStoryMap/src/main.js
import 'ol/ol.css';
import { MapView } from './core/MapView.js';
import { loadEgisIntoMap } from './core/EgisLoader.js';
import { loadGeoTiffIntoMap } from './core/GeoTiffLoader.js';

const mapView = new MapView('map');
const status = document.getElementById('status');

document.getElementById('btn-import').addEventListener('click', async () => {
  const picked = await window.egisFS.importEgis();
  if (!picked) return;
  try {
    const raw = JSON.parse(picked.text);
    const result = loadEgisIntoMap(raw, mapView);
    const parts = [];
    if (result.vectorCount) parts.push(`벡터 ${result.vectorCount}개`);
    if (result.rasterCount) parts.push(`래스터 ${result.rasterCount}개`);
    const skippedNote = result.skipped ? ` (복원 불가 ${result.skipped}개 건너뜀)` : '';
    status.textContent = `${picked.filename} — ${parts.join('·') || '레이어 없음'} 로드${skippedNote}`;
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-tif').addEventListener('click', async () => {
  const picked = await window.egisFS.importTif();
  if (!picked) return;
  status.textContent = `${picked.filename} 파싱 중…`;
  try {
    const result = await loadGeoTiffIntoMap(picked.data, picked.filename, mapView);
    status.textContent = `${picked.filename} — DEM 레이어 로드 (${result.name})`;
  } catch (e) {
    status.textContent = `GeoTIFF 로드 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});
