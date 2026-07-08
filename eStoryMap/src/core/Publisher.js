// © 2026 김용현
// eStoryMap/src/core/Publisher.js
// 스토리맵 웹 게시(published_storymaps) — 주입식(CloudSync 패턴).
// 스냅샷 게시: 게시 시점 문서를 통째로 올리고, 재게시 전까지 불변. RLS: 읽기 공개·쓰기 본인.
// 뷰어 URL: https://e-gis.kr/{handle}/{seq} (Vercel rewrite → /story/index.html)
import { authErrorMessage } from './AuthManager.js';
import { serializeStoryDoc } from './LocalStore.js';
import { setPublishInfo } from './StoryDoc.js';

const TABLE = 'published_storymaps';
const BASE_URL = 'https://e-gis.kr';

/** 이메일 → 공개 아이디(순수). 앞부분+도메인 첫 단어, 소문자, 영숫자만.
 *  결과가 비면(전부 특수문자/한글 등) u+user_id 앞 8자로 대체. */
export function deriveHandle(email, userId = '') {
  const [local = '', domain = ''] = String(email || '').toLowerCase().split('@');
  const h = (local + domain.split('.')[0]).replace(/[^a-z0-9]/g, '');
  return h || 'u' + String(userId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

/** 게시 정보({handle, seq}) → 공개 URL(순수). */
export function publicUrl({ handle, seq }) {
  return `${BASE_URL}/${handle}/${seq}`;
}

export function createPublisher({ client, getUser }) {
  function requireUser() {
    const user = getUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    return user;
  }

  /** supabase 두 실패 경로({error} resolve · reject)를 한국어 Error로.
   *  경합 재시도 판단용으로 code(예: 23505 unique 위반)는 보존한다. */
  async function run(query) {
    let res;
    try { res = await query; } catch (e) { throw new Error(authErrorMessage(e)); }
    if (res && res.error) {
      const err = new Error(authErrorMessage(res.error));
      err.code = res.error.code;
      throw err;
    }
    return res ? res.data : null;
  }

  /** 내 다음 게시 번호. max+1 기준이라 취소된 번호(결번)는 자연히 재사용되지 않는다. */
  async function nextSeq(userId) {
    const rows = await run(
      client.from(TABLE).select('seq').eq('user_id', userId).order('seq', { ascending: false }).limit(1),
    );
    return rows && rows.length ? rows[0].seq + 1 : 1;
  }

  async function insertRow(user, handle, seq, doc, snapshot) {
    const data = await run(client.from(TABLE).insert({
      user_id: user.id, handle, seq, title: doc.meta.title, doc: snapshot,
    }).select('id,handle,seq').single());
    setPublishInfo(doc, data);
    return { url: publicUrl(data) };
  }

  return {
    /** 게시/재게시. 성공 시 doc.meta.publish 갱신 + {url} 반환. 저장은 호출부(scheduleSave) 몫. */
    async publish(doc) {
      const user = requireUser();
      const handle = deriveHandle(user.email, user.id);
      const snapshot = JSON.parse(serializeStoryDoc(doc)); // jsonb 컬럼용 재파싱(CloudSync와 동일 트레이드오프)
      const prev = doc.meta.publish;
      if (prev && prev.id) {
        const rows = await run(client.from(TABLE).update({
          title: doc.meta.title, doc: snapshot, updated_at: new Date().toISOString(),
        }).eq('id', prev.id).select('id'));
        if (rows && rows.length) return { url: publicUrl(prev) };
        return insertRow(user, handle, prev.seq, doc, snapshot); // 행 소실(타 기기에서 취소) → 같은 번호로 복원
      }
      for (let attempt = 0; ; attempt++) {
        const seq = await nextSeq(user.id);
        try {
          return await insertRow(user, handle, seq, doc, snapshot);
        } catch (e) {
          if (e.code !== '23505' || attempt >= 1) throw e; // 번호 경합만 1회 재시도
        }
      }
    },

    /** 게시 취소. 행 삭제 + meta.publish 제거. 미게시 문서는 no-op(멱등). */
    async unpublish(doc) {
      requireUser();
      const prev = doc.meta.publish;
      if (!prev || !prev.id) return;
      await run(client.from(TABLE).delete().eq('id', prev.id));
      setPublishInfo(doc, null);
    },
  };
}
