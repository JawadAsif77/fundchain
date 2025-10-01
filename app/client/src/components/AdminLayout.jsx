import React from 'react';
import { useAuth } from '../store/AuthContext';
import AdminPanel from '../pages/AdminPanel';
import Loader from './Loader';

const AdminLayout = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <Loader />;
  }

  // Only admin users can access this layout
  if (!user || profile?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Access Denied</h2>
          <p style={{ color: '#6b7280' }}>Admin privileges required</p>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
};

export default AdminLayout;