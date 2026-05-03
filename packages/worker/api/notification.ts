export type NotificationType = 'feedback_comment' | 'feedback_upvote' | 'feedback_downvote' | 'chat_message'

export interface CreateNotificationInput {
  recipient_user_id: string
  actor_user_id: string
  actor_nickname: string
  type: NotificationType
  title: string
  body: string
  reference_id: string
  reference_type: string
}

export interface NotificationRecord {
  id: number
  recipient_user_id: string
  actor_user_id: string
  actor_nickname: string
  type: NotificationType
  title: string
  body: string
  reference_id: string
  reference_type: string
  is_read: number
  created_at: string
  read_at: string | null
}

export interface NotificationPreferences {
  feedback_comment: number
  feedback_upvote: number
  feedback_downvote: number
  chat_message: number
}

export async function createNotification(db: D1Database, input: CreateNotificationInput): Promise<{ success: boolean; data?: NotificationRecord }> {
  try {
    const pref = await db.prepare(
      'SELECT feedback_comment, feedback_upvote, feedback_downvote, chat_message FROM notification_preferences WHERE user_id = ?'
    ).bind(input.recipient_user_id).first<NotificationPreferences>()

    if (pref) {
      const key = input.type as keyof NotificationPreferences
      if (pref[key] === 0) return { success: true }
    }

    if (input.recipient_user_id === input.actor_user_id) return { success: true }

    const result = await db.prepare(
      `INSERT INTO notifications (recipient_user_id, actor_user_id, actor_nickname, type, title, body, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(
      input.recipient_user_id, input.actor_user_id, input.actor_nickname,
      input.type, input.title, input.body, input.reference_id, input.reference_type
    ).first<NotificationRecord>()

    return { success: true, data: result || undefined }
  } catch (e) {
    return { success: false }
  }
}

export async function getNotifications(
  db: D1Database,
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ success: boolean; data?: NotificationRecord[]; total?: number; unreadCount?: number }> {
  try {
    const limit = Math.min(options.limit || 20, 100)
    const offset = options.offset || 0

    let whereClause = 'WHERE recipient_user_id = ?'
    const params: unknown[] = [userId]
    if (options.unreadOnly) {
      whereClause += ' AND is_read = 0'
    }

    const [listResult, countResult, unreadResult] = await db.batch([
      db.prepare(`SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...params, limit, offset),
      db.prepare(`SELECT COUNT(*) as total FROM notifications ${whereClause}`).bind(...params),
      db.prepare('SELECT COUNT(*) as count FROM notifications WHERE recipient_user_id = ? AND is_read = 0').bind(userId),
    ])

    return {
      success: true,
      data: listResult.results as NotificationRecord[],
      total: (countResult.results[0] as any)?.total || 0,
      unreadCount: (unreadResult.results[0] as any)?.count || 0,
    }
  } catch {
    return { success: false }
  }
}

export async function markAsRead(db: D1Database, notificationId: number, userId: string): Promise<{ success: boolean }> {
  try {
    await db.prepare(
      'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_user_id = ?'
    ).bind(notificationId, userId).run()
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function markAllAsRead(db: D1Database, userId: string): Promise<{ success: boolean }> {
  try {
    await db.prepare(
      'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE recipient_user_id = ? AND is_read = 0'
    ).bind(userId).run()
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function deleteNotification(db: D1Database, notificationId: number, userId: string): Promise<{ success: boolean }> {
  try {
    await db.prepare('DELETE FROM notifications WHERE id = ? AND recipient_user_id = ?')
      .bind(notificationId, userId).run()
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function getNotificationPreferences(db: D1Database, userId: string): Promise<{ success: boolean; data?: NotificationPreferences }> {
  try {
    const result = await db.prepare(
      'SELECT feedback_comment, feedback_upvote, feedback_downvote, chat_message FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first<NotificationPreferences>()

    if (!result) {
      return {
        success: true,
        data: { feedback_comment: 1, feedback_upvote: 1, feedback_downvote: 1, chat_message: 1 },
      }
    }
    return { success: true, data: result }
  } catch {
    return { success: false }
  }
}

export async function updateNotificationPreferences(
  db: D1Database,
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<{ success: boolean }> {
  try {
    const existing = await db.prepare(
      'SELECT id FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first()

    if (existing) {
      const sets: string[] = []
      const values: unknown[] = []
      for (const [key, value] of Object.entries(prefs)) {
        if (value !== undefined) {
          sets.push(`${key} = ?`)
          values.push(value ? 1 : 0)
        }
      }
      if (sets.length === 0) return { success: true }
      values.push(userId)
      await db.prepare(
        `UPDATE notification_preferences SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).bind(...values).run()
    } else {
      await db.prepare(
        `INSERT INTO notification_preferences (user_id, feedback_comment, feedback_upvote, feedback_downvote, chat_message)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        userId,
        prefs.feedback_comment ?? 1,
        prefs.feedback_upvote ?? 1,
        prefs.feedback_downvote ?? 1,
        prefs.chat_message ?? 1,
      ).run()
    }
    return { success: true }
  } catch {
    return { success: false }
  }
}
