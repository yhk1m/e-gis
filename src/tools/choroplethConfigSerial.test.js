// © 2026 김용현
/**
 * 단계구분도 설정의 저장 모양. 자동 저장(StateManager)·.egis(ProjectManager)·복제가
 * 같은 함수를 쓴다 — 갈라지면 한쪽에서만 fills 가 사라진다.
 * tool 참조는 절대 실리지 않는다(순환·직렬화 불가).
 */
import { describe, it, expect } from 'vitest';
import { serializeChoroplethConfig, cloneChoroplethConfig, restoreChoroplethConfig } from './choroplethConfigSerial.js';

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

describe('timeSeries (실험실 4단계)', () => {
  const ts = { fields: ['2015', '2020'], index: 1 };

  it('시계열이 아니면 키가 없다 — 옛 저장본과 바이트 단위로 같다', () => {
    expect('timeSeries' in serializeChoroplethConfig(base)).toBe(false);
    expect(JSON.stringify(serializeChoroplethConfig(base))).toBe(JSON.stringify({
      attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'],
      title: '제목', unit: '명', format: 'comma', rounding: 0, controlsHidden: false
    }));
    expect('timeSeries' in serializeChoroplethConfig({ ...base, timeSeries: { fields: ['2015'] } })).toBe(false);
  });

  it('시계열이면 깊은 복사로 싣는다, JSON 왕복 뒤에도 같다', () => {
    const out = serializeChoroplethConfig({ ...base, timeSeries: ts });
    expect(out.timeSeries).toEqual(ts);
    expect(out.timeSeries).not.toBe(ts);
    expect(out.timeSeries.fields).not.toBe(ts.fields);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it('복제는 timeSeries 를 깊게 — 복제본의 연도를 넘겨도 원본은 그대로', () => {
    const src = { ...base, timeSeries: { fields: ['2015', '2020'], index: 0 } };
    const copy = cloneChoroplethConfig(src);
    expect(copy.timeSeries).toEqual(src.timeSeries);
    copy.timeSeries.index = 1;
    copy.timeSeries.fields.push('2025');
    expect(src.timeSeries).toEqual({ fields: ['2015', '2020'], index: 0 });
    expect('timeSeries' in cloneChoroplethConfig(base)).toBe(false);
  });

  it('복원은 저장본을 펼치고 tool 을 달며 timeSeries 를 정돈한다', () => {
    const tool = { name: 'tool' };
    const saved = { attribute: '2020', breaks: [0, 1], colors: ['#fff'], timeSeries: { fields: ['2015', 7, '2020'], index: 5 } };
    const cfg = restoreChoroplethConfig(saved, tool);
    expect(cfg.tool).toBe(tool);
    expect(cfg.attribute).toBe('2020');
    expect(cfg.timeSeries).toEqual({ fields: ['2015', '2020'], index: 1 });
    expect(saved.timeSeries).toEqual({ fields: ['2015', 7, '2020'], index: 5 });
  });

  it('복원 — 망가진 timeSeries 는 떼고, 없으면 키도 없다', () => {
    const tool = {};
    expect('timeSeries' in restoreChoroplethConfig({ attribute: 'a', timeSeries: { fields: ['2015'] } }, tool)).toBe(false);
    expect('timeSeries' in restoreChoroplethConfig({ attribute: 'a' }, tool)).toBe(false);
  });
});
