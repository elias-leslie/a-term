import { describe, expect, it } from 'vitest'
import { getLayoutRemountKey } from './TerminalLayoutRenderer'

describe('getLayoutRemountKey', () => {
  it('ignores native pane changes when external slots stay the same', () => {
    const withNativeAndExternal = getLayoutRemountKey('split-horizontal', [
      {
        type: 'adhoc',
        paneId: 'pane-1',
        sessionId: 'native-1',
        name: 'Ad-Hoc Terminal',
        workingDir: null,
      },
      {
        type: 'adhoc',
        sessionId: 'codex-agent-hub',
        name: 'codex-agent-hub',
        workingDir: '/workspace/agent-hub',
        isExternal: true,
      },
    ])
    const externalOnly = getLayoutRemountKey('split-horizontal', [
      {
        type: 'adhoc',
        sessionId: 'codex-agent-hub',
        name: 'codex-agent-hub',
        workingDir: '/workspace/agent-hub',
        isExternal: true,
      },
    ])

    expect(externalOnly).toBe(withNativeAndExternal)
  })

  it('changes when the external slot set changes', () => {
    const withExternal = getLayoutRemountKey('split-horizontal', [
      {
        type: 'adhoc',
        sessionId: 'codex-agent-hub',
        name: 'codex-agent-hub',
        workingDir: '/workspace/agent-hub',
        isExternal: true,
      },
    ])
    const withoutExternal = getLayoutRemountKey('split-horizontal', [
      {
        type: 'adhoc',
        paneId: 'pane-1',
        sessionId: 'native-1',
        name: 'Ad-Hoc Terminal',
        workingDir: null,
      },
    ])

    expect(withExternal).not.toBe(withoutExternal)
  })
})
