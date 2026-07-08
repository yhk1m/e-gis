// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { createPublisher, deriveHandle, publicUrl } from './Publisher.js';
import { createStoryDoc } from './StoryDoc.js';

describe('deriveHandle', () => {
  it('앞부분+도메인 첫 단어, 소문자, 영숫자만', () => {
    expect(deriveHandle('fkv777@gmail.com')).toBe('fkv777gmail');
    expect(deriveHandle('John.Doe+tag@Naver.com')).toBe('johndoetagnaver');
  });
  it('영숫자가 없으면 u+user_id 앞 8자', () => {
    expect(deriveHandle('한글만@한글.kr', 'abcd1234-xxxx')).toBe('uabcd1234');
  });
});

describe('publicUrl', () => {
  it('e-gis.kr 주소를 만든다', () => {
    expect(publicUrl({ handle: 'fkv777gmail', seq: 3 })).toBe('https://e-gis.kr/fkv777gmail/3');
  });
});

// ---- 가짜 supabase 클라이언트: 호출 로그를 남기고 시나리오(script)별 응답을 순서대로 돌려준다 ----
function fakeClient(script) {
  const calls = [];
  function chain(table) {
    const call = { table, filters: {} };
    calls.push(call);
    const c = {
      insert(v) { call.insert = v; return c; },
      update(v) { call.update = v; return c; },
      delete() { call.deleted = true; return c; },
      select(cols) { call.select = cols; return c; },
      eq(k, v) { call.filters[k] = v; return c; },
      order() { return c; },
      limit() { return c; },
      single() { return Promise.resolve(script.shift()); },
      maybeSingle() { return Promise.resolve(script.shift()); },
      then(res, rej) { return Promise.resolve(script.shift()).then(res, rej); },
    };
    return c;
  }
  return { client: { from: (t) => chain(t) }, calls };
}

const user = { id: 'uid-1', email: 'fkv777@gmail.com' };

describe('publish', () => {
  it('미로그인이면 throw', async () => {
    const { client } = fakeClient([]);
    const p = createPublisher({ client, getUser: () => null });
    await expect(p.publish(createStoryDoc('t'))).rejects.toThrow('로그인');
  });

  it('첫 게시: max+1 seq로 insert하고 meta.publish를 기록한다', async () => {
    const { client, calls } = fakeClient([
      { data: [{ seq: 4 }], error: null },                                  // nextSeq 조회
      { data: { id: 'row9', handle: 'fkv777gmail', seq: 5 }, error: null }, // insert().single()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('제주');
    const res = await p.publish(doc);
    expect(doc.meta.publish).toEqual({ id: 'row9', handle: 'fkv777gmail', seq: 5 });
    expect(res.url).toBe('https://e-gis.kr/fkv777gmail/5');
    expect(calls[1].insert.seq).toBe(5);
    expect(calls[1].insert.handle).toBe('fkv777gmail');
  });

  it('첫 게시 seq 경합(23505)이면 번호를 다시 받아 1회 재시도', async () => {
    const { client } = fakeClient([
      { data: [], error: null },                                            // nextSeq → 1
      { data: null, error: { code: '23505', message: 'duplicate key' } },   // insert 충돌
      { data: [{ seq: 1 }], error: null },                                  // nextSeq → 2
      { data: { id: 'row2', handle: 'fkv777gmail', seq: 2 }, error: null }, // insert 성공
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    await p.publish(doc);
    expect(doc.meta.publish.seq).toBe(2);
  });

  it('재게시: meta.publish.id 행을 update한다', async () => {
    const { client, calls } = fakeClient([
      { data: [{ id: 'row9' }], error: null }, // update().eq().select()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('제주');
    doc.meta.publish = { id: 'row9', handle: 'fkv777gmail', seq: 5 };
    const res = await p.publish(doc);
    expect(calls[0].update.title).toBe('제주');
    expect(calls[0].filters.id).toBe('row9');
    expect(res.url).toBe('https://e-gis.kr/fkv777gmail/5');
  });

  it('재게시인데 행이 사라졌으면 저장된 seq로 다시 insert(링크 유지)', async () => {
    const { client, calls } = fakeClient([
      { data: [], error: null },                                            // update → 0행
      { data: { id: 'rowN', handle: 'fkv777gmail', seq: 5 }, error: null }, // insert().single()
    ]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    doc.meta.publish = { id: 'gone', handle: 'fkv777gmail', seq: 5 };
    await p.publish(doc);
    expect(calls[1].insert.seq).toBe(5);
    expect(doc.meta.publish.id).toBe('rowN');
  });
});

describe('unpublish', () => {
  it('행을 지우고 meta.publish를 제거한다', async () => {
    const { client, calls } = fakeClient([{ data: null, error: null }]);
    const p = createPublisher({ client, getUser: () => user });
    const doc = createStoryDoc('t');
    doc.meta.publish = { id: 'row9', handle: 'h', seq: 5 };
    await p.unpublish(doc);
    expect(calls[0].deleted).toBe(true);
    expect(calls[0].filters.id).toBe('row9');
    expect(doc.meta.publish).toBeUndefined();
  });

  it('미게시 문서는 no-op(호출 없음)', async () => {
    const { client, calls } = fakeClient([]);
    const p = createPublisher({ client, getUser: () => user });
    await p.unpublish(createStoryDoc('t'));
    expect(calls.length).toBe(0);
  });
});
