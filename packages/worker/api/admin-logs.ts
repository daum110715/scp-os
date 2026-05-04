import { logger } from '../utils/logger'

export async function logAdminAction(
  db: D1Database,
  input: {
    admin_id: number
    admin_username: string
    action: string
    target_type?: string
    target_id?: string
    details?: string
    ip_address?: string
  }
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO admin_logs (admin_id, admin_username, action, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      input.admin_id,
      input.admin_username,
      input.action,
      input.target_type || '',
      input.target_id || '',
      input.details || '',
      input.ip_address || ''
    ).run()
  } catch (e: unknown) {
    logger.error('[AdminLogs] Failed to log admin action:', e instanceof Error ? e : new Error(String(e)))
  }
}
