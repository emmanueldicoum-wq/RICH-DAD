import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  MapPin, 
  Phone, 
  Truck, 
  X, 
  Plus, 
  Minus, 
  Check, 
  ArrowLeft, 
  ExternalLink,
  ShieldCheck,
  CreditCard,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Copy,
  Hash,
  AlertCircle
} from 'lucide-react';
import { Product, MerchantProfile, Order, OrderItem, PaymentMethod } from '../types';
import { useCurrency, CURRENCY_RATES } from '../context/CurrencyContext';
import { getActiveTaxRate, calculateTaxAmount } from '../utils/tax';
import {
  PAYMENT_CHANNEL_META,
  getEnabledPaymentMethods,
  getMerchantChannelAccount,
} from '../utils/payment';
import { getShareableStoreDisplay } from '../utils/storeUrl';

interface PublicStorefrontViewProps {
  merchant: MerchantProfile;
  products: Product[];
  onBackToDashboard: () => void;
  onNewCustomerOrder: (order: Order) => void;
  isExternalVisitor?: boolean;
  isLoadingStore?: boolean;
  storeNotFoundSlug?: string | null;
}

export const PublicStorefrontView: React.FC<PublicStorefrontViewProps> = ({
  merchant,
  products,
  onBackToDashboard,
  onNewCustomerOrder,
  isExternalVisitor = false,
  isLoadingStore = false,
  storeNotFoundSlug = null,
}) => {
  const { currency, setCurrency, formatPrice, currentCurrencyDetails } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+229 ');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const enabledMethods = getEnabledPaymentMethods(merchant);
  const [deliveryZone, setDeliveryZone] = useState<'cotonou' | 'calavi' | 'portoNovo' | 'interieur'>('cotonou');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => enabledMethods[0] || 'MTN_MOMO');
  const [paymentReference, setPaymentReference] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<Order | null>(null);

  const selectedPaymentMethod: PaymentMethod = enabledMethods.includes(paymentMethod)
    ? paymentMethod
    : enabledMethods[0] || 'MTN_MOMO';
  const selectedChannelMeta = PAYMENT_CHANNEL_META[selectedPaymentMethod];
  const selectedMerchantAccount = getMerchantChannelAccount(merchant, selectedPaymentMethod);
  const isMobileMoneyMethod =
    selectedPaymentMethod === 'MTN_MOMO' ||
    selectedPaymentMethod === 'MOOV_MONEY' ||
    selectedPaymentMethod === 'CELTIIS_CASH';

  const onlineProducts = products.filter(p => p.isOnline);
  const categories = ['ALL', 'Mode & Wax', 'Cosmétique Bio', 'Alimentation Locale', 'Artisanat & Déco'];

  const filteredProducts = onlineProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
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
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as OrderItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const activeTaxRate = getActiveTaxRate(merchant);
  const activeTaxLabel = merchant.taxLabel?.trim() || 'TVA';
  const taxAmount = calculateTaxAmount(subtotal, activeTaxRate);
  const deliveryFee = merchant.deliveryRates[deliveryZone] || 1000;
  const totalAmount = subtotal + taxAmount + deliveryFee;
  const totalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  const getCityName = () => {
    switch (deliveryZone) {
      case 'cotonou': return 'Cotonou';
      case 'calavi': return 'Abomey-Calavi';
      case 'portoNovo': return 'Porto-Novo';
      case 'interieur': return 'Intérieur du Bénin (Parakou, etc.)';
    }
  };

  const handleOrderSubmit = (viaWhatsApp: boolean) => {
    if (cart.length === 0) {
      setCheckoutError('Votre panier est vide. Ajoutez au moins un article.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || customerPhone.trim() === '+229') {
      setCheckoutError('Veuillez renseigner votre nom complet et votre numéro de téléphone.');
      return;
    }
    setCheckoutError(null);

    const cleanRef = paymentReference.trim();
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `CMD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryCity: getCityName(),
      deliveryAddress: deliveryAddress.trim() || 'À convenir par téléphone',
      items: [...cart],
      subtotal,
      taxRate: activeTaxRate,
      taxLabel: activeTaxLabel,
      taxAmount,
      deliveryFee,
      totalAmount,
      paymentMethod: selectedPaymentMethod,
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      ...(cleanRef ? { paymentReference: cleanRef } : {}),
      status: 'PENDING',
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      channel: viaWhatsApp ? 'WHATSAPP' : 'STORE_FRONT',
    };

    if (isExternalVisitor && !viaWhatsApp) {
      setCheckoutError(
        'En mode vitrine client externe, cliquez sur « Commander via WhatsApp » pour envoyer directement votre panier au vendeur.'
      );
      return;
    }

    if (!isExternalVisitor) {
      onNewCustomerOrder(newOrder);
    }
    setOrderCompleted(newOrder);
    setPaymentReference('');

    if (viaWhatsApp) {
      const itemsList = cart.map(i => `- ${i.quantity}x ${i.productName} (${formatPrice(i.unitPrice * i.quantity)})`).join('\n');
      const refLine = cleanRef ? `\n🔖 Réf. Transaction : ${cleanRef}` : '';
      const text = encodeURIComponent(
        `Bonjour ${merchant.storeName} ! Je souhaite commander en ligne :\n\n` +
        `${itemsList}\n\n` +
        `📦 Sous-total HT : ${formatPrice(subtotal)}\n` +
        `🧾 ${activeTaxLabel} (${activeTaxRate}%) : ${formatPrice(taxAmount)}\n` +
        `🚚 Livraison vers : ${getCityName()} (${formatPrice(deliveryFee)})\n` +
        `💰 TOTAL TTC : ${formatPrice(totalAmount)}\n` +
        `💳 Paiement choisi : ${selectedChannelMeta.label}${refLine}\n\n` +
        `👤 Client : ${customerName}\n` +
        `📞 Téléphone : ${customerPhone}\n` +
        `📍 Adresse : ${deliveryAddress || 'Cotonou'}`
      );
      const cleanPhone = merchant.whatsapp.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    }

    setCart([]);
  };

  const handleCopyAccount = () => {
    navigator.clipboard?.writeText(selectedMerchantAccount);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 1800);
  };

  const shareableDisplay = getShareableStoreDisplay(merchant.storeSlug);

  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center max-w-sm w-full space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-600 animate-spin mx-auto" />
          <h2 className="font-heading font-bold text-slate-900 text-base">
            Chargement de la boutique...
          </h2>
          <p className="text-xs text-slate-500">
            Récupération du catalogue et des tarifs en cours.
          </p>
        </div>
      </div>
    );
  }

  if (storeNotFoundSlug) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg text-center max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-bold text-slate-900 text-lg">
            Boutique introuvable
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Aucune boutique publique active ne correspond à l&apos;identifiant{' '}
            <span className="font-mono font-bold text-slate-900">{storeNotFoundSlug}</span>.
            Vérifiez le lien partagé par le commerçant.
          </p>
          <button
            onClick={onBackToDashboard}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Découvrir BOUTIKPRO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Banner to switch back to Merchant mode */}
      <div className="bg-[#0B192C] text-white px-4 py-2.5 text-xs flex items-center justify-between sticky top-0 z-40 border-b border-slate-700 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <span className="font-semibold hidden sm:inline shrink-0">
            {isExternalVisitor ? 'Boutique Officielle :' : 'Aperçu Vitrine Publique en direct :'}
          </span>
          <span className="font-mono text-sky-300 truncate">{shareableDisplay}</span>
        </div>
        <button
          onClick={onBackToDashboard}
          className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isExternalVisitor ? 'Espace Marchand' : 'Retour Espace Marchand'}</span>
        </button>
      </div>

      {/* Store Hero Banner */}
      <div className="relative bg-gradient-to-r from-[#0B192C] via-[#1E3E62] to-[#0B192C] text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <img
            src={merchant.logo}
            alt={merchant.storeName}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-sky-400 shadow-2xl shrink-0"
          />
          <div className="text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold mb-2 border border-sky-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Boutique Officielle Certifiée • Bénin 🇧🇯</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold font-heading text-white">
              {merchant.storeName}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {merchant.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                {merchant.address}
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                {merchant.whatsapp}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {/* Customer Currency Switcher */}
            <div className="flex items-center bg-black/40 border border-white/20 rounded-2xl p-1 text-xs">
              {(['FCFA', 'EUR', 'USD'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold transition-all text-[11px] flex items-center gap-1 ${
                    currency === c 
                      ? 'bg-sky-500 text-white shadow-xs' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{CURRENCY_RATES[c].flag}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>

            {/* Floating Cart Launcher Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-sky-500/30 flex items-center gap-3 active:scale-95 transition-all"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Mon Panier</span>
              {totalItemsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white text-sky-700 font-extrabold text-xs">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Catalog Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Search & Categories Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Rechercher un produit de la boutique..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'Tous les produits' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => {
            const inCart = cart.find(i => i.productId === p.id);

            return (
              <div 
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                    <img 
                      src={p.image} 
                      alt={p.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                      {p.category}
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {p.description}
                    </p>
                    {p.imageVerification?.verdict === 'AUTHENTIC' && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Photo réelle vérifiée</span>
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Prix</p>
                        <p className="text-lg font-black font-heading text-slate-900">
                          {formatPrice(p.sellPrice)}
                        </p>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                        En stock
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    onClick={() => addToCart(p)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      inCart 
                        ? 'bg-sky-50 text-sky-700 border border-sky-300' 
                        : 'bg-slate-900 hover:bg-sky-700 text-white shadow-xs'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{inCart ? `Ajouté (${inCart.quantity})` : 'Ajouter au Panier'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart & Checkout Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsCartOpen(false)} />

          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Votre Panier ({totalItemsCount} article{totalItemsCount > 1 ? 's' : ''})
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Items List */}
              {cart.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold">Votre panier est vide</p>
                  <p className="text-[11px] mt-1">Ajoutez des articles pour passer commande</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {cart.map(item => (
                      <div key={item.productId} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{formatPrice(item.unitPrice)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="p-1 text-slate-600 hover:bg-white rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="p-1 text-slate-600 hover:bg-white rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-black text-slate-900">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Customer Information Form */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      Coordonnées de Livraison
                    </h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Votre Nom complet *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Amina Dossou"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (checkoutError) setCheckoutError(null);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Numéro WhatsApp / Téléphone Mobile Money *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+229 97 12 34 56"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (checkoutError) setCheckoutError(null);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Zone de Livraison au Bénin *
                      </label>
                      <select
                        value={deliveryZone}
                        onChange={(e) => setDeliveryZone(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="cotonou">Cotonou (+{formatPrice(merchant.deliveryRates.cotonou)})</option>
                        <option value="calavi">Abomey-Calavi (+{formatPrice(merchant.deliveryRates.calavi)})</option>
                        <option value="portoNovo">Porto-Novo (+{formatPrice(merchant.deliveryRates.portoNovo)})</option>
                        <option value="interieur">Intérieur du Pays (Bus) (+{formatPrice(merchant.deliveryRates.interieur)})</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Adresse ou Repère précis (Quartier, Rue...)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Haie Vive près du glacier, Zogbadjè face campus..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  {/* Payment Mode Selection (Seller-enabled channels) */}
                  <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-3">
                    <h4 className="font-bold text-sky-900 uppercase tracking-wider text-[10px]">
                      Mode de Paiement Accepté par la Boutique
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {enabledMethods.map((method) => {
                        const meta = PAYMENT_CHANNEL_META[method];
                        const isActive = selectedPaymentMethod === method;
                        const activeStyle =
                          method === 'MTN_MOMO'
                            ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-xs'
                            : method === 'MOOV_MONEY'
                            ? 'bg-[#004D98] text-white border-blue-900 shadow-xs'
                            : method === 'CELTIIS_CASH'
                            ? 'bg-[#FF6600] text-white border-orange-700 shadow-xs'
                            : method === 'CARTE_BANCAIRE'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-emerald-600 text-white border-emerald-700 shadow-xs';
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`p-2 rounded-xl border text-left font-bold flex items-center gap-2 transition-all ${
                              isActive ? activeStyle : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : meta.dotColor}`} />
                            <span className="truncate">{meta.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Seller Payment Account & USSD Guidance */}
                    {isMobileMoneyMethod && (
                      <div className="p-3 rounded-xl bg-white border border-sky-200 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Compte vendeur {selectedChannelMeta.shortLabel}
                            </span>
                            <span className="font-mono font-black text-slate-900 text-xs">
                              {selectedMerchantAccount}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyAccount}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                          >
                            {copiedAccount ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedAccount ? 'Copié' : 'Copier'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span>
                            Code USSD :{' '}
                            <strong className="font-mono text-slate-900">
                              {(selectedPaymentMethod === 'MTN_MOMO' && merchant.momoMerchantCode) || selectedChannelMeta.ussd}
                            </strong>
                          </span>
                          <span className="font-bold text-sky-700 tabular-nums">
                            {formatPrice(totalAmount)}
                          </span>
                        </div>

                        {merchant.paymentInstructions && (
                          <p className="text-[10px] text-slate-600 italic leading-snug">
                            {merchant.paymentInstructions}
                          </p>
                        )}

                        <div className="relative">
                          <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Référence SMS / ID Transaction (si payé à l'avance)"
                            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    )}

                    {selectedPaymentMethod === 'CARTE_BANCAIRE' && (
                      <div className="p-3 rounded-xl bg-white border border-purple-200 space-y-2 text-[11px]">
                        <p className="text-slate-700 font-medium">
                          Règlement par terminal TPE mobile à la livraison ou virement vers :{' '}
                          <span className="font-mono font-bold text-slate-900 block mt-0.5">
                            {selectedMerchantAccount}
                          </span>
                        </p>
                        <div className="relative">
                          <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Référence virement / autorisation (optionnel)"
                            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    )}

                    {selectedPaymentMethod === 'CASH_ON_DELIVERY' && (
                      <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                        Vous réglez en espèces FCFA directement au livreur à la réception de votre colis.
                      </div>
                    )}
                  </div>

                  {/* Pricing Total Summary */}
                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Sous-total articles HT :</span>
                      <span className="font-mono tabular-nums">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{activeTaxLabel} ({activeTaxRate > 0 ? `${activeTaxRate}%` : 'Exonéré 0%'}) :</span>
                      <span className="font-mono font-semibold text-amber-700 tabular-nums">{formatPrice(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Frais de livraison :</span>
                      <span className="font-mono tabular-nums">{formatPrice(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                      <span>Total TTC à payer :</span>
                      <span className="text-xl font-black font-heading text-sky-700 tabular-nums">
                        {formatPrice(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
                {checkoutError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                <button
                  onClick={() => handleOrderSubmit(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Commander via WhatsApp ({formatPrice(totalAmount)})</span>
                </button>

                {!isExternalVisitor && (
                  <button
                    onClick={() => handleOrderSubmit(false)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {selectedPaymentMethod === 'CASH_ON_DELIVERY'
                        ? 'Confirmer la Commande (Paiement à la livraison)'
                        : selectedPaymentMethod === 'CARTE_BANCAIRE'
                        ? 'Confirmer la Commande (Carte / TPE)'
                        : `Confirmer la Commande (${selectedChannelMeta.shortLabel})`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Confirmation Success Modal */}
      {orderCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-heading font-black text-xl text-slate-900">
                Commande Enregistrée !
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Merci {orderCompleted.customerName}, votre commande <strong className="text-slate-900">{orderCompleted.orderNumber}</strong> est transmise à {merchant.storeName}.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Montant total :</span>
                <span className="font-black text-slate-900 tabular-nums">{formatPrice(orderCompleted.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode de paiement :</span>
                <span className="font-semibold text-slate-800">
                  {PAYMENT_CHANNEL_META[orderCompleted.paymentMethod].label}
                </span>
              </div>
              {orderCompleted.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Référence transmise :</span>
                  <span className="font-mono font-bold text-slate-900">{orderCompleted.paymentReference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Statut paiement :</span>
                <span className="font-semibold text-amber-700">En attente de validation vendeur</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination :</span>
                <span className="font-semibold text-slate-800">{orderCompleted.deliveryCity}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {orderCompleted.paymentMethod === 'CASH_ON_DELIVERY'
                ? 'Le commerçant prépare votre colis. Vous paierez au livreur à la réception.'
                : `Le vendeur vérifie votre transfert ${PAYMENT_CHANNEL_META[orderCompleted.paymentMethod].shortLabel} avant expédition rapide.`}
            </p>

            <button
              onClick={() => {
                setOrderCompleted(null);
                setIsCartOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
            >
              Continuer mes achats
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
