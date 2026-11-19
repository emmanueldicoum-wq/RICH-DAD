import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface FirebaseAuthContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  logoutGoogle: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | undefined>(
  undefined
);

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Connexion Google annulée.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'La fenêtre Google a été bloquée par votre navigateur. Autorisez les popups puis réessayez.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost =
          typeof window !== 'undefined' ? window.location.hostname : 'ce domaine';
        setAuthError(
          `Domaine non autorisé pour Google Sign-In (${currentHost}). Ajoutez « ${currentHost} » dans Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Impossible de se connecter avec Google.'
        );
      }
      return null;
    } finally {
      setIsSigningIn(false);
    }
  };

  const logoutGoogle = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        logoutGoogle,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export const useFirebaseAuth = (): FirebaseAuthContextValue => {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseAuthProvider');
  }
  return ctx;
};
