import React from 'react';
import {
  X,
  ShieldCheck,
  Check,
  Cloud,
  Loader2,
  AlertTriangle,
  Database,
  Lock,
} from 'lucide-react';
import { MerchantProfile } from '../types';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (merchantData?: Partial<MerchantProfile>) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
}) => {
  const { signInWithGoogle, isSigningIn, authError, clearAuthError } =
    useFirebaseAuth();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    const signedUser = await signInWithGoogle();
    if (signedUser) {
      onLoginSuccess({
        name: signedUser.displayName || undefined,
        email: signedUser.email || undefined,
      });
    }
  };

  const handleQuickDemo = () => {
    clearAuthError();
    onLoginSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#0B192C] p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/30">
            BP
          </div>
          <h3 className="font-heading font-extrabold text-2xl tracking-tight">
            {initialMode === 'register'
              ? 'Ouvrir votre Espace Cloud'
              : 'Connexion Marchand'}
          </h3>
          <p className="text-xs text-sky-200 mt-1">
            Identifiez-vous avec Google pour sauvegarder automatiquement votre boutique, vos devis et vos stocks
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <Cloud className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">
                  Sauvegarde Cloud Temps Réel
                </p>
                <p className="text-[11px] text-slate-500">
                  Vos produits, commandes, devis clients, fournisseurs et clients sont conservés en sécurité.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">
                  Espace Privé & Isolé
                </p>
                <p className="text-[11px] text-slate-500">
                  Seul votre compte Google authentifié peut consulter et modifier les données de votre boutique.
                </p>
              </div>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            disabled={isSigningIn}
            onClick={() => void handleGoogleLogin()}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border-2 border-slate-300 hover:border-sky-500 shadow-sm active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-3"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                <span>Connexion Google en cours...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continuer avec Google</span>
              </>
            )}
          </button>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4 text-sky-600" />
              <span>Tester en mode Démo local (sans sauvegarde cloud)</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
              <Database className="w-3 h-3" />
              <span>Synchronisation sécurisée Firebase Auth & Firestore</span>
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
