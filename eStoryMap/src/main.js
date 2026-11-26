// © 2026 김용현
// eStoryMap/src/main.js
import 'ol/ol.css';
// 슬라이드 글꼴(번들) — 한국어+라틴 subset만. Noto Sans KR / Noto Serif KR.
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import '@fontsource/noto-sans-kr/latin-400.css';
import '@fontsource/noto-sans-kr/latin-700.css';
import '@fontsource/noto-serif-kr/korean-400.css';
import '@fontsource/noto-serif-kr/korean-700.css';
import '@fontsource/noto-serif-kr/latin-400.css';
import '@fontsource/noto-serif-kr/latin-700.css';
import { MapView } from './core/MapView.js';
import { parseEgisDoc } from './core/egisParse.js';
import { SourceRegistry } from './core/SourceRegistry.js';
import { applyPageVisibility } from './core/StoryMapRenderer.js';
import {
  createStoryDoc, addSource, removeSource, addPage, removePage, setPageOrder, getPage, setLayerVisible, nextSourceId,
  setPageCamera, setPageContent, setPageKind, setPageAlign, setPageSplit, setPageSplitRatio, setPageBasemap, setPageTitle,
  setPageBg, slideBgOf, applySlideBgToAll, setCloudSync,
  duplicatePage, replaceSource,
  setPresentationLayout, setPresentationPos, setSlideFont, setSlideFontCustom, applyCameraToAllPages, syncCameraFromPage,
  setLegendVisible, setLegendPos, setLegendOverride,
} from './core/StoryDoc.js';
import { createCloudSync } from './core/CloudSync.js';
import { createPublisher } from './core/Publisher.js';
import { openPublishDialog } from './editor/publishDialog.js';
import { createSourcePanel } from './editor/SourcePanel.js';
import { createPageList } from './editor/PageList.js';
import { createContentEditor } from './editor/ContentEditor.js';
import { createSlidePreview } from './editor/SlidePreview.js';
import { confirmDialog } from './editor/confirmDialog.js';
import { applySlideColors } from './shared/color.js';
import { applySlideFont } from './shared/slideFont.js';
import { CameraAnimator } from './shared/CameraAnimator.js';
import { serializeStoryDoc, deserializeStoryDoc, createAutosaver } from './core/LocalStore.js';
import { createStartScreen } from './editor/StartScreen.js';
import { createHistory } from './core/History.js';
import { loginDialog } from './editor/loginDialog.js';
import { setImageStore } from './shared/markdown.js';
import { createAuthManager } from './core/AuthManager.js';
import { createSupabaseClient } from './core/supabaseClient.js';
import { createPresentationShell } from './viewer/PresentationShell.js';
import { openLightbox } from './viewer/lightbox.js';
import { showUpdateModal } from './editor/updateModal.js';
import { createReportShell } from './viewer/ReportShell.js';
import { createLegend } from './editor/Legend.js';
import { setIconLabel } from './shared/icons.js';

const mapView = new MapView('map');
const status = document.getElementById('status');
const registry = new SourceRegistry(mapView);
const animator = new CameraAnimator(mapView.map.getView(), { zoomForView: (z) => mapView.toRawZoom(z) });
const slidePreview = createSlidePreview(document.getElementById('slide-preview')); // 지도 위 발표 미리보기
const slideCanvas = document.getElementById('slide-canvas'); // 16:9 슬라이드(배경색 변수 세팅 대상)
const saveStatus = document.getElementById('save-status');
let doc = null; // 시작 화면에서 생성/로드 후 배정
let currentPageId = null;
let projectName = null; // .esm 파일명(제목) — M6에선 생성 시 고정

const sourcePanel = createSourcePanel(document.getElementById('source-panel'), {
  onToggleLayer(sourceId, layerId, visible) {
    setLayerVisible(doc, currentPageId, sourceId, layerId, visible);
    refresh();
    scheduleSave();
  },
  // 전체 선택/해제: 모든 소스의 모든 레이어를 한 번에 토글(refresh·save는 1회)
  onSetAll(visible) {
    for (const { sourceId, layerId } of registry.entriesList()) {
      setLayerVisible(doc, currentPageId, sourceId, layerId, visible);
    }
    refresh();
    scheduleSave();
  },
  // 소스 제거: 문서(모든 페이지 가시성 포함)와 지도(OL 레이어) 양쪽에서 삭제
  // 다른 파일로 바꾸기: 같은 자리에 새 파일을 넣고, 슬라이드마다 켜고 끈 레이어는 그대로 둔다
  async onReplaceSource(sourceId, filename) {
    try {
      const picked = await window.egisFS.importEgis();
      if (!picked) return;
      let egis;
      if (picked.data) {
        const { parseGeoTiff } = await import('./core/GeoTiffLoader.js');
        egis = await parseGeoTiff(picked.data, picked.filename);
      } else {
        egis = JSON.parse(picked.text);
      }
      const parsed = parseEgisDoc(egis);
      registry.removeSource(sourceId);
      const { builtLayerIds, skipped } = registry.addSource(sourceId, parsed);
      loadedEgis.set(sourceId, egis);
      replaceSource(doc, sourceId, { filename: picked.filename, egis }, builtLayerIds, currentPageId);
      refresh();
      scheduleSave();
      const skippedNote = skipped ? ` (복원 못 한 레이어 ${skipped}개 건너뜀)` : '';
      status.textContent = `소스 파일을 바꿨어요. 새 파일: ${picked.filename}${skippedNote}. Ctrl+Z로 되돌릴 수 있어요.`;
    } catch (e) {
      // 반쯤 바뀐 지도 레이어를 문서 상태로 되돌린다
      const source = doc.sources.find((x) => x.sourceId === sourceId);
      registry.removeSource(sourceId);
      if (source) { registry.addSource(sourceId, parseEgisDoc(source.egis)); loadedEgis.set(sourceId, source.egis); }
      refresh();
      status.textContent = `파일을 바꾸지 못했어요: ${e.message}`;
      console.error(e);
    }
  },
  async onRemoveSource(sourceId, filename) {
    if (!(await confirmDialog(`'${filename}' 소스를 뺄까요? 모든 슬라이드에서 이 소스의 레이어가 사라져요.`))) return;
    removeSource(doc, sourceId);
    registry.removeSource(sourceId);
    refresh();
    scheduleSave();
    status.textContent = `${filename} 소스를 뺐어요. Ctrl+Z로 되돌릴 수 있어요.`;
  },
});

