-- =============================================
-- 0012 管理员系统
-- =============================================

-- =============================================
-- 1. 管理员用户表
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('super_admin', 'admin', 'moderator')),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- =============================================
-- 2. 管理操作日志表
-- =============================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- =============================================
-- 3. 系统设置表
-- =============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- =============================================
-- 4. 用户表扩展字段（封禁相关）
-- =============================================
ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN banned_at DATETIME DEFAULT NULL;

-- =============================================
-- 5. 插入默认超级管理员账户
-- =============================================
INSERT OR IGNORE INTO admin_users (username, password_hash, role) 
VALUES ('admin', 'PBKDF2$100000$c2FsdA==$cGFzc3dvcmQ=', 'super_admin');

-- =============================================
-- 6. 插入默认系统设置
-- =============================================
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES 
  ('site_name', 'SCP-OS', '站点名称'),
  ('site_description', 'SCP Foundation Web OS', '站点描述'),
  ('cache_duration', '1800000', '缓存时长（毫秒）'),
  ('max_upload_size', '10485760', '最大上传文件大小（字节）'),
  ('maintenance_mode', '0', '维护模式（0=关闭，1=开启）'),
  ('user_registration', '1', '用户注册（0=关闭，1=开启）'),
  ('chat_enabled', '1', '聊天功能（0=关闭，1=开启）'),
  ('feedback_enabled', '1', '反馈功能（0=关闭，1=开启）');
