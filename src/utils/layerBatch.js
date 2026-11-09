// © 2026 김용현
/**
 * layerBatch - 「선택한 레이어 N개 모두」로 패널 작업을 레이어마다 차례로 실행한다.
 *
 * 하나가 실패해도 나머지는 계속하고, 끝나면 상태 표시줄에 「N개 레이어에 적용」을 띄운다.
 * 실패한 레이어는 마지막에 알림 창 하나로 모아 보여 준다(레이어마다 창을 띄우지 않는다).
 */

import { showAlert } from './dialogs.js';

/**
 * @param {string[]} layerIds
 * @param {(id: string) => any} fn 레이어 하나에 대한 작업. 던지면 실패로 센다.
 * @param {{getName?: (id: string) => string}} [options]
 * @returns {Promise<{done: Array<{id, name, result}>, failed: Array<{id, name, error}>}>}
 */
export async function runForEachLayer(layerIds, fn, { getName = (id) => id } = {}) {
  const done = [];
  const failed = [];
  for (const id of layerIds || []) {
    const name = getName(id) || id;
    try {
      const result = await fn(id);
      done.push({ id, name, result });
    } catch (error) {
      failed.push({ id, name, error: (error && error.message) || String(error) });
    }
  }
  return { done, failed };
}

/** 실패 목록 알림 글. 실패가 없으면 '' */
export function batchFailureMessage(result, label) {
  if (!result || !result.failed || result.failed.length === 0) return '';
  const lines = result.failed.map(f => `${f.name}: ${f.error}`);
  return `${label}에 실패한 레이어 ${result.failed.length}개\n\n${lines.join('\n')}`;
}

/** 상태 표시줄에 3초 동안 글을 띄운다 (main.js 의 showStatusMessage 와 같은 동작) */
export function showStatus(message) {
  const el = typeof document !== 'undefined' ? document.getElementById('status-message') : null;
  if (!el) return false;
  el.textContent = message;
  setTimeout(() => { if (el.textContent === message) el.textContent = '준비'; }, 3000);
  return true;
}

/**
 * 결과 알리기: 성공 수는 상태 표시줄로, 실패는 알림 창 하나로.
 * 상태 표시줄이 없거나 하나도 성공하지 못했으면 알림 창에 함께 적는다.
 */
export async function reportBatch(result, label) {
  const okCount = result.done.length;
  const summary = `${okCount}개 레이어에 적용`;
  const shown = okCount > 0 && showStatus(summary);
  const failText = batchFailureMessage(result, label);
  if (failText) {
    await showAlert((okCount > 0 ? summary + '\n\n' : '') + failText);
  } else if (!shown) {
    await showAlert(summary);
  }
}
