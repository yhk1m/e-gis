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
import { createAuthManager } from './core/AuthManager.js';
import { createSupabaseClient } from './core/supabaseClient.js';
import { createPresentationShell } from './viewer/PresentationShell.js';
import { openLightbox } from './viewer/lightbox.js';
import { showUpdateModal } from './editor/updateModal.js';
import { createReportShell } from './viewer/ReportShell.js';
import { createLegend } from './editor/Legend.js';

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
  async onRemoveSource(sourceId, filename) {
    if (!(await confirmDialog(`'${filename}' 소스를 제거할까요? 모든 슬라이드에서 이 소스의 레이어가 사라집니다.`))) return;
    removeSource(doc, sourceId);
    registry.removeSource(sourceId);
    refresh();
    scheduleSave();
    status.textContent = `${filename} 소스를 제거했습니다.`;
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
});

const contentEditor = createContentEditor(document.getElementById('content-panel'), {
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
    status.textContent = `배경색을 ${doc.pages.length}개 슬라이드 전체에 적용했습니다.`;
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
  btnTheme.textContent = t === 'light' ? '🌙' : '☀️';
  btnTheme.title = t === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환';
}
applyTheme(localStorage.getItem('egis-theme') || 'dark');
btnTheme.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('egis-theme', next); } catch (e) { /* private 모드 등 무시 */ }
  applyTheme(next);
});

// 상단 앱 전환 탭: e-GIStory ↔ e-GIS(웹앱 임베드, 동등). e-GIS는 처음 전환 시에만 로드.
const tabEstory = document.getElementById('tab-estory');
const tabEgis = document.getElementById('tab-egis');
const egisPane = document.getElementById('egis-pane');
const egisWebview = document.getElementById('egis-webview');
let egisLoaded = false;
function switchApp(toEgis) {
  tabEstory.classList.toggle('active', !toEgis);
  tabEgis.classList.toggle('active', toEgis);
  egisPane.classList.toggle('active', toEgis);
  if (toEgis && !egisLoaded) {
    egisWebview.src = 'https://e-gis.kr'; // 지연 로드
    egisLoaded = true;
  }
  // e-GIS 탭에선 창 제목을 'e-GIS'로(스토리 제목 숨김), e-GIStory 탭에선 스토리 제목 복원
  document.title = toEgis ? 'e-GIS' : (doc ? `${doc.meta.title} — e-GIS` : 'e-GIS');
}
tabEstory.addEventListener('click', () => switchApp(false));
tabEgis.addEventListener('click', () => switchApp(true));

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
  status.textContent = `현재 위치를 ${doc.pages.length}개 슬라이드 전체에 적용했습니다.`;
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
      status.textContent = `'${p.title}'의 위치를 가져왔습니다.`;
    });
    camSyncPop.appendChild(b);
  }
  camSyncPop.hidden = false;
  document.addEventListener('click', onDocClickForPop, true); // 바깥 클릭 닫기(캡처 단계)
});

let saveSeq = 0; // 늦게 도착한 클라우드 콜백이 더 새 상태 표시를 덮지 않게 하는 토큰(M8)
async function doSaveNow() {
  if (!doc || !projectName) return;
  const seq = ++saveSeq;
  try {
    saveStatus.textContent = '저장 중…';
    await window.egisFS.saveProject(projectName, serializeStoryDoc(doc));
    const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    saveStatus.textContent = `저장됨 ${t}`;
    // 클라우드 편승(M8): 토글 on + 로그인 시 비차단 upsert — 실패해도 로컬 저장은 유효
    if (doc.meta.cloudSync && authManager.isLoggedIn()) {
      saveStatus.textContent = `저장됨 ${t} · 클라우드 ↑`;
      cloudSync.upsert(doc)
        .then(() => { if (seq === saveSeq) saveStatus.textContent = `저장됨 ${t} · 클라우드 ✓`; })
        .catch((e) => {
          if (seq === saveSeq) saveStatus.textContent = `저장됨 ${t} · 클라우드 실패: ${e.message}`;
          console.error('[cloud] upsert 실패:', e);
        });
    }
  } catch (e) {
    saveStatus.textContent = `저장 실패: ${e.message}`;
    console.error(e);
  }
}

let saving = Promise.resolve();
/** 저장을 직렬화(이전 저장 완료 후 실행) — 동시 writeFile 인터리브로 .esm 손상 방지. */
function saveNow() {
  saving = saving.then(doSaveNow);
  return saving;
}

const autosaver = createAutosaver(saveNow, { delay: 2000 });

/** 문서 변이 후 호출 — 2초 디바운스 자동저장. */
function scheduleSave() {
  autosaver.schedule();
}

// ⚠️ auth와 cloud는 같은 클라이언트 인스턴스를 공유해야 세션(JWT)이 함께 간다
const supabase = createSupabaseClient();
const authManager = createAuthManager({ client: supabase });
const cloudSync = createCloudSync({ client: supabase, getUser: () => authManager.getUser() });
const publisher = createPublisher({ client: supabase, getUser: () => authManager.getUser() });

