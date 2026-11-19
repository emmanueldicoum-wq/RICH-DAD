import React, { useEffect, useState } from 'react';
import {
  ViewTab,
  Product,
  Order,
  Quote,
  MerchantProfile,
  StockMovement,
  OrderStatus,
  ProductImageVerification,
  Customer,
  PromoCampaignLog,
  Supplier,
  SupplierPayment,
  SellerPayout,
} from './types';
import {
  initialProducts,
  initialOrders,
  initialQuotes,
  initialMerchantProfile,
  initialStockMovements,
  initialCustomers,
  initialSuppliers,
  initialSupplierPayments,
  initialSellerPayouts,
} from './data/mockData';
import { CurrencyProvider } from './context/CurrencyContext';
import {
  NotificationProvider,
  useNotifications,
} from './context/NotificationContext';
import { useFirebaseAuth } from './context/FirebaseAuthContext';
import {
  ensureUserWorkspace,
  subscribeToMerchantWorkspace,
  saveMerchantProfileToDb,
  addProductWithInitialStockToDb,
  updateProductInDb,
  deleteProductInDb,
  saveProductVerificationInDb,
  registerOrderToDb,
  updateOrderStatusInDb,
  confirmOrderPaymentInDb,
  addSellerPayoutToDb,
  completeSellerPayoutInDb,
  updateStockInDb,
  batchReceiveInvoiceStockToDb,
  addSupplierToDb,
  updateSupplierAndMovementsInDb,
  deleteSupplierInDb,
  addSupplierPaymentToDb,
  addCustomerToDb,
  updateCustomerInDb,
  deleteCustomerInDb,
  recordPromoCampaignInDb,
  addQuoteToDb,
  updateQuoteInDb,
  deleteQuoteInDb,
  convertQuoteToOrderInDb,
  loadPublicStorefrontBySlug,
  PublicStorefrontBundle,
} from './services/firestoreService';
import { getEffectiveOrderPaymentStatus } from './utils/payment';
import { getShopSlugFromUrl } from './utils/storeUrl';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { OrdersView } from './components/OrdersView';
import { QuotesView, ConvertQuoteOptions } from './components/QuotesView';
import { QuoteModal } from './components/QuoteModal';
import { CustomersView } from './components/CustomersView';
import { InventoryView, StockMovementMeta } from './components/InventoryView';
import { ConfirmInvoiceStockPayload } from './components/InvoiceScannerModal';
import { PosView } from './components/PosView';
import { PaymentsView, ConfirmPaymentPayload } from './components/PaymentsView';
import { ShopManagementView } from './components/ShopManagementView';
import { AnalyticsView } from './components/AnalyticsView';
import { AntiFraudView } from './components/AntiFraudView';
import { PublicStorefrontView } from './components/PublicStorefrontView';
import { InvoiceModal } from './components/InvoiceModal';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Calculator,
  Store,
  FileText,
} from 'lucide-react';

interface AppContentProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  merchant: MerchantProfile;
  setMerchant: React.Dispatch<React.SetStateAction<MerchantProfile>>;
  stockMovements: StockMovement[];
  setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  promoLogs: PromoCampaignLog[];
  setPromoLogs: React.Dispatch<React.SetStateAction<PromoCampaignLog[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  supplierPayments: SupplierPayment[];
  setSupplierPayments: React.Dispatch<React.SetStateAction<SupplierPayment[]>>;
  sellerPayouts: SellerPayout[];
  setSellerPayouts: React.Dispatch<React.SetStateAction<SellerPayout[]>>;
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  onAsyncError: (err: unknown) => void;
  sharedShopSlug: string | null;
  onClearSharedShopSlug: () => void;
  publicStoreBundle: PublicStorefrontBundle | null;
  isLoadingPublicStore: boolean;
  publicStoreNotFoundSlug: string | null;
}

