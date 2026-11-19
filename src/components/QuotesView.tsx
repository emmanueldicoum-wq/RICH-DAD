import React, { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Send,
  Clock,
  XCircle,
  ArrowRightCircle,
  Eye,
  Edit3,
  Trash2,
  MessageCircle,
  X,
  AlertTriangle,
  ShoppingBag,
  Percent,
  Package,
  Check,
} from 'lucide-react';
import {
  Customer,
  MerchantProfile,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  Quote,
  QuoteStatus,
} from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { calculateTaxAmount, getActiveTaxRate } from '../utils/tax';

export interface ConvertQuoteOptions {
  paymentStatus: Extract<OrderStatus, 'PAID' | 'PENDING'>;
  paymentMethod: PaymentMethod;
  channel: Order['channel'];
  notes?: string;
}

interface QuotesViewProps {
  quotes: Quote[];
  products: Product[];
  customers: Customer[];
  merchant: MerchantProfile;
  onAddQuote: (quote: Quote) => void;
  onUpdateQuote: (quote: Quote) => void;
  onDeleteQuote: (quoteId: string) => void;
  onConvertQuoteToOrder: (quote: Quote, options: ConvertQuoteOptions) => Order;
  onPreviewQuote: (quote: Quote) => void;
  onNavigateToOrder: (orderId: string) => void;
  convertingQuoteTarget: Quote | null;
  setConvertingQuoteTarget: (quote: Quote | null) => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quotes,
  products,
  customers,
  merchant,
  onAddQuote,
  onUpdateQuote,
  onDeleteQuote,
  onConvertQuoteToOrder,
  onPreviewQuote,
  onNavigateToOrder,
  convertingQuoteTarget,
  setConvertingQuoteTarget,
}) => {
  const { formatPrice } = useCurrency();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuoteStatus>('ALL');

  // Create/Edit Quote modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('Cotonou');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(merchant.deliveryRates.cotonou);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [preferredPaymentMethod, setPreferredPaymentMethod] =
    useState<PaymentMethod>('MTN_MOMO');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('DRAFT');
  const [notes, setNotes] = useState('');

  // Add-item picker inside modal
  const [pickerProductId, setPickerProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [pickerQuantity, setPickerQuantity] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Convert-to-order options modal
  const [convertPaymentStatus, setConvertPaymentStatus] = useState<
    'PAID' | 'PENDING'
  >('PAID');
  const [convertPaymentMethod, setConvertPaymentMethod] =
    useState<PaymentMethod>('MTN_MOMO');
  const [convertChannel, setConvertChannel] =
    useState<Order['channel']>('WHATSAPP');
  const [convertSuccessOrder, setConvertSuccessOrder] = useState<Order | null>(
    null
  );

  // KPI metrics
  const metrics = useMemo(() => {
    const acceptedCount = quotes.filter((q) => q.status === 'ACCEPTED').length;
    const convertedCount = quotes.filter((q) => q.status === 'CONVERTED').length;
    const activeValue = quotes
      .filter((q) => q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'ACCEPTED')
      .reduce((sum, q) => sum + q.totalAmount, 0);
    const convertedValue = quotes
      .filter((q) => q.status === 'CONVERTED')
      .reduce((sum, q) => sum + q.totalAmount, 0);
    const decided = quotes.filter(
      (q) =>
        q.status === 'ACCEPTED' ||
        q.status === 'CONVERTED' ||
        q.status === 'REJECTED'
    ).length;
    const conversionRate =
      quotes.length > 0
        ? Math.round((convertedCount / Math.max(1, decided || quotes.length)) * 100)
        : 0;
    return {
      total: quotes.length,
      acceptedCount,
      convertedCount,
      activeValue,
      convertedValue,
      conversionRate,
    };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return quotes.filter((quote) => {
      const matchesSearch =
        quote.quoteNumber.toLowerCase().includes(q) ||
        quote.customerName.toLowerCase().includes(q) ||
        quote.customerPhone.toLowerCase().includes(q) ||
        quote.deliveryCity.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' || quote.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const openNewQuoteModal = () => {
    setEditingQuote(null);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('+229 ');
    setDeliveryCity('Cotonou');
    setDeliveryAddress('');
    const defaultProd = products[0];
    setItems(
      defaultProd
        ? [
            {
              productId: defaultProd.id,
              productName: defaultProd.name,
              unitPrice: defaultProd.sellPrice,
              quantity: 1,
              image: defaultProd.image,
            },
          ]
        : []
    );
    setPickerProductId(defaultProd?.id || '');
    setPickerQuantity(1);
    setDiscountAmount(0);
    setDeliveryFee(merchant.deliveryRates.cotonou);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setValidUntil(d.toISOString().slice(0, 10));
    setPreferredPaymentMethod('MTN_MOMO');
    setQuoteStatus('DRAFT');
    setNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditQuoteModal = (quote: Quote) => {
    if (quote.status === 'CONVERTED') return;
    setEditingQuote(quote);
    setSelectedCustomerId(quote.customerId || '');
    setCustomerName(quote.customerName);
    setCustomerPhone(quote.customerPhone);
    setDeliveryCity(quote.deliveryCity);
    setDeliveryAddress(quote.deliveryAddress);
    setItems(quote.items.map((i) => ({ ...i })));
    setPickerProductId(products[0]?.id || '');
    setPickerQuantity(1);
    setDiscountAmount(quote.discountAmount || 0);
    setDeliveryFee(quote.deliveryFee || 0);
    setValidUntil(quote.validUntil);
    setPreferredPaymentMethod(quote.preferredPaymentMethod);
    setQuoteStatus(quote.status);
    setNotes(quote.notes || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSelectCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (!found) return;
    setCustomerName(found.name);
    setCustomerPhone(found.phone);
    if (found.city) {
      setDeliveryCity(found.city);
      const cityLower = found.city.toLowerCase();
      if (cityLower.includes('calavi')) {
        setDeliveryFee(merchant.deliveryRates.calavi);
      } else if (cityLower.includes('porto')) {
        setDeliveryFee(merchant.deliveryRates.portoNovo);
      } else if (cityLower.includes('cotonou')) {
        setDeliveryFee(merchant.deliveryRates.cotonou);
      } else {
        setDeliveryFee(merchant.deliveryRates.interieur);
      }
    }
  };

  const handleCityChange = (city: string) => {
    setDeliveryCity(city);
    if (city === 'Cotonou') setDeliveryFee(merchant.deliveryRates.cotonou);
    else if (city === 'Abomey-Calavi') setDeliveryFee(merchant.deliveryRates.calavi);
    else if (city === 'Porto-Novo') setDeliveryFee(merchant.deliveryRates.portoNovo);
    else if (city === 'Retrait en boutique') setDeliveryFee(0);
    else setDeliveryFee(merchant.deliveryRates.interieur);
  };

  const handleAddLineItem = () => {
    const prod = products.find((p) => p.id === pickerProductId);
    if (!prod) return;
    const qty = Math.max(1, pickerQuantity);
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === prod.id);
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          unitPrice: prod.sellPrice,
          quantity: qty,
          image: prod.image,
        },
      ];
    });
    setPickerQuantity(1);
    setFormError(null);
  };

  const updateLineItem = (
    idx: number,
    patch: Partial<Pick<OrderItem, 'quantity' | 'unitPrice'>>
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const removeLineItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Live financial preview inside modal
  const activeTaxRate = getActiveTaxRate(merchant);
  const activeTaxLabel = merchant.taxLabel?.trim() || 'TVA';
  const formSubtotal = items.reduce(
    (s, item) => s + item.unitPrice * item.quantity,
    0
  );
  const clampedDiscount = Math.min(formSubtotal, Math.max(0, discountAmount));
  const formNetHT = Math.max(0, formSubtotal - clampedDiscount);
  const formTaxAmount = calculateTaxAmount(formNetHT, activeTaxRate);
  const formTotalTTC = formNetHT + formTaxAmount + Math.max(0, deliveryFee);

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError('Veuillez renseigner le nom du client.');
      return;
    }
    if (items.length === 0) {
      setFormError('Ajoutez au moins un produit au devis.');
      return;
    }

    if (editingQuote) {
      onUpdateQuote({
        ...editingQuote,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryCity: deliveryCity.trim() || 'Cotonou',
        deliveryAddress: deliveryAddress.trim() || 'À préciser',
        items,
        subtotal: formSubtotal,
        discountAmount: clampedDiscount,
        taxRate: activeTaxRate,
        taxLabel: activeTaxLabel,
        taxAmount: formTaxAmount,
        deliveryFee: Math.max(0, deliveryFee),
        totalAmount: formTotalTTC,
        status: quoteStatus,
        validUntil,
        notes: notes.trim() || undefined,
        preferredPaymentMethod,
      });
    } else {
      const nextNum = quotes.length + 15;
      const newQuote: Quote = {
        id: `quo-${Date.now()}`,
        quoteNumber: `DEV-2026-${String(nextNum).padStart(3, '0')}`,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryCity: deliveryCity.trim() || 'Cotonou',
        deliveryAddress: deliveryAddress.trim() || 'À préciser',
        items,
        subtotal: formSubtotal,
        discountAmount: clampedDiscount,
        taxRate: activeTaxRate,
        taxLabel: activeTaxLabel,
        taxAmount: formTaxAmount,
        deliveryFee: Math.max(0, deliveryFee),
        totalAmount: formTotalTTC,
        status: quoteStatus,
        validUntil,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        notes: notes.trim() || undefined,
        preferredPaymentMethod,
      };
      onAddQuote(newQuote);
    }

    setIsFormOpen(false);
  };

  const handleStatusChange = (quote: Quote, newStatus: QuoteStatus) => {
    if (quote.status === 'CONVERTED') return;
    onUpdateQuote({ ...quote, status: newStatus });
  };

  const openConvertDialog = (quote: Quote) => {
    setConvertPaymentMethod(quote.preferredPaymentMethod);
    setConvertPaymentStatus('PAID');
    setConvertChannel('WHATSAPP');
    setConvertingQuoteTarget(quote);
  };

  const handleConfirmConversion = () => {
    if (!convertingQuoteTarget) return;
    const createdOrder = onConvertQuoteToOrder(convertingQuoteTarget, {
      paymentStatus: convertPaymentStatus,
      paymentMethod: convertPaymentMethod,
      channel: convertChannel,
    });
    setConvertingQuoteTarget(null);
    setConvertSuccessOrder(createdOrder);
  };

  const getStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            <Clock className="w-3 h-3 text-slate-500" /> Brouillon
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
            <Send className="w-3 h-3 text-sky-600" /> Envoyé
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
            <CheckCircle2 className="w-3 h-3 text-amber-600" /> Validé client
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <ShoppingBag className="w-3 h-3 text-emerald-600" /> Converti
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
            <XCircle className="w-3 h-3 text-rose-600" /> Refusé
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
            Expiré
          </span>
        );
    }
  };

  const shareQuoteWhatsApp = (quote: Quote) => {
    const msg = encodeURIComponent(
      `Bonjour ${quote.customerName}, voici votre devis ${quote.quoteNumber} chez ${merchant.storeName} d'un montant total de ${formatPrice(
        quote.totalAmount
      )} TTC (valable jusqu'au ${quote.validUntil}). Merci de nous confirmer votre accord pour lancer la livraison !`
    );
    const cleanPhone = quote.customerPhone.replace(/[^0-9]/g, '');
    window.open(
      cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Devis Clients & Factures Proforma
          </h2>
          <p className="text-xs text-slate-500">
            Créez des offres chiffrées personnalisées, partagez-les sur WhatsApp et convertissez-les en commandes confirmées dès validation
          </p>
        </div>

        <button
          onClick={openNewQuoteModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Devis</span>
        </button>
      </div>

      {/* Conversion confirmation banner */}
      {convertSuccessOrder && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Devis converti avec succès en commande {convertSuccessOrder.orderNumber} !
              </p>
              <p className="text-xs text-emerald-800">
                Les stocks des articles ont été décrémentés automatiquement et enregistrés dans le journal des mouvements.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToOrder(convertSuccessOrder.id)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            >
              Voir la commande
            </button>
            <button
              onClick={() => setConvertSuccessOrder(null)}
              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Devis en cours</p>
          <p className="text-2xl font-black font-heading text-slate-900 mt-1 tabular-nums">
            {formatPrice(metrics.activeValue)}
          </p>
          <span className="text-[11px] text-sky-600 font-semibold">
            {metrics.total} devis au total
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/30 shadow-xs">
          <p className="text-xs text-amber-800 font-medium">
            Validés (prêts à convertir)
          </p>
          <p className="text-2xl font-black font-heading text-amber-900 mt-1 tabular-nums">
            {metrics.acceptedCount} devis
          </p>
          <span className="text-[11px] text-amber-700 font-semibold">
            En attente de transformation en commande
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">
            Chiffre d'affaires converti
          </p>
          <p className="text-2xl font-black font-heading text-emerald-700 mt-1 tabular-nums">
            {formatPrice(metrics.convertedValue)}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold">
            {metrics.convertedCount} commande(s) générée(s)
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">
            Taux de conversion
          </p>
          <p className="text-2xl font-black font-heading text-[#0B192C] mt-1 tabular-nums">
            {metrics.conversionRate}%
          </p>
          <span className="text-[11px] text-slate-500">
            TVA active : {activeTaxRate > 0 ? `${activeTaxRate}% (${activeTaxLabel})` : 'Exonéré 0%'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Rechercher par N° devis, client, téléphone ou ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'Tous' },
              { id: 'DRAFT', label: 'Brouillons' },
              { id: 'SENT', label: 'Envoyés' },
              { id: 'ACCEPTED', label: 'Validés' },
              { id: 'CONVERTED', label: 'Convertis' },
              { id: 'REJECTED', label: 'Refusés' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#0B192C] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              Aucun devis trouvé
            </p>
            <p className="text-xs text-slate-500">
              Créez un premier devis client pour envoyer une facture proforma et la convertir en commande.
            </p>
            <button
              onClick={openNewQuoteModal}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un devis</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Devis</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Articles</th>
                  <th className="py-3 px-3">Validité</th>
                  <th className="py-3 px-3">Total TTC</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-4 text-right">Actions & Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => {
                  const totalQty = quote.items.reduce(
                    (s, i) => s + i.quantity,
                    0
                  );
                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-slate-900">
                          {quote.quoteNumber}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Émis {quote.createdAt.slice(0, 10)}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">
                          {quote.customerName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {quote.customerPhone} • {quote.deliveryCity}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">
                          {totalQty} article{totalQty > 1 ? 's' : ''}
                        </span>
                        <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                          {quote.items[0]?.productName}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {quote.validUntil}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-black text-slate-900 text-sm tabular-nums">
                          {formatPrice(quote.totalAmount)}
                        </p>
                        {quote.discountAmount > 0 && (
                          <p className="text-[10px] text-emerald-600 font-semibold tabular-nums">
                            Remise: -{formatPrice(quote.discountAmount)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div>{getStatusBadge(quote.status)}</div>
                        {quote.status === 'CONVERTED' &&
                          quote.convertedOrderId && (
                            <button
                              onClick={() =>
                                onNavigateToOrder(quote.convertedOrderId!)
                              }
                              className="text-[10px] font-mono font-bold text-sky-700 hover:underline block"
                            >
                              → {quote.convertedOrderNumber}
                            </button>
                          )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {quote.status === 'DRAFT' && (
                            <button
                              onClick={() => handleStatusChange(quote, 'SENT')}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] flex items-center gap-1 transition-colors"
                              title="Marquer le devis comme envoyé au client"
                            >
                              <Send className="w-3 h-3" />
                              <span>Marquer envoyé</span>
                            </button>
                          )}
                          {(quote.status === 'DRAFT' ||
                            quote.status === 'SENT') && (
                            <button
                              onClick={() =>
                                handleStatusChange(quote, 'ACCEPTED')
                              }
                              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1 transition-colors"
                              title="Confirmer que le client a validé ce devis"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Client a validé</span>
                            </button>
                          )}
                          {quote.status === 'ACCEPTED' && (
                            <button
                              onClick={() => openConvertDialog(quote)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                              <span>Convertir en Commande</span>
                            </button>
                          )}
                          {quote.status === 'SENT' && (
                            <button
                              onClick={() =>
                                handleStatusChange(quote, 'REJECTED')
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Marquer comme refusé"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onPreviewQuote(quote)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                            title="Aperçu / Imprimer proforma"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => shareQuoteWhatsApp(quote)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Envoyer sur WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          {quote.status !== 'CONVERTED' && (
                            <>
                              <button
                                onClick={() => openEditQuoteModal(quote)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                                title="Modifier le devis"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteQuote(quote.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Supprimer le devis"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Quote Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0B192C] text-white flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    {editingQuote
                      ? `Modifier le Devis ${editingQuote.quoteNumber}`
                      : 'Créer un Nouveau Devis Client'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Calcul automatique des taxes ({activeTaxRate}%) et conversion directe en commande
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitQuote}
              className="p-6 overflow-y-auto space-y-5 text-xs"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Client selection & info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    1. Client & Livraison
                  </span>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                  >
                    <option value="">— Sélectionner un client existant (optionnel) —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nom du client *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Amina Dossou"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Téléphone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+229 97 00 00 00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Zone / Ville de livraison
                    </label>
                    <select
                      value={deliveryCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="Cotonou">
                        Cotonou ({formatPrice(merchant.deliveryRates.cotonou)})
                      </option>
                      <option value="Abomey-Calavi">
                        Abomey-Calavi ({formatPrice(merchant.deliveryRates.calavi)})
                      </option>
                      <option value="Porto-Novo">
                        Porto-Novo ({formatPrice(merchant.deliveryRates.portoNovo)})
                      </option>
                      <option value="Parakou / Intérieur">
                        Intérieur du Bénin ({formatPrice(merchant.deliveryRates.interieur)})
                      </option>
                      <option value="Retrait en boutique">
                        Retrait en boutique (0 FCFA)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Adresse / Quartier
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Haie Vive, Rue 420"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Products Picker & Lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    2. Articles du Devis
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {items.length} ligne(s)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={pickerProductId}
                    onChange={(e) => setPickerProductId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.sellPrice)} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={pickerQuantity}
                    onChange={(e) =>
                      setPickerQuantity(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-20 px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                    {items.map((item, idx) => (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">
                            {item.productName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Prix unitaire négociable (FCFA)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(idx, {
                                unitPrice: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-right tabular-nums"
                          />
                          <span className="text-slate-400">×</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(idx, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-center tabular-nums"
                          />
                          <span className="w-24 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Terms, Validity & Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Remise commerciale (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={formSubtotal}
                      value={discountAmount}
                      onChange={(e) =>
                        setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Frais de livraison (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={deliveryFee}
                      onChange={(e) =>
                        setDeliveryFee(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Valable jusqu'au *
                    </label>
                    <input
                      type="date"
                      required
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Statut initial du devis
                    </label>
                    <select
                      value={quoteStatus}
                      onChange={(e) =>
                        setQuoteStatus(e.target.value as QuoteStatus)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="DRAFT">Brouillon</option>
                      <option value="SENT">Envoyé au client</option>
                      <option value="ACCEPTED">Validé par le client</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Moyen de paiement prévu
                    </label>
                    <select
                      value={preferredPaymentMethod}
                      onChange={(e) =>
                        setPreferredPaymentMethod(e.target.value as PaymentMethod)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="MTN_MOMO">MTN MoMo</option>
                      <option value="MOOV_MONEY">Moov Money (Flooz)</option>
                      <option value="CELTIIS_CASH">Celtiis Cash</option>
                      <option value="CASH_ON_DELIVERY">
                        Espèces à la livraison
                      </option>
                      <option value="CARTE_BANCAIRE">Carte Bancaire</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Notes / Conditions particulières
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Délai de confection 48h, acompte de 50% à la validation..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                {/* Live Summary Card */}
                <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0B192C] text-white space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" />
                      Récapitulatif Devis
                    </span>
                    <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded">
                      {activeTaxLabel} {activeTaxRate}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Sous-total articles :</span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(formSubtotal)}
                    </span>
                  </div>
                  {clampedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Remise :</span>
                      <span className="font-mono tabular-nums">
                        - {formatPrice(clampedDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-300">
                    <span>
                      {activeTaxLabel} ({activeTaxRate}%) :
                    </span>
                    <span className="font-mono tabular-nums">
                      + {formatPrice(formTaxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Livraison :</span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(Math.max(0, deliveryFee))}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-white/15 font-black text-sm">
                    <span>TOTAL TTC :</span>
                    <span className="text-lg font-mono text-sky-300 tabular-nums">
                      {formatPrice(formTotalTTC)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingQuote
                      ? 'Enregistrer le devis'
                      : 'Créer le devis client'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Quote -> Confirmed Order Modal */}
      {convertingQuoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setConvertingQuoteTarget(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 bg-[#0B192C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <ArrowRightCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base">
                    Convertir en Commande Confirmée
                  </h3>
                  <p className="text-[11px] text-sky-200">
                    Devis {convertingQuoteTarget.quoteNumber} •{' '}
                    {convertingQuoteTarget.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConvertingQuoteTarget(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Stock Verification */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-sky-600" />
                  Vérification des stocks disponibles
                </p>
                <div className="divide-y divide-slate-200">
                  {convertingQuoteTarget.items.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const currentStock = prod ? prod.stock : 0;
                    const isShort = currentStock < item.quantity;
                    return (
                      <div
                        key={idx}
                        className="py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.productName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Demandé : <strong>{item.quantity}</strong>
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isShort
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isShort
                            ? `Stock insuffisant (${currentStock})`
                            : `En stock (${currentStock})`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment & Channel Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Statut de paiement initial
                  </label>
                  <select
                    value={convertPaymentStatus}
                    onChange={(e) =>
                      setConvertPaymentStatus(
                        e.target.value as 'PAID' | 'PENDING'
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="PAID">Payée / Acompte validé</option>
                    <option value="PENDING">
                      En attente d'encaissement
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mode de règlement
                  </label>
                  <select
                    value={convertPaymentMethod}
                    onChange={(e) =>
                      setConvertPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="MTN_MOMO">MTN MoMo</option>
                    <option value="MOOV_MONEY">Moov Money (Flooz)</option>
                    <option value="CELTIIS_CASH">Celtiis Cash</option>
                    <option value="CASH_ON_DELIVERY">
                      Espèces à la livraison
                    </option>
                    <option value="CARTE_BANCAIRE">Carte Bancaire</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Canal d'origine
                  </label>
                  <select
                    value={convertChannel}
                    onChange={(e) =>
                      setConvertChannel(e.target.value as Order['channel'])
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="WHATSAPP">WhatsApp / Commande directe</option>
                    <option value="POS">Caisse Boutique (POS)</option>
                    <option value="STORE_FRONT">Boutique en Ligne</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                <span className="font-semibold text-sky-900">
                  Montant total commande TTC :
                </span>
                <span className="text-base font-black font-mono text-sky-800 tabular-nums">
                  {formatPrice(convertingQuoteTarget.totalAmount)}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConvertingQuoteTarget(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConversion}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer & Créer la Commande</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
