// © 2026 김용현
/**
 * 흐름도 시연 페이지 — 제품과 같은 FlowRenderer·FlowInteraction 을 단독 지도에 얹는다.
 */
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import { FlowRenderer } from '../flow/FlowRenderer.js';
import { FlowInteraction } from '../flow/FlowInteraction.js';
import './flowmap-demo.css';

const map = new Map({
  target: 'map',
  layers: [new TileLayer({
    source: new XYZ({
      // CARTO 무료 타일은 이제 API 키 없이는 "API KEY REQUIRED" 워터마크가 찍힌다 → Esri 다크 그레이
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 16,
      attributions: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors'
    })
  })],
  view: new View({ center: fromLonLat([127.6, 36.2]), zoom: 7 })
});

const renderer = new FlowRenderer({ zIndex: 10 });
map.addLayer(renderer);

const interaction = new FlowInteraction({ map, getRenderers: () => (renderer.getVisible() ? [renderer] : []) });
interaction.attach();

// 최상위 await 는 Vite 기본 타깃(es2020)에서 막히므로 async 함수로 감싼다
(async () => {
  const resp = await fetch('/data/builtin/practice/Flow Data/시도간_인구이동_예시.json');
  renderer.setStyle({ darkMode: true }); // 시연은 어두운 배경 — 큰 흐름이 밝게
  renderer.setData(await resp.json());
})();

const $ = (id) => document.getElementById(id);
$('animate').addEventListener('change', (e) => renderer.setStyle({ animate: e.target.checked }));
$('ramp').addEventListener('change', (e) => renderer.setStyle({ ramp: e.target.value }));
$('width').addEventListener('input', (e) => renderer.setStyle({ widthScale: Number(e.target.value) }));
$('topn').addEventListener('change', (e) => renderer.setStyle({ topN: Math.max(0, Number(e.target.value) || 0) }));
$('locs').addEventListener('change', (e) => renderer.setStyle({ showLocations: e.target.checked }));
$('curved').addEventListener('change', (e) => renderer.setStyle({ curved: e.target.checked }));
$('arrows').addEventListener('change', (e) => renderer.setStyle({ arrowHeads: e.target.checked }));
$('circle-mode').addEventListener('change', (e) => {
  renderer.setStyle({ circleMode: e.target.value });
  $('legend-net').hidden = e.target.value === 'inout';
  $('legend-inout').hidden = e.target.value !== 'inout';
});

// 실측용
window.__flowDemo = { map, renderer, interaction };
