import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RetryStrategy } from '../retryStrategy'
import { ScraperError, ScraperErrorType } from '../scraperError'

describe('RetryStrategy', () => {
  let strategy: RetryStrategy

  beforeEach(() => {
    strategy = new RetryStrategy()
  })

  describe('shouldRetry', () => {
    it('should not retry when attempt >= maxAttempts', () => {
      const error = ScraperError.networkError('test')
      expect(strategy.shouldRetry(error, 3, 3)).toBe(false)
    })

    it('should retry network errors', () => {
      const error = ScraperError.networkError('test')
      expect(strategy.shouldRetry(error, 0, 3)).toBe(true)
    })

    it('should retry rate limit errors', () => {
      const error = ScraperError.rateLimitError()
      expect(strategy.shouldRetry(error, 0, 3)).toBe(true)
    })

    it('should retry timeout errors', () => {
      const error = ScraperError.timeoutError()
      expect(strategy.shouldRetry(error, 0, 3)).toBe(true)
    })

    it('should not retry parse errors', () => {
      const error = ScraperError.parseError('test')
      expect(strategy.shouldRetry(error, 0, 3)).toBe(false)
    })

    it('should not retry validation errors', () => {
      const error = ScraperError.validationError('test')
      expect(strategy.shouldRetry(error, 0, 3)).toBe(false)
    })

    it('should retry generic Error instances', () => {
      const error = new Error('unknown failure')
      expect(strategy.shouldRetry(error, 0, 3)).toBe(true)
    })

    it('should not retry generic Error when max attempts reached', () => {
      const error = new Error('unknown failure')
      expect(strategy.shouldRetry(error, 3, 3)).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(strategy.getRetryDelay(0, 1000)).toBe(1000)
      expect(strategy.getRetryDelay(1, 1000)).toBe(2000)
      expect(strategy.getRetryDelay(2, 1000)).toBe(4000)
    })

    it('should cap delay at 10 seconds', () => {
      expect(strategy.getRetryDelay(10, 1000)).toBe(10000)
      expect(strategy.getRetryDelay(20, 1000)).toBe(10000)
    })
  })

  describe('executeWithRetry', () => {
    it('should return result on first successful attempt', async () => {
      const result = await strategy.executeWithRetry(() => Promise.resolve('success'))
      expect(result).toBe('success')
    })

    it('should retry on retryable error and succeed', async () => {
      let attempt = 0
      const operation = vi.fn(() => {
        attempt++
        if (attempt < 3) {
          throw ScraperError.networkError('fail')
        }
        return Promise.resolve('success')
      })

      const result = await strategy.executeWithRetry(operation, 3, 10)
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should throw after all attempts exhausted', async () => {
      const operation = vi.fn(() => {
        throw ScraperError.networkError('always fail')
      })

      await expect(strategy.executeWithRetry(operation, 2, 10)).rejects.toThrow('always fail')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn(() => {
        throw ScraperError.parseError('invalid')
      })

      await expect(strategy.executeWithRetry(operation, 3, 10)).rejects.toThrow('invalid')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry generic Error instances', async () => {
      let attempt = 0
      const operation = vi.fn(() => {
        attempt++
        if (attempt < 2) throw new Error('generic error')
        return Promise.resolve('ok')
      })

      const result = await strategy.executeWithRetry(operation, 3, 10)
      expect(result).toBe('ok')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })
})
