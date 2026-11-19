export type PaymentMethod = 
  | 'MTN_MOMO'
  | 'MOOV_MONEY'
  | 'CELTIIS_CASH'
  | 'CASH_ON_DELIVERY'
  | 'CARTE_BANCAIRE';

export type OrderStatus = 
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PARTIAL'
  | 'PAID'
  | 'REFUNDED';

export type ProductCategory = 
  | 'Mode & Wax'
  | 'Cosmétique Bio'
  | 'Alimentation Locale'
  | 'Artisanat & Déco'
  | 'High-Tech & Accessoires';

export interface ProductVariant {
  name: string; // ex: Taille L, Couleur Indigo
  stock: number;
}

export type ImageVerificationVerdict = 'AUTHENTIC' | 'SUSPICIOUS' | 'AI_GENERATED';

export interface ProductImageVerification {
  verdict: ImageVerificationVerdict;
  aiProbability: number;
  scamRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  checkedAt: string;
}

export interface ImageDetectionIndicator {
  label: string;
  severity: 'ok' | 'warning' | 'danger';
  detail: string;
}

export interface ImageDetectionResult {
  verdict: ImageVerificationVerdict;
  aiProbability: number;
  scamRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedType: string;
  summary: string;
  indicators: ImageDetectionIndicator[];
  recommendations: string[];
  context: 'product_photo' | 'payment_proof' | 'general';
  analyzedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sku: string;
  barcode?: string;    // Code-barres EAN-13 / Code 128
  buyPrice: number;    // Prix d'achat en FCFA
  sellPrice: number;   // Prix de vente en FCFA
  stock: number;
  minStockAlert: number;
  description: string;
  image: string;
  isOnline: boolean;
  totalSold: number;
  unit: string;        // 'pièce', 'yard', 'sac', 'pot', 'kg'
  variants?: ProductVariant[];
  imageVerification?: ProductImageVerification;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  variant?: string;
  image?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryCity: string;
  deliveryAddress: string;
  items: OrderItem[];
  subtotal: number;
  taxRate?: number;
  taxLabel?: string;
  taxAmount?: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  paymentReference?: string;
  paymentConfirmedAt?: string;
  status: OrderStatus;
  date: string;
  channel: 'STORE_FRONT' | 'POS' | 'WHATSAPP';
  notes?: string;
}

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'CONVERTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryCity: string;
  deliveryAddress: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  status: QuoteStatus;
  validUntil: string;
  createdAt: string;
  notes?: string;
  convertedOrderId?: string;
  convertedOrderNumber?: string;
  preferredPaymentMethod: PaymentMethod;
}

export type CurrencyCode = 'FCFA' | 'EUR' | 'USD';

export interface MerchantProfile {
  name: string;
  storeName: string;
  storeSlug: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  ifuNumber: string; // Identifiant Fiscal Unique (Bénin)
  currency: CurrencyCode;  // 'FCFA' | 'EUR' | 'USD'
  description: string;
  logo: string;
  banner: string;
  momoNumber: string;
  moovNumber: string;
  celtiisNumber: string;
  enabledPaymentMethods?: PaymentMethod[];
  bankAccount?: string;
  momoMerchantCode?: string;
  paymentInstructions?: string;
  deliveryRates: {
    cotonou: number;
    calavi: number;
    portoNovo: number;
    interieur: number;
  };
  enableOnlineOrders: boolean;
  enableWhatsAppCheckout: boolean;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel?: string;
}

export type PayoutDestinationType = 'BANQUE' | 'MOMO_PERSO' | 'CAISSE_COFFRE';

export interface SellerPayout {
  id: string;
  amount: number;
  sourceMethod: PaymentMethod;
  destinationType: PayoutDestinationType;
  destinationAccount: string;
  reference?: string;
  notes?: string;
  date: string;
  status: 'COMPLETED' | 'PENDING';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  city: string;
  category: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  paymentMethod: 'ESPECES' | 'MTN_MOMO' | 'MOOV_MONEY' | 'VIREMENT';
  reference?: string;
  notes?: string;
  date: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  date: string;
  user: string;
  supplierId?: string;
  supplierName?: string;
  unitCost?: number;
  totalCost?: number;
  amountPaid?: number;
}

export type ViewTab = 
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'quotes'
  | 'payments'
  | 'customers'
  | 'inventory'
  | 'pos'
  | 'shop'
  | 'analytics'
  | 'anti_fraud';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city?: string;
  notes?: string;
  createdAt: string;
  lastPromoSentAt?: string;
}

export interface PromoCampaignLog {
  id: string;
  title: string;
  message: string;
  channel: 'WHATSAPP' | 'SMS';
  recipientCount: number;
  recipientNames: string[];
  sentAt: string;
}

export interface AppNotification {
  id: string;
  type: 'STOCK_CRITICAL' | 'STOCK_OUT' | 'NEW_ORDER';
  title: string;
  message: string;
  timestamp: string;
  productId?: string;
  productName?: string;
  stockRemaining?: number;
  minThreshold?: number;
  isRead: boolean;
}

export interface InvoiceOcrItem {
  detectedName: string;
  matchedProductId: string;
  quantity: number;
  unit: string;
  unitBuyPrice: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InvoiceOcrResult {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  rawConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
  items: InvoiceOcrItem[];
}

