import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const WalletButton = () => {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const { connected, publicKey } = useWallet();

  // lock background scroll
  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : 'auto';
    return () => (document.body.style.overflow = 'auto');
  }, [showModal]);

  return (
    <>
      {/* Wallet Button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          backgroundColor: '#29C7AC',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        Wallet
      </button>

      {/* Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 999999,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '520px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              ×
            </button>

            {/* Modal Content (UNCHANGED) */}
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              Connect Solana Wallet
            </h2>

            {!user ? (
              <>
                <p style={{ fontSize: '15px', color: '#4a5568', marginBottom: '24px' }}>
                  Connect your Solana wallet to fund campaigns with FC tokens, vote on milestones, and track your investments on the blockchain.
                </p>

                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <p style={{ fontWeight: '600', color: '#92400e' }}>⚠️ Login Required</p>
                  <p style={{ fontSize: '13px', color: '#92400e' }}>
                    You need to create an account or login before connecting your wallet.
                  </p>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  Supported Wallets
                </h3>

                {/* Phantom */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '20px' }}>👻</div>
                  <div>
                    <p style={{ fontWeight: '600' }}>Phantom Wallet</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      Most popular Solana wallet
                    </p>
                  </div>
                </div>

                {/* Solflare */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '20px' }}>☀️</div>
                  <div>
                    <p style={{ fontWeight: '600' }}>Solflare Wallet</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      Secure Solana wallet with staking
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <a
                    href="/login"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#29C7AC',
                      color: 'white',
                      textAlign: 'center',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Login
                  </a>
                  <a
                    href="/register"
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#0B132B',
                      color: 'white',
                      textAlign: 'center',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Sign Up
                  </a>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '24px' }}>
                  {connected
                    ? `Wallet Connected: ${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}`
                    : 'Select your Solana wallet to connect.'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <WalletMultiButton />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default WalletButton;
