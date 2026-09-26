// © 2026 김용현
/**
 * saveTextAs - 텍스트 파일 저장 (웹/데스크톱 공용)
 *
 * 데스크톱 앱의 e-GIS 탭(webview)에서는 blob 다운로드가 조용히 실패하므로,
 * 주입된 브릿지(window.egisDesktop.saveTextFile → 네이티브 저장 대화상자)를 우선 쓰고
 * 브라우저에서는 기존 blob 다운로드로 폴백한다.
 * @returns {Promise<boolean>} 저장했으면 true, 취소했으면 false
 */
export async function saveTextAs(filename, text, mime = 'application/json') {
  if (window.egisDesktop && typeof window.egisDesktop.saveTextFile === 'function') {
    try {
      const savedPath = await window.egisDesktop.saveTextFile(filename, text);
      return !!savedPath; // null = 사용자 취소
    } catch (e) {
      console.error('데스크톱 저장 실패, 브라우저 다운로드로 폴백:', e);
    }
  }

  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * saveBlobAs - 이진 파일 저장 (GIF·동영상)
 *
 * 데스크톱 브릿지는 텍스트만 받으므로(saveTextFile) 여기서는 브라우저 다운로드만 쓴다.
 * 데스크톱 앱의 e-GIS 탭에서는 blob 다운로드가 조용히 실패할 수 있다 — 시계열 저장은
 * 웹(브라우저)에서 하라고 설명서에 적는다.
 * @returns {Promise<boolean>} 항상 true (브라우저는 취소를 알려주지 않는다)
 */
export async function saveBlobAs(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 다운로드가 시작되기 전에 해제하면 일부 브라우저가 빈 파일을 만든다
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
