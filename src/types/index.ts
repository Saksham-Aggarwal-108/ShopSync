export type FulfilmentType = 'pickup' | 'delivery';

// Phase 2 Specified Order Statuses
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Ready'
  | 'Fulfilled'
  | 'Cancelled'
  // Legacy / DB compatibility aliases
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'RESCHEDULED';

// Phase 2 Specified Enquiry Statuses
export type EnquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Resolved'
  // Legacy / DB compatibility aliases
  | 'NEW'
  | 'IN_PROGRESS'
  | 'REPLIED'
  | 'CONVERTED'
  | 'ARCHIVED';

export type NotificationStatus = 'DELIVERED' | 'QUEUED' | 'FAILED' | 'SIMULATED' | 'PENDING';

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  price: number;
  packaging: string;
  imageUrl: string;
  isActive: boolean;
  quantityOnHand: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  trackStock: boolean;
  lastVerifiedAt: string;
  origin?: string;
  ingredients?: string;
  storageInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productTitle: string;
  packaging: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfilmentType: FulfilmentType;
  deliveryAddress?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledSlot: string; // e.g. "Morning (09:00 - 12:00)"
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  customerNotes?: string;
  adminNotes?: string;
  cancellationReason?: string;
  reservationExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enquiry {
  id: string;
  enquiryNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productId?: string;
  productTitle?: string;
  message: string;
  status: EnquiryStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  businessHours: string;
  dailyCapacity: number;
  isStoreOpen: boolean;
  ordersPaused: boolean; // Pause new orders while keeping browsing & enquiries open
  noticeBanner: string;
  currencySymbol: string;
  timeSlots: string[];
  reservationTtlMinutes?: number;
}

export interface NotificationLog {
  id: string;
  entityType: 'ORDER' | 'ENQUIRY';
  entityId: string;
  recipient: string;
  subject: string;
  channel: 'EMAIL';
  status: NotificationStatus;
  attempts: number;
  errorMessage?: string;
  timestamp: string;
}

export interface AppDatabase {
  settings: ShopSettings;
  products: Product[];
  orders: Order[];
  enquiries: Enquiry[];
  notificationLogs: NotificationLog[];
}
