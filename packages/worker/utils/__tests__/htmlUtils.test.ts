import { describe, it, expect } from 'vitest'
import { validateHTMLContent, findContentContainer } from '../htmlUtils'
import * as cheerio from 'cheerio'

describe('htmlUtils', () => {
  describe('validateHTMLContent', () => {
    it('should return valid for proper SCP HTML', () => {
      const html = '<html><body><div id="page-content">SCP-173 is a sculpture with enough content to pass validation threshold.</div></body></html>'
      const result = validateHTMLContent(html)
      expect(result.valid).toBe(true)
    })

    it('should return invalid for empty HTML', () => {
      const result = validateHTMLContent('')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('HTML content too short')
    })

    it('should return invalid for too short HTML', () => {
      const result = validateHTMLContent('SCP-')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('HTML content too short')
    })

    it('should return invalid for HTML without SCP content', () => {
      const html = '<html><body><div id="page-content">This is a very long piece of text that does not contain any SCP reference at all, just regular content about something else entirely.</div></body></html>'
      const result = validateHTMLContent(html)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('HTML does not contain SCP content')
    })
  })

  describe('findContentContainer', () => {
    it('should find #page-content element', () => {
      const $ = cheerio.load('<html><body><div id="page-content">Content</div></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toBe('Content')
    })

    it('should find #main-content element', () => {
      const $ = cheerio.load('<html><body><div id="main-content">Content</div></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toBe('Content')
    })

    it('should find .page-content element', () => {
      const $ = cheerio.load('<html><body><div class="page-content">Content</div></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toBe('Content')
    })

    it('should find main element', () => {
      const $ = cheerio.load('<html><body><main>Content</main></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toBe('Content')
    })

    it('should fall back to body when no content container found', () => {
      const $ = cheerio.load('<html><body><div class="other">Content</div></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toContain('Content')
    })

    it('should prioritize #page-content over other selectors', () => {
      const $ = cheerio.load('<html><body><main>Main</main><div id="page-content">Page Content</div></body></html>')
      const $content = findContentContainer($)
      expect($content.text()).toBe('Page Content')
    })
  })
})
