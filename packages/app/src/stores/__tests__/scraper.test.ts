import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useScraperStore } from '../scraper'
import type { SCPWikiData } from '../../types/scraper'

const mockSCPData: SCPWikiData = {
  id: 'SCP-173',
  name: 'The Sculpture',
  objectClass: 'EUCLID',
  containment: ['Keep in a locked room'],
  description: ['A concrete sculpture'],
  appendix: [],
  url: 'https://scp-wiki.wikidot.com/scp-173',
}

describe('ScraperStore', () => {
  let store: ReturnType<typeof useScraperStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useScraperStore()
    store.clearCache()
  })

  describe('cache operations', () => {
    it('should return null for non-existent cache key', () => {
      expect(store.getFromCache('non-existent')).toBeNull()
    })

    it('should save and retrieve from cache', () => {
      store.saveToCache('SCP-173', mockSCPData)
      expect(store.getFromCache('SCP-173')).toEqual(mockSCPData)
    })

    it('should clear all cache', () => {
      store.saveToCache('key1', { ...mockSCPData, id: '1' })
      store.saveToCache('key2', { ...mockSCPData, id: '2' })
      store.clearCache()
      expect(store.getFromCache('key1')).toBeNull()
      expect(store.getFromCache('key2')).toBeNull()
    })

    it('should expire old cache entries', () => {
      store.saveToCache('SCP-173', mockSCPData)

      const cached = store.cache.get('SCP-173')!
      cached.timestamp = Date.now() - 999999999

      expect(store.getFromCache('SCP-173')).toBeNull()
    })
  })

  describe('clearExpiredCache', () => {
    it('should remove only expired entries', () => {
      store.saveToCache('old', { ...mockSCPData, id: 'old' })
      store.saveToCache('new', { ...mockSCPData, id: 'new' })

      const oldEntry = store.cache.get('old')!
      oldEntry.timestamp = Date.now() - 999999999

      store.clearExpiredCache()

      expect(store.getFromCache('old')).toBeNull()
      expect(store.getFromCache('new')).not.toBeNull()
    })
  })

  describe('getCacheStats', () => {
    it('should return correct stats for empty cache', () => {
      const stats = store.getCacheStats()
      expect(stats.totalEntries).toBe(0)
      expect(stats.expiredEntries).toBe(0)
      expect(stats.totalSize).toBe(0)
    })

    it('should return correct stats for populated cache', () => {
      store.saveToCache('key1', { ...mockSCPData, id: '1', name: 'Test' })
      const stats = store.getCacheStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.totalSize).toBeGreaterThan(0)
    })
  })

  describe('loading state', () => {
    it('should set and get loading state', () => {
      expect(store.isLoading).toBe(false)
      store.setLoading(true)
      expect(store.isLoading).toBe(true)
    })
  })

  describe('error state', () => {
    it('should set and clear error', () => {
      expect(store.lastError).toBeNull()
      store.setError('Network error')
      expect(store.lastError).toBe('Network error')
      store.clearError()
      expect(store.lastError).toBeNull()
    })
  })
})
