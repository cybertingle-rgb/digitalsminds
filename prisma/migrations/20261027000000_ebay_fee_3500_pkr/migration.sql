-- Owner's instruction (2026-10-27): the eBay course fee is Rs 3,500, in PKR.
-- Fees are stored in paisa. Applications already made keep the fee they were given.
UPDATE `Course`
SET `accessType` = 'PAID', `priceAmount` = 350000, `currency` = 'PKR', `priceNeedsReview` = false
WHERE `slug` LIKE '%ebay%' OR `title` LIKE '%eBay%';
