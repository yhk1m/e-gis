// © 2026 김용현
// jsdom에는 ResizeObserver가 없어 OL Map 생성이 불가 — 최소 스텁.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub;
