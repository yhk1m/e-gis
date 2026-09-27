// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildFeedbackPayload, fitSize, LIMITS } from './feedbackPayload.js';

const base = { experiments: ['글래스 UI'], message: '글자가 잘 보여요', role: 'teacher', email: '', image: null, website: '' };

describe('buildFeedbackPayload', () => {
  it('정상 입력이면 보낼 꾸러미를 만든다', () => {
    const r = buildFeedbackPayload(base, { page: 'https://www.e-gis.kr/?lab=glass', ua: 'UA', labsOn: ['glass'] });
    expect(r.ok).toBe(true);
    expect(r.payload).toMatchObject({ experiments: ['글래스 UI'], message: '글자가 잘 보여요', role: '교사', email: '', page: 'https://www.e-gis.kr/?lab=glass', ua: 'UA', labsOn: ['glass'] });
    expect(r.payload.image).toBeUndefined();
  });

  it('의견 글은 필수 — 공백만 있으면 오류', () => {
    const r = buildFeedbackPayload({ ...base, message: '   ' });
    expect(r.ok).toBe(false);
    expect(r.errors.message).toBeTruthy();
  });

  it('의견 글이 너무 길면 오류', () => {
    const r = buildFeedbackPayload({ ...base, message: 'a'.repeat(LIMITS.message + 1) });
    expect(r.ok).toBe(false);
    expect(r.errors.message).toBeTruthy();
  });

  it('이메일은 비워도 되지만, 적으면 형식을 본다', () => {
    expect(buildFeedbackPayload({ ...base, email: '' }).ok).toBe(true);
    expect(buildFeedbackPayload({ ...base, email: 'a@b.kr' }).ok).toBe(true);
    const bad = buildFeedbackPayload({ ...base, email: 'abc' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.email).toBeTruthy();
  });

  it('역할은 정해진 값만 한글로 바꾸고, 모르는 값은 비운다', () => {
    expect(buildFeedbackPayload({ ...base, role: 'student' }).payload.role).toBe('학생');
    expect(buildFeedbackPayload({ ...base, role: 'hacker' }).payload.role).toBe('');
  });

  it('실험 선택은 비어도 되고, 개수·길이를 자른다', () => {
    expect(buildFeedbackPayload({ ...base, experiments: [] }).ok).toBe(true);
    const many = Array.from({ length: 30 }, (_, i) => `x${i}`.repeat(40));
    const r = buildFeedbackPayload({ ...base, experiments: many });
    expect(r.payload.experiments.length).toBe(LIMITS.experiments);
    expect(r.payload.experiments[0].length).toBeLessThanOrEqual(LIMITS.experimentName);
  });

  it('이미지는 data 가 있으면 싣고, 너무 크면 오류', () => {
    const img = { name: 'cap.jpg', type: 'image/jpeg', data: 'QUJD' };
    expect(buildFeedbackPayload({ ...base, image: img }).payload.image).toEqual(img);
    const big = { ...img, data: 'A'.repeat(LIMITS.imageBase64 + 1) };
    const r = buildFeedbackPayload({ ...base, image: big });
    expect(r.ok).toBe(false);
    expect(r.errors.image).toBeTruthy();
  });

  it('봇용 숨은 칸(website)이 채워지면 스팸으로 본다', () => {
    const r = buildFeedbackPayload({ ...base, website: 'http://spam' });
    expect(r.ok).toBe(false);
    expect(r.spam).toBe(true);
  });
});

describe('fitSize', () => {
  it('긴 변이 최대보다 크면 비율을 지켜 줄인다', () => {
    expect(fitSize(3200, 1600, 1600)).toEqual([1600, 800]);
    expect(fitSize(1000, 4000, 1600)).toEqual([400, 1600]);
  });
  it('작으면 그대로', () => {
    expect(fitSize(800, 600, 1600)).toEqual([800, 600]);
  });
});
