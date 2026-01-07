import React, { useState, useEffect } from 'react';
import { milestoneUpdateApi } from '../lib/api';
import '../styles/milestone-updates.css';

const CampaignUpdates = ({ campaignId, isCreator, isAdmin }) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpdates();
  }, [campaignId]);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const showAll = isCreator || isAdmin;
      const data = await milestoneUpdateApi.getCampaignUpdates(campaignId, showAll);
      setUpdates(data);
    } catch (err) {
      console.error('Failed to load updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const isVideo = (url) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  const isImage = (url) => {
    return url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500">Loading updates...</div>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg font-semibold mb-2">No updates yet</p>
          <p className="text-sm">The creator hasn't posted any progress updates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-updates-list">
      {updates.map((update) => (
        <div key={update.id} className="campaign-update-card">
          {/* Header */}
          <div className="campaign-update-header">
            <div className="campaign-update-author">
              <div className="campaign-update-avatar">
                {update.author?.avatar_url ? (
                  <img src={update.author.avatar_url} alt="" />
                ) : (
                  <span>{update.author?.username?.[0]?.toUpperCase() || 'C'}</span>
                )}
              </div>
              <div className="campaign-update-author-info">
                <div className="campaign-update-author-name">
                  {update.author?.full_name || update.author?.username || 'Campaign Creator'}
                </div>
                <div className="campaign-update-date">
                  {formatDate(update.created_at)}
                </div>
              </div>
            </div>
            {!update.is_public && (isCreator || isAdmin) && (
              <span className="campaign-update-badge draft">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                DRAFT
              </span>
            )}
          </div>

          {/* Title */}
          {update.title && (
            <h3 className="campaign-update-title">
              {update.title}
            </h3>
          )}

          {/* Content */}
          <div className="campaign-update-content">
            {update.content}
          </div>

          {/* Media Gallery */}
          {update.media_urls && update.media_urls.length > 0 && (
            <div className={`campaign-update-media-grid ${
              update.media_urls.length === 1 ? 'single' :
              update.media_urls.length === 2 ? 'double' :
              'multiple'
            }`}>
              {update.media_urls.map((url, idx) => (
                <div key={idx} className="campaign-update-media-item">
                  {isImage(url) && (
                    <img
                      src={url}
                      alt={`Update media ${idx + 1}`}
                      className="campaign-update-image"
                      loading="lazy"
                    />
                  )}
                  {isVideo(url) && (
                    <div className="campaign-update-video-wrapper">
                      <video
                        controls
                        className="campaign-update-video"
                        preload="metadata"
                      >
                        <source src={url} />
                        Your browser does not support video playback.
                      </video>
                    </div>
                  )}
                  {!isImage(url) && !isVideo(url) && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="campaign-update-attachment"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      View Attachment
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CampaignUpdates;