function AppContent({
  products,
  setProducts,
  orders,
  setOrders,
  quotes,
  setQuotes,
  merchant,
  setMerchant,
  stockMovements,
  setStockMovements,
  customers,
  setCustomers,
  promoLogs,
  setPromoLogs,
  suppliers,
  setSuppliers,
  supplierPayments,
  setSupplierPayments,
  sellerPayouts,
  setSellerPayouts,
  currentTab,
  setCurrentTab,
  onAsyncError,
  sharedShopSlug,
  onClearSharedShopSlug,
  publicStoreBundle,
  isLoadingPublicStore,
  publicStoreNotFoundSlug,
}: AppContentProps) {
  const { user } = useFirebaseAuth();

  // App Modes: Presentation Landing, Merchant Backend Dashboard, or Customer Online Store
  const [appMode, setAppMode] = useState<'landing' | 'merchant' | 'public_store'>(() =>
    sharedShopSlug ? 'public_store' : 'merchant'
  );

  // Real-time Notification hook
  const { checkAndNotifyStock } = useNotifications();

  // Modals & Navigation States
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [convertingQuoteTarget, setConvertingQuoteTarget] = useState<Quote | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Helper to run Firestore mutations safely without ignoring errors
  const persist = (fn: () => Promise<void>) => {
    if (!user) return;
    fn().catch((err) => onAsyncError(err));
  };

  const handleUpdateMerchant = (updated: MerchantProfile) => {
    setMerchant(updated);
    if (user) {
      persist(() => saveMerchantProfileToDb(user.uid, updated, products));
    }
  };

  // Stock & Order Handlers
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    let initialMovement: StockMovement | undefined;
    if (newProduct.stock > 0) {
      initialMovement = {
        id: `mov-${Date.now()}`,
        productId: newProduct.id,
        productName: newProduct.name,
        type: 'IN',
        quantity: newProduct.stock,
        reason: 'Stock initial à la création du produit',
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        user: merchant.name,
      };
      setStockMovements((prev) => [initialMovement!, ...prev]);
    }

    if (newProduct.stock <= newProduct.minStockAlert) {
      checkAndNotifyStock(newProduct);
    }

    if (user) {
      persist(() =>
        addProductWithInitialStockToDb(
          user.uid,
          newProduct,
          initialMovement,
          merchant.storeSlug
        )
      );
    }
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (updatedProduct.stock <= updatedProduct.minStockAlert) {
      checkAndNotifyStock(updatedProduct);
    }
    if (user) {
      persist(() =>
        updateProductInDb(user.uid, updatedProduct, merchant.storeSlug)
      );
    }
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (user) {
      persist(() => deleteProductInDb(user.uid, productId, merchant.storeSlug));
    }
  };

  const handleSaveProductVerification = (
    productId: string,
    verification: ProductImageVerification
  ) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, imageVerification: verification } : p
      )
    );
    if (user) {
      persist(() =>
        saveProductVerificationInDb(
          user.uid,
          productId,
          verification,
          merchant.storeSlug
        )
      );
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
    }
    if (user) {
      persist(() => updateOrderStatusInDb(user.uid, orderId, status));
    }
  };

  const handleConfirmOrderPayment = (payload: ConfirmPaymentPayload) => {
    const confirmedAt =
      payload.paymentStatus === 'PAID'
        ? new Date().toISOString().replace('T', ' ').slice(0, 16)
        : undefined;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === payload.orderId
          ? {
              ...o,
              status: payload.orderStatus,
              paymentStatus: payload.paymentStatus,
              amountPaid: payload.amountPaid,
              ...(payload.paymentReference !== undefined
                ? { paymentReference: payload.paymentReference }
                : {}),
              ...(confirmedAt ? { paymentConfirmedAt: confirmedAt } : {}),
            }
          : o
      )
    );

    if (selectedOrder && selectedOrder.id === payload.orderId) {
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: payload.orderStatus,
              paymentStatus: payload.paymentStatus,
              amountPaid: payload.amountPaid,
              ...(payload.paymentReference !== undefined
                ? { paymentReference: payload.paymentReference }
                : {}),
              ...(confirmedAt ? { paymentConfirmedAt: confirmedAt } : {}),
            }
          : null
      );
    }

    if (user) {
      persist(() =>
        confirmOrderPaymentInDb(user.uid, payload.orderId, {
          status: payload.orderStatus,
          paymentStatus: payload.paymentStatus,
          amountPaid: payload.amountPaid,
          paymentReference: payload.paymentReference,
          paymentConfirmedAt: confirmedAt,
        })
      );
    }
  };

  const handleAddSellerPayout = (payout: SellerPayout) => {
    setSellerPayouts((prev) => [payout, ...prev]);
    if (user) {
      persist(() => addSellerPayoutToDb(user.uid, payout));
    }
  };

  const handleCompleteSellerPayout = (payoutId: string, reference?: string) => {
    setSellerPayouts((prev) =>
      prev.map((p) =>
        p.id === payoutId
          ? {
              ...p,
              status: 'COMPLETED',
              ...(reference !== undefined ? { reference } : {}),
            }
          : p
      )
    );
    if (user) {
      persist(() => completeSellerPayoutInDb(user.uid, payoutId, reference));
    }
  };

  const handleUpdateStock = (
    productId: string,
    newStock: number,
    reason: string,
    type: 'IN' | 'OUT' | 'ADJUSTMENT',
    meta?: StockMovementMeta
  ) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;

    const diff = Math.abs(newStock - targetProduct.stock);
    const updatedProd = { ...targetProduct, stock: newStock };

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? updatedProd : p))
    );

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId,
      productName: targetProduct.name,
      type,
      quantity: diff,
      reason,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      user: merchant.name,
      ...(type === 'IN' && meta ? meta : {}),
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    if (newStock <= targetProduct.minStockAlert) {
      checkAndNotifyStock(updatedProd);
    }

    if (user) {
      persist(() =>
        updateStockInDb(user.uid, updatedProd, newMovement, merchant.storeSlug)
      );
    }
  };

  const handleQuickReplenishStock = (productId: string, quantity: number) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;
    const newStock = targetProduct.stock + quantity;
    handleUpdateStock(
      productId,
      newStock,
      'Réapprovisionnement rapide depuis alerte navigation',
      'IN'
    );
  };

  const handleBatchReceiveInvoiceStock = (
    payload: ConfirmInvoiceStockPayload
  ) => {
    const nowDate = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const createdProducts: Product[] = [];
    const newMovements: StockMovement[] = [];
    let createdSupplier: Supplier | undefined;

    let resolvedSupplierId = payload.supplierId;
    let resolvedSupplierName = payload.supplierName.trim() || 'Fournisseur';

    if (!resolvedSupplierId && resolvedSupplierName) {
      const existingSup = suppliers.find(
        (s) => s.name.trim().toLowerCase() === resolvedSupplierName.toLowerCase()
      );
      if (existingSup) {
        resolvedSupplierId = existingSup.id;
        resolvedSupplierName = existingSup.name;
      } else {
        const newSup: Supplier = {
          id: `sup-${Date.now()}`,
          name: resolvedSupplierName,
          phone: '+229 00 00 00 00',
          city: merchant.city || 'Cotonou',
          category: 'Import & Transit',
          notes: `Créé automatiquement lors du scan de facture ${
            payload.invoiceNumber || ''
          }`.trim(),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        resolvedSupplierId = newSup.id;
        createdSupplier = newSup;
        setSuppliers((prev) => [newSup, ...prev]);
      }
    }

    const existingIncrements = new Map<
      string,
      { qty: number; buyPrice: number; updateBuyPrice: boolean }
    >();

    const lineCosts = payload.lines.map((l) => {
      if (l.mode === 'NEW' && l.newProduct) {
        return l.quantity * l.newProduct.buyPrice;
      }
      const target = l.productId
        ? products.find((p) => p.id === l.productId)
        : undefined;
      const unitCost =
        l.unitBuyPrice > 0 ? l.unitBuyPrice : target?.buyPrice || 0;
      return l.quantity * unitCost;
    });
    const grandTotalCost = lineCosts.reduce((s, c) => s + c, 0);
    let remainingToAllocate =
      payload.paymentMode === 'PAID'
        ? grandTotalCost
        : payload.paymentMode === 'CREDIT'
        ? 0
        : Math.min(grandTotalCost, Math.max(0, payload.amountPaid ?? 0));

    payload.lines.forEach((line, idx) => {
      const lineTotal = lineCosts[idx];
      let linePaid = 0;
      if (payload.paymentMode === 'PAID') {
        linePaid = lineTotal;
      } else if (
        payload.paymentMode === 'PARTIAL' &&
        remainingToAllocate > 0 &&
        lineTotal > 0
      ) {
        if (idx === payload.lines.length - 1) {
          linePaid = Math.min(lineTotal, remainingToAllocate);
        } else {
          const share = Math.round(
            (lineTotal / Math.max(1, grandTotalCost)) * (payload.amountPaid ?? 0)
          );
          linePaid = Math.min(lineTotal, remainingToAllocate, share);
        }
        remainingToAllocate = Math.max(0, remainingToAllocate - linePaid);
      }

      if (line.mode === 'EXISTING' && line.productId) {
        const prev = existingIncrements.get(line.productId);
        existingIncrements.set(line.productId, {
          qty: (prev?.qty || 0) + line.quantity,
          buyPrice:
            line.unitBuyPrice > 0 ? line.unitBuyPrice : prev?.buyPrice || 0,
          updateBuyPrice: Boolean(line.updateBuyPrice || prev?.updateBuyPrice),
        });
        const target = products.find((p) => p.id === line.productId);
        if (target) {
          const unitCost =
            line.unitBuyPrice > 0 ? line.unitBuyPrice : target.buyPrice;
          newMovements.push({
            id: `mov-${Date.now()}-${idx}`,
            productId: target.id,
            productName: target.name,
            type: 'IN',
            quantity: line.quantity,
            reason: payload.reason,
            date: nowDate,
            user: merchant.name,
            supplierId: resolvedSupplierId,
            supplierName: resolvedSupplierName,
            unitCost,
            totalCost: lineTotal,
            amountPaid: linePaid,
          });
        }
      } else if (line.mode === 'NEW' && line.newProduct) {
        const newId = `prod-${Date.now()}-${idx}`;
        const newProd: Product = {
          id: newId,
          name: line.newProduct.name,
          category: line.newProduct.category,
          sku: `OCR-${Math.floor(100 + Math.random() * 900)}`,
          barcode: `613000${Math.floor(1000000 + Math.random() * 8999999)}`,
          buyPrice: line.newProduct.buyPrice,
          sellPrice: line.newProduct.sellPrice,
          stock: line.quantity,
          minStockAlert: 5,
          unit: line.newProduct.unit,
          description: `Ajouté via scan OCR facture (${resolvedSupplierName})`,
          image:
            'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
          isOnline: true,
          totalSold: 0,
        };
        createdProducts.push(newProd);
        newMovements.push({
          id: `mov-${Date.now()}-new-${idx}`,
          productId: newId,
          productName: newProd.name,
          type: 'IN',
          quantity: line.quantity,
          reason: payload.reason,
          date: nowDate,
          user: merchant.name,
          supplierId: resolvedSupplierId,
          supplierName: resolvedSupplierName,
          unitCost: line.newProduct.buyPrice,
          totalCost: lineTotal,
          amountPaid: linePaid,
        });
      }
    });

    const updatedProductsList: Product[] = [];
    setProducts((prev) => {
      const updatedExisting = prev.map((p) => {
        const inc = existingIncrements.get(p.id);
        if (!inc) return p;
        const nextProd = {
          ...p,
          stock: p.stock + inc.qty,
          buyPrice:
            inc.updateBuyPrice && inc.buyPrice > 0 ? inc.buyPrice : p.buyPrice,
        };
        updatedProductsList.push(nextProd);
        return nextProd;
      });
      return [...createdProducts, ...updatedExisting];
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    if (user) {
      // Build exact updated products synchronously in case React batched state updates
      const syncUpdated = products
        .filter((p) => existingIncrements.has(p.id))
        .map((p) => {
          const inc = existingIncrements.get(p.id)!;
          return {
            ...p,
            stock: p.stock + inc.qty,
            buyPrice:
              inc.updateBuyPrice && inc.buyPrice > 0
                ? inc.buyPrice
                : p.buyPrice,
          };
        });
      persist(() =>
        batchReceiveInvoiceStockToDb(user.uid, {
          newSupplier: createdSupplier,
          createdProducts,
          updatedProducts: syncUpdated,
          movements: newMovements,
          storeSlug: merchant.storeSlug,
        })
      );
    }
  };

  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers((prev) => [newSup, ...prev]);
    if (user) {
      persist(() => addSupplierToDb(user.uid, newSup));
    }
  };

  const handleUpdateSupplier = (updated: Supplier) => {
    const affectedMovIds = stockMovements
      .filter((m) => m.supplierId === updated.id)
      .map((m) => m.id);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setStockMovements((prev) =>
      prev.map((m) =>
        m.supplierId === updated.id ? { ...m, supplierName: updated.name } : m
      )
    );
    if (user) {
      persist(() =>
        updateSupplierAndMovementsInDb(user.uid, updated, affectedMovIds)
      );
    }
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    if (user) {
      persist(() => deleteSupplierInDb(user.uid, supplierId));
    }
  };

  const handleAddSupplierPayment = (payment: SupplierPayment) => {
    setSupplierPayments((prev) => [payment, ...prev]);
    if (user) {
      persist(() => addSupplierPaymentToDb(user.uid, payment));
    }
  };

  const handleAddCustomer = (newCustomer: Customer) => {
    setCustomers((prev) => [newCustomer, ...prev]);
    if (user) {
      persist(() => addCustomerToDb(user.uid, newCustomer));
    }
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (user) {
      persist(() => updateCustomerInDb(user.uid, updated));
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    if (user) {
      persist(() => deleteCustomerInDb(user.uid, customerId));
    }
  };

  const handleRecordPromoCampaign = (
    log: PromoCampaignLog,
    recipientIds: string[]
  ) => {
    setPromoLogs((prev) => [log, ...prev]);
    const idSet = new Set(recipientIds);
    setCustomers((prev) =>
      prev.map((c) =>
        idSet.has(c.id) ? { ...c, lastPromoSentAt: log.sentAt } : c
      )
    );
    if (user) {
      persist(() => recordPromoCampaignInDb(user.uid, log, recipientIds));
    }
  };

  // Shared helper to compute stock decrements, movements, and auto-captured customer for a new order
  const buildOrderSideEffects = (newOrder: Order, currentProducts: Product[]) => {
    const qtyByProd = new Map<string, number>();
    newOrder.items.forEach((item) => {
      qtyByProd.set(
        item.productId,
        (qtyByProd.get(item.productId) || 0) + item.quantity
      );
    });

    const updatedProducts: Product[] = [];
    currentProducts.forEach((p) => {
      const dec = qtyByProd.get(p.id);
      if (dec) {
        const updatedStock = Math.max(0, p.stock - dec);
        updatedProducts.push({
          ...p,
          stock: updatedStock,
          totalSold: p.totalSold + dec,
        });
      }
    });

    const movements: StockMovement[] = newOrder.items.map((item, idx) => ({
      id: `mov-${Date.now()}-${idx}-${item.productId}`,
      productId: item.productId,
      productName: item.productName,
      type: 'OUT',
      quantity: item.quantity,
      reason: `Vente ${newOrder.orderNumber} (${newOrder.channel})`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      user:
        newOrder.channel === 'POS' ? 'Caisse Magasin' : 'Boutique en Ligne',
    }));

    const cleanDigits = newOrder.customerPhone.replace(/[^0-9]/g, '');
    const isRealPhone =
      cleanDigits.length >= 8 && !cleanDigits.endsWith('00000000');
    const isGenericName =
      newOrder.customerName.trim().toLowerCase() === 'client comptoir';
    let newCustomer: Customer | undefined;

    if (isRealPhone || !isGenericName) {
      const exists = customers.some((c) => {
        const cDigits = c.phone.replace(/[^0-9]/g, '');
        return (
          (isRealPhone && cDigits === cleanDigits) ||
          c.name.trim().toLowerCase() ===
            newOrder.customerName.trim().toLowerCase()
        );
      });
      if (!exists) {
        newCustomer = {
          id: `cust-${Date.now()}`,
          name: newOrder.customerName.trim(),
          phone: newOrder.customerPhone.trim(),
          city: newOrder.deliveryCity.split(' (')[0] || merchant.city,
          notes: `Ajouté automatiquement depuis commande ${newOrder.orderNumber}`,
          createdAt: new Date().toISOString().slice(0, 10),
        };
      }
    }

    return { updatedProducts, movements, newCustomer };
  };

  // When a sale is made in POS or Online Store, decrement stocks accordingly and check critical alerts
  const handleRegisterOrder = (newOrder: Order) => {
    const { updatedProducts, movements, newCustomer } = buildOrderSideEffects(
      newOrder,
      products
    );

    setOrders((prev) => [newOrder, ...prev]);

    if (newCustomer) {
      setCustomers((prev) => [newCustomer, ...prev]);
    }

    const updatedMap = new Map(updatedProducts.map((p) => [p.id, p]));
    setProducts((prev) =>
      prev.map((p) => {
        const upd = updatedMap.get(p.id);
        if (upd && upd.stock <= upd.minStockAlert) {
          checkAndNotifyStock(upd);
        }
        return upd || p;
      })
    );

    setStockMovements((prev) => [...movements, ...prev]);

    if (user) {
      persist(() =>
        registerOrderToDb(user.uid, {
          order: newOrder,
          updatedProducts,
          movements,
          newCustomer,
          storeSlug: merchant.storeSlug,
        })
      );
    }
  };

  // Quote CRUD & Conversion Handlers
  const handleAddQuote = (newQuote: Quote) => {
    setQuotes((prev) => [newQuote, ...prev]);
    if (user) {
      persist(() => addQuoteToDb(user.uid, newQuote));
    }
  };

  const handleUpdateQuote = (updatedQuote: Quote) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q))
    );
    if (previewQuote && previewQuote.id === updatedQuote.id) {
      setPreviewQuote(updatedQuote);
    }
    if (user) {
      persist(() => updateQuoteInDb(user.uid, updatedQuote));
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    if (previewQuote && previewQuote.id === quoteId) {
      setPreviewQuote(null);
    }
    if (user) {
      persist(() => deleteQuoteInDb(user.uid, quoteId));
    }
  };

  const handleConvertQuoteToOrder = (
    quote: Quote,
    options: ConvertQuoteOptions
  ): Order => {
    const orderId = `ord-${Date.now()}`;
    const orderNumber = `CMD-2026-${String(orders.length + 90).padStart(3, '0')}`;
    const netSubtotal = Math.max(
      0,
      quote.subtotal - (quote.discountAmount || 0)
    );
    const notesParts: string[] = [
      `Converti depuis devis ${quote.quoteNumber}`,
    ];
    if (quote.discountAmount > 0) {
      notesParts.push(`Remise commerciale accordée : ${quote.discountAmount} FCFA`);
    }
    if (quote.notes) {
      notesParts.push(quote.notes);
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const isQuotePaid = options.paymentStatus === 'PAID';
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      deliveryCity: quote.deliveryCity,
      deliveryAddress: quote.deliveryAddress,
      items: quote.items,
      subtotal: netSubtotal,
      taxRate: quote.taxRate,
      taxLabel: quote.taxLabel,
      taxAmount: quote.taxAmount,
      deliveryFee: quote.deliveryFee,
      totalAmount: quote.totalAmount,
      paymentMethod: options.paymentMethod,
      paymentStatus: isQuotePaid ? 'PAID' : 'UNPAID',
      amountPaid: isQuotePaid ? quote.totalAmount : 0,
      ...(isQuotePaid ? { paymentConfirmedAt: nowStr } : {}),
      status: options.paymentStatus,
      date: nowStr,
      channel: options.channel,
      notes: notesParts.join(' • '),
    };

    const { updatedProducts, movements, newCustomer } = buildOrderSideEffects(
      newOrder,
      products
    );

    setOrders((prev) => [newOrder, ...prev]);
    setQuotes((prev) =>
      prev.map((q) =>
        q.id === quote.id
          ? {
              ...q,
              status: 'CONVERTED',
              convertedOrderId: orderId,
              convertedOrderNumber: orderNumber,
            }
          : q
      )
    );

    if (newCustomer) {
      setCustomers((prev) => [newCustomer, ...prev]);
    }

    const updatedMap = new Map(updatedProducts.map((p) => [p.id, p]));
    setProducts((prev) =>
      prev.map((p) => {
        const upd = updatedMap.get(p.id);
        if (upd && upd.stock <= upd.minStockAlert) {
          checkAndNotifyStock(upd);
        }
        return upd || p;
      })
    );

    setStockMovements((prev) => [...movements, ...prev]);

    if (user) {
      persist(() =>
        convertQuoteToOrderInDb(user.uid, {
          quoteId: quote.id,
          order: newOrder,
          updatedProducts,
          movements,
          newCustomer,
          storeSlug: merchant.storeSlug,
        })
      );
    }

    return newOrder;
  };

  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'PENDING'
  ).length;
  const pendingPaymentsCount = orders.filter((o) => {
    if (o.status === 'CANCELLED') return false;
    const pStatus = getEffectiveOrderPaymentStatus(o, merchant);
    return pStatus !== 'PAID' && pStatus !== 'REFUNDED';
  }).length;
  const acceptedQuotesCount = quotes.filter(
    (q) => q.status === 'ACCEPTED'
  ).length;
  const lowStockProducts = products.filter((p) => p.stock <= p.minStockAlert);

  // If in Public Storefront mode
  if (appMode === 'public_store') {
    const isViewingSharedShop = Boolean(sharedShopSlug);
    const isOwnerOfSharedShop = Boolean(
      isViewingSharedShop &&
        user &&
        publicStoreBundle &&
        user.uid === publicStoreBundle.ownerId
    );
    const isExternalVisitor = isViewingSharedShop && !isOwnerOfSharedShop;

    return (
      <PublicStorefrontView
        merchant={
          isViewingSharedShop && publicStoreBundle
            ? publicStoreBundle.merchant
            : merchant
        }
        products={
          isViewingSharedShop && publicStoreBundle
            ? publicStoreBundle.products
            : products
        }
        isExternalVisitor={isExternalVisitor}
        isLoadingStore={isViewingSharedShop && isLoadingPublicStore}
        storeNotFoundSlug={isViewingSharedShop ? publicStoreNotFoundSlug : null}
        onBackToDashboard={() => {
          if (isViewingSharedShop) {
            onClearSharedShopSlug();
            setAppMode(isOwnerOfSharedShop ? 'merchant' : 'landing');
          } else {
            setAppMode('merchant');
          }
        }}
        onNewCustomerOrder={(ord) => handleRegisterOrder(ord)}
      />
    );
  }

  // If on Landing Page mode
  if (appMode === 'landing') {
    return (
      <>
        <LandingPage
          onEnterApp={() => setAppMode('merchant')}
          onOpenAuth={(mode) => {
            setAuthInitialMode(mode);
            setIsAuthOpen(true);
          }}
          onOpenStorePreview={() => setAppMode('public_store')}
        />
        <AuthModal
          isOpen={isAuthOpen}
          initialMode={authInitialMode}
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={(data) => {
            if (data) {
              setMerchant((prev) => ({ ...prev, ...data }));
            }
            setIsAuthOpen(false);
            setAppMode('merchant');
          }}
        />
      </>
    );
  }

  // Merchant Dashboard Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingOrdersCount={pendingOrdersCount}
        pendingPaymentsCount={pendingPaymentsCount}
        acceptedQuotesCount={acceptedQuotesCount}
        lowStockCount={lowStockProducts.length}
        merchant={merchant}
        onOpenStorePreview={() => setAppMode('public_store')}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setIsAuthOpen(true);
        }}
        onLogout={() => setAppMode('landing')}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Navbar with Real-time Alerts */}
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          merchant={merchant}
          lowStockProducts={lowStockProducts}
          recentOrders={orders}
          onOpenStorePreview={() => setAppMode('public_store')}
          onGoToLanding={() => setAppMode('landing')}
          onOpenQuickSale={() => setCurrentTab('pos')}
          onOpenAuth={() => {
            setAuthInitialMode('login');
            setIsAuthOpen(true);
          }}
          setIsMobileOpen={setIsMobileSidebarOpen}
          onQuickReplenishStock={handleQuickReplenishStock}
        />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              products={products}
              orders={orders}
              merchant={merchant}
              setCurrentTab={setCurrentTab}
              onOpenQuickSale={() => setCurrentTab('pos')}
              onOpenStorePreview={() => setAppMode('public_store')}
              onSelectOrder={(order) => setSelectedOrder(order)}
              onAddNewProduct={() => {
                setCurrentTab('products');
                setIsAddProductModalOpen(true);
              }}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              isAddModalOpen={isAddProductModalOpen}
              setIsAddModalOpen={setIsAddProductModalOpen}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersView
              orders={orders}
              merchant={merchant}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onConfirmOrderPayment={handleConfirmOrderPayment}
              onOpenInvoice={(order) => setInvoiceOrder(order)}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentsView
              orders={orders}
              merchant={merchant}
              sellerPayouts={sellerPayouts}
              onConfirmOrderPayment={handleConfirmOrderPayment}
              onAddSellerPayout={handleAddSellerPayout}
              onCompleteSellerPayout={handleCompleteSellerPayout}
              onUpdateMerchant={handleUpdateMerchant}
              onOpenInvoice={(order) => setInvoiceOrder(order)}
            />
          )}

          {currentTab === 'quotes' && (
            <QuotesView
              quotes={quotes}
              products={products}
              customers={customers}
              merchant={merchant}
              onAddQuote={handleAddQuote}
              onUpdateQuote={handleUpdateQuote}
              onDeleteQuote={handleDeleteQuote}
              onConvertQuoteToOrder={handleConvertQuoteToOrder}
              onPreviewQuote={(q) => setPreviewQuote(q)}
              onNavigateToOrder={(orderId) => {
                const found = orders.find((o) => o.id === orderId) || null;
                setCurrentTab('orders');
                setSelectedOrder(found);
              }}
              convertingQuoteTarget={convertingQuoteTarget}
              setConvertingQuoteTarget={setConvertingQuoteTarget}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView
              customers={customers}
              orders={orders}
              merchant={merchant}
              promoLogs={promoLogs}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onRecordPromoCampaign={handleRecordPromoCampaign}
              onOpenInvoice={(order) => setInvoiceOrder(order)}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              products={products}
              stockMovements={stockMovements}
              suppliers={suppliers}
              supplierPayments={supplierPayments}
              onUpdateStock={handleUpdateStock}
              onReceiveInvoiceStock={handleBatchReceiveInvoiceStock}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onAddSupplierPayment={handleAddSupplierPayment}
            />
          )}

          {currentTab === 'pos' && (
            <PosView
              products={products}
              merchant={merchant}
              onCompleteSale={handleRegisterOrder}
              onOpenInvoice={(order) => setInvoiceOrder(order)}
            />
          )}

          {currentTab === 'shop' && (
            <ShopManagementView
              key={`${merchant.storeName}-${merchant.currency}-${merchant.taxRate}-${merchant.taxEnabled}`}
              merchant={merchant}
              onUpdateMerchant={handleUpdateMerchant}
              onOpenStorePreview={() => setAppMode('public_store')}
              onOpenPayments={() => setCurrentTab('payments')}
            />
          )}

          {currentTab === 'anti_fraud' && (
            <AntiFraudView
              products={products}
              onSaveProductVerification={handleSaveProductVerification}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              products={products}
              orders={orders}
              merchant={merchant}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg text-[10px] font-semibold ${
            currentTab === 'dashboard' ? 'text-sky-600' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Tableau</span>
        </button>

        <button
          onClick={() => setCurrentTab('quotes')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg text-[10px] font-semibold relative ${
            currentTab === 'quotes' ? 'text-sky-600' : 'text-slate-500'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Devis</span>
          {acceptedQuotesCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('pos')}
          className="flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold text-sky-600"
        >
          <div className="w-10 h-10 -mt-5 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/30">
            <Calculator className="w-5 h-5" />
          </div>
          <span>Caisse POS</span>
        </button>

        <button
          onClick={() => setCurrentTab('orders')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg text-[10px] font-semibold relative ${
            currentTab === 'orders' ? 'text-sky-600' : 'text-slate-500'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Commandes</span>
          {pendingOrdersCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>

        <button
          onClick={() => setAppMode('public_store')}
          className="flex flex-col items-center gap-0.5 p-1 rounded-lg text-[10px] font-semibold text-slate-500"
        >
          <Store className="w-5 h-5 text-emerald-600" />
          <span>Vitrine</span>
        </button>
      </div>

      {/* Normalized Invoice / Receipt Modal */}
      <InvoiceModal
        order={invoiceOrder}
        merchant={merchant}
        onClose={() => setInvoiceOrder(null)}
      />

      {/* Proforma / Devis Preview Modal */}
      <QuoteModal
        quote={previewQuote}
        merchant={merchant}
        onClose={() => setPreviewQuote(null)}
        onAcceptQuote={(q) => handleUpdateQuote({ ...q, status: 'ACCEPTED' })}
        onOpenConvertModal={(q) => {
          setPreviewQuote(null);
          setCurrentTab('quotes');
          setConvertingQuoteTarget(q);
        }}
      />

      {/* Auth Modal for Google Sign-In */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authInitialMode}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(data) => {
          if (data) {
            setMerchant((prev) => ({ ...prev, ...data }));
          }
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
}

export default function App() {
  const { user, authReady } = useFirebaseAuth();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [merchant, setMerchant] = useState<MerchantProfile>(
    initialMerchantProfile
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(
    initialStockMovements
  );
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [promoLogs, setPromoLogs] = useState<PromoCampaignLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(
    initialSupplierPayments
  );
  const [sellerPayouts, setSellerPayouts] = useState<SellerPayout[]>(
    initialSellerPayouts
  );
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [asyncError, setAsyncError] = useState<unknown>(null);
  const [sharedShopSlug, setSharedShopSlug] = useState<string | null>(() =>
    getShopSlugFromUrl()
  );
  const [publicStoreBundle, setPublicStoreBundle] =
    useState<PublicStorefrontBundle | null>(null);
  const [isLoadingPublicStore, setIsLoadingPublicStore] = useState<boolean>(() =>
    Boolean(getShopSlugFromUrl())
  );
  const [publicStoreNotFoundSlug, setPublicStoreNotFoundSlug] = useState<
    string | null
  >(null);

  if (asyncError) {
    throw asyncError instanceof Error
      ? asyncError
      : new Error(String(asyncError));
  }

  useEffect(() => {
    if (!sharedShopSlug) {
      setPublicStoreBundle(null);
      setIsLoadingPublicStore(false);
      setPublicStoreNotFoundSlug(null);
      return;
    }

    let cancelled = false;
    setIsLoadingPublicStore(true);
    setPublicStoreNotFoundSlug(null);

    loadPublicStorefrontBySlug(sharedShopSlug)
      .then((bundle) => {
        if (cancelled) return;
        if (!bundle) {
          setPublicStoreBundle(null);
          setPublicStoreNotFoundSlug(sharedShopSlug);
        } else {
          setPublicStoreBundle(bundle);
          setPublicStoreNotFoundSlug(null);
        }
        setIsLoadingPublicStore(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setIsLoadingPublicStore(false);
          setAsyncError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sharedShopSlug]);

  const handleClearSharedShopSlug = () => {
    setSharedShopSlug(null);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('shop');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      // Revert to local starter dataset when signed out
      setProducts(initialProducts);
      setOrders(initialOrders);
      setQuotes(initialQuotes);
      setMerchant(initialMerchantProfile);
      setStockMovements(initialStockMovements);
      setCustomers(initialCustomers);
      setPromoLogs([]);
      setSuppliers(initialSuppliers);
      setSupplierPayments(initialSupplierPayments);
      setSellerPayouts(initialSellerPayouts);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        await ensureUserWorkspace(user, {
          merchant: initialMerchantProfile,
          products: initialProducts,
          orders: initialOrders,
          quotes: initialQuotes,
          customers: initialCustomers,
          suppliers: initialSuppliers,
          supplierPayments: initialSupplierPayments,
          sellerPayouts: initialSellerPayouts,
          stockMovements: initialStockMovements,
        });
        if (cancelled) return;
        unsub = subscribeToMerchantWorkspace(user.uid, {
          onMerchant: setMerchant,
          onProducts: setProducts,
          onOrders: setOrders,
          onQuotes: setQuotes,
          onCustomers: setCustomers,
          onPromoLogs: setPromoLogs,
          onStockMovements: setStockMovements,
          onSuppliers: setSuppliers,
          onSupplierPayments: setSupplierPayments,
          onSellerPayouts: setSellerPayouts,
        });
      } catch (err) {
        if (!cancelled) {
          setAsyncError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [authReady, user]);

  return (
    <CurrencyProvider
      initialCurrency={
        sharedShopSlug && publicStoreBundle
          ? publicStoreBundle.merchant.currency
          : merchant.currency
      }
    >
      <NotificationProvider
        products={products}
        onNavigateToInventory={() => setCurrentTab('inventory')}
      >
        <AppContent
          products={products}
          setProducts={setProducts}
          orders={orders}
          setOrders={setOrders}
          quotes={quotes}
          setQuotes={setQuotes}
          merchant={merchant}
          setMerchant={setMerchant}
          stockMovements={stockMovements}
          setStockMovements={setStockMovements}
          customers={customers}
          setCustomers={setCustomers}
          promoLogs={promoLogs}
          setPromoLogs={setPromoLogs}
          suppliers={suppliers}
          setSuppliers={setSuppliers}
          supplierPayments={supplierPayments}
          setSupplierPayments={setSupplierPayments}
          sellerPayouts={sellerPayouts}
          setSellerPayouts={setSellerPayouts}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onAsyncError={setAsyncError}
          sharedShopSlug={sharedShopSlug}
          onClearSharedShopSlug={handleClearSharedShopSlug}
          publicStoreBundle={publicStoreBundle}
          isLoadingPublicStore={isLoadingPublicStore}
          publicStoreNotFoundSlug={publicStoreNotFoundSlug}
        />
      </NotificationProvider>
    </CurrencyProvider>
  );
}
