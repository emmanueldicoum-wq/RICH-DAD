import React from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  QrCode,
  FileText,
  ArrowRightCircle,
  MessageCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Quote, MerchantProfile } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface QuoteModalProps {
  quote: Quote | null;
  merchant: MerchantProfile;
  onClose: () => void;
  onAcceptQuote?: (quote: Quote) => void;
  onOpenConvertModal?: (quote: Quote) => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  quote,
  merchant,
  onClose,
  onAcceptQuote,
  onOpenConvertModal,
}) => {
  const { formatPrice, currency, currentCurrencyDetails } = useCurrency();
  if (!quote) return null;

  const netHT = Math.max(0, quote.subtotal - (quote.discountAmount || 0));

  const getStatusLabel = (status: Quote['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'BROUILLON';
      case 'SENT':
        return 'ENVOYÉ AU CLIENT';
      case 'ACCEPTED':
        return 'VALIDÉ PAR LE CLIENT';
      case 'CONVERTED':
        return `CONVERTI (${quote.convertedOrderNumber || 'COMMANDE'})`;
      case 'REJECTED':
        return 'REFUSÉ';
      case 'EXPIRED':
        return 'EXPIRÉ';
    }
  };

  const handleShareWhatsApp = () => {
    const lines = quote.items
      .map(
        (i) =>
          `• ${i.quantity}x ${i.productName} (${formatPrice(i.unitPrice * i.quantity)})`
      )
      .join('\n');
    const msg = encodeURIComponent(
      `Bonjour ${quote.customerName},\nVoici votre devis *${quote.quoteNumber}* chez *${merchant.storeName}* (valable jusqu'au ${quote.validUntil}) :\n\n${lines}\n\nSous-total HT : ${formatPrice(quote.subtotal)}${
        quote.discountAmount > 0 ? `\nRemise : -${formatPrice(quote.discountAmount)}` : ''
      }${
        quote.taxRate > 0 ? `\n${quote.taxLabel} (${quote.taxRate}%) : ${formatPrice(quote.taxAmount)}` : ''
      }\nLivraison (${quote.deliveryCity}) : ${formatPrice(quote.deliveryFee)}\n*TOTAL TTC : ${formatPrice(quote.totalAmount)}*\n\nRépondez *OK* pour valider et lancer la commande !`
    );
    const cleanPhone = quote.customerPhone.replace(/[^0-9]/g, '');
    window.open(
      cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`,
      '_blank'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[95vh] flex flex-col">
        {/* Actions Bar */}
        <div className="p-4 bg-[#0B192C] text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <span className="font-heading font-bold text-sm">
              Facture Proforma / Devis Client
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Proforma Sheet */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-800 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0B192C] text-white font-black text-sm flex items-center justify-center">
                  BP
                </div>
                <h2 className="text-xl font-black font-heading text-slate-900">
                  {merchant.storeName}
                </h2>
              </div>
              <p className="text-slate-600 font-medium">{merchant.address}</p>
              <p className="text-slate-500">{merchant.city}, République du Bénin</p>
              <p className="text-slate-500 font-mono">
                Tél : {merchant.phone} • WhatsApp : {merchant.whatsapp}
              </p>
              <div className="pt-1 flex items-center gap-1 font-mono font-bold text-slate-900">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>N° IFU : {merchant.ifuNumber}</span>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-block px-2.5 py-1 rounded bg-sky-50 border border-sky-200 font-mono font-black text-xs text-sky-900 uppercase">
                DEVIS N° {quote.quoteNumber}
              </span>
              <p className="text-slate-500 mt-1">Émis le : {quote.createdAt}</p>
              <p className="text-slate-600 font-semibold flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Valable jusqu'au : {quote.validUntil}</span>
              </p>
              <p className="text-[11px] font-bold text-slate-800">
                Statut : {getStatusLabel(quote.status)}
              </p>
            </div>
          </div>

          {/* Client Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Devis établi pour :
              </p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {quote.customerName}
              </p>
              <p className="font-mono text-slate-600 mt-0.5">{quote.customerPhone}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Livraison prévue :
              </p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {quote.deliveryCity}
              </p>
              <p className="text-slate-600 mt-0.5">{quote.deliveryAddress}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-600 font-bold uppercase text-[10px]">
                <th className="py-2">Désignation</th>
                <th className="py-2 text-center">Qté</th>
                <th className="py-2 text-right">Prix Unitaire</th>
                <th className="py-2 text-right">
                  Total ({currentCurrencyDetails.symbol})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {quote.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 font-semibold text-slate-900">
                    {item.productName}
                    {item.variant && (
                      <span className="text-slate-500 font-normal block text-[11px]">
                        {item.variant}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center font-mono tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {formatPrice(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold tabular-nums">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
            <div className="flex-1 text-[11px] text-slate-600 space-y-1">
              {quote.notes && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950">
                  <p className="font-bold text-[10px] uppercase tracking-wider text-amber-800 mb-0.5">
                    Conditions & Remarques
                  </p>
                  <p>{quote.notes}</p>
                </div>
              )}
              <p className="text-slate-500 pt-1">
                Règlement souhaité : <strong>{quote.preferredPaymentMethod}</strong>
              </p>
            </div>

            <div className="w-full sm:w-76 space-y-2 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total brut HT :</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatPrice(quote.subtotal)}
                </span>
              </div>
              {quote.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Remise commerciale :</span>
                  <span className="font-mono tabular-nums">
                    - {formatPrice(quote.discountAmount)}
                  </span>
                </div>
              )}
              {quote.discountAmount > 0 && (
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>Net commercial HT :</span>
                  <span className="font-mono tabular-nums">
                    {formatPrice(netHT)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>
                  {quote.taxLabel} ({quote.taxRate > 0 ? `${quote.taxRate}%` : '0%'}):
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatPrice(quote.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Livraison ({quote.deliveryCity}) :</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatPrice(quote.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 text-sm font-black text-slate-900">
                <span>TOTAL DEVIS TTC :</span>
                <span className="text-base text-sky-700 font-mono tabular-nums">
                  {formatPrice(quote.totalAmount)}
                </span>
              </div>
              {currency !== 'FCFA' && (
                <p className="text-[10px] text-slate-400 italic text-right pt-1">
                  Équivalent légal : {formatPrice(quote.totalAmount, 'FCFA')}
                </p>
              )}
            </div>
          </div>

          {/* Quick Conversion Action Footer */}
          {(quote.status === 'DRAFT' ||
            quote.status === 'SENT' ||
            quote.status === 'ACCEPTED') && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
              <div className="text-xs text-slate-600">
                {quote.status === 'ACCEPTED' ? (
                  <span className="font-semibold text-emerald-800">
                    Le client a validé ce devis. Vous pouvez le transformer en commande ferme en 1 clic.
                  </span>
                ) : (
                  <span>
                    Une fois le devis approuvé par le client, validez-le pour débloquer la conversion en commande.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(quote.status === 'DRAFT' || quote.status === 'SENT') &&
                  onAcceptQuote && (
                    <button
                      onClick={() => onAcceptQuote(quote)}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Marquer Validé</span>
                    </button>
                  )}
                {quote.status === 'ACCEPTED' && onOpenConvertModal && (
                  <button
                    onClick={() => onOpenConvertModal(quote)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <ArrowRightCircle className="w-4 h-4" />
                    <span>Convertir en Commande</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">
                Facture proforma générée via BOUTIKPRO Bénin.
              </p>
              <p>
                Ce devis est valable sous réserve de disponibilité des stocks au moment de la validation.
              </p>
            </div>
            <div className="text-center font-mono">
              <div className="w-11 h-11 bg-slate-100 rounded border border-slate-300 flex items-center justify-center mx-auto mb-0.5">
                <QrCode className="w-7 h-7 text-slate-700" />
              </div>
              <span>PROFORMA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
