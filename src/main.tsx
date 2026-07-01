import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';

// Apply persisted theme before first render to avoid flash
const storedTheme = localStorage.getItem('theme') ?? 'dark';
if (storedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
