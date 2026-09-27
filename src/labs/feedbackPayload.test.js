// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildFeedbackPayload, fitSize, LIMITS } from './feedbackPayload.js';

const item = (experiment, message, image) => ({ experiment, message, image: image || null });
const base = { items: [item('글래스 UI', '글자가 잘 보여요')], role: 'teacher', email: '', website: '' };

describe('buildFeedbackPayload', () => {
  it('정상 입력이면 항목별 꾸러미를 만든다', () => {
    const r = buildFeedbackPayload(base, { page: 'https://www.e-gis.kr/?lab=glass', ua: 'UA', labsOn: ['glass'] });
    expect(r.ok).toBe(true);
    expect(r.payload).toMatchObject({
      items: [{ experiment: '글래스 UI', message: '글자가 잘 보여요' }],
      role: '교사', email: '', page: 'https://www.e-gis.kr/?lab=glass', ua: 'UA', labsOn: ['glass'],
    });
    expect(r.payload.items[0].image).toBeUndefined();
  });

  it('항목을 하나도 고르지 않으면 오류', () => {
    const r = buildFeedbackPayload({ ...base, items: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.items).toBeTruthy();
  });

  it('고른 항목마다 의견이 필요하다 — 빈 항목의 번호를 알려 준다', () => {
    const r = buildFeedbackPayload({ ...base, items: [item('글래스 UI', '좋아요'), item('스와이프 비교', '  ')] });
    expect(r.ok).toBe(false);
    expect(r.errors.item).toEqual({ 1: '의견을 적어 주세요.' });
  });

  it('의견이 너무 길면 그 항목에 오류', () => {
    const r = buildFeedbackPayload({ ...base, items: [item('글래스 UI', 'a'.repeat(LIMITS.message + 1))] });
    expect(r.ok).toBe(false);
    expect(r.errors.item[0]).toBeTruthy();
  });

  it('이메일은 비워도 되지만, 적으면 형식을 본다', () => {
    expect(buildFeedbackPayload({ ...base, email: 'a@b.kr' }).ok).toBe(true);
    const bad = buildFeedbackPayload({ ...base, email: 'abc' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.email).toBeTruthy();
  });

  it('역할은 정해진 값만 한글로 바꾸고, 모르는 값은 비운다', () => {
    expect(buildFeedbackPayload({ ...base, role: 'student' }).payload.role).toBe('학생');
    expect(buildFeedbackPayload({ ...base, role: 'hacker' }).payload.role).toBe('');
  });

  it('항목 수와 항목 이름 길이를 자른다', () => {
    const many = Array.from({ length: 30 }, (_, i) => item(`x${i}`.repeat(40), '의견'));
    const r = buildFeedbackPayload({ ...base, items: many });
    expect(r.payload.items.length).toBe(LIMITS.items);
    expect(r.payload.items[0].experiment.length).toBeLessThanOrEqual(LIMITS.experimentName);
  });

  it('항목 이미지는 data 가 있으면 싣고, 너무 크면 그 항목에 오류', () => {
    const img = { name: 'cap.jpg', type: 'image/jpeg', data: 'QUJD' };
    expect(buildFeedbackPayload({ ...base, items: [item('글래스 UI', '좋아요', img)] }).payload.items[0].image).toEqual(img);
    const big = { ...img, data: 'A'.repeat(LIMITS.imageBase64 + 1) };
    const r = buildFeedbackPayload({ ...base, items: [item('글래스 UI', '좋아요', big)] });
    expect(r.ok).toBe(false);
    expect(r.errors.image[0]).toBeTruthy();
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
