import { describe, it, expect, vi } from 'vitest'
import { registerUser, getUserByUserId, checkNicknameAvailability } from '../user'

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

describe('User API', () => {
  describe('registerUser', () => {
    it('should reject missing userId', async () => {
      const db = createMockDB()
      const result = await registerUser(db, { userId: '', nickname: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing')
    })

    it('should reject missing nickname', async () => {
      const db = createMockDB()
      const result = await registerUser(db, { userId: 'user1', nickname: '' })
      expect(result.success).toBe(false)
    })

    it('should reject nickname over 30 characters', async () => {
      const db = createMockDB()
      const result = await registerUser(db, { userId: 'user1', nickname: 'a'.repeat(31) })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Nickname too long')
    })

    it('should reject duplicate nickname', async () => {
      const mockFirst = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            run: vi.fn(() => Promise.resolve({ success: true })),
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await registerUser(db, { userId: 'user1', nickname: 'taken_name' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('already taken')
    })

    it('should update existing user', async () => {
      const mockFirst = vi.fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, user_id: 'user1', nickname: 'new_name' })

      const mockRun = vi.fn().mockResolvedValue({ success: true })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            run: mockRun,
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await registerUser(db, { userId: 'user1', nickname: 'new_name' })
      expect(result.success).toBe(true)
    })
  })

  describe('getUserByUserId', () => {
    it('should reject missing userId', async () => {
      const db = createMockDB()
      const result = await getUserByUserId(db, '')
      expect(result.success).toBe(false)
    })

    it('should return error when user not found', async () => {
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

      const result = await getUserByUserId(db, 'nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('checkNicknameAvailability', () => {
    it('should reject empty nickname', async () => {
      const db = createMockDB()
      const result = await checkNicknameAvailability(db, '')
      expect(result.success).toBe(false)
      expect(result.available).toBe(false)
    })

    it('should return available when nickname not taken', async () => {
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

      const result = await checkNicknameAvailability(db, 'available_name')
      expect(result.success).toBe(true)
      expect(result.available).toBe(true)
    })

    it('should return unavailable when nickname taken', async () => {
      const mockFirst = vi.fn().mockResolvedValue({ id: 1 })

      const db = createMockDB({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            run: vi.fn(() => Promise.resolve({ success: true })),
            all: vi.fn(() => Promise.resolve({ results: [] })),
          })),
        })),
      })

      const result = await checkNicknameAvailability(db, 'taken_name')
      expect(result.success).toBe(true)
      expect(result.available).toBe(false)
    })

    it('should exclude current user from nickname check', async () => {
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

      const result = await checkNicknameAvailability(db, 'my_name', 'user1')
      expect(result.success).toBe(true)
      expect(result.available).toBe(true)
    })
  })
})
