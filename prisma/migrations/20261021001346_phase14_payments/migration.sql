-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `method` ENUM('BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA') NOT NULL,
    `reference` VARCHAR(100) NOT NULL,
    `payerName` VARCHAR(120) NULL,
    `paidOn` DATE NULL,
    `note` VARCHAR(1000) NULL,
    `receiptKey` VARCHAR(500) NULL,
    `receiptMime` VARCHAR(127) NULL,
    `receiptSize` INTEGER NULL,
    `receiptName` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(64) NULL,
    `decisionNote` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Payment_userId_courseId_idx`(`userId`, `courseId`),
    INDEX `Payment_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
