// © 2026 김용현
/**
 * 단계구분도 설정의 저장 모양. 자동 저장(StateManager)·.egis(ProjectManager)·복제가
 * 같은 함수를 쓴다 — 갈라지면 한쪽에서만 fills 가 사라진다.
 * tool 참조는 절대 실리지 않는다(순환·직렬화 불가).
 */
import { describe, it, expect } from 'vitest';
import { serializeChoroplethConfig, cloneChoroplethConfig } from './choroplethConfigSerial.js';

const base = {
  attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'],
  title: '제목', unit: '명', format: 'comma', rounding: 0, controlsHidden: false,
  tool: { name: 'tool' }
};

describe('serializeChoroplethConfig', () => {
  it('null 은 null', () => {
    expect(serializeChoroplethConfig(null)).toBeNull();
  });

  it('tool 을 빼고 필드를 그대로 싣는다, fills 가 없으면 키도 없다', () => {
    const out = serializeChoroplethConfig(base);
    expect(out).toEqual({
      attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'],
      title: '제목', unit: '명', format: 'comma', rounding: 0, controlsHidden: false
    });
    expect('tool' in out).toBe(false);
    expect('fills' in out).toBe(false);
  });

  it('fills 가 있으면 복사해서 싣고, 전부 단색이면 싣지 않는다', () => {
    const fills = [{ kind: 'hatch', spacing: 8 }, { kind: 'solid' }];
    const out = serializeChoroplethConfig({ ...base, fills });
    expect(out.fills).toEqual(fills);
    expect(out.fills).not.toBe(fills);
    expect(out.fills[0]).not.toBe(fills[0]);
    expect('fills' in serializeChoroplethConfig({ ...base, fills: [{ kind: 'solid' }, null] })).toBe(false);
  });

  it('JSON 왕복 뒤에도 같다', () => {
    const out = serializeChoroplethConfig({ ...base, fills: [{ kind: 'dots', spacing: 6 }, { kind: 'solid' }] });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

describe('cloneChoroplethConfig', () => {
  it('얕은 복사 + fills 깊은 복사, tool 은 같은 참조', () => {
    const fills = [{ kind: 'hatch' }, { kind: 'solid' }];
    const src = { ...base, fills };
    const copy = cloneChoroplethConfig(src);
    expect(copy).not.toBe(src);
    expect(copy.tool).toBe(src.tool);
    expect(copy.fills).toEqual(fills);
    expect(copy.fills).not.toBe(fills);
    expect(copy.fills[0]).not.toBe(fills[0]);
    expect('fills' in cloneChoroplethConfig(base)).toBe(false);
  });
});
