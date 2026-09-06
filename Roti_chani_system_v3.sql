-- Roti_chani_system - نسخة v3 (تصميم البيزنس الكامل)
-- تشمل:
-- 1. العملاء + الطلبات (Customers, Orders, Order_Items)
-- 2. المنتجات (Products) - 4 منتجات
-- 3. عمليات الدفع لكل طلب - الحالة والنوع (Payments)
-- 4. الاستلام من الشركة/المورد - الكمية والتاريخ والنوع (Stock_Receipts)

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

--
-- Table structure for table `Customers`
--

CREATE TABLE `Customers` (
  `customer_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `gps_link` varchar(500) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Products`
-- (المنتجات الأربعة بتاعة البيزنس)
--

CREATE TABLE `Products` (
  `product_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(150) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `product_name` (`product_name`),
  CONSTRAINT `chk_stock_quantity` CHECK (`stock_quantity` >= 0),
  CONSTRAINT `chk_unit_price_products` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Orders`
-- (كل عميل له طلب فيه عدد معين من المنتجات)
--

CREATE TABLE `Orders` (
  `order_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `order_date` datetime DEFAULT current_timestamp(),
  `status` enum('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`order_id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_order_status` (`status`),
  KEY `idx_order_date` (`order_date`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `Customers` (`customer_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Order_Items`
-- (تفاصيل: أي منتجات وبأي كمية في كل طلب)
--

CREATE TABLE `Order_Items` (
  `order_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED,
  PRIMARY KEY (`order_item_id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `fk_orderitems_order` FOREIGN KEY (`order_id`)
    REFERENCES `Orders` (`order_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_orderitems_product` FOREIGN KEY (`product_id`)
    REFERENCES `Products` (`product_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_quantity_positive` CHECK (`quantity` > 0),
  CONSTRAINT `chk_unit_price_orderitems` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Payments`
-- (عمليات الدفع لكل طلب: الحالة والنوع)
--

CREATE TABLE `Payments` (
  `payment_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `payment_type` enum('cash','bank_transfer','card','online') NOT NULL,
  `payment_date` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  KEY `order_id` (`order_id`),
  KEY `idx_payment_status` (`payment_status`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`)
    REFERENCES `Orders` (`order_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_amount_positive` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Stock_Receipts`
-- (الاستلام من الشركة/المورد: الكمية - التاريخ - النوع (نوع المنتج عبر product_id))
--

CREATE TABLE `Stock_Receipts` (
  `receipt_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `receipt_date` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`receipt_id`),
  KEY `product_id` (`product_id`),
  KEY `idx_receipt_date` (`receipt_date`),
  CONSTRAINT `fk_receipts_product` FOREIGN KEY (`product_id`)
    REFERENCES `Products` (`product_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_receipt_quantity_positive` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

-- --------------------------------------------------------

--
-- Trigger: تحديث stock_quantity في Products تلقائياً عند إضافة استلام جديد
--

DELIMITER $$

CREATE TRIGGER `trg_stock_receipt_after_insert`
AFTER INSERT ON `Stock_Receipts`
FOR EACH ROW
BEGIN
  UPDATE `Products`
  SET `stock_quantity` = `stock_quantity` + NEW.`quantity`
  WHERE `product_id` = NEW.`product_id`;
END$$

DELIMITER ;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
