import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../styles/globals.css';
import { injectMockData } from '../../lib/mockDevData';

injectMockData();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);