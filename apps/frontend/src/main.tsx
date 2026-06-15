import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme/tokens.css';

document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? 'dark';

const root = document.getElementById('root');
if (!root) throw new Error('TrackMind frontend root element is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
