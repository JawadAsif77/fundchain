import React, { useState, useEffect } from 'react';
import { qaApi } from '../lib/api';
import { useAuth } from '../store/AuthContext';

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
      <div className="card">
        <div className="text-center py-8 text-gray-500">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* Ask Question Form */}
      {userId && (
        <div className="card">
          <h3 className="card-title">Ask a Question</h3>
          <form onSubmit={handlePostQuestion}>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What would you like to know about this campaign?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows="3"
              disabled={submitting}
              required
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !newQuestion.trim()}
              >
                {submitting ? 'Posting...' : 'Post Question'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!userId && (
        <div className="card">
          <div className="text-center py-4 text-gray-600">
            Please <a href="/login" className="text-primary hover:underline">log in</a> to ask questions
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="card">
        <h3 className="card-title">Questions & Answers ({questions.length})</h3>
        
        {questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No questions yet. Be the first to ask!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question) => (
              <div key={question.id} className="border-b pb-6 last:border-b-0 last:pb-0">
                {/* Question */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                        {question.users?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          {question.users?.full_name || question.users?.username || 'Anonymous'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(question.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    {userId && (
                      <button
                        onClick={() => setReportModal({ type: 'question', id: question.id })}
                        className="text-xs text-gray-400 hover:text-red-600"
                        title="Report this question"
                      >
                        🚩 Report
                      </button>
                    )}
                  </div>
                  <p className="text-gray-700 ml-10">{question.question}</p>
                  {question.is_answered && (
                    <span className="inline-block ml-10 mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      ✓ Answered
                    </span>
                  )}
                </div>

                {/* Answers */}
                {answers[question.id]?.length > 0 && (
                  <div className="ml-10 space-y-3">
                    {answers[question.id].map((answer) => (
                      <div key={answer.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">
                              {answer.users?.username?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {answer.users?.full_name || answer.users?.username || 'Creator'}
                                <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                                  Creator
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(answer.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                          {userId && (
                            <button
                              onClick={() => setReportModal({ type: 'answer', id: answer.id })}
                              className="text-xs text-gray-400 hover:text-red-600"
                              title="Report this answer"
                            >
                              🚩 Report
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm">{answer.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer Form (Creator Only) */}
                {isCreator && !question.is_answered && (
                  <div className="ml-10 mt-3">
                    <textarea
                      value={answerText[question.id] || ''}
                      onChange={(e) => setAnswerText({ ...answerText, [question.id]: e.target.value })}
                      placeholder="Write your answer..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                      rows="2"
                      disabled={submitting}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handlePostAnswer(question.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                        disabled={submitting || !answerText[question.id]?.trim()}
                      >
                        {submitting ? 'Posting...' : 'Post Answer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setReportModal(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Report Content</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please explain why you're reporting this {reportModal.type}:
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for reporting..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows="4"
              disabled={reportSubmitting}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={reportSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
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
