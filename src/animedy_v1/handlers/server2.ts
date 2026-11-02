import type { Context } from "hono";
import { logError } from "../../lib/errorlogger.js";

/**
 * Server 2 (AnimePahe) Ad-Free Proxy & Sanitizer Handler
 * Strips all external ad networks (seedilyspottle, fatihahfinings, histats, adsbygoogle),
 * destroys click-hijack / click-to-load overlays, neutralizes popups via window.open,
 * and enforces strict sandboxing on the inner player.
 */
export async function server2PlayerHandler(context: Context): Promise<Response> {
  const targetUrl = context.req.query("u");
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return context.text("Invalid or missing player URL", 400);
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://animepahe.ws/",
      },
    });

    if (!upstreamRes.ok) {
      return context.text("Failed to load player from upstream provider", 502);
    }

    let html = await upstreamRes.text();
    const origin = new URL(targetUrl).origin;

    // 1. Strip external ad network scripts & tracking loaders
    html = html.replace(
      /<script[^>]*src=["'][^"']*(seedilyspottle|fatihahfinings|statlytic|vitalickitten|llvpn|chatbro|doubleclick|popads|popcash|histats|onclickads|adserver|exoclick|juicyads|propeller|adsterra|clickadu|adcash|monetag|hilltopads|trafficjunky|pagead2|googlesyndication|gtag|google-analytics|adnxs|realsrv|tsyndicate|coinhive|yadro|vidoomy|adtrue|adreactor)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    );

    // 2. Strip inline scripts calling ad / tracking networks
    html = html.replace(
      /<script[^>]*>[\s\S]*?(seedilyspottle|fatihahfinings|statlytic|dataset\.zone|llvpn\.com|vitalickitten|onclickads|popads|adsterra|histats|_Hasync|pagead2|googlesyndication|adsbygoogle)[\s\S]*?<\/script>/gi,
      "",
    );

    // 3. Strip ad elements (<ins>, adsbygoogle, noscript tracking, prefetch links)
    html = html.replace(/<ins[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>[\s\S]*?<\/ins>/gi, "");
    html = html.replace(/<link[^>]*href=["'][^"']*(histats|seedilyspottle|fatihahfinings|googletagmanager|pagead2)[^"']*["'][^>]*>/gi, "");
    html = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");

    // 4. Strip click-to-load overlays and hidden traps completely
    html = html.replace(/<div[\s\S]*?id=["']click-to-load-box["'][\s\S]*?<\/div>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*click-to-load-overlay[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");

    // 5. Ensure #player-iframe is visible & sandboxed against popups
    html = html.replace(/<iframe([^>]*id=["']player-iframe["'][^>]*)>/gi, (match, attrs) => {
      let cleanAttrs = attrs
        .replace(/class=["']([^"']*)hidden([^"']*)["']/i, 'class="$1$2"')
        .replace(/style=["']([^"']*)display:\s*none;?([^"']*)["']/i, 'style="$1$2"');
      return `<iframe${cleanAttrs} style="display:block !important;" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation">`;
    });

    // 6. Inject the Multi-Layer AdBlock, Click-Trap & Anti-Adblock neutralization shield
        const adBlockShield = `
    <base href="${origin}/">
    <style>
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        overflow: hidden !important;
        background: #000 !important;
      }
      header, footer, nav, .site-header, .site-footer, .anime-player-info-card,
      .anime-player-meta, .announcement-banner, .comments, .sidebar, .popular-series,
      #popover-server, #popover-episodes, #popover-quality, #popover-download,
      .theatre-wrapper > *:not(#player-iframe):not(.player-active-iframe):not(#click-to-load-box),
      .theatre-player > *:not(#player-iframe):not(.player-active-iframe) {
        display: none !important;
      }
      #player-iframe, .player-active-iframe, .embed-responsive, .theatre-player, .player-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        z-index: 9999999 !important;
        border: none !important;
        border-radius: 0 !important;
        display: block !important;
        background: #000 !important;
      }
    </style>
    <script>
      (function() {
        // --- Layer 1: Popup & Opener Neutralizer ---
        var dummyWin = {
          closed: false,
          close: function() { this.closed = true; },
          focus: function() {},
          blur: function() {},
          postMessage: function() {},
          location: { href: '', replace: function() {}, assign: function() {} },
          document: { write: function() {}, close: function() {}, open: function() {} }
        };

        window.open = function(url) {
          console.warn("[AdBlock Layer 1] Blocked window.open popup:", url);
          return dummyWin;
        };
        try { Object.freeze(window.open); } catch(e) {}

        window.alert = function() { return null; };
        window.confirm = function() { return true; };
        window.prompt = function() { return null; };

        // --- Layer 2: Anti-Adblock Decoy ---
        window.canRunAds = true;
        window.adblock = false;
        window.isAdblock = false;
        window.adblockEnabled = false;
        window.hasAdBlock = false;
        window.google_ad_client = "ca-pub-1234567890";
        window.adsbygoogle = { push: function() {} };
        window.show_ad = function() {};
        window.popns = {};

        // --- Layer 3: Capturing-Phase Click Hijack Shield ---
        // Catches and kills click traps, popunders, and invisible layer taps before any ad listener fires
        function interceptClickHijack(e) {
          if (!e) return;

          // Block untrusted synthetic clicks generated by ad scripts
          if (e.isTrusted === false) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          var target = e.target;
          if (!target || !target.closest) return;

          // 1. Check if clicking on an anchor tag
          var link = target.closest('a');
          if (link) {
            var href = (link.getAttribute('href') || '').trim();
            var targetAttr = link.getAttribute('target');
            var isAdHref = /seedilyspottle|fatihahfinings|statlytic|clickadu|monetag|hilltopads|adsterra|doubleclick|histats/i.test(href);
            
            // If link points to ad network or has target="_blank" without being legitimate in-page navigation
            if (isAdHref || (targetAttr === '_blank' && !href.includes('animepahe.ws'))) {
              console.warn('[AdBlock Layer 3] Intercepted and blocked ad link click:', href);
              e.preventDefault();
              e.stopImmediatePropagation();
              return;
            }
          }

          // 2. Check for invisible / full-screen click trap overlays
          var el = target;
          while (el && el !== document.body && el !== document.documentElement) {
            var style = window.getComputedStyle(el);
            var z = parseInt(style.zIndex, 10);
            var pos = style.position;
            if ((pos === 'fixed' || pos === 'absolute') && z >= 99) {
              var rect = el.getBoundingClientRect();
              if (rect.width >= window.innerWidth * 0.6 && rect.height >= window.innerHeight * 0.6) {
                if (!el.querySelector('video') && !el.querySelector('iframe') && !el.classList.contains('theater-wrapper')) {
                  console.warn('[AdBlock Layer 3] Removed full-screen click trap on click:', el);
                  el.remove();
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  return;
                }
              }
            }
            el = el.parentElement;
          }
        }

        window.addEventListener('click', interceptClickHijack, true);
        window.addEventListener('mousedown', interceptClickHijack, true);
        window.addEventListener('pointerdown', interceptClickHijack, true);

        // --- Layer 4: Dynamic Script & Frame Insertion Interceptor ---
        var adPattern = /(seedilyspottle|fatihahfinings|statlytic|vitalickitten|llvpn|chatbro|popads|popcash|onclickads|adsterra|exoclick|juicyads|propeller|clickadu|adcash|monetag|hilltopads|trafficjunky|doubleclick|adnxs|statlytic|realsrv|tsyndicate|pagead2|adsbygoogle)/i;
        function isAdUrl(u) {
          return typeof u === 'string' && adPattern.test(u);
        }

        try {
          var origCreateElement = document.createElement;
          document.createElement = function(tagName) {
            var el = origCreateElement.apply(this, arguments);
            var tag = typeof tagName === 'string' ? tagName.toLowerCase() : '';
            if (tag === 'script') {
              var origSetAttribute = el.setAttribute;
              el.setAttribute = function(name, val) {
                if (name === 'src' && isAdUrl(val)) {
                  console.warn('[AdBlock Layer 4] Blocked script setAttribute:', val);
                  return;
                }
                return origSetAttribute.apply(this, arguments);
              };
              Object.defineProperty(el, 'src', {
                set: function(val) {
                  if (isAdUrl(val)) {
                    console.warn('[AdBlock Layer 4] Blocked script.src:', val);
                    return;
                  }
                  origSetAttribute.call(this, 'src', val);
                },
                get: function() { return this.getAttribute('src') || ''; }
              });
            } else if (tag === 'a') {
              var origClick = el.click;
              el.click = function() {
                var h = el.getAttribute('href') || '';
                if (isAdUrl(h) || el.target === '_blank') {
                  console.warn('[AdBlock Layer 4] Blocked synthetic link click:', h);
                  return;
                }
                origClick.apply(this, arguments);
              };
            }
            return el;
          };
        } catch(e) {}

        // --- Layer 5: Continuous Overlay & Trap Purger ---
        function purgeAdOverlays() {
          var selectors = [
            '#click-to-load-box',
            '.click-to-load-overlay',
            '.__000ab',
            '[class*="__000ab"]',
            '#ab-overlay',
            '.adblock-overlay',
            '.ad-overlay',
            '.anti-adblock',
            '[id*="adblock"]',
            '[class*="adblock"]',
            'div[style*="z-index: 999999"]',
            'div[style*="z-index:999999"]',
            'div[style*="z-index: 2147483647"]',
            'div[style*="z-index:2147483647"]'
          ];
          for (var i = 0; i < selectors.length; i++) {
            try {
              var els = document.querySelectorAll(selectors[i]);
              for (var j = 0; j < els.length; j++) {
                els[j].remove();
              }
            } catch(e) {}
          }

          // Unhide player iframe if it was hidden by click-to-load
          var pFrame = document.getElementById('player-iframe');
          if (pFrame) {
            pFrame.classList.remove('hidden');
            if (pFrame.style.display === 'none') {
              pFrame.style.display = 'block';
            }
          }
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', purgeAdOverlays);
        } else {
          purgeAdOverlays();
        }

        if (window.MutationObserver) {
          new MutationObserver(purgeAdOverlays).observe(document.documentElement, {
            childList: true,
            subtree: true
          });
        }
      })();
    </script>
    `;

    // Inject shield right after <head>
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${adBlockShield}`);
    } else {
      html = adBlockShield + html;
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    await logError("server2.player", err);
    return context.text("Internal Server Error loading player", 500);
  }
}
