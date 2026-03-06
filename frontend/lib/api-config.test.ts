import { afterEach, describe, expect, it } from 'vitest'
import { getWsUrl } from './api-config'

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
})
