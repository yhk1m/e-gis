// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createCloudSync } from './CloudSync.js';
import { createStoryDoc, setCloudSync } from './StoryDoc.js';

/** 가짜 supabase 클라이언트 — from() 체인의 말단들이 {data,error}로 resolve. */
function makeFakeClient() {
  const calls = { upsert: null, select: null, order: null, eq: null };
  const client = {
    calls,
    result: { data: [], error: null },
    from: vi.fn((table) => {
      calls.table = table;
      const chain = {
        upsert: vi.fn((payload, opts) => {
          calls.upsert = { payload, opts };
          return Promise.resolve(client.result);
        }),
        select: vi.fn((cols) => {
          calls.select = cols;
          return chain;
        }),
        order: vi.fn((col, opts) => {
          calls.order = { col, opts };
          return Promise.resolve(client.result);
        }),
        eq: vi.fn((col, val) => {
          calls.eq = { col, val };
          return chain;
        }),
        single: vi.fn(() => Promise.resolve(client.result)),
      };
      return chain;
    }),
  };
  return client;
}

const USER = { id: 'u1', email: 'a@b.c' };

function make(client, user = USER) {
  return createCloudSync({ client, getUser: () => user });
}

describe('createCloudSync', () => {
  it('미로그인 시 upsert/list/download 모두 throw', async () => {
    const cs = make(makeFakeClient(), null);
    const doc = createStoryDoc('t');
    await expect(cs.upsert(doc)).rejects.toThrow('로그인이 필요합니다.');
    await expect(cs.list()).rejects.toThrow('로그인이 필요합니다.');
    await expect(cs.download('x')).rejects.toThrow('로그인이 필요합니다.');
  });

  it('upsert: e-gistory 테이블에 user_id/title/doc/updated_at + onConflict', async () => {
    const client = makeFakeClient();
    const cs = make(client);
    const doc = createStoryDoc('부산 이야기');
    setCloudSync(doc, true);
    await cs.upsert(doc);
    expect(client.from).toHaveBeenCalledWith('e-gistory');
    const { payload, opts } = client.calls.upsert;
    expect(payload.user_id).toBe('u1');
    expect(payload.title).toBe('부산 이야기');
    expect(payload.doc.meta.cloudSync).toBe(true); // 직렬화 왕복 후에도 객체(jsonb용)
    expect(typeof payload.updated_at).toBe('string');
    expect(opts).toEqual({ onConflict: 'user_id,title' });
  });

  it('upsert: {error} 응답 → 한국어 메시지 throw', async () => {
    const client = makeFakeClient();
    client.result = { data: null, error: new TypeError('fetch failed') };
    const cs = make(client);
    await expect(cs.upsert(createStoryDoc('t'))).rejects.toThrow('네트워크에 연결할 수 없습니다');
  });

  it('list: 최신순 정렬 인자 + data 반환(null이면 빈 배열)', async () => {
    const client = makeFakeClient();
    client.result = { data: null, error: null };
    const cs = make(client);
    expect(await cs.list()).toEqual([]);
    expect(client.calls.select).toBe('id,title,updated_at');
    expect(client.calls.order).toEqual({ col: 'updated_at', opts: { ascending: false } });
  });

  it('download: doc을 .esm 구조검증 거쳐 반환, 손상 문서는 throw', async () => {
    const client = makeFakeClient();
    const good = JSON.parse(JSON.stringify(createStoryDoc('클라우드 문서')));
    client.result = { data: { doc: good }, error: null };
    const cs = make(client);
    const doc = await cs.download('id1');
    expect(doc.meta.title).toBe('클라우드 문서');
    expect(client.calls.eq).toEqual({ col: 'id', val: 'id1' });

    client.result = { data: { doc: { meta: {} } }, error: null }; // pages/sources 누락
    await expect(cs.download('id2')).rejects.toThrow('유효하지 않은 .esm');
  });

  it('체인 reject(오프라인) → 한국어 메시지 throw', async () => {
    const client = makeFakeClient();
    client.from = vi.fn(() => ({
      upsert: vi.fn(() => Promise.reject(new TypeError('fetch failed'))),
    }));
    const cs = make(client);
    await expect(cs.upsert(createStoryDoc('t'))).rejects.toThrow('네트워크에 연결할 수 없습니다');
  });
});
