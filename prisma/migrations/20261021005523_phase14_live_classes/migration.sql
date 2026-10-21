-- CreateTable
CREATE TABLE `LiveClass` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `meetingUrl` VARCHAR(500) NOT NULL,
    `status` ENUM('SCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdById` VARCHAR(64) NULL,
    `reminderDaySentAt` DATETIME(3) NULL,
    `reminderHourSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LiveClass_courseId_startsAt_idx`(`courseId`, `startsAt`),
    INDEX `LiveClass_status_startsAt_idx`(`status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LiveClass` ADD CONSTRAINT `LiveClass_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveClass` ADD CONSTRAINT `LiveClass_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
