'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const AGENTS = [
    { name: 'Sophie', image: '/widget%20profile%20pics/img1.jpg' },
    { name: 'Emma', image: '/widget%20profile%20pics/img2.jpg' },
    { name: 'Olivia', image: '/widget%20profile%20pics/img3.jpg' },
    { name: 'Ava', image: '/widget%20profile%20pics/img4.jpg' },
    { name: 'Isabella', image: '/widget%20profile%20pics/img5.jpg' }
];

function getOrCreateAgentName(sessionId) {
    const key = 'livechat_agent_' + sessionId;
    let data = localStorage.getItem(key);
    if (!data) {
        const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
        data = JSON.stringify(agent);
        localStorage.setItem(key, data);
        return agent;
    }
    try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.name && parsed.image) return parsed;
        throw new Error("Invalid");
    } catch {
        // Migration: check if old string key exists
        const agent = AGENTS.find(a => a.name === data) || AGENTS[0];
        localStorage.setItem(key, JSON.stringify(agent));
        return agent;
    }
}

function generateSessionId() {
    return Math.random().toString(36).slice(2, 9).toUpperCase();
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LiveChatContent() {
    const searchParams = useSearchParams();
    const themeColor = searchParams.get('color') || '#007bff';
    const siteUrl = searchParams.get('siteUrl') || '';

    // Extract clean domain name from siteUrl for display
    let displayDomain = 'Live Support';
    try {
        if (siteUrl) {
            const hostname = new URL(decodeURIComponent(siteUrl)).hostname;
            displayDomain = `${hostname} Live Support`;
        }
    } catch (e) {
        displayDomain = 'Live Support';
    }

    const [email, setEmail] = useState('');
    const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
    const [agentName, setAgentName] = useState('Support');
    const [agentImage, setAgentImage] = useState(null);
    const [agentTyping, setAgentTyping]       = useState(false);
    const [agentTypingFading, setAgentTypingFading] = useState(false);
    
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [lastUpdateId, setLastUpdateId] = useState(0);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const messagesEndRef  = useRef(null);
    const fileInputRef    = useRef(null);
    const pollingRef      = useRef(null);
    const agentTypingTimerRef = useRef(null);
    const userTypingTimerRef  = useRef(null);
    const fadingTimerRef      = useRef(null);

    // Gracefully fade out the typing indicator instead of cutting it immediately
    const fadeOutTyping = useCallback(() => {
        clearTimeout(fadingTimerRef.current);
        setAgentTypingFading(true);
        fadingTimerRef.current = setTimeout(() => {
            setAgentTyping(false);
            setAgentTypingFading(false);
        }, 450);
    }, []);
    
    // Initialize session and email from local storage
    useEffect(() => {
        const storedEmail = localStorage.getItem('livechat_email');
        if (storedEmail) {
            setEmail(storedEmail);
            setIsEmailSubmitted(true);
        }

        let sid = localStorage.getItem('livechat_session_id');
        let savedMessages = localStorage.getItem('livechat_messages_' + sid);
        let savedUpdateId = localStorage.getItem('livechat_last_update_id_' + sid);

        if (!sid) {
            sid = generateSessionId();
            localStorage.setItem('livechat_session_id', sid);
        }
        setSessionId(sid);

        // Pick or restore agent name for this session
        const agent = getOrCreateAgentName(sid);
        setAgentName(agent.name);
        setAgentImage(agent.image);

        if (savedUpdateId) {
            setLastUpdateId(parseInt(savedUpdateId, 10));
        }

        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch (e) { }
        } else if (storedEmail) {
            // First visit with saved email — deliver messages sequentially
            setTimeout(() => {
                setMessages([
                    {
                        id: 'agent-join',
                        role: 'owner',
                        text: `✅ ${agent} has joined the chat. You're now connected with a real support agent (not an AI responder)!`,
                        timestamp: Date.now(),
                    }
                ]);
                setTimeout(() => {
                    setAgentTyping(true);
                    setTimeout(() => {
                        setAgentTyping(false);
                        setMessages(prev => [
                            ...prev,
                            {
                                id: 'welcome',
                                role: 'owner',
                                text: `Hi there! 👋 I'm ${agent}. You are chatting with a real person, not an AI responder! How can I help you today?`,
                                timestamp: Date.now(),
                            }
                        ]);
                    }, 2800);
                }, 900);
            }, 500);
        }


    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, agentTyping]);

    // Persist messages
    useEffect(() => {
        if (sessionId && messages.length > 0) {
            try {
                const storableMessages = messages.map(msg => {
                    if (msg.imageUrl && msg.imageUrl.length > 50000) {
                        return { ...msg, imageUrl: null, text: msg.text ? msg.text : '[Image Attached]' };
                    }
                    return msg;
                });
                localStorage.setItem('livechat_messages_' + sessionId, JSON.stringify(storableMessages));
            } catch (e) {
                console.error('Failed to save livechat messages', e);
            }
        }
    }, [messages, sessionId]);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;
        
        localStorage.setItem('livechat_email', trimmedEmail);
        setIsEmailSubmitted(true);

        // Deliver messages one by one with typing delay to feel like a real human agent
        if (messages.length === 0) {
            setTimeout(() => {
                setMessages([
                    {
                        id: 'agent-join',
                        role: 'system',
                        text: `✅ ${agentName} has joined the chat.`,
                        timestamp: Date.now(),
                    }
                ]);

                setTimeout(() => {
                    setAgentTyping(true);

                    setTimeout(() => {
                        setAgentTyping(false);
                        setMessages(prev => [
                            ...prev,
                            {
                                id: 'welcome',
                                role: 'owner',
                                text: `Hi there! 👋 I'm ${agentName}. You are chatting with a real person, not an AI responder! How can I help you today?`,
                                timestamp: Date.now(),
                            }
                        ]);
                    }, 2800);
                }, 900);
            }, 500);
        }

        // Notify Telegram with agent name
        fetch('/api/livechat/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                message: `🔔 New chat session started`,
                email: trimmedEmail,
                agentName,
                siteUrl,
                isSystemEvent: true
            }),
        }).catch(() => {});
    };

    const pollReplies = useCallback(async () => {
        if (!sessionId || !isEmailSubmitted) return;
        try {
            const res = await fetch(`/api/livechat/get-replies?sessionId=${sessionId}&lastUpdateId=${lastUpdateId}`);
            const data = await res.json();

            if (data.replies && data.replies.length > 0) {
                fadeOutTyping();
                clearTimeout(agentTypingTimerRef.current);
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
                localStorage.setItem('livechat_last_update_id_' + sessionId, String(data.lastUpdateId));
            }
        } catch (e) { }
    }, [sessionId, lastUpdateId, isEmailSubmitted]);

    useEffect(() => {
        if (!sessionId || !isEmailSubmitted) return;
        pollingRef.current = setInterval(pollReplies, 3000);
        return () => clearInterval(pollingRef.current);
    }, [sessionId, pollReplies, isEmailSubmitted]);

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

    const handleSend = async () => {
        const text = inputValue.trim();
        if ((!text && !selectedImage) || sending) return;

        setSending(true);
        setInputValue('');

        const currentImageFile = selectedImage;
        const currentImagePreview = imagePreview;
        clearImage();

        // User sent — agent appears to start typing after short delay
        clearTimeout(userTypingTimerRef.current);
        clearTimeout(agentTypingTimerRef.current);
        fadeOutTyping();
        agentTypingTimerRef.current = setTimeout(() => {
            setAgentTypingFading(false);
            setAgentTyping(true);
            // Auto-stop agent typing after a while (in case no real reply comes)
            agentTypingTimerRef.current = setTimeout(() => fadeOutTyping(), 30000);
        }, 800);

        const newMsg = { 
            id: 'v-' + Date.now(), 
            role: 'visitor', 
            text, 
            imageUrl: currentImagePreview,
            timestamp: Date.now() 
        };
        setMessages(prev => [...prev, newMsg]);

        try {
            const formData = new FormData();
            formData.append('sessionId', sessionId);
            formData.append('email', email);
            formData.append('siteUrl', siteUrl);
            formData.append('agentName', agentName);
            if (text) formData.append('message', text);
            if (currentImageFile) formData.append('image', currentImageFile);

            await fetch('/api/livechat/send-message', {
                method: 'POST',
                body: formData,
            });
        } catch (e) {
            console.error(e);
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

    // When user types: smoothly fade out agent typing (agent is "waiting")
    // When user stops typing (1.5s idle): show agent typing again
    const handleTextareaChange = (e) => {
        setInputValue(e.target.value);
        // User started typing — fade agent out gently
        if (agentTyping && !agentTypingFading) fadeOutTyping();
        clearTimeout(userTypingTimerRef.current);
        if (e.target.value.trim()) {
            // Resume agent typing if user goes idle for 1.5s
            userTypingTimerRef.current = setTimeout(() => {
                setAgentTypingFading(false);
                setAgentTyping(true);
            }, 1500);
        }
    };

    // STYLES
    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#f9fafb',
            color: '#111827'
        },
        header: {
            backgroundColor: themeColor,
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        },
        agentAvatar: {
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '1rem',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.5)'
        },
        agentInfo: {
            flex: 1
        },
        agentName: {
            fontWeight: '700',
            fontSize: '0.95rem',
            lineHeight: 1.2
        },
        agentStatus: {
            fontSize: '0.75rem',
            opacity: 0.85,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        },
        onlineDot: {
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#4ade80',
            display: 'inline-block'
        },
        formContainer: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'white'
        },
        input: {
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            marginBottom: '16px',
            fontSize: '1rem',
            boxSizing: 'border-box'
        },
        button: {
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: themeColor,
            color: 'white',
            border: 'none',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
        },
        messagesArea: {
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#ffffff'
        },
        messageRow: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: '8px',
            marginBottom: '4px',
        },
        ownerRow: {
            justifyContent: 'flex-start',
        },
        visitorRow: {
            justifyContent: 'flex-end',
        },
        msgAvatarSm: {
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: themeColor,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '0.75rem',
            flexShrink: 0,
        },
        msgGroup: {
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '72%',
        },
        visitor: {
            alignItems: 'flex-end'
        },
        owner: {
            alignItems: 'flex-start'
        },
        bubble: {
            padding: '10px 14px',
            borderRadius: '16px',
            wordBreak: 'break-word',
            fontSize: '0.9rem',
            lineHeight: '1.45',
            display: 'inline-block',
        },
        visitorBubble: {
            backgroundColor: themeColor,
            color: 'white',
            borderBottomRightRadius: '2px'
        },
        ownerBubble: {
            backgroundColor: '#f3f4f6',
            color: '#1f2937',
            borderBottomLeftRadius: '2px'
        },
        time: {
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '4px'
        },
        inputArea: {
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'white',
            borderTop: '1px solid #e5e7eb',
            gap: '8px',
        },
        inputRow: {
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
        },
        attachBtn: {
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background-color 0.2s',
        },
        textarea: {
            flex: 1,
            resize: 'none',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            maxHeight: '100px',
            boxSizing: 'border-box'
        },
        sendBtn: {
            backgroundColor: themeColor,
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0
        }
    };

    // Animated typing dots injected once
    if (typeof document !== 'undefined' && !document.getElementById('livechat-typing-style')) {
        const s = document.createElement('style');
        s.id = 'livechat-typing-style';
        s.innerHTML = `
            @keyframes lc-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
            .lc-dot { width:7px; height:7px; border-radius:50%; background:#9ca3af; display:inline-block; animation:lc-bounce 1.2s infinite; }
            .lc-dot:nth-child(2){ animation-delay:0.15s; }
            .lc-dot:nth-child(3){ animation-delay:0.3s; }
        `;
        document.head.appendChild(s);
    }

    if (!isEmailSubmitted) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.agentAvatar}>{agentImage ? <img src={agentImage} alt={agentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : agentName.charAt(0)}</div>
                    <div style={styles.agentInfo}>
                        <div style={styles.agentName}>{agentName}</div>
                        <div style={styles.agentStatus}>
                            <span style={styles.onlineDot}/> Online · {displayDomain}
                        </div>
                    </div>
                </div>
                <div style={styles.formContainer}>
                    <h2 style={{marginTop: 0, marginBottom: '8px', fontSize: '1.25rem', color: '#111827'}}>Welcome!</h2>
                    <p style={{marginBottom: '24px', color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.4'}}>Please enter your email address to start chatting with a real person from our support team (not an AI responder).</p>
                    <form onSubmit={handleEmailSubmit}>
                        <input
                            type="email"
                            required
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                        />
                        <button type="submit" style={{...styles.button, opacity: email ? 1 : 0.7}}>
                            Start Chat
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.agentAvatar}>{agentImage ? <img src={agentImage} alt={agentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : agentName.charAt(0)}</div>
                <div style={styles.agentInfo}>
                    <div style={styles.agentName}>{agentName}</div>
                    <div style={styles.agentStatus}>
                        <span style={styles.onlineDot}/>
                        {agentTyping ? `${agentName} is typing...` : `Online · ${displayDomain}`}
                    </div>
                </div>
            </div>
            <div style={styles.messagesArea}>
                {messages.map((msg) => {
                    if (msg.role === 'system') {
                        return (
                            <div key={msg.id} style={{ textAlign: 'center', margin: '16px 0', fontSize: '0.85rem', color: '#6b7280', padding: '0 16px' }}>
                                {msg.text}
                            </div>
                        );
                    }
                    return (
                        <div key={msg.id} style={{ ...styles.messageRow, ...(msg.role === 'visitor' ? styles.visitorRow : styles.ownerRow) }}>
                            {msg.role === 'owner' && (
                                <div style={styles.msgAvatarSm}>{agentImage ? <img src={agentImage} alt={agentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : agentName.charAt(0)}</div>
                            )}
                            <div style={styles.msgGroup}>
                                <div style={{ ...styles.bubble, ...(msg.role === 'visitor' ? styles.visitorBubble : styles.ownerBubble) }}>
                                    {msg.imageUrl && (
                                        <img src={msg.imageUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: msg.text ? '8px' : '0' }} />
                                    )}
                                    {msg.text && <div>{msg.text}</div>}
                                </div>
                                <span style={{ ...styles.time, textAlign: msg.role === 'visitor' ? 'right' : 'left' }}>
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        </div>
                    );
                })}
                {agentTyping && (
                    <div style={{
                        ...styles.messageRow,
                        ...styles.ownerRow,
                        opacity: agentTypingFading ? 0 : 1,
                        transform: agentTypingFading ? 'translateY(10px) scale(0.95)' : 'translateY(0) scale(1)',
                        transition: 'opacity 0.4s ease, transform 0.4s ease',
                    }}>
                        <div style={styles.msgAvatarSm}>{agentImage ? <img src={agentImage} alt={agentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : agentName.charAt(0)}</div>
                        <div style={{ ...styles.bubble, ...styles.ownerBubble, display: 'flex', gap: '4px', alignItems: 'center', padding: '10px 14px' }}>
                            <span className="lc-dot"/>
                            <span className="lc-dot"/>
                            <span className="lc-dot"/>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
            <div style={styles.inputArea}>
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
                <div style={styles.inputRow}>
                    <button style={styles.attachBtn} onClick={() => fileInputRef.current?.click()} disabled={sending} title="Attach image">
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
                        style={styles.textarea}
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={sending}
                    />
                    <button style={styles.sendBtn} onClick={handleSend} disabled={(!inputValue.trim() && !selectedImage) || sending}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LiveChatPage() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Loading...</div>}>
            <LiveChatContent />
        </Suspense>
    );
}
