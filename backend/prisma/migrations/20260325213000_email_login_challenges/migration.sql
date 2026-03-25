-- Login na Social: códigos de verificação por email (hash + expiração)
CREATE TABLE "email_login_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_login_challenges_user_id_idx" ON "email_login_challenges"("user_id");

ALTER TABLE "email_login_challenges" ADD CONSTRAINT "email_login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
