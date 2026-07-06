// © 2026 김용현
// eStoryMap/src/shared/mediaEmbed.test.js
import { describe, it, expect } from 'vitest';
import {
  youtubeId, youtubeEmbedHtml, youtubeThumbHtml, gdriveFileId, gdriveImageUrl, embedMediaLinks,
} from './mediaEmbed.js';

describe('youtubeId', () => {
  it('watch·youtu.be·embed·shorts 형식에서 11자 id를 뽑는다', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('뒤에 파라미터가 붙어도 id만 뽑는다', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ');
  });
  it('유튜브가 아니면 null', () => {
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe('youtubeEmbedHtml', () => {
  it('youtube-nocookie iframe + sandbox 를 만든다', () => {
    const html = youtubeEmbedHtml('https://youtu.be/dQw4w9WgXcQ');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('sandbox=');
    expect(html).toContain('class="embed-video"');
  });
  it('유튜브 아니면 null', () => {
    expect(youtubeEmbedHtml('https://vimeo.com/123')).toBeNull();
  });
});

describe('youtubeThumbHtml (보고서/정적용)', () => {
  it('썸네일 이미지 + watch 링크를 만든다(iframe 아님)', () => {
    const html = youtubeThumbHtml('https://youtu.be/dQw4w9WgXcQ');
    expect(html).toContain('img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    expect(html).not.toContain('<iframe');
  });
  it('유튜브 아니면 null', () => {
    expect(youtubeThumbHtml('https://example.com/x')).toBeNull();
  });
});

describe('gdriveFileId / gdriveImageUrl', () => {
  it('여러 공유 링크 형식에서 fileId를 뽑는다', () => {
    expect(gdriveFileId('https://drive.google.com/file/d/1AbC_dEfG/view?usp=sharing')).toBe('1AbC_dEfG');
    expect(gdriveFileId('https://drive.google.com/open?id=1AbC_dEfG')).toBe('1AbC_dEfG');
    expect(gdriveFileId('https://drive.google.com/uc?export=view&id=1AbC_dEfG')).toBe('1AbC_dEfG');
  });
  it('직접 이미지 URL(lh3)로 정규화한다', () => {
    expect(gdriveImageUrl('https://drive.google.com/file/d/1AbC_dEfG/view')).toBe(
      'https://lh3.googleusercontent.com/d/1AbC_dEfG',
    );
    expect(gdriveImageUrl('https://example.com/x.png')).toBeNull();
  });
});

describe('embedMediaLinks', () => {
  it('단독 줄 YouTube URL → 비디오 iframe', () => {
    const out = embedMediaLinks('앞\n\nhttps://youtu.be/dQw4w9WgXcQ\n\n뒤');
    expect(out).toContain('embed-video');
    expect(out).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(out).toContain('앞');
    expect(out).toContain('뒤');
  });
  it('단독 줄 Google Drive URL → 이미지', () => {
    const out = embedMediaLinks('https://drive.google.com/file/d/ABC123/view');
    expect(out).toContain('<img class="embed-image"');
    expect(out).toContain('lh3.googleusercontent.com/d/ABC123');
  });
  it('![](gdrive) 인라인 이미지의 URL을 정규화한다', () => {
    const out = embedMediaLinks('![지도](https://drive.google.com/file/d/ABC123/view)');
    expect(out).toContain('![지도](https://lh3.googleusercontent.com/d/ABC123)');
  });
  it('일반 텍스트·일반 이미지는 그대로 둔다', () => {
    expect(embedMediaLinks('그냥 텍스트')).toBe('그냥 텍스트');
    expect(embedMediaLinks('![x](https://example.com/a.png)')).toBe('![x](https://example.com/a.png)');
  });
  it('문장 안에 섞인 URL은 임베드하지 않는다(단독 줄만)', () => {
    const out = embedMediaLinks('여기 보세요 https://youtu.be/dQw4w9WgXcQ 어때요');
    expect(out).not.toContain('embed-video');
  });
  it('staticMedia=true면 YouTube를 썸네일+링크로(iframe 아님)', () => {
    const out = embedMediaLinks('https://youtu.be/dQw4w9WgXcQ', { staticMedia: true });
    expect(out).toContain('embed-video-static');
    expect(out).toContain('img.youtube.com/vi/dQw4w9WgXcQ');
    expect(out).not.toContain('<iframe');
  });
});
