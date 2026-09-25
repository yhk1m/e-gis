// © 2026 김용현
/**
 * 실험실 상태 규칙.
 * - 기본은 전부 꺼짐. 저장값은 localStorage 'eGIS_labs' 한 키.
 * - ?lab=a,b / all / none 은 그 세션만 덮어쓴다. 저장값은 건드리지 않는다.
 * - 레지스트리에 없는 id 는 언제나 꺼짐(저장돼 있어도).
 * - 저장소가 죽어 있어도(사생활 모드) 예외 없이 전부 꺼진 채로 간다.
 */
import { describe, it, expect, vi } from 'vitest';
import { Labs, parseLabQuery, LABS_STORAGE_KEY } from './labs.js';

const KNOWN = ['glass', 'globe'];

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    dump: () => data
  };
}

function brokenStorage() {
  const boom = () => { throw new Error('SecurityError'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

function make({ search = '', storage = fakeStorage(), knownIds = KNOWN, baseUrl = 'https://e-gis.kr/' } = {}) {
  const labs = new Labs();
  labs.init({ search, storage, knownIds, baseUrl });
  return { labs, storage };
}

describe('parseLabQuery', () => {
  it('매개변수가 없으면 null', () => {
    expect(parseLabQuery('', KNOWN)).toBeNull();
    expect(parseLabQuery('?x=1', KNOWN)).toBeNull();
  });

  it('쉼표 목록은 그 id 만 켜고 모르는 id 는 버린다', () => {
    expect(parseLabQuery('?lab=glass,zzz', KNOWN)).toEqual({ glass: true });
    expect(parseLabQuery('?lab=%20globe%20,glass', KNOWN)).toEqual({ glass: true, globe: true });
  });

  it('all 은 전부 켜고 none 은 전부 끈다', () => {
    expect(parseLabQuery('?lab=all', KNOWN)).toEqual({ glass: true, globe: true });
    expect(parseLabQuery('?lab=none', KNOWN)).toEqual({ glass: false, globe: false });
  });
});

describe('Labs', () => {
  it('기본은 전부 꺼짐', () => {
    const { labs } = make();
    expect(labs.isOn('glass')).toBe(false);
    expect(labs.enabledIds()).toEqual([]);
  });

  it('set 은 저장하고 isOn 에 바로 반영된다', () => {
    const { labs, storage } = make();
    labs.set('glass', true);
    expect(labs.isOn('glass')).toBe(true);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: true });
  });

  it('저장값을 init 때 읽는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ globe: true }) });
    const { labs } = make({ storage });
    expect(labs.isOn('globe')).toBe(true);
    expect(labs.isOn('glass')).toBe(false);
  });

  it('모르는 id 는 저장돼 있어도 꺼짐이고 set 해도 저장되지 않는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ retired: true }) });
    const { labs } = make({ storage });
    expect(labs.isOn('retired')).toBe(false);
    labs.set('retired', true);
    expect(labs.isOn('retired')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ retired: true });
  });

  it('URL 덮어쓰기는 저장값보다 우선하고 저장값을 바꾸지 않는다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: JSON.stringify({ glass: true }) });
    const { labs } = make({ storage, search: '?lab=none' });
    expect(labs.isOn('glass')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: true });
  });

  it('패널에서 set 하면 그 id 의 덮어쓰기가 풀리고 저장된다', () => {
    const { labs, storage } = make({ search: '?lab=glass' });
    expect(labs.isOn('glass')).toBe(true);
    labs.set('glass', false);
    expect(labs.isOn('glass')).toBe(false);
    expect(JSON.parse(storage.dump()[LABS_STORAGE_KEY])).toEqual({ glass: false });
  });

  it('toggle 은 현재 값을 뒤집는다', () => {
    const { labs } = make();
    labs.toggle('glass');
    expect(labs.isOn('glass')).toBe(true);
    labs.toggle('glass');
    expect(labs.isOn('glass')).toBe(false);
  });

  it('enabledIds 는 레지스트리 순서를 따른다', () => {
    const { labs } = make();
    labs.set('globe', true);
    labs.set('glass', true);
    expect(labs.enabledIds()).toEqual(['glass', 'globe']);
  });

  it('shareUrl 은 켜진 id 로 ?lab= 을 붙이고, 없으면 기본 주소', () => {
    const { labs } = make();
    expect(labs.shareUrl()).toBe('https://e-gis.kr/');
    labs.set('glass', true);
    labs.set('globe', true);
    expect(labs.shareUrl()).toBe('https://e-gis.kr/?lab=glass,globe');
  });

  it('onChange 는 (id, on) 을 받고 해제할 수 있다', () => {
    const { labs } = make();
    const cb = vi.fn();
    const off = labs.onChange(cb);
    labs.set('glass', true);
    expect(cb).toHaveBeenCalledWith('glass', true);
    off();
    labs.set('glass', false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('저장소가 죽어 있어도 예외 없이 전부 꺼짐, set 도 예외 없음', () => {
    const { labs } = make({ storage: brokenStorage() });
    expect(labs.isOn('glass')).toBe(false);
    expect(() => labs.set('glass', true)).not.toThrow();
    expect(labs.isOn('glass')).toBe(true);   // 세션 안에서는 유지된다
  });

  it('저장값이 JSON 이 아니면 무시한다', () => {
    const storage = fakeStorage({ [LABS_STORAGE_KEY]: '{oops' });
    const { labs } = make({ storage });
    expect(labs.enabledIds()).toEqual([]);
  });
});
