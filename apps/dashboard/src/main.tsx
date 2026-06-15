import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shell/AppShell.js';
import { dashboardThemeCss } from './theme/tokens.js';

function installThemeCss() {
  if (document.getElementById('trackmind-theme-css')) return;
  const style = document.createElement('style');
  style.id = 'trackmind-theme-css';
  style.textContent = dashboardThemeCss;
  document.head.appendChild(style);
}

installThemeCss();

const root = document.getElementById('root');
if (!root) throw new Error('TrackMind Nexus SPA root element #root was not found.');

createRoot(root).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
