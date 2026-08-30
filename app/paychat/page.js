'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

function generateSessionId() {
    return Math.random().toString(36).slice(2, 9).toUpperCase();
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PayChatPage() {
    const searchParams = useSearchParams();
    const themeColor = searchParams.get('color') || '#0070ba'; // PayPal blue default
    const siteUrl    = searchParams.get('siteUrl') || '';
    const agentLabel = searchParams.get('agent') || 'Support Agent';

    let displayDomain = 'PayPal Support';
    try {
        if (siteUrl) {
            const hostname = new URL(decodeURIComponent(siteUrl)).hostname;
            displayDomain = `${hostname} · Support`;
        }
    } catch (e) {}

    const [sessionId, setSessionId]       = useState(null);
    const [messages, setMessages]         = useState([]);
    const [inputValue, setInputValue]     = useState('');
    const [sending, setSending]           = useState(false);
    const [lastUpdateId, setLastUpdateId] = useState(0);

    const messagesEndRef  = useRef(null);
    const pollingRef      = useRef(null);

    useEffect(() => {
        let sid = localStorage.getItem('paychat_session_id');
        const savedMessages  = localStorage.getItem('paychat_messages_' + sid);
        const savedUpdateId  = localStorage.getItem('paychat_last_update_id_' + sid);

        if (!sid) {
            sid = generateSessionId();
            localStorage.setItem('paychat_session_id', sid);
        }
        setSessionId(sid);

        if (savedUpdateId) setLastUpdateId(parseInt(savedUpdateId, 10));

        if (savedMessages) {
            try { setMessages(JSON.parse(savedMessages)); } catch (e) {}
        } else {
            setMessages([{
                id: 'welcome',
                role: 'owner',
                text: `Hi there! 👋 How can we help you today?`,
                timestamp: Date.now()
            }]);
        }

        // Notify Telegram once per session
        const notifiedKey = 'paychat_opened_' + sid;
        if (!localStorage.getItem(notifiedKey)) {
            localStorage.setItem(notifiedKey, '1');
            fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sid,
                    message: `👁️ Widget Opened\n🌐 Website: ${siteUrl || 'Unknown'}`,
                    username: 'Visitor',
                }),
            }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (sessionId && messages.length > 0) {
            localStorage.setItem('paychat_messages_' + sessionId, JSON.stringify(messages));
        }
    }, [messages, sessionId]);

    const pollReplies = useCallback(async () => {
        if (!sessionId) return;
        try {
            const res  = await fetch(`/api/get-replies?sessionId=${sessionId}&lastUpdateId=${lastUpdateId}`);
            const data = await res.json();

            if (data.replies && data.replies.length > 0) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newReplies  = data.replies.filter(r => !existingIds.has('owner-' + r.id));
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
                localStorage.setItem('paychat_last_update_id_' + sessionId, String(data.lastUpdateId));
            }
        } catch (e) {}
    }, [sessionId, lastUpdateId]);

    useEffect(() => {
        if (!sessionId) return;
        pollingRef.current = setInterval(pollReplies, 3000);
        return () => clearInterval(pollingRef.current);
    }, [sessionId, pollReplies]);

    const handleSend = async () => {
        const text = inputValue.trim();
        if (!text || sending) return;

        setSending(true);
        setInputValue('');

        const newMsg = { id: 'v-' + Date.now(), role: 'visitor', text, timestamp: Date.now() };
        setMessages(prev => [...prev, newMsg]);

        try {
            await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: text,
                    username: 'Visitor',
                }),
            });
        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // ── Styles ──────────────────────────────────────────────────────────────
    const s = {
        container:    { display:'flex', flexDirection:'column', height:'100%', fontFamily:'system-ui,-apple-system,sans-serif', backgroundColor:'#f9fafb', color:'#111827' },
        header:       { backgroundColor: themeColor, color:'white', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
        avatar:       { width:'38px', height:'38px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'1rem', flexShrink:0, border:'2px solid rgba(255,255,255,0.5)' },
        agentInfo:    { flex:1 },
        agentName:    { fontWeight:'700', fontSize:'0.95rem', lineHeight:1.2 },
        agentStatus:  { fontSize:'0.75rem', opacity:0.85, display:'flex', alignItems:'center', gap:'4px' },
        onlineDot:    { width:'7px', height:'7px', borderRadius:'50%', backgroundColor:'#4ade80', display:'inline-block' },
        messagesArea: { flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px', backgroundColor:'#fff' },
        msgRow:       { display:'flex', flexDirection:'row', alignItems:'flex-end', gap:'8px', marginBottom:'4px' },
        ownerRow:     { justifyContent:'flex-start' },
        visitorRow:   { justifyContent:'flex-end' },
        msgAvatar:    { width:'28px', height:'28px', borderRadius:'50%', backgroundColor: themeColor, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'0.75rem', flexShrink:0 },
        msgGroup:     { display:'flex', flexDirection:'column', maxWidth:'72%' },
        bubble:       { padding:'10px 14px', borderRadius:'16px', wordBreak:'break-word', fontSize:'0.9rem', lineHeight:'1.45', display:'inline-block' },
        visitorBubble:{ backgroundColor: themeColor, color:'white', borderBottomRightRadius:'2px' },
        ownerBubble:  { backgroundColor:'#f3f4f6', color:'#1f2937', borderBottomLeftRadius:'2px' },
        time:         { fontSize:'0.72rem', color:'#9ca3af', marginTop:'3px' },
        inputArea:    { display:'flex', padding:'12px', backgroundColor:'white', borderTop:'1px solid #e5e7eb', gap:'8px', alignItems:'flex-end' },
        textarea:     { flex:1, resize:'none', padding:'10px', borderRadius:'8px', border:'1px solid #d1d5db', outline:'none', fontFamily:'inherit', fontSize:'0.95rem', maxHeight:'100px', boxSizing:'border-box' },
        sendBtn:      { backgroundColor: themeColor, color:'white', border:'none', borderRadius:'50%', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
    };

    return (
        <div style={s.container}>
            <div style={s.header}>
                <div style={s.avatar}>S</div>
                <div style={s.agentInfo}>
                    <div style={s.agentName}>{agentLabel}</div>
                    <div style={s.agentStatus}>
                        <span style={s.onlineDot}/> Online · {displayDomain}
                    </div>
                </div>
            </div>

            <div style={s.messagesArea}>
                {messages.map((msg) => (
                    <div key={msg.id} style={{ ...s.msgRow, ...(msg.role === 'visitor' ? s.visitorRow : s.ownerRow) }}>
                        {msg.role === 'owner' && <div style={s.msgAvatar}>S</div>}
                        <div style={s.msgGroup}>
                            <div style={{ ...s.bubble, ...(msg.role === 'visitor' ? s.visitorBubble : s.ownerBubble) }}>
                                {msg.text}
                            </div>
                            <span style={{ ...s.time, textAlign: msg.role === 'visitor' ? 'right' : 'left' }}>
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={s.inputArea}>
                <textarea
                    style={s.textarea}
                    placeholder="Type a message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={sending}
                />
                <button style={s.sendBtn} onClick={handleSend} disabled={!inputValue.trim() || sending}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}
