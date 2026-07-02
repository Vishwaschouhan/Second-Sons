import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const API_URL = `${API_BASE_URL}/chat`;

const AiAssistant = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hi! I\'m your SecondSons AI assistant. I can help you book cabs, order groceries & food, find housing, book home services, schedule doctor consultations, and more. Just tell me what you need! 🤖',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ── Core AI processing logic (shared by form submit & voice bridge) ──
  const processQuery = useCallback(async (text) => {
    if (!text) return;

    setMessages((prev) => [...prev, { sender: 'user', text }]);

    if (!user) {
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: 'Please log in first so I can help you with your requests.' },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: user.uid,
          sessionId: sessionId,
        }),
      });

      if (!res.ok) throw new Error('Server error');

      const data = await res.json();
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const confirmationText = data.reply;

      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: confirmationText },
      ]);

      // ── Android WebView TTS bridge ──
      if (window.AndroidBridge) {
        window.AndroidBridge.speakText(confirmationText);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Sorry, I\'m having trouble connecting to the AI server. Please make sure the backend is running and try again.',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [user, sessionId]);

  // ── Register global voice-command handler for the Android WebView ──
  useEffect(() => {
    window.handleVoiceCommand = (query) => {
      processQuery(query);
    };
    return () => {
      delete window.handleVoiceCommand;
    };
  }, [processQuery]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    processQuery(text);
  };

  return (
    <div>
      <style>{`
        .ai-chat-container {
          max-width: 700px;
          margin: 0 auto;
        }
        .ai-chat-header {
          text-align: center;
          margin-bottom: 16px;
        }
        .ai-chat-header h1 {
          margin-bottom: 4px;
        }
        .ai-chat-header p {
          color: #757575;
          font-size: 0.9rem;
          margin: 0;
        }
        .ai-chat-messages {
          border: 1px solid #e0e0e0;
          border-radius: 16px;
          padding: 16px;
          height: 450px;
          overflow-y: auto;
          margin-bottom: 12px;
          background: #fafafa;
        }
        .ai-msg {
          display: flex;
          margin-bottom: 12px;
        }
        .ai-msg.user {
          justify-content: flex-end;
        }
        .ai-msg.assistant {
          justify-content: flex-start;
        }
        .ai-msg-bubble {
          max-width: 80%;
          padding: 10px 16px;
          border-radius: 18px;
          line-height: 1.5;
          font-size: 0.95rem;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .ai-msg.user .ai-msg-bubble {
          background: linear-gradient(135deg, #FF6B00, #FF9F43);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .ai-msg.assistant .ai-msg-bubble {
          background: #fff;
          color: #333;
          border: 1px solid #e0e0e0;
          border-bottom-left-radius: 4px;
        }
        .ai-msg-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .ai-msg.assistant .ai-msg-icon {
          background: linear-gradient(135deg, #FF6B00, #FF9F43);
          color: #fff;
          margin-right: 8px;
        }
        .ai-msg.user .ai-msg-icon {
          background: #e0e0e0;
          margin-left: 8px;
          order: 1;
        }
        .ai-typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 16px;
          color: #999;
          font-size: 0.85rem;
        }
        .ai-typing-dot {
          width: 6px;
          height: 6px;
          background: #FF6B00;
          border-radius: 50%;
          animation: ai-bounce 1.2s infinite;
        }
        .ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes ai-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .ai-chat-form {
          display: flex;
          gap: 8px;
        }
        .ai-chat-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 24px;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .ai-chat-input:focus {
          border-color: #FF6B00;
        }
        .ai-chat-send {
          padding: 12px 24px;
          background: linear-gradient(135deg, #FF6B00, #FF9F43);
          color: #fff;
          border: none;
          border-radius: 24px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
          font-size: 0.95rem;
        }
        .ai-chat-send:hover:not(:disabled) {
          opacity: 0.9;
        }
        .ai-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ai-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .ai-suggestion-chip {
          padding: 6px 14px;
          border: 1px solid #FF6B00;
          border-radius: 20px;
          background: #fff;
          color: #FF6B00;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ai-suggestion-chip:hover {
          background: #FF6B00;
          color: #fff;
        }
      `}</style>

      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <h1>🤖 AI Assistant</h1>
          <p>
            Book cabs, order food, find housing, and more — just chat naturally!
          </p>
        </div>

        {messages.length <= 1 && (
          <div className="ai-suggestions">
            {[
              'Book me a cab',
              'Order my usual biscuits',
              'Find a room in Bhopal',
              'My tap is broken',
              'I have a headache',
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="ai-suggestion-chip"
                onClick={() => {
                  setInput(suggestion);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="ai-chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`ai-msg ${m.sender}`}>
              {m.sender === 'assistant' && (
                <div className="ai-msg-icon">🤖</div>
              )}
              <div className="ai-msg-bubble">{m.text}</div>
              {m.sender === 'user' && (
                <div className="ai-msg-icon">👤</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="ai-msg assistant">
              <div className="ai-msg-icon">🤖</div>
              <div className="ai-typing">
                <div className="ai-typing-dot"></div>
                <div className="ai-typing-dot"></div>
                <div className="ai-typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="ai-chat-form" onSubmit={handleSend}>
          <input
            ref={inputRef}
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message... (e.g. 'book me a cab from VIT to Bhopal')"
            disabled={loading}
          />
          <button className="ai-chat-send" type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;
