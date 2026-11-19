import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { sanitizeStoreSlug } from '../utils/storeUrl';
import {
  Customer,
  MerchantProfile,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  ProductImageVerification,
  PromoCampaignLog,
  Quote,
  SellerPayout,
  StockMovement,
  Supplier,
  SupplierPayment,
} from '../types';

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : fallback;
  return str.slice(0, maxLen);
}

function clampNonEmpty(val: unknown, maxLen: number, fallback: string): string {
  const str = typeof val === 'string' ? val.trim() : '';
  return (str || fallback).slice(0, maxLen);
}

function clampNum(val: unknown, minVal: number, maxVal: number, fallback = 0): number {
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return Math.min(maxVal, Math.max(minVal, num));
}

function sanitizeId(id: string, prefix = 'doc'): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `${prefix}-${Date.now()}`;
}

function sanitizeOrderItems(items: OrderItem[]): OrderItem[] {
  return items.slice(0, 100).map((item) => {
    const clean: OrderItem = {
      productId: clampNonEmpty(item.productId, 128, 'prod-unknown'),
      productName: clampNonEmpty(item.productName, 200, 'Article'),
      unitPrice: clampNum(item.unitPrice, 0, 100000000, 0),
      quantity: clampNum(item.quantity, 1, 100000, 1),
    };
    if (item.variant) clean.variant = clampStr(item.variant, 120);
    if (item.image) clean.image = clampStr(item.image, 300000);
    return clean;
  });
}

function toMerchantDocPayload(uid: string, profile: MerchantProfile) {
  const payload: Record<string, unknown> = {
    ownerId: uid,
    name: clampNonEmpty(profile.name, 120, 'Marchand'),
    storeName: clampNonEmpty(profile.storeName, 160, 'Ma Boutique'),
    storeSlug: clampNonEmpty(profile.storeSlug, 100, 'ma-boutique'),
    phone: clampStr(profile.phone, 40),
    whatsapp: clampStr(profile.whatsapp, 40),
    email: clampStr(profile.email, 160),
    address: clampStr(profile.address, 300),
    city: clampStr(profile.city, 100),
    ifuNumber: clampStr(profile.ifuNumber, 40),
    currency: (['FCFA', 'EUR', 'USD'].includes(profile.currency)
      ? profile.currency
      : 'FCFA') as MerchantProfile['currency'],
    description: clampStr(profile.description, 1000),
    logo: clampStr(profile.logo, 150000),
    banner: clampStr(profile.banner, 150000),
    momoNumber: clampStr(profile.momoNumber, 40),
    moovNumber: clampStr(profile.moovNumber, 40),
    celtiisNumber: clampStr(profile.celtiisNumber, 40),
    deliveryRates: {
      cotonou: clampNum(profile.deliveryRates?.cotonou, 0, 1000000, 1000),
      calavi: clampNum(profile.deliveryRates?.calavi, 0, 1000000, 1500),
      portoNovo: clampNum(profile.deliveryRates?.portoNovo, 0, 1000000, 2500),
      interieur: clampNum(profile.deliveryRates?.interieur, 0, 1000000, 3500),
    },
    enableOnlineOrders: Boolean(profile.enableOnlineOrders),
    enableWhatsAppCheckout: Boolean(profile.enableWhatsAppCheckout),
    taxEnabled: Boolean(profile.taxEnabled),
    taxRate: clampNum(profile.taxRate, 0, 100, 0),
    taxLabel: clampStr(profile.taxLabel ?? 'TVA', 60),
  };
  if (
    Array.isArray(profile.enabledPaymentMethods) &&
    profile.enabledPaymentMethods.length > 0
  ) {
    payload.enabledPaymentMethods = profile.enabledPaymentMethods.slice(0, 5);
  }
  if (profile.bankAccount !== undefined) {
    payload.bankAccount = clampStr(profile.bankAccount, 120);
  }
  if (profile.momoMerchantCode !== undefined) {
    payload.momoMerchantCode = clampStr(profile.momoMerchantCode, 60);
  }
  if (profile.paymentInstructions !== undefined) {
    payload.paymentInstructions = clampStr(profile.paymentInstructions, 500);
  }
  return payload;
}

function toPublicStoreDocPayload(uid: string, profile: MerchantProfile) {
  const cleanSlug = sanitizeStoreSlug(profile.storeSlug);
  const payload: Record<string, unknown> = {
    ownerId: uid,
    storeSlug: cleanSlug,
    name: clampNonEmpty(profile.name, 120, 'Marchand'),
    storeName: clampNonEmpty(profile.storeName, 160, 'Ma Boutique'),
    phone: clampStr(profile.phone, 40),
    whatsapp: clampStr(profile.whatsapp, 40),
    address: clampStr(profile.address, 300),
    city: clampStr(profile.city, 100),
    currency: (['FCFA', 'EUR', 'USD'].includes(profile.currency)
      ? profile.currency
      : 'FCFA') as MerchantProfile['currency'],
    description: clampStr(profile.description, 1000),
    logo: clampStr(profile.logo, 150000),
    banner: clampStr(profile.banner, 150000),
    momoNumber: clampStr(profile.momoNumber, 40),
    moovNumber: clampStr(profile.moovNumber, 40),
    celtiisNumber: clampStr(profile.celtiisNumber, 40),
    deliveryRates: {
      cotonou: clampNum(profile.deliveryRates?.cotonou, 0, 1000000, 1000),
      calavi: clampNum(profile.deliveryRates?.calavi, 0, 1000000, 1500),
      portoNovo: clampNum(profile.deliveryRates?.portoNovo, 0, 1000000, 2500),
      interieur: clampNum(profile.deliveryRates?.interieur, 0, 1000000, 3500),
    },
    enableOnlineOrders: Boolean(profile.enableOnlineOrders),
    enableWhatsAppCheckout: Boolean(profile.enableWhatsAppCheckout),
    taxEnabled: Boolean(profile.taxEnabled),
    taxRate: clampNum(profile.taxRate, 0, 100, 0),
    taxLabel: clampStr(profile.taxLabel ?? 'TVA', 60),
  };
  if (
    Array.isArray(profile.enabledPaymentMethods) &&
    profile.enabledPaymentMethods.length > 0
  ) {
    payload.enabledPaymentMethods = profile.enabledPaymentMethods.slice(0, 5);
  }
  if (profile.bankAccount !== undefined) {
    payload.bankAccount = clampStr(profile.bankAccount, 120);
  }
  if (profile.momoMerchantCode !== undefined) {
    payload.momoMerchantCode = clampStr(profile.momoMerchantCode, 60);
  }
  if (profile.paymentInstructions !== undefined) {
    payload.paymentInstructions = clampStr(profile.paymentInstructions, 500);
  }
  return payload;
}

