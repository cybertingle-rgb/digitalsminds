-- AlterTable
ALTER TABLE `Batch` ADD COLUMN `attendanceEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timeZone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi';

-- AlterTable
ALTER TABLE `Course` ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `originalCurrency` CHAR(3) NULL,
    ADD COLUMN `originalPriceAmount` INTEGER NULL,
    ADD COLUMN `priceConversionRate` DECIMAL(24, 10) NULL,
    ADD COLUMN `priceConvertedAt` DATETIME(3) NULL,
    ADD COLUMN `priceNeedsReview` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `priceSource` VARCHAR(200) NULL;

-- AlterTable
ALTER TABLE `EnrollmentApplication` ADD COLUMN `displayAmount` INTEGER NULL,
    ADD COLUMN `displayCurrency` CHAR(3) NULL,
    ADD COLUMN `displayProvider` VARCHAR(100) NULL,
    ADD COLUMN `displayRate` DECIMAL(24, 12) NULL,
    ADD COLUMN `displayRateAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `sentAmount` INTEGER NULL,
    ADD COLUMN `sentCurrency` CHAR(3) NULL;

-- CreateTable
CREATE TABLE `ProgramCategory` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `titleUr` VARCHAR(160) NULL,
    `summary` VARCHAR(500) NULL,
    `summaryUr` VARCHAR(500) NULL,
    `notice` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProgramCategory_slug_key`(`slug`),
    INDEX `ProgramCategory_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(160) NOT NULL,
    `shortTitle` VARCHAR(80) NULL,
    `summary` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `offerings` JSON NULL,
    `idealFor` JSON NULL,
    `notice` TEXT NULL,
    `categoryId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `seoTitle` VARCHAR(200) NULL,
    `seoDescription` VARCHAR(320) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Service_slug_key`(`slug`),
    INDEX `Service_status_sortOrder_idx`(`status`, `sortOrder`),
    INDEX `Service_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurrencyRate` (
    `currency` CHAR(3) NOT NULL,
    `perPkr` DECIMAL(24, 12) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `sourceUpdatedAt` DATETIME(3) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`currency`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `liveClassId` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED') NOT NULL,
    `note` VARCHAR(300) NULL,
    `markedById` VARCHAR(64) NULL,
    `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attendance_enrollmentId_idx`(`enrollmentId`),
    UNIQUE INDEX `Attendance_liveClassId_enrollmentId_key`(`liveClassId`, `enrollmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Course_categoryId_idx` ON `Course`(`categoryId`);

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProgramCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProgramCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_liveClassId_fkey` FOREIGN KEY (`liveClassId`) REFERENCES `LiveClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Data (additive, nothing deleted) ------------------------------------------------

-- PKR is the base currency. A price stored in any other (or no) currency keeps its
-- original amount and is flagged for a Super Admin to convert or confirm; it is not guessed.
UPDATE `Course`
SET `originalPriceAmount` = `priceAmount`, `originalCurrency` = `currency`, `priceNeedsReview` = true
WHERE `priceAmount` IS NOT NULL AND (`currency` IS NULL OR `currency` <> 'PKR');

-- Starting categories (editable in Admin -> Programs -> Categories).
INSERT IGNORE INTO `ProgramCategory` (`id`, `slug`, `title`, `summary`, `notice`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
('cat_marketplaces', 'ecommerce-marketplaces', 'E-commerce Marketplace Training',
 'Amazon, eBay, Walmart Marketplace, TikTok Shop and Shopify: product research, sourcing, profitability, listings, pricing, orders, customer service and account health.',
 'Marketplace eligibility, account availability and seller approval depend on each platform''s current policies, country restrictions, verification requirements and your business circumstances. Training does not guarantee that a marketplace will approve, keep open or reinstate an account.',
 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('cat_brand_launch', 'international-brand-launching', 'International Brand Launching',
 'From idea validation and market selection to suppliers, samples, packaging, landed cost, logistics, your store and the first customers.',
 'Results depend on your product, market, budget and execution. We do not guarantee sales, supplier performance, delivery times or marketplace approval.',
 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('cat_llc_readiness', 'llc-marketplace-readiness', 'LLC Registration & Marketplace Readiness',
 'Guidance and administrative support for forming an LLC, preparing documents and getting ready for seller-account and payment-provider applications.',
 'We provide educational guidance and administrative support. Legal, tax and accounting advice is given only by appropriately qualified professionals. Company registration, banking, payment-provider and marketplace approval are decided by the relevant authorities and companies and cannot be guaranteed.',
 30, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('cat_reinstatement', 'account-reinstatement', 'Suspended Account Reinstatement',
 'Case assessment, policy and account-health review, root-cause analysis, corrective-action plans and appeal preparation for supported marketplaces.',
 'Reinstatement decisions belong to the marketplace and cannot be guaranteed. We will never ask for your account password or verification codes.',
 40, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('cat_marketing', 'digital-marketing-business-skills', 'Digital Marketing & Business Skills',
 'Meta and Google Ads, SEO, social media, content, funnels, email marketing, analytics, freelancing and sales.',
 NULL, 50, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('cat_ai', 'ai-automation', 'AI & Automation',
 'Practical AI workflows, AI-assisted content, no-code automation, AI assistants, support automation, CRM and e-commerce process automation.',
 NULL, 60, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- The existing eBay program belongs to marketplace training.
UPDATE `Course` SET `categoryId` = 'cat_marketplaces'
WHERE `categoryId` IS NULL AND (`slug` LIKE '%ebay%' OR `title` LIKE '%eBay%');
