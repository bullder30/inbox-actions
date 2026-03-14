-- CreateTable: microsoft_graph_mailboxes
-- This table was previously added via prisma db push without a migration file.
CREATE TABLE IF NOT EXISTS "microsoft_graph_mailboxes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microsoft_account_id" TEXT NOT NULL,
    "label" TEXT,
    "email" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "token_scope" TEXT,
    "delta_link" TEXT,
    "last_sync" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "connection_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microsoft_graph_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_graph_mailboxes_userId_microsoft_account_id_key"
    ON "microsoft_graph_mailboxes"("userId", "microsoft_account_id");

CREATE INDEX IF NOT EXISTS "microsoft_graph_mailboxes_userId_idx"
    ON "microsoft_graph_mailboxes"("userId");

CREATE INDEX IF NOT EXISTS "microsoft_graph_mailboxes_is_active_idx"
    ON "microsoft_graph_mailboxes"("is_active");

-- AddForeignKey
ALTER TABLE "microsoft_graph_mailboxes"
    ADD CONSTRAINT "microsoft_graph_mailboxes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: imap_credentials — add label column
ALTER TABLE "imap_credentials"
    ADD COLUMN IF NOT EXISTS "label" TEXT;

-- AlterTable: actions — add mailbox_id and mailbox_label columns
ALTER TABLE "actions"
    ADD COLUMN IF NOT EXISTS "mailbox_id" TEXT,
    ADD COLUMN IF NOT EXISTS "mailbox_label" TEXT;

-- AlterTable: email_metadata — add mailbox_id column and index
ALTER TABLE "email_metadata"
    ADD COLUMN IF NOT EXISTS "mailbox_id" TEXT;

CREATE INDEX IF NOT EXISTS "email_metadata_userId_imap_uid_mailbox_id_idx"
    ON "email_metadata"("userId", "imap_uid", "mailbox_id");
