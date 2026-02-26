// GET /api/setup
// One-time helper: discovers your Telegram chat_id by reading recent messages sent to the bot
import { NextResponse } from 'next/server';

const BOT_TOKEN = '8695107065:AAGOpachFMkHiyVnJtvjOkkXjvT1tyW1hOE';

export async function GET() {
    try {
        // Get bot info
        const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const meData = await meRes.json();

        // Get recent updates
        const updatesRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=50`);
        const updatesData = await updatesRes.json();

        if (!updatesData.ok) {
            return NextResponse.json({
                error: 'Failed to get updates. Make sure you have sent at least one message to the bot on Telegram first.',
                botInfo: meData.result,
            });
        }

        const uniqueChats = [];
        const seen = new Set();
        for (const update of updatesData.result) {
            const msg = update.message || update.channel_post;
            if (msg?.chat?.id && !seen.has(msg.chat.id)) {
                seen.add(msg.chat.id);
                uniqueChats.push({
                    chatId: msg.chat.id,
                    type: msg.chat.type,
                    username: msg.chat.username,
                    firstName: msg.chat.first_name,
                });
            }
        }

        return NextResponse.json({
            success: true,
            botInfo: meData.result,
            instruction: 'Copy YOUR chatId below (the one where you messaged the bot) and add it to .env.local as TELEGRAM_CHAT_ID=<chatId>',
            foundChats: uniqueChats,
        });
    } catch (err) {
        console.error('setup error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
