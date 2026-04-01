import React, { useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { userApi } from '../lib/api.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { user } = useAuth();
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    const persistWalletAddress = async () => {
      if (!user?.id || !connected || !publicKey) return;
      try {
        await userApi.updateWalletAddress(user.id, publicKey.toBase58());
      } catch (error) {
        console.warn('Failed to persist wallet address:', error);
      }
    };

    persistWalletAddress();
  }, [user?.id, connected, publicKey]);

  return (
    <div>
      <WalletMultiButton />
    </div>
  );
}