const pageList = createPageList(document.getElementById('page-list'), {
  onSelect(pageId) {
    currentPageId = pageId;
    refresh();
    const page = getPage(doc, currentPageId);
    if (page && page.camera) animator.flyTo(page.camera);
  },
  onAdd() {
    const page = addPage(doc, currentPageId); // 직전(현재) 페이지 복제
    currentPageId = page.id;
    refresh();
    scheduleSave();
  },
  async onRemove(pageId) {
    const page = getPage(doc, pageId);
    const label = page ? page.title : '이 슬라이드';
    if (!(await confirmDialog(`'${label}' 슬라이드를 삭제할까요?`))) return; // 삭제 전 확인
    const removed = removePage(doc, pageId);
    if (removed && currentPageId === pageId) currentPageId = doc.pages[0].id;
    refresh();
    scheduleSave();
  },
  onReorder(orderedIds) {
    setPageOrder(doc, orderedIds); // 드래그 앤 드롭 순열대로 재배치
    refresh();
    scheduleSave();
  },
  onRename(pageId, title) {
    setPageTitle(doc, pageId, title); // 페이지(슬라이드) 이름 변경
    refresh();
    scheduleSave();
  },
  onDuplicate(pageId) {
    const page = duplicatePage(doc, pageId); // 글, 배경, 지도 상태까지 똑같이 바로 뒤에
    if (!page) return;
    currentPageId = page.id;
    refresh();
    scheduleSave();
    status.textContent = '슬라이드를 복제했어요.';
  },
});

const contentEditor = createContentEditor(document.getElementById('content-panel'), {
  // 내 컴퓨터 사진: 문서의 사진 보관함에 넣고 id를 돌려준다(본문에는 ![](img:id)로 들어간다)
  onAddImage(dataUrl) {
    if (!doc.images) {
      doc.images = {};
      setImageStore(doc.images);
    }
    let n = Object.keys(doc.images).length + 1;
    while (doc.images[`img_${n}`]) n += 1;
    const id = `img_${n}`;
    doc.images[id] = dataUrl;
    return id;
  },
  onChange(field, value) {
    if (field === 'kind') {
      setPageKind(doc, currentPageId, value); // 종류 변경 → 목록 배지·발표/보고서 렌더 반영
      refresh();
    } else if (field === 'bg') {
      setPageBg(doc, currentPageId, value); // 페이지 배경색 override
      const page = getPage(doc, currentPageId);
      if (value) { // 색 선택(드래그) — 입력요소 재생성 없이 가볍게 갱신(picker 안 끊기게)
        applySlideColors(slideCanvas, slideBgOf(doc, page));
        slidePreview.render(page, doc.meta);
      } else {
        refresh(); // '프로젝트 기본' 리셋 — 전체 갱신(색상 입력값도 기본으로)
      }
    } else if (field === 'align') {
      setPageAlign(doc, currentPageId, value); // 미디어 정렬 — 미리보기만 갱신(지도/패널 무관)
      slidePreview.render(getPage(doc, currentPageId), doc.meta);
    } else if (field === 'split') {
      setPageSplit(doc, currentPageId, value); // 2단 토글 — 콘텐츠 패널(옆 글 칸)·미리보기 갱신
      refresh();
    } else if (field === 'splitRatio') {
      setPageSplitRatio(doc, currentPageId, value); // 좌우 너비 비율 — 미리보기만 갱신
      slidePreview.render(getPage(doc, currentPageId), doc.meta);
    } else if (field === 'basemap') {
      setPageBasemap(doc, currentPageId, value); // 지도 배경(일반/위성/위성+라벨) — 지도에 즉시 반영
      mapView.setBasemap(value);
    } else {
      // 전체 refresh 없음 — 타이핑 중 포커스 유지(콘텐츠는 지도/패널에 영향 없음)
      setPageContent(doc, currentPageId, { [field]: value });
      slidePreview.render(getPage(doc, currentPageId), doc.meta); // 편집 즉시 미리보기 갱신
    }
    scheduleSave();
  },
  onApplyBgAll(color) {
    applySlideBgToAll(doc, color); // 이 배경색을 모든 슬라이드에(프로젝트 기본 + override 제거)
    refresh();
    scheduleSave();
    status.textContent = `배경색을 슬라이드 ${doc.pages.length}개에 모두 적용했어요. Ctrl+Z로 되돌릴 수 있어요.`;
  },
});

// 범례: #map 자식 오버레이. 편집기=편집(드래그·라벨·숨김), 발표=정적. 재부모 시 지도와 동행.
const legend = createLegend(document.getElementById('legend'), {
  getDoc: () => doc,
  onChange: onLegendChange,
});

function onLegendChange(change) {
  if (!doc) return;
  if (change.pos) {
    setLegendPos(doc, change.pos.x, change.pos.y); // 드래그 위치는 재렌더 없이 저장
    scheduleSave();
  } else if (change.override) {
    setLegendOverride(doc, change.override.key, change.override);
    scheduleSave();
    legend.render(getPage(doc, currentPageId), { editable: true }); // 라벨/숨김 반영
  }
}

// M9 발표 셸: #map 노드를 4:3 스테이지로 재부모(소스·레이어 유지). 종료 시 편집기 원복.
const presentation = createPresentationShell(document.getElementById('presentation'), {
  mapEl: document.getElementById('map'),
  mapHome: document.getElementById('slide-canvas'), // 지도 원위치 = 16:9 슬라이드 캔버스
  mapView,
  animator,
  registry,
  legend,
  getDoc: () => doc,
  onExit: exitPresentation,
  // 분할 모드에선 문서 전체를 전체화면으로 — 발표 패널 + e-GIS 분할을 유지한 채 화면을 가득 채움
  fullscreenTarget: () => (document.body.classList.contains('split-mode')
    ? document.documentElement
    : document.getElementById('presentation')),
});

// M10 보고서 셸: 페이지별 지도 캡처 → A4 섹션. PDF는 Electron printToPDF.
const report = createReportShell(document.getElementById('report'), {
  mapView,
  registry,
  getDoc: () => doc,
  onExit: exitReport,
  onSavePDF: (title) => window.egisFS.savePDF(title),
});

function exitReport() {
  document.getElementById('app').inert = false;
  refresh(); // 편집기 현재 페이지 가시성·패널 복원
  const page = getPage(doc, currentPageId);
  if (page && page.camera) mapView.setView(page.camera.center, page.camera.zoom); // 캡처로 옮겨진 뷰 원복
}

function exitPresentation() {
  document.getElementById('app').inert = false;
  refresh(); // 편집기 현재 페이지 가시성·패널 복원
  const page = getPage(doc, currentPageId);
  if (page && page.camera) mapView.setView(page.camera.center, page.camera.zoom); // 카메라 즉시 원복
}

