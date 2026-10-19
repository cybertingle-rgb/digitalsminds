-- CreateTable
CREATE TABLE `Inquiry` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `company` VARCHAR(160) NULL,
    `service` VARCHAR(64) NOT NULL,
    `message` TEXT NOT NULL,
    `source` VARCHAR(200) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'SPAM') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Inquiry_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Inquiry_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
