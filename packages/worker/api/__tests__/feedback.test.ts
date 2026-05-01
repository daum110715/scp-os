import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitFeedback, getFeedbackList, voteFeedback, getComments, submitComment, getFeedbackCategories, getFeedbackListWithVotes } from '../feedback'

function createMockDB(overrides: Record<string, any> = {}): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn(() => Promise.resolve({ success: true, meta: { last_row_id: 1 } })),
        first: vi.fn(() => Promise.resolve(null)),
        all: vi.fn(() => Promise.resolve({ results: [] })),
      })),
    })),
    exec: vi.fn(() => Promise.resolve({ success: true })),
    batch: vi.fn(() => Promise.resolve([])),
    dump: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    ...overrides,
  } as unknown as D1Database
}

describe('Feedback API', () => {
  describe('submitFeedback', () => {
    it('should reject empty title', async () => {
      const db = createMockDB()
      const result = await submitFeedback(db, {
        user_id: 'user1',
        title: '',
        content: 'some content',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Title')
    })

    it('should reject title over 100 characters', async () => {
      const db = createMockDB()
      const result = await submitFeedback(db, {
        user_id: 'user1',
        title: 'a'.repeat(101),
        content: 'some content',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty content', async () => {
      const db = createMockDB()
      const result = await submitFeedback(db, {
        user_id: 'user1',
        title: 'Test',
        content: '',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Content')
    })

    it('should reject content over 2000 characters', async () => {
      const db = createMockDB()
      const result = await submitFeedback(db, {
        user_id: 'user1',
        title: 'Test',
        content: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('should default category to general for invalid category', async () => {
      const mockFirst = vi.fn()
        .mockResolvedValueOnce({ id: 1, nickname: 'Test', title: 'Test', content: 'Content', category: 'general' })
      const mockRun = vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 1 } })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: mockRun,
            first: mockFirst,
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await submitFeedback(db, {
        user_id: 'user1',
        title: 'Test',
        content: 'Content',
        category: 'invalid_category',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getFeedbackList', () => {
    it('should return list with count', async () => {
      const mockAll = vi.fn().mockResolvedValue({
        results: [{ id: 1, title: 'Test', category: 'general' }],
      })
      const mockFirst = vi.fn()
        .mockResolvedValueOnce({ total: 1 })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: mockAll,
            first: mockFirst,
            run: vi.fn(() => Promise.resolve({ success: true })),
          })),
        })),
      })

      const result = await getFeedbackList(db, 50, 0)
      expect(result.success).toBe(true)
    })
  })

  describe('voteFeedback', () => {
    it('should add new vote', async () => {
      const mockFirst = vi.fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
      const mockRun = vi.fn().mockResolvedValue({ success: true })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: mockRun,
            first: mockFirst,
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await voteFeedback(db, {
        id: 1,
        user_id: 'user1',
        vote: 'up',
      })

      expect(result.success).toBe(true)
    })

    it('should return error when feedback not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null)

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            run: vi.fn(() => Promise.resolve({ success: true })),
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await voteFeedback(db, {
        id: 999,
        user_id: 'user1',
        vote: 'up',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('submitComment', () => {
    it('should reject empty content', async () => {
      const db = createMockDB()
      const result = await submitComment(db, {
        feedback_id: 1,
        user_id: 'user1',
        content: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject content over 500 characters', async () => {
      const db = createMockDB()
      const result = await submitComment(db, {
        feedback_id: 1,
        user_id: 'user1',
        content: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getComments', () => {
    it('should return error when feedback not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null)

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            all: vi.fn(() => Promise.resolve({ results: [] })),
            run: vi.fn(() => Promise.resolve({ success: true })),
          })),
        })),
      })

      const result = await getComments(db, 999)
      expect(result.success).toBe(false)
    })
  })
})