document.getElementById('btn-present').addEventListener('click', () => {
  // 진입에 성공한 경우에만 편집기 비활성(실패 시 inert 굳음 방지). 항상 페이지 1부터(사용자 확정).
  if (presentation.enter(0)) document.getElementById('app').inert = true;
});

document.getElementById('btn-slidepdf').addEventListener('click', () => {
  if (!doc || !doc.pages.length) return;
  document.getElementById('app').inert = true;
  report.open('slides'); // 발표 슬라이드 PDF(16:9). 캡처 재사용, 닫기는 exitReport 공용
});

// 테마(편집기 UI만): 다크 기본, localStorage 기억. 발표=다크 무대·보고서=흰 종이는 고정.
const btnTheme = document.getElementById('btn-theme');
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  setIconLabel(btnTheme, t === 'light' ? 'moon' : 'sun', '', t === 'light' ? '다크 모드로 바꾸기' : '라이트 모드로 바꾸기');
  btnTheme.title = t === 'light' ? '다크 모드로 바꾸기' : '라이트 모드로 바꾸기';
}
applyTheme(localStorage.getItem('egis-theme') || 'dark');
btnTheme.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('egis-theme', next); } catch (e) { /* private 모드 등 무시 */ }
  applyTheme(next);
});

// 상단 앱 전환 탭: e-GIStory ↔ e-GIS(웹앱 임베드, 동등) ↔ ⬓ 분할(둘 다 나란히).
// e-GIS 웹앱은 처음 필요할 때 1회만 로드.
const tabEstory = document.getElementById('tab-estory');
const tabEgis = document.getElementById('tab-egis');
const tabSplit = document.getElementById('tab-split');
const egisPane = document.getElementById('egis-pane');
const egisWebview = document.getElementById('egis-webview');
let egisLoaded = false;
function ensureEgisLoaded() {
  if (egisLoaded) return;
  egisWebview.src = 'https://e-gis.kr'; // 지연 로드
  egisLoaded = true;
  showEgisNote('loading');
}

// e-GIS 웹앱을 불러오는 동안과 불러오지 못했을 때의 안내(인터넷이 끊기면 빈 화면만 남지 않게)
const egisNote = document.createElement('div');
egisNote.className = 'egis-note';
egisNote.hidden = true;
document.getElementById('egis-pane').appendChild(egisNote);
function showEgisNote(kind) {
  egisNote.innerHTML = '';
  if (!kind) { egisNote.hidden = true; return; }
  const msg = document.createElement('p');
  msg.textContent = kind === 'loading'
    ? 'e-GIS를 불러오고 있어요'
    : 'e-GIS를 열지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  egisNote.appendChild(msg);
  if (kind === 'failed') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '다시 시도';
    retry.addEventListener('click', () => { showEgisNote('loading'); egisWebview.reload(); });
    egisNote.appendChild(retry);
  }
  egisNote.hidden = false;
}
let egisFailed = false; // 실패하면 오류 페이지도 "다 불러옴"으로 끝나므로, 그때는 안내를 남긴다
egisWebview.addEventListener('did-start-loading', () => { egisFailed = false; });
egisWebview.addEventListener('did-fail-load', (e) => {
  if (!e.isMainFrame || e.errorCode === -3) return; // -3: 다른 주소로 넘어가며 끊긴 것(오류 아님)
  egisFailed = true;
  showEgisNote('failed');
});
egisWebview.addEventListener('did-finish-load', () => { if (!egisFailed) showEgisNote(null); });
/** 분할 모드 on/off — 왼쪽 e-GIStory(편집/발표) | 오른쪽 e-GIS. 상태는 localStorage에 기억. */
function setSplit(on) {
  document.body.classList.toggle('split-mode', on);
  tabSplit.classList.toggle('active', on);
  if (on) {
    ensureEgisLoaded();
    tabEstory.classList.add('active');
    tabEgis.classList.remove('active');
    egisPane.classList.remove('active'); // 전체 덮기 해제 — 분할 CSS가 오른쪽 절반에 표시
    document.title = doc ? `${doc.meta.title} — e-GIS` : 'e-GIS';
  }
  try { localStorage.setItem('egis-split', on ? '1' : '0'); } catch (e) { /* private 모드 등 무시 */ }
  requestAnimationFrame(() => {
    mapView.updateSize(); // 편집기 지도 폭 변화 반영
    presentation.refreshSize(); // 발표 중이면 무대 크기·카메라 재정규화
  });
}
function switchApp(toEgis) {
  if (document.body.classList.contains('split-mode')) setSplit(false); // 탭 클릭 = 분할 해제
  tabEstory.classList.toggle('active', !toEgis);
  tabEgis.classList.toggle('active', toEgis);
  egisPane.classList.toggle('active', toEgis);
  if (toEgis) ensureEgisLoaded();
  // e-GIS 탭에선 창 제목을 'e-GIS'로(스토리 제목 숨김), e-GIStory 탭에선 스토리 제목 복원
  document.title = toEgis ? 'e-GIS' : (doc ? `${doc.meta.title} — e-GIS` : 'e-GIS');
}
tabEstory.addEventListener('click', () => switchApp(false));
tabEgis.addEventListener('click', () => switchApp(true));
tabSplit.addEventListener('click', () => setSplit(!document.body.classList.contains('split-mode')));

// 좌우 전환(⇄): e-GIS를 왼쪽/오른쪽 어디에 둘지 — 상태 기억
const tabSwap = document.getElementById('tab-swap');
function setSwap(on) {
  document.body.classList.toggle('split-swap', on);
  tabSwap.classList.toggle('active', on);
  try { localStorage.setItem('egis-split-swap2', on ? '1' : '0'); } catch (e) { /* 무시 */ }
  requestAnimationFrame(() => { mapView.updateSize(); presentation.refreshSize(); });
}
tabSwap.addEventListener('click', () => setSwap(!document.body.classList.contains('split-swap')));


