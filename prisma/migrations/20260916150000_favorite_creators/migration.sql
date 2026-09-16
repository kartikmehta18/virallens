-- CreateTable
CREATE TABLE `FavoriteCreator` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `handle` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `avatarUrl` TEXT NULL,
    `lastFetchedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FavoriteCreator_userId_idx`(`userId`),
    UNIQUE INDEX `FavoriteCreator_userId_platform_handle_key`(`userId`, `platform`, `handle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Post_platform_authorHandle_idx` ON `Post`(`platform`, `authorHandle`);

-- AddForeignKey
ALTER TABLE `FavoriteCreator` ADD CONSTRAINT `FavoriteCreator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
