import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const AdminPanel = () => {
  const { user, profile, logout, loading: authLoading } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== 'admin')) {
      console.log('Unauthorized access to admin panel');
      navigate('/', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  // Load pending verifications
  useEffect(() => {
    if (profile?.role === 'admin') {
      loadPendingVerifications();
    }
  }, [profile]);

  const loadPendingVerifications = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      console.log('Loading pending verifications...');
      
      // First, let's just try to get verifications without joins
      const { data: verificationsData, error: verificationsError } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('verification_status', 'pending')
        .order('submitted_at', { ascending: false });

      if (verificationsError) {
        console.error('Error loading verifications:', verificationsError);
        setError(`Database error: ${verificationsError.message}`);
        return;
      }

      console.log('Verifications loaded:', verificationsData);

      // If we have verifications, get the user details separately
      if (verificationsData && verificationsData.length > 0) {
        const userIds = verificationsData.map(v => v.user_id);
        console.log('Loading user details for IDs:', userIds);
        
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name, username')
          .in('id', userIds);

        if (usersError) {
          console.error('Error loading users:', usersError);
          // Continue with verification data only - don't fail completely
          console.log('Continuing without user details due to error');
        }

        console.log('Users loaded:', usersData);

        // Combine the data
        const combinedData = verificationsData.map(verification => ({
          ...verification,
          users: usersData?.find(user => user.id === verification.user_id) || null
        }));

        setVerifications(combinedData);
        console.log('Combined data set:', combinedData);
      } else {
        console.log('No pending verifications found');
        setVerifications([]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId) => {
    try {
      setActionLoading(true);
      
      // Call the approve function
      const { data, error } = await supabase.rpc('approve_user_verification', {
        verification_id: verificationId,
        admin_notes_param: 'Approved by admin'
      });

      if (error) {
        console.error('Approval error:', error);
        setError('Failed to approve verification');
        return;
      }

      // Reload verifications
      await loadPendingVerifications();
      setSelectedVerification(null);
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (verificationId, reason) => {
    try {
      setActionLoading(true);
      
      // Call the reject function
      const { data, error } = await supabase.rpc('reject_user_verification', {
        verification_id: verificationId,
        rejection_reason_param: reason,
        admin_notes_param: 'Rejected by admin'
      });

      if (error) {
        console.error('Rejection error:', error);
        setError('Failed to reject verification');
        return;
      }

      // Reload verifications
      await loadPendingVerifications();
      setSelectedVerification(null);
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px'
      }}>
        Loading admin panel...
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        Access denied. Admin privileges required.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '0',
      margin: '0'
    }}>
      {/* Admin Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#111827',
            margin: 0
          }}>
            FundChain Admin
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Identity Verification Management
          </p>
        </div>
        
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 24px'
      }}>
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Pending Verifications Tab */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          {/* Tab Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Pending Verifications
              </h2>
              <div style={{
                padding: '4px 12px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {verifications.length} pending
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {verifications.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#374151' }}>
                  No pending verifications
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  All verifications have been processed
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '16px'
              }}>
                {verifications.map((verification) => (
                  <div
                    key={verification.id}
                    style={{
                      padding: '20px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'start',
                      gap: '16px'
                    }}>
                      <div>
                        <h3 style={{
                          margin: '0 0 8px 0',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {verification.legal_name}
                        </h3>
                        
                        <div style={{ display: 'grid', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                          <div>Email: {verification.users?.email || verification.legal_email}</div>
                          <div>Phone: {verification.phone}</div>
                          <div>Submitted: {new Date(verification.submitted_at).toLocaleDateString()}</div>
                        </div>

                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '4px'
                          }}>
                            {verification.verification_type}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedVerification(verification)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for detailed review */}
      {selectedVerification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              Review Verification
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Personal Information
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                <div><strong>Legal Name:</strong> {selectedVerification.legal_name}</div>
                <div><strong>Email:</strong> {selectedVerification.legal_email}</div>
                <div><strong>Phone:</strong> {selectedVerification.phone}</div>
                {selectedVerification.business_email && (
                  <div><strong>Business Email:</strong> {selectedVerification.business_email}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Address
              </h3>
              <div style={{ fontSize: '14px' }}>
                {selectedVerification.legal_address?.line1}<br/>
                {selectedVerification.legal_address?.line2 && (
                  <>{selectedVerification.legal_address.line2}<br/></>
                )}
                {selectedVerification.legal_address?.city}, {selectedVerification.legal_address?.state} {selectedVerification.legal_address?.postal_code}<br/>
                {selectedVerification.legal_address?.country}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Documents
              </h3>
              <div style={{ fontSize: '14px' }}>
                <div>ID Document: {selectedVerification.id_document_url ? 'Uploaded' : 'Not uploaded'}</div>
                <div>Selfie: {selectedVerification.selfie_image_url ? 'Uploaded' : 'Not uploaded'}</div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedVerification(null)}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={() => handleReject(selectedVerification.id, 'Verification rejected by admin')}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              
              <button
                onClick={() => handleApprove(selectedVerification.id)}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;