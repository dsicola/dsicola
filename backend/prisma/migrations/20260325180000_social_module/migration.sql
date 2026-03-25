-- CreateEnum
CREATE TYPE "SocialPostReactionType" AS ENUM ('LIKE', 'LOVE', 'EDUCATIONAL');

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "reaction_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_reactions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "SocialPostReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_views" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_user_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_user_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_posts_instituicao_id_created_at_idx" ON "social_posts"("instituicao_id", "created_at");

-- CreateIndex
CREATE INDEX "social_posts_is_public_idx" ON "social_posts"("is_public");

-- CreateIndex
CREATE INDEX "social_comments_post_id_idx" ON "social_comments"("post_id");

-- CreateIndex
CREATE INDEX "social_post_reactions_post_id_idx" ON "social_post_reactions"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_post_reactions_post_id_user_id_key" ON "social_post_reactions"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "social_post_views_post_id_idx" ON "social_post_views"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_post_views_post_id_user_id_key" ON "social_post_views"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "social_user_follows_following_id_idx" ON "social_user_follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_user_follows_follower_id_following_id_key" ON "social_user_follows"("follower_id", "following_id");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_reactions" ADD CONSTRAINT "social_post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_reactions" ADD CONSTRAINT "social_post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_views" ADD CONSTRAINT "social_post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_views" ADD CONSTRAINT "social_post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_user_follows" ADD CONSTRAINT "social_user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_user_follows" ADD CONSTRAINT "social_user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
