-- Migration: admin_powerup
-- Soft-delete columns, productName snapshot on Order_Items, ActivityLog table

-- 1. Add deletedAt to Customers
ALTER TABLE `Customers` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `created_at`;

-- 2. Add deletedAt to Products
ALTER TABLE `Products` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `created_at`;

-- 3. Add deletedAt to Orders
ALTER TABLE `Orders` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `updated_at`;

-- 4. Add productName snapshot + deletedAt to Order_Items
ALTER TABLE `Order_Items` ADD COLUMN `product_name` VARCHAR(150) NOT NULL AFTER `unit_price`;
UPDATE `Order_Items` oi
JOIN `Products` p ON oi.`product_id` = p.`product_id`
SET oi.`product_name` = p.`product_name`;
ALTER TABLE `Order_Items` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `product_name`;

-- 5. Add deletedAt to Payments
ALTER TABLE `Payments` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `notes`;

-- 6. Add deletedAt to Stock_Receipts
ALTER TABLE `Stock_Receipts` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `notes`;

-- 7. Add deletedAt to Users
ALTER TABLE `Users` ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `updated_at`;

-- 8. Create Activity_Logs table
CREATE TABLE `Activity_Logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `metadata` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `idx_entity` (`entity_type`, `entity_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;