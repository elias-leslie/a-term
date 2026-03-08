import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApiUrl, getApiBaseUrl, getWsUrl } from './api-config'

const originalLocation = window.location

function setLocation(url: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(url),
  })
}

describe('api-config', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('uses backend localhost websocket on desktop localhost development', () => {
    setLocation('http://localhost:3002/')

    expect(getWsUrl('/ws/terminal/session-1')).toBe(
      'ws://localhost:8002/ws/terminal/session-1',
    )
  })

  it('uses same-origin websocket routing for emulator hosts', () => {
    setLocation('http://10.0.2.2:3002/')

    expect(getWsUrl('/ws/terminal/session-1')).toBe(
      'ws://10.0.2.2:3002/ws/terminal/session-1',
    )
  })

  it('uses same-origin secure websocket routing in production', () => {
    setLocation('https://terminal.summitflow.dev/')

    expect(getWsUrl('/ws/terminal/session-1')).toBe(
      'wss://terminal.summitflow.dev/ws/terminal/session-1',
    )
  })

  it('getApiBaseUrl returns empty string on client-side for same-origin routing', () => {
    setLocation('http://localhost:3002/')

    expect(getApiBaseUrl()).toBe('')
  })

  it('buildApiUrl concatenates base URL with path on client-side', () => {
    setLocation('http://localhost:3002/')

    expect(buildApiUrl('/api/terminal/sessions')).toBe(
      '/api/terminal/sessions',
    )
  })

  it('uses backend localhost websocket for 127.0.0.1 development', () => {
    setLocation('http://127.0.0.1:3002/')

    expect(getWsUrl('/ws/terminal/session-1')).toBe(
      'ws://localhost:8002/ws/terminal/session-1',
    )
  })

  describe('server-side (no window)', () => {
    const originalWindow = globalThis.window

    beforeEach(() => {
      // Simulate server-side by removing window
      // @ts-expect-error -- deliberately removing window for SSR simulation
      delete globalThis.window
    })

    afterEach(() => {
      globalThis.window = originalWindow
    })

    it('getApiBaseUrl returns localhost backend URL on server-side', () => {
      expect(getApiBaseUrl()).toBe('http://localhost:8002')
    })

    it('buildApiUrl returns full localhost URL on server-side', () => {
      expect(buildApiUrl('/api/terminal/sessions')).toBe(
        'http://localhost:8002/api/terminal/sessions',
      )
    })

    it('getWsUrl returns localhost websocket URL on server-side', () => {
      expect(getWsUrl('/ws/terminal/session-1')).toBe(
        'ws://localhost:8002/ws/terminal/session-1',
      )
    })
  })
})
