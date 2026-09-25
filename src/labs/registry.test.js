// © 2026 김용현
/**
 * 실험 목록 형식. 목록은 "구현된 실험"만 가진다 — 사용자가 켰는데 아무 일도
 * 안 일어나는 카드가 있으면 안 된다. id 는 URL(?lab=a,b)과 저장 키에 쓰이므로
 * 쉼표·공백 없는 소문자 kebab-case 여야 한다.
 */
import { describe, it, expect } from 'vitest';
import { EXPERIMENTS, EXPERIMENT_IDS, FEEDBACK_URL } from './registry.js';

describe('EXPERIMENTS', () => {
  it('항목마다 id·name·summary·since 가 있다', () => {
    expect(EXPERIMENTS.length).toBeGreaterThan(0);
    for (const e of EXPERIMENTS) {
      expect(e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.summary).toBe('string');
      expect(e.summary.length).toBeGreaterThan(0);
      expect(e.since).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('id 는 겹치지 않고 EXPERIMENT_IDS 와 순서가 같다', () => {
    const ids = EXPERIMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXPERIMENT_IDS).toEqual(ids);
  });

  it('0단계에는 glass 가 들어 있다', () => {
    expect(EXPERIMENT_IDS).toContain('glass');
  });

  it('FEEDBACK_URL 은 비어 있거나 https 주소다', () => {
    expect(FEEDBACK_URL === '' || /^https:\/\//.test(FEEDBACK_URL)).toBe(true);
  });
});
