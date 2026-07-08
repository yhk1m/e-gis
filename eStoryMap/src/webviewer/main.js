// © 2026 김용현
// eStoryMap/src/webviewer/main.js
// 게시된 스토리맵 웹뷰어(접착) — 주소 파싱 → Supabase 공개 조회 → 발표 모드(standalone) 진입.
// Electron 의존 없음(순수 웹). 편집기와 같은 렌더 모듈을 재사용해 발표 화면이 동일하다.
import 'ol/ol.css';
import '../style.css';
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import '@fontsource/noto-sans-kr/latin-400.css';
import '@fontsource/noto-sans-kr/latin-700.css';
import '@fontsource/noto-serif-kr/korean-400.css';
import '@fontsource/noto-serif-kr/korean-700.css';
import '@fontsource/noto-serif-kr/latin-400.css';
import '@fontsource/noto-serif-kr/latin-700.css';
import { MapView } from '../core/MapView.js';
import { SourceRegistry } from '../core/SourceRegistry.js';
import { parseEgisDoc } from '../core/egisParse.js';
import { deserializeStoryDoc } from '../core/LocalStore.js';
import { CameraAnimator } from '../shared/CameraAnimator.js';
import { applySlideFont } from '../shared/slideFont.js';
import { createPresentationShell } from '../viewer/PresentationShell.js';
import { createLegend } from '../editor/Legend.js';
import { createSupabaseClient } from '../core/supabaseClient.js';
import { parseStoryPath } from './parseStoryPath.js';

const statusEl = document.getElementById('viewer-status');

function fail(msg, { retry = false } = {}) {
  statusEl.textContent = msg;
  statusEl.classList.add('error');
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '다시 시도';
    b.addEventListener('click', () => location.reload());
    statusEl.appendChild(document.createElement('br'));
    statusEl.appendChild(b);
  }
}

async function boot() {
  const ref = parseStoryPath(location.pathname, location.search);
  if (!ref) return fail('스토리맵을 찾을 수 없습니다. 주소를 확인하세요.');

  let row;
  try {
    const res = await createSupabaseClient()
      .from('published_storymaps').select('doc')
      .eq('handle', ref.handle).eq('seq', ref.seq).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    row = res.data;
  } catch (e) {
    console.error('[viewer] 조회 실패:', e);
    return fail('스토리맵을 불러오지 못했습니다. 네트워크를 확인하세요.', { retry: true });
  }
  if (!row) return fail('스토리맵을 찾을 수 없습니다. 게시가 취소되었거나 주소가 잘못되었습니다.');

  let doc;
  try {
    doc = deserializeStoryDoc(JSON.stringify(row.doc)); // .esm과 같은 구조 검증
  } catch (e) {
    console.error('[viewer] 문서 손상:', e);
    return fail('스토리맵 문서를 열 수 없습니다.');
  }

  document.title = `${doc.meta.title} — e-GIS`;
  // 컨테이너(#map-home)가 hidden이라 초기 크기 0 — shell.enter()가 재부모 후 updateSize()로 복구
  const mapView = new MapView('map');
  const registry = new SourceRegistry(mapView);
  for (const source of doc.sources) {
    registry.addSource(source.sourceId, parseEgisDoc(source.egis)); // visible=false로 빌드(페이지가 켬)
  }
  const animator = new CameraAnimator(mapView.map.getView(), { zoomForView: (z) => mapView.toRawZoom(z) });
  const legend = createLegend(document.getElementById('legend'), { getDoc: () => doc, onChange: () => {} });
  applySlideFont(doc.meta.slideFont || 'default', doc.meta.slideFontCustom);

  const shell = createPresentationShell(document.getElementById('presentation'), {
    mapEl: document.getElementById('map'),
    mapHome: document.getElementById('map-home'),
    mapView,
    animator,
    registry,
    legend,
    getDoc: () => doc,
    onExit: () => {}, // standalone: exit 경로 없음(방어용 no-op)
    standalone: true,
  });
  statusEl.hidden = true;
  shell.enter(0);
}

boot();