function toPublicProductDocPayload(
  uid: string,
  storeSlug: string,
  product: Product
) {
  const id = sanitizeId(product.id, 'prod');
  const cleanSlug = sanitizeStoreSlug(storeSlug);
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    storeSlug: cleanSlug,
    name: clampNonEmpty(product.name, 200, 'Produit'),
    category: clampNonEmpty(product.category, 80, 'Mode & Wax'),
    sellPrice: clampNum(product.sellPrice, 0, 100000000, 0),
    stock: clampNum(product.stock, 0, 1000000, 0),
    description: clampStr(product.description, 1500),
    image: clampStr(product.image, 300000),
    isOnline: Boolean(product.isOnline),
    totalSold: clampNum(product.totalSold, 0, 10000000, 0),
    unit: clampNonEmpty(product.unit, 40, 'pièce'),
  };
  if (product.variants !== undefined) {
    payload.variants = product.variants.slice(0, 30).map((v) => ({
      name: clampNonEmpty(v.name, 100, 'Variante'),
      stock: clampNum(v.stock, 0, 1000000, 0),
    }));
  }
  if (product.imageVerification !== undefined) {
    payload.imageVerification = {
      verdict: product.imageVerification.verdict,
      aiProbability: clampNum(product.imageVerification.aiProbability, 0, 100, 0),
      scamRiskLevel: product.imageVerification.scamRiskLevel,
      summary: clampStr(product.imageVerification.summary, 600),
      checkedAt: clampStr(product.imageVerification.checkedAt, 60),
    };
  }
  return payload;
}

function toProductDocPayload(uid: string, product: Product) {
  const id = sanitizeId(product.id, 'prod');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    name: clampNonEmpty(product.name, 200, 'Produit'),
    category: clampNonEmpty(product.category, 80, 'Mode & Wax'),
    sku: clampNonEmpty(product.sku, 64, `SKU-${Date.now()}`),
    buyPrice: clampNum(product.buyPrice, 0, 100000000, 0),
    sellPrice: clampNum(product.sellPrice, 0, 100000000, 0),
    stock: clampNum(product.stock, 0, 1000000, 0),
    minStockAlert: clampNum(product.minStockAlert, 0, 100000, 0),
    description: clampStr(product.description, 1500),
    image: clampStr(product.image, 300000),
    isOnline: Boolean(product.isOnline),
    totalSold: clampNum(product.totalSold, 0, 10000000, 0),
    unit: clampNonEmpty(product.unit, 40, 'pièce'),
  };
  if (product.barcode !== undefined) {
    payload.barcode = clampStr(product.barcode, 64);
  }
  if (product.variants !== undefined) {
    payload.variants = product.variants.slice(0, 30).map((v) => ({
      name: clampNonEmpty(v.name, 100, 'Variante'),
      stock: clampNum(v.stock, 0, 1000000, 0),
    }));
  }
  if (product.imageVerification !== undefined) {
    payload.imageVerification = {
      verdict: product.imageVerification.verdict,
      aiProbability: clampNum(product.imageVerification.aiProbability, 0, 100, 0),
      scamRiskLevel: product.imageVerification.scamRiskLevel,
      summary: clampStr(product.imageVerification.summary, 600),
      checkedAt: clampStr(product.imageVerification.checkedAt, 60),
    };
  }
  return payload;
}

function toOrderDocPayload(uid: string, order: Order) {
  const id = sanitizeId(order.id, 'ord');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    orderNumber: clampNonEmpty(order.orderNumber, 64, `CMD-${Date.now()}`),
    customerName: clampNonEmpty(order.customerName, 160, 'Client'),
    customerPhone: clampStr(order.customerPhone, 40),
    deliveryCity: clampStr(order.deliveryCity, 120),
    deliveryAddress: clampStr(order.deliveryAddress, 300),
    items: sanitizeOrderItems(order.items),
    subtotal: clampNum(order.subtotal, 0, 1000000000, 0),
    deliveryFee: clampNum(order.deliveryFee, 0, 10000000, 0),
    totalAmount: clampNum(order.totalAmount, 0, 1000000000, 0),
    paymentMethod: order.paymentMethod,
    status: order.status,
    date: clampNonEmpty(order.date, 40, new Date().toISOString().slice(0, 16)),
    channel: order.channel,
  };
  if (order.taxRate !== undefined) {
    payload.taxRate = clampNum(order.taxRate, 0, 100, 0);
  }
  if (order.taxLabel !== undefined) {
    payload.taxLabel = clampStr(order.taxLabel, 60);
  }
  if (order.taxAmount !== undefined) {
    payload.taxAmount = clampNum(order.taxAmount, 0, 1000000000, 0);
  }
  if (order.paymentStatus !== undefined) {
    payload.paymentStatus = order.paymentStatus;
  }
  if (order.amountPaid !== undefined) {
    payload.amountPaid = clampNum(order.amountPaid, 0, 1000000000, 0);
  }
  if (order.paymentReference !== undefined) {
    payload.paymentReference = clampStr(order.paymentReference, 120);
  }
  if (order.paymentConfirmedAt !== undefined) {
    payload.paymentConfirmedAt = clampStr(order.paymentConfirmedAt, 40);
  }
  if (order.notes !== undefined) {
    payload.notes = clampStr(order.notes, 1000);
  }
  return payload;
}

