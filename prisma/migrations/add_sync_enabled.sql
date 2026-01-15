-- Migration: Add sync_enabled column to users table
-- This allows users to enable/disable automatic email synchronization

ALTER TABLE users ADD COLUMN sync_enabled BOOLEAN NOT NULL DEFAULT true;