// 분할 구분선 드래그(25~75%) — 포인터 캡처로 webview 위에서도 이벤트 유지
const splitDivider = document.getElementById('split-divider');
splitDivider.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  splitDivider.setPointerCapture(e.pointerId);
  splitDivider.classList.add('dragging');
  let raf = 0;
  const onMove = (ev) => {
    // 자유 범위 10~90%. 끝(10% 미만/90% 초과)까지 끌면 0/100%로 스냅 — 한쪽 접기(반대쪽 가득)
    let pct = (ev.clientX / window.innerWidth) * 100;
    pct = pct < 10 ? 0 : pct > 90 ? 100 : pct;
    document.documentElement.style.setProperty('--split-left', pct.toFixed(1) + '%');
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; mapView.updateSize(); });
  };
  const onUp = () => {
    splitDivider.removeEventListener('pointermove', onMove);
    splitDivider.removeEventListener('pointerup', onUp);
    splitDivider.classList.remove('dragging');
    const left = document.documentElement.style.getPropertyValue('--split-left');
    try { localStorage.setItem('egis-split-left', left); } catch (e2) { /* 무시 */ }
    mapView.updateSize();
    presentation.refreshSize(); // 발표 중이면 카메라 재정규화
  };
  splitDivider.addEventListener('pointermove', onMove);
  splitDivider.addEventListener('pointerup', onUp);
});

// 분할 상태 복원(재시작 후에도 유지)
try {
  const savedLeft = localStorage.getItem('egis-split-left');
  if (savedLeft) document.documentElement.style.setProperty('--split-left', savedLeft);
  if (localStorage.getItem('egis-split-swap2') === '1') setSwap(true);
  if (localStorage.getItem('egis-split') === '1') setSplit(true);
} catch (e) { /* 무시 */ }

// 콘텐츠 미리보기의 사진 클릭 → 라이트박스 확대(편집 중 확인용)
document.getElementById('content-preview').addEventListener('click', (e) => {
  if (e.target && e.target.tagName === 'IMG') openLightbox(e.target.currentSrc || e.target.src);
});

// 켤 때 업데이트 확인 결과(메인 프로세스) 수신 → 알림창
if (window.egisUpdate) window.egisUpdate.onAvailable((info) => showUpdateModal(info));

// M9 확장: 발표 레이아웃 선택(프로젝트 전체, doc.meta.presentationLayout)
const layoutSelect = document.getElementById('layout-select');
layoutSelect.addEventListener('change', () => {
  if (!doc) return;
  setPresentationLayout(doc, layoutSelect.value);
  slidePreview.render(getPage(doc, currentPageId), doc.meta); // 레이아웃 바뀌면 미리보기도 반영
  scheduleSave();
});

// 발표 레이아웃 위치(상/하/좌/우, 프로젝트 전체)
const posSelect = document.getElementById('pos-select');
posSelect.addEventListener('change', () => {
  if (!doc) return;
  setPresentationPos(doc, posSelect.value);
  slidePreview.render(getPage(doc, currentPageId), doc.meta); // 미리보기 즉시 반영
  scheduleSave();
});

// 슬라이드 글꼴(프로젝트 전체). --slide-font 변수 적용은 shared/slideFont.js(웹뷰어와 공유).
const fontSelect = document.getElementById('font-select');
const fontCustom = document.getElementById('font-custom');
fontSelect.addEventListener('change', () => {
  if (!doc) return;
  setSlideFont(doc, fontSelect.value);
  fontCustom.hidden = fontSelect.value !== 'system';
  applySlideFont(fontSelect.value, doc.meta.slideFontCustom);
  scheduleSave();
});
fontCustom.addEventListener('input', () => {
  if (!doc) return;
  setSlideFontCustom(doc, fontCustom.value);
  applySlideFont('system', doc.meta.slideFontCustom);
  scheduleSave();
});

// 범례 표시 토글(프로젝트 전체)
const legendToggle = document.getElementById('legend-toggle');
legendToggle.addEventListener('change', () => {
  if (!doc) return;
  setLegendVisible(doc, legendToggle.checked);
  scheduleSave();
  legend.render(getPage(doc, currentPageId), { editable: true });
});

// 발표 미리보기는 항상 표시(지도 위 오버레이 = WYSIWYG). SlidePreview 기본값 visible=true 사용.

// M9 확장: 카메라 위치 도구 (모두 적용 / 위치 가져오기 팝오버)
const camSyncBtn = document.getElementById('btn-cam-sync');
const camSyncPop = document.getElementById('cam-sync-pop');

document.getElementById('btn-cam-all').addEventListener('click', () => {
  if (!doc) return;
  applyCameraToAllPages(doc, mapView.getCamera()); // 현재 지도 뷰 → 전 페이지
  refresh();
  scheduleSave();
  status.textContent = `지금 위치를 슬라이드 ${doc.pages.length}개에 모두 적용했어요. Ctrl+Z로 되돌릴 수 있어요.`;
});

function closeCamSyncPop() {
  camSyncPop.hidden = true;
  camSyncPop.innerHTML = '';
  document.removeEventListener('click', onDocClickForPop, true);
}
function onDocClickForPop(e) {
  if (!camSyncPop.contains(e.target) && e.target !== camSyncBtn) closeCamSyncPop();
}
camSyncBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!doc) return;
  if (!camSyncPop.hidden) { closeCamSyncPop(); return; } // 재클릭 = 토글 닫기
  const others = doc.pages.filter((p) => p.id !== currentPageId);
  camSyncPop.innerHTML = '';
  for (const p of others) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.camera ? p.title : `${p.title} (위치 없음)`;
    b.disabled = !p.camera; // 위치 없는 슬라이드는 가져올 것이 없음
    b.addEventListener('click', () => {
      syncCameraFromPage(doc, currentPageId, p.id); // 선택 슬라이드 위치 → 현재 슬라이드
      closeCamSyncPop();
      refresh();
      const page = getPage(doc, currentPageId);
      if (page && page.camera) animator.flyTo(page.camera);
      scheduleSave();
      status.textContent = `'${p.title}'의 위치를 가져왔어요.`;
    });
    camSyncPop.appendChild(b);
  }
  camSyncPop.hidden = false;
  document.addEventListener('click', onDocClickForPop, true); // 바깥 클릭 닫기(캡처 단계)
});

