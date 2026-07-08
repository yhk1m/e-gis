// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  createStoryDoc, getPage, nextSourceId, addSource, setLayerVisible, addPage, removePage,
  setPageCamera, setPageContent, setCloudSync,
  setPresentationLayout, setPresentationPos, applyCameraToAllPages, syncCameraFromPage,
  setLegendVisible, setLegendPos, setLegendOverride,
  setPageKind, setPageOrder, setPageTitle,
  setSlideBg, setPageBg, slideBgOf, applySlideBgToAll,
} from './StoryDoc.js';

describe('슬라이드 배경색', () => {
  it('setSlideBg는 #rrggbb만, slideBgOf는 프로젝트 기본으로 반영', () => {
    const doc = createStoryDoc('t');
    expect(slideBgOf(doc, doc.pages[0])).toBe('#0b0f14'); // 기본값
    setSlideBg(doc, 'white'); // 무효
    expect(doc.meta.slideBg).toBeUndefined();
    setSlideBg(doc, '#ffffff');
    expect(slideBgOf(doc, doc.pages[0])).toBe('#ffffff');
  });
  it('setPageBg override가 프로젝트 기본보다 우선, 무효값이면 override 제거', () => {
    const doc = createStoryDoc('t');
    setSlideBg(doc, '#ffffff');
    setPageBg(doc, 'page_1', '#123456');
    expect(slideBgOf(doc, getPage(doc, 'page_1'))).toBe('#123456'); // override 우선
    setPageBg(doc, 'page_1', ''); // 제거
    expect(getPage(doc, 'page_1').bg).toBeUndefined();
    expect(slideBgOf(doc, getPage(doc, 'page_1'))).toBe('#ffffff'); // 다시 프로젝트 기본
  });
  it('applySlideBgToAll: 프로젝트 기본 설정 + 모든 페이지 override 제거', () => {
    const doc = createStoryDoc('t');
    const p2 = addPage(doc, 'page_1');
    setPageBg(doc, 'page_1', '#111111');
    setPageBg(doc, p2.id, '#222222');
    applySlideBgToAll(doc, '#00ff00');
    expect(doc.meta.slideBg).toBe('#00ff00');
    expect(getPage(doc, 'page_1').bg).toBeUndefined();
    expect(getPage(doc, p2.id).bg).toBeUndefined();
    expect(slideBgOf(doc, getPage(doc, p2.id))).toBe('#00ff00'); // 모두 프로젝트 기본색
  });
});

describe('setPageTitle', () => {
  it('이름을 바꾸고 앞뒤 공백은 다듬는다', () => {
    const doc = createStoryDoc('t');
    setPageTitle(doc, 'page_1', '  부산 인구  ');
    expect(getPage(doc, 'page_1').title).toBe('부산 인구');
  });
  it('빈 이름은 무시(기존 유지), 없는 페이지는 no-op', () => {
    const doc = createStoryDoc('t');
    const before = getPage(doc, 'page_1').title;
    setPageTitle(doc, 'page_1', '   ');
    expect(getPage(doc, 'page_1').title).toBe(before);
    expect(() => setPageTitle(doc, 'nope', 'x')).not.toThrow();
  });
});

