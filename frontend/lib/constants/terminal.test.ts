import { describe, expect, it } from 'vitest'
import {
  getAvailableLayoutModes,
  getDefaultLayoutMode,
  getPaneCapacityForViewport,
} from './terminal'

describe('getPaneCapacityForViewport', () => {
  it('caps standard desktop widths at four panes', () => {
    expect(getPaneCapacityForViewport(1600)).toBe(4)
  })

  it('allows six panes on ultrawide widths', () => {
    expect(getPaneCapacityForViewport(1920)).toBe(6)
    expect(getPaneCapacityForViewport(2560)).toBe(6)
  })
})

describe('getAvailableLayoutModes', () => {
  it('offers both split orientations for two panes', () => {
    expect(getAvailableLayoutModes(2, 1440)).toEqual([
      'split-horizontal',
      'split-vertical',
    ])
  })

  it('offers both split orientations for three panes', () => {
    expect(getAvailableLayoutModes(3, 1440)).toEqual([
      'split-horizontal',
      'split-vertical',
    ])
  })

  it('adds a four-column option on wide desktops', () => {
    expect(getAvailableLayoutModes(4, 1440)).toEqual(['grid-2x2'])
    expect(getAvailableLayoutModes(4, 1600)).toEqual([
      'grid-2x2',
      'grid-4x1',
    ])
  })

  it('offers both wide and tall grids for five and six panes', () => {
    expect(getAvailableLayoutModes(5, 1920)).toEqual(['grid-3x2', 'grid-2x3'])
    expect(getAvailableLayoutModes(6, 2560)).toEqual(['grid-3x2', 'grid-2x3'])
  })

  it('returns only a horizontal split for a single pane', () => {
    expect(getAvailableLayoutModes(1, 1440)).toEqual(['split-horizontal'])
  })
})

describe('getDefaultLayoutMode', () => {
  it('defaults two panes to a side-by-side split', () => {
    expect(getDefaultLayoutMode(2, 1440)).toBe('split-horizontal')
  })

  it('defaults larger desktop layouts to the grid that fits them', () => {
    expect(getDefaultLayoutMode(3, 1440)).toBe('split-horizontal')
    expect(getDefaultLayoutMode(4, 1440)).toBe('grid-2x2')
    expect(getDefaultLayoutMode(6, 2560)).toBe('grid-3x2')
  })
})
