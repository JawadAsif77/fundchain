import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './store/AuthContext';

import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';

import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

if (!import.meta.env.DEV) {
  const noop = () => {};
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = (...args) => originalWarn(args[0]);
  console.error = (...args) => originalError(args[0]);
}

// Phantom wallets list
const wallets = [
  new PhantomWalletAdapter()
];

// Solana devnet RPC
const endpoint = "https://api.devnet.solana.com";

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
