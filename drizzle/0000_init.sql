CREATE TABLE `maker` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`member` integer DEFAULT true NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project` (
	`slug` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`term` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work` (
	`slug` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`thumbnail` text,
	`thumbnail_alt` text,
	`links` text DEFAULT '[]' NOT NULL,
	`audience` text DEFAULT '[]' NOT NULL,
	`subjects` text DEFAULT '[]' NOT NULL,
	`project_slug` text,
	`status` text DEFAULT 'review' NOT NULL,
	`review_note` text,
	`contact_email` text,
	`edit_token_hash` text,
	`owner_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`published_at` integer,
	`link_checked_at` integer,
	`link_broken` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_slug`) REFERENCES `project`(`slug`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `work_status_idx` ON `work` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `work_edit_token_idx` ON `work` (`edit_token_hash`);--> statement-breakpoint
CREATE TABLE `work_maker` (
	`work_slug` text NOT NULL,
	`maker_slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_slug`, `maker_slug`),
	FOREIGN KEY (`work_slug`) REFERENCES `work`(`slug`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`maker_slug`) REFERENCES `maker`(`slug`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_maker_maker_idx` ON `work_maker` (`maker_slug`);