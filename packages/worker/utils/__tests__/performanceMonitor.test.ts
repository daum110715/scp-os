import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceMonitor } from '../performanceMonitor'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  describe('startTimer', () => {
    it('should record metric when timer is stopped', () => {
      const stop = monitor.startTimer('test-op')
      stop()
      const stats = monitor.getStats('test-op')
      expect(stats).not.toBeNull()
      expect(stats!.count).toBe(1)
    })

    it('should record multiple metrics', () => {
      const stop1 = monitor.startTimer('test-op')
      stop1()
      const stop2 = monitor.startTimer('test-op')
      stop2()

      const stats = monitor.getStats('test-op')
      expect(stats!.count).toBe(2)
    })
  })

  describe('recordMetric', () => {
    it('should limit to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('test-op', i)
      }
      const stats = monitor.getStats('test-op')
      expect(stats!.count).toBe(100)
    })
  })

  describe('getAverageTime', () => {
    it('should return null for unknown operation', () => {
      expect(monitor.getAverageTime('unknown')).toBeNull()
    })

    it('should calculate average correctly', () => {
      monitor.recordMetric('test-op', 100)
      monitor.recordMetric('test-op', 200)
      monitor.recordMetric('test-op', 300)
      expect(monitor.getAverageTime('test-op')).toBe(200)
    })
  })

  describe('getMinTime', () => {
    it('should return null for unknown operation', () => {
      expect(monitor.getMinTime('unknown')).toBeNull()
    })

    it('should find minimum correctly', () => {
      monitor.recordMetric('test-op', 300)
      monitor.recordMetric('test-op', 100)
      monitor.recordMetric('test-op', 200)
      expect(monitor.getMinTime('test-op')).toBe(100)
    })

    it('should handle large arrays without stack overflow', () => {
      const values = Array.from({ length: 100000 }, (_, i) => i + 1)
      values.forEach(v => monitor.recordMetric('large-op', v))
      expect(monitor.getMinTime('large-op')).toBe(99901)
      expect(monitor.getMaxTime('large-op')).toBe(100000)
    })
  })

  describe('getMaxTime', () => {
    it('should return null for unknown operation', () => {
      expect(monitor.getMaxTime('unknown')).toBeNull()
    })

    it('should find maximum correctly', () => {
      monitor.recordMetric('test-op', 100)
      monitor.recordMetric('test-op', 300)
      monitor.recordMetric('test-op', 200)
      expect(monitor.getMaxTime('test-op')).toBe(300)
    })

    it('should handle large arrays without stack overflow', () => {
      const values = Array.from({ length: 100000 }, (_, i) => i + 1)
      values.forEach(v => monitor.recordMetric('large-op', v))
      expect(monitor.getMinTime('large-op')).toBe(99901)
      expect(monitor.getMaxTime('large-op')).toBe(100000)
    })
  })

  describe('getP95Time', () => {
    it('should return null for unknown operation', () => {
      expect(monitor.getP95Time('unknown')).toBeNull()
    })

    it('should calculate p95 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        monitor.recordMetric('test-op', i)
      }
      const p95 = monitor.getP95Time('test-op')!
      expect(p95).toBeGreaterThanOrEqual(90)
      expect(p95).toBeLessThanOrEqual(100)
    })
  })

  describe('getStats', () => {
    it('should return null for unknown operation', () => {
      expect(monitor.getStats('unknown')).toBeNull()
    })

    it('should return complete stats', () => {
      monitor.recordMetric('test-op', 100)
      monitor.recordMetric('test-op', 200)
      monitor.recordMetric('test-op', 300)

      const stats = monitor.getStats('test-op')!
      expect(stats.count).toBe(3)
      expect(stats.average).toBe(200)
      expect(stats.min).toBe(100)
      expect(stats.max).toBe(300)
      expect(stats.p95).toBeDefined()
    })
  })

  describe('getAllStats', () => {
    it('should return stats for all operations', () => {
      monitor.recordMetric('op1', 100)
      monitor.recordMetric('op2', 200)
      const allStats = monitor.getAllStats()
      expect(Object.keys(allStats)).toHaveLength(2)
    })
  })

  describe('clear', () => {
    it('should clear all metrics', () => {
      monitor.recordMetric('test-op', 100)
      monitor.clear()
      expect(monitor.getStats('test-op')).toBeNull()
    })
  })

  describe('clearOperation', () => {
    it('should clear specific operation only', () => {
      monitor.recordMetric('op1', 100)
      monitor.recordMetric('op2', 200)
      monitor.clearOperation('op1')
      expect(monitor.getStats('op1')).toBeNull()
      expect(monitor.getStats('op2')).not.toBeNull()
    })
  })
})
