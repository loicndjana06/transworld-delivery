CREATE TABLE `company_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_corrections_invoice_id_unique` ON `invoice_corrections` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `shipment_details` (
	`shipment_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_details` (
	`document_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_history` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`before` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admin_models` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_owner_kind_name` ON `admin_models` (`owner`,`kind`,`name`);--> statement-breakpoint
ALTER TABLE `events` ADD `published_at` text DEFAULT '' NOT NULL;