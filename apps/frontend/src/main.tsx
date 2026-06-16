import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, loadTheme } from './theme/theme';
import './theme/tokens.css';

applyTheme(loadTheme());

const root = document.getElementById('root');
if (!root) throw new Error('TrackMind frontend root element is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
