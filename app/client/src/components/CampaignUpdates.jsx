import React, { useState, useEffect } from 'react';
import { milestoneUpdateApi } from '../lib/api';

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
    <div className="space-y-lg">
      {updates.map((update) => (
        <div key={update.id} className="card">
          {/* Header */}
          <div className="flex items-start justify-between mb-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold">
                {update.author?.username?.[0]?.toUpperCase() || 'C'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {update.author?.full_name || update.author?.username || 'Campaign Creator'}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(update.created_at)}
                </div>
              </div>
            </div>
            {!update.is_public && (isCreator || isAdmin) && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                DRAFT
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-md">
            {update.title}
          </h3>

          {/* Content */}
          <div className="text-gray-700 mb-md whitespace-pre-wrap leading-relaxed">
            {update.content}
          </div>

          {/* Media */}
          {update.media_urls && update.media_urls.length > 0 && (
            <div className="mt-md space-y-md">
              {update.media_urls.map((url, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  {isImage(url) && (
                    <img
                      src={url}
                      alt={`Update media ${idx + 1}`}
                      className="w-full h-auto"
                      style={{ maxHeight: '500px', objectFit: 'contain', backgroundColor: '#f3f4f6' }}
                    />
                  )}
                  {isVideo(url) && (
                    <video
                      controls
                      className="w-full"
                      style={{ maxHeight: '500px', backgroundColor: '#000' }}
                    >
                      <source src={url} />
                      Your browser does not support video playback.
                    </video>
                  )}
                  {!isImage(url) && !isVideo(url) && (
                    <div className="p-4 bg-gray-50 text-center">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        📎 View Attachment
                      </a>
                    </div>
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
