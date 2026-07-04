// © 2026 김용현
// eStoryMap/src/core/CloudSync.js
// e-gistory 테이블(Supabase) 저장/불러오기 — 주입식(테스트는 가짜 클라이언트).
// 충돌 정책 last-write-wins(상위 스펙 §8b). RLS가 본인 행만 허용(1차 방어는 미로그인 가드).
// ⚠️ client는 AuthManager와 같은 인스턴스여야 세션(JWT)이 공유된다.

import { authErrorMessage } from './AuthManager.js';
import { serializeStoryDoc, deserializeStoryDoc } from './LocalStore.js';

const TABLE = 'e-gistory'; // 2026-07-04 사용자 지시로 storymaps에서 개명

export function createCloudSync({ client, getUser }) {
  function requireUser() {
    const user = getUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    return user;
  }

  /** supabase 응답의 두 실패 경로({error} resolve · reject)를 모두 한국어화. */
  async function run(query) {
    let res;
    try {
      res = await query;
    } catch (e) {
      throw new Error(authErrorMessage(e));
    }
    if (res && res.error) throw new Error(authErrorMessage(res.error));
    return res ? res.data : null;
  }

  return {
    /** 문서를 업로드(제목 기준 upsert). 래스터 base64 인코딩은 serializeStoryDoc 재사용
     *  — 문자열→객체 재파싱은 jsonb 컬럼용(단순성 우선, 승인된 트레이드오프). */
    async upsert(doc) {
      const user = requireUser();
      return run(client.from(TABLE).upsert({
        user_id: user.id,
        title: doc.meta.title,
        doc: JSON.parse(serializeStoryDoc(doc)),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,title' }));
    },

    /** 내 클라우드 문서 목록(최신순). RLS가 본인 것만 반환. */
    async list() {
      requireUser();
      const data = await run(
        client.from(TABLE).select('id,title,updated_at').order('updated_at', { ascending: false }),
      );
      return data || [];
    },

    /** id로 문서 다운로드. .esm과 같은 구조검증(deserializeStoryDoc)을 거친다. */
    async download(id) {
      requireUser();
      const data = await run(client.from(TABLE).select('doc').eq('id', id).single());
      return deserializeStoryDoc(JSON.stringify(data.doc));
    },
  };
}
