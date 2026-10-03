-- Separate migration: PostgreSQL must commit a new enum value before it is used.
ALTER TYPE "tipe_input" ADD VALUE IF NOT EXISTS 'option';
