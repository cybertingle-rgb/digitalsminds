-- Owner's instruction (2026-11-08): the eBay course fee is Rs 1,500, in PKR (replaces Rs 3,500).
-- Fees are stored in paisa. Applications already made keep the fee they were given.
UPDATE `Course`
SET `accessType` = 'PAID', `priceAmount` = 150000, `currency` = 'PKR', `priceNeedsReview` = false
WHERE `slug` LIKE '%ebay%' OR `title` LIKE '%eBay%';
