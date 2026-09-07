export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentType = "cash" | "bank_transfer" | "card" | "online";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type UserRole = "admin" | "employee";

export interface Customer {
  customerId: number;
  fullName: string;
  phone: string;
  gpsLink?: string | null;
  address?: string | null;
}

export interface CustomerProfile extends Customer {
  orders: Order[];
  outstandingBalance: string;
}

export interface Product {
  productId: number;
  productName: string;
  unitPrice: string;
  stockQuantity: number;
  imageUrl?: string;
}

export interface OrderItem {
  orderItemId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  productName: string;
  product?: Product;
}

export interface Payment {
  paymentId: number;
  orderId: number;
  amount: string;
  paymentStatus: PaymentStatus;
  paymentType: PaymentType;
}

export interface Order {
  orderId: number;
  customerId: number;
  customer?: Customer;
  status: OrderStatus;
  notes?: string | null;
  orderDate: string;
  expectedDeliveryAt?: string | null;
  statusUpdatedAt: string;
  items: OrderItem[];
  payments: Payment[];
  total: string;
  paid: string;
  balance: string;
}

export interface StockReceipt {
  receiptId: number;
  productId: number;
  quantity: number;
  notes?: string | null;
  receiptDate: string;
  product?: Product;
}

export interface CustomerBalance {
  customerId: number;
  fullName: string;
  phone: string;
  total: string;
  paid: string;
  balance: string;
}

export interface BestSeller {
  productId: number;
  productName: string;
  quantitySold: number;
  imageUrl?: string;
}

export interface TodaySales {
  total: string;
  count: number;
}

export interface DashboardStats {
  totalOrders: number;
  statusCounts: Record<string, number>;
  openOrders: number;
  revenue: string;
  outstanding: string;
  todaySales: TodaySales;
  lowStock: { productId: number; productName: string; imageUrl?: string; stockQuantity: number }[];
}

export interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SearchResult {
  customers: Customer[];
  products: Product[];
  orders: { orderId: number; customerName: string; status: string; orderDate: string }[];
}
