import React, { useEffect, useState, useRef } from 'react';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const HEADER_HEIGHT = 60;
const INPUT_HEIGHT = 64;

const ChatWindow = ({ requestId, currentUser, onClose, title = 'Support Chat' }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!requestId) return;
        const q = query(
            collection(db, 'chats', requestId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [requestId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const orig = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = orig; };
    }, []);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await addDoc(collection(db, 'chats', requestId, 'messages'), {
            text: newMessage,
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
        });
        setNewMessage('');
    };

    const formatTime = (timestamp) => {
        if (!timestamp?.toDate) return '';
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: '#f0f2f5',
            overflow: 'hidden',
        }}>
            {/* Header - absolutely positioned at top */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${HEADER_HEIGHT}px`,
                padding: '0 16px',
                background: 'linear-gradient(135deg, #f47c20, #e06800)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 2,
                boxSizing: 'border-box',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '22px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        boxShadow: 'none',
                    }}
                    aria-label="Go back"
                >
                    ←
                </button>
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                }}>
                    🎧
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{title}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85 }}>Online</div>
                </div>
            </div>

            {/* Messages Area - positioned between header and input */}
            <div style={{
                position: 'absolute',
                top: `${HEADER_HEIGHT}px`,
                left: 0,
                right: 0,
                bottom: `${INPUT_HEIGHT}px`,
                overflowY: 'scroll',
                padding: '16px',
                WebkitOverflowScrolling: 'touch',
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '14px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
                        No messages yet. Start the conversation!
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.uid;
                    return (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                justifyContent: isMe ? 'flex-end' : 'flex-start',
                                marginBottom: '6px',
                            }}
                        >
                            <div style={{ maxWidth: '78%' }}>
                                <div style={{
                                    backgroundColor: isMe ? '#f47c20' : '#ffffff',
                                    color: isMe ? 'white' : '#1a1a1a',
                                    padding: '10px 14px',
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    wordWrap: 'break-word',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                    fontSize: '15px',
                                    lineHeight: '1.4',
                                }}>
                                    {msg.text}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: '#999',
                                    marginTop: '3px',
                                    textAlign: isMe ? 'right' : 'left',
                                    paddingLeft: isMe ? 0 : '6px',
                                    paddingRight: isMe ? '6px' : 0,
                                }}>
                                    {formatTime(msg.createdAt)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar - absolutely positioned at bottom */}
            <form
                className="chat-input-form"
                onSubmit={handleSendMessage}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${INPUT_HEIGHT}px`,
                    padding: '10px 12px',
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    zIndex: 2,
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        padding: '12px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '24px',
                        fontSize: '16px',
                        outline: 'none',
                        backgroundColor: '#f5f5f5',
                        boxSizing: 'border-box',
                    }}
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: 'none',
                        background: newMessage.trim()
                            ? 'linear-gradient(135deg, #f47c20, #e06800)'
                            : '#ccc',
                        color: 'white',
                        fontSize: '20px',
                        cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                        boxShadow: 'none',
                    }}
                >
                    ➤
                </button>
            </form>
        </div>
    );
};

export default ChatWindow;
