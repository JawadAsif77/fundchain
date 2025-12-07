import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { getWallet, buyTokens, getTransactions, exchangeUsdToFc } from '../services/walletService';

const Wallet = () => {
  const { userId, wallet, refreshWallet } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState('');
  const [previewFc, setPreviewFc] = useState(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userId) {
      loadWalletData();
    }
  }, [userId]);

  const loadWalletData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const txData = await getTransactions(userId);
      if (txData.status === 'success') {
        setTransactions(txData.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewConversion = async (usdAmount) => {
    if (!usdAmount || usdAmount <= 0) {
      setPreviewFc(null);
      return;
    }

    try {
      const result = await exchangeUsdToFc(parseFloat(usdAmount));
      if (result.status === 'success') {
        setPreviewFc(result.fc);
      }
    } catch (err) {
      console.error('Preview failed:', err);
    }
  };

  const handleBuyTokens = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setBuying(true);
    try {
      const result = await buyTokens(userId, amount);
      
      if (result.status === 'success') {
        setSuccess(`Successfully purchased ${result.amountFc} FC tokens!`);
        setBuyAmount('');
        setPreviewFc(null);
        await refreshWallet();
        await loadWalletData();
      } else {
        setError(result.error || 'Failed to purchase tokens');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError('Failed to purchase tokens. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'BUY_FC': 'Purchase',
      'INVEST': 'Investment',
      'RELEASE': 'Release',
      'REFUND': 'Refund',
      'WITHDRAW': 'Withdrawal'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading wallet...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>💰 My Wallet</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #29C7AC'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Available Balance</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#29C7AC' }}>
            {wallet?.balanceFc?.toLocaleString() || 0} FC
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            ≈ ${wallet?.balanceFc?.toLocaleString() || 0} USD
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #FF6B6B'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Locked Balance</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#FF6B6B' }}>
            {wallet?.lockedFc?.toLocaleString() || 0} FC
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            Invested in campaigns
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Balance</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#333' }}>
            {((wallet?.balanceFc || 0) + (wallet?.lockedFc || 0)).toLocaleString()} FC
          </div>
          <button
            onClick={refreshWallet}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#666'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '40px'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>💳 Buy FC Tokens</h2>
        
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '6px',
            marginBottom: '20px'
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
            marginBottom: '20px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleBuyTokens} style={{ maxWidth: '500px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666' }}>
              Amount (USD)
            </label>
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => {
                setBuyAmount(e.target.value);
                handlePreviewConversion(e.target.value);
              }}
              placeholder="Enter amount in USD"
              min="1"
              step="0.01"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              disabled={buying}
            />
            {previewFc !== null && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                You will receive: <strong>{previewFc} FC</strong>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={buying || !buyAmount}
            style={{
              padding: '12px 24px',
              backgroundColor: buying ? '#ccc' : '#29C7AC',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: buying ? 'not-allowed' : 'pointer'
            }}
          >
            {buying ? 'Processing...' : 'Buy Tokens'}
          </button>
        </form>
      </div>

      <div style={{
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>📜 Transaction History</h2>

        {transactions.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
            No transactions yet
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '14px' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '14px' }}>Amount</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '14px' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '14px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: tx.amount_fc > 0 ? '#e8f5e9' : '#ffebee',
                        color: tx.amount_fc > 0 ? '#2e7d32' : '#c62828',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getTransactionTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: tx.amount_fc > 0 ? '#2e7d32' : '#c62828' }}>
                      {tx.amount_fc > 0 ? '+' : ''}{tx.amount_fc} FC
                    </td>
                    <td style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                      {formatDate(tx.created_at)}
                    </td>
                    <td style={{ padding: '12px', color: '#999', fontSize: '12px' }}>
                      {tx.metadata?.campaign_id ? `Campaign: ${tx.metadata.campaign_id.slice(0, 8)}...` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;