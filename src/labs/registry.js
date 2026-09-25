// © 2026 김용현
/**
 * 실험 목록 — 실험실 창에 보이는 카드.
 *
 * 구현된 실험만 적는다. 단계가 끝날 때 한 줄씩 늘고, 정식 승격 때 한 줄씩 준다.
 * id 는 URL(?lab=a,b)·저장 키·labs.isOn(id) 에 그대로 쓰인다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */

export const EXPERIMENTS = [
  {
    id: 'glass',
    name: '글래스 UI',
    summary: '패널·메뉴·범례를 반투명 유리로 보여줍니다.',
    since: '2026-09'
  }
];

export const EXPERIMENT_IDS = EXPERIMENTS.map((e) => e.id);

/** 의견 보내기(구글 폼) 주소. 비어 있으면 카드에 링크가 안 보인다. */
export const FEEDBACK_URL = '';
