import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Check, 
  Printer, 
  Smartphone,
  Banknote,
  ShoppingBag,
  CheckCircle2,
  Copy,
  Hash,
  AlertCircle,
  Send,
  ScanBarcode,
  CreditCard
} from 'lucide-react';
import { Product, Order, OrderItem, PaymentMethod, PaymentStatus, MerchantProfile } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { getActiveTaxRate, calculateTaxAmount } from '../utils/tax';
import { getEnabledPaymentMethods, PAYMENT_CHANNEL_META } from '../utils/payment';

interface PosViewProps {
  products: Product[];
  merchant: MerchantProfile;
  onCompleteSale: (order: Order) => void;
  onOpenInvoice: (order: Order) => void;
}

type MobileMoneyProvider = 'MTN_MOMO' | 'MOOV_MONEY' | 'CELTIIS_CASH';

const MOBILE_MONEY_CONFIG: Record<MobileMoneyProvider, {
  label: string;
  shortName: string;
  ussd: string;
  prefixes: string;
  accentBg: string;
  accentText: string;
  borderClass: string;
  badgeBg: string;
  dotColor: string;
}> = {
  MTN_MOMO: {
    label: 'MTN Mobile Money (MoMo)',
    shortName: 'MTN MoMo',
    ussd: '*880#',
    prefixes: '01 97 / 01 96 / 01 66 / 01 67',
    accentBg: 'bg-amber-400',
    accentText: 'text-slate-900',
    borderClass: 'border-amber-400 bg-amber-50/70',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    dotColor: 'bg-amber-500',
  },
  MOOV_MONEY: {
    label: 'Moov Money (Flooz Bénin)',
    shortName: 'Moov Money',
    ussd: '*155#',
    prefixes: '01 95 / 01 94 / 01 64 / 01 65',
    accentBg: 'bg-[#004D98]',
    accentText: 'text-white',
    borderClass: 'border-[#004D98] bg-blue-50/70',
    badgeBg: 'bg-blue-100 text-[#004D98] border-blue-300',
    dotColor: 'bg-[#004D98]',
  },
  CELTIIS_CASH: {
    label: 'Celtiis Cash (SBIN)',
    shortName: 'Celtiis Cash',
    ussd: '*889#',
    prefixes: '01 40 / 01 41 / 01 42',
    accentBg: 'bg-[#FF6600]',
    accentText: 'text-white',
    borderClass: 'border-[#FF6600] bg-orange-50/70',
    badgeBg: 'bg-orange-100 text-orange-900 border-orange-300',
    dotColor: 'bg-[#FF6600]',
  },
};