function toQuoteDocPayload(uid: string, quote: Quote) {
  const id = sanitizeId(quote.id, 'quo');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    quoteNumber: clampNonEmpty(quote.quoteNumber, 64, `DEV-${Date.now()}`),
    customerName: clampNonEmpty(quote.customerName, 160, 'Client'),
    customerPhone: clampStr(quote.customerPhone, 40),
    deliveryCity: clampStr(quote.deliveryCity, 120),
    deliveryAddress: clampStr(quote.deliveryAddress, 300),
    items: sanitizeOrderItems(quote.items),
    subtotal: clampNum(quote.subtotal, 0, 1000000000, 0),
    discountAmount: clampNum(quote.discountAmount, 0, 1000000000, 0),
    taxRate: clampNum(quote.taxRate, 0, 100, 0),
    taxLabel: clampStr(quote.taxLabel || 'TVA', 60),
    taxAmount: clampNum(quote.taxAmount, 0, 1000000000, 0),
    deliveryFee: clampNum(quote.deliveryFee, 0, 10000000, 0),
    totalAmount: clampNum(quote.totalAmount, 0, 1000000000, 0),
    status: quote.status,
    validUntil: clampNonEmpty(quote.validUntil, 40, new Date().toISOString().slice(0, 10)),
    createdAtDate: clampNonEmpty(quote.createdAt, 40, new Date().toISOString().slice(0, 16)),
    preferredPaymentMethod: quote.preferredPaymentMethod,
  };
  if (quote.customerId !== undefined) {
    payload.customerId = clampStr(quote.customerId, 128);
  }
  if (quote.notes !== undefined) {
    payload.notes = clampStr(quote.notes, 1000);
  }
  if (quote.convertedOrderId !== undefined) {
    payload.convertedOrderId = sanitizeId(quote.convertedOrderId, 'ord');
  }
  if (quote.convertedOrderNumber !== undefined) {
    payload.convertedOrderNumber = clampNonEmpty(quote.convertedOrderNumber, 64, 'CMD');
  }
  return payload;
}

function toCustomerDocPayload(uid: string, customer: Customer) {
  const id = sanitizeId(customer.id, 'cust');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    name: clampNonEmpty(customer.name, 160, 'Client'),
    phone: clampStr(customer.phone, 40),
    createdAtDate: clampNonEmpty(customer.createdAt, 40, new Date().toISOString().slice(0, 10)),
  };
  if (customer.city !== undefined) payload.city = clampStr(customer.city, 120);
  if (customer.notes !== undefined) payload.notes = clampStr(customer.notes, 1000);
  if (customer.lastPromoSentAt !== undefined) {
    payload.lastPromoSentAt = clampStr(customer.lastPromoSentAt, 40);
  }
  return payload;
}

function toPromoLogDocPayload(uid: string, log: PromoCampaignLog) {
  const id = sanitizeId(log.id, 'promo');
  return {
    ownerId: uid,
    id,
    title: clampNonEmpty(log.title, 160, 'Campagne Promo'),
    message: clampNonEmpty(log.message, 2000, 'Promotion'),
    channel: log.channel,
    recipientCount: clampNum(log.recipientCount, 0, 10000, 0),
    recipientNames: log.recipientNames.slice(0, 200).map((n) => clampStr(n, 160)),
    sentAt: clampNonEmpty(log.sentAt, 40, new Date().toISOString().slice(0, 16)),
  };
}

function toStockMovementDocPayload(uid: string, mov: StockMovement) {
  const id = sanitizeId(mov.id, 'mov');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    productId: clampNonEmpty(mov.productId, 128, 'prod'),
    productName: clampNonEmpty(mov.productName, 200, 'Produit'),
    type: mov.type,
    quantity: clampNum(mov.quantity, 0, 1000000, 0),
    reason: clampStr(mov.reason, 300),
    date: clampNonEmpty(mov.date, 40, new Date().toISOString().slice(0, 16)),
    user: clampNonEmpty(mov.user, 120, 'Marchand'),
  };
  if (mov.supplierId !== undefined) payload.supplierId = clampStr(mov.supplierId, 128);
  if (mov.supplierName !== undefined) payload.supplierName = clampStr(mov.supplierName, 160);
  if (mov.unitCost !== undefined) payload.unitCost = clampNum(mov.unitCost, 0, 100000000, 0);
  if (mov.totalCost !== undefined) payload.totalCost = clampNum(mov.totalCost, 0, 1000000000, 0);
  if (mov.amountPaid !== undefined) payload.amountPaid = clampNum(mov.amountPaid, 0, 1000000000, 0);
  return payload;
}

function toSupplierDocPayload(uid: string, supplier: Supplier) {
  const id = sanitizeId(supplier.id, 'sup');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    name: clampNonEmpty(supplier.name, 160, 'Fournisseur'),
    phone: clampStr(supplier.phone, 40),
    city: clampStr(supplier.city, 120),
    category: clampStr(supplier.category, 80),
    createdAtDate: clampNonEmpty(supplier.createdAt, 40, new Date().toISOString().slice(0, 10)),
  };
  if (supplier.contactPerson !== undefined) {
    payload.contactPerson = clampStr(supplier.contactPerson, 120);
  }
  if (supplier.notes !== undefined) payload.notes = clampStr(supplier.notes, 1000);
  return payload;
}

function toSupplierPaymentDocPayload(uid: string, payment: SupplierPayment) {
  const id = sanitizeId(payment.id, 'spay');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    supplierId: sanitizeId(payment.supplierId, 'sup'),
    amount: clampNum(payment.amount, 1, 1000000000, 1),
    paymentMethod: payment.paymentMethod,
    date: clampNonEmpty(payment.date, 40, new Date().toISOString().slice(0, 16)),
  };
  if (payment.reference !== undefined) payload.reference = clampStr(payment.reference, 120);
  if (payment.notes !== undefined) payload.notes = clampStr(payment.notes, 500);
  return payload;
}

function toSellerPayoutDocPayload(uid: string, payout: SellerPayout) {
  const id = sanitizeId(payout.id, 'payout');
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id,
    amount: clampNum(payout.amount, 1, 1000000000, 1),
    sourceMethod: payout.sourceMethod,
    destinationType: payout.destinationType,
    destinationAccount: clampNonEmpty(payout.destinationAccount, 160, 'Compte Bancaire'),
    date: clampNonEmpty(payout.date, 40, new Date().toISOString().slice(0, 16)),
    status: payout.status,
  };
  if (payout.reference !== undefined) {
    payload.reference = clampStr(payout.reference, 120);
  }
  if (payout.notes !== undefined) {
    payload.notes = clampStr(payout.notes, 500);
  }
  return payload;
}

