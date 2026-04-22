import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignTitle: string;
};

const MAX_DESCRIPTION = 1000;

const ReportModal = ({ isOpen, onClose, campaignId, campaignTitle }: ReportModalProps) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportsSubmittedToday, setReportsSubmittedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const remaining = dailyLimit - reportsSubmittedToday;
  const hasReachedDailyLimit = remaining <= 0;

  const hasUnsavedChanges = () => {
    return description.trim() !== '' || category !== '' || isAnonymous;
  };

  const resetModalState = () => {
    setCategory('');
    setDescription('');
    setIsAnonymous(false);
    setIsSubmitting(false);
    setReportsSubmittedToday(0);
    setDailyLimit(5);
    setIsLoadingQuota(false);
    setShowCloseConfirmation(false);
    setError(null);
    setSuccess(false);
  };

  const closeWithFormResetOnly = () => {
    setCategory('');
    setDescription('');
    setIsAnonymous(false);
    setShowCloseConfirmation(false);
    onClose();
  };

  const handleCloseAttempt = () => {
    if (success) {
      resetModalState();
      onClose();
      return;
    }

    if (!hasUnsavedChanges()) {
      closeWithFormResetOnly();
      return;
    }

    setShowCloseConfirmation(true);
  };

  const handleDiscardReport = () => {
    resetModalState();
    onClose();
  };

  const handleKeepEditing = () => {
    setShowCloseConfirmation(false);
    const firstField = document.querySelector('[data-report-first-field="true"]') as HTMLElement | null;
    firstField?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const loadQuota = async () => {
      try {
        setIsLoadingQuota(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id;
        const token = session?.access_token;

        if (!userId || !token) {
          return;
        }

        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/reputation/${userId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (isCancelled) return;

        setReportsSubmittedToday(Number(result?.reports_submitted_today || 0));
        setDailyLimit(Number(result?.daily_limit || 5));
      } catch {
        // Non-critical enhancement. Fail silently.
      } finally {
        if (!isCancelled) {
          setIsLoadingQuota(false);
        }
      }
    };

    loadQuota();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseAttempt();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, category, description, isAnonymous, success]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (hasReachedDailyLimit) {
      return;
    }

    if (!category) {
      setError('Please select a reason for your report');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('Please log in to submit a report');
        setIsSubmitting(false);
        return;
      }

      const functionUrl = `${supabase.supabaseUrl}/functions/v1/reports`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          category,
          description: description.trim(),
          is_anonymous: isAnonymous,
        }),
      });

      if (response.status === 201) {
        setSuccess(true);
        return;
      }

      if (response.status === 409) {
        setError('You have already reported this campaign');
      } else if (response.status === 429) {
        setError('You have reached your daily report limit. Try again tomorrow.');
      } else if (response.status === 403) {
        setError('You cannot report your own campaign');
      } else if (response.status === 401) {
        setError('Please log in to submit a report');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (submitError) {
      console.error('Report submit error:', submitError);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 20px 12px 20px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>Report Campaign</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#6b7280' }}>{campaignTitle}</p>
          </div>
          <button
            type="button"
            onClick={handleCloseAttempt}
            aria-label="Close report modal"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ fontSize: '42px', color: '#16a34a', marginBottom: '8px' }}>✓</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#065f46' }}>Report Submitted</h4>
              <p style={{ margin: '0 0 20px 0', color: '#374151', lineHeight: 1.5 }}>
                Thank you for helping keep our platform safe. Our team will review your report shortly.
              </p>
              <button
                type="button"
                onClick={handleDiscardReport}
                style={{
                  border: 'none',
                  backgroundColor: '#29C7AC',
                  color: 'white',
                  fontWeight: 600,
                  borderRadius: '8px',
                  padding: '10px 18px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px', minHeight: '44px' }}>
                {isLoadingQuota ? (
                  <div
                    style={{
                      height: '14px',
                      width: '100%',
                      borderRadius: '999px',
                      backgroundColor: '#f3f4f6',
                    }}
                  />
                ) : hasReachedDailyLimit ? (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    You have reached your daily report limit of {dailyLimit} reports. You can submit more reports tomorrow.
                  </div>
                ) : remaining === 1 ? (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    You have 1 report remaining today. Use it carefully.
                  </div>
                ) : remaining === 2 ? (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    You have 2 reports remaining today.
                  </div>
                ) : null}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                  What is the issue?
                </label>
                <select
                  data-report-first-field="true"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="" disabled>
                    Select a reason...
                  </option>
                  <option value="FAKE_IDENTITY">Fake Business Identity</option>
                  <option value="PLAGIARIZED_CONTENT">Plagiarized Content</option>
                  <option value="UNREALISTIC_MILESTONES">Unrealistic Milestones</option>
                  <option value="SUSPICIOUS_WALLET">Suspicious Wallet Activity</option>
                  <option value="MISLEADING_FINANCIALS">Misleading Financial Claims</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                  Additional details (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION))}
                  placeholder="Provide any specific details that support your report..."
                  maxLength={MAX_DESCRIPTION}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  {description.length} / {MAX_DESCRIPTION}
                </div>
              </div>

              <div
                style={{
                  marginBottom: '18px',
                  border: `1px solid ${isAnonymous ? '#3b82f6' : '#d1d5db'}`,
                  backgroundColor: isAnonymous ? '#eff6ff' : '#f9fafb',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600 }}>
                    <span aria-hidden="true">🔒</span>
                    <span>Submit anonymously</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                  />
                </label>
                <ul
                  style={{
                    margin: '10px 0 0 0',
                    paddingLeft: '18px',
                    color: '#6b7280',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
                  <li>The campaign creator cannot see who reported them</li>
                  <li>Platform admins can still see your identity for accountability purposes</li>
                  <li>False reports still affect your reputation score</li>
                </ul>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: '16px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || hasReachedDailyLimit || !category}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'white',
                  backgroundColor: isSubmitting
                    ? '#9ca3af'
                    : hasReachedDailyLimit
                    ? '#6b7280'
                    : '#ef4444',
                  cursor: isSubmitting || hasReachedDailyLimit || !category ? 'not-allowed' : 'pointer',
                  opacity: !isSubmitting && !hasReachedDailyLimit && !category ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255, 255, 255, 0.5)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'report-spin 0.8s linear infinite',
                      }}
                    />
                    Submitting...
                  </>
                ) : hasReachedDailyLimit ? (
                  'Daily Limit Reached'
                ) : (
                  'Submit Report'
                )}
              </button>
              <style>
                {`@keyframes report-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
              </style>
            </form>
          )}
        </div>

        {showCloseConfirmation && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #fdba74',
                boxShadow: '0 20px 35px rgba(0, 0, 0, 0.2)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#111827' }}>
                <span aria-hidden="true">⚠️</span>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>
                  You have unsaved changes. Are you sure you want to close?
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDiscardReport}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'white',
                    backgroundColor: '#29C7AC',
                    cursor: 'pointer',
                  }}
                >
                  Discard Report
                </button>
                <button
                  type="button"
                  onClick={handleKeepEditing}
                  style={{
                    flex: 1,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#374151',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Keep Editing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
