import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '../store/AuthContext';
import { swapSolForFc } from '../services/swapService';

export default function SwapSolToFc() {
  const { publicKey, sendTransaction } = useWallet();
  const { userId, refreshWallet } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSwap = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!publicKey) {
      setError('Please connect your Phantom wallet first');
      return;
    }

    if (!userId) {
      setError('Please log in to your account');
      return;
    }

    const amountSol = parseFloat(amount);
    if (!amountSol || amountSol <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const wallet = { publicKey, sendTransaction };
      const result = await swapSolForFc(wallet, userId, amountSol);
      
      setSuccess(`Successfully swapped ${amountSol} SOL for ${result.amountFc} FC tokens!`);
      setAmount('');
      
      // Refresh wallet balance
      await refreshWallet(userId);
      
    } catch (err) {
      console.error('Swap failed:', err);
      setError(err.message || 'Failed to swap SOL for FC tokens');
    } finally {
      setLoading(false);
    }
  };

  const fcPerSol = Number(import.meta.env.VITE_FC_PER_SOL) || 100;
  const estimatedFc = parseFloat(amount) * fcPerSol || 0;

  return (
    <div style={{
      backgroundColor: '#f9f9f9',
      padding: '24px',
      borderRadius: '12px',
      border: '2px solid #29C7AC',
      marginTop: '24px'
    }}>
      <h3 style={{ marginBottom: '16px', color: '#333' }}>🔄 Swap SOL → FC Tokens</h3>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#efe',
          color: '#3c3',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSwap}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
            Amount (SOL)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter SOL amount"
            min="0.01"
            step="0.01"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px'
            }}
            disabled={loading}
          />
        </div>

        {amount && (
          <div style={{
            backgroundColor: '#fff',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#666'
          }}>
            You will receive: <strong style={{ color: '#29C7AC' }}>{estimatedFc.toFixed(2)} FC</strong>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !publicKey}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: (loading || !publicKey) ? '#ccc' : '#29C7AC',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: (loading || !publicKey) ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Processing...' : 'Swap SOL for FC'}
        </button>
      </form>

      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#999',
        textAlign: 'center'
      }}>
        Exchange rate: 1 SOL = {fcPerSol} FC
      </div>
    </div>
  );
}
