'use client';

import { useEffect } from 'react';

export default function TestLiveChatPage() {
    useEffect(() => {
        if (window.LiveChatWidgetInitialized) return;
        window.LiveChatWidgetInitialized = true;

        const brandColor = '#e63946';
        const baseUrl = window.location.origin;
        const siteUrl = encodeURIComponent(window.location.href);

        const container = document.createElement('div');
        container.id = 'livechat-widget-container';

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes livechat-pop-in {
                0%   { opacity: 0; transform: scale(0.7) translateX(-10px); }
                60%  { transform: scale(1.05) translateX(0); }
                100% { opacity: 1; transform: scale(1) translateX(0); }
            }
            @keyframes livechat-pop-out {
                0%   { opacity: 1; transform: scale(1); }
                100% { opacity: 0; transform: scale(0.7) translateX(-10px); }
            }
            @keyframes livechat-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                50%       { box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
            }
            #livechat-widget-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
            }
            #livechat-tooltip {
                background: #1f2937;
                color: white;
                padding: 8px 14px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                animation: livechat-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
            }
            #livechat-tooltip.hiding { animation: livechat-pop-out 0.3s ease forwards; }
            #livechat-tooltip .tooltip-dot {
                width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0;
            }
            #livechat-widget-button {
                width: 60px; height: 60px; border-radius: 50%;
                background-color: ${brandColor};
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: transform 0.2s; border: none; outline: none;
                animation: livechat-pulse 2.5s ease-in-out infinite;
            }
            #livechat-widget-button:hover { transform: scale(1.08); }
            #livechat-widget-button svg { width: 30px; height: 30px; fill: #ffffff; }
            #livechat-widget-iframe-container {
                position: absolute; bottom: 80px; right: 0;
                width: 350px; height: 550px; max-height: calc(100vh - 100px);
                background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                overflow: hidden; display: none; flex-direction: column;
                border: 1px solid #eaeaea;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0; transform: translateY(20px); transform-origin: bottom right;
            }
            #livechat-widget-iframe-container.open { display: flex; opacity: 1; transform: translateY(0); }
            #livechat-widget-iframe { width: 100%; height: 100%; border: none; }
        `;
        document.head.appendChild(style);

        const iframeContainer = document.createElement('div');
        iframeContainer.id = 'livechat-widget-iframe-container';

        const iframe = document.createElement('iframe');
        iframe.id = 'livechat-widget-iframe';
        iframe.src = `${baseUrl}/livechat?color=${encodeURIComponent(brandColor)}&siteUrl=${siteUrl}`;
        iframeContainer.appendChild(iframe);

        const tooltip = document.createElement('div');
        tooltip.id = 'livechat-tooltip';
        tooltip.innerHTML = '<span class="tooltip-dot"></span> Live Chat!';
        tooltip.style.display = 'none';

        const button = document.createElement('button');
        button.id = 'livechat-widget-button';
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';

        let isOpen = false, tooltipVisible = false, dismissed = false;
        let tooltipTimer = null;

        function showTooltip() {
            if (isOpen || dismissed) return;
            tooltip.style.display = 'flex';
            tooltip.classList.remove('hiding');
            tooltipVisible = true;
            clearTimeout(tooltipTimer);
            tooltipTimer = setTimeout(() => hideTooltip(false), 4000);
        }

        function hideTooltip(permanent) {
            if (!tooltipVisible) return;
            if (permanent) dismissed = true;
            tooltip.classList.add('hiding');
            setTimeout(() => { tooltip.style.display = 'none'; tooltip.classList.remove('hiding'); tooltipVisible = false; }, 300);
        }

        tooltip.addEventListener('click', () => hideTooltip(true));

        setTimeout(showTooltip, 2000);
        setInterval(() => { if (!isOpen && !dismissed) showTooltip(); }, 20000);

        button.addEventListener('click', () => {
            hideTooltip(true);
            isOpen = !isOpen;
            if (isOpen) {
                iframeContainer.classList.add('open');
                button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
                button.style.animation = 'none';
            } else {
                iframeContainer.classList.remove('open');
                button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
                button.style.animation = 'livechat-pulse 2.5s ease-in-out infinite';
            }
        });

        container.appendChild(iframeContainer);
        container.appendChild(tooltip);
        container.appendChild(button);
        document.body.appendChild(container);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div style={{ textAlign: 'center', color: 'white' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '12px' }}>🧪 Live Chat Widget Test</h1>
                <p style={{ opacity: 0.85, fontSize: '1.1rem', marginBottom: '8px' }}>
                    The live chat widget is embedded on this page.
                </p>
                <p style={{ opacity: 0.7, fontSize: '0.95rem' }}>
                    Look at the <strong>bottom right corner</strong> 👉
                </p>
            </div>
        </div>
    );
}

