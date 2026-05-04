import type { D1Database } from '@cloudflare/workers-types'
import type { AdminLogEntry, SystemSetting, AdminStats, TrendDataPoint } from '../shared/types'
import { logAdminAction } from './admin-logs'
import { logger } from '../utils/logger'

const VALID_CONTENT_TYPES = ['scp_items', 'tales', 'goi', 'hubs'] as const
type ContentType = typeof VALID_CONTENT_TYPES[number]

function isValidContentType(type: string): type is ContentType {
  return VALID_CONTENT_TYPES.includes(type as ContentType)
}

function getTableConfig(type: ContentType): { table: string; idCol: string; searchCols: string[] } {
  switch (type) {
    case 'scp_items': return { table: 'scp_items', idCol: 'id', searchCols: ['scp_number', 'title', 'object_class', 'tags'] }
    case 'tales': return { table: 'scp_tales', idCol: 'id', searchCols: ['title', 'link', 'creator', 'tags'] }
    case 'goi': return { table: 'scp_goi', idCol: 'id', searchCols: ['title', 'link', 'creator', 'tags'] }
    case 'hubs': return { table: 'scp_hubs', idCol: 'id', searchCols: ['title', 'link', 'tags'] }
  }
}

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User Management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAdminUsers(
  db: D1Database,
  options: { limit: number; offset: number; search?: string; sort?: string; order?: string; is_banned?: number }
): Promise<{ success: boolean; data?: unknown[]; total?: number; error?: string }> {
  try {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.search) {
      conditions.push('(user_id LIKE ? OR nickname LIKE ?)')
      params.push(`%${options.search}%`, `%${options.search}%`)
    }
    if (options.is_banned !== undefined) {
      conditions.push('is_banned = ?')
      params.push(options.is_banned)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const allowedSorts = ['created_at', 'nickname', 'last_active_at', 'is_banned']
    const sortCol = allowedSorts.includes(options.sort || '') ? options.sort : 'created_at'
    const order = options.order === 'ASC' ? 'ASC' : 'DESC'

    const [listResult, countResult] = await db.batch([
      db.prepare(`SELECT id, user_id, nickname, created_at, last_active_at, is_banned, ban_reason, banned_at FROM users ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`)
        .bind(...params, options.limit, options.offset),
      db.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...params),
    ])

    return {
      success: true,
      data: listResult.results as unknown[],
      total: (countResult.results[0] as { total: number })?.total || 0,
    }
  } catch (e) {
    logger.error('[Admin] getAdminUsers failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取用户列表失败' }
  }
}

export async function getAdminUserById(
  db: D1Database,
  userId: number
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const user = await db.prepare(
      'SELECT id, user_id, nickname, created_at, last_active_at, is_banned, ban_reason, banned_at FROM users WHERE id = ?'
    ).bind(userId).first()
    if (!user) return { success: false, error: '用户不存在' }
    return { success: true, data: user }
  } catch (e) {
    logger.error('[Admin] getAdminUserById failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取用户详情失败' }
  }
}

export async function banUser(
  db: D1Database, userId: number, reason: string,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.prepare('SELECT user_id, nickname FROM users WHERE id = ?').bind(userId).first<{ user_id: string; nickname: string }>()
    if (!user) return { success: false, error: '用户不存在' }

    await db.prepare(
      'UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(reason, userId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'ban_user', target_type: 'user', target_id: String(userId),
      details: JSON.stringify({ user_id: user.user_id, nickname: user.nickname, reason }),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] banUser failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '封禁用户失败' }
  }
}

export async function unbanUser(
  db: D1Database, userId: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.prepare('SELECT user_id, nickname FROM users WHERE id = ?').bind(userId).first<{ user_id: string; nickname: string }>()
    if (!user) return { success: false, error: '用户不存在' }

    await db.prepare(
      'UPDATE users SET is_banned = 0, ban_reason = \'\', banned_at = NULL WHERE id = ?'
    ).bind(userId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'unban_user', target_type: 'user', target_id: String(userId),
      details: JSON.stringify({ user_id: user.user_id, nickname: user.nickname }),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] unbanUser failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '解封用户失败' }
  }
}

