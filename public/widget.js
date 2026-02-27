/**
 * Chat Widget — Inline Embed
 *
 * Place this inside your HTML where you want the chat to appear:
 *
 *   <div id="chat-widget" style="width:100%; height:600px;"></div>
 *
 *   <script
 *     src="https://your-chat.vercel.app/widget.js"
 *     data-chat-url="https://your-chat.vercel.app"
 *     data-target="#chat-widget"
 *     data-customer-name="John Doe"
 *     data-customer-email="john@example.com"
 *     data-order-id="ORD-12345"
 *     data-order-total="$7.50"
 *   ></script>
 */

(function () {
    'use strict';

    const scriptTag = document.currentScript ||
        Array.from(document.querySelectorAll('script[data-chat-url]')).pop();

    const CHAT_URL = (scriptTag && scriptTag.getAttribute('data-chat-url')) || window.location.origin;
    const TARGET = (scriptTag && scriptTag.getAttribute('data-target')) || null;
    const NAME = (scriptTag && scriptTag.getAttribute('data-customer-name')) || '';
    const EMAIL = (scriptTag && scriptTag.getAttribute('data-customer-email')) || '';
    const ORDER_ID = (scriptTag && scriptTag.getAttribute('data-order-id')) || '';
    const ORDER_TOTAL = (scriptTag && scriptTag.getAttribute('data-order-total')) || '';

    // Build iframe src with context as query params
    const params = new URLSearchParams();
    if (NAME) params.set('name', NAME);
    if (EMAIL) params.set('email', EMAIL);
    if (ORDER_ID) params.set('orderId', ORDER_ID);
    if (ORDER_TOTAL) params.set('total', ORDER_TOTAL);

    const chatSrc = CHAT_URL + (params.toString() ? '?' + params.toString() : '');

    // Create the iframe
    const iframe = document.createElement('iframe');
    iframe.src = chatSrc;
    iframe.title = 'Live Chat Support';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.cssText = 'width:100%; height:100%; border:none; display:block;';

    // Find target container and inject
    const container = TARGET ? document.querySelector(TARGET) : null;

    if (container) {
        // Inline mode — fill the target div exactly
        container.style.overflow = 'hidden';
        container.appendChild(iframe);
    } else {
        // Fallback — fill the body (full page)
        document.body.style.margin = '0';
        iframe.style.position = 'fixed';
        iframe.style.inset = '0';
        iframe.style.zIndex = '99999';
        document.body.appendChild(iframe);
    }

    // Public API
    window.HFChat = {
        // Programmatically pass extra context after load
        sendContext: function (data) {
            iframe.contentWindow.postMessage({ type: 'HF_CONTEXT', ...data }, CHAT_URL);
        }
    };

})();
