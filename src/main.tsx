import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </ErrorBoundary>
);
