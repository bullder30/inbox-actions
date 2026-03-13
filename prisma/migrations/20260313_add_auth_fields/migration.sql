-- AlterTable: add password reset fields and terms acceptance to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);

-- CreateIndex: unique constraint on password_reset_token
CREATE UNIQUE INDEX IF NOT EXISTS "users_password_reset_token_key" ON "users"("password_reset_token");
