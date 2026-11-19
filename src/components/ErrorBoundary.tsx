import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isPermissionError: false,
      isQuotaError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Erreur inattendue';
    let parsedError = raw;
    try {
      const json = JSON.parse(raw);
      if (json && typeof json.error === 'string') {
        parsedError = `${json.error} (${json.operationType || 'write'} sur ${json.path || 'Firestore'})`;
      }
    } catch {
      // Plain error message
    }
    const lower = parsedError.toLowerCase();
    return {
      hasError: true,
      errorMessage: parsedError,
      isPermissionError:
        lower.includes('permission') || lower.includes('insufficient'),
      isQuotaError: lower.includes('quota exceeded'),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BOUTIKPRO ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="font-heading font-bold text-xl text-slate-900">
              {this.state.isQuotaError
                ? 'Quota Firestore dépassé'
                : this.state.isPermissionError
                ? 'Accès refusé par les règles de sécurité'
                : 'Une erreur est survenue'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              {this.state.isQuotaError
                ? 'Le quota quotidien gratuit Firestore a été atteint et sera réinitialisé demain.'
                : this.state.errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0B192C] hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recharger l'application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
