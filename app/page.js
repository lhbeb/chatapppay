'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

function generateSessionId() {
    return Math.random().toString(36).slice(2, 9).toUpperCase();
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const WELCOME_MSG = `Thank you for your order! 🎉\n\nYour item is reserved under your name.\n\nTo confirm and secure it, we'll send you a safe PayPal invoice for payment.\n\nAre you okay with receiving a PayPal invoice to complete your purchase?\nJust reply Yes or No, and we'll proceed immediately.`;

export default function ChatPage() {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [lastUpdateId, setLastUpdateId] = useState(0);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const pollingRef = useRef(null);
    const notifiedRef = useRef(false);

    // ── On mount: restore or create session, show welcome, notify Telegram ──────
    useEffect(() => {
        let sid = localStorage.getItem('chat_session_id');
        let savedMessages = localStorage.getItem('chat_messages_' + sid);
        let savedUpdateId = localStorage.getItem('chat_last_update_id_' + sid);

        if (!sid) {
            sid = generateSessionId();
            localStorage.setItem('chat_session_id', sid);
        }

        setSessionId(sid);

        if (savedUpdateId) {
            setLastUpdateId(parseInt(savedUpdateId, 10));
        }

        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch { }
        } else {
            // First visit — show welcome message immediately
            setMessages([{ id: 'welcome', role: 'owner', text: WELCOME_MSG, timestamp: Date.now() }]);

            // Read context injected by widget.js via URL params
            const params = new URLSearchParams(window.location.search);
            const ctxName = params.get('name') || '';
            const ctxEmail = params.get('email') || '';
            const ctxOrder = params.get('orderId') || '';
            const ctxTotal = params.get('total') || '';

            const contextLines = [
                ctxName && `👤 Name: ${ctxName}`,
                ctxEmail && `📧 Email: ${ctxEmail}`,
                ctxOrder && `🧾 Order ID: ${ctxOrder}`,
                ctxTotal && `💰 Total: ${ctxTotal}`,
            ].filter(Boolean);

            const notification = contextLines.length > 0
                ? `🔔 New chat session started\n\n${contextLines.join('\n')}`
                : '🔔 A new chat session has been initiated.';

            // Notify Telegram
            if (!notifiedRef.current) {
                notifiedRef.current = true;
                fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sid,
                        message: notification,
                        username: ctxName || 'Customer',
                    }),
                }).catch(() => { });
            }
        }
    }, []);

    // ── Auto-scroll ──────────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ── Persist messages ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (sessionId && messages.length > 0) {
            localStorage.setItem('chat_messages_' + sessionId, JSON.stringify(messages));
        }
    }, [messages, sessionId]);

    // ── Poll for replies ─────────────────────────────────────────────────────────
    const pollReplies = useCallback(async () => {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/get-replies?sessionId=${sessionId}&lastUpdateId=${lastUpdateId}`);
            const data = await res.json();

            if (data.replies && data.replies.length > 0) {
                setIsTyping(false);
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newReplies = data.replies.filter(r => !existingIds.has('owner-' + r.id));
                    if (newReplies.length === 0) return prev;
                    return [
                        ...prev,
                        ...newReplies.map(r => ({
                            id: 'owner-' + r.id,
                            role: 'owner',
                            text: r.text,
                            timestamp: r.timestamp || Date.now(),
                        })),
                    ];
                });
            }

            if (data.lastUpdateId && data.lastUpdateId !== lastUpdateId) {
                setLastUpdateId(data.lastUpdateId);
                if (sessionId) {
                    localStorage.setItem('chat_last_update_id_' + sessionId, String(data.lastUpdateId));
                }
            }
        } catch { }
    }, [sessionId, lastUpdateId]);

    useEffect(() => {
        if (!sessionId) return;
        pollingRef.current = setInterval(pollReplies, 3000);
        return () => clearInterval(pollingRef.current);
    }, [sessionId, pollReplies]);

    // ── Send message ─────────────────────────────────────────────────────────────
    const handleSend = async () => {
        const text = inputValue.trim();
        if (!text || sending) return;

        setSending(true);
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        const newMsg = { id: 'v-' + Date.now(), role: 'visitor', text, timestamp: Date.now() };
        setMessages(prev => [...prev, newMsg]);
        setIsTyping(true);

        try {
            const res = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, message: text, username: 'Customer' }),
            });
            if (!res.ok) setIsTyping(false);
        } catch {
            setIsTyping(false);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e) => {
        setInputValue(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <div className="chat-container">

                {/* Header */}
                <div className="chat-header">
                    <div className="header-avatar">
                        <Image src="/abby.jpg" alt="Abby" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', width: '44px', height: '44px' }} />
                    </div>
                    <div className="header-info">
                        <div className="header-name">Abby</div>
                        <div className="header-status">
                            <span className="status-dot" />
                            Customer Support Agent
                        </div>
                    </div>
                    <div className="header-badge">Live</div>
                </div>

                {/* Messages */}
                <div className="messages-area">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message-row ${msg.role}`}>
                            {msg.role === 'owner' && (
                                <div className="owner-avatar-sm">
                                    <Image src="/abby.jpg" alt="Abby" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', width: '30px', height: '30px' }} />
                                </div>
                            )}
                            <div className="msg-wrapper">
                                <div className={`bubble ${msg.role === 'visitor' ? 'visitor-bubble' : 'owner-bubble'}`}>
                                    {msg.text}
                                </div>
                                <span className="bubble-time">{formatTime(msg.timestamp)}</span>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="typing-row">
                            <div className="owner-avatar-sm">
                                <Image src="/abby.jpg" alt="Abby" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', width: '30px', height: '30px' }} />
                            </div>
                            <div className="typing-bubble">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <div className="input-area">
                    <textarea
                        ref={textareaRef}
                        className="message-input"
                        placeholder="Type a message…"
                        value={inputValue}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={sending}
                    />
                    <button
                        className="send-btn"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || sending}
                        title="Send message"
                    >
                        {sending ? '…' : '↑'}
                    </button>
                </div>

            </div>
        </div>
    );
}
