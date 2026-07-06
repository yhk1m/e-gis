// © 2026 김용현
// eStoryMap/src/editor/SlidePreview.js
// 편집기 지도 위 발표 미리보기 — 현재 페이지를 발표 화면과 "동일한" 오버레이/커버로 겹쳐 표시.
// 발표 셸(PresentationShell)과 같은 pres-* 클래스 + buildOverlay를 재사용해 이질감을 없앤다.
// #slide-preview는 #map-stage 위 절대배치(pointer-events:none)라 지도 팬/카메라 조정을 막지 않는다.
import { buildOverlay } from '../viewer/presentationNav.js';

/**
 * @param {HTMLElement} root - #slide-preview (#map-stage 자식, 지도 위 오버레이)
 */
export function createSlidePreview(root) {
  // 발표 스테이지와 동일 구조: overlay(지도 슬라이드용 카드) / cover(제목·미디어 전체 커버)
  const overlay = document.createElement('div');
  overlay.className = 'pres-overlay';
  const oHeading = document.createElement('div'); oHeading.className = 'pres-heading';
  const oBody = document.createElement('div'); oBody.className = 'pres-body md-preview';
  const oCaption = document.createElement('div'); oCaption.className = 'pres-caption';
  overlay.append(oHeading, oBody, oCaption);

  const cover = document.createElement('div');
  cover.className = 'pres-cover';
  const cInner = document.createElement('div'); cInner.className = 'pres-cover-inner';
  const cHeading = document.createElement('div'); cHeading.className = 'pres-cover-heading';
  const cBody = document.createElement('div'); cBody.className = 'pres-cover-body md-preview';
  const cCaption = document.createElement('div'); cCaption.className = 'pres-cover-caption';
  cInner.append(cHeading, cBody, cCaption);
  cover.appendChild(cInner);

  root.append(cover, overlay);

  let visible = true;

  /** 현재 페이지를 발표와 동일한 모습으로 미리보기. page 없거나 숨김이면 미표시. */
  function render(page, meta) {
    if (!visible || !page) { root.style.display = 'none'; return; }
    root.style.display = '';
    const kind = page.kind || 'map';
    const layout = (meta && meta.presentationLayout) || 'band';
    root.className = 'pres-layout-' + layout + ' pres-kind-' + kind; // pres CSS가 적용되도록(발표와 동일)
    const vm = buildOverlay(page.content); // {heading, bodyHtml(살균), caption, empty}

    if (kind === 'map') {
      cover.style.display = 'none';
      overlay.style.display = vm.empty ? 'none' : '';
      oHeading.textContent = vm.heading; oHeading.style.display = vm.heading ? '' : 'none';
      oBody.innerHTML = vm.bodyHtml; oBody.style.display = vm.bodyHtml ? '' : 'none';
      oCaption.textContent = vm.caption; oCaption.style.display = vm.caption ? '' : 'none';
    } else {
      overlay.style.display = 'none';
      cover.style.display = '';
      cHeading.textContent = vm.heading; cHeading.style.display = vm.heading ? '' : 'none';
      cBody.innerHTML = vm.bodyHtml; cBody.style.display = vm.bodyHtml ? '' : 'none';
      cCaption.textContent = vm.caption; cCaption.style.display = vm.caption ? '' : 'none';
    }
  }

  function setVisible(v) { visible = !!v; }
  function isVisible() { return visible; }

  return { render, setVisible, isVisible };
}
