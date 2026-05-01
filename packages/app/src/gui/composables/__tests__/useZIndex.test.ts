import { describe, it, expect, beforeEach } from 'vitest'
import { useZIndex } from '../useZIndex'

describe('useZIndex', () => {
  let zIndexManager: ReturnType<typeof useZIndex>

  beforeEach(() => {
    zIndexManager = useZIndex()
    zIndexManager.reset()
  })

  describe('getNextZIndex', () => {
    it('should return incrementing z-index values', () => {
      const z1 = zIndexManager.getNextZIndex()
      const z2 = zIndexManager.getNextZIndex()
      const z3 = zIndexManager.getNextZIndex()

      expect(z2).toBeGreaterThan(z1)
      expect(z3).toBeGreaterThan(z2)
    })
  })

  describe('bringToFront', () => {
    it('should assign new z-index and set focused window', () => {
      const z = zIndexManager.bringToFront('window-1')

      expect(z).toBeGreaterThan(0)
      expect(zIndexManager.getFocusedWindowId()).toBe('window-1')
    })

    it('should update focused window on each call', () => {
      zIndexManager.bringToFront('window-1')
      zIndexManager.bringToFront('window-2')

      expect(zIndexManager.getFocusedWindowId()).toBe('window-2')
    })
  })

  describe('getFocusedWindowId', () => {
    it('should return null initially', () => {
      expect(zIndexManager.getFocusedWindowId()).toBeNull()
    })

    it('should return focused window id after bringToFront', () => {
      zIndexManager.bringToFront('my-window')
      expect(zIndexManager.getFocusedWindowId()).toBe('my-window')
    })
  })

  describe('setFocusedWindow', () => {
    it('should set focused window', () => {
      zIndexManager.setFocusedWindow('test-window')
      expect(zIndexManager.getFocusedWindowId()).toBe('test-window')
    })

    it('should clear focused window with null', () => {
      zIndexManager.setFocusedWindow('test-window')
      zIndexManager.setFocusedWindow(null)
      expect(zIndexManager.getFocusedWindowId()).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset z-index counter and focused window', () => {
      zIndexManager.bringToFront('window-1')
      zIndexManager.bringToFront('window-2')

      zIndexManager.reset()

      expect(zIndexManager.getFocusedWindowId()).toBeNull()
    })
  })
})
