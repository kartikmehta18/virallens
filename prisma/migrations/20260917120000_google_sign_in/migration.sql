-- AlterTable
ALTER TABLE `User` ADD COLUMN `avatarUrl` TEXT NULL,
    ADD COLUMN `googleId` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);
