// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { authErrorMessage } from './AuthManager.js';

describe('authErrorMessage', () => {
  it('잘못된 자격증명 → 한국어 안내', () => {
    expect(authErrorMessage(new Error('Invalid login credentials')))
      .toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  });

  it('네트워크 실패(fetch) → 오프라인 안내', () => {
    expect(authErrorMessage(new TypeError('fetch failed')))
      .toContain('네트워크에 연결할 수 없습니다');
  });

  it('이메일 미인증 → 한국어 안내', () => {
    expect(authErrorMessage(new Error('Email not confirmed')))
      .toBe('이메일 인증이 완료되지 않은 계정입니다.');
  });

  it('알 수 없는 에러 → 원문 유지, 메시지 없으면 기본 문구', () => {
    expect(authErrorMessage(new Error('teapot'))).toBe('teapot');
    expect(authErrorMessage(null)).toBe('로그인에 실패했습니다.');
  });
});