let saveSeq = 0; // 늦게 도착한 클라우드 콜백이 더 새 상태 표시를 덮지 않게 하는 토큰(M8)
let cloudUpload = Promise.resolve(); // 올리는 중인 클라우드 저장(창 닫기 전에 기다린다)
let retryTimer = null; // 저장 실패 뒤 다시 저장하기
/** 저장. 성공하면 true, 실패하면 false(10초 뒤 다시 시도). 문서가 없으면 true. */
async function doSaveNow() {
  if (!doc || !projectName) return true;
  const seq = ++saveSeq;
  clearTimeout(retryTimer);
  try {
    saveStatus.textContent = '저장 중…';
    await window.egisFS.saveProject(projectName, serializeStoryDoc(doc));
    saveStatus.classList.remove('save-failed');
    saveStatus.title = '';
    const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    saveStatus.textContent = `저장됨 ${t}`;
    // 클라우드 편승(M8): 토글 on + 로그인 시 비차단 upsert — 실패해도 로컬 저장은 유효
    if (doc.meta.cloudSync && authManager.isLoggedIn()) {
      saveStatus.textContent = `${t} 저장, 클라우드에 올리는 중`;
      cloudUpload = cloudSync.upsert(doc)
        .then(() => { if (seq === saveSeq) saveStatus.textContent = `${t} 저장, 클라우드 저장 완료`; })
        .catch((e) => {
          if (seq === saveSeq) saveStatus.textContent = `${t} 저장, 클라우드 저장 못 함: ${e.message}`;
          console.error('[cloud] upsert 실패:', e);
        });
    }
    return true;
  } catch (e) {
    saveStatus.classList.add('save-failed');
    saveStatus.textContent = '저장 못 함';
    saveStatus.title = `저장하지 못했어요. 10초 뒤 다시 저장해요. (${e.message})`;
    console.error(e);
    retryTimer = setTimeout(() => { if (doc) saveNow(); }, 10000);
    return false;
  }
}

let saving = Promise.resolve(true);
/** 저장을 직렬화(이전 저장 완료 후 실행) — 동시 writeFile 인터리브로 .esm 손상 방지. 결과는 성공 여부. */
function saveNow() {
  saving = saving.then(doSaveNow, doSaveNow);
  return saving;
}

const autosaver = createAutosaver(saveNow, { delay: 2000 });

/** 문서 변이 후 호출 — 2초 디바운스 자동저장 + 되돌리기 기록. */
function scheduleSave() {
  history.record();
  updateUndoButtons();
  autosaver.schedule();
}

// 되돌리기, 다시 하기: 슬라이드, 내용, 위치, 소스 목록을 한 묶음으로 되돌린다.
// 게시 정보와 클라우드 동기화 설정은 서버 상태와 맞아야 해서 되돌리지 않는다.
const history = createHistory({
  snapshot: () => ({
    meta: structuredClone(doc.meta),
    pages: structuredClone(doc.pages),
    sources: doc.sources.slice(), // 소스 내용은 바꾸지 않으므로 목록만 복사
  }),
  restore: restoreSnapshot,
});

function restoreSnapshot(s) {
  const keep = { publish: doc.meta.publish, cloudSync: doc.meta.cloudSync };
  doc.meta = structuredClone(s.meta);
  for (const k of Object.keys(keep)) {
    if (keep[k] === undefined) delete doc.meta[k];
    else doc.meta[k] = keep[k];
  }
  doc.pages = structuredClone(s.pages);
  doc.sources = s.sources.slice();
  // 지도 레이어를 문서의 소스 목록에 맞춘다(뺀 소스를 되살리거나, 넣은 소스를 뺀다)
  const inDoc = new Set(doc.sources.map((x) => x.sourceId));
  const onMap = new Set(registry.entriesList().map((e) => e.sourceId));
  for (const id of onMap) if (!inDoc.has(id)) registry.removeSource(id);
  for (const source of doc.sources) {
    // 없는 소스는 올리고, 다른 파일로 바뀐 소스(바꾸기를 되돌린 경우)는 다시 올린다
    const stale = onMap.has(source.sourceId) && loadedEgis.get(source.sourceId) !== source.egis;
    if (stale) registry.removeSource(source.sourceId);
    if (!onMap.has(source.sourceId) || stale) {
      registry.addSource(source.sourceId, parseEgisDoc(source.egis));
      loadedEgis.set(source.sourceId, source.egis);
    }
  }
  if (!getPage(doc, currentPageId)) currentPageId = doc.pages[0].id;
  syncMetaControls();
  refresh();
  autosaver.schedule(); // 되돌린 상태를 저장(기록은 남기지 않는다)
}

const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
function updateUndoButtons() {
  btnUndo.disabled = !doc || !history.canUndo();
  btnRedo.disabled = !doc || !history.canRedo();
}
function undo() {
  if (!doc) return;
  if (history.undo()) status.textContent = '되돌렸어요';
  updateUndoButtons();
}
function redo() {
  if (!doc) return;
  if (history.redo()) status.textContent = '다시 했어요';
  updateUndoButtons();
}
btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

// 편집기 단축키: Ctrl+Z 되돌리기, Ctrl+Shift+Z와 Ctrl+Y 다시 하기, Ctrl+S 바로 저장.
// 글을 쓰는 칸 안에서는 그 칸의 되돌리기를 쓴다.
document.addEventListener('keydown', (e) => {
  if (!doc || document.getElementById('app').inert) return; // 시작 화면, 발표, 보고서 중에는 끔
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 's') {
    e.preventDefault();
    saveNow();
    return;
  }
  const t = e.target;
  const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if (typing && t.type !== 'checkbox' && t.type !== 'range' && t.type !== 'color') return;
  if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
});

// 창을 닫기 전에 기다리던 저장과 클라우드 업로드를 마친다
window.egisApp?.onBeforeClose(async () => {
  if (doc) {
    const ok = await autosaver.flush();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await Promise.race([cloudUpload, wait(5000)]);
    if (!ok) {
      const leave = await confirmDialog(
        '지금 상태를 저장하지 못했어요. 그래도 끄면 마지막 저장 뒤에 고친 내용이 사라져요.',
        { confirmText: '그래도 끄기', cancelText: '켜 두기' },
      );
      if (!leave) { window.egisApp.cancelClose(); return; }
    }
  }
  window.egisApp.closeOk();
});

// ⚠️ auth와 cloud는 같은 클라이언트 인스턴스를 공유해야 세션(JWT)이 함께 간다
const supabase = createSupabaseClient();
const authManager = createAuthManager({ client: supabase });
const cloudSync = createCloudSync({ client: supabase, getUser: () => authManager.getUser() });
const publisher = createPublisher({ client: supabase, getUser: () => authManager.getUser() });

// 웹 게시(공개 스냅샷) — 클라우드 동기화(비공개 백업)와 독립
const authForDialog = {
  signIn: (email, pw) => authManager.signIn(email, pw),
  openSignup: () => window.egisFS.openExternal('https://e-gis.kr'),
};
document.getElementById('btn-publish').addEventListener('click', async () => {
  if (!doc) return;
  if (!authManager.isLoggedIn()) {
    const ok = await loginDialog(authForDialog, { reason: '웹에 게시하려면 e-GIS 계정으로 로그인해 주세요.' });
    if (!ok || !doc) return;
  }
  openPublishDialog({
    doc,
    publisher,
    openExternal: (url) => window.egisFS.openExternal(url),
    onChanged: () => scheduleSave(), // meta.publish 변경을 .esm(+클라우드)에 저장
  });
});

