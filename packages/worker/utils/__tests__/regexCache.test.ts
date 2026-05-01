import { describe, it, expect, beforeEach } from 'vitest'
import { RegexCache } from '../regexCache'

describe('RegexCache', () => {
  beforeEach(() => {
    RegexCache.clear()
  })

  describe('get', () => {
    it('should create and cache regex', () => {
      const regex = RegexCache.get('\\d+')
      expect(regex).toBeInstanceOf(RegExp)
      expect(regex.test('123')).toBe(true)
    })

    it('should return cached instance on second call', () => {
      const regex1 = RegexCache.get('\\d+')
      const regex2 = RegexCache.get('\\d+')
      expect(regex1).toBe(regex2)
    })

    it('should handle different flags', () => {
      const regex1 = RegexCache.get('test', 'i')
      const regex2 = RegexCache.get('test', 'g')
      expect(regex1).not.toBe(regex2)
      expect(regex1.flags).toBe('i')
      expect(regex2.flags).toBe('g')
    })
  })

  describe('fromRegex', () => {
    it('should cache from RegExp object', () => {
      const original = /hello/gi
      const cached = RegexCache.fromRegex(original)
      expect(cached.source).toBe('hello')
      expect(cached.flags).toBe('gi')
    })

    it('should return same cached instance', () => {
      RegexCache.fromRegex(/world/g)
      const cached1 = RegexCache.fromRegex(/world/g)
      const cached2 = RegexCache.fromRegex(/world/g)
      expect(cached1).toBe(cached2)
    })
  })

  describe('precompile', () => {
    it('should precompile multiple patterns', () => {
      RegexCache.precompile([
        { pattern: '\\d+' },
        { pattern: '[a-z]+', flags: 'i' },
      ])
      expect(RegexCache.size()).toBe(2)
    })
  })

  describe('clear', () => {
    it('should clear all cached patterns', () => {
      RegexCache.get('\\d+')
      RegexCache.get('[a-z]+')
      expect(RegexCache.size()).toBe(2)
      RegexCache.clear()
      expect(RegexCache.size()).toBe(0)
    })
  })

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(RegexCache.size()).toBe(0)
      RegexCache.get('test1')
      expect(RegexCache.size()).toBe(1)
      RegexCache.get('test2')
      expect(RegexCache.size()).toBe(2)
    })
  })

  describe('getMany', () => {
    it('should return array of regexes', () => {
      const regexes = RegexCache.getMany([
        { pattern: '\\d+' },
        { pattern: '[a-z]+' },
      ])
      expect(regexes).toHaveLength(2)
      expect(regexes[0]).toBeInstanceOf(RegExp)
      expect(regexes[1]).toBeInstanceOf(RegExp)
    })
  })
})
