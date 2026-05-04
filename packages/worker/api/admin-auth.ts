import type { D1Database } from '@cloudflare/workers-types'
import type { AdminUser, AdminLoginBody, AdminRole, RequestContext } from '../shared/types'
import { hashPassword, verifyPassword, createAdminToken, verifyAdminToken } from '../security/admin-auth'
import { logAdminAction } from './admin-logs'
import { logger } from '../utils/logger'

interface AdminAuthResult {
  adminId: number
  username: string
  role: AdminRole
}

export async function handleAdminLogin(
  db: D1Database,
  secret: string,
  body: AdminLoginBody,
  requestContext: RequestContext
): Promise<{ success: boolean; token?: string; admin?: Omit<AdminUser, 'password_hash'>; error?: string }> {
  try {
    if (!body.username || !body.password) {
      return { success: false, error: '请提供用户名和密码' }
    }
    
    const admin = await db.prepare(
      'SELECT * FROM admin_users WHERE username = ? AND is_active = 1'
    ).bind(body.username).first<AdminUser>()
    
    if (!admin) {
      return { success: false, error: '用户名或密码错误' }
    }
    
    const isValid = await verifyPassword(body.password, admin.password_hash)
    if (!isValid) {
      return { success: false, error: '用户名或密码错误' }
    }
    
    await db.prepare(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(admin.id).run()
    
    const token = await createAdminToken(
      { id: admin.id, username: admin.username, role: admin.role },
      secret,
      '24h'
    )
    
    await logAdminAction(db, {
      admin_id: admin.id,
      admin_username: admin.username,
      action: 'login',
      ip_address: requestContext.ip,
    })
    
    const { password_hash: _, ...adminWithoutPassword } = admin
    
    return {
      success: true,
      token,
      admin: adminWithoutPassword,
    }
  } catch (e: unknown) {
    logger.error('[AdminAuth] Login failed:', e instanceof Error ? e : new Error(String(e)))
    return { success: false, error: '登录失败，请稍后重试' }
  }
}

export async function requireAdminAuth(
  request: Request,
  secret: string | undefined,
  db: D1Database
): Promise<AdminAuthResult | Response> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: '请先登录管理后台' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  if (!secret) {
    return new Response(
      JSON.stringify({ success: false, error: '服务器配置错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  const token = authHeader.slice(7)
  const payload = await verifyAdminToken(token, secret)
  
  if (!payload) {
    return new Response(
      JSON.stringify({ success: false, error: '登录已过期，请重新登录' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  const admin = await db.prepare(
    'SELECT id, username, role, is_active FROM admin_users WHERE id = ? AND is_active = 1'
  ).bind(payload.adminId).first<{ id: number; username: string; role: AdminRole; is_active: number }>()
  
  if (!admin) {
    return new Response(
      JSON.stringify({ success: false, error: '管理员账户已被禁用' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  return {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
  }
}

export function requireRole(
  adminInfo: AdminAuthResult,
  ...roles: AdminRole[]
): Response | null {
  if (!roles.includes(adminInfo.role)) {
    return new Response(
      JSON.stringify({ success: false, error: '权限不足，无法执行此操作' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return null
}
