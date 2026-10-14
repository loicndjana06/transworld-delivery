CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`maps_key` text DEFAULT '' NOT NULL,
	`maps_id` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_owner_unique` ON `settings` (`owner`);