import React, { useState, useEffect } from 'react';
import { qaApi } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import '../styles/campaign-qa.css';

const CampaignQA = ({ campaignId, creatorId }) => {
  const { userId } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerText] = useState({});
  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const isCreator = userId === creatorId;

  // Helper function to format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'just now' : `${diffMins}m ago`;
    }
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper to get user initials
  const getUserInitial = (user) => {
    if (user?.full_name) return user.full_name[0].toUpperCase();
    if (user?.username) return user.username[0].toUpperCase();
    return 'U';
  };

  useEffect(() => {
    loadQuestions();
  }, [campaignId]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const questionsData = await qaApi.getCampaignQuestions(campaignId);
      setQuestions(questionsData);

      // Load answers for each question
      const answersMap = {};
      for (const question of questionsData) {
        const questionAnswers = await qaApi.getQuestionAnswers(question.id);
        answersMap[question.id] = questionAnswers;
      }
      setAnswers(answersMap);
    } catch (error) {
      console.error('Error loading Q&A:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    try {
      setSubmitting(true);
      await qaApi.postQuestion(campaignId, newQuestion.trim());
      setNewQuestion('');
      await loadQuestions();
    } catch (error) {
      alert(error.message || 'Failed to post question');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostAnswer = async (questionId) => {
    const text = answerText[questionId];
    if (!text?.trim()) return;

    try {
      setSubmitting(true);
      await qaApi.postAnswer(questionId, text.trim());
      setAnswerText({ ...answerText, [questionId]: '' });
      await loadQuestions();
    } catch (error) {
      alert(error.message || 'Failed to post answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!reportModal || !reportReason.trim()) return;

    try {
      setReportSubmitting(true);
      await qaApi.reportContent(
        reportModal.type,
        reportModal.id,
        reportReason.trim()
      );
      alert('Content reported successfully. Our team will review it.');
      setReportModal(null);
      setReportReason('');
    } catch (error) {
      alert(error.message || 'Failed to report content');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="qa-container">
        <div className="qa-loading">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="qa-container">
      {/* Ask Question Form */}
      {userId && (
        <div className="qa-ask-form">
          <div className="qa-form-header">
            <div className="qa-form-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="qa-form-title">Ask a Question</h3>
          </div>
          <form onSubmit={handlePostQuestion}>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What would you like to know about this campaign?"
              className="qa-textarea"
              rows="3"
              disabled={submitting}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="qa-submit-btn"
                disabled={submitting || !newQuestion.trim()}
              >
                {submitting ? 'Posting...' : 'Post Question'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!userId && (
        <div className="qa-login-prompt">
          <p>Please <a href="/login">log in</a> to ask questions</p>
        </div>
      )}

      {/* Questions List */}
      <div className="qa-list-header">
        <h3 className="qa-list-title">Questions & Answers ({questions.length})</h3>
      </div>
      
      {questions.length === 0 ? (
        <div className="qa-empty-state">
          <p>No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="qa-list">
          {questions.map((question) => (
            <div key={question.id} className="qa-question-card">
              {/* Question */}
              <div className="qa-question-header">
                <div className="qa-user-info">
                  <div className="qa-avatar">
                    {getUserInitial(question.users)}
                  </div>
                  <div className="qa-user-details">
                    <div className="qa-username">
                      {question.users?.full_name || question.users?.username || 'Anonymous'}
                    </div>
                    <div className="qa-timestamp">
                      {formatRelativeTime(question.created_at)}
                    </div>
                  </div>
                </div>
                {userId && (
                  <button
                    onClick={() => setReportModal({ type: 'question', id: question.id })}
                    className="qa-report-btn"
                    title="Report this question"
                  >
                    🚩 Report
                  </button>
                )}
              </div>
              <p className="qa-question-text">{question.question}</p>
              {question.is_answered && (
                <span className="qa-answered-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Answered
                </span>
              )}

              {/* Answers */}
              {answers[question.id]?.length > 0 && (
                <div className="qa-answers-section">
                  {answers[question.id].map((answer) => (
                    <div key={answer.id} className="qa-answer-card">
                      <div className="qa-answer-header">
                        <div className="qa-answer-user">
                          <div className="qa-answer-avatar qa-avatar creator">
                            {getUserInitial(answer.users)}
                          </div>
                          <div className="qa-answer-details">
                            <div className="qa-answer-username">
                              {answer.users?.full_name || answer.users?.username || 'Creator'}
                              <span className="qa-creator-badge">Creator</span>
                            </div>
                            <div className="qa-answer-time">
                              {formatRelativeTime(answer.created_at)}
                            </div>
                          </div>
                        </div>
                        {userId && (
                          <button
                            onClick={() => setReportModal({ type: 'answer', id: answer.id })}
                            className="qa-report-btn"
                            title="Report this answer"
                          >
                            🚩
                          </button>
                        )}
                      </div>
                      <p className="qa-answer-text">{answer.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Answer Form (Creator Only) */}
              {isCreator && !question.is_answered && (
                <div className="qa-answer-form">
                  <textarea
                    value={answerText[question.id] || ''}
                    onChange={(e) => setAnswerText({ ...answerText, [question.id]: e.target.value })}
                    placeholder="Write your answer..."
                    className="qa-answer-textarea"
                    rows="2"
                    disabled={submitting}
                  />
                  <button
                    onClick={() => handlePostAnswer(question.id)}
                    className="qa-answer-submit"
                    disabled={submitting || !answerText[question.id]?.trim()}
                  >
                    {submitting ? 'Posting...' : 'Post Answer'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div 
          className="qa-report-modal-overlay"
          onClick={() => setReportModal(null)}
        >
          <div 
            className="qa-report-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="qa-report-title">Report Content</h3>
            <p className="qa-report-description">
              Please explain why you're reporting this {reportModal.type}:
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for reporting..."
              className="qa-report-textarea"
              rows="4"
              disabled={reportSubmitting}
            />
            <div className="qa-report-actions">
              <button
                onClick={() => setReportModal(null)}
                disabled={reportSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={reportSubmitting || !reportReason.trim()}
              >
                {reportSubmitting ? 'Reporting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignQA;