describe('setPageOrder', () => {
  function threePages() {
    const doc = createStoryDoc('t');
    const p2 = addPage(doc, 'page_1');
    const p3 = addPage(doc, 'page_1');
    return { doc, ids: ['page_1', p2.id, p3.id] };
  }
  it('주어진 순열대로 페이지를 재배치한다', () => {
    const { doc, ids } = threePages();
    setPageOrder(doc, [ids[2], ids[0], ids[1]]);
    expect(doc.pages.map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
  });
  it('순열이 아니면(길이 불일치·미지의 id·중복) no-op', () => {
    const { doc, ids } = threePages();
    const before = doc.pages.map((p) => p.id);
    setPageOrder(doc, [ids[0], ids[1]]); // 길이 부족
    setPageOrder(doc, [ids[0], ids[1], 'nope']); // 미지의 id
    setPageOrder(doc, [ids[0], ids[0], ids[1]]); // 중복
    expect(doc.pages.map((p) => p.id)).toEqual(before);
  });
});

describe('setPresentationPos', () => {
  it('상/하/좌/우만 반영, 그 외는 무시', () => {
    const doc = createStoryDoc('t');
    expect(doc.meta.presentationPos).toBeUndefined();
    setPresentationPos(doc, 'diagonal'); // 무효
    expect(doc.meta.presentationPos).toBeUndefined();
    setPresentationPos(doc, 'top');
    expect(doc.meta.presentationPos).toBe('top');
  });
});

describe('setPageKind', () => {
  it('새 페이지는 기본이 map이다', () => {
    const doc = createStoryDoc('t');
    expect(doc.pages[0].kind).toBe('map');
  });
  it('title/media로 바꾸고, 허용 외 값은 무시한다', () => {
    const doc = createStoryDoc('t');
    const id = doc.pages[0].id;
    setPageKind(doc, id, 'title');
    expect(getPage(doc, id).kind).toBe('title');
    setPageKind(doc, id, 'media');
    expect(getPage(doc, id).kind).toBe('media');
    setPageKind(doc, id, 'video'); // 허용 외 enum
    expect(getPage(doc, id).kind).toBe('media'); // 변화 없음
  });
  it('없는 페이지면 no-op(throw 안 함)', () => {
    const doc = createStoryDoc('t');
    expect(() => setPageKind(doc, 'nope', 'title')).not.toThrow();
  });
});

describe('setCloudSync', () => {
  it('새 문서에는 cloudSync가 없고(구버전 .esm 호환 계약), 토글로 불리언 설정된다', () => {
    const doc = createStoryDoc('t');
    expect(doc.meta.cloudSync).toBeUndefined();
    setCloudSync(doc, true);
    expect(doc.meta.cloudSync).toBe(true);
    setCloudSync(doc, 0); // truthy 강제 변환 계약
    expect(doc.meta.cloudSync).toBe(false);
  });
});

describe('createStoryDoc', () => {
  it('기본 페이지 1개를 가진 문서를 만든다', () => {
    const doc = createStoryDoc();
    expect(doc.meta.title).toBe('새 스토리맵');
    expect(doc.meta.mode).toBe('presentation');
    expect(doc.sources).toEqual([]);
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0];
    expect(page.id).toBe('page_1');
    expect(page.title).toBe('페이지 1');
    expect(page.camera).toBeNull();
    expect(page.layerVisibility).toEqual([]);
    expect(page.overrides).toEqual({});
    expect(page.content).toEqual({ heading: '', body: '', caption: '', sideText: '' });
  });

  it('meta.id는 UUID, created=updated ISO', () => {
    const doc = createStoryDoc('부산 이야기');
    expect(doc.meta.title).toBe('부산 이야기');
    expect(doc.meta.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(doc.meta.created).toBe(doc.meta.updated);
    expect(new Date(doc.meta.created).toString()).not.toBe('Invalid Date');
  });
});

describe('getPage', () => {
  it('id로 페이지를 찾고, 없으면 null', () => {
    const doc = createStoryDoc();
    expect(getPage(doc, 'page_1')).toBe(doc.pages[0]);
    expect(getPage(doc, 'page_999')).toBeNull();
  });
});

describe('nextSourceId', () => {
  it('빈 문서는 src_1', () => {
    expect(nextSourceId(createStoryDoc())).toBe('src_1');
  });

  it('기존 최대 번호 + 1', () => {
    const doc = createStoryDoc();
    doc.sources.push({ sourceId: 'src_1' }, { sourceId: 'src_3' });
    expect(nextSourceId(doc)).toBe('src_4');
  });
});

describe('addSource', () => {
  it('sources에 추가하고 소스를 반환한다', () => {
    const doc = createStoryDoc();
    const src = addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: { version: '1.0' } },
      ['L_a', 'L_b'], 'page_1');
    expect(doc.sources).toHaveLength(1);
    expect(src.sourceId).toBe('src_1');
    expect(src.egis).toEqual({ version: '1.0' });
  });

  it('지정 페이지에 visible:true 엔트리를 레이어마다 추가한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a', 'L_b'], 'page_1');
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_1', layerId: 'L_a', visible: true },
      { sourceId: 'src_1', layerId: 'L_b', visible: true },
    ]);
  });

  it('다른 페이지에는 엔트리를 추가하지 않는다(미등재=숨김 계약)', () => {
    const doc = createStoryDoc();
    doc.pages.push({ ...doc.pages[0], id: 'page_2', layerVisibility: [] });
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    expect(getPage(doc, 'page_2').layerVisibility).toEqual([]);
  });
});

