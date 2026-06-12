// © 2026 김용현
/**
 * GoogleSheetLoader - 공개 구글 스프레드시트를 CSV로 가져와 파싱
 *
 * 지원 링크 형식:
 *  - https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing (#gid=... 포함 가능)
 *  - https://docs.google.com/spreadsheets/d/e/{2PACX-...}/pubhtml (웹에 게시)
 *
 * 시트가 "링크가 있는 모든 사용자에게 공개" 또는 "웹에 게시" 상태여야 합니다.
 */

import Papa from 'papaparse';

class GoogleSheetLoader {
  /**
   * 구글 시트 URL 파싱 → { kind, id, gid }
   * kind: 'doc' (일반 공유 링크) | 'pub' (웹에 게시 링크)
   */
  parseUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) throw new Error('스프레드시트 링크를 입력하세요.');

    // gid 추출 (해시 또는 쿼리)
    let gid = null;
    const gidMatch = trimmed.match(/[#?&]gid=(\d+)/);
    if (gidMatch) gid = gidMatch[1];

    // 웹에 게시 링크: /spreadsheets/d/e/{2PACX-...}/
    const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (pubMatch) {
      return { kind: 'pub', id: pubMatch[1], gid };
    }

    // 일반 공유 링크: /spreadsheets/d/{ID}/
    const docMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      return { kind: 'doc', id: docMatch[1], gid };
    }

    throw new Error('구글 스프레드시트 링크 형식이 아닙니다.');
  }

  /**
   * CSV 내보내기 후보 URL 목록 생성
   */
  buildCsvUrls({ kind, id, gid }) {
    const gidParam = gid !== null ? `&gid=${gid}` : '';
    if (kind === 'pub') {
      return [`https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv${gidParam}`];
    }
    return [
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gidParam}`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`
    ];
  }

  /**
   * 공개 시트를 CSV로 가져와 파싱
   * @returns {Promise<{ headers: string[], data: Object[] }>}
   */
  async load(url) {
    const parsed = this.parseUrl(url);
    const candidates = this.buildCsvUrls(parsed);

    let lastError = null;
    for (const csvUrl of candidates) {
      try {
        const resp = await fetch(csvUrl);
        if (!resp.ok) {
          lastError = new Error(`응답 오류 (HTTP ${resp.status})`);
          continue;
        }
        const text = await resp.text();
        // 비공개 시트는 HTML 로그인 페이지가 반환됨
        if (text.trimStart().startsWith('<')) {
          lastError = new Error('시트에 접근할 수 없습니다.');
          continue;
        }
        return this.parseCsv(text);
      } catch (e) {
        lastError = e;
      }
    }

    throw new Error(
      '스프레드시트를 불러오지 못했습니다. 시트가 공개 상태인지 확인하세요.\n' +
      '(공유 → "링크가 있는 모든 사용자" 보기 권한)' +
      (lastError ? `\n상세: ${lastError.message}` : '')
    );
  }

  /**
   * CSV 텍스트 파싱 → { headers, data }
   * 숫자로 보이는 값은 숫자로 변환 (기존 TableJoinTool/TableLoader와 동일한 사용 형태)
   */
  parseCsv(text) {
    const result = Papa.parse(text.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: 'greedy'
    });

    if (!result.data || result.data.length === 0) {
      throw new Error('시트에 데이터가 없습니다. 첫 행은 머리글이어야 합니다.');
    }

    const headers = (result.meta.fields || []).map(h => String(h).trim()).filter(h => h);
    if (headers.length === 0) {
      throw new Error('머리글(첫 행)을 찾을 수 없습니다.');
    }

    const data = result.data.map(rawRow => {
      const row = {};
      headers.forEach(h => {
        const value = rawRow[h];
        if (value === undefined || value === null || value === '') {
          row[h] = '';
          return;
        }
        const str = String(value).trim();
        // 천 단위 콤마 제거 후 숫자 변환 시도
        const numStr = str.replace(/,/g, '');
        const num = Number(numStr);
        row[h] = (numStr !== '' && !isNaN(num)) ? num : str;
      });
      return row;
    });

    return { headers, data };
  }
}

export const googleSheetLoader = new GoogleSheetLoader();
