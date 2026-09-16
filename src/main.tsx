import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PublicPaymentPortal } from './components/public/PublicPaymentPortal.tsx'

// ── Detección de ruta pública /pay/:token_hash ──────────────────────────────
// Sin react-router: analizamos window.location.pathname directamente.
// Si la URL coincide con /pay/<token>, renderizamos el portal anónimo.
// Cualquier otra ruta carga la app autenticada normalmente.
const pathname = window.location.pathname;
const payMatch = pathname.match(/^\/pay\/([^/]+)\/?$/);

const root = createRoot(document.getElementById('root')!);

if (payMatch) {
  const tokenHash = payMatch[1];
  root.render(
    <StrictMode>
      <PublicPaymentPortal tokenHash={tokenHash} />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

