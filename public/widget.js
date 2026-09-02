/**
 * Chat Widget — Inline Embed (dynamic-injection compatible)
 *
 * USAGE — set window.HFChatConfig before loading this script:
 *
 *   window.HFChatConfig = {
 *     chatUrl:        'https://chatapppay-rust.vercel.app',
 *     target:         '#chat-widget',       // CSS selector of the mount div
 *     customerName:   'John Doe',
 *     customerEmail:  'john@example.com',
 *     orderId:        'ORD-12345',
 *     total:          '$7.50',
 *     welcomeMessage: 'Thank you for your order! ...',  // optional override
 *   };
 *   // Then load this script:
 *   const s = document.createElement('script');
 *   s.src = 'https://chatapppay-rust.vercel.app/widget.js';
 *   document.body.appendChild(s);
 *
 * OR — plain HTML (synchronous load):
 *   <script src="https://chatapppay-rust.vercel.app/widget.js"
 *     data-chat-url="https://chatapppay-rust.vercel.app"
 *     data-target="#chat-widget"
 *     data-customer-name="John Doe"
 *     data-customer-email="john@example.com"
 *     data-order-id="ORD-12345"
 *     data-order-total="$7.50"
 *     data-welcome-message="Thank you for your order! ...">
 *   </script>
 */

(function () {
    'use strict';

    // ── Read config: window.HFChatConfig (dynamic) > script data-* (static) ──────
    const cfg = window.HFChatConfig || {};

    // Fallback to script tag data attributes (synchronous load)
    const scriptTag = document.currentScript ||
        Array.from(document.querySelectorAll('script[data-chat-url]')).pop();

    function attr(key) {
        return scriptTag ? scriptTag.getAttribute(key) : null;
    }

    const CHAT_URL = cfg.chatUrl || attr('data-chat-url') || window.location.origin;
    const TARGET = cfg.target || attr('data-target') || null;
    const NAME = cfg.customerName || attr('data-customer-name') || '';
    const EMAIL = cfg.customerEmail || attr('data-customer-email') || '';
    const ORDER_ID = cfg.orderId || attr('data-order-id') || '';
    const ORDER_TOTAL = cfg.total || attr('data-order-total') || '';
    const ITEM_NAME = cfg.itemName || attr('data-item-name') || '';
    const ADDRESS = cfg.address || attr('data-address') || '';
    const WELCOME_MSG = cfg.welcomeMessage || attr('data-welcome-message') || '';
    const SITE_URL = cfg.siteUrl || attr('data-site-url') || window.location.href;
    const SITE_NAME = cfg.siteName || cfg.brandName || attr('data-site-name') || attr('data-brand-name') || '';

    // Build iframe src with context as query params
    const params = new URLSearchParams();
    if (NAME) params.set('name', NAME);
    if (EMAIL) params.set('email', EMAIL);
    if (ORDER_ID) params.set('orderId', ORDER_ID);
    if (ORDER_TOTAL) params.set('total', ORDER_TOTAL);
    if (ITEM_NAME) params.set('itemName', ITEM_NAME);
    if (ADDRESS) params.set('address', ADDRESS);
    if (WELCOME_MSG) params.set('welcomeMessage', WELCOME_MSG);
    if (SITE_NAME) params.set('siteName', SITE_NAME);
    if (SITE_URL) params.set('siteUrl', SITE_URL);

    const chatSrc = CHAT_URL + (params.toString() ? '?' + params.toString() : '');

    // Create the iframe
    const iframe = document.createElement('iframe');
    iframe.src = chatSrc;
    iframe.title = 'Live Chat Support';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';

    // Find target container and inject
    const container = TARGET ? document.querySelector(TARGET) : null;

    if (container) {
        container.style.overflow = 'hidden';
        container.appendChild(iframe);
    } else {
        // Fallback: full page
        document.body.style.margin = '0';
        iframe.style.cssText += 'position:fixed;inset:0;z-index:99999;';
        document.body.appendChild(iframe);
    }

    window.HFChat = {
        sendContext: function (data) {
            iframe.contentWindow?.postMessage({ type: 'HF_CONTEXT', ...data }, CHAT_URL);
        }
    };

})();
