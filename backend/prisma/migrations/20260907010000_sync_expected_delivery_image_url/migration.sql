-- AlterTable
ALTER TABLE `Orders` ADD COLUMN `expected_delivery_at` TIMESTAMP(0) NULL,
    ADD COLUMN `status_updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `Products` ADD COLUMN `image_url` VARCHAR(500) NOT NULL DEFAULT '';

-- RenameIndex
ALTER TABLE `Activity_Logs` RENAME INDEX `idx_created` TO `Activity_Logs_created_at_idx`;

-- RenameIndex
ALTER TABLE `Activity_Logs` RENAME INDEX `idx_entity` TO `Activity_Logs_entity_type_entity_id_idx`;