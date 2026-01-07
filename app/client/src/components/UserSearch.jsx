import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileStatsApi } from '../lib/api';
import '../styles/user-search.css';

const UserSearch = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const users = await profileStatsApi.searchUsers(query, 20);
      setResults(users);
      setSearched(true);
    } catch (error) {
      console.error('Error searching users:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
    if (onClose) onClose();
  };

  const getUserInitial = (user) => {
    if (user.full_name) return user.full_name[0].toUpperCase();
    if (user.username) return user.username[0].toUpperCase();
    return 'U';
  };

  const getRoleBadge = (role) => {
    if (role === 'creator') return { text: 'Creator', color: '#10b981' };
    if (role === 'investor') return { text: 'Investor', color: '#3b82f6' };
    return { text: 'User', color: '#6b7280' };
  };

  return (
    <div className="user-search-container">
      <div className="user-search-header">
        <div className="search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by username or name..."
          className="user-search-input"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="clear-search-btn"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="user-search-results">
        {loading && (
          <div className="search-loading">
            <div className="loading-spinner"></div>
            Searching...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="search-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <p>No users found for "{query}"</p>
            <span>Try searching with a different username or name</span>
          </div>
        )}

        {!loading && !searched && query.length === 0 && (
          <div className="search-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>Search for users</p>
            <span>Find creators and investors by username or name</span>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="search-results-list">
            {results.map((user) => {
              const badge = getRoleBadge(user.role);
              return (
                <div
                  key={user.id}
                  className="search-user-card"
                  onClick={() => handleUserClick(user.username)}
                >
                  <div className="search-user-avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {getUserInitial(user)}
                      </div>
                    )}
                  </div>
                  <div className="search-user-info">
                    <div className="search-user-name">
                      {user.full_name || user.username}
                      {user.is_verified === 'verified' && (
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="#29c7ac" 
                          className="verified-icon"
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      )}
                    </div>
                    <div className="search-user-username">@{user.username}</div>
                    {user.bio && (
                      <div className="search-user-bio">{user.bio}</div>
                    )}
                  </div>
                  <div className="search-user-badge" style={{ background: badge.color }}>
                    {badge.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {query.length > 0 && query.length < 2 && (
        <div className="search-hint">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
};

export default UserSearch;
