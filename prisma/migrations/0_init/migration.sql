-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('SEND', 'CALL', 'FOLLOW_UP', 'PAY', 'VALIDATE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('EXTRACTED', 'ANALYZED');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'IMAP', 'MICROSOFT_GRAPH');

-- CreateEnum
CREATE TYPE "IMAPAuthMethod" AS ENUM ('PASSWORD', 'OAUTH');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('TODO', 'DONE', 'IGNORED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),
    "email_provider" "EmailProvider",
    "last_email_sync" TIMESTAMP(3),
    "microsoft_delta_link" TEXT,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "last_notification_sent" TIMESTAMP(3),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "sourceSentence" TEXT NOT NULL,
    "emailFrom" TEXT NOT NULL,
    "emailReceivedAt" TIMESTAMP(3) NOT NULL,
    "gmail_message_id" TEXT,
    "imap_uid" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_metadata" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email_provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "gmail_message_id" TEXT,
    "gmail_thread_id" TEXT,
    "imap_uid" BIGINT,
    "imap_message_id" TEXT,
    "from" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "EmailStatus" NOT NULL DEFAULT 'EXTRACTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imap_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL DEFAULT 993,
    "imap_username" TEXT NOT NULL,
    "imap_password" TEXT,
    "auth_method" "IMAPAuthMethod" NOT NULL DEFAULT 'PASSWORD',
    "imap_folder" TEXT NOT NULL DEFAULT 'INBOX',
    "use_tls" BOOLEAN NOT NULL DEFAULT true,
    "last_imap_sync" TIMESTAMP(3),
    "last_uid" BIGINT,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "connection_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imap_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "actions_userId_idx" ON "actions"("userId");

-- CreateIndex
CREATE INDEX "actions_status_idx" ON "actions"("status");

-- CreateIndex
CREATE INDEX "actions_type_idx" ON "actions"("type");

-- CreateIndex
CREATE INDEX "actions_dueDate_idx" ON "actions"("dueDate");

-- CreateIndex
CREATE INDEX "email_metadata_userId_idx" ON "email_metadata"("userId");

-- CreateIndex
CREATE INDEX "email_metadata_gmail_message_id_idx" ON "email_metadata"("gmail_message_id");

-- CreateIndex
CREATE INDEX "email_metadata_imap_uid_idx" ON "email_metadata"("imap_uid");

-- CreateIndex
CREATE INDEX "email_metadata_received_at_idx" ON "email_metadata"("received_at");

-- CreateIndex
CREATE INDEX "email_metadata_status_idx" ON "email_metadata"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_metadata_userId_gmail_message_id_key" ON "email_metadata"("userId", "gmail_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_metadata_userId_imap_uid_key" ON "email_metadata"("userId", "imap_uid");

-- CreateIndex
CREATE INDEX "imap_credentials_userId_idx" ON "imap_credentials"("userId");

-- CreateIndex
CREATE INDEX "imap_credentials_is_connected_idx" ON "imap_credentials"("is_connected");

-- CreateIndex
CREATE UNIQUE INDEX "imap_credentials_userId_imap_host_imap_username_key" ON "imap_credentials"("userId", "imap_host", "imap_username");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imap_credentials" ADD CONSTRAINT "imap_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

