import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
// i18n must be imported before App so translations are initialized before any
// component mounts. The http-backend loads locale JSON lazily on first use.
import './lib/i18n';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Suspense boundary for i18next lazy-loaded translation files */}
      <Suspense fallback={
        <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }>
        <App />
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
