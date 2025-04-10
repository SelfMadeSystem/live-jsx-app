// import logger before everything else
import { createLogger } from './logger';

import App from './App.tsx';
import './index.css';
import { MonacoProvider } from './monaco/MonacoProvider.tsx';
import { StrictMode } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { toast, Toaster } from 'sonner';

const logger = createLogger('main');

window.React = React;
// @ts-expect-error kuz
window['process'] = { env: { NODE_ENV: 'development' } };
// @ts-expect-error kuz v2.0
window.toast = toast;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MonacoProvider>
      <App />
    </MonacoProvider>
    <Toaster
      position="top-right"
      theme="dark"
    />
  </StrictMode>,
);

logger.debug('App mounted');
