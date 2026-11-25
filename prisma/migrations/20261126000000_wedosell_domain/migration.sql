-- The site moved to wedosell.com (owner's instruction, 2026-11-26).
--
-- Text replacement only, in the same editable content as the rebrand migration: links and
-- addresses on digitalsminds.com become wedosell.com (e.g. info@digitalsminds.com ->
-- info@wedosell.com). Deliberately NOT changed: the email/Google integration settings (the
-- SMTP login must match the mailbox in hPanel), social media links, the lead-alert address
-- (Admin -> Inquiries), user accounts, and records of what happened (audit log, messages,
-- inquiries, certificates).

UPDATE `SiteSetting` SET `value` = REPLACE(REPLACE(`value`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE (`value` LIKE '%digitalsminds.com%') AND `key` NOT LIKE 'integration.%' AND `key` NOT IN ('site.social', 'notifications.inquiry');

UPDATE `Course` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `titleUr` = REPLACE(REPLACE(`titleUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summary` = REPLACE(REPLACE(`summary`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summaryUr` = REPLACE(REPLACE(`summaryUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `description` = REPLACE(REPLACE(`description`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `objectives` = REPLACE(REPLACE(`objectives`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `prerequisites` = REPLACE(REPLACE(`prerequisites`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `durationText` = REPLACE(REPLACE(`durationText`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoTitle` = REPLACE(REPLACE(`seoTitle`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoDescription` = REPLACE(REPLACE(`seoDescription`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `titleUr` LIKE '%digitalsminds.com%' OR `summary` LIKE '%digitalsminds.com%' OR `summaryUr` LIKE '%digitalsminds.com%' OR `description` LIKE '%digitalsminds.com%' OR `objectives` LIKE '%digitalsminds.com%' OR `prerequisites` LIKE '%digitalsminds.com%' OR `durationText` LIKE '%digitalsminds.com%' OR `seoTitle` LIKE '%digitalsminds.com%' OR `seoDescription` LIKE '%digitalsminds.com%';

UPDATE `ProgramCategory` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `titleUr` = REPLACE(REPLACE(`titleUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summary` = REPLACE(REPLACE(`summary`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summaryUr` = REPLACE(REPLACE(`summaryUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `notice` = REPLACE(REPLACE(`notice`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `titleUr` LIKE '%digitalsminds.com%' OR `summary` LIKE '%digitalsminds.com%' OR `summaryUr` LIKE '%digitalsminds.com%' OR `notice` LIKE '%digitalsminds.com%';

UPDATE `Service` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `shortTitle` = REPLACE(REPLACE(`shortTitle`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summary` = REPLACE(REPLACE(`summary`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `description` = REPLACE(REPLACE(`description`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `offerings` = REPLACE(REPLACE(`offerings`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `idealFor` = REPLACE(REPLACE(`idealFor`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `notice` = REPLACE(REPLACE(`notice`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoTitle` = REPLACE(REPLACE(`seoTitle`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoDescription` = REPLACE(REPLACE(`seoDescription`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `shortTitle` LIKE '%digitalsminds.com%' OR `summary` LIKE '%digitalsminds.com%' OR `description` LIKE '%digitalsminds.com%' OR `offerings` LIKE '%digitalsminds.com%' OR `idealFor` LIKE '%digitalsminds.com%' OR `notice` LIKE '%digitalsminds.com%' OR `seoTitle` LIKE '%digitalsminds.com%' OR `seoDescription` LIKE '%digitalsminds.com%';

UPDATE `Batch` SET `name` = REPLACE(REPLACE(`name`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `scheduleText` = REPLACE(REPLACE(`scheduleText`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `joiningInfo` = REPLACE(REPLACE(`joiningInfo`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `name` LIKE '%digitalsminds.com%' OR `scheduleText` LIKE '%digitalsminds.com%' OR `joiningInfo` LIKE '%digitalsminds.com%';

UPDATE `Faq` SET `question` = REPLACE(REPLACE(`question`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `questionUr` = REPLACE(REPLACE(`questionUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `answer` = REPLACE(REPLACE(`answer`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `answerUr` = REPLACE(REPLACE(`answerUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `question` LIKE '%digitalsminds.com%' OR `questionUr` LIKE '%digitalsminds.com%' OR `answer` LIKE '%digitalsminds.com%' OR `answerUr` LIKE '%digitalsminds.com%';

UPDATE `Post` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `excerpt` = REPLACE(REPLACE(`excerpt`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `body` = REPLACE(REPLACE(`body`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `authorName` = REPLACE(REPLACE(`authorName`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoTitle` = REPLACE(REPLACE(`seoTitle`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `seoDescription` = REPLACE(REPLACE(`seoDescription`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `excerpt` LIKE '%digitalsminds.com%' OR `body` LIKE '%digitalsminds.com%' OR `authorName` LIKE '%digitalsminds.com%' OR `seoTitle` LIKE '%digitalsminds.com%' OR `seoDescription` LIKE '%digitalsminds.com%';

UPDATE `CaseStudy` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `titleUr` = REPLACE(REPLACE(`titleUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summary` = REPLACE(REPLACE(`summary`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `summaryUr` = REPLACE(REPLACE(`summaryUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `body` = REPLACE(REPLACE(`body`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `bodyUr` = REPLACE(REPLACE(`bodyUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `titleUr` LIKE '%digitalsminds.com%' OR `summary` LIKE '%digitalsminds.com%' OR `summaryUr` LIKE '%digitalsminds.com%' OR `body` LIKE '%digitalsminds.com%' OR `bodyUr` LIKE '%digitalsminds.com%';

UPDATE `Announcement` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `body` = REPLACE(REPLACE(`body`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `body` LIKE '%digitalsminds.com%';

UPDATE `Notification` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `body` = REPLACE(REPLACE(`body`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `body` LIKE '%digitalsminds.com%';

UPDATE `OnboardingItem` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `description` = REPLACE(REPLACE(`description`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `description` LIKE '%digitalsminds.com%';

UPDATE `StudentDocument` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `description` = REPLACE(REPLACE(`description`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `description` LIKE '%digitalsminds.com%';

UPDATE `LiveClass` SET `title` = REPLACE(REPLACE(`title`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `description` = REPLACE(REPLACE(`description`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `title` LIKE '%digitalsminds.com%' OR `description` LIKE '%digitalsminds.com%';

UPDATE `MediaAsset` SET `altText` = REPLACE(REPLACE(`altText`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com'), `altTextUr` = REPLACE(REPLACE(`altTextUr`, 'www.digitalsminds.com', 'wedosell.com'), 'digitalsminds.com', 'wedosell.com')
WHERE `altText` LIKE '%digitalsminds.com%' OR `altTextUr` LIKE '%digitalsminds.com%';

-- The owner's login moves to info@wedosell.com (owner's instruction). Same account: id, role,
-- password, sessions and history are unchanged; only the address is. Skipped if another account
-- already uses info@wedosell.com (that needs a person to decide).
UPDATE `User` SET
  `googleEmail` = IF(`googleEmail` = 'info@digitalsminds.com', 'info@wedosell.com', `googleEmail`),
  `email` = 'info@wedosell.com'
WHERE `email` = 'info@digitalsminds.com' AND `role` = 'SUPER_ADMIN'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `email` FROM `User`) AS u WHERE u.`email` = 'info@wedosell.com');
