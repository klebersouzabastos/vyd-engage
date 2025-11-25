-- Migration: Make email optional in User table
-- This migration makes the email field nullable while maintaining uniqueness constraint

-- Step 1: Drop the existing unique constraint on email
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- Step 2: Alter the email column to be nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Step 3: Recreate the unique constraint (PostgreSQL allows NULL values in unique constraints)
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");

-- Note: PostgreSQL unique constraints allow multiple NULL values, which is what we want
-- This ensures that:
-- - Multiple users can have NULL email (no email)
-- - Each non-NULL email must be unique

