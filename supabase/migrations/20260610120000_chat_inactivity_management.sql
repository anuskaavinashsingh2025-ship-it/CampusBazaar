-- Add new conversation statuses for inactivity management
ALTER TYPE conversation_status 
ADD VALUE IF NOT EXISTS 'auto_archived' AFTER 'completed',
ADD VALUE IF NOT EXISTS 'completion_pending' AFTER 'auto_archived';

-- Add archive_reason and completion_requested_by fields to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS archive_reason TEXT,
ADD COLUMN IF NOT EXISTS completion_requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ;

-- Add index on last_message_at for efficient inactivity checks
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
ON conversations(last_message_at) 
WHERE status IN ('active', 'completion_pending');

-- Add index on archived_at for efficient deletion checks
CREATE INDEX IF NOT EXISTS idx_conversations_archived_at 
ON conversations(archived_at) 
WHERE status IN ('archived', 'auto_archived', 'completed');

-- Add index on completion_requested_by for efficient completion flow queries
CREATE INDEX IF NOT EXISTS idx_conversations_completion_requested_by 
ON conversations(completion_requested_by) 
WHERE status = 'completion_pending';
