import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './store/AuthContext';
import { PUBLIC_CONFIG } from './config/publicConfig';
import { sanitizeLogArgs } from './utils/safeLogger';

import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';

import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

if (import.meta.env.DEV) {
  console.log = (...args) => originalConsole.log(...sanitizeLogArgs(args));
  console.info = (...args) => originalConsole.info(...sanitizeLogArgs(args));
  console.debug = (...args) => originalConsole.debug(...sanitizeLogArgs(args));
  console.warn = (...args) => originalConsole.warn(...sanitizeLogArgs(args));
  console.error = (...args) => originalConsole.error(...sanitizeLogArgs(args));
} else {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = (...args) => originalConsole.warn(...sanitizeLogArgs(args));
  console.error = (...args) => originalConsole.error(...sanitizeLogArgs(args));
}

// Phantom wallets list
const wallets = [
  new PhantomWalletAdapter()
];

// Solana devnet RPC
const endpoint = PUBLIC_CONFIG.SOLANA_RPC_URL;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);