export interface WorkspaceSeedDefaults {
  merchant: MerchantProfile;
  products: Product[];
  orders: Order[];
  quotes: Quote[];
  customers: Customer[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  sellerPayouts: SellerPayout[];
  stockMovements: StockMovement[];
}

export async function ensureUserWorkspace(
  user: User,
  defaults: WorkspaceSeedDefaults
): Promise<void> {
  const uid = user.uid;
  const userRef = doc(db, 'users', uid);

  try {
    const userSnap = await getDoc(userRef);
    const email = clampNonEmpty(user.email, 200, 'marchand@boutikpro.bj');
    const displayName = clampNonEmpty(user.displayName, 120, email.split('@')[0] || 'Marchand');
    const photoURL = clampStr(user.photoURL, 500);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ownerId: uid,
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  const profileRef = doc(db, 'users', uid, 'profile', 'merchant');
  try {
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      const batch = writeBatch(db);
      const seededMerchant: MerchantProfile = {
        ...defaults.merchant,
        name: user.displayName || defaults.merchant.name,
        email: user.email || defaults.merchant.email,
      };
      batch.set(profileRef, {
        ...toMerchantDocPayload(uid, seededMerchant),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      defaults.products.forEach((p) => {
        const ref = doc(db, 'users', uid, 'products', sanitizeId(p.id, 'prod'));
        batch.set(ref, {
          ...toProductDocPayload(uid, p),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.orders.forEach((o) => {
        const ref = doc(db, 'users', uid, 'orders', sanitizeId(o.id, 'ord'));
        batch.set(ref, {
          ...toOrderDocPayload(uid, o),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.quotes.forEach((q) => {
        const ref = doc(db, 'users', uid, 'quotes', sanitizeId(q.id, 'quo'));
        batch.set(ref, {
          ...toQuoteDocPayload(uid, q),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.customers.forEach((c) => {
        const ref = doc(db, 'users', uid, 'customers', sanitizeId(c.id, 'cust'));
        batch.set(ref, {
          ...toCustomerDocPayload(uid, c),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.suppliers.forEach((s) => {
        const ref = doc(db, 'users', uid, 'suppliers', sanitizeId(s.id, 'sup'));
        batch.set(ref, {
          ...toSupplierDocPayload(uid, s),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.supplierPayments.forEach((sp) => {
        const ref = doc(db, 'users', uid, 'supplierPayments', sanitizeId(sp.id, 'spay'));
        batch.set(ref, {
          ...toSupplierPaymentDocPayload(uid, sp),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.stockMovements.forEach((m) => {
        const ref = doc(db, 'users', uid, 'stockMovements', sanitizeId(m.id, 'mov'));
        batch.set(ref, {
          ...toStockMovementDocPayload(uid, m),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      defaults.sellerPayouts.forEach((sp) => {
        const ref = doc(db, 'users', uid, 'sellerPayouts', sanitizeId(sp.id, 'payout'));
        batch.set(ref, {
          ...toSellerPayoutDocPayload(uid, sp),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      const cleanSlug = sanitizeStoreSlug(seededMerchant.storeSlug);
      batch.set(doc(db, 'publicStores', cleanSlug), {
        ...toPublicStoreDocPayload(uid, seededMerchant),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      defaults.products.forEach((p) => {
        const prodId = sanitizeId(p.id, 'prod');
        batch.set(doc(db, 'publicStores', cleanSlug, 'products', prodId), {
          ...toPublicProductDocPayload(uid, cleanSlug, p),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    } else {
      // Backfill public storefront projection for existing workspaces if not created yet
      const existingMerchant = profileSnap.data() as MerchantProfile;
      const cleanSlug = sanitizeStoreSlug(existingMerchant.storeSlug || defaults.merchant.storeSlug);
      const publicStoreRef = doc(db, 'publicStores', cleanSlug);
      const publicStoreSnap = await getDoc(publicStoreRef);
      if (!publicStoreSnap.exists()) {
        const productsSnap = await getDocs(
          query(collection(db, 'users', uid, 'products'), where('ownerId', '==', uid))
        );
        const batch = writeBatch(db);
        batch.set(publicStoreRef, {
          ...toPublicStoreDocPayload(uid, existingMerchant),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        productsSnap.docs.forEach((pDoc) => {
          const pData = pDoc.data() as Product;
          const prodId = sanitizeId(pData.id || pDoc.id, 'prod');
          batch.set(doc(db, 'publicStores', cleanSlug, 'products', prodId), {
            ...toPublicProductDocPayload(uid, cleanSlug, pData),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/profile/merchant`);
  }
}

export interface WorkspaceSnapshotCallbacks {
  onMerchant: (merchant: MerchantProfile) => void;
  onProducts: (products: Product[]) => void;
  onOrders: (orders: Order[]) => void;
  onQuotes: (quotes: Quote[]) => void;
  onCustomers: (customers: Customer[]) => void;
  onPromoLogs: (logs: PromoCampaignLog[]) => void;
  onStockMovements: (movements: StockMovement[]) => void;
  onSuppliers: (suppliers: Supplier[]) => void;
  onSupplierPayments: (payments: SupplierPayment[]) => void;
  onSellerPayouts: (payouts: SellerPayout[]) => void;
}

export function subscribeToMerchantWorkspace(
  uid: string,
  callbacks: WorkspaceSnapshotCallbacks
): () => void {
  const unsubs: Unsubscribe[] = [];

  const profilePath = `users/${uid}/profile/merchant`;
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'profile', 'merchant'),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onMerchant({
          name: d.name,
          storeName: d.storeName,
          storeSlug: d.storeSlug,
          phone: d.phone,
          whatsapp: d.whatsapp,
          email: d.email,
          address: d.address,
          city: d.city,
          ifuNumber: d.ifuNumber,
          currency: d.currency,
          description: d.description,
          logo: d.logo,
          banner: d.banner,
          momoNumber: d.momoNumber,
          moovNumber: d.moovNumber,
          celtiisNumber: d.celtiisNumber,
          enabledPaymentMethods: d.enabledPaymentMethods as PaymentMethod[] | undefined,
          bankAccount: d.bankAccount,
          momoMerchantCode: d.momoMerchantCode,
          paymentInstructions: d.paymentInstructions,
          deliveryRates: d.deliveryRates,
          enableOnlineOrders: d.enableOnlineOrders,
          enableWhatsAppCheckout: d.enableWhatsAppCheckout,
          taxEnabled: d.taxEnabled,
          taxRate: d.taxRate,
          taxLabel: d.taxLabel,
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, profilePath)
    )
  );

  const subQuery = (colName: string) =>
    query(collection(db, 'users', uid, colName), where('ownerId', '==', uid));

  const productsPath = `users/${uid}/products`;
  unsubs.push(
    onSnapshot(
      subQuery('products'),
      (snap) => {
        const list: Product[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id || docSnap.id,
            name: d.name,
            category: d.category as ProductCategory,
            sku: d.sku,
            barcode: d.barcode,
            buyPrice: d.buyPrice,
            sellPrice: d.sellPrice,
            stock: d.stock,
            minStockAlert: d.minStockAlert,
            description: d.description,
            image: d.image,
            isOnline: d.isOnline,
            totalSold: d.totalSold,
            unit: d.unit,
            variants: d.variants,
            imageVerification: d.imageVerification,
          };
        });
        callbacks.onProducts(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, productsPath)
    )
  );

  const ordersPath = `users/${uid}/orders`;
  unsubs.push(
    onSnapshot(
      subQuery('orders'),
      (snap) => {
        const list: Order[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              orderNumber: d.orderNumber,
              customerName: d.customerName,
              customerPhone: d.customerPhone,
              deliveryCity: d.deliveryCity,
              deliveryAddress: d.deliveryAddress,
              items: d.items || [],
              subtotal: d.subtotal,
              taxRate: d.taxRate,
              taxLabel: d.taxLabel,
              taxAmount: d.taxAmount,
              deliveryFee: d.deliveryFee,
              totalAmount: d.totalAmount,
              paymentMethod: d.paymentMethod,
              paymentStatus: d.paymentStatus,
              amountPaid: d.amountPaid,
              paymentReference: d.paymentReference,
              paymentConfirmedAt: d.paymentConfirmedAt,
              status: d.status,
              date: d.date,
              channel: d.channel,
              notes: d.notes,
            } as Order;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        callbacks.onOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, ordersPath)
    )
  );

  const quotesPath = `users/${uid}/quotes`;
  unsubs.push(
    onSnapshot(
      subQuery('quotes'),
      (snap) => {
        const list: Quote[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              quoteNumber: d.quoteNumber,
              customerId: d.customerId,
              customerName: d.customerName,
              customerPhone: d.customerPhone,
              deliveryCity: d.deliveryCity,
              deliveryAddress: d.deliveryAddress,
              items: d.items || [],
              subtotal: d.subtotal,
              discountAmount: d.discountAmount ?? 0,
              taxRate: d.taxRate ?? 0,
              taxLabel: d.taxLabel ?? 'TVA',
              taxAmount: d.taxAmount ?? 0,
              deliveryFee: d.deliveryFee ?? 0,
              totalAmount: d.totalAmount,
              status: d.status,
              validUntil: d.validUntil,
              createdAt: d.createdAtDate || '',
              notes: d.notes,
              convertedOrderId: d.convertedOrderId,
              convertedOrderNumber: d.convertedOrderNumber,
              preferredPaymentMethod: d.preferredPaymentMethod,
            } as Quote;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onQuotes(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, quotesPath)
    )
  );

  const customersPath = `users/${uid}/customers`;
  unsubs.push(
    onSnapshot(
      subQuery('customers'),
      (snap) => {
        const list: Customer[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id || docSnap.id,
            name: d.name,
            phone: d.phone,
            city: d.city,
            notes: d.notes,
            createdAt: d.createdAtDate || '',
            lastPromoSentAt: d.lastPromoSentAt,
          };
        });
        callbacks.onCustomers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, customersPath)
    )
  );

  const promoLogsPath = `users/${uid}/promoLogs`;
  unsubs.push(
    onSnapshot(
      subQuery('promoLogs'),
      (snap) => {
        const list: PromoCampaignLog[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              title: d.title,
              message: d.message,
              channel: d.channel,
              recipientCount: d.recipientCount,
              recipientNames: d.recipientNames || [],
              sentAt: d.sentAt,
            } as PromoCampaignLog;
          })
          .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        callbacks.onPromoLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, promoLogsPath)
    )
  );

  const movementsPath = `users/${uid}/stockMovements`;
  unsubs.push(
    onSnapshot(
      subQuery('stockMovements'),
      (snap) => {
        const list: StockMovement[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              productId: d.productId,
              productName: d.productName,
              type: d.type,
              quantity: d.quantity,
              reason: d.reason,
              date: d.date,
              user: d.user,
              supplierId: d.supplierId,
              supplierName: d.supplierName,
              unitCost: d.unitCost,
              totalCost: d.totalCost,
              amountPaid: d.amountPaid,
            } as StockMovement;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        callbacks.onStockMovements(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, movementsPath)
    )
  );

  const suppliersPath = `users/${uid}/suppliers`;
  unsubs.push(
    onSnapshot(
      subQuery('suppliers'),
      (snap) => {
        const list: Supplier[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id || docSnap.id,
            name: d.name,
            contactPerson: d.contactPerson,
            phone: d.phone,
            city: d.city,
            category: d.category,
            notes: d.notes,
            createdAt: d.createdAtDate || '',
          };
        });
        callbacks.onSuppliers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, suppliersPath)
    )
  );

  const supplierPaymentsPath = `users/${uid}/supplierPayments`;
  unsubs.push(
    onSnapshot(
      subQuery('supplierPayments'),
      (snap) => {
        const list: SupplierPayment[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              supplierId: d.supplierId,
              amount: d.amount,
              paymentMethod: d.paymentMethod,
              reference: d.reference,
              notes: d.notes,
              date: d.date,
            } as SupplierPayment;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        callbacks.onSupplierPayments(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, supplierPaymentsPath)
    )
  );

  const sellerPayoutsPath = `users/${uid}/sellerPayouts`;
  unsubs.push(
    onSnapshot(
      subQuery('sellerPayouts'),
      (snap) => {
        const list: SellerPayout[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: d.id || docSnap.id,
              amount: d.amount,
              sourceMethod: d.sourceMethod,
              destinationType: d.destinationType,
              destinationAccount: d.destinationAccount,
              reference: d.reference,
              notes: d.notes,
              date: d.date,
              status: d.status,
            } as SellerPayout;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        callbacks.onSellerPayouts(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, sellerPayoutsPath)
    )
  );

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

async function upsertPublicProductsInStore(
  uid: string,
  storeSlug: string | undefined,
  productsToSync: Product[]
): Promise<void> {
  if (!storeSlug || productsToSync.length === 0) return;
  const cleanSlug = sanitizeStoreSlug(storeSlug);
  const storeSnap = await getDoc(doc(db, 'publicStores', cleanSlug));
  if (!storeSnap.exists() || storeSnap.data().ownerId !== uid) return;

  for (const product of productsToSync) {
    const prodId = sanitizeId(product.id, 'prod');
    const pubRef = doc(db, 'publicStores', cleanSlug, 'products', prodId);
    const pubSnap = await getDoc(pubRef);
    const payload = toPublicProductDocPayload(uid, cleanSlug, product);
    if (pubSnap.exists()) {
      const { ownerId: _o, id: _i, storeSlug: _s, ...updatable } = payload;
      await updateDoc(pubRef, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(pubRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

export async function saveMerchantProfileToDb(
  uid: string,
  profile: MerchantProfile,
  products?: Product[]
): Promise<void> {
  const path = `users/${uid}/profile/merchant`;
  try {
    const cleanSlug = sanitizeStoreSlug(profile.storeSlug);
    const normalizedProfile: MerchantProfile = {
      ...profile,
      storeSlug: cleanSlug,
    };
    const payload = toMerchantDocPayload(uid, normalizedProfile);
    const { ownerId: _omitOwner, ...updatable } = payload;
    await updateDoc(doc(db, 'users', uid, 'profile', 'merchant'), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });

    // Keep public storefront document in sync
    const publicStoreRef = doc(db, 'publicStores', cleanSlug);
    const publicSnap = await getDoc(publicStoreRef);
    const pubPayload = toPublicStoreDocPayload(uid, normalizedProfile);
    if (publicSnap.exists()) {
      if (publicSnap.data().ownerId === uid) {
        const { ownerId: _po, storeSlug: _ps, ...pubUpdatable } = pubPayload;
        await updateDoc(publicStoreRef, {
          ...pubUpdatable,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(publicStoreRef, {
        ...pubPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (products && products.length > 0) {
        await upsertPublicProductsInStore(uid, cleanSlug, products);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addProductWithInitialStockToDb(
  uid: string,
  product: Product,
  initialMovement?: StockMovement,
  storeSlug?: string
): Promise<void> {
  const prodId = sanitizeId(product.id, 'prod');
  const path = `users/${uid}/products/${prodId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'products', prodId), {
      ...toProductDocPayload(uid, product),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (initialMovement) {
      const movId = sanitizeId(initialMovement.id, 'mov');
      batch.set(doc(db, 'users', uid, 'stockMovements', movId), {
        ...toStockMovementDocPayload(uid, initialMovement),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await upsertPublicProductsInStore(uid, storeSlug, [product]);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProductInDb(
  uid: string,
  product: Product,
  storeSlug?: string
): Promise<void> {
  const prodId = sanitizeId(product.id, 'prod');
  const path = `users/${uid}/products/${prodId}`;
  try {
    const payload = toProductDocPayload(uid, product);
    const { ownerId: _o, id: _i, ...updatable } = payload;
    await updateDoc(doc(db, 'users', uid, 'products', prodId), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
    await upsertPublicProductsInStore(uid, storeSlug, [product]);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveProductVerificationInDb(
  uid: string,
  productId: string,
  verification: ProductImageVerification,
  storeSlug?: string
): Promise<void> {
  const prodId = sanitizeId(productId, 'prod');
  const path = `users/${uid}/products/${prodId}`;
  try {
    const cleanVerification = {
      verdict: verification.verdict,
      aiProbability: clampNum(verification.aiProbability, 0, 100, 0),
      scamRiskLevel: verification.scamRiskLevel,
      summary: clampStr(verification.summary, 600),
      checkedAt: clampStr(verification.checkedAt, 60),
    };
    await updateDoc(doc(db, 'users', uid, 'products', prodId), {
      imageVerification: cleanVerification,
      updatedAt: serverTimestamp(),
    });

    if (storeSlug) {
      const cleanSlug = sanitizeStoreSlug(storeSlug);
      const pubRef = doc(db, 'publicStores', cleanSlug, 'products', prodId);
      const pubSnap = await getDoc(pubRef);
      if (pubSnap.exists() && pubSnap.data().ownerId === uid) {
        await updateDoc(pubRef, {
          imageVerification: cleanVerification,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProductInDb(
  uid: string,
  productId: string,
  storeSlug?: string
): Promise<void> {
  const prodId = sanitizeId(productId, 'prod');
  const path = `users/${uid}/products/${prodId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'products', prodId));
    if (storeSlug) {
      const cleanSlug = sanitizeStoreSlug(storeSlug);
      const pubRef = doc(db, 'publicStores', cleanSlug, 'products', prodId);
      const pubSnap = await getDoc(pubRef);
      if (pubSnap.exists() && pubSnap.data().ownerId === uid) {
        await deleteDoc(pubRef);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function registerOrderToDb(
  uid: string,
  params: {
    order: Order;
    updatedProducts: Product[];
    movements: StockMovement[];
    newCustomer?: Customer;
    storeSlug?: string;
  }
): Promise<void> {
  const orderId = sanitizeId(params.order.id, 'ord');
  const path = `users/${uid}/orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'orders', orderId), {
      ...toOrderDocPayload(uid, params.order),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    params.updatedProducts.forEach((p) => {
      const prodId = sanitizeId(p.id, 'prod');
      batch.update(doc(db, 'users', uid, 'products', prodId), {
        stock: clampNum(p.stock, 0, 1000000, 0),
        totalSold: clampNum(p.totalSold, 0, 10000000, 0),
        updatedAt: serverTimestamp(),
      });
    });

    params.movements.forEach((m) => {
      const movId = sanitizeId(m.id, 'mov');
      batch.set(doc(db, 'users', uid, 'stockMovements', movId), {
        ...toStockMovementDocPayload(uid, m),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    if (params.newCustomer) {
      const custId = sanitizeId(params.newCustomer.id, 'cust');
      batch.set(doc(db, 'users', uid, 'customers', custId), {
        ...toCustomerDocPayload(uid, params.newCustomer),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await upsertPublicProductsInStore(uid, params.storeSlug, params.updatedProducts);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrderStatusInDb(
  uid: string,
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const cleanId = sanitizeId(orderId, 'ord');
  const path = `users/${uid}/orders/${cleanId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'orders', cleanId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function confirmOrderPaymentInDb(
  uid: string,
  orderId: string,
  params: {
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    amountPaid: number;
    paymentReference?: string;
    paymentConfirmedAt?: string;
  }
): Promise<void> {
  const cleanId = sanitizeId(orderId, 'ord');
  const path = `users/${uid}/orders/${cleanId}`;
  try {
    const updateData: Record<string, unknown> = {
      status: params.status,
      paymentStatus: params.paymentStatus,
      amountPaid: clampNum(params.amountPaid, 0, 1000000000, 0),
      updatedAt: serverTimestamp(),
    };
    if (params.paymentReference !== undefined) {
      updateData.paymentReference = clampStr(params.paymentReference, 120);
    }
    if (params.paymentConfirmedAt !== undefined) {
      updateData.paymentConfirmedAt = clampStr(params.paymentConfirmedAt, 40);
    }
    await updateDoc(doc(db, 'users', uid, 'orders', cleanId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addSellerPayoutToDb(
  uid: string,
  payout: SellerPayout
): Promise<void> {
  const payoutId = sanitizeId(payout.id, 'payout');
  const path = `users/${uid}/sellerPayouts/${payoutId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'sellerPayouts', payoutId), {
      ...toSellerPayoutDocPayload(uid, payout),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function completeSellerPayoutInDb(
  uid: string,
  payoutId: string,
  reference?: string
): Promise<void> {
  const cleanId = sanitizeId(payoutId, 'payout');
  const path = `users/${uid}/sellerPayouts/${cleanId}`;
  try {
    const patch: Record<string, unknown> = {
      status: 'COMPLETED',
      updatedAt: serverTimestamp(),
    };
    if (reference !== undefined) {
      patch.reference = clampStr(reference, 120);
    }
    await updateDoc(doc(db, 'users', uid, 'sellerPayouts', cleanId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateStockInDb(
  uid: string,
  updatedProduct: Product,
  movement: StockMovement,
  storeSlug?: string
): Promise<void> {
  const prodId = sanitizeId(updatedProduct.id, 'prod');
  const movId = sanitizeId(movement.id, 'mov');
  const path = `users/${uid}/products/${prodId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid, 'products', prodId), {
      stock: clampNum(updatedProduct.stock, 0, 1000000, 0),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid, 'stockMovements', movId), {
      ...toStockMovementDocPayload(uid, movement),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await upsertPublicProductsInStore(uid, storeSlug, [updatedProduct]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchReceiveInvoiceStockToDb(
  uid: string,
  params: {
    newSupplier?: Supplier;
    createdProducts: Product[];
    updatedProducts: Product[];
    movements: StockMovement[];
    storeSlug?: string;
  }
): Promise<void> {
  const path = `users/${uid}/stockMovements`;
  try {
    const batch = writeBatch(db);
    if (params.newSupplier) {
      const supId = sanitizeId(params.newSupplier.id, 'sup');
      batch.set(doc(db, 'users', uid, 'suppliers', supId), {
        ...toSupplierDocPayload(uid, params.newSupplier),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    params.createdProducts.forEach((p) => {
      const prodId = sanitizeId(p.id, 'prod');
      batch.set(doc(db, 'users', uid, 'products', prodId), {
        ...toProductDocPayload(uid, p),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    params.updatedProducts.forEach((p) => {
      const prodId = sanitizeId(p.id, 'prod');
      batch.update(doc(db, 'users', uid, 'products', prodId), {
        stock: clampNum(p.stock, 0, 1000000, 0),
        buyPrice: clampNum(p.buyPrice, 0, 100000000, 0),
        updatedAt: serverTimestamp(),
      });
    });
    params.movements.forEach((m) => {
      const movId = sanitizeId(m.id, 'mov');
      batch.set(doc(db, 'users', uid, 'stockMovements', movId), {
        ...toStockMovementDocPayload(uid, m),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    await upsertPublicProductsInStore(uid, params.storeSlug, [
      ...params.createdProducts,
      ...params.updatedProducts,
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addSupplierToDb(uid: string, supplier: Supplier): Promise<void> {
  const supId = sanitizeId(supplier.id, 'sup');
  const path = `users/${uid}/suppliers/${supId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'suppliers', supId), {
      ...toSupplierDocPayload(uid, supplier),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSupplierAndMovementsInDb(
  uid: string,
  supplier: Supplier,
  movementIdsToRename: string[]
): Promise<void> {
  const supId = sanitizeId(supplier.id, 'sup');
  const path = `users/${uid}/suppliers/${supId}`;
  try {
    const batch = writeBatch(db);
    const payload = toSupplierDocPayload(uid, supplier);
    const { ownerId: _o, id: _i, createdAtDate: _c, ...updatable } = payload;
    batch.update(doc(db, 'users', uid, 'suppliers', supId), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
    movementIdsToRename.forEach((movId) => {
      const cleanMov = sanitizeId(movId, 'mov');
      batch.update(doc(db, 'users', uid, 'stockMovements', cleanMov), {
        supplierName: clampStr(supplier.name, 160),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSupplierInDb(uid: string, supplierId: string): Promise<void> {
  const supId = sanitizeId(supplierId, 'sup');
  const path = `users/${uid}/suppliers/${supId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'suppliers', supId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addSupplierPaymentToDb(
  uid: string,
  payment: SupplierPayment
): Promise<void> {
  const payId = sanitizeId(payment.id, 'spay');
  const path = `users/${uid}/supplierPayments/${payId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'supplierPayments', payId), {
      ...toSupplierPaymentDocPayload(uid, payment),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addCustomerToDb(uid: string, customer: Customer): Promise<void> {
  const custId = sanitizeId(customer.id, 'cust');
  const path = `users/${uid}/customers/${custId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'customers', custId), {
      ...toCustomerDocPayload(uid, customer),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomerInDb(uid: string, customer: Customer): Promise<void> {
  const custId = sanitizeId(customer.id, 'cust');
  const path = `users/${uid}/customers/${custId}`;
  try {
    const payload = toCustomerDocPayload(uid, customer);
    const { ownerId: _o, id: _i, createdAtDate: _c, ...updatable } = payload;
    await updateDoc(doc(db, 'users', uid, 'customers', custId), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomerInDb(uid: string, customerId: string): Promise<void> {
  const custId = sanitizeId(customerId, 'cust');
  const path = `users/${uid}/customers/${custId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customers', custId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordPromoCampaignInDb(
  uid: string,
  log: PromoCampaignLog,
  recipientIds: string[]
): Promise<void> {
  const logId = sanitizeId(log.id, 'promo');
  const path = `users/${uid}/promoLogs/${logId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'promoLogs', logId), {
      ...toPromoLogDocPayload(uid, log),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    recipientIds.forEach((cid) => {
      const custId = sanitizeId(cid, 'cust');
      batch.update(doc(db, 'users', uid, 'customers', custId), {
        lastPromoSentAt: clampStr(log.sentAt, 40),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addQuoteToDb(uid: string, quote: Quote): Promise<void> {
  const quoteId = sanitizeId(quote.id, 'quo');
  const path = `users/${uid}/quotes/${quoteId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'quotes', quoteId), {
      ...toQuoteDocPayload(uid, quote),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateQuoteInDb(uid: string, quote: Quote): Promise<void> {
  const quoteId = sanitizeId(quote.id, 'quo');
  const path = `users/${uid}/quotes/${quoteId}`;
  try {
    const payload = toQuoteDocPayload(uid, quote);
    const {
      ownerId: _o,
      id: _i,
      createdAtDate: _c,
      convertedOrderId: _cid,
      convertedOrderNumber: _cnum,
      ...updatable
    } = payload;
    await updateDoc(doc(db, 'users', uid, 'quotes', quoteId), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQuoteInDb(uid: string, quoteId: string): Promise<void> {
  const cleanId = sanitizeId(quoteId, 'quo');
  const path = `users/${uid}/quotes/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quotes', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function convertQuoteToOrderInDb(
  uid: string,
  params: {
    quoteId: string;
    order: Order;
    updatedProducts: Product[];
    movements: StockMovement[];
    newCustomer?: Customer;
    storeSlug?: string;
  }
): Promise<void> {
  const cleanQuoteId = sanitizeId(params.quoteId, 'quo');
  const cleanOrderId = sanitizeId(params.order.id, 'ord');
  const path = `users/${uid}/quotes/${cleanQuoteId}`;
  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'users', uid, 'orders', cleanOrderId), {
      ...toOrderDocPayload(uid, params.order),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'users', uid, 'quotes', cleanQuoteId), {
      status: 'CONVERTED',
      convertedOrderId: cleanOrderId,
      convertedOrderNumber: clampNonEmpty(params.order.orderNumber, 64, 'CMD'),
      updatedAt: serverTimestamp(),
    });

    params.updatedProducts.forEach((p) => {
      const prodId = sanitizeId(p.id, 'prod');
      batch.update(doc(db, 'users', uid, 'products', prodId), {
        stock: clampNum(p.stock, 0, 1000000, 0),
        totalSold: clampNum(p.totalSold, 0, 10000000, 0),
        updatedAt: serverTimestamp(),
      });
    });

    params.movements.forEach((m) => {
      const movId = sanitizeId(m.id, 'mov');
      batch.set(doc(db, 'users', uid, 'stockMovements', movId), {
        ...toStockMovementDocPayload(uid, m),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    if (params.newCustomer) {
      const custId = sanitizeId(params.newCustomer.id, 'cust');
      batch.set(doc(db, 'users', uid, 'customers', custId), {
        ...toCustomerDocPayload(uid, params.newCustomer),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await upsertPublicProductsInStore(uid, params.storeSlug, params.updatedProducts);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface PublicStorefrontBundle {
  ownerId: string;
  merchant: MerchantProfile;
  products: Product[];
}

export async function loadPublicStorefrontBySlug(
  slug: string
): Promise<PublicStorefrontBundle | null> {
  const cleanSlug = sanitizeStoreSlug(slug);
  const storePath = `publicStores/${cleanSlug}`;
  try {
    const storeSnap = await getDoc(doc(db, 'publicStores', cleanSlug));
    if (!storeSnap.exists()) {
      return null;
    }
    const d = storeSnap.data();
    const merchant: MerchantProfile = {
      name: d.name,
      storeName: d.storeName,
      storeSlug: d.storeSlug,
      phone: d.phone,
      whatsapp: d.whatsapp,
      email: '',
      address: d.address,
      city: d.city,
      ifuNumber: '',
      currency: d.currency,
      description: d.description,
      logo: d.logo,
      banner: d.banner,
      momoNumber: d.momoNumber,
      moovNumber: d.moovNumber,
      celtiisNumber: d.celtiisNumber,
      enabledPaymentMethods: d.enabledPaymentMethods as PaymentMethod[] | undefined,
      bankAccount: d.bankAccount,
      momoMerchantCode: d.momoMerchantCode,
      paymentInstructions: d.paymentInstructions,
      deliveryRates: d.deliveryRates,
      enableOnlineOrders: d.enableOnlineOrders,
      enableWhatsAppCheckout: d.enableWhatsAppCheckout,
      taxEnabled: d.taxEnabled,
      taxRate: d.taxRate,
      taxLabel: d.taxLabel,
    };

    const productsSnap = await getDocs(
      query(
        collection(db, 'publicStores', cleanSlug, 'products'),
        where('isOnline', '==', true)
      )
    );
    const products: Product[] = productsSnap.docs.map((docSnap) => {
      const p = docSnap.data();
      return {
        id: p.id || docSnap.id,
        name: p.name,
        category: p.category as ProductCategory,
        sku: p.id || docSnap.id,
        buyPrice: 0,
        sellPrice: p.sellPrice,
        stock: p.stock,
        minStockAlert: 5,
        description: p.description,
        image: p.image,
        isOnline: Boolean(p.isOnline),
        totalSold: p.totalSold ?? 0,
        unit: p.unit || 'pièce',
        variants: p.variants,
        imageVerification: p.imageVerification,
      };
    });

    return {
      ownerId: d.ownerId,
      merchant,
      products,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, storePath);
    return null;
  }
}
