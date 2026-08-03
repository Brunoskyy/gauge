-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'team', 'business');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "signed_up_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" VARCHAR(32) NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_signed_up_at_idx" ON "users"("signed_up_at");

-- CreateIndex
CREATE INDEX "events_ts_idx" ON "events"("ts");

-- CreateIndex
CREATE INDEX "events_name_ts_idx" ON "events"("name", "ts");

-- CreateIndex
CREATE INDEX "events_user_id_ts_idx" ON "events"("user_id", "ts");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
