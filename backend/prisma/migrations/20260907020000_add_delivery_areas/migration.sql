-- AlterTable
ALTER TABLE `Customers` ADD COLUMN `area` VARCHAR(150) NULL;

-- CreateIndex
CREATE INDEX `Customers_area_idx` ON `Customers`(`area`);

-- CreateTable
CREATE TABLE `Delivery_Areas` (
    `area_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Delivery_Areas_name_key`(`name`),
    PRIMARY KEY (`area_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;