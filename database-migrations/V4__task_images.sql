-- Add images column to tasks table
-- Store images as JSON array of base64 strings or URLs
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

