-- Composite index for per-customer order lookups (customer profile history,
-- GET /api/orders/last/:customerId, latest-order queries).
CREATE INDEX `Orders_customerId_orderDate_idx` ON `Orders`(`customer_id`, `order_date`);
