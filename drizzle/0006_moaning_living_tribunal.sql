CREATE TABLE `work_bookmark` (
	`work_slug` text NOT NULL,
	`client_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`work_slug`, `client_id`),
	FOREIGN KEY (`work_slug`) REFERENCES `work`(`slug`) ON UPDATE cascade ON DELETE cascade
);
