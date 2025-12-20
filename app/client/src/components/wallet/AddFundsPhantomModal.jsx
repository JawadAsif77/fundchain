import React, { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '../../store/AuthContext';
import { swapSolForFc } from '../../services/swapService';
import { SOL_TO_USD_RATE, USD_TO_FC_RATE } from '../../lib/constants';

export default function AddFundsPhantomModal({ isOpen, onClose, onSuccess }) {
  const { publicKey, sendTransaction } = useWallet();
  const { userId, refreshWallet } = useAuth();
  const [amountUsd, setAmountUsd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const address = publicKey?.toBase58();

  // Calculate FC and SOL amounts
  const fcAmount = useMemo(() => {
    const usd = Number(amountUsd);
    if (!usd || usd <= 0) return 0;
    return Math.round(usd * USD_TO_FC_RATE);
  }, [amountUsd]);

  const solRequired = useMemo(() => {
    const usd = Number(amountUsd);
    if (!usd || usd <= 0) return 0;
    return usd / SOL_TO_USD_RATE;
  }, [amountUsd]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!publicKey) {
      setError('Please connect your Phantom wallet first');
      return;
    }

    if (!userId) {
      setError('Please log in to your account');
      return;
    }

    const usd = Number(amountUsd);
    if (!usd || usd <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (solRequired <= 0) {
      setError('Invalid SOL amount calculated');
      return;
    }

    setLoading(true);

    try {
      // Use the exact same logic as SwapSolToFc
      const wallet = { publicKey, sendTransaction };
      const result = await swapSolForFc(wallet, userId, solRequired);
      
      // Reset form
      setAmountUsd('');
      
      // Refresh wallet balance
      await refreshWallet();
      
      // Success callback
      if (onSuccess) {
        await onSuccess();
      }
      
      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Add funds error:', err);
      setError(err.message || 'Failed to add funds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fc-modal-backdrop" onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fc-modal-header">
          <h2>Add Funds with Phantom</h2>
          <button className="fc-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fc-modal-body">
          {/* Connected Wallet Display */}
          {address && (
            <div style={{
              padding: '12px',
              backgroundColor: '#e8f5e9',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid #29C7AC'
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                Connected Wallet
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#2e7d32', fontWeight: '500' }}>
                {address.slice(0, 8)}...{address.slice(-8)}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* USD Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Amount (USD)
              </label>
              <input
                type="number"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="Enter amount in USD"
                min="1"
                step="0.01"
                disabled={loading || !address}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
            </div>

            {/* Live Preview */}
            {fcAmount > 0 && (
              <div style={{
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    You will receive
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#29C7AC' }}>
                    {fcAmount} FC
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    SOL required
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {solRequired.toFixed(4)} SOL
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !address || !amountUsd || fcAmount <= 0}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: loading || !address ? '#ccc' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading || !address ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Processing...' : !address ? 'Connect Wallet First' : 'Confirm & Pay with Phantom'}
            </button>
          </form>

          <div style={{
            marginTop: '16px',
            fontSize: '12px',
            color: '#999',
            textAlign: 'center'
          }}>
            You will be prompted to approve the transaction in Phantom
          </div>
        </div>
      </div>
    </div>
  );
}
