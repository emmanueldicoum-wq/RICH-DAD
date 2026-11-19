import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  ArrowUp,
  History,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { StockMovement, Supplier, SupplierPayment } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface SuppliersPanelProps {
  suppliers: Supplier[];
  stockMovements: StockMovement[];
  supplierPayments: SupplierPayment[];
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onAddSupplierPayment: (payment: SupplierPayment) => void;
  onQuickEntryForSupplier?: (supplierId: string) => void;
}

interface SupplierLedgerStats extends Supplier {
  linkedMovements: StockMovement[];
  payments: SupplierPayment[];
  totalPurchased: number;
  totalPaidAtReception: number;
  totalSubsequentPayments: number;
  totalPaid: number;
  unpaidBalance: number;
}

export const computeSupplierLedger = (
  supplier: Supplier,
  stockMovements: StockMovement[],
  supplierPayments: SupplierPayment[]
): SupplierLedgerStats => {
  const linkedMovements = stockMovements.filter(
    m => m.type === 'IN' && m.supplierId === supplier.id
  );
  const payments = supplierPayments.filter(p => p.supplierId === supplier.id);

  const totalPurchased = linkedMovements.reduce((s, m) => s + (m.totalCost || 0), 0);
  const totalPaidAtReception = linkedMovements.reduce((s, m) => s + (m.amountPaid || 0), 0);
  const totalSubsequentPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = totalPaidAtReception + totalSubsequentPayments;
  const unpaidBalance = Math.max(0, totalPurchased - totalPaid);

  return {
    ...supplier,
    linkedMovements,
    payments,
    totalPurchased,
    totalPaidAtReception,
    totalSubsequentPayments,
    totalPaid,
    unpaidBalance,
  };
};

