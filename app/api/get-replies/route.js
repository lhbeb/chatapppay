// GET /api/get-replies?sessionId=xxx&lastUpdateId=0
// Polls Telegram for owner replies — skips visitor messages forwarded by the bot
import { NextResponse } from 'next/server';

const BOT_TOKEN = '8695107065:AAGOpachFMkHiyVnJtvjOkkXjvT1tyW1hOE';
const BOT_ID = 8695107065; // The bot's own user ID — messages sent BY the bot are ignored

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');
        const lastUpdateId = parseInt(searchParams.get('lastUpdateId') || '0', 10);

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        // Fetch new updates from Telegram
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

            const text = msg.text;
            const fromId = msg.from?.id;

            // Skip messages sent BY the bot itself
            if (fromId === BOT_ID) continue;

            // Skip visitor messages forwarded by the bot (they contain our unique marker)
            if (text.startsWith('CHATBOT_MSG')) continue;

            // Skip bot commands
            if (text.startsWith('/')) continue;

            // This is a genuine owner reply
            replies.push({
                id: update.update_id,
                text,
                timestamp: msg.date * 1000,
            });
        }

        return NextResponse.json({ replies, lastUpdateId: newLastUpdateId });
    } catch (err) {
        console.error('get-replies error:', err);
        return NextResponse.json({ replies: [], error: err.message });
    }
}
