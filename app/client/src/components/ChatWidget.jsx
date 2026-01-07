import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  sendChatMessage, 
  fetchChatHistory,
  saveLocalChatHistory,
  loadLocalChatHistory,
  clearLocalChatHistory
} from '../services/chatService';
import '../styles/chat.css';

// Quick action button templates
const QUICK_ACTIONS = [
  "Explain this risk",
  "Why is this recommended?",
  "What is DeFi?",
  "How does blockchain work?",
  "What are the fees?",
];

export default function ChatWidget() {
  const { user, profile } = useAuth();
  const location = useLocation();
  
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [campaignContext, setCampaignContext] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [copySuccess, setCopySuccess] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (user) {
      const localHistory = loadLocalChatHistory(user.id);
      if (localHistory.length > 0) {
        setMessages(localHistory);
        setShowQuickActions(false);
      } else {
        // Try loading from database
        fetchChatHistory(10).then(dbHistory => {
          if (dbHistory.length > 0) {
            const formattedMessages = dbHistory.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date().toISOString(),
              intent: msg.intent,
            }));
            setMessages(formattedMessages);
            saveLocalChatHistory(user.id, formattedMessages);
            setShowQuickActions(false);
          }
        });
      }
    }
  }, [user]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (user && messages.length > 0) {
      saveLocalChatHistory(user.id, messages);
    }
  }, [messages, user]);

  // Detect campaign context from URL
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    
    // Check if on campaign page: /campaign/:slug or /campaign/:id
    if (pathParts[1] === 'campaign' && pathParts[2]) {
      const identifier = pathParts[2];
      
      // Try to extract campaign ID (could be slug or ID)
      // For now, we'll use the identifier as-is and let backend handle it
      setCampaignContext({
        identifier: identifier,
        name: null, // Will be populated if we fetch campaign data
      });
    } else {
      setCampaignContext(null);
    }
  }, [location.pathname]);

  // Toggle chat panel
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  // Handle message send
  const handleSendMessage = async (messageText = null) => {
    const textToSend = messageText || inputValue.trim();
    
    if (!textToSend || isLoading) return;

    setError(null);
    setInputValue('');
    setShowQuickActions(false);

    // Add user message to chat
    const userMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare full conversation history (last 10 messages for context)
      // Include all previous messages plus the new user message
      const conversationHistory = [
        ...messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: textToSend,
        }
      ];

      // Send full message array to API
      const response = await sendChatMessage(
        conversationHistory,
        campaignContext?.identifier || null
      );

      // Add AI response to chat
      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: response.timestamp,
        intent: response.intent,
        explanation: response.explanation,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick action click
  const handleQuickAction = (action) => {
    handleSendMessage(action);
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle input change
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // Handle Enter key (without Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat history
  const handleClearHistory = () => {
    if (window.confirm('Clear all chat history?')) {
      setMessages([]);
      setShowQuickActions(true);
      if (user) {
        clearLocalChatHistory(user.id);
      }
    }
  };

  // Copy text to clipboard
  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(code);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className={`chat-widget-button ${isOpen ? 'open' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-title">
              <h3>FundChain AI Assistant</h3>
              {campaignContext && (
                <div className="chat-context-indicator">
                  📊 {campaignContext.name || 'Discussing Campaign'}
                </div>
              )}
            </div>
            <button
              className="chat-close"
              onClick={toggleChat}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="chat-empty-state-icon">🤖</div>
                <h4>Welcome {profile?.full_name || user?.email?.split('@')[0] || 'User'}!</h4>
                <p>
                  Ask me anything about campaigns, investments, blockchain, or
                  how the platform works.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`chat-message ${message.role}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="chat-avatar assistant-avatar">
                        <span>🤖</span>
                      </div>
                    )}
                    <div className="chat-message-content">
                      <div className="chat-message-bubble">
                        {message.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                return !inline ? (
                                  <div className="code-block-wrapper">
                                    <div className="code-block-header">
                                      <span className="code-language">{match ? match[1] : 'code'}</span>
                                      <button
                                        className="code-copy-btn"
                                        onClick={() => handleCopyCode(codeString)}
                                        title="Copy code"
                                      >
                                        {copySuccess === codeString ? '✓ Copied' : '📋 Copy'}
                                      </button>
                                    </div>
                                    <pre className={className}>
                                      <code {...props}>{children}</code>
                                    </pre>
                                  </div>
                                ) : (
                                  <code className="inline-code" {...props}>{children}</code>
                                );
                              },
                              p({ children }) {
                                return <p className="markdown-paragraph">{children}</p>;
                              },
                              strong({ children }) {
                                return <strong className="markdown-bold">{children}</strong>;
                              },
                              ul({ children }) {
                                return <ul className="markdown-list">{children}</ul>;
                              },
                              ol({ children }) {
                                return <ol className="markdown-list markdown-ordered">{children}</ol>;
                              },
                              li({ children }) {
                                return <li className="markdown-list-item">{children}</li>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                      <div className="chat-message-meta">
                        {message.role === 'assistant' && message.intent && (
                          <span className={`chat-intent-badge ${message.intent}`}>
                            {message.intent.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="chat-message-time">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="chat-avatar user-avatar">
                        <span>{profile?.full_name?.[0] || user?.email?.[0] || '👤'}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {isLoading && (
                  <div className="chat-message assistant">
                    <div className="chat-avatar assistant-avatar">
                      <span>🤖</span>
                    </div>
                    <div className="chat-message-content">
                      <div className="chat-typing">
                        <div className="chat-typing-dots">
                          <div className="chat-typing-dot"></div>
                          <div className="chat-typing-dot"></div>
                          <div className="chat-typing-dot"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="chat-error">
              {error}
            </div>
          )}

          {/* Quick Actions */}
          {showQuickActions && messages.length === 0 && !isLoading && (
            <div className="chat-quick-actions">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  className="chat-quick-action-btn"
                  onClick={() => handleQuickAction(action)}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="chat-input-area">
            <form className="chat-input-form" onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Ask me anything..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send message"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
