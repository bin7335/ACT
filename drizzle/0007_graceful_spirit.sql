CREATE TABLE `project_post` (
	`id` text PRIMARY KEY NOT NULL,
	`project_slug` text NOT NULL,
	`author_id` text,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_slug`) REFERENCES `project`(`slug`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_post_project_idx` ON `project_post` (`project_slug`,`created_at`);--> statement-breakpoint
ALTER TABLE `member` ADD `is_research` integer DEFAULT false NOT NULL;