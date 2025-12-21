import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { getWallet, buyTokens, getTransactions, exchangeUsdToFc } from '../services/walletService';
import AddFundsPhantomModal from '../components/wallet/AddFundsPhantomModal';
import SwapSolToFc from '../components/SwapSolToFc';

const Wallet = () => {
  const { userId, wallet, refreshWallet } = useAuth();
  
  // Use wallet data from Context
  const displayBalance = wallet?.balanceFc?.toLocaleString() || '0';
  const lockedBalance = wallet?.lockedFc || 0;

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Buy Form State
  const [buyAmount, setBuyAmount] = useState('');
  const [previewFc, setPreviewFc] = useState(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPhantomModal, setShowPhantomModal] = useState(false);

  useEffect(() => {
    if (userId) {
      loadWalletData();
    }
  }, [userId]);

  const loadWalletData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Parallel fetch: Refresh Balance + Get History
      const [walletRes, txRes] = await Promise.all([
        refreshWallet(),
        getTransactions(userId)
      ]);

      // CRITICAL FIX: Robust check to prevent "map is not a function" error
      if (txRes && txRes.success && Array.isArray(txRes.data)) {
        setTransactions(txRes.data);
      } else {
        console.warn('Invalid transaction data:', txRes);
        setTransactions([]); // Fallback to empty array
      }

    } catch (err) {
      console.error('Error loading wallet data:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = async (e) => {
    const val = e.target.value;
    setBuyAmount(val);
    
    if (val && !isNaN(val) && Number(val) > 0) {
      const preview = await exchangeUsdToFc(val);
      setPreviewFc(preview.fc);
    } else {
      setPreviewFc(null);
    }
  };

  const handleBuyTokens = async () => {
    if (!buyAmount || isNaN(buyAmount) || Number(buyAmount) <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    setBuying(true);
    setError('');
    setSuccess('');

    try {
      const result = await buyTokens(userId, Number(buyAmount));

      // Add this logging
      console.log('Buy tokens result:', result);

      if (result.success) {
        setSuccess(`Successfully bought ${Number(buyAmount).toLocaleString()} FC!`);
        setBuyAmount('');
        setPreviewFc(null);
        await loadWalletData(); 
      } else {
        // Better error formatting
        let errMsg = 'Transaction failed';
        if (typeof result.error === 'object') {
          errMsg = result.error.message || JSON.stringify(result.error);
        } else if (result.error) {
          errMsg = result.error;
        }
        setError(errMsg);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="page-title">My Wallet</h1>

      {/* Balance Card */}
      <div className="card" style={{ marginBottom: '24px', textAlign: 'center', padding: '40px' }}>
        <h2 style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>Total Balance</h2>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#6366f1', marginBottom: '8px' }}>
          {displayBalance} <span style={{ fontSize: '24px' }}>FC</span>
        </div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          ≈ ${displayBalance} USD (Exchange Rate: 1 FC = 1 USD)
        </div>
        {lockedBalance > 0 && (
           <div style={{ marginTop: '10px', fontSize: '13px', color: '#f59e0b' }}>
             🔒 {lockedBalance.toLocaleString()} FC Locked in Escrow
           </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* LEFT: Dummy / Test Buy (USD) */}
        <div className="card">
          <h3>Buy FC Tokens</h3>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            Exchange USD to FC tokens. Fixed Rate: 1 USD = 1 FC. Use FC tokens to fund campaigns.
          </p>
          
          <div className="form-group">
            <label>Amount (USD)</label>
            <input
              type="number"
              className="input-field"
              value={buyAmount}
              onChange={handleAmountChange}
              placeholder="Enter USD amount"
              min="1"
            />
          </div>

          {previewFc !== null && (
            <div style={{ 
              background: '#f3f4f6', 
              padding: '10px', 
              borderRadius: '6px', 
              marginBottom: '16px',
              fontSize: '14px',
              color: '#374151'
            }}>
              You will receive: <strong>{previewFc.toLocaleString()} FC</strong>
            </div>
          )}

          {error && <div className="error-message" style={{ marginBottom: '10px', color: 'red', fontSize: '14px' }}>{error}</div>}
          {success && <div className="success-message" style={{ marginBottom: '10px', color: 'green', fontSize: '14px' }}>{success}</div>}

          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            onClick={handleBuyTokens}
            disabled={buying || !buyAmount}
          >
            {buying ? 'Processing...' : 'Buy FC Tokens'}
          </button>
        </div>

        {/* RIGHT: Real Solana Swap */}
        <div className="card">
          <h3>Swap SOL for FC</h3>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            Exchange Devnet SOL for FC tokens via smart contract.
          </p>
          
          <SwapSolToFc />
          
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Need Test SOL?</p>
            <button 
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '13px' }}
              onClick={() => setShowPhantomModal(true)}
            >
              Add Funds via Phantom
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <h3>Transaction History</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No transactions yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '10px', fontSize: '12px', color: '#666' }}>Type</th>
                  <th style={{ padding: '10px', fontSize: '12px', color: '#666' }}>Amount</th>
                  <th style={{ padding: '10px', fontSize: '12px', color: '#666' }}>Status</th>
                  <th style={{ padding: '10px', fontSize: '12px', color: '#666' }}>Date</th>
                  <th style={{ padding: '10px', fontSize: '12px', color: '#666' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id || Math.random()} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={{ padding: '10px', fontSize: '13px' }}>
                      <span style={{ 
                        textTransform: 'capitalize',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: tx.transaction_type?.includes('buy') ? '#d1fae5' : '#fee2e2',
                        color: tx.transaction_type?.includes('buy') ? '#065f46' : '#991b1b'
                      }}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: '500' }}>
                      {tx.transaction_type?.includes('buy') ? '+' : '-'}{tx.amount} {tx.token_symbol || 'FC'}
                    </td>
                    <td style={{ padding: '10px', fontSize: '13px' }}>{tx.status}</td>
                    <td style={{ padding: '10px', fontSize: '13px', color: '#666' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#888', maxWidth: '200px' }}>
                      {tx.description}
                      {tx.metadata?.amountSol && <div>{tx.metadata.amountSol} SOL</div>}
                      {!tx.description && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddFundsPhantomModal 
        isOpen={showPhantomModal} 
        onClose={() => setShowPhantomModal(false)}
        onSuccess={async () => {
          await loadWalletData();
        }}
      />
    </div>
  );
};

export default Wallet;