// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { parseStoryPath } from './parseStoryPath.js';

describe('parseStoryPath', () => {
  it('/{handle}/{seq} 경로를 파싱한다', () => {
    expect(parseStoryPath('/fkv777gmail/3')).toEqual({ handle: 'fkv777gmail', seq: 3 });
    expect(parseStoryPath('/abc1/12/')).toEqual({ handle: 'abc1', seq: 12 }); // 끝 슬래시 허용
  });
  it('?s= 폴백을 지원한다(로컬 미리보기용)', () => {
    expect(parseStoryPath('/viewer.html', '?s=fkv777gmail/3')).toEqual({ handle: 'fkv777gmail', seq: 3 });
    expect(parseStoryPath('/story/', '?s=abc1/7')).toEqual({ handle: 'abc1', seq: 7 });
  });
  it('비정상 경로는 null', () => {
    expect(parseStoryPath('/')).toBeNull();
    expect(parseStoryPath('/onlyhandle')).toBeNull();
    expect(parseStoryPath('/handle/abc')).toBeNull();
    expect(parseStoryPath('/UPPER/1')).toBeNull(); // handle은 소문자 영숫자만
    expect(parseStoryPath('/a/1/extra')).toBeNull();
    expect(parseStoryPath('')).toBeNull();
  });
});