export async function deleteAdminUser(
  db: D1Database, userId: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.prepare('SELECT user_id, nickname FROM users WHERE id = ?').bind(userId).first<{ user_id: string; nickname: string }>()
    if (!user) return { success: false, error: '用户不存在' }

    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'delete_user', target_type: 'user', target_id: String(userId),
      details: JSON.stringify({ user_id: user.user_id, nickname: user.nickname }),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] deleteAdminUser failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '删除用户失败' }
  }
}

export async function batchUserOperation(
  db: D1Database, action: string, ids: number[],
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; results?: { id: number; success: boolean; error?: string }[]; error?: string }> {
  try {
    const results: { id: number; success: boolean; error?: string }[] = []
    for (const id of ids) {
      let result: { success: boolean; error?: string }
      switch (action) {
        case 'ban': result = await banUser(db, id, '批量封禁', adminId, adminUsername, ip); break
        case 'unban': result = await unbanUser(db, id, adminId, adminUsername, ip); break
        case 'delete': result = await deleteAdminUser(db, id, adminId, adminUsername, ip); break
        default: result = { success: false, error: '未知操作' }
      }
      results.push({ id, ...result })
    }

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: `batch_${action}_users`, target_type: 'user',
      details: JSON.stringify({ ids, count: ids.length }),
      ip_address: ip,
    })
    return { success: true, results }
  } catch (e) {
    logger.error('[Admin] batchUserOperation failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '批量操作失败' }
  }
}

