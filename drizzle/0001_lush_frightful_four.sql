CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`number` text NOT NULL,
	`reason` text NOT NULL,
	`stage` text NOT NULL,
	`provider` text NOT NULL,
	`signer` text NOT NULL,
	`base_xaf` real NOT NULL,
	`usd_rate` real NOT NULL,
	`gnf_rate` real NOT NULL,
	`rate_source` text NOT NULL,
	`usd` real NOT NULL,
	`gnf` real NOT NULL,
	`status` text DEFAULT 'a_regler' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`shipment_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	`email_status` text DEFAULT 'non_configure' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `events` ADD `lat` real;--> statement-breakpoint
ALTER TABLE `events` ADD `lng` real;--> statement-breakpoint
ALTER TABLE `events` ADD `mode` text DEFAULT 'Maritime' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `delivery` text DEFAULT '' NOT NULL;