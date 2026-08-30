/**
 * paychat.js — Embeddable PayPal Chat Widget
 *
 * Drop this script on any website to add a floating support chat
 * that routes messages to your Telegram group via your PayPal bot.
 *
 * Usage:
 *   <script
 *     src="https://yourdomain.com/paychat.js"
 *     data-color="#0070ba"
 *     data-position="bottom-right"
 *     data-button-size="60"
 *     data-label="Chat with us!"
 *     data-agent="Support Agent"
 *   ></script>
 *
 * Attributes:
 *   data-color        — Brand hex color  (default: #0070ba)
 *   data-position     — bottom-right | bottom-left | top-right | top-left  (default: bottom-right)
 *   data-button-size  — Button diameter in px  (default: 60)
 *   data-label        — Tooltip text  (default: "Chat with us!")
 *   data-agent        — Agent display name shown in chat header  (default: "Support Agent")
 */
(function() {
    if (window.PayChatWidgetInitialized) return;
    window.PayChatWidgetInitialized = true;

    // ── Read <script> tag config ─────────────────────────────────────────────
    let scriptEl = null;
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.includes('paychat.js')) {
            scriptEl = scripts[i]; break;
        }
    }
    if (!scriptEl && document.currentScript) scriptEl = document.currentScript;

    function cfg(attr, fallback) {
        return (scriptEl && scriptEl.getAttribute(attr)) || fallback;
    }

    const brandColor   = cfg('data-color',       '#0070ba');
    const position     = cfg('data-position',    'bottom-right');
    const buttonSize   = parseInt(cfg('data-button-size', '60'), 10);
    const tooltipLabel = cfg('data-label',       'Chat with us!');
    const agentName    = cfg('data-agent',       'Support Agent');

    // Resolve base URL
    let baseUrl = window.location.origin;
    if (scriptEl && scriptEl.src) {
        try { baseUrl = new URL(scriptEl.src).origin; } catch (e) {}
    }

    // ── Position helpers ─────────────────────────────────────────────────────
    const isRight  = position.includes('right');
    const isBottom = position.includes('bottom');
    const flexAlign = isRight ? 'flex-end' : 'flex-start';
    const transformOrigin = `${isBottom ? 'bottom' : 'top'} ${isRight ? 'right' : 'left'}`;

    const tooltipPopIn  = isRight
        ? '0%{opacity:0;transform:scale(0.7) translateX(10px)} 60%{transform:scale(1.05) translateX(0)} 100%{opacity:1;transform:scale(1) translateX(0)}'
        : '0%{opacity:0;transform:scale(0.7) translateX(-10px)} 60%{transform:scale(1.05) translateX(0)} 100%{opacity:1;transform:scale(1) translateX(0)}';
    const tooltipPopOut = isRight
        ? '0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.7) translateX(10px)}'
        : '0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.7) translateX(-10px)}';

    // ── Styles ───────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pc-pop-in  { ${tooltipPopIn}  }
        @keyframes pc-pop-out { ${tooltipPopOut} }
        @keyframes pc-pulse   { 0%,100%{box-shadow:0 4px 12px rgba(0,0,0,.15)} 50%{box-shadow:0 4px 24px rgba(0,0,0,.3)} }

        #pc-container {
            position: fixed;
            ${isRight ? 'right' : 'left'}: 20px;
            ${isBottom ? 'bottom' : 'top'}: 20px;
            z-index: 2147483647;
            font-family: system-ui,-apple-system,sans-serif;
            display: flex;
            flex-direction: column;
            align-items: ${flexAlign};
            gap: 10px;
        }
        #pc-tooltip {
            background: #1f2937;
            color: #fff;
            padding: 8px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,.2);
        }
        #pc-tooltip.show { animation: pc-pop-in  .4s cubic-bezier(.34,1.56,.64,1) forwards; }
        #pc-tooltip.hide { animation: pc-pop-out .3s ease forwards; }
        #pc-tooltip .pc-dot { width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0; }

        #pc-btn {
            width: ${buttonSize}px;
            height: ${buttonSize}px;
            border-radius: 50%;
            background: ${brandColor};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform .2s;
            border: none;
            outline: none;
            animation: pc-pulse 2.5s ease-in-out infinite;
            box-shadow: 0 4px 12px rgba(0,0,0,.2);
        }
        #pc-btn:hover { transform: scale(1.08); }
        #pc-btn svg   { width: ${Math.round(buttonSize * 0.5)}px; height: ${Math.round(buttonSize * 0.5)}px; fill: #fff; }

        #pc-iframe-wrap {
            position: absolute;
            ${isRight  ? 'right'  : 'left'  }: 0;
            ${isBottom ? 'bottom' : 'top'   }: ${buttonSize + 20}px;
            width: 350px;
            height: 550px;
            max-height: calc(100vh - ${buttonSize + 40}px);
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,.15);
            overflow: hidden;
            border: 1px solid #eaeaea;
            transform-origin: ${transformOrigin};
            opacity: 0;
            transform: translateY(${isBottom ? '20px' : '-20px'});
            transition: opacity .3s ease, transform .3s ease;
            display: none;
        }
        #pc-iframe-wrap.open { display: block; opacity: 1; transform: translateY(0); }
        #pc-iframe { width:100%; height:100%; border:none; display:block; }
        @media (max-width:400px) { #pc-iframe-wrap { width:calc(100vw - 40px); } }
    `;
    document.head.appendChild(style);

    // ── DOM ──────────────────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'pc-container';

    const iframeWrap = document.createElement('div');
    iframeWrap.id = 'pc-iframe-wrap';

    const iframe = document.createElement('iframe');
    iframe.id = 'pc-iframe';
    iframe.src = `${baseUrl}/paychat?color=${encodeURIComponent(brandColor)}&siteUrl=${encodeURIComponent(window.location.href)}&agent=${encodeURIComponent(agentName)}`;
    iframeWrap.appendChild(iframe);

    const tooltip = document.createElement('div');
    tooltip.id = 'pc-tooltip';
    tooltip.innerHTML = `<span class="pc-dot"></span>${tooltipLabel}`;
    tooltip.style.display = 'none';

    const btn = document.createElement('button');
    btn.id = 'pc-btn';
    btn.setAttribute('aria-label', 'Open support chat');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';

    // ── Tooltip logic ────────────────────────────────────────────────────────
    let isOpen = false, tooltipVisible = false, dismissed = false, tipTimer = null;

    function showTooltip() {
        if (isOpen || dismissed) return;
        tooltip.style.display = 'flex';
        tooltip.classList.remove('hide');
        tooltip.classList.add('show');
        tooltipVisible = true;
        clearTimeout(tipTimer);
        tipTimer = setTimeout(() => hideTooltip(false), 4000);
    }

    function hideTooltip(permanent) {
        if (!tooltipVisible) return;
        if (permanent) dismissed = true;
        tooltip.classList.remove('show');
        tooltip.classList.add('hide');
        setTimeout(() => {
            tooltip.style.display = 'none';
            tooltip.classList.remove('hide');
            tooltipVisible = false;
        }, 300);
    }

    tooltip.addEventListener('click', () => hideTooltip(true));
    setTimeout(showTooltip, 2000);
    setInterval(() => { if (!isOpen && !dismissed) showTooltip(); }, 20000);

    // ── Toggle ───────────────────────────────────────────────────────────────
    const iconChat  = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    const iconClose = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

    btn.addEventListener('click', () => {
        hideTooltip(true);
        isOpen = !isOpen;
        if (isOpen) {
            iframeWrap.classList.add('open');
            btn.innerHTML = iconClose;
            btn.style.animation = 'none';
        } else {
            iframeWrap.classList.remove('open');
            btn.innerHTML = iconChat;
            btn.style.animation = 'pc-pulse 2.5s ease-in-out infinite';
        }
    });

    container.appendChild(iframeWrap);
    container.appendChild(tooltip);
    container.appendChild(btn);
    document.body.appendChild(container);
})();
