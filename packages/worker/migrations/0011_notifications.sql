CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_nickname TEXT DEFAULT 'Anonymous',
  type TEXT NOT NULL CHECK(type IN ('feedback_comment', 'feedback_upvote', 'feedback_downvote', 'chat_message')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  reference_id TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  feedback_comment INTEGER DEFAULT 1,
  feedback_upvote INTEGER DEFAULT 1,
  feedback_downvote INTEGER DEFAULT 1,
  chat_message INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
