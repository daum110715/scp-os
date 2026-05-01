import { describe, it, expect, beforeEach } from 'vitest'
import { CORSManager } from '../cors'
import type { RequestContext } from '../../shared/types'

function mockContext(origin: string): RequestContext {
  return {
    ip: '127.0.0.1',
    origin,
    userAgent: 'test',
    timestamp: Date.now(),
  }
}

describe('CORSManager', () => {
  let corsManager: CORSManager

  beforeEach(() => {
    corsManager = new CORSManager()
  })

  describe('isOriginAllowed (via getHeaders)', () => {
    it('should allow exact origin match', () => {
      const headers = corsManager.getHeaders(mockContext('https://scpos.site'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://scpos.site')
    })

    it('should allow wildcard origin match', () => {
      const headers = corsManager.getHeaders(mockContext('https://my-app.scpos.pages.dev'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://my-app.scpos.pages.dev')
    })

    it('should allow localhost with any port', () => {
      const headers = corsManager.getHeaders(mockContext('http://localhost:5173'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    })

    it('should allow 127.0.0.1 with any port', () => {
      const headers = corsManager.getHeaders(mockContext('http://127.0.0.1:8787'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8787')
    })

    it('should reject unknown origin', () => {
      const headers = corsManager.getHeaders(mockContext('https://evil.com'))
      expect(headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.com')
    })

    it('should reject empty origin', () => {
      const headers = corsManager.getHeaders(mockContext(''))
      expect(headers.get('Access-Control-Allow-Origin')).toBeDefined()
    })

    it('should escape regex special characters in wildcard patterns', () => {
      const headers = corsManager.getHeaders(mockContext('https://my-app.scpos.pages.dev'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://my-app.scpos.pages.dev')
    })

    it('should not match partial domain with dot injection', () => {
      const headers = corsManager.getHeaders(mockContext('https://xscpos.pages.dev'))
      expect(headers.get('Access-Control-Allow-Origin')).not.toBe('https://xscpos.pages.dev')
    })

    it('should allow github.io wildcard subdomain', () => {
      const headers = corsManager.getHeaders(mockContext('https://lemonstudio.github.io'))
      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://lemonstudio.github.io')
    })
  })

  describe('handlePreflight', () => {
    it('should return 204 response with CORS headers', () => {
      const response = corsManager.handlePreflight(mockContext('https://scpos.site'))
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://scpos.site')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined()
    })
  })

  describe('createResponse', () => {
    it('should create JSON response with CORS headers', () => {
      const data = { success: true }
      const response = corsManager.createResponse(data, 200, mockContext('https://scpos.site'))
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://scpos.site')
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response with CORS headers', () => {
      const response = corsManager.createErrorResponse('Not found', 404, mockContext('https://scpos.site'))
      expect(response.status).toBe(404)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})