let knownNames = [];
const loadedEgis = new Map(); // 지도에 올려 둔 소스의 파일 내용(sourceId → egis). 되돌리기 때 바뀐 소스를 알아본다
let lastCloudItems = null; // 마지막으로 불러온 클라우드 목록(고친 시각 비교용)
let opening = false;

/** 파일 이름 규칙(fileService.sanitize와 같음)으로 바꾼 뒤, 대소문자 무시하고 겹치는지 본다. except는 자기 자신. */
function hasName(title, except = null) {
  const safe = (t) => t.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120).toLowerCase();
  const target = safe(title);
  if (except !== null && safe(except) === target) return false; // 대소문자만 바꾸는 경우
  return knownNames.some((n) => n.toLowerCase() === target);
}

/** 저장된 .esm의 클라우드 동기화 켜짐 여부. 읽지 못하면 false. */
async function isCloudSynced(name) {
  try {
    return !!JSON.parse(await window.egisFS.loadProject(name)).meta.cloudSync;
  } catch {
    return false;
  }
}

/** 저장된 .esm의 클라우드 동기화를 끈다. */
async function turnOffCloudSync(name) {
  const obj = JSON.parse(await window.egisFS.loadProject(name));
  if (obj.meta) delete obj.meta.cloudSync;
  await window.egisFS.saveProject(name, JSON.stringify(obj));
}
const startScreen = createStartScreen(document.getElementById('start-screen'), {
  onCreate(title) {
    if (opening) return; // 열기 진행 중 생성 방지
    // knownNames는 sanitize된 파일명 — 같은 규칙으로 비교해야 "어디로 갈까?" 류
    // 제목이 기존 파일을 무백업 덮어쓰는 사고를 막는다(fileService.sanitize와 동일 규칙).
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    if (knownNames.includes(safeName) || knownNames.includes(title)) {
      startScreen.showError('같은 이름의 스토리맵이 이미 있어요. 다른 제목을 입력해 주세요.');
      return;
    }
    doc = createStoryDoc(title);
    projectName = title;
    enterEditor();
    saveNow(); // 빈 문서라도 즉시 파일 생성(목록에 나타나게)
  },
  async onOpen(name) {
    if (opening) return; // 더블클릭 경합 가드(로드 중 재진입 방지)
    opening = true;
    try {
      await window.egisFS.backupProject(name); // 편집 세션 시작 전 스냅샷
      const text = await window.egisFS.loadProject(name);
      doc = deserializeStoryDoc(text);
      projectName = name;
      for (const source of doc.sources) {
        registry.addSource(source.sourceId, parseEgisDoc(source.egis)); // visible=false로 빌드
        loadedEgis.set(source.sourceId, source.egis);
      }
      enterEditor();
    } catch (e) {
      abandonOpen();
      startScreen.showError(`열지 못했어요: ${e.message}`);
      console.error(e);
    } finally {
      opening = false;
    }
  },
  // 클라우드 문서 열기(M8): 다운로드 → 로컬 동명 파일 보호(backup) → 로컬 저장 → 편집 진입
  async onOpenCloud(id) {
    if (opening) return;
    opening = true;
    try {
      const cloudDoc = await cloudSync.download(id);
      const name = cloudDoc.meta.title;
      if (knownNames.includes(name)) {
        // 이 컴퓨터에도 같은 스토리맵이 있으면 어느 쪽이 최근인지 보여 주고 확인을 받는다
        const localMs = await window.egisFS.projectMtime(name);
        const item = (lastCloudItems || []).find((r) => r.id === id);
        const cloudMs = item && item.updated_at ? Date.parse(item.updated_at) : null;
        const fmt = (ms) => (ms ? new Date(ms).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '알 수 없음');
        const localNewer = localMs && cloudMs && localMs > cloudMs + 60000; // 1분 넘게 더 최근일 때만
        const ok = await confirmDialog(
          `이 컴퓨터에도 「${name}」 스토리맵이 있어요. 이 컴퓨터 것은 ${fmt(localMs)}, 클라우드 것은 ${fmt(cloudMs)}에 고쳤어요.`
          + (localNewer ? ' 이 컴퓨터 것이 더 최근이에요.' : '')
          + ' 클라우드 것으로 열면 이 컴퓨터 것은 .backups 폴더에 남기고 바꿔요.',
          { confirmText: '클라우드 것으로 열기', cancelText: '닫기', danger: !!localNewer },
        );
        if (!ok) return;
        await window.egisFS.backupProject(name);
      }
      doc = cloudDoc;
      projectName = name;
      for (const source of doc.sources) {
        registry.addSource(source.sourceId, parseEgisDoc(source.egis)); // visible=false로 빌드
        loadedEgis.set(source.sourceId, source.egis);
      }
      enterEditor();
      saveNow(); // 오프라인 연속성 — 즉시 로컬 .esm로도 저장
    } catch (e) {
      abandonOpen();
      startScreen.showError(`클라우드에서 열지 못했어요: ${e.message}`);
      console.error(e);
    } finally {
      opening = false;
    }
  },
  // 다른 폴더(USB, 메일)의 .esm: 저장 폴더로 들여온 뒤 바로 연다
  async onImport() {
    if (opening) return;
    try {
      const name = await window.egisFS.importProject();
      if (!name) return;
      await boot();
      await startScreen.openByName(name);
    } catch (e) {
      startScreen.showError(`파일을 열지 못했어요: ${String(e.message || e).replace(/^.*Error: /, '')}`);
    }
  },
  // 시작 화면 항목 메뉴: 이름 바꾸기, 사본 만들기, 지우기
  async onRename(name, to) {
    if (opening) return;
    if (hasName(to, name)) {
      startScreen.showError('같은 이름의 스토리맵이 이미 있어요. 다른 이름을 입력해 주세요.');
      return;
    }
    try {
      const synced = await isCloudSynced(name);
      await window.egisFS.renameProject(name, to);
      // 클라우드 동기화를 켠 문서는 클라우드 쪽 이름도 같이 바꾼다(안 바꾸면 다음 저장 때 새 문서가 하나 더 생긴다)
      if (synced && authManager.isLoggedIn()) {
        try { await cloudSync.rename({ title: name }, to); } catch (e) {
          startScreen.showError(`이 컴퓨터에서는 이름을 바꿨지만 클라우드는 바꾸지 못했어요: ${e.message}`);
        }
      }
      await boot();
      refreshCloudList();
    } catch (e) {
      startScreen.showError(`이름을 바꾸지 못했어요: ${e.message}`);
    }
  },
  async onDuplicate(name) {
    if (opening) return;
    try {
      await window.egisFS.duplicateProject(name);
      await boot();
    } catch (e) {
      startScreen.showError(`사본을 만들지 못했어요: ${e.message}`);
    }
  },
  async onDelete(name) {
    if (opening) return;
    const ok = await confirmDialog(
      `「${name}」 스토리맵을 지울까요? 지운 파일은 바탕 화면 e-GIStory 폴더 안 .backups 폴더에 남아요.`,
      { confirmText: '지우기' },
    );
    if (!ok) return;
    try {
      await window.egisFS.deleteProject(name);
      await boot();
    } catch (e) {
      startScreen.showError(`지우지 못했어요: ${e.message}`);
    }
  },
  async onRenameCloud(id, title, to) {
    try {
      const cloudTitles = ((await cloudSync.list()) || []).map((r) => r.title);
      if (cloudTitles.includes(to)) {
        startScreen.showError('클라우드에 같은 이름의 스토리맵이 이미 있어요.');
        return;
      }
      await cloudSync.rename({ id }, to);
      // 이 컴퓨터에 같은 이름 파일이 있으면 함께 바꾼다(다음 동기화 때 옛 이름으로 다시 올라가지 않게)
      if (knownNames.includes(title) && !hasName(to, title)) await window.egisFS.renameProject(title, to);
      await boot();
      refreshCloudList();
    } catch (e) {
      startScreen.showError(`클라우드 이름을 바꾸지 못했어요: ${e.message}`);
    }
  },
  async onDeleteCloud(id, title) {
    const local = knownNames.includes(title);
    const ok = await confirmDialog(
      local
        ? `클라우드에서 「${title}」 스토리맵을 지울까요? 이 컴퓨터의 파일은 남고, 이 파일의 클라우드 동기화는 꺼져요.`
        : `클라우드에서 「${title}」 스토리맵을 지울까요? 이 컴퓨터에는 파일이 없어서 되찾을 수 없어요.`,
      { confirmText: '지우기' },
    );
    if (!ok) return;
    try {
      await cloudSync.remove(id);
      if (local) await turnOffCloudSync(title); // 켜 둔 채면 다음 저장 때 클라우드에 다시 올라간다
      refreshCloudList();
    } catch (e) {
      startScreen.showError(`클라우드에서 지우지 못했어요: ${e.message}`);
    }
  },
  auth: {
    signIn: (email, pw) => authManager.signIn(email, pw),
    signOut: () => authManager.signOut(),
    openSignup: () => window.egisFS.openExternal('https://e-gis.kr'),
  },
});

