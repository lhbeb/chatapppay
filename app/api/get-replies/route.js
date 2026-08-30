// GET /api/get-replies?sessionId=xxx&lastUpdateId=0
// Supports two reply methods:
//
// Method A (preferred): Use Telegram's "Reply" on a visitor message
//   → auto-routed via reply_to_message
//
// Method B (quick): Type the session ID + colon + message freely in the group
//   → format: "AB12XYZ: your reply here"
//   → The session ID is shown in every bot message so it's always visible

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = '8695107065:AAGOpachFMkHiyVnJtvjOkkXjvT1tyW1hOE';
const BOT_ID = 8695107065;

// Extract session ID embedded in the bot's message text (CHATBOT_MSG:{sessionId})
function extractSessionIdFromBotMsg(text) {
    if (!text) return null;
    const match = text.match(/^CHATBOT_MSG:([A-Z0-9]+)/);
    return match ? match[1] : null;
}

// Extract session ID + reply text from a free-typed message (AB12XYZ: your reply)
function parseFreePrefixReply(text) {
    if (!text) return null;
    const match = text.match(/^([A-Z0-9]{5,8})[:\s]+(.+)/s);
    return match ? { sessionId: match[1], reply: match[2].trim() } : null;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');
        const lastUpdateId = parseInt(searchParams.get('lastUpdateId') || '0', 10);

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0;
        const telegramRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&limit=100&timeout=0`,
            { cache: 'no-store' }
        );

        const data = await telegramRes.json();

        if (!data.ok) {
            return NextResponse.json({ replies: [], lastUpdateId });
        }

        const replies = [];
        let newLastUpdateId = lastUpdateId;

        for (const update of data.result) {
            if (update.update_id > newLastUpdateId) {
                newLastUpdateId = update.update_id;
            }

            const msg = update.message;
            if (!msg || !msg.text) continue;

            // Skip messages from the bot itself
            if (msg.from?.id === BOT_ID) continue;

            // Skip bot commands
            if (msg.text.startsWith('/')) continue;

            // Skip visitor messages forwarded by the bot
            if (msg.text.startsWith('CHATBOT_MSG')) continue;

            let replyText = null;

            // ── Method A: Telegram Reply threading (owner used Reply on a visitor msg) ──
            const replyToText = msg.reply_to_message?.text;
            if (replyToText) {
                const repliedSession = extractSessionIdFromBotMsg(replyToText);
                if (repliedSession === sessionId) {
                    replyText = msg.text;
                }
            }

            // ── Method B: Free prefix typing — "AB12XYZ: your message here" ────────────
            if (!replyText) {
                const parsed = parseFreePrefixReply(msg.text);
                if (parsed && parsed.sessionId === sessionId) {
                    replyText = parsed.reply;
                }
            }

            if (replyText) {
                replies.push({
                    id: update.update_id,
                    text: replyText,
                    timestamp: msg.date * 1000,
                });
            }
        }

        return NextResponse.json({ replies, lastUpdateId: newLastUpdateId });
    } catch (err) {
        console.error('get-replies error:', err);
        return NextResponse.json({ replies: [], error: err.message });
    }
}
