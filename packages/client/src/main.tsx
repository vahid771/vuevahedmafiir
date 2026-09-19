import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

// Apply stored language direction before first render to prevent flash
(function () {
  try {
    const lang = localStorage.getItem('app_lang');
    if (lang === 'fa') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'fa';
    }
  } catch { /* ignore */ }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
