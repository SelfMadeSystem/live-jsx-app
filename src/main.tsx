import App from './App.tsx';
import './index.css';
import { MonacoProvider } from './monaco/MonacoProvider.tsx';
import { StrictMode } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';

window.React = React;
// @ts-expect-error kuz
window['process'] = { env: { NODE_ENV: 'development' } };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MonacoProvider>
      <App />
    </MonacoProvider>
  </StrictMode>,
);