export async function exportUsers(
  db: D1Database, format: 'csv' | 'json'
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    const result = await db.prepare(
      'SELECT id, user_id, nickname, created_at, last_active_at, is_banned, ban_reason, banned_at FROM users ORDER BY created_at DESC'
    ).all()
    const users = result.results as Record<string, unknown>[]

    if (format === 'csv') {
      if (users.length === 0) return { success: true, data: '', filename: 'users.csv' }
      const headers = Object.keys(users[0])
      const csv = [
        headers.join(','),
        ...users.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
      ].join('\n')
      return { success: true, data: csv, filename: 'users.csv' }
    }

    return { success: true, data: JSON.stringify(users, null, 2), filename: 'users.json' }
  } catch (e) {
    logger.error('[Admin] exportUsers failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '导出用户数据失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Content Management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAdminContent(
  db: D1Database,
  type: string,
  options: { limit: number; offset: number; search?: string }
): Promise<{ success: boolean; data?: unknown[]; total?: number; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const config = getTableConfig(type)

    let where = ''
    const params: unknown[] = []
    if (options.search) {
      const searchConditions = config.searchCols.map(col => `${col} LIKE ?`)
      where = `WHERE ${searchConditions.join(' OR ')}`
      for (let i = 0; i < config.searchCols.length; i++) params.push(`%${options.search}%`)
    }

    const [listResult, countResult] = await db.batch([
      db.prepare(`SELECT * FROM ${config.table} ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
        .bind(...params, options.limit, options.offset),
      db.prepare(`SELECT COUNT(*) as total FROM ${config.table} ${where}`).bind(...params),
    ])

    return {
      success: true,
      data: listResult.results as unknown[],
      total: (countResult.results[0] as { total: number })?.total || 0,
    }
  } catch (e) {
    logger.error('[Admin] getAdminContent failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取内容列表失败' }
  }
}

export async function updateAdminContent(
  db: D1Database, type: string, id: number, data: Record<string, unknown>,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const config = getTableConfig(type)

    const allowedFields: Record<string, string[]> = {
      scp_items: ['title', 'object_class', 'series', 'rating', 'tags', 'clearance_level'],
      tales: ['title', 'year', 'rating', 'tags'],
      goi: ['title', 'rating', 'tags'],
      hubs: ['title', 'tags', 'references_json'],
    }

    const allowed = allowedFields[type] || []
    const sets: string[] = []
    const values: unknown[] = []
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (sets.length === 0) return { success: false, error: '没有可更新的字段' }

    values.push(id)
    await db.prepare(`UPDATE ${config.table} SET ${sets.join(', ')} WHERE ${config.idCol} = ?`).bind(...values).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'update_content', target_type: type, target_id: String(id),
      details: JSON.stringify(data),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] updateAdminContent failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '更新内容失败' }
  }
}

export async function deleteAdminContent(
  db: D1Database, type: string, id: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const config = getTableConfig(type)

    await db.prepare(`DELETE FROM ${config.table} WHERE ${config.idCol} = ?`).bind(id).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'delete_content', target_type: type, target_id: String(id),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] deleteAdminContent failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '删除内容失败' }
  }
}

export async function batchContentOperation(
  db: D1Database, type: string, action: string, ids: number[],
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; results?: { id: number; success: boolean; error?: string }[]; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const results: { id: number; success: boolean; error?: string }[] = []
    for (const id of ids) {
      let result: { success: boolean; error?: string }
      if (action === 'delete') {
        result = await deleteAdminContent(db, type, id, adminId, adminUsername, ip)
      } else {
        result = { success: false, error: '未知操作' }
      }
      results.push({ id, ...result })
    }

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: `batch_${action}_content`, target_type: type,
      details: JSON.stringify({ ids, count: ids.length }),
      ip_address: ip,
    })
    return { success: true, results }
  } catch (e) {
    logger.error('[Admin] batchContentOperation failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '批量操作失败' }
  }
}

export async function exportContent(
  db: D1Database, type: string, format: 'csv' | 'json'
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const config = getTableConfig(type)

    const result = await db.prepare(`SELECT * FROM ${config.table} ORDER BY id DESC`).all()
    const items = result.results as Record<string, unknown>[]

    if (format === 'csv') {
      if (items.length === 0) return { success: true, data: '', filename: `${type}.csv` }
      const headers = Object.keys(items[0])
      const csv = [
        headers.join(','),
        ...items.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
      ].join('\n')
      return { success: true, data: csv, filename: `${type}.csv` }
    }

    return { success: true, data: JSON.stringify(items, null, 2), filename: `${type}.json` }
  } catch (e) {
    logger.error('[Admin] exportContent failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '导出内容数据失败' }
  }
}

export async function importContent(
  db: D1Database, type: string, data: unknown[],
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; imported?: number; errors?: number; error?: string }> {
  try {
    if (!isValidContentType(type)) return { success: false, error: '无效的内容类型' }
    const config = getTableConfig(type)

    let imported = 0
    let errors = 0

    for (const item of data) {
      try {
        const record = item as Record<string, unknown>
        const cols = config.searchCols.filter(c => record[c] !== undefined)
        if (cols.length === 0) { errors++; continue }

        const allCols = Object.keys(record).filter(k => k !== config.idCol)
        const colNames = allCols.join(', ')
        const placeholders = allCols.map(() => '?').join(', ')
        const values = allCols.map(k => record[k])

        await db.prepare(
          `INSERT OR REPLACE INTO ${config.table} (${colNames}) VALUES (${placeholders})`
        ).bind(...values).run()
        imported++
      } catch {
        errors++
      }
    }

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'import_content', target_type: type,
      details: JSON.stringify({ imported, errors }),
      ip_address: ip,
    })
    return { success: true, imported, errors }
  } catch (e) {
    logger.error('[Admin] importContent failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '导入内容数据失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chat Management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAdminChatMessages(
  db: D1Database,
  options: { limit: number; offset: number; room_id?: number; start_date?: string; end_date?: string }
): Promise<{ success: boolean; data?: unknown[]; total?: number; error?: string }> {
  try {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.room_id !== undefined) {
      conditions.push('room_id = ?')
      params.push(options.room_id)
    }
    if (options.start_date) {
      conditions.push('created_at >= ?')
      params.push(options.start_date)
    }
    if (options.end_date) {
      conditions.push('created_at <= ?')
      params.push(options.end_date)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [listResult, countResult] = await db.batch([
      db.prepare(`SELECT * FROM chat_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...params, options.limit, options.offset),
      db.prepare(`SELECT COUNT(*) as total FROM chat_messages ${where}`).bind(...params),
    ])

    return {
      success: true,
      data: listResult.results as unknown[],
      total: (countResult.results[0] as { total: number })?.total || 0,
    }
  } catch (e) {
    logger.error('[Admin] getAdminChatMessages failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取聊天消息失败' }
  }
}

export async function deleteAdminChatMessage(
  db: D1Database, messageId: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare('DELETE FROM chat_messages WHERE id = ?').bind(messageId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'delete_chat_message', target_type: 'chat_message', target_id: String(messageId),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] deleteAdminChatMessage failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '删除聊天消息失败' }
  }
}

