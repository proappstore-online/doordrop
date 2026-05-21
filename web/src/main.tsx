import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeModeProvider } from './ThemeModeProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ErrorBoundary from './components/ErrorBoundary';
import { pas } from './services/pas';

// Capture the OAuth callback (if present) and restore any persisted session,
// before React renders anything that depends on auth state.
await pas.auth.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeModeProvider>
        <App />
        <ToastContainer position="bottom-center" autoClose={4000} />
      </ThemeModeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
