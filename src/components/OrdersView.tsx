import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Eye, 
  MessageCircle, 
  Printer, 
  CheckCircle, 
  Clock, 
  Truck, 
  X, 
  ExternalLink,
  MapPin,
  Phone,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { MerchantProfile, Order, OrderStatus, PaymentMethod, PaymentStatus } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { computeOrderTaxBreakdown } from '../utils/tax';
import {
  getEffectiveOrderPaymentStatus,
  getOrderAmountPaid,
} from '../utils/payment';
import { ConfirmPaymentPayload } from './PaymentsView';

interface OrdersViewProps {
  orders: Order[];
  merchant: MerchantProfile;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onConfirmOrderPayment?: (payload: ConfirmPaymentPayload) => void;
  onOpenInvoice: (order: Order) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  merchant,
  onUpdateOrderStatus,
  onConfirmOrderPayment,
  onOpenInvoice,
  selectedOrder,
  setSelectedOrder,
}) => {
  const { formatPrice } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [quickPaidAmount, setQuickPaidAmount] = useState<string>('');
  const [quickPayRef, setQuickPayRef] = useState<string>('');

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone.includes(searchTerm) ||
      o.deliveryCity.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || o.paymentMethod === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Payée
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> En attente
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
            <Truck className="w-3 h-3 text-sky-600" /> En livraison
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
            <CheckCircle className="w-3 h-3 text-slate-500" /> Livrée
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Annulée
          </span>
        );
    }
  };

  const getPaymentBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'MTN_MOMO':
        return <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-900 border border-amber-300 font-bold text-[10px]">MTN MoMo</span>;
      case 'MOOV_MONEY':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-900 border border-blue-300 font-bold text-[10px]">Moov Flooz</span>;
      case 'CELTIIS_CASH':
        return <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-900 border border-orange-300 font-bold text-[10px]">Celtiis Cash</span>;
      case 'CASH_ON_DELIVERY':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-900 border border-emerald-300 font-bold text-[10px]">Espèces</span>;
      case 'CARTE_BANCAIRE':
        return <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-900 border border-purple-300 font-bold text-[10px]">Carte Bancaire</span>;
    }
  };

  const getPaymentStatusChip = (pStatus: PaymentStatus) => {
    switch (pStatus) {
      case 'PAID':
        return <span className="text-[10px] font-bold text-emerald-700">✓ Encaissé</span>;
      case 'PARTIAL':
        return <span className="text-[10px] font-bold text-sky-700">◐ Acompte</span>;
      case 'REFUNDED':
        return <span className="text-[10px] font-bold text-slate-500">↺ Remboursé</span>;
      case 'UNPAID':
      default:
        return <span className="text-[10px] font-bold text-amber-700">⏳ À encaisser</span>;
    }
  };

  const openWhatsAppChat = (order: Order) => {
    const { totalAmount } = computeOrderTaxBreakdown(order, merchant);
    const message = encodeURIComponent(
      `Bonjour ${order.customerName}, ici votre boutique BOUTIKPRO. Concernant votre commande ${order.orderNumber} d'un montant de ${formatPrice(totalAmount)} : nous préparons l'expédition pour ${order.deliveryCity}. Merci pour votre confiance !`
    );
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            Gestion des Commandes & Expéditions
          </h2>
          <p className="text-xs text-slate-500">
            Suivi des commandes passées sur votre boutique en ligne, WhatsApp et caisse physique
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Total : <strong className="text-slate-900">{orders.length}</strong> commande(s)
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Rechercher par N° commande, nom client, téléphone ou ville (ex: Haie Vive, Calavi)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PAID">Payée</option>
            <option value="SHIPPED">En cours de livraison</option>
            <option value="DELIVERED">Livrée</option>
            <option value="CANCELLED">Annulée</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tous les paiements</option>
            <option value="MTN_MOMO">MTN Mobile Money</option>
            <option value="MOOV_MONEY">Moov Money (Flooz)</option>
            <option value="CELTIIS_CASH">Celtiis Cash</option>
            <option value="CASH_ON_DELIVERY">Espèces à la livraison</option>
            <option value="CARTE_BANCAIRE">Carte Bancaire / TPE</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Commande</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Articles</th>
                <th className="py-3 px-3">Paiement</th>
                <th className="py-3 px-3">Montant Total</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const totalItemsCount = order.items.reduce((s, i) => s + i.quantity, 0);
                const { totalAmount: orderTotalTTC } = computeOrderTaxBreakdown(order, merchant);
                const pStatus = getEffectiveOrderPaymentStatus(order, merchant);

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {order.orderNumber}
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        order.channel === 'STORE_FRONT' ? 'bg-sky-50 text-sky-700' :
                        order.channel === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {order.channel === 'STORE_FRONT' ? 'Web' : order.channel === 'WHATSAPP' ? 'WhatsApp' : 'Caisse POS'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {order.date}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{order.customerName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{order.customerPhone}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <span className="font-medium">{order.deliveryCity}</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{order.deliveryAddress}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <span className="font-semibold">{totalItemsCount} article{totalItemsCount > 1 ? 's' : ''}</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {order.items[0]?.productName}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div>{getPaymentBadge(order.paymentMethod)}</div>
                        <div>{getPaymentStatusChip(pStatus)}</div>
                        {order.paymentReference && (
                          <p className="text-[10px] font-mono text-slate-500 truncate max-w-[110px]">
                            {order.paymentReference}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900 text-sm whitespace-nowrap tabular-nums">
                      {formatPrice(orderTotalTTC)}
                    </td>
                    <td className="py-3 px-3">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setQuickPaidAmount(String(orderTotalTTC));
                            setQuickPayRef(order.paymentReference || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold transition-colors flex items-center gap-1"
                          title="Voir le détail de la commande"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Détails</span>
                        </button>
                        <button
                          onClick={() => onOpenInvoice(order)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Imprimer facture normalisée"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setSelectedOrder(null)} />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-lg text-slate-900">
                    Commande {selectedOrder.orderNumber}
                  </span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enregistrée le {selectedOrder.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Customer Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Informations Client & Livraison
                  </span>
                  <button
                    onClick={() => openWhatsAppChat(selectedOrder)}
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold text-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Contacter sur WhatsApp</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-slate-400">Nom complet</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Téléphone</p>
                    <p className="font-bold text-slate-900 font-mono mt-0.5">{selectedOrder.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Ville / Région</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedOrder.deliveryCity}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Adresse de livraison</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedOrder.deliveryAddress}</p>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200">
                    <p className="text-slate-400">Notes du client :</p>
                    <p className="text-slate-700 italic mt-0.5">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-2">
                  Articles Commandés
                </h4>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          {item.variant && (
                            <p className="text-[11px] text-sky-600">{item.variant}</p>
                          )}
                          <p className="text-[11px] text-slate-500 font-mono">
                            {formatPrice(item.unitPrice)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown & Payment Verification */}
              {(() => {
                const { taxRate, taxLabel, taxAmount, totalAmount } = computeOrderTaxBreakdown(selectedOrder, merchant);
                const paid = getOrderAmountPaid(selectedOrder, totalAmount);
                const remaining = Math.max(0, totalAmount - paid);
                const pStatus = getEffectiveOrderPaymentStatus(selectedOrder, merchant);
                const parsedQuickAmount =
                  quickPaidAmount.trim() !== ''
                    ? Math.max(0, Math.min(totalAmount, Number(quickPaidAmount) || 0))
                    : totalAmount;

                return (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Sous-total articles HT :</span>
                        <span className="font-semibold font-mono tabular-nums">{formatPrice(selectedOrder.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>{taxLabel} ({taxRate > 0 ? `${taxRate}%` : 'Exonéré 0%'}) :</span>
                        <span className="font-semibold font-mono text-amber-700 tabular-nums">{formatPrice(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Frais de livraison ({selectedOrder.deliveryCity}) :</span>
                        <span className="font-semibold font-mono tabular-nums">{formatPrice(selectedOrder.deliveryFee)}</span>
                      </div>
                      <div className="pt-2 border-t border-sky-200 flex justify-between items-center text-sm font-bold text-slate-900">
                        <span>Total TTC :</span>
                        <span className="text-base font-black font-heading text-sky-700 tabular-nums">
                          {formatPrice(totalAmount)}
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Moyen & Statut :</span>
                        <div className="flex items-center gap-2">
                          {getPaymentBadge(selectedOrder.paymentMethod)}
                          {getPaymentStatusChip(pStatus)}
                        </div>
                      </div>
                      {selectedOrder.paymentReference && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Réf. Transaction :</span>
                          <span className="font-mono font-bold text-slate-800">{selectedOrder.paymentReference}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-sky-200/70">
                        <span className="text-slate-600 font-semibold">Montant encaissé :</span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">{formatPrice(paid)}</span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-amber-800 font-bold">Reste à encaisser :</span>
                          <span className="font-mono font-black text-amber-800 tabular-nums">{formatPrice(remaining)}</span>
                        </div>
                      )}
                    </div>

                    {onConfirmOrderPayment && selectedOrder.status !== 'CANCELLED' && pStatus !== 'PAID' && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                        <p className="font-bold text-emerald-900 text-[11px] flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Encaisser / Valider le règlement</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              Montant reçu (FCFA)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={totalAmount}
                              value={quickPaidAmount || String(totalAmount)}
                              onChange={(e) => setQuickPaidAmount(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              Réf. SMS / TPE
                            </label>
                            <div className="relative">
                              <Hash className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                              <input
                                type="text"
                                value={quickPayRef}
                                onChange={(e) => setQuickPayRef(e.target.value)}
                                placeholder={selectedOrder.paymentReference || 'MOMO-..., TPE-...'}
                                className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextPaymentStatus: PaymentStatus =
                              parsedQuickAmount >= totalAmount
                                ? 'PAID'
                                : parsedQuickAmount > 0
                                ? 'PARTIAL'
                                : 'UNPAID';
                            const nextOrderStatus: OrderStatus =
                              nextPaymentStatus === 'PAID' && selectedOrder.status === 'PENDING'
                                ? 'PAID'
                                : selectedOrder.status;
                            onConfirmOrderPayment({
                              orderId: selectedOrder.id,
                              amountPaid: parsedQuickAmount,
                              paymentReference: quickPayRef.trim() || selectedOrder.paymentReference,
                              paymentStatus: nextPaymentStatus,
                              orderStatus: nextOrderStatus,
                            });
                          }}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                        >
                          Confirmer l'encaissement ({formatPrice(parsedQuickAmount)})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Status Change Controls */}
              <div className="space-y-2">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Changer le statut de la commande
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'PENDING')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border ${
                      selectedOrder.status === 'PENDING' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    En attente
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'PAID')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border ${
                      selectedOrder.status === 'PAID' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Payée MoMo
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'SHIPPED')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border ${
                      selectedOrder.status === 'SHIPPED' ? 'bg-sky-600 text-white border-sky-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    En livraison
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'DELIVERED')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border ${
                      selectedOrder.status === 'DELIVERED' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Livrée ✓
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => onOpenInvoice(selectedOrder)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimer Facture Normalisée</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