const cloudToggle = document.getElementById('cloud-toggle');
function updateCloudToggle() {
  cloudToggle.checked = !!(doc && doc.meta.cloudSync);
  cloudToggle.disabled = false; // 로그인 안 했으면 누를 때 로그인 창을 띄운다
  cloudToggle.title = authManager.isLoggedIn() ? '' : '누르면 로그인하고 클라우드에 함께 저장해요';
}
cloudToggle.addEventListener('change', async () => {
  if (!doc) return;
  if (cloudToggle.checked && !authManager.isLoggedIn()) {
    cloudToggle.checked = false;
    const ok = await loginDialog(authForDialog, { reason: '클라우드에 함께 저장하려면 e-GIS 계정으로 로그인해 주세요.' });
    if (!ok || !doc) return;
    cloudToggle.checked = true;
  }
  setCloudSync(doc, cloudToggle.checked);
  scheduleSave(); // 켜는 순간의 상태도 2초 뒤 로컬+클라우드로 저장
});

async function refreshCloudList() {
  if (!authManager.isLoggedIn()) {
    startScreen.renderCloud(null);
    return;
  }
  startScreen.renderCloudLoading();
  try {
    lastCloudItems = await cloudSync.list();
    startScreen.renderCloud(lastCloudItems);
  } catch (e) {
    lastCloudItems = null;
    startScreen.renderCloudError('클라우드 목록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', refreshCloudList);
    console.error('[cloud] 목록 로드 실패:', e.message);
  }
}

authManager.onChange(({ user }) => {
  startScreen.updateAuth({ user });
  updateCloudToggle();
  refreshCloudList();
});
// 비차단 init — 세션 복원 실패(오프라인)는 내부에서 흡수, 로컬 기능은 항상 동작(스펙 §4)
authManager.init();

function enterEditor() {
  currentPageId = doc.pages[0].id;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('app').inert = false; // 시작 화면 동안 편집기 전체(포커스·포인터) 비활성
  document.title = `${doc.meta.title} — e-GIS`;
  updateCloudToggle();
  syncMetaControls();
  mapView.updateSize(); // 슬라이드 캔버스(16:9) 크기 반영 후에 카메라 적용 — 줌 정규화 정확도
  refresh();
  const page = getPage(doc, currentPageId);
  if (page && page.camera) mapView.setView(page.camera.center, page.camera.zoom); // 즉시 복원
  pruneImages();
  setImageStore(doc.images);
  refresh(); // 사진 보관함을 등록한 뒤 다시 그린다
  history.reset(); // 이 문서를 연 상태가 되돌리기의 시작점
  updateUndoButtons();
}

/** 문서 전체 설정(발표 배치, 글꼴, 범례)을 도구 막대 칸에 반영한다. 열 때와 되돌릴 때 쓴다. */
function syncMetaControls() {
  layoutSelect.value = doc.meta.presentationLayout || 'band'; // 발표 레이아웃 현재값 반영
  posSelect.value = doc.meta.presentationPos || 'right'; // 레이아웃 위치 현재값
  fontSelect.value = doc.meta.slideFont || 'default'; // 슬라이드 글꼴 현재값
  fontCustom.value = doc.meta.slideFontCustom || '';
  fontCustom.hidden = (doc.meta.slideFont || 'default') !== 'system';
  applySlideFont(doc.meta.slideFont || 'default', doc.meta.slideFontCustom);
  legendToggle.checked = doc.meta.legend ? doc.meta.legend.visible : true; // 범례 표시 현재값
}

/** 본문 어디에도 쓰지 않는 사진을 사진 보관함에서 뺀다(지운 사진이 파일에 계속 남지 않게). */
function pruneImages() {
  if (!doc.images) return;
  const used = new Set();
  for (const page of doc.pages) {
    const c = page.content || {};
    for (const t of [c.heading, c.body, c.caption, c.sideText]) {
      if (typeof t === 'string') for (const m of t.matchAll(/\]\(img:([\w-]+)\)/g)) used.add(m[1]);
    }
  }
  for (const id of Object.keys(doc.images)) if (!used.has(id)) delete doc.images[id];
  if (!Object.keys(doc.images).length) delete doc.images;
}

