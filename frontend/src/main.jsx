import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg3)',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            fontFamily: 'var(--sans)',
            fontSize: '13px',
          },
        }}
      />
    </BrowserRouter>
  </QueryClientProvider>
);
