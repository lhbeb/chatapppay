'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

function generateSessionId() {
    return Math.random().toString(36).slice(2, 9).toUpperCase();
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const WELCOME_MSG_1 = `Thank you for your order! 🎉\nWe've reserved your item and are preparing your PayPal invoice now.`;
const WELCOME_MSG_2 = `Before we send it, just let us know if you're ready to proceed with the payment.\nWe'll include all order details in the invoice for your review.`;

const KNOWN_BRANDS = {
    'deeldepot': 'DeelDepot',
    'caslodo': 'Caslodo',
    'chatapppay': 'ChatPay',
};

function extractBrandFromUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        let domain = rawUrl;
        if (domain.includes('://')) {
            domain = new URL(domain).hostname;
        } else if (domain.includes('/')) {
            domain = domain.split('/')[0];
        }
        domain = domain.split(':')[0].toLowerCase().trim();

        if (!domain || domain === 'localhost' || domain === '127.0.0.1') {
            return '';
        }

        const parts = domain.split('.').filter(Boolean);
        if (parts.length === 0) return '';

        let mainPart = '';
        const commonSubdomains = ['www', 'm', 'shop', 'store', 'checkout', 'pay', 'app', 'secure', 'order'];

        const suffix = parts.slice(-2).join('.');
        if (suffix === 'vercel.app' || suffix === 'myshopify.com' || suffix === 'netlify.app' || suffix === 'github.io') {
            mainPart = parts[0];
        } else if (parts.length >= 3 && commonSubdomains.includes(parts[0])) {
            mainPart = parts[1];
        } else if (parts.length >= 2) {
            const twoLevelTlds = ['co.uk', 'org.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br', 'co.za'];
            if (twoLevelTlds.includes(suffix) && parts.length >= 3) {
                mainPart = parts[parts.length - 3];
            } else {
                mainPart = parts[parts.length - 2];
            }
        } else {
            mainPart = parts[0];
        }

        let basePart = mainPart.replace(/-\d+$/, '').replace(/[-_]/g, ' ').trim();
        const key = basePart.replace(/\s+/g, '').toLowerCase();
        if (KNOWN_BRANDS[key]) {
            return KNOWN_BRANDS[key];
        }

        return basePart.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    } catch {
        return '';
    }
}

