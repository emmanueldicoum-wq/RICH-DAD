import React, { useMemo, useState } from 'react';
import {
  Wallet,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Building2,
  Smartphone,
  Banknote,
  CreditCard,
  ShieldCheck,
  Search,
  Plus,
  X,
  Hash,
  Send,
  AlertCircle,
  Settings2,
  Save,
  Check,
  Copy,
  FileText,
} from 'lucide-react';
import {
  MerchantProfile,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayoutDestinationType,
  SellerPayout,
} from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { computeOrderTaxBreakdown } from '../utils/tax';
import {
  ALL_PAYMENT_METHODS,
  PAYMENT_CHANNEL_META,
  getEffectiveOrderPaymentStatus,
  getEnabledPaymentMethods,
  getMerchantChannelAccount,
  getOrderAmountPaid,
} from '../utils/payment';

export interface ConfirmPaymentPayload {
  orderId: string;
  amountPaid: number;
  paymentReference?: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
}

interface PaymentsViewProps {
  orders: Order[];
  merchant: MerchantProfile;
  sellerPayouts: SellerPayout[];
  onConfirmOrderPayment: (payload: ConfirmPaymentPayload) => void;
  onAddSellerPayout: (payout: SellerPayout) => void;
  onCompleteSellerPayout: (payoutId: string, reference?: string) => void;
  onUpdateMerchant: (updated: MerchantProfile) => void;
  onOpenInvoice: (order: Order) => void;
}

