import App from './App.tsx';
import './index.css';
import { StrictMode } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';

window.React = React;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