export default function ChatPage() {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [lastUpdateId, setLastUpdateId] = useState(0);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [siteName, setSiteName] = useState('DeelDepot');

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const pollingRef = useRef(null);
    const notifiedRef = useRef(false);

    // ── Listen for dynamic parent window postMessage ────────────────────────────
    useEffect(() => {
        const handleMsg = (e) => {
            if (e.data && typeof e.data === 'object') {
                if (e.data.siteName) {
                    setSiteName(e.data.siteName);
                } else if (e.data.siteUrl) {
                    const extracted = extractBrandFromUrl(e.data.siteUrl);
                    if (extracted) setSiteName(extracted);
                }
            }
        };
        window.addEventListener('message', handleMsg);
        return () => window.removeEventListener('message', handleMsg);
    }, []);

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

        // Read context injected by widget.js via URL params (needed in both paths)
        const urlParams = new URLSearchParams(window.location.search);

        // Resolve site name from query param, referrer, ancestorOrigins, or cache
        let resolvedSite = urlParams.get('siteName') || urlParams.get('brand') || urlParams.get('brandName');
        const siteUrlParam = urlParams.get('siteUrl') || urlParams.get('site') || urlParams.get('url') || urlParams.get('origin') || urlParams.get('host');
        if (!resolvedSite && siteUrlParam) {
            resolvedSite = extractBrandFromUrl(siteUrlParam);
        }
        if (!resolvedSite && typeof document !== 'undefined' && document.referrer) {
            resolvedSite = extractBrandFromUrl(document.referrer);
        }
        if (!resolvedSite && typeof window !== 'undefined' && window.location?.ancestorOrigins?.length > 0) {
            resolvedSite = extractBrandFromUrl(window.location.ancestorOrigins[0]);
        }
        if (!resolvedSite) {
            resolvedSite = localStorage.getItem('chat_site_name_' + sid) || 'DeelDepot';
        } else {
            localStorage.setItem('chat_site_name_' + sid, resolvedSite);
        }
        setSiteName(resolvedSite);

        if (savedMessages) {
            try {
                let parsed = JSON.parse(savedMessages);
                // Force-update both welcome messages to the latest text
                parsed = parsed.map(m => {
                    if (m.id === 'welcome' || m.id === 'welcome-1') return { ...m, id: 'welcome-1', text: WELCOME_MSG_1 };
                    if (m.id === 'welcome-2') return { ...m, text: WELCOME_MSG_2 };
                    return m;
                });
                // Add welcome-2 if missing (e.g. old single-message sessions)
                if (!parsed.find(m => m.id === 'welcome-2')) {
                    const w1 = parsed.find(m => m.id === 'welcome-1');
                    const insertTs = w1 ? w1.timestamp + 3000 : Date.now();
                    parsed.splice(
                        parsed.findIndex(m => m.id === 'welcome-1') + 1,
                        0,
                        { id: 'welcome-2', role: 'owner', text: WELCOME_MSG_2, timestamp: insertTs }
                    );
                }
                setMessages(parsed);
            } catch { }
        } else {
            // First visit — show first welcome message immediately
            const now = Date.now();
            setMessages([{ id: 'welcome-1', role: 'owner', text: WELCOME_MSG_1, timestamp: now }]);

            // Show typing indicator then deliver second message after 3 seconds
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [
                    ...prev,
                    { id: 'welcome-2', role: 'owner', text: WELCOME_MSG_2, timestamp: Date.now() },
                ]);
            }, 3000);

            // Read order context from URL params
            const ctxName = urlParams.get('name') || '';
            const ctxEmail = urlParams.get('email') || '';
            const ctxOrder = urlParams.get('orderId') || '';
            const ctxTotal = urlParams.get('total') || '';

            const contextLines = [
                resolvedSite && `🌐 Site: ${resolvedSite}`,
                siteUrlParam && `🔗 URL: ${siteUrlParam}`,
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

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be less than 5MB');
                return;
            }
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target.result);
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
    };

    // ── Send message ─────────────────────────────────────────────────────────────
    const handleSend = async () => {
        const text = inputValue.trim();
        if ((!text && !selectedImage) || sending) return;

        setSending(true);
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        const currentImageFile = selectedImage;
        const currentImagePreview = imagePreview;
        clearImage();

        const newMsg = { 
            id: 'v-' + Date.now(), 
            role: 'visitor', 
            text, 
            imageUrl: currentImagePreview,
            timestamp: Date.now() 
        };
        setMessages(prev => [...prev, newMsg]);
        setIsTyping(true);

        try {
            const formData = new FormData();
            formData.append('sessionId', sessionId);
            formData.append('username', 'Customer');
            if (text) formData.append('message', text);
            if (currentImageFile) formData.append('image', currentImageFile);

            const res = await fetch('/api/send-message', {
                method: 'POST',
                body: formData,
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
                        <Image src="/abby.jpg" alt="Eliza M." width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', width: '44px', height: '44px' }} />
                    </div>
                    <div className="header-info">
                        <div className="header-name">Eliza M.</div>
                        <div className="header-status">
                            <span className="status-dot" />
                            {siteName ? `${siteName} support agent` : 'Support agent'}
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
                                    <Image src="/abby.jpg" alt="Eliza M." width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', width: '30px', height: '30px' }} />
                                </div>
                            )}
                            <div className="msg-wrapper">
                                <div className={`bubble ${msg.role === 'visitor' ? 'visitor-bubble' : 'owner-bubble'}`}>
                                    {msg.imageUrl && (
                                        <img src={msg.imageUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: msg.text ? '8px' : '0' }} />
                                    )}
                                    {msg.text}
                                </div>
                                <span className="bubble-time">{formatTime(msg.timestamp)}</span>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="typing-row">
                            <div className="owner-avatar-sm">
                                <Image src="/abby.jpg" alt="Eliza M." width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', width: '30px', height: '30px' }} />
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
                <div className="input-area" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    {imagePreview && (
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '8px', alignSelf: 'flex-start' }}>
                            <img src={imagePreview} alt="preview" style={{ height: '60px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <button 
                                onClick={clearImage}
                                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ×
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={sending} 
                            title="Attach image"
                            style={{ backgroundColor: 'transparent', color: '#6b7280', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s', height: '44px', width: '44px', flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </button>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileSelect} 
                        />
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
                            disabled={(!inputValue.trim() && !selectedImage) || sending}
                            title="Send message"
                        >
                            {sending ? '…' : '↑'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