export const SuppliersPanel: React.FC<SuppliersPanelProps> = ({
  suppliers,
  stockMovements,
  supplierPayments,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddSupplierPayment,
  onQuickEntryForSupplier,
}) => {
  const { formatPrice } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);

  // Add/Edit Supplier Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('+229 ');
  const [formCity, setFormCity] = useState('Cotonou');
  const [formCategory, setFormCategory] = useState('Mode & Wax');
  const [formNotes, setFormNotes] = useState('');

  // Settlement Payment Modal
  const [settleSupplier, setSettleSupplier] = useState<SupplierLedgerStats | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'ESPECES' | 'MTN_MOMO' | 'MOOV_MONEY' | 'VIREMENT'>('MTN_MOMO');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Ledger History Modal
  const [historySupplierId, setHistorySupplierId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const ledgerList = useMemo(
    () => suppliers.map(s => computeSupplierLedger(s, stockMovements, supplierPayments)),
    [suppliers, stockMovements, supplierPayments]
  );

  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ledgerList.filter(s => {
      if (onlyUnpaid && s.unpaidBalance <= 0) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [ledgerList, searchTerm, onlyUnpaid]);

  const totals = useMemo(() => {
    const totalPurchased = ledgerList.reduce((s, x) => s + x.totalPurchased, 0);
    const totalPaid = ledgerList.reduce((s, x) => s + x.totalPaid, 0);
    const totalUnpaid = ledgerList.reduce((s, x) => s + x.unpaidBalance, 0);
    const unpaidSuppliersCount = ledgerList.filter(x => x.unpaidBalance > 0).length;
    return { totalPurchased, totalPaid, totalUnpaid, unpaidSuppliersCount };
  }, [ledgerList]);

  const historySupplier = useMemo(
    () => (historySupplierId ? ledgerList.find(s => s.id === historySupplierId) || null : null),
    [historySupplierId, ledgerList]
  );

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContact('');
    setFormPhone('+229 ');
    setFormCity('Cotonou');
    setFormCategory('Mode & Wax');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContact(sup.contactPerson || '');
    setFormPhone(sup.phone);
    setFormCity(sup.city);
    setFormCategory(sup.category);
    setFormNotes(sup.notes || '');
    setIsFormOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name: formName.trim(),
        contactPerson: formContact.trim() || undefined,
        phone: formPhone.trim(),
        city: formCity.trim() || 'Cotonou',
        category: formCategory.trim() || 'Général',
        notes: formNotes.trim() || undefined,
      });
      setNotice(`Fournisseur "${formName.trim()}" mis à jour.`);
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: formName.trim(),
        contactPerson: formContact.trim() || undefined,
        phone: formPhone.trim(),
        city: formCity.trim() || 'Cotonou',
        category: formCategory.trim() || 'Général',
        notes: formNotes.trim() || undefined,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onAddSupplier(newSup);
      setNotice(`Fournisseur "${newSup.name}" ajouté au répertoire.`);
    }

    setIsFormOpen(false);
    setTimeout(() => setNotice(null), 4000);
  };

  const openSettleModal = (sup: SupplierLedgerStats) => {
    setSettleSupplier(sup);
    setPayAmount(sup.unpaidBalance);
    setPayMethod('MTN_MOMO');
    setPayReference('');
    setPayNotes('');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleSupplier || payAmount <= 0) return;

    const actualAmount = Math.min(payAmount, settleSupplier.unpaidBalance);
    const payment: SupplierPayment = {
      id: `spay-${Date.now()}`,
      supplierId: settleSupplier.id,
      amount: actualAmount,
      paymentMethod: payMethod,
      reference: payReference.trim() || undefined,
      notes: payNotes.trim() || 'Règlement solde fournisseur',
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    onAddSupplierPayment(payment);
    setNotice(
      `Règlement de ${formatPrice(actualAmount)} enregistré pour ${settleSupplier.name}.`
    );
    setSettleSupplier(null);
    setTimeout(() => setNotice(null), 4500);
  };

  const getPaymentMethodLabel = (m: SupplierPayment['paymentMethod']) => {
    switch (m) {
      case 'ESPECES': return 'Espèces FCFA';
      case 'MTN_MOMO': return 'MTN MoMo';
      case 'MOOV_MONEY': return 'Moov Money';
      case 'VIREMENT': return 'Virement / Chèque';
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Fournisseurs Actifs
          </p>
          <p className="text-2xl font-black font-heading text-slate-900 mt-2 tabular-nums">
            {suppliers.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Grossistes, coopératives & importateurs
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Approvisionnements (IN)
          </p>
          <p className="text-2xl font-black font-heading text-slate-900 mt-2 tabular-nums">
            {formatPrice(totals.totalPurchased)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cumul des entrées liées
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Déjà Réglé
          </p>
          <p className="text-2xl font-black font-heading text-emerald-700 mt-2 tabular-nums">
            {formatPrice(totals.totalPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Comptant + règlements ultérieurs
          </p>
        </div>

        <div className={`rounded-2xl p-5 border shadow-xs ${
          totals.totalUnpaid > 0
            ? 'bg-rose-50/70 border-rose-200'
            : 'bg-emerald-50/60 border-emerald-200'
        }`}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Soldes Impayés Totaux
          </p>
          <p className={`text-2xl font-black font-heading mt-2 tabular-nums ${
            totals.totalUnpaid > 0 ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            {formatPrice(totals.totalUnpaid)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {totals.unpaidSuppliersCount > 0
              ? `${totals.unpaidSuppliersCount} fournisseur(s) en attente de règlement`
              : 'Toutes vos dettes fournisseurs sont soldées'}
          </p>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Filter & Add Supplier Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur, ville, contact ou catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyUnpaid(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              onlyUnpaid
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Soldes impayés ({totals.unpaidSuppliersCount})</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B192C] to-sky-700 hover:from-sky-700 hover:to-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Fournisseur</span>
          </button>
        </div>
      </div>

      {/* Suppliers Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Aucun fournisseur trouvé</p>
            <p>Ajustez votre recherche ou ajoutez un nouveau fournisseur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Fournisseur & Contact</th>
                  <th className="py-3 px-3">Spécialité / Ville</th>
                  <th className="py-3 px-3 text-center">Entrées (IN)</th>
                  <th className="py-3 px-3 text-right">Total Achats</th>
                  <th className="py-3 px-3 text-right">Total Réglé</th>
                  <th className="py-3 px-3 text-right">Solde Impayé</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 text-sm">{sup.name}</p>
                      <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                        {sup.contactPerson && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-sky-600" />
                            {sup.contactPerson}
                          </span>
                        )}
                        <span className="font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {sup.phone}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {sup.category}
                      </span>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {sup.city}
                      </p>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-bold tabular-nums">
                        {sup.linkedMovements.length} entrée{sup.linkedMovements.length > 1 ? 's' : ''}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                      {formatPrice(sup.totalPurchased)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                      {formatPrice(sup.totalPaid)}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {sup.unpaidBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-black font-mono tabular-nums">
                          {formatPrice(sup.unpaidBalance)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Soldé
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sup.unpaidBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => openSettleModal(sup)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                            title="Enregistrer un paiement pour solder l'impayé"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Régler</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setHistorySupplierId(sup.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                          title="Voir l'historique des entrées et règlements"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Suivi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(sup)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition-colors"
                          title="Modifier le fournisseur"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSupplier(sup.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Supprimer le fournisseur"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsFormOpen(false)} />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 bg-[#0B192C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-heading font-bold text-base">
                  {editingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom / Raison sociale *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Grossiste Textile Dantokpa"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Personne contact</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Ex: Maman Grâce"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+229 97 ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ville / Marché</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="Cotonou, Bohicon, Parakou..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Spécialité</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Mode & Wax">Mode & Wax</option>
                    <option value="Cosmétique Bio">Cosmétique Bio</option>
                    <option value="Alimentation Locale">Alimentation Locale</option>
                    <option value="Artisanat & Déco">Artisanat & Déco</option>
                    <option value="High-Tech & Accessoires">High-Tech & Accessoires</option>
                    <option value="Import & Transit">Import & Transit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Conditions crédit</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Délai de règlement 15 jours, livraison port autonome..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-sm transition-colors"
                >
                  {editingSupplier ? 'Enregistrer' : 'Créer le fournisseur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Unpaid Balance Modal */}
      {settleSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setSettleSupplier(null)} />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span>Régler un Solde Fournisseur</span>
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">{settleSupplier.name}</p>
              </div>
              <button type="button" onClick={() => setSettleSupplier(null)} className="text-white hover:opacity-80">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <span className="font-semibold text-rose-900">Solde impayé actuel :</span>
                <span className="font-black text-base font-mono text-rose-700 tabular-nums">
                  {formatPrice(settleSupplier.unpaidBalance)}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Montant réglé (FCFA) *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPayAmount(Math.round(settleSupplier.unpaidBalance / 2))}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px]"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayAmount(settleSupplier.unpaidBalance)}
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px]"
                    >
                      Tout solder
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={settleSupplier.unpaidBalance}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-base font-black font-mono tabular-nums rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mode de règlement</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['MTN_MOMO', 'MOOV_MONEY', 'ESPECES', 'VIREMENT'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayMethod(method)}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        payMethod === method
                          ? 'bg-[#0B192C] text-white border-[#0B192C]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{getPaymentMethodLabel(method)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Référence (optionnel)</label>
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="Ex: MOMO-129482"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Note</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Ex: Solde facture"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Nouveau solde restant :</span>
                <span className="font-black font-mono text-slate-900 tabular-nums">
                  {formatPrice(Math.max(0, settleSupplier.unpaidBalance - Math.min(payAmount, settleSupplier.unpaidBalance)))}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettleSupplier(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={payAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold shadow-sm transition-colors"
                >
                  Valider le règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger & History Modal */}
      {historySupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setHistorySupplierId(null)} />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col">
            <div className="p-5 bg-[#0B192C] text-white flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base">{historySupplier.name}</h3>
                <p className="text-xs text-sky-300 font-mono mt-0.5">
                  {historySupplier.phone} · {historySupplier.city} · {historySupplier.category}
                </p>
              </div>
              <button type="button" onClick={() => setHistorySupplierId(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Achats (IN)</p>
                  <p className="font-black text-sm text-slate-900 mt-1 font-mono tabular-nums">
                    {formatPrice(historySupplier.totalPurchased)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Déjà Réglé</p>
                  <p className="font-black text-sm text-emerald-800 mt-1 font-mono tabular-nums">
                    {formatPrice(historySupplier.totalPaid)}
                  </p>
                </div>
                <div className={`p-3.5 rounded-2xl border ${
                  historySupplier.unpaidBalance > 0
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <p className="text-[10px] font-bold uppercase text-slate-600">Solde Impayé</p>
                  <p className={`font-black text-sm mt-1 font-mono tabular-nums ${
                    historySupplier.unpaidBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {formatPrice(historySupplier.unpaidBalance)}
                  </p>
                </div>
              </div>

              {historySupplier.notes && (
                <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 italic">
                  {historySupplier.notes}
                </p>
              )}

              {/* Linked IN Movements */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Mouvements de stock (IN) liés ({historySupplier.linkedMovements.length})
                </h4>
                {historySupplier.linkedMovements.length === 0 ? (
                  <p className="p-4 rounded-xl border border-dashed border-slate-200 text-slate-400 text-center">
                    Aucune entrée de stock liée à ce fournisseur pour le moment.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {historySupplier.linkedMovements.map(mov => (
                      <div key={mov.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              +{mov.quantity} × {mov.productName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {mov.reason} · {mov.date}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <p className="font-bold text-slate-900">{formatPrice(mov.totalCost || 0)}</p>
                          <p className="text-[10px] text-emerald-700">
                            Payé : {formatPrice(mov.amountPaid || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Settlements */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Règlements de soldes enregistrés ({historySupplier.payments.length})
                </h4>
                {historySupplier.payments.length === 0 ? (
                  <p className="p-4 rounded-xl border border-dashed border-slate-200 text-slate-400 text-center">
                    Aucun règlement complémentaire enregistré.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {historySupplier.payments.map(pay => (
                      <div key={pay.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div>
                          <p className="font-bold text-slate-900">
                            {getPaymentMethodLabel(pay.paymentMethod)}
                            {pay.reference ? ` · Réf ${pay.reference}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {pay.notes || 'Règlement fournisseur'} · {pay.date}
                          </p>
                        </div>
                        <span className="font-black text-emerald-700 font-mono tabular-nums">
                          {formatPrice(pay.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              {onQuickEntryForSupplier && (
                <button
                  type="button"
                  onClick={() => {
                    const id = historySupplier.id;
                    setHistorySupplierId(null);
                    onQuickEntryForSupplier(id);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition-colors"
                >
                  + Nouvelle entrée pour ce fournisseur
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {historySupplier.unpaidBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = historySupplier;
                      setHistorySupplierId(null);
                      openSettleModal(target);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Régler l'impayé</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHistorySupplierId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs"
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
