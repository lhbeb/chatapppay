import { NextResponse } from 'next/server';

const BOT_TOKEN = '8852380612:AAEeSSVmxFNfvAJUu73R4Wz-YJZOfRMaBD0'; // New bot token
const CHAT_ID = '-5493972721'; 

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function POST(request) {
    try {
        let sessionId, message, email, siteUrl, agentName, isSystemEvent, isWidgetOpen;
        let imageFile = null;

        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            sessionId = formData.get('sessionId');
            message = formData.get('message') || '';
            email = formData.get('email') || '';
            siteUrl = formData.get('siteUrl') || '';
            agentName = formData.get('agentName') || '';
            isSystemEvent = formData.get('isSystemEvent') === 'true';
            isWidgetOpen = formData.get('isWidgetOpen') === 'true';
            imageFile = formData.get('image'); // File object
        } else {
            const json = await request.json();
            sessionId = json.sessionId;
            message = json.message || '';
            email = json.email || '';
            siteUrl = json.siteUrl || '';
            agentName = json.agentName || '';
            isSystemEvent = json.isSystemEvent;
            isWidgetOpen = json.isWidgetOpen;
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const safeEmail = escapeHtml(email || '');
        const safeMessage = escapeHtml(message || '');
        const safeSiteUrl = siteUrl || 'Unknown';
        const safeAgent = agentName || 'Support';

        let text = '';
        if (isWidgetOpen) {
            text = `WIDGET_MSG:${sessionId}\n\n👁️ <b>Widget Opened</b>\n🌐 <b>Website:</b> ${safeSiteUrl}\nSession <code>${sessionId}</code>\n\n<i>Visitor opened the chat — no email yet.</i>`;
        } else if (isSystemEvent) {
            text = `WIDGET_MSG:${sessionId}\n\n🔔 <b>Live Chat Started</b>\n👩‍💼 <b>Agent:</b> ${safeAgent}\n📧 <b>Email:</b> ${safeEmail}\n🌐 <b>Website:</b> ${safeSiteUrl}\nSession <code>${sessionId}</code>`;
        } else {
            text = `WIDGET_MSG:${sessionId}\n\n💬 <b>Live Chat</b>\n👩‍💼 <b>Agent:</b> ${safeAgent}\n📧 <b>From:</b> ${safeEmail}\n🌐 <b>Website:</b> ${safeSiteUrl}\nSession <code>${sessionId}</code>`;
            if (safeMessage) {
                text += `\n\n${safeMessage}`;
            }
        }

        let telegramRes;

        if (imageFile && imageFile.size > 0) {
            const tgFormData = new FormData();
            tgFormData.append('chat_id', CHAT_ID);
            tgFormData.append('photo', imageFile);
            tgFormData.append('caption', text);
            tgFormData.append('parse_mode', 'HTML');

            telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: tgFormData
            });
        } else {
            telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text,
                    parse_mode: 'HTML',
                }),
            });
        }

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
