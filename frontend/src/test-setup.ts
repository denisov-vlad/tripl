import '@testing-library/jest-dom'

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
}
