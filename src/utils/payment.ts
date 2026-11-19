import { MerchantProfile, Order, PaymentMethod, PaymentStatus } from '../types';
import { computeOrderTaxBreakdown } from './tax';

export const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  'MTN_MOMO',
  'MOOV_MONEY',
  'CELTIIS_CASH',
  'CASH_ON_DELIVERY',
  'CARTE_BANCAIRE',
];

export const PAYMENT_CHANNEL_META: Record<
  PaymentMethod,
  {
    label: string;
    shortLabel: string;
    ussd?: string;
    dotColor: string;
    barColor: string;
    badgeClass: string;
    description: string;
  }
> = {
  MTN_MOMO: {
    label: 'MTN Mobile Money (MoMo)',
    shortLabel: 'MTN MoMo',
    ussd: '*880#',
    dotColor: 'bg-amber-400',
    barColor: 'bg-amber-400',
    badgeClass: 'bg-amber-400/20 text-amber-900 border-amber-300',
    description: 'Portefeuille marchand MTN MoMo Bénin',
  },
  MOOV_MONEY: {
    label: 'Moov Money (Flooz)',
    shortLabel: 'Moov Flooz',
    ussd: '*155#',
    dotColor: 'bg-[#004D98]',
    barColor: 'bg-[#004D98]',
    badgeClass: 'bg-blue-500/20 text-blue-900 border-blue-300',
    description: 'Portefeuille marchand Moov Money Flooz',
  },
  CELTIIS_CASH: {
    label: 'Celtiis Cash (SBIN)',
    shortLabel: 'Celtiis Cash',
    ussd: '*889#',
    dotColor: 'bg-[#FF6600]',
    barColor: 'bg-[#FF6600]',
    badgeClass: 'bg-orange-500/20 text-orange-900 border-orange-300',
    description: 'Portefeuille marchand Celtiis Cash Bénin',
  },
  CASH_ON_DELIVERY: {
    label: 'Espèces / Caisse & Livraison',
    shortLabel: 'Espèces',
    dotColor: 'bg-emerald-500',
    barColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/20 text-emerald-900 border-emerald-300',
    description: 'Encaissement cash au comptoir ou à la livraison',
  },
  CARTE_BANCAIRE: {
    label: 'Carte Bancaire / TPE',
    shortLabel: 'Carte / TPE',
    dotColor: 'bg-purple-600',
    barColor: 'bg-purple-600',
    badgeClass: 'bg-purple-500/20 text-purple-900 border-purple-300',
    description: 'Terminal TPE Visa / Mastercard ou virement carte',
  },
};

export function getEnabledPaymentMethods(merchant: MerchantProfile): PaymentMethod[] {
  if (merchant.enabledPaymentMethods && merchant.enabledPaymentMethods.length > 0) {
    return merchant.enabledPaymentMethods;
  }
  return ALL_PAYMENT_METHODS;
}

export function getMerchantChannelAccount(
  merchant: MerchantProfile,
  method: PaymentMethod
): string {
  switch (method) {
    case 'MTN_MOMO':
      return merchant.momoNumber || 'Non configuré';
    case 'MOOV_MONEY':
      return merchant.moovNumber || 'Non configuré';
    case 'CELTIIS_CASH':
      return merchant.celtiisNumber || 'Non configuré';
    case 'CARTE_BANCAIRE':
      return merchant.bankAccount || 'TPE Boutique / Compte Bancaire';
    case 'CASH_ON_DELIVERY':
      return `Caisse ${merchant.storeName}`;
  }
}

export function getEffectiveOrderPaymentStatus(
  order: Order,
  merchant?: MerchantProfile
): PaymentStatus {
  if (order.paymentStatus) {
    return order.paymentStatus;
  }
  if (order.status === 'CANCELLED') {
    return 'UNPAID';
  }
  if (order.status === 'PAID' || order.status === 'DELIVERED') {
    return 'PAID';
  }
  if (order.status === 'SHIPPED' && order.paymentMethod !== 'CASH_ON_DELIVERY') {
    return 'PAID';
  }
  if (merchant) {
    const total = computeOrderTaxBreakdown(order, merchant).totalAmount;
    if (order.amountPaid !== undefined && order.amountPaid >= total && total > 0) {
      return 'PAID';
    }
    if (order.amountPaid !== undefined && order.amountPaid > 0) {
      return 'PARTIAL';
    }
  }
  return 'UNPAID';
}

export function getOrderAmountPaid(order: Order, totalAmount: number): number {
  if (order.status === 'CANCELLED') return 0;
  if (typeof order.amountPaid === 'number' && !Number.isNaN(order.amountPaid)) {
    return Math.max(0, Math.min(totalAmount, order.amountPaid));
  }
  const status = getEffectiveOrderPaymentStatus(order);
  if (status === 'PAID') return totalAmount;
  return 0;
}
