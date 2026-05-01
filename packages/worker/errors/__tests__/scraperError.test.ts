import { describe, it, expect } from 'vitest'
import { ScraperError, ScraperErrorType } from '../scraperError'

describe('ScraperError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new ScraperError('test message', ScraperErrorType.NETWORK_ERROR, true, 500)
      expect(error.message).toBe('test message')
      expect(error.type).toBe(ScraperErrorType.NETWORK_ERROR)
      expect(error.retryable).toBe(true)
      expect(error.statusCode).toBe(500)
      expect(error.name).toBe('ScraperError')
    })

    it('should create error with details', () => {
      const details = { url: 'https://example.com' }
      const error = new ScraperError('test', ScraperErrorType.PARSE_ERROR, false, undefined, details)
      expect(error.details).toEqual(details)
    })
  })

  describe('static factory methods', () => {
    it('networkError should create correct error type', () => {
      const error = ScraperError.networkError('Connection failed', 503)
      expect(error.type).toBe(ScraperErrorType.NETWORK_ERROR)
      expect(error.retryable).toBe(true)
      expect(error.statusCode).toBe(503)
      expect(error.message).toContain('Network error')
    })

    it('parseError should create non-retryable error', () => {
      const error = ScraperError.parseError('Invalid HTML')
      expect(error.type).toBe(ScraperErrorType.PARSE_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('cacheError should create non-retryable error', () => {
      const error = ScraperError.cacheError('KV not found')
      expect(error.type).toBe(ScraperErrorType.CACHE_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('rateLimitError should create retryable error with 429', () => {
      const error = ScraperError.rateLimitError()
      expect(error.type).toBe(ScraperErrorType.RATE_LIMIT_ERROR)
      expect(error.retryable).toBe(true)
      expect(error.statusCode).toBe(429)
    })

    it('blockedError should create non-retryable error', () => {
      const error = ScraperError.blockedError('IP blocked')
      expect(error.type).toBe(ScraperErrorType.BLOCKED_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('validationError should create non-retryable error', () => {
      const error = ScraperError.validationError('Too short')
      expect(error.type).toBe(ScraperErrorType.VALIDATION_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('timeoutError should create retryable error', () => {
      const error = ScraperError.timeoutError()
      expect(error.type).toBe(ScraperErrorType.TIMEOUT_ERROR)
      expect(error.retryable).toBe(true)
    })
  })

  describe('fromError', () => {
    it('should return ScraperError as-is', () => {
      const original = ScraperError.networkError('test')
      const result = ScraperError.fromError(original)
      expect(result).toBe(original)
    })

    it('should wrap generic Error as network error', () => {
      const genericError = new Error('something failed')
      const result = ScraperError.fromError(genericError)
      expect(result).toBeInstanceOf(ScraperError)
      expect(result.type).toBe(ScraperErrorType.NETWORK_ERROR)
      expect(result.retryable).toBe(true)
      expect(result.message).toBe('something failed')
    })
  })

  describe('toJSON', () => {
    it('should serialize all properties', () => {
      const error = ScraperError.networkError('test', 500)
      const json = error.toJSON()
      expect(json.name).toBe('ScraperError')
      expect(json.type).toBe(ScraperErrorType.NETWORK_ERROR)
      expect(json.retryable).toBe(true)
      expect(json.statusCode).toBe(500)
    })
  })

  describe('prototype chain', () => {
    it('should be instanceof ScraperError', () => {
      const error = ScraperError.networkError('test')
      expect(error).toBeInstanceOf(ScraperError)
      expect(error).toBeInstanceOf(Error)
    })
  })
})
