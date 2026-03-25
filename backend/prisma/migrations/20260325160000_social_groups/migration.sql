-- CreateTable
CREATE TABLE "social_groups" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_group_members_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "social_posts" ADD COLUMN "social_group_id" TEXT;

-- CreateIndex
CREATE INDEX "social_groups_instituicao_id_idx" ON "social_groups"("instituicao_id");

-- CreateIndex
CREATE INDEX "social_group_members_user_id_idx" ON "social_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_group_members_group_id_user_id_key" ON "social_group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "social_posts_social_group_id_idx" ON "social_posts"("social_group_id");

-- AddForeignKey
ALTER TABLE "social_groups" ADD CONSTRAINT "social_groups_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_groups" ADD CONSTRAINT "social_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_group_members" ADD CONSTRAINT "social_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "social_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_group_members" ADD CONSTRAINT "social_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_social_group_id_fkey" FOREIGN KEY ("social_group_id") REFERENCES "social_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
