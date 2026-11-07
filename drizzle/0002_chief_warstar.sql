ALTER TABLE `google_identity` ADD `email` text;--> statement-breakpoint
ALTER TABLE `member` ADD `is_admin` integer DEFAULT false NOT NULL;