export async function getAdminChatRooms(
  db: D1Database
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  try {
    const result = await db.prepare('SELECT * FROM chat_rooms ORDER BY created_at DESC').all()
    return { success: true, data: result.results as unknown[] }
  } catch (e) {
    logger.error('[Admin] getAdminChatRooms failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取聊天室列表失败' }
  }
}

export async function updateAdminChatRoom(
  db: D1Database, roomId: number, data: { name?: string; description?: string; is_public?: number },
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sets: string[] = []
    const values: unknown[] = []
    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description) }
    if (data.is_public !== undefined) { sets.push('is_public = ?'); values.push(data.is_public) }

    if (sets.length === 0) return { success: false, error: '没有可更新的字段' }

    values.push(roomId)
    await db.prepare(`UPDATE chat_rooms SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'update_chat_room', target_type: 'chat_room', target_id: String(roomId),
      details: JSON.stringify(data), ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] updateAdminChatRoom failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '更新聊天室失败' }
  }
}

export async function deleteAdminChatRoom(
  db: D1Database, roomId: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare('DELETE FROM chat_messages WHERE room_id = ?').bind(roomId).run()
    await db.prepare('DELETE FROM chat_rooms WHERE id = ?').bind(roomId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'delete_chat_room', target_type: 'chat_room', target_id: String(roomId),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] deleteAdminChatRoom failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '删除聊天室失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feedback Management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAdminFeedback(
  db: D1Database,
  options: { limit: number; offset: number; status?: string; category?: string }
): Promise<{ success: boolean; data?: unknown[]; total?: number; error?: string }> {
  try {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.status) {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options.category) {
      conditions.push('category = ?')
      params.push(options.category)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [listResult, countResult] = await db.batch([
      db.prepare(`SELECT * FROM feedbacks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...params, options.limit, options.offset),
      db.prepare(`SELECT COUNT(*) as total FROM feedbacks ${where}`).bind(...params),
    ])

    return {
      success: true,
      data: listResult.results as unknown[],
      total: (countResult.results[0] as { total: number })?.total || 0,
    }
  } catch (e) {
    logger.error('[Admin] getAdminFeedback failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取反馈列表失败' }
  }
}

export async function updateFeedbackStatus(
  db: D1Database, feedbackId: number, status: string,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validStatuses = ['published', 'resolved', 'closed', 'hidden']
    if (!validStatuses.includes(status)) return { success: false, error: '无效的状态值' }

    await db.prepare('UPDATE feedbacks SET status = ? WHERE id = ?').bind(status, feedbackId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'update_feedback_status', target_type: 'feedback', target_id: String(feedbackId),
      details: JSON.stringify({ status }), ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] updateFeedbackStatus failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '更新反馈状态失败' }
  }
}

export async function deleteAdminFeedback(
  db: D1Database, feedbackId: number,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare('DELETE FROM feedback_votes WHERE feedback_id = ?').bind(feedbackId).run()
    await db.prepare('DELETE FROM feedback_comments WHERE feedback_id = ?').bind(feedbackId).run()
    await db.prepare('DELETE FROM feedbacks WHERE id = ?').bind(feedbackId).run()

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'delete_feedback', target_type: 'feedback', target_id: String(feedbackId),
      ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] deleteAdminFeedback failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '删除反馈失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// System Settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getSystemSettings(
  db: D1Database
): Promise<{ success: boolean; data?: SystemSetting[]; error?: string }> {
  try {
    const result = await db.prepare('SELECT * FROM system_settings ORDER BY id ASC').all()
    return { success: true, data: result.results as unknown as SystemSetting[] }
  } catch (e) {
    logger.error('[Admin] getSystemSettings failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取系统设置失败' }
  }
}

