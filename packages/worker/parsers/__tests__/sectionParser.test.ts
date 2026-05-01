import { describe, it, expect, beforeEach } from 'vitest'
import { SectionParser } from '../sectionParser'

describe('SectionParser', () => {
  let parser: SectionParser

  beforeEach(() => {
    parser = new SectionParser()
  })

  describe('parseSections', () => {
    it('should parse complete Chinese SCP text', () => {
      const text = `
项目编号：SCP-173
项目等级：Euclid
**特殊收容措施：**SCP-173 应随时被关在牢房里。
**描述：**SCP-173 是一个雕塑。
**附录：**测试记录显示 SCP-173 不会移动。
**作者：**Moto42
`
      const result = parser.parseSections(text)
      expect(result.title).toBe('SCP-173')
      expect(result.objectClass).toBe('EUCLID')
      expect(result.containment.length).toBeGreaterThan(0)
      expect(result.description.length).toBeGreaterThan(0)
    })

    it('should parse complete English SCP text', () => {
      const text = `
Item #: SCP-173
Object Class: Euclid
**Special Containment Procedures:** SCP-173 is to be kept in a locked room.
**Description:** SCP-173 is a sculpture.
**Appendix:** Test logs show SCP-173 does not move.
**Author:** Moto42
`
      const result = parser.parseSections(text)
      expect(result.title).toBe('SCP-173')
      expect(result.objectClass).toBe('EUCLID')
      expect(result.containment.length).toBeGreaterThan(0)
      expect(result.description.length).toBeGreaterThan(0)
    })
  })

  describe('extractTitle', () => {
    it('should extract Chinese title', () => {
      const text = '项目编号：SCP-173 详细描述'
      const result = parser.parseSections(text)
      expect(result.title).toBe('SCP-173')
    })

    it('should extract English title', () => {
      const text = 'Item #: SCP-682'
      const result = parser.parseSections(text)
      expect(result.title).toBe('SCP-682')
    })

    it('should extract SCP number from text', () => {
      const text = 'Some text about SCP-999 here'
      const result = parser.parseSections(text)
      expect(result.title).toBe('SCP-999')
    })

    it('should return UNKNOWN for no SCP number', () => {
      const text = 'Some random text without any SCP reference'
      const result = parser.parseSections(text)
      expect(result.title).toBe('UNKNOWN')
    })
  })

  describe('extractObjectClass', () => {
    it('should extract Chinese object class', () => {
      const text = '项目等级：Keter'
      const result = parser.parseSections(text)
      expect(result.objectClass).toBe('KETER')
    })

    it('should extract English object class', () => {
      const text = 'Object Class: Safe'
      const result = parser.parseSections(text)
      expect(result.objectClass).toBe('SAFE')
    })

    it('should return UNKNOWN for no object class', () => {
      const text = 'Some text without object class'
      const result = parser.parseSections(text)
      expect(result.objectClass).toBe('UNKNOWN')
    })
  })

  describe('parseContainment', () => {
    it('should parse Chinese containment procedures', () => {
      const text = '**特殊收容措施：**SCP-173应被关在牢房里。至少需要三名人员进入。**描述：**SCP-173是一个雕塑。'
      const result = parser.parseSections(text)
      expect(result.containment.length).toBeGreaterThan(0)
    })

    it('should parse English containment procedures', () => {
      const text = '**Special Containment Procedures:** SCP-173 must be kept in a locked room. Three personnel must enter. **Description:** SCP-173 is a sculpture.'
      const result = parser.parseSections(text)
      expect(result.containment.length).toBeGreaterThan(0)
    })

    it('should return empty array when no containment found', () => {
      const text = 'Some random text without containment procedures'
      const result = parser.parseSections(text)
      expect(result.containment).toEqual([])
    })
  })

  describe('parseDescription', () => {
    it('should parse Chinese description', () => {
      const text = '**描述：**SCP-173是一个由混凝土构成的雕塑。它具有敌意。**附录：**测试记录。'
      const result = parser.parseSections(text)
      expect(result.description.length).toBeGreaterThan(0)
    })

    it('should parse English description', () => {
      const text = '**Description:** SCP-173 is a sculpture made of concrete. It is hostile. **Appendix:** Test records.'
      const result = parser.parseSections(text)
      expect(result.description.length).toBeGreaterThan(0)
    })
  })

  describe('parseAppendix', () => {
    it('should parse Chinese appendix', () => {
      const text = '**附录A：**测试记录显示SCP-173不会移动。多次实验证实了这一点。'
      const result = parser.parseSections(text)
      expect(result.appendix.length).toBeGreaterThan(0)
    })

    it('should parse English appendix', () => {
      const text = '**Appendix A:** Test logs show SCP-173 does not move when observed. Multiple experiments confirmed this.'
      const result = parser.parseSections(text)
      expect(result.appendix.length).toBeGreaterThan(0)
    })
  })

  describe('extractAuthor', () => {
    it('should extract Chinese author', () => {
      const text = '**作者：**Moto42'
      const result = parser.parseSections(text)
      expect(result.author).toBe('Moto42')
    })

    it('should extract English author', () => {
      const text = '**Author:** Dr. Clef'
      const result = parser.parseSections(text)
      expect(result.author).toBe('Dr. Clef')
    })

    it('should return undefined when no author found', () => {
      const text = 'Some text without author info'
      const result = parser.parseSections(text)
      expect(result.author).toBeUndefined()
    })
  })
})