type PaymentSubTab = 'collections' | 'payouts' | 'settings';

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  orders,
  merchant,
  sellerPayouts,
  onConfirmOrderPayment,
  onAddSellerPayout,
  onCompleteSellerPayout,
  onUpdateMerchant,
  onOpenInvoice,
}) => {
  const { formatPrice } = useCurrency();
  const [activeSubTab, setActiveSubTab] = useState<PaymentSubTab>('collections');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  // Confirm Payment Modal state
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<number>(0);
  const [confirmRef, setConfirmRef] = useState<string>('');
  const [confirmMarkDelivered, setConfirmMarkDelivered] = useState(false);

  // New Seller Payout Modal state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutSource, setPayoutSource] = useState<PaymentMethod>('MTN_MOMO');
  const [payoutDestType, setPayoutDestType] = useState<PayoutDestinationType>('BANQUE');
  const [payoutDestAccount, setPayoutDestAccount] = useState(
    merchant.bankAccount || ''
  );
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Settings form state
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>(() =>
    getEnabledPaymentMethods(merchant)
  );
  const [momoNumber, setMomoNumber] = useState(merchant.momoNumber);
  const [moovNumber, setMoovNumber] = useState(merchant.moovNumber);
  const [celtiisNumber, setCeltiisNumber] = useState(merchant.celtiisNumber);
  const [momoMerchantCode, setMomoMerchantCode] = useState(
    merchant.momoMerchantCode || ''
  );
  const [bankAccount, setBankAccount] = useState(merchant.bankAccount || '');
  const [paymentInstructions, setPaymentInstructions] = useState(
    merchant.paymentInstructions || ''
  );
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Compute treasury stats per payment channel
  const channelStats = useMemo(() => {
    const map = new Map<
      PaymentMethod,
      {
        collected: number;
        pending: number;
        withdrawn: number;
        pendingWithdrawals: number;
        available: number;
        orderCount: number;
      }
    >();

    ALL_PAYMENT_METHODS.forEach((m) => {
      map.set(m, {
        collected: 0,
        pending: 0,
        withdrawn: 0,
        pendingWithdrawals: 0,
        available: 0,
        orderCount: 0,
      });
    });

    orders.forEach((order) => {
      if (order.status === 'CANCELLED') return;
      const entry = map.get(order.paymentMethod);
      if (!entry) return;
      const totalTTC = computeOrderTaxBreakdown(order, merchant).totalAmount;
      const paid = getOrderAmountPaid(order, totalTTC);
      const remaining = Math.max(0, totalTTC - paid);

      entry.collected += paid;
      entry.pending += remaining;
      entry.orderCount += 1;
    });

    sellerPayouts.forEach((payout) => {
      const entry = map.get(payout.sourceMethod);
      if (!entry) return;
      if (payout.status === 'COMPLETED') {
        entry.withdrawn += payout.amount;
      } else {
        entry.pendingWithdrawals += payout.amount;
      }
    });

    ALL_PAYMENT_METHODS.forEach((m) => {
      const entry = map.get(m)!;
      entry.available = Math.max(
        0,
        entry.collected - entry.withdrawn - entry.pendingWithdrawals
      );
    });

    return map;
  }, [orders, merchant, sellerPayouts]);

  const totals = useMemo(() => {
    let totalCollected = 0;
    let totalPending = 0;
    let totalWithdrawn = 0;
    let totalAvailable = 0;

    channelStats.forEach((st) => {
      totalCollected += st.collected;
      totalPending += st.pending;
      totalWithdrawn += st.withdrawn;
      totalAvailable += st.available;
    });

    const pendingVerificationCount = orders.filter((o) => {
      if (o.status === 'CANCELLED') return false;
      const pStatus = getEffectiveOrderPaymentStatus(o, merchant);
      return pStatus === 'UNPAID' || pStatus === 'PARTIAL';
    }).length;

    return {
      totalCollected,
      totalPending,
      totalWithdrawn,
      totalAvailable,
      pendingVerificationCount,
    };
  }, [channelStats, orders, merchant]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return orders.filter((o) => {
      if (o.status === 'CANCELLED') return false;
      const pStatus = getEffectiveOrderPaymentStatus(o, merchant);
      const matchesFilter =
        filterMode === 'ALL'
          ? true
          : filterMode === 'PENDING'
          ? pStatus === 'UNPAID' || pStatus === 'PARTIAL'
          : pStatus === 'PAID';
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o.paymentReference || '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [orders, merchant, filterMode, searchTerm]);

  const openConfirmModal = (order: Order) => {
    const totalTTC = computeOrderTaxBreakdown(order, merchant).totalAmount;
    const alreadyPaid = getOrderAmountPaid(order, totalTTC);
    const remaining = Math.max(0, totalTTC - alreadyPaid);
    setVerifyingOrder(order);
    setConfirmAmount(remaining > 0 ? totalTTC : totalTTC);
    setConfirmRef(order.paymentReference || '');
    setConfirmMarkDelivered(order.channel === 'POS' || order.status === 'DELIVERED');
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder) return;
    const totalTTC = computeOrderTaxBreakdown(verifyingOrder, merchant).totalAmount;
    const clampedPaid = Math.max(0, Math.min(totalTTC, confirmAmount));

    const nextPaymentStatus: PaymentStatus =
      clampedPaid >= totalTTC
        ? 'PAID'
        : clampedPaid > 0
        ? 'PARTIAL'
        : 'UNPAID';

    let nextOrderStatus: OrderStatus = verifyingOrder.status;
    if (confirmMarkDelivered) {
      nextOrderStatus = 'DELIVERED';
    } else if (nextPaymentStatus === 'PAID' && verifyingOrder.status === 'PENDING') {
      nextOrderStatus = 'PAID';
    }

    onConfirmOrderPayment({
      orderId: verifyingOrder.id,
      amountPaid: clampedPaid,
      paymentReference: confirmRef.trim() || undefined,
      paymentStatus: nextPaymentStatus,
      orderStatus: nextOrderStatus,
    });
    setVerifyingOrder(null);
  };

  const openPayoutModal = (defaultSource?: PaymentMethod) => {
    const source = defaultSource || 'MTN_MOMO';
    const avail = channelStats.get(source)?.available || 0;
    setPayoutSource(source);
    setPayoutDestType('BANQUE');
    setPayoutDestAccount(
      merchant.bankAccount || 'Compte Bancaire Pro'
    );
    setPayoutAmount(avail > 0 ? avail : 0);
    setPayoutRef('');
    setPayoutNotes('');
    setPayoutError(null);
    setIsPayoutModalOpen(true);
  };

  const handleDestTypeChange = (destType: PayoutDestinationType) => {
    setPayoutDestType(destType);
    if (destType === 'BANQUE') {
      setPayoutDestAccount(merchant.bankAccount || 'Compte Bancaire Pro');
    } else if (destType === 'MOMO_PERSO') {
      setPayoutDestAccount(
        `${merchant.momoNumber || merchant.phone} (${merchant.name})`
      );
    } else {
      setPayoutDestAccount(`Coffre Boutique ${merchant.city}`);
    }
  };

  const handleCreatePayout = (e: React.FormEvent) => {
    e.preventDefault();
    const avail = channelStats.get(payoutSource)?.available || 0;
    if (payoutAmount <= 0) {
      setPayoutError('Veuillez saisir un montant supérieur à 0.');
      return;
    }
    if (payoutAmount > avail) {
      setPayoutError(
        `Le montant dépasse le solde disponible sur ${PAYMENT_CHANNEL_META[payoutSource].shortLabel} (${formatPrice(avail)}).`
      );
      return;
    }
    if (!payoutDestAccount.trim()) {
      setPayoutError('Veuillez indiquer le compte ou coffre de destination.');
      return;
    }

    const newPayout: SellerPayout = {
      id: `payout-${Date.now()}`,
      amount: payoutAmount,
      sourceMethod: payoutSource,
      destinationType: payoutDestType,
      destinationAccount: payoutDestAccount.trim(),
      reference:
        payoutRef.trim() ||
        `REV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      notes: payoutNotes.trim() || undefined,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'COMPLETED',
    };

    onAddSellerPayout(newPayout);
    setIsPayoutModalOpen(false);
  };

  const toggleMethod = (method: PaymentMethod) => {
    setEnabledMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length <= 1) return prev; // keep at least 1 active
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMerchant({
      ...merchant,
      enabledPaymentMethods: enabledMethods,
      momoNumber: momoNumber.trim(),
      moovNumber: moovNumber.trim(),
      celtiisNumber: celtiisNumber.trim(),
      momoMerchantCode: momoMerchantCode.trim(),
      bankAccount: bankAccount.trim(),
      paymentInstructions: paymentInstructions.trim(),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const copyValue = (key: string, val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Encaissé
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
            <Clock className="w-3 h-3 text-sky-600" /> Acompte reçu
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
            Remboursé
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> À encaisser
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Paiements & Trésorerie Vendeur
          </h2>
          <p className="text-xs text-slate-500">
            Vérifiez les références Mobile Money, suivez vos soldes disponibles par canal et enregistrez vos reversements bancaires
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openPayoutModal()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0B192C] to-sky-700 hover:from-sky-700 hover:to-blue-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4 text-sky-300" />
            <span>Nouveau Reversement / Retrait</span>
          </button>
        </div>
      </div>

      {/* Top Treasury KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#0B192C] to-[#1E3E62] text-white rounded-2xl p-5 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
              Solde Disponible Net
            </span>
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-heading mt-2 tabular-nums">
            {formatPrice(totals.totalAvailable)}
          </p>
          <p className="text-[11px] text-slate-300 mt-1.5">
            Prêt à transférer vers banque ou compte perso
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Encaissé Ventes
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-heading text-emerald-700 mt-2 tabular-nums">
            {formatPrice(totals.totalCollected)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Tous canaux confirmés (MoMo, Cash, Carte)
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Reste à Encaisser / Vérifier
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-heading text-amber-900 mt-2 tabular-nums">
            {formatPrice(totals.totalPending)}
          </p>
          <p className="text-[11px] text-amber-700 font-semibold mt-1.5">
            {totals.pendingVerificationCount} commande(s) en attente de règlement
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Reversements Effectués
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-heading text-slate-900 mt-2 tabular-nums">
            {formatPrice(totals.totalWithdrawn)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {sellerPayouts.length} opération(s) de trésorerie
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs inline-flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubTab('collections')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'collections'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Encaissements & Vérifications</span>
          {totals.pendingVerificationCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
              {totals.pendingVerificationCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('payouts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'payouts'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Retraits & Remises Banque ({sellerPayouts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'settings'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Canaux & Comptes Vendeur</span>
        </button>
      </div>

      {/* TAB 1: COLLECTIONS & CHANNEL BALANCES */}
      {activeSubTab === 'collections' && (
        <div className="space-y-6">
          {/* Channel Wallets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {ALL_PAYMENT_METHODS.map((method) => {
              const meta = PAYMENT_CHANNEL_META[method];
              const st = channelStats.get(method)!;
              const isEnabled = getEnabledPaymentMethods(merchant).includes(method);
              const account = getMerchantChannelAccount(merchant, method);

              return (
                <div
                  key={method}
                  className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between transition-all ${
                    isEnabled ? 'border-slate-200/90' : 'border-slate-200 opacity-65 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                        <span className="font-bold text-xs text-slate-900">
                          {meta.shortLabel}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isEnabled ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70 mb-3">
                      <span className="text-[11px] font-mono text-slate-600 truncate">
                        {account}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue(method, account)}
                        className="text-slate-400 hover:text-sky-600 shrink-0"
                        title="Copier le compte"
                      >
                        {copiedKey === method ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Encaissé :</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {formatPrice(st.collected)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Retiré :</span>
                        <span className="font-semibold text-slate-600 tabular-nums">
                          -{formatPrice(st.withdrawn)}
                        </span>
                      </div>
                      {st.pending > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>En attente :</span>
                          <span className="font-bold tabular-nums">
                            {formatPrice(st.pending)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Disponible
                      </span>
                      <span className="text-sm font-black font-heading text-[#0B192C] tabular-nums">
                        {formatPrice(st.available)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={st.available <= 0}
                      onClick={() => openPayoutModal(method)}
                      className="w-full py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-sky-600 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-500 text-slate-700 transition-colors"
                    >
                      Transférer ce solde
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Orders Payment Verification & Reconciliation Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Journal des Encaissements & Rapprochement Commandes
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmez la réception réelle des transferts Mobile Money (ID SMS) et des paiements à la livraison
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="N° cmd, client, réf. SMS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 w-48 sm:w-56"
                  />
                </div>

                <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-semibold">
                  {(
                    [
                      { id: 'ALL', label: 'Tous' },
                      { id: 'PENDING', label: 'À encaisser' },
                      { id: 'PAID', label: 'Encaissés' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterMode(f.id)}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        filterMode === f.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Commande</th>
                    <th className="py-3 px-3">Client</th>
                    <th className="py-3 px-3">Canal Paiement</th>
                    <th className="py-3 px-3">Référence SMS / TPE</th>
                    <th className="py-3 px-3">Payé / Total TTC</th>
                    <th className="py-3 px-3">Statut Paiement</th>
                    <th className="py-3 px-4 text-right">Action Vendeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const meta = PAYMENT_CHANNEL_META[order.paymentMethod];
                    const totalTTC = computeOrderTaxBreakdown(order, merchant).totalAmount;
                    const paid = getOrderAmountPaid(order, totalTTC);
                    const remaining = Math.max(0, totalTTC - paid);
                    const pStatus = getEffectiveOrderPaymentStatus(order, merchant);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 block">
                            {order.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {order.date}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">
                            {order.customerName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {order.customerPhone}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded border font-bold text-[10px] ${meta.badgeClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {order.paymentReference ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                              {order.paymentReference}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Non renseignée
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 tabular-nums">
                          <p className="font-black text-slate-900">
                            {formatPrice(paid)} /{' '}
                            <span className="text-slate-500 font-semibold">
                              {formatPrice(totalTTC)}
                            </span>
                          </p>
                          {remaining > 0 && (
                            <p className="text-[10px] text-amber-700 font-bold">
                              Reste : {formatPrice(remaining)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {getPaymentStatusBadge(pStatus)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {pStatus !== 'PAID' ? (
                              <button
                                onClick={() => openConfirmModal(order)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Encaisser</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openConfirmModal(order)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                              >
                                Modifier réf.
                              </button>
                            )}
                            <button
                              onClick={() => onOpenInvoice(order)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Voir reçu / facture"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-400 text-xs"
                      >
                        Aucune transaction trouvée pour ce filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SELLER PAYOUTS & BANK TRANSFERS */}
      {activeSubTab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                Historique des Retraits & Reversements Vendeur
              </h3>
              <p className="text-xs text-slate-500">
                Suivez les sommes transférées depuis vos comptes MoMo / caisse vers votre banque ou portefeuille personnel
              </p>
            </div>
            <button
              onClick={() => openPayoutModal()}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer un reversement</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Canal Source</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Référence</th>
                  <th className="py-3 px-3">Montant Transféré</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellerPayouts.map((p) => {
                  const meta = PAYMENT_CHANNEL_META[p.sourceMethod];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded border font-bold text-[10px] ${meta.badgeClass}`}
                        >
                          {meta.shortLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">
                          {p.destinationType === 'BANQUE'
                            ? 'Compte Bancaire Pro'
                            : p.destinationType === 'MOMO_PERSO'
                            ? 'Mobile Money Gérant'
                            : 'Coffre Boutique'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {p.destinationAccount}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                        {p.reference || '—'}
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900 text-sm tabular-nums whitespace-nowrap">
                        {formatPrice(p.amount)}
                      </td>
                      <td className="py-3 px-3">
                        {p.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Validé
                          </span>
                        ) : (
                          <button
                            onClick={() => onCompleteSellerPayout(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold"
                          >
                            <Clock className="w-3 h-3" /> Valider réception
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 max-w-[220px] truncate">
                        {p.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
                {sellerPayouts.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      Aucun reversement enregistré pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SELLER PAYMENT CHANNELS CONFIGURATION */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span>Moyens de Paiement Acceptés (Vitrine & Caisse POS)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Activez ou désactivez les canaux proposés à vos clients lors du passage de commande
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {ALL_PAYMENT_METHODS.map((method) => {
                const meta = PAYMENT_CHANNEL_META[method];
                const isActive = enabledMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => toggleMethod(method)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start justify-between gap-3 ${
                      isActive
                        ? 'border-sky-600 bg-sky-50/50'
                        : 'border-slate-200 bg-slate-50 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                        <span className="font-bold text-slate-900">{meta.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{meta.description}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isActive ? 'Activé' : 'Inactif'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Comptes de Réception Vendeur & Coordonnées Bancaires</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ces coordonnées s'affichent automatiquement aux acheteurs sur la vitrine et servent à vos reversements
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Numéro MTN MoMo Bénin
                </label>
                <input
                  type="text"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/30 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Numéro Moov Money (Flooz)
                </label>
                <input
                  type="text"
                  value={moovNumber}
                  onChange={(e) => setMoovNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-blue-50/30 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Numéro Celtiis Cash (SBIN)
                </label>
                <input
                  type="text"
                  value={celtiisNumber}
                  onChange={(e) => setCeltiisNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-orange-300 bg-orange-50/30 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Code Marchand MoMo / USSD (optionnel)
                </label>
                <input
                  type="text"
                  value={momoMerchantCode}
                  onChange={(e) => setMomoMerchantCode(e.target.value)}
                  placeholder="Ex: *880*41*884512#"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">
                  Compte Bancaire / RIB / IBAN (pour vos reversements)
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Ex: BJ061 01001 000482910312 45 (BOA Bénin)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-800 mb-1">
                  Instructions affichées au client lors du paiement
                </label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="Ex: Merci d'indiquer votre nom ou N° de commande en référence lors du transfert Mobile Money."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {settingsSaved ? (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Configuration des paiements vendeur enregistrée !
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Synchronisé en temps réel avec la Vitrine Client et la Caisse POS
                </span>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les canaux vendeur</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* CONFIRM / RECONCILE ORDER PAYMENT MODAL */}
      {verifyingOrder && (() => {
        const totalTTC = computeOrderTaxBreakdown(verifyingOrder, merchant).totalAmount;
        const alreadyPaid = getOrderAmountPaid(verifyingOrder, totalTTC);
        const meta = PAYMENT_CHANNEL_META[verifyingOrder.paymentMethod];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="fixed inset-0" onClick={() => setVerifyingOrder(null)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
              <div className="p-5 bg-[#0B192C] text-white flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-base">
                    Confirmer Encaissement • {verifyingOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-sky-300">
                    {verifyingOrder.customerName} • {meta.shortLabel}
                  </p>
                </div>
                <button
                  onClick={() => setVerifyingOrder(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Commande TTC :</span>
                    <span className="font-black text-slate-900 tabular-nums">
                      {formatPrice(totalTTC)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Déjà encaissé :</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {formatPrice(alreadyPaid)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Montant total encaissé (FCFA) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setConfirmAmount(totalTTC)}
                      className="text-[11px] font-bold text-sky-600 hover:underline"
                    >
                      Tout solder ({formatPrice(totalTTC)})
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={totalTTC}
                    required
                    value={confirmAmount}
                    onChange={(e) => setConfirmAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Référence Transaction SMS / Reçu (ex: MOMO-847291)
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={confirmRef}
                      onChange={(e) => setConfirmRef(e.target.value)}
                      placeholder="ID SMS opérateur ou N° reçu TPE..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmMarkDelivered}
                    onChange={(e) => setConfirmMarkDelivered(e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-600"
                  />
                  <span className="font-semibold text-emerald-900">
                    Marquer également la commande comme Livrée
                  </span>
                </label>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyingOrder(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valider l'encaissement</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* NEW SELLER PAYOUT MODAL */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsPayoutModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 bg-[#0B192C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base">
                    Nouveau Reversement / Retrait Vendeur
                  </h3>
                  <p className="text-[11px] text-sky-200">
                    Transférez vos fonds encaissés vers votre banque ou compte personnel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayout} className="p-6 space-y-4 text-xs">
              {payoutError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{payoutError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Canal source à débiter *
                  </label>
                  <select
                    value={payoutSource}
                    onChange={(e) => {
                      const m = e.target.value as PaymentMethod;
                      setPayoutSource(m);
                      setPayoutAmount(channelStats.get(m)?.available || 0);
                      setPayoutError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    {ALL_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_CHANNEL_META[m].shortLabel} (Dispo :{' '}
                        {formatPrice(channelStats.get(m)?.available || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Destination des fonds *
                  </label>
                  <select
                    value={payoutDestType}
                    onChange={(e) =>
                      handleDestTypeChange(e.target.value as PayoutDestinationType)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="BANQUE">Compte Bancaire Pro</option>
                    <option value="MOMO_PERSO">Mobile Money Gérant</option>
                    <option value="CAISSE_COFFRE">Coffre / Réserve Boutique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Compte / IBAN / Numéro de destination *
                </label>
                <input
                  type="text"
                  required
                  value={payoutDestAccount}
                  onChange={(e) => setPayoutDestAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Montant à transférer (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={payoutAmount || ''}
                    onChange={(e) => {
                      setPayoutAmount(Math.max(0, Number(e.target.value) || 0));
                      setPayoutError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Disponible :{' '}
                    <strong className="text-slate-700">
                      {formatPrice(channelStats.get(payoutSource)?.available || 0)}
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Référence bordereau / SMS
                  </label>
                  <input
                    type="text"
                    value={payoutRef}
                    onChange={(e) => setPayoutRef(e.target.value)}
                    placeholder="Optionnel (généré auto si vide)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Note / Motif
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Ex: Versement recettes semaine..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B192C] to-sky-700 text-white font-bold shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer le reversement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