export async function updateSystemSettings(
  db: D1Database, settings: Record<string, string>,
  adminId: number, adminUsername: string, ip: string
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const [key, value] of Object.entries(settings)) {
      await db.prepare(
        'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = ?'
      ).bind(value, adminUsername, key).run()
    }

    await logAdminAction(db, {
      admin_id: adminId, admin_username: adminUsername,
      action: 'update_settings', target_type: 'system',
      details: JSON.stringify(settings), ip_address: ip,
    })
    return { success: true }
  } catch (e) {
    logger.error('[Admin] updateSystemSettings failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '更新系统设置失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Statistics & Dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getDashboardStats(
  db: D1Database
): Promise<{ success: boolean; data?: AdminStats; error?: string }> {
  try {
    const [
      totalUsersResult,
      activeUsersResult,
      bannedUsersResult,
      totalContentResult,
      totalFeedbackResult,
      totalChatResult,
      recentUsersResult,
      recentFeedbackResult,
    ] = await db.batch([
      db.prepare('SELECT COUNT(*) as count FROM users'),
      db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 0'),
      db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1'),
      db.prepare('SELECT COUNT(*) as count FROM scp_items'),
      db.prepare('SELECT COUNT(*) as count FROM feedbacks'),
      db.prepare('SELECT COUNT(*) as count FROM chat_messages'),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')"),
      db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE created_at >= datetime('now', '-7 days')"),
    ])

    return {
      success: true,
      data: {
        totalUsers: (totalUsersResult.results[0] as { count: number })?.count || 0,
        activeUsers: (activeUsersResult.results[0] as { count: number })?.count || 0,
        bannedUsers: (bannedUsersResult.results[0] as { count: number })?.count || 0,
        totalContent: (totalContentResult.results[0] as { count: number })?.count || 0,
        totalFeedback: (totalFeedbackResult.results[0] as { count: number })?.count || 0,
        totalChatMessages: (totalChatResult.results[0] as { count: number })?.count || 0,
        recentUsers: (recentUsersResult.results[0] as { count: number })?.count || 0,
        recentFeedback: (recentFeedbackResult.results[0] as { count: number })?.count || 0,
      },
    }
  } catch (e) {
    logger.error('[Admin] getDashboardStats failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取统计数据失败' }
  }
}

export async function getTrendData(
  db: D1Database, days: number
): Promise<{ success: boolean; data?: { users: TrendDataPoint[]; feedback: TrendDataPoint[]; content: TrendDataPoint[] }; error?: string }> {
  try {
    const safeDays = Math.min(Math.max(days, 1), 365)

    const [usersResult, feedbackResult, contentResult] = await db.batch([
      db.prepare(
        `SELECT DATE(created_at) as date, COUNT(*) as count FROM users 
         WHERE created_at >= datetime('now', '-${safeDays} days') 
         GROUP BY DATE(created_at) ORDER BY date ASC`
      ),
      db.prepare(
        `SELECT DATE(created_at) as date, COUNT(*) as count FROM feedbacks 
         WHERE created_at >= datetime('now', '-${safeDays} days') 
         GROUP BY DATE(created_at) ORDER BY date ASC`
      ),
      db.prepare(
        `SELECT DATE(updated_at) as date, COUNT(*) as count FROM scp_index 
         WHERE updated_at >= datetime('now', '-${safeDays} days') 
         GROUP BY DATE(updated_at) ORDER BY date ASC`
      ),
    ])

    return {
      success: true,
      data: {
        users: (usersResult.results as TrendDataPoint[]) || [],
        feedback: (feedbackResult.results as TrendDataPoint[]) || [],
        content: (contentResult.results as TrendDataPoint[]) || [],
      },
    }
  } catch (e) {
    logger.error('[Admin] getTrendData failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取趋势数据失败' }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Audit Logs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAdminLogs(
  db: D1Database,
  options: { limit: number; offset: number; admin_id?: number; action?: string; start_date?: string; end_date?: string }
): Promise<{ success: boolean; data?: AdminLogEntry[]; total?: number; error?: string }> {
  try {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.admin_id) {
      conditions.push('admin_id = ?')
      params.push(options.admin_id)
    }
    if (options.action) {
      conditions.push('action = ?')
      params.push(options.action)
    }
    if (options.start_date) {
      conditions.push('created_at >= ?')
      params.push(options.start_date)
    }
    if (options.end_date) {
      conditions.push('created_at <= ?')
      params.push(options.end_date)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [listResult, countResult] = await db.batch([
      db.prepare(`SELECT * FROM admin_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...params, options.limit, options.offset),
      db.prepare(`SELECT COUNT(*) as total FROM admin_logs ${where}`).bind(...params),
    ])

    return {
      success: true,
      data: listResult.results as AdminLogEntry[],
      total: (countResult.results[0] as { total: number })?.total || 0,
    }
  } catch (e) {
    logger.error('[Admin] getAdminLogs failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '获取操作日志失败' }
  }
}
