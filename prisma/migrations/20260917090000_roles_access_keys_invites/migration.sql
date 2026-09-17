-- AlterTable
ALTER TABLE `User` ADD COLUMN `accessKeyCipher` TEXT NULL,
    ADD COLUMN `accessKeyCreatedAt` DATETIME(3) NULL,
    ADD COLUMN `accessKeyHash` VARCHAR(64) NULL,
    ADD COLUMN `disabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `invitedById` VARCHAR(191) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    MODIFY `email` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Invite` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `tokenCipher` TEXT NOT NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'user',
    `createdById` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `usedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invite_tokenHash_key`(`tokenHash`),
    INDEX `Invite_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_accessKeyHash_key` ON `User`(`accessKeyHash`);

-- AddForeignKey
ALTER TABLE `Invite` ADD CONSTRAINT `Invite_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
