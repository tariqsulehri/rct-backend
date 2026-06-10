-- Phase 1 RBAC enum expansion.
-- PostgreSQL requires newly added enum values to be committed before they are
-- used in table rows, indexes, or constraints. Keep this migration enum-only.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TOP_MANAGEMENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LINE_MANAGER';
