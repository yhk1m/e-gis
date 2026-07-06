// © 2026 김용현
// eStoryMap/src/viewer/PresentationShell.js
// 발표 모드 DOM 셸(M9) — 4:3 풀블리드 지도 슬라이드 + 오버레이 카드 + 인디케이터 + 화살표.
// 순수 로직은 presentationNav.js, 페이지 렌더는 core/StoryMapRenderer(applyPageVisibility) 재사용.
// 핵심: 단일 OL 맵 노드(#map)를 발표 스테이지로 재부모 → 소스·레이어 그대로 유지(재파싱 없음).
// 접착 컴포넌트라 단위 테스트 없음 — 수동 스모크(스펙 §6). 순수 로직만 presentationNav.test.js.
import { applyPageVisibility } from '../core/StoryMapRenderer.js';
import { navReduce, indicatorDots, buildOverlay } from './presentationNav.js';

/**
 * @param {HTMLElement} root - 발표 컨테이너(#presentation, 평소 display:none, position:fixed)
 * @param {object} deps
 * @param {HTMLElement} deps.mapEl - 재부모할 지도 노드(#map)
 * @param {HTMLElement} deps.mapHome - 지도 평소 위치(#map-stage) — 종료 시 복귀처(첫 자식으로)
 * @param {import('../core/MapView.js').MapView} deps.mapView
 * @param {import('../shared/CameraAnimator.js').CameraAnimator} deps.animator
 * @param {import('../core/SourceRegistry.js').SourceRegistry} deps.registry
 * @param {() => object} deps.getDoc - 현재 StoryDoc 반환
 * @param {() => void} deps.onExit - 종료 시 편집기 원복(main의 refresh 등)
 */
