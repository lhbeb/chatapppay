// POST /api/send-message
// Receives a visitor message and forwards it to Telegram
import { NextResponse } from 'next/server';

const BOT_TOKEN = '8695107065:AAGOpachFMkHiyVnJtvjOkkXjvT1tyW1hOE';
const CHAT_ID = '-1003612880977'; // Paypalbot supergroup (upgraded when bot became admin)

// Escape special HTML characters to prevent formatting issues
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function POST(request) {
    try {
        const { sessionId, message, username } = await request.json();

        if (!message || !sessionId) {
            return NextResponse.json({ error: 'Missing message or sessionId' }, { status: 400 });
        }

        const displayName = escapeHtml(username || 'Visitor');
        const safeMessage = escapeHtml(message);

        // Use a unique marker string so we can reliably filter these out in get-replies
        const text = `CHATBOT_MSG\n\n💬 <b>Live Chat Message</b>\n👤 <b>From:</b> ${displayName}\n🔑 <b>Session:</b> <code>${sessionId}</code>\n\n${safeMessage}`;

        const telegramRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text,
                    parse_mode: 'HTML',
                }),
            }
        );

        const data = await telegramRes.json();

        if (!data.ok) {
            console.error('Telegram error:', data);
            return NextResponse.json({ error: 'Failed to send to Telegram', details: data }, { status: 500 });
        }

        return NextResponse.json({ success: true, telegram_message_id: data.result.message_id });
    } catch (err) {
        console.error('send-message error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