export const PosView: React.FC<PosViewProps> = ({
  products,
  merchant,
  onCompleteSale,
  onOpenInvoice,
}) => {
  const { formatPrice, currency } = useCurrency();
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const enabledMethods = getEnabledPaymentMethods(merchant);
  const enabledMomoProviders = enabledMethods.filter(
    (m): m is MobileMoneyProvider =>
      m === 'MTN_MOMO' || m === 'MOOV_MONEY' || m === 'CELTIIS_CASH'
  );
  const isCashEnabled = enabledMethods.includes('CASH_ON_DELIVERY');
  const isCardEnabled = enabledMethods.includes('CARTE_BANCAIRE');

  // Payment mode state: 'CASH', 'MOBILE_MONEY', or 'CARD'
  const [paymentCategory, setPaymentCategory] = useState<'CASH' | 'MOBILE_MONEY' | 'CARD'>(() => {
    if (enabledMomoProviders.length > 0) return 'MOBILE_MONEY';
    if (isCashEnabled) return 'CASH';
    return isCardEnabled ? 'CARD' : 'CASH';
  });
  const [momoProvider, setMomoProvider] = useState<MobileMoneyProvider>(
    () => enabledMomoProviders[0] || 'MTN_MOMO'
  );
  const [momoTxRef, setMomoTxRef] = useState('');
  const [cardTxRef, setCardTxRef] = useState('');
  const [ussdPushSent, setUssdPushSent] = useState(false);
  const [copiedMerchantNum, setCopiedMerchantNum] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState<number>(0);

  const [customerName, setCustomerName] = useState('Client Comptoir');
  const [customerPhone, setCustomerPhone] = useState('+229 ');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const effectiveCategory =
    paymentCategory === 'MOBILE_MONEY' && enabledMomoProviders.length === 0
      ? isCashEnabled
        ? 'CASH'
        : isCardEnabled
        ? 'CARD'
        : 'CASH'
      : paymentCategory === 'CARD' && !isCardEnabled
      ? enabledMomoProviders.length > 0
        ? 'MOBILE_MONEY'
        : 'CASH'
      : paymentCategory;

  const activeMomoProvider = enabledMomoProviders.includes(momoProvider)
    ? momoProvider
    : enabledMomoProviders[0] || 'MTN_MOMO';

  const paymentMethod: PaymentMethod =
    effectiveCategory === 'CASH'
      ? 'CASH_ON_DELIVERY'
      : effectiveCategory === 'CARD'
      ? 'CARTE_BANCAIRE'
      : activeMomoProvider;

  const categories = ['ALL', 'Mode & Wax', 'Cosmétique Bio', 'Alimentation Locale', 'Artisanat & Déco'];

  const filteredProducts = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(q) || 
                          p.sku.toLowerCase().includes(q) ||
                          (p.barcode ? p.barcode.toLowerCase().includes(q) : false);
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCat && p.stock > 0;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !searchTerm.trim()) return;
    const q = searchTerm.trim().toLowerCase();
    const exactMatch = products.find(
      p => p.stock > 0 && ((p.barcode && p.barcode.toLowerCase() === q) || p.sku.toLowerCase() === q)
    );
    if (exactMatch) {
      e.preventDefault();
      addToCart(exactMatch);
      setScanNotice(`Code "${searchTerm.trim()}" scanné : ${exactMatch.name} ajouté`);
      setSearchTerm('');
      setTimeout(() => setScanNotice(null), 3500);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          productName: product.name,
          unitPrice: product.sellPrice,
          quantity: 1,
          image: product.image,
        }];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const prod = products.find(p => p.id === productId);
          const newQty = item.quantity + delta;
          if (prod && newQty > prod.stock) return item;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as OrderItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashReceived(0);
    setMomoTxRef('');
    setCardTxRef('');
    setUssdPushSent(false);
    setIsPartialPayment(false);
    setPartialAmount(0);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const activeTaxRate = getActiveTaxRate(merchant);
  const activeTaxLabel = merchant.taxLabel?.trim() || 'TVA';
  const taxAmount = calculateTaxAmount(subtotal, activeTaxRate);
  const totalAmount = subtotal + taxAmount;
  const effectiveDueNow = isPartialPayment
    ? Math.max(0, Math.min(totalAmount, partialAmount))
    : totalAmount;
  const changeToReturn = Math.max(0, cashReceived - effectiveDueNow);
  const cashShortfall =
    cashReceived > 0 && cashReceived < effectiveDueNow ? effectiveDueNow - cashReceived : 0;

  const getMerchantMomoNumber = (provider: MobileMoneyProvider) => {
    switch (provider) {
      case 'MTN_MOMO': return merchant.momoNumber;
      case 'MOOV_MONEY': return merchant.moovNumber;
      case 'CELTIIS_CASH': return merchant.celtiisNumber;
    }
  };

  const handleCopyMerchantNumber = () => {
    const num = getMerchantMomoNumber(activeMomoProvider);
    navigator.clipboard?.writeText(num);
    setCopiedMerchantNum(true);
    setTimeout(() => setCopiedMerchantNum(false), 2000);
  };

  const handleSimulateUssdPush = () => {
    if (cart.length === 0) return;
    setUssdPushSent(true);
    if (!momoTxRef.trim()) {
      const prefix = activeMomoProvider === 'MTN_MOMO' ? 'MOMO' : activeMomoProvider === 'MOOV_MONEY' ? 'FLZ' : 'CLT';
      setMomoTxRef(`${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
    }
  };

  const handleValidateSale = () => {
    if (cart.length === 0) return;
    if (effectiveCategory === 'CASH' && cashShortfall > 0) return;

    const paidAmount = isPartialPayment
      ? Math.max(0, Math.min(totalAmount, partialAmount))
      : totalAmount;
    const computedPaymentStatus: PaymentStatus =
      paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
    const isFullPaid = computedPaymentStatus === 'PAID';
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const txReference =
      effectiveCategory === 'MOBILE_MONEY'
        ? momoTxRef.trim() || undefined
        : effectiveCategory === 'CARD'
        ? cardTxRef.trim() || undefined
        : undefined;

    const paymentNote =
      effectiveCategory === 'CASH'
        ? cashReceived > 0
          ? `Encaissement espèces comptoir : remis ${formatPrice(cashReceived)}, rendu ${formatPrice(changeToReturn)}.`
          : `Encaissement espèces comptoir (${isFullPaid ? 'montant exact' : `acompte ${formatPrice(paidAmount)}`}).`
        : effectiveCategory === 'CARD'
        ? `Paiement Carte Bancaire / TPE${txReference ? ` • Réf: ${txReference}` : ''}`
        : `Paiement ${MOBILE_MONEY_CONFIG[activeMomoProvider].label}${txReference ? ` • Réf: ${txReference}` : ''}`;

    const newOrder: Order = {
      id: `pos-${Date.now()}`,
      orderNumber: `POS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim() || 'Client Comptoir',
      customerPhone: customerPhone.trim() || '+229 00 00 00 00',
      deliveryCity: `${merchant.city} (Vente en Boutique)`,
      deliveryAddress: 'Comptoir Magasin',
      items: [...cart],
      subtotal,
      taxRate: activeTaxRate,
      taxLabel: activeTaxLabel,
      taxAmount,
      deliveryFee: 0,
      totalAmount,
      paymentMethod,
      paymentStatus: computedPaymentStatus,
      amountPaid: paidAmount,
      ...(txReference ? { paymentReference: txReference } : {}),
      ...(isFullPaid ? { paymentConfirmedAt: nowStr } : {}),
      status: isFullPaid ? 'DELIVERED' : 'PENDING',
      date: nowStr,
      channel: 'POS',
      notes: paymentNote,
    };

    onCompleteSale(newOrder);
    setLastCompletedOrder(newOrder);
    clearCart();
  };

  const activeMomoConfig = MOBILE_MONEY_CONFIG[activeMomoProvider];
  const merchantMomoNum = getMerchantMomoNumber(activeMomoProvider);

  // Authentic BCEAO FCFA banknote denominations
  const bceaoNotes = [1000, 2000, 5000, 10000];

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Caisse Express & Vente au Comptoir (POS)
          </h2>
          <p className="text-xs text-slate-500">
            Saisie rapide en boutique : Cash FCFA, Mobile Money (MTN / Moov / Celtiis) ou Carte Bancaire / TPE
          </p>
        </div>

        {lastCompletedOrder && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>
              Vente <strong>{lastCompletedOrder.orderNumber}</strong> ({PAYMENT_CHANNEL_META[lastCompletedOrder.paymentMethod].shortLabel}
              {lastCompletedOrder.paymentStatus === 'PARTIAL' ? ' • Acompte' : ''}) enregistrée !
            </span>
            <button
              onClick={() => onOpenInvoice(lastCompletedOrder)}
              className="ml-2 underline font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer reçu
            </button>
          </div>
        )}
      </div>

      {/* POS Layout: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Product Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Categories */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Nom, SKU ou code-barres EAN (Entrée pour ajouter)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0B192C] to-sky-700 hover:from-sky-700 hover:to-blue-600 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all flex items-center gap-2 shrink-0"
                title="Utiliser la caméra pour scanner un code-barres produit"
              >
                <ScanBarcode className="w-4 h-4 text-sky-300" />
                <span>Scanner</span>
              </button>
            </div>

            {scanNotice && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{scanNotice}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-sky-600 text-white shadow-xs' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat === 'ALL' ? 'Tous les articles' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Touch Grid of Products */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const inCartItem = cart.find(i => i.productId === p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between select-none active:scale-[0.98] ${
                    inCartItem 
                      ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-300' 
                      : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm'
                  }`}
                >
                  {inCartItem && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                      {inCartItem.quantity}
                    </span>
                  )}
                  <div>
                    <img 
                      src={p.image} 
                      alt={p.name} 
                      className="w-full h-24 object-cover rounded-xl mb-2" 
                    />
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                      {p.name}
                    </h4>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-black text-xs text-sky-700">
                      {formatPrice(p.sellPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Stock: {p.stock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Cart & Immediate Checkout (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm sticky top-20 flex flex-col justify-between">
          <div>
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Ticket de Caisse
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-500 hover:underline font-medium"
                >
                  Vider le panier
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="my-3 max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <p className="font-medium">Panier vide</p>
                  <p className="text-[11px] mt-1">Touchez un produit à gauche pour l'ajouter</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {formatPrice(item.unitPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="p-1 text-slate-600 hover:bg-white rounded transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1 text-slate-600 hover:bg-white rounded transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-black text-slate-900 w-20 text-right">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Customer Quick Inputs */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Nom Client</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Téléphone Client (Bénin)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+229 01 97 ..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Beninese Payment Method Selector */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Méthode de paiement (Bénin)
                </label>
                <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  {effectiveCategory === 'CASH'
                    ? 'Espèces FCFA'
                    : effectiveCategory === 'CARD'
                    ? 'Carte / TPE'
                    : activeMomoConfig.shortName}
                </span>
              </div>

              {/* Primary Mode Toggle: Mobile Money / Cash / Carte TPE */}
              <div className={`grid gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 mb-3 ${
                isCardEnabled && enabledMomoProviders.length > 0 && isCashEnabled
                  ? 'grid-cols-3'
                  : 'grid-cols-2'
              }`}>
                {enabledMomoProviders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentCategory('MOBILE_MONEY')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                      effectiveCategory === 'MOBILE_MONEY'
                        ? 'bg-[#0B192C] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Mobile Money</span>
                  </button>
                )}

                {(isCashEnabled || (enabledMomoProviders.length === 0 && !isCardEnabled)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentCategory('CASH');
                      setUssdPushSent(false);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                      effectiveCategory === 'CASH'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 shrink-0" />
                    <span>Espèces</span>
                  </button>
                )}

                {isCardEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentCategory('CARD');
                      setUssdPushSent(false);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                      effectiveCategory === 'CARD'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span>Carte / TPE</span>
                  </button>
                )}
              </div>

              {/* Sub-panel: Mobile Money Operators */}
              {effectiveCategory === 'MOBILE_MONEY' && (
                <div className="space-y-3">
                  <div className={`grid gap-1.5 text-xs font-bold ${
                    enabledMomoProviders.length === 1
                      ? 'grid-cols-1'
                      : enabledMomoProviders.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                  }`}>
                    {enabledMomoProviders.map((provider) => {
                      const cfg = MOBILE_MONEY_CONFIG[provider];
                      const isActive = activeMomoProvider === provider;
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => {
                            setMomoProvider(provider);
                            setUssdPushSent(false);
                          }}
                          className={`py-2 px-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                            isActive
                              ? `${cfg.accentBg} ${cfg.accentText} border-transparent shadow-sm scale-[1.02]`
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[11px] font-extrabold leading-tight">{cfg.shortName}</span>
                          <span className={`text-[9px] font-mono ${isActive ? 'opacity-90' : 'text-slate-400'}`}>
                            USSD {cfg.ussd}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Merchant Mobile Money Guidance & USSD Push Simulation */}
                  <div className={`p-3 rounded-2xl border text-xs space-y-2.5 ${activeMomoConfig.borderClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Compte Marchand {activeMomoConfig.shortName}
                        </p>
                        <p className="font-mono font-black text-sm text-slate-900">
                          {merchantMomoNum}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyMerchantNumber}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center gap-1 shadow-2xs"
                        title="Copier le numéro marchand"
                      >
                        {copiedMerchantNum ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMerchantNum ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 bg-white/70 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                      <span>Code rapide client : <strong className="font-mono text-slate-900">{activeMomoConfig.ussd}</strong></span>
                      <span className="font-mono text-slate-500">Préfixes : {activeMomoConfig.prefixes}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={momoTxRef}
                          onChange={(e) => setMomoTxRef(e.target.value)}
                          placeholder="Réf. SMS / ID Transaction (optionnel)"
                          className="w-full pl-7 pr-2.5 py-1.5 text-[11px] rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={cart.length === 0}
                        onClick={handleSimulateUssdPush}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 ${
                          cart.length === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : ussdPushSent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                        title="Simuler l'envoi d'une demande de paiement sur le téléphone du client"
                      >
                        {ussdPushSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3 h-3" />}
                        <span>{ussdPushSent ? 'Push envoyé ✓' : 'Demande Push'}</span>
                      </button>
                    </div>

                    {ussdPushSent && (
                      <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Invite {activeMomoConfig.shortName} simulée pour {formatPrice(effectiveDueNow)} ({customerPhone.trim() || 'client'}).</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-panel: Carte Bancaire / TPE */}
              {effectiveCategory === 'CARD' && (
                <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs space-y-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      Terminal TPE / Compte Bancaire Pro
                    </p>
                    <p className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                      {merchant.bankAccount || 'Terminal TPE Comptoir (Visa / Mastercard / GIM-UEMOA)'}
                    </p>
                  </div>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={cardTxRef}
                      onChange={(e) => setCardTxRef(e.target.value)}
                      placeholder="N° autorisation / ticket TPE (optionnel)"
                      className="w-full pl-7 pr-2.5 py-1.5 text-[11px] rounded-lg border border-purple-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Sub-panel: Cash Payment with BCEAO FCFA Quick Banknotes & Change Calculator */}
              {effectiveCategory === 'CASH' && (
                <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-emerald-950 font-semibold">Montant remis (FCFA) :</span>
                    <input
                      type="number"
                      min={0}
                      value={cashReceived || ''}
                      placeholder={effectiveDueNow > 0 ? String(effectiveDueNow) : '0'}
                      onChange={(e) => setCashReceived(Math.max(0, Number(e.target.value)))}
                      className="w-32 px-2.5 py-1.5 text-right font-black rounded-lg border border-emerald-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Quick BCEAO Banknote Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={effectiveDueNow === 0}
                      onClick={() => setCashReceived(effectiveDueNow)}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[10px] font-bold transition-colors"
                    >
                      Exact
                    </button>
                    {bceaoNotes.map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => setCashReceived(prev => prev + note)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold font-mono transition-colors"
                      >
                        +{note.toLocaleString('fr-FR')} F
                      </button>
                    ))}
                    {cashReceived > 0 && (
                      <button
                        type="button"
                        onClick={() => setCashReceived(0)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-rose-600 ml-auto"
                      >
                        Effacer
                      </button>
                    )}
                  </div>

                  {currency !== 'FCFA' && cashReceived > 0 && (
                    <p className="text-[10px] text-emerald-800 font-medium">
                      Équivalent saisi : {formatPrice(cashReceived)}
                    </p>
                  )}

                  {cashShortfall > 0 && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-amber-200 text-amber-800 font-bold">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Montant insuffisant :
                      </span>
                      <span className="font-mono">Manque {formatPrice(cashShortfall)}</span>
                    </div>
                  )}

                  {cashReceived >= effectiveDueNow && effectiveDueNow > 0 && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200 text-emerald-900 font-bold">
                      <span>Monnaie à rendre :</span>
                      <span className="text-sm font-black font-mono text-emerald-700">{formatPrice(changeToReturn)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Acompte / Partial Payment Toggle */}
              {cart.length > 0 && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-semibold text-slate-700 text-[11px]">
                      Paiement partiel (Acompte / Crédit)
                    </span>
                    <input
                      type="checkbox"
                      checked={isPartialPayment}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsPartialPayment(checked);
                        if (checked && partialAmount === 0) {
                          setPartialAmount(Math.round(totalAmount / 2));
                        }
                      }}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </label>

                  {isPartialPayment && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                      <span className="text-[11px] text-slate-600">Montant encaissé aujourd'hui :</span>
                      <input
                        type="number"
                        min={0}
                        max={totalAmount}
                        value={partialAmount}
                        onChange={(e) =>
                          setPartialAmount(Math.max(0, Math.min(totalAmount, Number(e.target.value) || 0)))
                        }
                        className="w-28 px-2 py-1 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold text-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart Total & Checkout Button */}
          <div className="pt-4 border-t border-slate-200 mt-4 space-y-2.5">
            <div className="space-y-1 text-xs bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-600">
                <span>Sous-total HT :</span>
                <span className="font-mono font-semibold tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>
                  {activeTaxLabel} ({activeTaxRate > 0 ? `${activeTaxRate}%` : 'Exonéré 0%'}) :
                </span>
                <span className="font-mono font-semibold text-amber-700 tabular-nums">
                  {formatPrice(taxAmount)}
                </span>
              </div>
              {isPartialPayment && totalAmount > 0 && (
                <div className="flex items-center justify-between text-sky-700 font-bold pt-1 border-t border-slate-200">
                  <span>Acompte encaissé / Reste dû :</span>
                  <span className="font-mono tabular-nums">
                    {formatPrice(effectiveDueNow)} / {formatPrice(Math.max(0, totalAmount - effectiveDueNow))}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <div>
                <span className="text-xs font-bold text-slate-700 block">
                  {isPartialPayment ? 'À Encaisser Maintenant :' : 'Net à Payer (TTC) :'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Via{' '}
                  {effectiveCategory === 'CASH'
                    ? 'Espèces au comptoir'
                    : effectiveCategory === 'CARD'
                    ? 'Carte Bancaire / TPE'
                    : activeMomoConfig.label}
                </span>
              </div>
              <span className="text-2xl font-black font-heading text-slate-900 tabular-nums">
                {formatPrice(effectiveDueNow)}
              </span>
            </div>

            <button
              disabled={cart.length === 0 || (effectiveCategory === 'CASH' && cashShortfall > 0)}
              onClick={handleValidateSale}
              className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all ${
                cart.length > 0 && !(effectiveCategory === 'CASH' && cashShortfall > 0)
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white active:scale-95 shadow-emerald-600/25' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-5 h-5" />
              <span>
                Valider l'Encaissement{' '}
                {effectiveCategory === 'CASH'
                  ? 'Cash'
                  : effectiveCategory === 'CARD'
                  ? 'Carte'
                  : activeMomoConfig.shortName}{' '}
                ({formatPrice(effectiveDueNow)})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductScanned={(product, scannedCode) => {
          addToCart(product);
          setScanNotice(`Scanné (${scannedCode}) : ${product.name} ajouté au ticket`);
          setTimeout(() => setScanNotice(null), 3500);
        }}
      />
    </div>
  );
};
