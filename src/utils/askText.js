// © 2026 김용현
/**
 * askText - 텍스트 입력 대화상자 (Promise<string|null>)
 *
 * 예전엔 브라우저에서 window.prompt 를 썼지만, 기본 대화상자는 전체화면을 풀고
 * Electron(데스크톱 앱)에선 아예 예외를 던진다. 이제 어디서나 e-GIS 안의 입력 창을 쓴다.
 */
import { showPrompt } from './dialogs.js';

export function askText(message, defaultValue = '') {
  return showPrompt(message, defaultValue);
}
