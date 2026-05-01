import { describe, it, expect, beforeEach } from 'vitest'
import { ClassParser } from '../classParser'
import type { ObjectClass } from '../../shared/types'

describe('ClassParser', () => {
  let parser: ClassParser

  beforeEach(() => {
    parser = new ClassParser()
  })

  describe('parseClass', () => {
    it('should parse SAFE class', () => {
      expect(parser.parseClass('Object Class: Safe')).toBe('SAFE')
    })

    it('should parse EUCLID class', () => {
      expect(parser.parseClass('Object Class: Euclid')).toBe('EUCLID')
    })

    it('should parse KETER class', () => {
      expect(parser.parseClass('Object Class: Keter')).toBe('KETER')
    })

    it('should parse THAUMIEL class', () => {
      expect(parser.parseClass('Object Class: Thaumiel')).toBe('THAUMIEL')
    })

    it('should parse NEUTRALIZED class', () => {
      expect(parser.parseClass('Object Class: Neutralized')).toBe('NEUTRALIZED')
    })

    it('should parse PENDING class', () => {
      expect(parser.parseClass('Object Class: Pending')).toBe('PENDING')
    })

    it('should return UNKNOWN for unrecognized class', () => {
      expect(parser.parseClass('Object Class: Apollyon')).toBe('UNKNOWN')
    })

    it('should handle HTML entities in text', () => {
      expect(parser.parseClass('Object Class: <b>Keter</b>')).toBe('KETER')
    })

    it('should handle markdown bold in text', () => {
      expect(parser.parseClass('Object Class: **Euclid**')).toBe('EUCLID')
    })

    it('should handle &nbsp; entities', () => {
      expect(parser.parseClass('Object Class: Safe&nbsp;')).toBe('SAFE')
    })

    it('should be case insensitive', () => {
      expect(parser.parseClass('keter')).toBe('KETER')
      expect(parser.parseClass('EUCLID')).toBe('EUCLID')
    })
  })

  describe('isValidClass', () => {
    it('should validate known classes', () => {
      expect(parser.isValidClass('SAFE')).toBe(true)
      expect(parser.isValidClass('EUCLID')).toBe(true)
      expect(parser.isValidClass('KETER')).toBe(true)
      expect(parser.isValidClass('UNKNOWN')).toBe(true)
    })

    it('should reject invalid classes', () => {
      expect(parser.isValidClass('INVALID')).toBe(false)
      expect(parser.isValidClass('')).toBe(false)
    })
  })

  describe('getClassInfo', () => {
    it('should return info for known class', () => {
      const info = parser.getClassInfo('KETER')
      expect(info.class).toBe('KETER')
      expect(info.color).toBe('#ff0000')
      expect(info.displayName).toBeDefined()
      expect(info.description).toBeDefined()
    })

    it('should return UNKNOWN info for invalid class', () => {
      const info = parser.getClassInfo('INVALID' as ObjectClass)
      expect(info.class).toBe('UNKNOWN')
    })
  })

  describe('getAllClasses', () => {
    it('should return all class names', () => {
      const classes = parser.getAllClasses()
      expect(classes).toContain('SAFE')
      expect(classes).toContain('EUCLID')
      expect(classes).toContain('KETER')
      expect(classes).toContain('THAUMIEL')
      expect(classes).toContain('NEUTRALIZED')
      expect(classes).toContain('PENDING')
      expect(classes).toContain('UNKNOWN')
    })
  })

  describe('compareDanger', () => {
    it('should compare danger levels correctly', () => {
      expect(parser.compareDanger('KETER', 'SAFE')).toBe(1)
      expect(parser.compareDanger('SAFE', 'KETER')).toBe(-1)
      expect(parser.compareDanger('EUCLID', 'EUCLID')).toBe(0)
    })

    it('should rank classes correctly', () => {
      expect(parser.compareDanger('NEUTRALIZED', 'SAFE')).toBe(-1)
      expect(parser.compareDanger('SAFE', 'EUCLID')).toBe(-1)
      expect(parser.compareDanger('EUCLID', 'KETER')).toBe(-1)
      expect(parser.compareDanger('KETER', 'THAUMIEL')).toBe(-1)
    })

    it('should handle UNKNOWN and PENDING as lowest', () => {
      expect(parser.compareDanger('UNKNOWN', 'NEUTRALIZED')).toBe(-1)
      expect(parser.compareDanger('PENDING', 'NEUTRALIZED')).toBe(-1)
    })
  })
})
