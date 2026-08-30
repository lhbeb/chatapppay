import { NextResponse } from 'next/server';

const BOT_TOKEN = '8852380612:AAEeSSVmxFNfvAJUu73R4Wz-YJZOfRMaBD0';
const BOT_ID = 8852380612;
const CHAT_ID = '-5493972721';

function extractSessionIdFromBotMsg(text) {
    if (!text) return null;
    const match = text.match(/^WIDGET_MSG:([A-Z0-9]+)/);
    return match ? match[1] : null;
}

function parseFreePrefixReply(text) {
    if (!text) return null;
    const match = text.match(/^([A-Z0-9]{5,8})[:\\s]+(.+)/s);
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

            // Only process messages from the target chat ID (if it's a group, id matches CHAT_ID)
            if (String(msg.chat.id) !== String(CHAT_ID)) continue;

            if (msg.from?.id === BOT_ID) continue;
            if (msg.text.startsWith('/')) continue;
            if (msg.text.startsWith('WIDGET_MSG') || msg.text.startsWith('CHATBOT_MSG')) continue;

            let replyText = null;

            const replyToText = msg.reply_to_message?.text;
            if (replyToText) {
                const repliedSession = extractSessionIdFromBotMsg(replyToText);
                if (repliedSession === sessionId) {
                    replyText = msg.text;
                }
            }

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
