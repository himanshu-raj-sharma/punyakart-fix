import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initializeTrafficAttribution } from './utils/trafficAttributionSession';
import './index.css';

// Capture the arrival before App migrates hashes or changes routes.
initializeTrafficAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
