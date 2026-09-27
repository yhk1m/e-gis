// © 2026 김용현
/**
 * 실험실 의견 — 입력을 검사해 Apps Script(scripts/labs-feedback.gs)로 보낼 꾸러미를 만든다.
 * 고른 기능(항목)마다 의견 글과 이미지가 따로 있다 → 시트에는 항목마다 한 줄.
 * 서버도 같은 한도로 다시 자르고 검사한다(여기는 사용자에게 바로 알려 주려는 1차 검사).
 */

export const LIMITS = {
  message: 3000,
  email: 200,
  items: 10,
  experimentName: 60,
  imageBase64: 4 * 1024 * 1024, // 항목 하나의 이미지, base64 글자 수 — 원본 약 3MB
};

const ROLES = { teacher: '교사', student: '학생', other: '기타' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{items?: {experiment: string, message: string, image?: {name: string, type: string, data: string}|null}[],
 *          role?: string, email?: string, website?: string}} input
 * @param {{page?: string, ua?: string, labsOn?: string[]}} context
 * @returns {{ok: boolean, errors: {items?: string, item?: object, image?: object, email?: string},
 *            payload?: object, spam?: boolean}}
 *          errors.item·errors.image 는 항목 번호(0부터) → 문장
 */
export function buildFeedbackPayload(input, context = {}) {
  if (input.website) return { ok: false, spam: true, errors: { form: '보낼 수 없습니다' } };
  const errors = {};

  const raw = (input.items || []).slice(0, LIMITS.items);
  if (!raw.length) errors.items = '의견을 남길 기능을 하나 이상 골라 주세요.';

  const items = raw.map((it, i) => {
    const message = String(it.message || '').trim();
    if (!message) (errors.item ??= {})[i] = '의견을 적어 주세요.';
    else if (message.length > LIMITS.message) (errors.item ??= {})[i] = `의견은 ${LIMITS.message.toLocaleString()}자까지 적을 수 있습니다.`;

    const out = { experiment: String(it.experiment || '').slice(0, LIMITS.experimentName), message };
    const image = it.image && it.image.data ? it.image : null;
    if (image) {
      if (image.data.length > LIMITS.imageBase64) (errors.image ??= {})[i] = '이미지가 너무 큽니다.';
      out.image = { name: String(image.name || 'image.jpg').slice(0, 100), type: image.type, data: image.data };
    }
    return out;
  });

  const email = String(input.email || '').trim();
  if (email && (email.length > LIMITS.email || !EMAIL_RE.test(email))) errors.email = '이메일 형식을 확인해 주세요.';

  const payload = {
    items,
    role: ROLES[input.role] || '',
    email,
    page: String(context.page || '').slice(0, 300),
    ua: String(context.ua || '').slice(0, 300),
    labsOn: (context.labsOn || []).slice(0, 20),
  };
  return { ok: Object.keys(errors).length === 0, errors, payload };
}

/** 긴 변이 max 를 넘지 않게 비율을 지켜 줄인 [w, h] */
export function fitSize(w, h, max) {
  const long = Math.max(w, h);
  if (long <= max) return [w, h];
  const k = max / long;
  return [Math.round(w * k), Math.round(h * k)];
}
