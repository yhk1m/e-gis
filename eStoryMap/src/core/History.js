// © 2026 김용현
// eStoryMap/src/core/History.js
// 되돌리기와 다시 하기. 문서가 바뀔 때마다 record()를 부르면, 바로 앞 상태를 쌓아 둔다.
// 잇달아 들어오는 변경(글자 입력, 끌기)은 groupMs 안이면 한 번의 되돌리기로 묶는다.
// snapshot()은 지금 상태의 사본을, restore(s)는 그 사본으로 문서를 되돌린다(사본은 고치지 않는다).

/**
 * @param {{snapshot:() => any, restore:(s:any) => void, limit?:number, groupMs?:number}} opts
 */
export function createHistory({ snapshot, restore, limit = 50, groupMs = 800 }) {
  let baseline = null; // 마지막으로 확정된 상태(다음 변경의 "바로 앞")
  let undoStack = [];
  let redoStack = [];
  let timer = null;

  function settle() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    baseline = snapshot();
  }

  return {
    /** 문서를 새로 열 때: 지금 상태를 기준으로 삼고 기록을 비운다. */
    reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      undoStack = [];
      redoStack = [];
      baseline = snapshot();
    },
    /** 문서를 바꾼 직후에 부른다. */
    record() {
      if (baseline === null) return;
      if (timer) {
        clearTimeout(timer);
      } else {
        undoStack.push(baseline);
        if (undoStack.length > limit) undoStack.shift();
      }
      redoStack = [];
      timer = setTimeout(settle, groupMs);
    },
    undo() {
      settle();
      if (!undoStack.length) return false;
      redoStack.push(baseline);
      const prev = undoStack.pop();
      restore(prev);
      baseline = snapshot();
      return true;
    },
    redo() {
      settle();
      if (!redoStack.length) return false;
      undoStack.push(baseline);
      const next = redoStack.pop();
      restore(next);
      baseline = snapshot();
      return true;
    },
    canUndo: () => undoStack.length > 0 || timer !== null,
    canRedo: () => redoStack.length > 0,
  };
}
