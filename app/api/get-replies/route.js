// GET /api/get-replies?sessionId=xxx&lastUpdateId=0
// Returns only replies that the owner sent by using Telegram's "Reply" feature
// on a message belonging to this specific session — zero-database multi-session routing
import { NextResponse } from 'next/server';

const BOT_TOKEN = '8695107065:AAGOpachFMkHiyVnJtvjOkkXjvT1tyW1hOE';
const BOT_ID = 8695107065;

// Extract the session ID embedded in a bot-sent message text
function extractSessionId(text) {
    if (!text) return null;
    const match = text.match(/^CHATBOT_MSG:([A-Z0-9]+)/);
    return match ? match[1] : null;
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

            // Skip messages sent by the bot itself
            if (msg.from?.id === BOT_ID) continue;

            // Skip bot commands
            if (msg.text.startsWith('/')) continue;

            // Skip visitor messages forwarded by the bot (they start with CHATBOT_MSG)
            if (msg.text.startsWith('CHATBOT_MSG')) continue;

            // ── Multi-session routing ──────────────────────────────────────────────
            // Only accept replies where the owner used Telegram's "Reply" feature
            // on a bot message, AND that message belongs to this session
            const replyToText = msg.reply_to_message?.text;
            if (!replyToText) continue; // Must be a reply, not a free message

            const repliedSessionId = extractSessionId(replyToText);
            if (repliedSessionId !== sessionId) continue; // Wrong session

            replies.push({
                id: update.update_id,
                text: msg.text,
                timestamp: msg.date * 1000,
            });
        }

        return NextResponse.json({ replies, lastUpdateId: newLastUpdateId });
    } catch (err) {
        console.error('get-replies error:', err);
        return NextResponse.json({ replies: [], error: err.message });
    }
}
