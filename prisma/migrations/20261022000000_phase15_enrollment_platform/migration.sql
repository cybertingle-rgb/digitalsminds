-- AlterTable
ALTER TABLE `Announcement` ADD COLUMN `batchId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Course` ADD COLUMN `durationText` VARCHAR(160) NULL,
    ADD COLUMN `format` ENUM('ONLINE_LIVE', 'IN_PERSON', 'HYBRID') NOT NULL DEFAULT 'ONLINE_LIVE';

-- AlterTable
ALTER TABLE `Enrollment` ADD COLUMN `batchId` VARCHAR(191) NULL,
    ADD COLUMN `stage` ENUM('APPLICATION_RECEIVED', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ENROLLMENT_CONFIRMED', 'ONBOARDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'REJECTED', 'CANCELLED') NULL,
    ADD COLUMN `stageAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `LiveClass` ADD COLUMN `batchId` VARCHAR(191) NULL,
    ADD COLUMN `kind` ENUM('CLASS', 'HOLIDAY', 'EVENT') NOT NULL DEFAULT 'CLASS',
    MODIFY `meetingUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('ENROLLMENT_APPROVED', 'ENROLLMENT_REJECTED', 'ENROLLMENT_REVOKED', 'ANNOUNCEMENT', 'ENROLLMENT_UPDATE', 'SCHEDULE', 'SUPPORT_REPLY', 'CERTIFICATE_ISSUED', 'SYSTEM') NOT NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `amountReceived` INTEGER NULL,
    ADD COLUMN `applicationId` VARCHAR(191) NULL,
    ADD COLUMN `verifiedKey` VARCHAR(120) NULL,
    MODIFY `userId` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `Batch` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `scheduleText` VARCHAR(300) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `applicationDeadline` DATE NULL,
    `meetingUrl` VARCHAR(500) NULL,
    `joiningInfo` TEXT NULL,
    `internalNotes` TEXT NULL,
    `coordinatorId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Batch_code_key`(`code`),
    INDEX `Batch_courseId_status_startDate_idx`(`courseId`, `status`, `startDate`),
    INDEX `Batch_status_startDate_idx`(`status`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnrollmentApplication` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `cnic` VARCHAR(15) NOT NULL,
    `cvKey` VARCHAR(500) NULL,
    `cvMime` VARCHAR(127) NULL,
    `cvSize` INTEGER NULL,
    `cvName` VARCHAR(255) NULL,
    `message` VARCHAR(1000) NULL,
    `feeAmount` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `stage` ENUM('APPLICATION_RECEIVED', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ENROLLMENT_CONFIRMED', 'ONBOARDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'APPLICATION_RECEIVED',
    `tokenHash` CHAR(64) NOT NULL,
    `emailConfirmedAt` DATETIME(3) NULL,
    `termsAcceptedAt` DATETIME(3) NOT NULL,
    `openKey` VARCHAR(300) NULL,
    `userId` VARCHAR(64) NULL,
    `enrollmentId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(64) NULL,
    `decisionNote` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EnrollmentApplication_reference_key`(`reference`),
    UNIQUE INDEX `EnrollmentApplication_tokenHash_key`(`tokenHash`),
    UNIQUE INDEX `EnrollmentApplication_openKey_key`(`openKey`),
    UNIQUE INDEX `EnrollmentApplication_enrollmentId_key`(`enrollmentId`),
    INDEX `EnrollmentApplication_stage_createdAt_idx`(`stage`, `createdAt`),
    INDEX `EnrollmentApplication_batchId_stage_idx`(`batchId`, `stage`),
    INDEX `EnrollmentApplication_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnrollmentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NULL,
    `enrollmentId` VARCHAR(191) NULL,
    `stage` ENUM('APPLICATION_RECEIVED', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ENROLLMENT_CONFIRMED', 'ONBOARDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'REJECTED', 'CANCELLED') NOT NULL,
    `note` VARCHAR(1000) NULL,
    `actorId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EnrollmentEvent_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    INDEX `EnrollmentEvent_enrollmentId_createdAt_idx`(`enrollmentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnboardingItem` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `studentCompletes` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OnboardingItem_courseId_position_idx`(`courseId`, `position`),
    INDEX `OnboardingItem_batchId_position_idx`(`batchId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnboardingProgress` (
    `enrollmentId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedById` VARCHAR(64) NULL,

    INDEX `OnboardingProgress_itemId_idx`(`itemId`),
    PRIMARY KEY (`enrollmentId`, `itemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentDocument` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `courseId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(127) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `uploadedById` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentDocument_storageKey_key`(`storageKey`),
    INDEX `StudentDocument_courseId_published_idx`(`courseId`, `published`),
    INDEX `StudentDocument_batchId_published_idx`(`batchId`, `published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Announcement_batchId_publishedAt_idx` ON `Announcement`(`batchId`, `publishedAt`);

-- CreateIndex
CREATE INDEX `Enrollment_batchId_stage_idx` ON `Enrollment`(`batchId`, `stage`);

-- CreateIndex
CREATE INDEX `LiveClass_batchId_startsAt_idx` ON `LiveClass`(`batchId`, `startsAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Payment_verifiedKey_key` ON `Payment`(`verifiedKey`);

-- CreateIndex
CREATE INDEX `Payment_applicationId_idx` ON `Payment`(`applicationId`);

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `EnrollmentApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveClass` ADD CONSTRAINT `LiveClass_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_coordinatorId_fkey` FOREIGN KEY (`coordinatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentApplication` ADD CONSTRAINT `EnrollmentApplication_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentApplication` ADD CONSTRAINT `EnrollmentApplication_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentApplication` ADD CONSTRAINT `EnrollmentApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentApplication` ADD CONSTRAINT `EnrollmentApplication_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentApplication` ADD CONSTRAINT `EnrollmentApplication_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentEvent` ADD CONSTRAINT `EnrollmentEvent_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `EnrollmentApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentEvent` ADD CONSTRAINT `EnrollmentEvent_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentEvent` ADD CONSTRAINT `EnrollmentEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingItem` ADD CONSTRAINT `OnboardingItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingItem` ADD CONSTRAINT `OnboardingItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingProgress` ADD CONSTRAINT `OnboardingProgress_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingProgress` ADD CONSTRAINT `OnboardingProgress_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `OnboardingItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingProgress` ADD CONSTRAINT `OnboardingProgress_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentDocument` ADD CONSTRAINT `StudentDocument_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentDocument` ADD CONSTRAINT `StudentDocument_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentDocument` ADD CONSTRAINT `StudentDocument_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

