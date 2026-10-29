import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach } from 'vitest'

// jsdom lacks these browser APIs; animations are skipped so tests stay fast and deterministic.
MotionGlobalConfig.skipAnimations = true

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
Element.prototype.scrollIntoView = () => {}

export function stubMatchMedia(prefersDark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark') ? prefersDark : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  stubMatchMedia(false)
  localStorage.clear()
  document.documentElement.className = ''
})

afterEach(cleanup)