// 웹 게시(공개 스냅샷) — 클라우드 동기화(비공개 백업)와 독립
document.getElementById('btn-publish').addEventListener('click', () => {
  if (!doc) return;
  if (!authManager.isLoggedIn()) {
    status.textContent = '게시하려면 🗂 프로젝트 화면에서 로그인하세요.';
    return;
  }
  openPublishDialog({
    doc,
    publisher,
    openExternal: (url) => window.egisFS.openExternal(url),
    onChanged: () => scheduleSave(), // meta.publish 변경을 .esm(+클라우드)에 저장
  });
});

let knownNames = [];
let opening = false;
const startScreen = createStartScreen(document.getElementById('start-screen'), {
  onCreate(title) {
    if (opening) return; // 열기 진행 중 생성 방지
    // knownNames는 sanitize된 파일명 — 같은 규칙으로 비교해야 "어디로 갈까?" 류
    // 제목이 기존 파일을 무백업 덮어쓰는 사고를 막는다(fileService.sanitize와 동일 규칙).
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    if (knownNames.includes(safeName) || knownNames.includes(title)) {
      startScreen.showError('같은 이름의 스토리맵이 이미 있습니다. 다른 제목을 입력하세요.');
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
      }
      enterEditor();
    } catch (e) {
      startScreen.showError(`열기 실패: ${e.message}`);
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
      if (knownNames.includes(name)) await window.egisFS.backupProject(name);
      doc = cloudDoc;
      projectName = name;
      for (const source of doc.sources) {
        registry.addSource(source.sourceId, parseEgisDoc(source.egis)); // visible=false로 빌드
      }
      enterEditor();
      saveNow(); // 오프라인 연속성 — 즉시 로컬 .esm로도 저장
    } catch (e) {
      startScreen.showError(`클라우드 열기 실패: ${e.message}`);
      console.error(e);
    } finally {
      opening = false;
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
  cloudToggle.disabled = !authManager.isLoggedIn();
}
cloudToggle.addEventListener('change', () => {
  if (!doc) return;
  setCloudSync(doc, cloudToggle.checked);
  scheduleSave(); // 켜는 순간의 상태도 2초 뒤 로컬+클라우드로 저장
});

async function refreshCloudList() {
  if (!authManager.isLoggedIn()) {
    startScreen.renderCloud(null);
    return;
  }
  try {
    startScreen.renderCloud(await cloudSync.list());
  } catch (e) {
    startScreen.renderCloud([]); // 앱은 정상 — 목록만 비움
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
  layoutSelect.value = doc.meta.presentationLayout || 'band'; // 발표 레이아웃 현재값 반영
  posSelect.value = doc.meta.presentationPos || 'right'; // 레이아웃 위치 현재값
  fontSelect.value = doc.meta.slideFont || 'default'; // 슬라이드 글꼴 현재값
  fontCustom.value = doc.meta.slideFontCustom || '';
  fontCustom.hidden = (doc.meta.slideFont || 'default') !== 'system';
  applySlideFont(doc.meta.slideFont || 'default', doc.meta.slideFontCustom);
  legendToggle.checked = doc.meta.legend ? doc.meta.legend.visible : true; // 범례 표시 현재값
  mapView.updateSize(); // 슬라이드 캔버스(16:9) 크기 반영 후에 카메라 적용 — 줌 정규화 정확도
  refresh();
  const page = getPage(doc, currentPageId);
  if (page && page.camera) mapView.setView(page.camera.center, page.camera.zoom); // 즉시 복원
}

/** 현재 프로젝트를 저장하고 시작 화면(프로젝트 목록 + 로그인/로그아웃)으로 돌아간다. */
async function backToStart() {
  if (!doc) return;
  await saveNow(); // 저장 완료 후에 전환 — doSaveNow는 doc=null이면 no-op이라 순서가 중요
  registry.clear(); // 이전 프로젝트의 소스 레이어를 지도에서 제거(다음 프로젝트와 섞이지 않게)
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
    startScreen.showError(`목록을 불러오지 못했습니다: ${e.message}`);
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
}

/** .egis 형식 문서를 소스로 추가(공통 플로우 — .tif도 래핑 후 여기로). */
function addSourceFromEgis(filename, rawJson) {
  const parsed = parseEgisDoc(rawJson);
  const sourceId = nextSourceId(doc);
  const { builtLayerIds, skipped, olLayers } = registry.addSource(sourceId, parsed);
  addSource(doc, { sourceId, filename, egis: rawJson }, builtLayerIds, currentPageId);
  // 카메라: .egis 저장 뷰 우선, 없으면 새 레이어 범위로. (페이지 카메라는 M4)
  if (parsed.view) mapView.setViewRaw(parsed.view.center, parsed.view.zoom); // .egis 원본 프레이밍 보존(정규화 X)
  else if (olLayers.length) mapView.fitToLayers(olLayers);
  refresh();
  scheduleSave();
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

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});

document.getElementById('btn-capture').addEventListener('click', () => {
  const page = getPage(doc, currentPageId);
  if (!page) return; // 방어: 선택 불변식이 깨져도 하드 크래시 방지
  setPageCamera(doc, currentPageId, mapView.getCamera());
  scheduleSave();
  status.textContent = `현재 화면을 "${page.title}" 카메라로 저장했습니다`;
});

boot();
