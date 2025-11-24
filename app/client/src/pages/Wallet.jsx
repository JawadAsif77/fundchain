import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { walletApi } from '../lib/api.js';

const Wallet = () => {
  const { sessionVersion } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const res = await walletApi.getBalance();
      if (!cancelled) {
        if (res.success) setBalance(res.balance);
        else setError(res.error || 'Failed to load balance');
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionVersion]);

  const topUp = async (e) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    const res = await walletApi.topUp(value);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Top up failed');
      return;
    }
    setBalance(res.balance);
    setAmount('');
  };

  return (
    <div className="container" style={{ padding: '24px' }}>
      <h1 className="text-2xl font-bold mb-md">Wallet</h1>
      {loading ? (
        <div>Loading wallet…</div>
      ) : (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="mb-md">
            <div className="text-sm text-gray-600">Current Balance</div>
            <div className="text-3xl font-bold">${Math.floor(balance).toLocaleString()}</div>
          </div>
          <form onSubmit={topUp}>
            <label className="form-label">Top-up amount</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
            {error && <div className="form-error mt-sm">{error}</div>}
            <div className="form-actions mt-md">
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Processing…' : 'Top up'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Wallet;