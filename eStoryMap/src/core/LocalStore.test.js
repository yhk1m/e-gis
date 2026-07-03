// © 2026 김용현
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { serializeStoryDoc, deserializeStoryDoc, createAutosaver } from './LocalStore.js';
import { createStoryDoc, addSource, setPageContent, setPageCamera } from './StoryDoc.js';
import { demDataToEgisDoc } from './geotiffParse.js';
import { parseEgisDoc } from './egisParse.js';
import { SourceRegistry } from './SourceRegistry.js';

function tifDoc() {
  // .tif 소스: raster.data가 TypedArray인 문서 (직렬화 함정 재현)
  const doc = createStoryDoc('뒷산 이야기');
  const dem = {
    data: new Float32Array([0, 100, 200, 700]),
    width: 2, height: 2, extent: [0, 0, 10, 10], minVal: 0, maxVal: 700, noDataValue: -9999,
  };
  addSource(doc, { sourceId: 'src_1', filename: '뒷산.tif', egis: demDataToEgisDoc(dem, '뒷산') },
    ['L_dem'], 'page_1');
  setPageContent(doc, 'page_1', { heading: '뒷산', body: '# 개요' });
  setPageCamera(doc, 'page_1', { center: [129.05, 35.15], zoom: 11 });
  return doc;
}

describe('serializeStoryDoc', () => {
  it('TypedArray 래스터를 base64로 인코딩해 JSON 문자열로 만든다', () => {
    const text = serializeStoryDoc(tifDoc());
    const raw = JSON.parse(text);
    const rasterData = raw.sources[0].egis.layers[0].raster.data;
    expect(rasterData.__encoding).toBe('base64');
    expect(rasterData.dtype).toBe('Float32Array');
  });

  it('라이브 문서를 변경하지 않는다(TypedArray 유지)', () => {
    const doc = tifDoc();
    serializeStoryDoc(doc);
    expect(doc.sources[0].egis.layers[0].raster.data).toBeInstanceOf(Float32Array);
  });

  it('이미 인코딩된(.egis 유래) 소스는 그대로 보존한다', () => {
    const doc = createStoryDoc();
    const egis = {
      version: '1.0',
      layers: [{ id: 'L_d', type: 'raster', rasterKind: 'dem',
        raster: { data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' }, width: 1, height: 1, extent: [0, 0, 1, 1] } }],
    };
    const raw = JSON.parse(serializeStoryDoc(addSourceHelper(doc, egis)));
    expect(raw.sources[0].egis.layers[0].raster.data.base64).toBe('AAAA');

    function addSourceHelper(d, e) {
      addSource(d, { sourceId: 'src_1', filename: 'a.egis', egis: e }, ['L_d'], 'page_1');
      return d;
    }
  });
});

describe('deserializeStoryDoc + 라운드트립', () => {
  it('저장→로드→레지스트리 빌드까지 복원된다(핵심 라운드트립)', () => {
    const text = serializeStoryDoc(tifDoc());
    const loaded = deserializeStoryDoc(text);
    expect(loaded.meta.title).toBe('뒷산 이야기');
    expect(loaded.pages[0].content.heading).toBe('뒷산');
    expect(loaded.pages[0].camera).toEqual({ center: [129.05, 35.15], zoom: 11 });
    const reg = new SourceRegistry({ addLayer() {} });
    const result = reg.addSource(loaded.sources[0].sourceId, parseEgisDoc(loaded.sources[0].egis));
    expect(result.builtLayerIds).toEqual(['L_dem']);
    expect(result.skipped).toBe(0);
  });

  it('손상 입력은 명확한 에러를 던진다', () => {
    expect(() => deserializeStoryDoc('not json')).toThrow(/유효하지 않은 \.esm/);
    expect(() => deserializeStoryDoc('{"meta":{}}')).toThrow(/유효하지 않은 \.esm/);
    expect(() => deserializeStoryDoc('{"meta":{},"pages":[],"sources":[]}')).toThrow(/유효하지 않은 \.esm/);
  });
});

describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('연속 schedule은 마지막 기준 delay 후 1회만 저장한다', () => {
    const save = vi.fn();
    const saver = createAutosaver(save, { delay: 2000 });
    saver.schedule();
    vi.advanceTimersByTime(1500);
    saver.schedule(); // 타이머 리셋
    vi.advanceTimersByTime(1999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('저장 후 다시 schedule하면 또 저장된다', () => {
    const save = vi.fn();
    const saver = createAutosaver(save, { delay: 100 });
    saver.schedule();
    vi.advanceTimersByTime(100);
    saver.schedule();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('기본 delay는 2000ms', () => {
    const save = vi.fn();
    createAutosaver(save).schedule();
    vi.advanceTimersByTime(1999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
