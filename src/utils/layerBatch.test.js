// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { runForEachLayer, batchFailureMessage } from './layerBatch.js';

const names = { a: '학교', b: '병원', c: '공원' };
const getName = (id) => names[id];

describe('runForEachLayer', () => {
  it('하나가 실패해도 나머지를 계속 실행한다', async () => {
    const ran = [];
    const result = await runForEachLayer(['a', 'b', 'c'], (id) => {
      ran.push(id);
      if (id === 'b') throw new Error('피처 없음');
      return id + '-done';
    }, { getName });

    expect(ran).toEqual(['a', 'b', 'c']);
    expect(result.done.map(d => d.id)).toEqual(['a', 'c']);
    expect(result.done[0].result).toBe('a-done');
    expect(result.failed).toEqual([{ id: 'b', name: '병원', error: '피처 없음' }]);
  });

  it('비동기 작업도 순서대로 기다린다', async () => {
    const order = [];
    await runForEachLayer(['a', 'b'], async (id) => {
      await new Promise(r => setTimeout(r, id === 'a' ? 10 : 0));
      order.push(id);
    }, { getName });
    expect(order).toEqual(['a', 'b']);
  });
});

describe('batchFailureMessage', () => {
  it('실패가 없으면 빈 문자열', () => {
    expect(batchFailureMessage({ done: [{}], failed: [] }, '버퍼')).toBe('');
  });

  it('실패한 레이어 이름과 까닭을 한 번에 모은다', () => {
    const msg = batchFailureMessage({
      done: [{ id: 'a' }],
      failed: [{ id: 'b', name: '병원', error: '피처 없음' }, { id: 'c', name: '공원', error: 'x' }]
    }, '버퍼');
    expect(msg).toContain('버퍼');
    expect(msg).toContain('레이어 2개');
    expect(msg).toContain('병원: 피처 없음');
    expect(msg).toContain('공원: x');
    expect(msg).not.toMatch(/[·—]/);
  });
});
