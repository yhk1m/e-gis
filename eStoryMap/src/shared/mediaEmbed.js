// © 2026 김용현
// eStoryMap/src/shared/mediaEmbed.js
// 본문 마크다운의 미디어 링크를 임베드로 변환하는 순수 로직(DOM/네트워크 의존 없음, 테스트 대상).
// - YouTube 링크(단독 줄) → 반응형 iframe(youtube-nocookie + sandbox)
// - Google Drive 링크(단독 줄 또는 ![](...)) → 직접 이미지 표시 URL로 정규화
// - 일반 이미지 URL(단독 줄, 확장자 기반) → 이미지 태그(임의 웹 이미지 지원)
// 실제 살균은 markdown.js의 DOMPurify(iframe은 YouTube만 화이트리스트).

/** YouTube URL → 11자 videoId(없으면 null). watch/youtu.be/embed/shorts + 뒤 파라미터 허용. */
export function youtubeId(url) {
  if (typeof url !== 'string') return null;
  const patterns = [
    /youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** YouTube URL → 반응형 비디오 iframe HTML(없으면 null). */
export function youtubeEmbedHtml(url) {
  const id = youtubeId(url);
  if (!id) return null;
  const src = `https://www.youtube-nocookie.com/embed/${id}`;
  return (
    '<div class="embed-video">' +
    `<iframe src="${src}" title="YouTube" loading="lazy" ` +
    'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" ' +
    'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
    '</div>'
  );
}

/** YouTube URL → 정적 썸네일+링크 HTML(보고서/PDF용, iframe이 안 찍히므로. 없으면 null). */
export function youtubeThumbHtml(url) {
  const id = youtubeId(url);
  if (!id) return null;
  const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  return (
    `<a class="embed-video-static" href="${watch}" title="YouTube에서 열기">` +
    `<img src="${thumb}" alt="YouTube 영상" loading="lazy">` +
    '<span class="embed-play">▶</span>' +
    '</a>'
  );
}

/** Google Drive 파일 링크 → fileId(없으면 null). file/d/ID · open?id=ID · uc?id=ID · lh3/d/ID. */
export function gdriveFileId(url) {
  if (typeof url !== 'string') return null;
  const patterns = [
    /drive\.google\.com\/file\/d\/([\w-]+)/,
    /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/,
    /lh3\.googleusercontent\.com\/d\/([\w-]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Google Drive 링크 → 직접 이미지 표시 URL(없으면 null). 공개("링크 있는 모든 사용자") 파일 필요. */
export function gdriveImageUrl(url) {
  const id = gdriveFileId(url);
  return id ? `https://lh3.googleusercontent.com/d/${id}` : null;
}

/**
 * 이미지 파일처럼 보이는 http(s) URL이면 그대로, 아니면 null.
 * 확장자 기반 판별(쿼리스트링·프래그먼트 허용) — 임의 링크가 깨진 이미지로 바뀌는 것을 막는다.
 * (확장자가 없는 이미지는 마크다운 이미지 문법 ![](url)로 넣으면 그대로 렌더된다.)
 */
export function imageUrl(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  return /^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|svg|bmp|avif|apng)(?:[?#]\S*)?$/i.test(u) ? u : null;
}

/**
 * 본문 마크다운에서 미디어 링크를 임베드로 변환.
 * ① ![alt](gdrive-url) 안의 URL → 직접 이미지 URL로 정규화(마크다운 이미지 유지)
 * ② 한 줄이 통째로 YouTube URL → 비디오 iframe 블록
 * ③ 한 줄이 통째로 Google Drive URL → 이미지 태그
 * ④ 한 줄이 통째로 이미지 URL(확장자 기반) → 이미지 태그
 * @param {string} markdown
 * @param {{staticMedia?:boolean}} [opts] - staticMedia=true면 YouTube를 재생 iframe 대신
 *   썸네일+링크로(보고서/PDF용).
 * @returns {string}
 */
export function embedMediaLinks(markdown, { staticMedia = false } = {}) {
  if (typeof markdown !== 'string' || !markdown) return markdown || '';

  // ① 인라인 ![alt](url) 의 Google Drive URL 정규화
  let text = markdown.replace(/(!\[[^\]]*\]\()\s*(\S+?)\s*(\))/g, (whole, pre, url, post) => {
    const direct = gdriveImageUrl(url);
    return direct ? pre + direct + post : whole;
  });

  // ②③ URL만 있는 단독 줄 → 임베드
  return text
    .split('\n')
    .map((line) => {
      const url = line.trim();
      if (!/^https?:\/\/\S+$/.test(url)) return line; // URL 단독 줄만 대상
      const yt = staticMedia ? youtubeThumbHtml(url) : youtubeEmbedHtml(url);
      if (yt) return yt;
      const img = gdriveImageUrl(url);
      if (img) return `<img class="embed-image" src="${img}" alt="" loading="lazy">`;
      const direct = imageUrl(url);
      if (direct) return `<img class="embed-image" src="${direct}" alt="" loading="lazy">`;
      return line;
    })
    .join('\n');
}
