CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`shipment_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`type` text NOT NULL,
	`place` text NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'Agence' NOT NULL,
	`planned` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`author` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`ref` text NOT NULL,
	`client` text NOT NULL,
	`contact` text NOT NULL,
	`item` text NOT NULL,
	`category` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`container` text DEFAULT '' NOT NULL,
	`eta` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Enregistré' NOT NULL,
	`token_hash` text DEFAULT '' NOT NULL,
	`token_expiry` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_ref_unique` ON `shipments` (`ref`);