describe('setLayerVisible', () => {
  it('기존 엔트리를 갱신한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    setLayerVisible(doc, 'page_1', 'src_1', 'L_a', false);
    expect(getPage(doc, 'page_1').layerVisibility[0].visible).toBe(false);
  });

  it('엔트리가 없으면 새로 만든다(upsert)', () => {
    const doc = createStoryDoc();
    setLayerVisible(doc, 'page_1', 'src_9', 'L_x', true);
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_9', layerId: 'L_x', visible: true },
    ]);
  });

  it('변이는 meta.updated를 갱신한다', async () => {
    const doc = createStoryDoc();
    const before = doc.meta.updated;
    await new Promise((r) => setTimeout(r, 5)); // 타임스탬프 해상도 확보
    setLayerVisible(doc, 'page_1', 'src_1', 'L_a', true);
    expect(doc.meta.updated >= before).toBe(true);
    expect(doc.meta.updated).not.toBe(doc.meta.created);
  });
});

describe('addPage', () => {
  it('지정 페이지의 layerVisibility를 깊은 복사한다(상위 스펙 §4)', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    const p2 = addPage(doc, 'page_1');
    expect(p2.layerVisibility).toEqual(getPage(doc, 'page_1').layerVisibility);
    setLayerVisible(doc, p2.id, 'src_1', 'L_a', false);
    expect(getPage(doc, 'page_1').layerVisibility[0].visible).toBe(true); // 원본 독립
  });

  it('camera를 복사한다(참조 독립)', () => {
    const doc = createStoryDoc();
    getPage(doc, 'page_1').camera = { center: [129, 35], zoom: 10 };
    const p2 = addPage(doc, 'page_1');
    expect(p2.camera).toEqual({ center: [129, 35], zoom: 10 });
    expect(p2.camera).not.toBe(getPage(doc, 'page_1').camera);
    expect(p2.camera.center).not.toBe(getPage(doc, 'page_1').camera.center);
  });

  it('끝에 추가되고 id/제목이 이어진다, content/overrides는 빈 값', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1');
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[1]).toBe(p2);
    expect(p2.id).toBe('page_2');
    expect(p2.title).toBe('페이지 2');
    expect(p2.content).toEqual({ heading: '', body: '', caption: '', sideText: '' });
    expect(p2.overrides).toEqual({});
  });

  it('삭제 후 추가해도 제목이 id와 동기화되어 중복되지 않는다', () => {
    const doc = createStoryDoc();          // page_1
    addPage(doc, 'page_1');                // page_2
    addPage(doc, 'page_2');                // page_3
    removePage(doc, 'page_2');
    const p = addPage(doc, 'page_3');
    expect(p.id).toBe('page_4');
    expect(p.title).toBe('페이지 4');       // 길이 기반이면 '페이지 3'이 되어 중복
    const titles = doc.pages.map((x) => x.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('removePage', () => {
  it('페이지를 제거하고 반환한다', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1');
    const removed = removePage(doc, p2.id);
    expect(removed).toBe(p2);
    expect(doc.pages).toHaveLength(1);
  });

  it('마지막 1페이지는 제거할 수 없다(null 반환, 유지)', () => {
    const doc = createStoryDoc();
    expect(removePage(doc, 'page_1')).toBeNull();
    expect(doc.pages).toHaveLength(1);
  });

  it('없는 페이지 id는 null', () => {
    const doc = createStoryDoc();
    addPage(doc, 'page_1');
    expect(removePage(doc, 'page_999')).toBeNull();
    expect(doc.pages).toHaveLength(2);
  });
});

describe('setPageCamera', () => {
  it('페이지 카메라를 저장한다', () => {
    const doc = createStoryDoc();
    setPageCamera(doc, 'page_1', { center: [129.05, 35.15], zoom: 11 });
    expect(getPage(doc, 'page_1').camera).toEqual({ center: [129.05, 35.15], zoom: 11 });
  });

  it('복사본을 저장한다(원본 배열 변경과 무관)', () => {
    const doc = createStoryDoc();
    const cam = { center: [129, 35], zoom: 10 };
    setPageCamera(doc, 'page_1', cam);
    cam.center[0] = 0;
    expect(getPage(doc, 'page_1').camera.center[0]).toBe(129);
  });

  it('다시 캡처하면 덮어쓴다', () => {
    const doc = createStoryDoc();
    setPageCamera(doc, 'page_1', { center: [129, 35], zoom: 10 });
    setPageCamera(doc, 'page_1', { center: [127, 37], zoom: 7 });
    expect(getPage(doc, 'page_1').camera).toEqual({ center: [127, 37], zoom: 7 });
  });

  it('없는 페이지/빈 camera는 no-op', () => {
    const doc = createStoryDoc();
    setPageCamera(doc, 'page_999', { center: [1, 2], zoom: 3 });
    setPageCamera(doc, 'page_1', null);
    expect(getPage(doc, 'page_1').camera).toBeNull();
  });
});

describe('setPageContent', () => {
  it('부분 패치는 해당 필드만 갱신하고 나머지는 보존한다', () => {
    const doc = createStoryDoc();
    setPageContent(doc, 'page_1', { heading: '부산의 인구' });
    setPageContent(doc, 'page_1', { body: '# 개요' });
    expect(getPage(doc, 'page_1').content).toEqual({
      heading: '부산의 인구', body: '# 개요', caption: '', sideText: '',
    });
  });

  it('여러 필드를 한 번에 패치할 수 있다', () => {
    const doc = createStoryDoc();
    setPageContent(doc, 'page_1', { heading: '제목', body: '본문', caption: '캡션' });
    expect(getPage(doc, 'page_1').content).toEqual({
      heading: '제목', body: '본문', caption: '캡션', sideText: '',
    });
  });

  it('없는 페이지/빈 patch는 no-op', () => {
    const doc = createStoryDoc();
    setPageContent(doc, 'page_999', { heading: 'x' });
    setPageContent(doc, 'page_1', null);
    expect(getPage(doc, 'page_1').content.heading).toBe('');
  });

  it('알 수 없는 필드와 문자열이 아닌 값은 무시한다(.esm 오염 방지)', () => {
    const doc = createStoryDoc();
    setPageContent(doc, 'page_1', { heading: '유지', evil: 'x', body: 123 });
    const content = getPage(doc, 'page_1').content;
    expect(content).toEqual({ heading: '유지', body: '', caption: '', sideText: '' });
    expect('evil' in content).toBe(false);
  });
});

describe('setPresentationLayout', () => {
  it('허용 레이아웃만 meta에 반영한다(기본은 미설정 = 읽기 기본값 band)', () => {
    const doc = createStoryDoc();
    expect(doc.meta.presentationLayout).toBeUndefined();
    setPresentationLayout(doc, 'panel');
    expect(doc.meta.presentationLayout).toBe('panel');
    setPresentationLayout(doc, 'card');
    expect(doc.meta.presentationLayout).toBe('card');
    setPresentationLayout(doc, 'band');
    expect(doc.meta.presentationLayout).toBe('band');
  });

  it('허용되지 않은 값은 무시한다', () => {
    const doc = createStoryDoc();
    setPresentationLayout(doc, 'band');
    setPresentationLayout(doc, 'evil');
    setPresentationLayout(doc, '');
    expect(doc.meta.presentationLayout).toBe('band');
  });
});

describe('applyCameraToAllPages', () => {
  it('현재 카메라를 모든 페이지에 깊은 복사(페이지 간·원본과 독립)한다', () => {
    const doc = createStoryDoc();
    addPage(doc, 'page_1');
    addPage(doc, 'page_1'); // 3 pages
    const cam = { center: [129, 35], zoom: 10 };
    applyCameraToAllPages(doc, cam);
    for (const p of doc.pages) {
      expect(p.camera).toEqual({ center: [129, 35], zoom: 10 });
      expect(p.camera).not.toBe(cam);
      expect(p.camera.center).not.toBe(cam.center);
    }
    expect(doc.pages[0].camera).not.toBe(doc.pages[1].camera);
    doc.pages[0].camera.center[0] = 0;
    expect(doc.pages[1].camera.center[0]).toBe(129);
  });

  it('null/빈 카메라는 no-op', () => {
    const doc = createStoryDoc();
    getPage(doc, 'page_1').camera = { center: [1, 2], zoom: 3 };
    applyCameraToAllPages(doc, null);
    expect(getPage(doc, 'page_1').camera).toEqual({ center: [1, 2], zoom: 3 });
  });
});

describe('syncCameraFromPage', () => {
  it('소스 페이지의 카메라를 대상 페이지로 깊은 복사한다(참조 독립)', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1'); // page_2 (이 시점 page_1 camera=null이므로 p2도 null)
    setPageCamera(doc, 'page_1', { center: [127, 37], zoom: 7 });
    syncCameraFromPage(doc, p2.id, 'page_1');
    expect(getPage(doc, p2.id).camera).toEqual({ center: [127, 37], zoom: 7 });
    expect(getPage(doc, p2.id).camera).not.toBe(getPage(doc, 'page_1').camera);
    getPage(doc, 'page_1').camera.center[0] = 0;
    expect(getPage(doc, p2.id).camera.center[0]).toBe(127);
  });

  it('페이지 누락/소스 카메라 없음은 no-op', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1');
    syncCameraFromPage(doc, p2.id, 'page_1'); // 소스 camera 없음
    expect(getPage(doc, p2.id).camera).toBeNull();
    setPageCamera(doc, 'page_1', { center: [1, 2], zoom: 3 });
    syncCameraFromPage(doc, 'page_999', 'page_1'); // target 없음
    syncCameraFromPage(doc, p2.id, 'page_999');    // source 없음
    expect(getPage(doc, p2.id).camera).toBeNull();
  });
});

