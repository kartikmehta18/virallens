-- AlterTable
ALTER TABLE `Post` ADD COLUMN `memeScore` DOUBLE NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Post_memeScore_idx` ON `Post`(`memeScore`);

