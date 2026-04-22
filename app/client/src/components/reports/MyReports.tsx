import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type ReportItem = {
  report_id: string;
  campaign_id: string;
  campaign_title: string;
  category: string;
  description: string | null;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | string;
  resolution: 'ACTION_TAKEN' | 'NO_VIOLATION' | 'APPEALED' | null | string;
  created_at: string;
  resolved_at: string | null;
};

const categoryLabelMap: Record<string, string> = {
  FAKE_IDENTITY: 'Fake Identity',
  PLAGIARIZED_CONTENT: 'Plagiarism',
  UNREALISTIC_MILESTONES: 'Unrealistic Milestones',
  SUSPICIOUS_WALLET: 'Suspicious Wallet',
  MISLEADING_FINANCIALS: 'Misleading Financials',
  OTHER: 'Other',
};

const getStatusMeta = (status: string, resolution: string | null) => {
  if (status === 'PENDING') {
    return { label: 'Under Review', bg: '#fef3c7', color: '#92400e' };
  }

  if (status === 'UNDER_REVIEW') {
    return { label: 'Being Investigated', bg: '#dbeafe', color: '#1d4ed8' };
  }

  if (status === 'RESOLVED' && resolution === 'ACTION_TAKEN') {
    return { label: 'Action Taken', bg: '#dcfce7', color: '#166534' };
  }

  if (status === 'RESOLVED' && resolution === 'NO_VIOLATION') {
    return { label: 'No Violation Found', bg: '#fee2e2', color: '#b91c1c' };
  }

  if (status === 'RESOLVED' && resolution === 'APPEALED') {
    return { label: 'Appealed', bg: '#ede9fe', color: '#6d28d9' };
  }

  return { label: status, bg: '#f3f4f6', color: '#374151' };
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDescriptionPreview = (value: string | null) => {
  if (!value || value.trim().length === 0) {
    return {
      text: 'No additional details provided',
      isMuted: true,
    };
  }

  const trimmed = value.trim();
  if (trimmed.length <= 100) {
    return { text: trimmed, isMuted: false };
  }

  return { text: `${trimmed.slice(0, 100)}...`, isMuted: false };
};

const MyReports = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        setIsAuthenticated(false);
        setReports([]);
        return;
      }

      setIsAuthenticated(true);

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/reports`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const fallbackError = 'Failed to load your reports. Please try again.';
        setError(fallbackError);
        setReports([]);
        return;
      }

      const payload = await response.json();
      const incomingReports = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.reports)
        ? payload.reports
        : [];

      setReports(incomingReports);
    } catch (fetchError) {
      console.error('MyReports fetch error:', fetchError);
      setError('Failed to load your reports. Please try again.');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const handleFocus = () => {
      fetchReports();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchReports]);

  const pendingCount = useMemo(
    () => reports.filter((report) => report.status === 'PENDING').length,
    [reports]
  );

  if (isAuthenticated === false) {
    return null;
  }

  return (
    <section style={{ marginTop: '40px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>
          My Reports
        </h2>
        <p style={{ margin: '8px 0 0 0', color: 'var(--color-muted)', fontSize: '14px' }}>
          Track the status of reports you have submitted
        </p>
        {pendingCount > 0 && (
          <div
            style={{
              marginTop: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span>{pendingCount}</span>
            <span>pending report{pendingCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              style={{
                backgroundColor: 'var(--color-white)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '120px', height: '24px', backgroundColor: '#e5e7eb', borderRadius: '999px' }} />
                <div style={{ width: '140px', height: '24px', backgroundColor: '#e5e7eb', borderRadius: '999px' }} />
              </div>
              <div style={{ width: '70%', height: '14px', backgroundColor: '#f3f4f6', borderRadius: '6px', marginBottom: '10px' }} />
              <div style={{ width: '95%', height: '14px', backgroundColor: '#f3f4f6', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ width: '55%', height: '14px', backgroundColor: '#f3f4f6', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '14px',
            borderRadius: '10px',
          }}
        >
          <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 600 }}>{error}</div>
          <button
            type="button"
            onClick={fetchReports}
            style={{
              border: '1px solid #fca5a5',
              backgroundColor: 'white',
              color: '#b91c1c',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            backgroundColor: 'var(--color-white)',
            border: '1px dashed var(--color-border)',
            borderRadius: '12px',
            padding: '36px 20px',
          }}
        >
          <div style={{ fontSize: '44px', color: '#9ca3af', marginBottom: '12px' }}>⚑</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text)' }}>No reports submitted</h3>
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>
            When you report a suspicious campaign, it will appear here.
          </p>
        </div>
      )}

      {!isLoading && !error && reports.length > 0 && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {reports.map((report) => {
            const categoryLabel = categoryLabelMap[report.category] || report.category;
            const statusMeta = getStatusMeta(report.status, report.resolution || null);
            const descriptionPreview = getDescriptionPreview(report.description);
            const submittedDate = formatDate(report.created_at);
            const resolvedDate = formatDate(report.resolved_at);

            return (
              <article
                key={report.report_id}
                style={{
                  backgroundColor: 'var(--color-white)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: '999px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {categoryLabel}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: '999px',
                      backgroundColor: statusMeta.bg,
                      color: statusMeta.color,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-text)' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Campaign:</span> {report.campaign_title}
                </div>

                <p
                  style={{
                    margin: '0 0 10px 0',
                    fontSize: '14px',
                    lineHeight: 1.45,
                    color: descriptionPreview.isMuted ? '#6b7280' : '#374151',
                    fontStyle: descriptionPreview.isMuted ? 'italic' : 'normal',
                  }}
                >
                  {descriptionPreview.text}
                </p>

                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Submitted: {submittedDate}
                </div>
                {resolvedDate && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                    Resolved: {resolvedDate}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MyReports;