describe('범례 변이 (setLegendVisible/Pos/Override)', () => {
  it('meta.legend 없으면 기본값으로 초기화 후 반영한다', () => {
    const doc = createStoryDoc();
    expect(doc.meta.legend).toBeUndefined();
    setLegendVisible(doc, false);
    expect(doc.meta.legend.visible).toBe(false);
    expect(doc.meta.legend.pos).toEqual({ x: 0.02, y: 0.04 });
    expect(doc.meta.legend.overrides).toEqual({});
  });

  it('setLegendPos는 [0,1]로 클램프한다', () => {
    const doc = createStoryDoc();
    setLegendPos(doc, 1.5, -0.2);
    expect(doc.meta.legend.pos).toEqual({ x: 1, y: 0 });
  });

  it('setLegendOverride는 key별 label/hidden을 병합한다', () => {
    const doc = createStoryDoc();
    setLegendOverride(doc, 'src_1:L_a', { label: '인구' });
    setLegendOverride(doc, 'src_1:L_a', { hidden: true });
    expect(doc.meta.legend.overrides['src_1:L_a']).toEqual({ label: '인구', hidden: true });
  });

  it('빈 key/patch는 no-op(초기화도 안 함)', () => {
    const doc = createStoryDoc();
    setLegendOverride(doc, '', { label: 'x' });
    setLegendOverride(doc, 'k', null);
    expect(doc.meta.legend).toBeUndefined();
  });

  it('범례 변이는 meta.updated를 갱신한다', async () => {
    const doc = createStoryDoc();
    const before = doc.meta.updated;
    await new Promise((r) => setTimeout(r, 5));
    setLegendVisible(doc, true);
    expect(doc.meta.updated).not.toBe(before);
  });
});