export function createPresentationShell(root, { mapEl, mapHome, mapView, animator, registry, legend, getDoc, onExit }) {
  root.innerHTML = '';
  root.style.display = 'none';

  // 4:3 레터박스 스테이지 — 지도 노드가 여기로 이동해 배경을 채운다(#map flex:1).
  const stage = document.createElement('div');
  stage.className = 'pres-stage';

  const overlay = document.createElement('div');
  overlay.className = 'pres-overlay'; // 좌하단 반투명 카드
  const oHeading = document.createElement('div'); oHeading.className = 'pres-heading';
  const oBody = document.createElement('div'); oBody.className = 'pres-body md-preview';
  const oCaption = document.createElement('div'); oCaption.className = 'pres-caption';
  overlay.append(oHeading, oBody, oCaption);

  // 제목/미디어 슬라이드용 전체화면 커버(지도를 불투명하게 가림). 종류는 클래스로 스타일 분기.
  const cover = document.createElement('div');
  cover.className = 'pres-cover';
  cover.style.display = 'none';
  const cInner = document.createElement('div'); cInner.className = 'pres-cover-inner';
  const cHeading = document.createElement('div'); cHeading.className = 'pres-cover-heading';
  const cBody = document.createElement('div'); cBody.className = 'pres-cover-body md-preview';
  const cCaption = document.createElement('div'); cCaption.className = 'pres-cover-caption';
  cInner.append(cHeading, cBody, cCaption);
  cover.appendChild(cInner);

  const indicator = document.createElement('div');
  indicator.className = 'pres-indicator';

  const prevBtn = mkBtn('◂', 'pres-arrow pres-prev', '이전 (←)', () => go('prev'));
  const nextBtn = mkBtn('▸', 'pres-arrow pres-next', '다음 (→)', () => go('next'));
  const exitBtn = mkBtn('✕', 'pres-exit', '발표 종료 (Esc)', () => exit());

  stage.append(cover, overlay, indicator, prevBtn, nextBtn, exitBtn);
  root.appendChild(stage);

  let index = 0;
  let active = false;

  function mkBtn(text, cls, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.title = title;
    // 지도로 클릭 전파 금지(발표 중 지도는 인터랙티브하지만 버튼은 네비 전용).
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  const pages = () => getDoc().pages;

  function renderPage() {
    const list = pages();
    const page = list[index];
    if (!page) return;
    const kind = page.kind || 'map';
    const layout = getDoc().meta.presentationLayout || 'band';
    stage.className = 'pres-stage pres-layout-' + layout + ' pres-kind-' + kind;

    const vm = buildOverlay(page.content); // {heading, bodyHtml(살균), caption, empty}

    if (kind === 'map') {
      applyPageVisibility(page, registry);
      animator.flyTo(page.camera); // camera null이면 no-op(그 자리 유지)
      if (legend) legend.render(page, { editable: false }); // 발표: 정적 범례(이 슬라이드 레이어)
      cover.style.display = 'none';
      overlay.style.display = vm.empty ? 'none' : '';
      oHeading.textContent = vm.heading; oHeading.style.display = vm.heading ? '' : 'none';
      oBody.innerHTML = vm.bodyHtml; oBody.style.display = vm.bodyHtml ? '' : 'none';
      oCaption.textContent = vm.caption; oCaption.style.display = vm.caption ? '' : 'none';
    } else {
      // 제목/미디어: 지도 숨김(불투명 커버) + 오버레이 숨김. body가 미디어(미디어)거나 부제(제목).
      overlay.style.display = 'none';
      cover.style.display = '';
      cHeading.textContent = vm.heading; cHeading.style.display = vm.heading ? '' : 'none';
      cBody.innerHTML = vm.bodyHtml; cBody.style.display = vm.bodyHtml ? '' : 'none';
      cCaption.textContent = vm.caption; cCaption.style.display = vm.caption ? '' : 'none';
    }

    indicator.innerHTML = '';
    for (const dot of indicatorDots(list.length, index)) {
      const d = document.createElement('span');
      d.className = 'pres-dot' + (dot.active ? ' active' : '');
      indicator.appendChild(d);
    }
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === list.length - 1;
  }

  function go(action) {
    if (!active) return;
    index = navReduce(index, pages().length, action);
    renderPage();
  }

  function onKey(e) {
    if (!active) return;
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); go('next'); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); go('prev'); break;
      case 'Home': e.preventDefault(); go('first'); break;
      case 'End': e.preventDefault(); go('last'); break;
      case 'Escape': e.preventDefault(); exit(); break;
      default: break;
    }
  }

  // 전체화면 진입 완료 → 지도 리사이즈. 전체화면 해제(브라우저 Esc 포함) → 발표 종료.
  function onFsChange() {
    if (!active) return;
    if (document.fullscreenElement) mapView.updateSize();
    else exit();
  }

  /** 발표 시작. 진입했으면 true, 조건 미충족으로 건너뛰면 false(호출부 inert 격리 판단용). */
  function enter(startIndex = 0) {
    const doc = getDoc();
    if (active || !doc || !doc.pages.length) return false;
    active = true;
    index = Math.max(0, Math.min(doc.pages.length - 1, startIndex | 0));

    // 프로젝트 전체 레이아웃(band/panel/card) — 무대 클래스로만 스타일 분기(M9 확장)
    stage.className = 'pres-stage pres-layout-' + (doc.meta.presentationLayout || 'band');
    stage.insertBefore(mapEl, stage.firstChild); // 지도 노드를 스테이지 배경으로
    root.style.display = '';
    renderPage();

    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    // 전체화면 시도(실패해도 fixed 컨테이너라 발표는 창 안에서 동작)
    if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
    // 레이아웃 반영 후 지도 크기 갱신(전체화면 미지원/거부 대비 즉시도 1회)
    requestAnimationFrame(() => mapView.updateSize());
    return true;
  }

  function exit() {
    if (!active) return;
    active = false; // 먼저 내려 onFsChange 재진입 차단
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFsChange);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});

    mapHome.insertBefore(mapEl, mapHome.firstChild); // 지도 원위치(#map-stage 첫 자식, 캡처 버튼 앞)
    root.style.display = 'none';
    requestAnimationFrame(() => mapView.updateSize());
    onExit();
  }

  return { enter, exit };
}
