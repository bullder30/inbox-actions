-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ExclusionType" AS ENUM ('SENDER', 'DOMAIN', 'SUBJECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_exclusions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExclusionType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_exclusions_userId_type_value_key"
    ON "user_exclusions"("userId", "type", "value");

CREATE INDEX IF NOT EXISTS "user_exclusions_userId_idx"
    ON "user_exclusions"("userId");

-- AddForeignKey
ALTER TABLE "user_exclusions"
    ADD CONSTRAINT "user_exclusions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
