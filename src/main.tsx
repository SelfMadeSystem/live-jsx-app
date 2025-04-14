// import logger before everything else
import App from './App.tsx';
import './index.css';
import { createLogger } from './logger';
import { MonacoProvider } from './monaco/MonacoProvider.tsx';
import { StrictMode } from 'react';
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { toast } from 'sonner';

const logger = createLogger('main');

window.React = React;
// @ts-expect-error kuz
window['process'] = { env: { NODE_ENV: 'development' } };
// @ts-expect-error kuz v2.0
window.toast = toast;

export const jsxelem = (
  <StrictMode>
    <MonacoProvider>
      <App />
    </MonacoProvider>
  </StrictMode>
);

const elem = document.getElementById('root')!;

if (!elem) {
  throw new Error('Root element not found');
}

if (elem.hasChildNodes()) {
  // hydrate if the element has child nodes
  // Right now, this is completely unused as there's no SSR/SSG.
  logger.debug('Hydrating app');
  hydrateRoot(elem, jsxelem);
} else {
  // otherwise, render the app
  logger.debug('Rendering app');
  createRoot(elem).render(jsxelem);
}

logger.debug('App mounted');