/** 열다가 실패했을 때: 반쯤 올라간 레이어를 지우고 문서 상태를 비운다(다음 문서와 섞이지 않게). */
function abandonOpen() {
  setImageStore(null);
  registry.clear();
  doc = null;
  projectName = null;
  currentPageId = null;
}

/** 현재 프로젝트를 저장하고 시작 화면(프로젝트 목록 + 로그인/로그아웃)으로 돌아간다. */
async function backToStart() {
  if (!doc) return;
  // 저장 완료 후에 전환 — doSaveNow는 doc=null이면 no-op이라 순서가 중요
  if (!(await saveNow())) {
    const leave = await confirmDialog(
      '지금 상태를 저장하지 못했어요. 그래도 나가면 마지막 저장 뒤에 고친 내용이 사라져요.',
      { confirmText: '그래도 나가기', cancelText: '머무르기' },
    );
    if (!leave) return;
  }
  clearTimeout(retryTimer);
  saveStatus.classList.remove('save-failed');
  registry.clear(); // 이전 프로젝트의 소스 레이어를 지도에서 제거(다음 프로젝트와 섞이지 않게)
  setImageStore(null);
  doc = null;
  currentPageId = null;
  projectName = null;
  document.getElementById('app').inert = true;
  document.getElementById('start-screen').style.display = '';
  document.title = 'e-GIS';
  saveStatus.textContent = '';
  startScreen.updateAuth({ user: authManager.getUser() });
  await boot(); // 프로젝트 목록 새로고침(방금 저장분 포함)
  refreshCloudList();
}
document.getElementById('btn-projects').addEventListener('click', backToStart);

async function boot() {
  try {
    knownNames = await window.egisFS.listProjects();
    startScreen.render(knownNames);
  } catch (e) {
    startScreen.render([]);
    startScreen.showError(`목록을 불러오지 못했어요: ${e.message}`);
    console.error(e);
  }
}

/** 문서·페이지 상태를 지도와 패널에 반영(단일 갱신 지점). */
function refresh() {
  if (!getPage(doc, currentPageId)) currentPageId = doc.pages[0].id; // 방어: 표시·기록이 갈라지지 않게 id 자체를 복구
  const page = getPage(doc, currentPageId);
  applyPageVisibility(page, registry);
  mapView.setBasemap(page.basemap || 'standard'); // 슬라이드별 배경지도(일반/위성/위성+라벨)
  sourcePanel.render(doc, page, registry);
  pageList.render(doc, currentPageId);
  contentEditor.render(page, slideBgOf(doc, page));
  camSyncBtn.disabled = doc.pages.length <= 1; // 가져올 다른 슬라이드가 없으면 비활성
  legend.render(page, { editable: true });
  applySlideColors(slideCanvas, slideBgOf(doc, page)); // 슬라이드 배경/글자색(페이지 override > 프로젝트 기본)
  slidePreview.render(page, doc.meta); // 지도 위 발표 미리보기(발표와 동일한 오버레이/커버)
  updateCaptureMark();
}

/** .egis 형식 문서를 소스로 추가(공통 플로우 — .tif도 래핑 후 여기로). */
function addSourceFromEgis(filename, rawJson) {
  const parsed = parseEgisDoc(rawJson);
  const sourceId = nextSourceId(doc);
  const { builtLayerIds, skipped, olLayers } = registry.addSource(sourceId, parsed);
  loadedEgis.set(sourceId, rawJson);
  addSource(doc, { sourceId, filename, egis: rawJson }, builtLayerIds, currentPageId);
  // 카메라: .egis 저장 뷰 우선, 없으면 새 레이어 범위로. (페이지 카메라는 M4)
  if (parsed.view) mapView.setViewRaw(parsed.view.center, parsed.view.zoom); // .egis 원본 프레이밍 보존(정규화 X)
  else if (olLayers.length) mapView.fitToLayers(olLayers);
  refresh();
  scheduleSave();
  const skippedNote = skipped ? ` (복원 불가 ${skipped}개 건너뜀)` : '';
  status.textContent = `${filename}: 레이어 ${builtLayerIds.length}개 추가${skippedNote}`;
}

document.getElementById('btn-import').addEventListener('click', async () => {
  try {
    const picked = await window.egisFS.importEgis();
    if (!picked) return;
    if (picked.data) {
      // 지형 파일(GeoTIFF): 읽어서 .egis와 같은 모양으로 바꾼 뒤 소스로 넣는다
      status.textContent = `${picked.filename} 읽는 중…`;
      const { parseGeoTiff } = await import('./core/GeoTiffLoader.js');
      addSourceFromEgis(picked.filename, await parseGeoTiff(picked.data, picked.filename));
      return;
    }
    addSourceFromEgis(picked.filename, JSON.parse(picked.text));
  } catch (e) {
    status.textContent = `파일을 열지 못했어요: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});

// 지도를 움직였는데 이 슬라이드 위치로 저장하지 않았으면 「이 위치 저장」 버튼에 점을 띄운다
const btnCapture = document.getElementById('btn-capture');
function updateCaptureMark() {
  const page = doc && getPage(doc, currentPageId);
  let unsaved = false;
  if (page && (page.kind || 'map') === 'map') {
    const cam = mapView.getCamera();
    unsaved = !page.camera
      || Math.abs(cam.center[0] - page.camera.center[0]) > 1e-4
      || Math.abs(cam.center[1] - page.camera.center[1]) > 1e-4
      || Math.abs(cam.zoom - page.camera.zoom) > 0.02;
  }
  btnCapture.classList.toggle('unsaved', unsaved);
  btnCapture.title = unsaved
    ? '지금 지도 화면이 이 슬라이드 위치와 달라요. 눌러서 저장하세요'
    : '지금 지도 화면을 이 슬라이드의 위치로 저장';
}
mapView.map.on('moveend', updateCaptureMark);

document.getElementById('btn-capture').addEventListener('click', () => {
  const page = getPage(doc, currentPageId);
  if (!page) return; // 방어: 선택 불변식이 깨져도 하드 크래시 방지
  setPageCamera(doc, currentPageId, mapView.getCamera());
  scheduleSave();
  updateCaptureMark();
  refresh(); // 슬라이드 목록의 위치 표시를 바로 갱신
  status.textContent = `지금 화면을 "${page.title}" 위치로 저장했어요`;
});

boot();
