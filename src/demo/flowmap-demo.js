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
      url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attributions: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors'
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
  renderer.setData(await resp.json());
})();

const $ = (id) => document.getElementById(id);
$('animate').addEventListener('change', (e) => renderer.setStyle({ animate: e.target.checked }));
$('ramp').addEventListener('change', (e) => renderer.setStyle({ ramp: e.target.value }));
$('width').addEventListener('input', (e) => renderer.setStyle({ widthScale: Number(e.target.value) }));
$('topn').addEventListener('change', (e) => renderer.setStyle({ topN: Math.max(0, Number(e.target.value) || 0) }));
$('locs').addEventListener('change', (e) => renderer.setStyle({ showLocations: e.target.checked }));

// 실측용
window.__flowDemo = { map, renderer, interaction };
