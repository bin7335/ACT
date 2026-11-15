ALTER TABLE `work` ADD `purpose` text DEFAULT 'class' NOT NULL;--> statement-breakpoint
UPDATE `work` SET `type` = 'web-app' WHERE `type` = 'web-tool';--> statement-breakpoint
UPDATE `work` SET `purpose` = 'work' WHERE `audience` LIKE '%교사 업무%';--> statement-breakpoint
UPDATE `work` SET `audience` = (SELECT json_group_array(value) FROM json_each(`work`.`audience`) WHERE value <> '교사 업무') WHERE `audience` LIKE '%교사 업무%';
