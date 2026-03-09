import { describe, expect, it } from 'vitest'
import type { AdHocSlot, ProjectSlot } from './slot'
import {
  getSlotBaseName,
  getSlotName,
  getSlotPanelId,
  getSlotSessionId,
  getSlotWorkingDir,
  findActiveSlot,
  isPaneSlot,
  getPaneId,
  type PaneSlot,
} from './slot'

const makeProjectSlot = (overrides?: Partial<ProjectSlot>): ProjectSlot => ({
  type: 'project',
  projectId: 'proj-1',
  projectName: 'My Project',
  rootPath: '/home/user/project',
  activeMode: 'shell',
  activeSessionId: 'session-abc',
  sessionBadge: null,
  ...overrides,
})

const makeAdHocSlot = (overrides?: Partial<AdHocSlot>): AdHocSlot => ({
  type: 'adhoc',
  sessionId: 'adhoc-123',
  name: 'Ad Hoc Terminal',
  workingDir: '/tmp',
  ...overrides,
})

describe('getSlotSessionId', () => {
  it('returns activeSessionId for project slot', () => {
    const slot = makeProjectSlot({ activeSessionId: 'sess-42' })
    expect(getSlotSessionId(slot)).toBe('sess-42')
  })

  it('returns null when project slot has no active session', () => {
    const slot = makeProjectSlot({ activeSessionId: null })
    expect(getSlotSessionId(slot)).toBeNull()
  })

  it('returns sessionId for adhoc slot', () => {
    const slot = makeAdHocSlot({ sessionId: 'adhoc-99' })
    expect(getSlotSessionId(slot)).toBe('adhoc-99')
  })
})

describe('getSlotPanelId', () => {
  it('returns project-prefixed id for project slot', () => {
    const slot = makeProjectSlot({ projectId: 'p-1' })
    expect(getSlotPanelId(slot)).toBe('project-p-1')
  })

  it('returns adhoc-prefixed id for adhoc slot', () => {
    const slot = makeAdHocSlot({ sessionId: 's-2' })
    expect(getSlotPanelId(slot)).toBe('adhoc-s-2')
  })
})

describe('getSlotName', () => {
  it('returns project name when badge is null', () => {
    const slot = makeProjectSlot({ projectName: 'Foo', sessionBadge: null })
    expect(getSlotName(slot)).toBe('Foo')
  })

  it('returns project name when badge is 1', () => {
    const slot = makeProjectSlot({ projectName: 'Foo', sessionBadge: 1 })
    expect(getSlotName(slot)).toBe('Foo')
  })

  it('returns project name with badge when badge > 1', () => {
    const slot = makeProjectSlot({ projectName: 'Foo', sessionBadge: 3 })
    expect(getSlotName(slot)).toBe('Foo [3]')
  })

  it('returns name for adhoc slot', () => {
    const slot = makeAdHocSlot({ name: 'My Terminal' })
    expect(getSlotName(slot)).toBe('My Terminal')
  })
})

describe('getSlotBaseName', () => {
  it('returns project name without badge for project slot', () => {
    const slot = makeProjectSlot({ projectName: 'Bar', sessionBadge: 5 })
    expect(getSlotBaseName(slot)).toBe('Bar')
  })

  it('returns name for adhoc slot', () => {
    const slot = makeAdHocSlot({ name: 'Terminal X' })
    expect(getSlotBaseName(slot)).toBe('Terminal X')
  })
})

describe('getSlotWorkingDir', () => {
  it('returns rootPath for project slot', () => {
    const slot = makeProjectSlot({ rootPath: '/home/user/code' })
    expect(getSlotWorkingDir(slot)).toBe('/home/user/code')
  })

  it('returns null when project slot has no rootPath', () => {
    const slot = makeProjectSlot({ rootPath: null })
    expect(getSlotWorkingDir(slot)).toBeNull()
  })

  it('returns workingDir for adhoc slot', () => {
    const slot = makeAdHocSlot({ workingDir: '/var/log' })
    expect(getSlotWorkingDir(slot)).toBe('/var/log')
  })
})

describe('findActiveSlot', () => {
  const projectTerminals = [
    {
      projectId: 'proj-1',
      projectName: 'Project One',
      rootPath: '/home/user/p1',
      activeMode: 'shell' as const,
      activeSession: null,
      activeSessionId: 'session-1',
      sessionBadge: null,
      sessions: [
        {
          session: {
            id: 'session-1',
            name: 'Shell',
            user_id: null,
            project_id: 'proj-1',
            working_dir: '/home/user/p1',
            mode: 'shell' as const,
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            claude_state: 'not_started' as const,
          },
          badge: 1,
          mode: 'shell' as const,
        },
      ],
    },
  ]

  const adHocSessions = [
    {
      id: 'adhoc-1',
      name: 'Ad Hoc 1',
      working_dir: '/tmp',
      user_id: null,
      project_id: null,
      mode: 'shell' as const,
      display_order: 0,
      is_alive: true,
      created_at: null,
      last_accessed_at: null,
    },
  ]

  it('returns null when activeSessionId is null', () => {
    expect(findActiveSlot(null, projectTerminals, adHocSessions)).toBeNull()
  })

  it('returns project slot when session matches a project terminal', () => {
    const result = findActiveSlot('session-1', projectTerminals, adHocSessions)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('project')
    expect((result as ProjectSlot).projectId).toBe('proj-1')
    expect((result as ProjectSlot).activeSessionId).toBe('session-1')
  })

  it('returns adhoc slot when session matches an ad-hoc session', () => {
    const result = findActiveSlot('adhoc-1', projectTerminals, adHocSessions)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('adhoc')
    expect((result as AdHocSlot).sessionId).toBe('adhoc-1')
  })

  it('returns null when no session matches', () => {
    expect(findActiveSlot('nonexistent', projectTerminals, adHocSessions)).toBeNull()
  })
})

describe('isPaneSlot', () => {
  it('returns true for slot with paneId', () => {
    const paneSlot: PaneSlot = {
      ...makeProjectSlot(),
      paneId: 'pane-1',
    }
    expect(isPaneSlot(paneSlot)).toBe(true)
  })

  it('returns false for slot without paneId', () => {
    const slot = makeProjectSlot()
    expect(isPaneSlot(slot)).toBe(false)
  })
})

describe('getPaneId', () => {
  it('returns the pane ID from a PaneSlot', () => {
    const paneSlot: PaneSlot = {
      ...makeProjectSlot(),
      paneId: 'pane-42',
    }
    expect(getPaneId(paneSlot)).toBe('pane-42')
  })
})
