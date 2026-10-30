import type { Context } from "hono";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { server4ResolveSchema } from "../schemas/server4.js";
import { resolveServer4Stream } from "../services/server4Resolver.js";

export async function server4ResolveHandler(context: Context): Promise<Response> {
  try {
    const parsed = server4ResolveSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    const { anime_id, episode_number, titles } = parsed.data;
    const result = await resolveServer4Stream(anime_id, episode_number, titles ?? []);

    if (!result) {
      return context.json(fail("Stream not found on 9anime.si", 404), 404);
    }

    const streamUrl = result.streamUrl;
    let embedUrl: string;

    // If stream is directly a megaplay stream or gogoanime that wraps megaplay
    if (streamUrl.includes("megaplay.buzz")) {
      embedUrl = `/anichi.to.html?src=${encodeURIComponent(streamUrl)}`;
    } else {
      embedUrl = `/api/server4/player?u=${encodeURIComponent(streamUrl)}`;
    }

    return context.json(ok({ embed_url: embedUrl, raw_stream: streamUrl }, "9anime stream resolved"), 200);
  } catch (err) {
    await logError("server4.resolve", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function server4PlayerHandler(context: Context): Promise<Response> {
  const targetUrl = context.req.query("u");
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return context.text("Invalid or missing player URL", 400);
  }

  try {
    // If gogoanime wrapper, extract its inner megaplay player directly
    if (targetUrl.includes("gogoanime.me.uk")) {
      try {
        const gRes = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (gRes.ok) {
          const gHtml = await gRes.text();
          const iframeMatch = gHtml.match(/<iframe[^>]*src=["']([^"']+)["']/i);
          if (iframeMatch && iframeMatch[1]?.includes("megaplay.buzz")) {
            // Forward through anichi.to ad-exempt wrapper
            return context.redirect(`/anichi.to.html?src=${encodeURIComponent(iframeMatch[1])}`);
          }
        }
      } catch {
        // continue to normal sanitization
      }
    }

    // Fetch upstream player HTML
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://9anime.si/",
      },
    });

    if (!upstreamRes.ok) {
      return context.text("Failed to load player from upstream provider", 502);
    }

    let html = await upstreamRes.text();
    const origin = new URL(targetUrl).origin;

    // 1. Strip external ad network scripts & inline ad loaders
    html = html.replace(
      /<script[^>]*src=["'][^"']*(vitalickitten|llvpn|chatbro|doubleclick|popads|popcash|histats|onclickads|adserver|exoclick|juicyads|propeller|adsterra|clickadu|adcash|monetag|hilltopads|trafficjunky|adnxs|statlytic|realsrv|tsyndicate|coinhive|yadro|vidoomy|adtrue|adreactor)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
    html = html.replace(
      /<script[^>]*>[\s\S]*?(dataset\.zone|llvpn\.com|vitalickitten|onclickads|popads|adsterra)[\s\S]*?<\/script>/gi,
      "",
    );

    // 2. Comprehensive AdBlock & Anti-Adblock neutralization shield
    const adBlockShield = `
    <base href="${origin}/">
    <script>
      (function() {
        var adPattern = /(vitalickitten|llvpn|chatbro|popads|popcash|onclickads|adsterra|exoclick|juicyads|propeller|clickadu|adcash|monetag|hilltopads|trafficjunky|doubleclick|adnxs|statlytic|realsrv|tsyndicate|coinhive|yadro|vidoomy|adtrue|adreactor)/i;
        function isAdUrl(u) {
          return typeof u === 'string' && adPattern.test(u);
        }

        // Dummy window object to satisfy pop-under checks while opening nothing
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
          console.warn("[AdBlock] Blocked window.open popup:", url);
          return dummyWin;
        };
        window.alert = function() { return null; };
        window.confirm = function() { return true; };
        window.prompt = function() { return null; };

        // Fool anti-adblock detection variables
        window.canRunAds = true;
        window.adblock = false;
        window.isAdblock = false;
        window.adblockEnabled = false;
        window.hasAdBlock = false;
        window.google_ad_client = "ca-pub-1234567890";
        window.adsbygoogle = { push: function() {} };
        window.show_ad = function() {};
        window.popns = {};

        // Intercept dynamic script insertion
        try {
          var origCreateElement = document.createElement;
          document.createElement = function(tagName) {
            var el = origCreateElement.apply(this, arguments);
            if (typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
              var origSetAttribute = el.setAttribute;
              el.setAttribute = function(name, val) {
                if (name === 'src' && isAdUrl(val)) {
                  console.warn('[AdBlock] Blocked ad script attribute:', val);
                  return;
                }
                return origSetAttribute.apply(this, arguments);
              };
              Object.defineProperty(el, 'src', {
                set: function(val) {
                  if (isAdUrl(val)) {
                    console.warn('[AdBlock] Blocked script.src assignment:', val);
                    return;
                  }
                  origSetAttribute.call(this, 'src', val);
                },
                get: function() { return this.getAttribute('src') || ''; }
              });
            }
            return el;
          };
        } catch(e) {}

        // Strip anti-adblock overlays and malicious ad divs continuously
        function purgeAdElements() {
          var selectors = [
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
            'div[style*="z-index:2147483647"]',
            'iframe[src*="vitalickitten"]',
            'iframe[src*="llvpn"]',
            'iframe[src*="chatbro"]'
          ];
          for (var i = 0; i < selectors.length; i++) {
            try {
              var els = document.querySelectorAll(selectors[i]);
              for (var j = 0; j < els.length; j++) {
                els[j].remove();
              }
            } catch(e) {}
          }

          // Scan for full-screen transparent click-trap overlays
          try {
            var allDivs = document.querySelectorAll('div, a');
            for (var k = 0; k < allDivs.length; k++) {
              var div = allDivs[k];
              var z = parseInt(window.getComputedStyle(div).zIndex, 10);
              var pos = window.getComputedStyle(div).position;
              if ((pos === 'fixed' || pos === 'absolute') && z >= 999) {
                var rect = div.getBoundingClientRect();
                if (rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7) {
                  if (!div.querySelector('video') && !div.querySelector('.jw-controls') && !div.querySelector('.vjs-control-bar')) {
                    div.remove();
                  }
                }
              }
            }
          } catch(e) {}
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', purgeAdElements);
        } else {
          purgeAdElements();
        }

        if (window.MutationObserver) {
          new MutationObserver(purgeAdElements).observe(document.documentElement, {
            childList: true,
            subtree: true
          });
        }

        // Intercept click-jacking and popup events in capture phase
        var killEvent = function(e) {
          var el = e.target;
          while (el && el !== document.body && el !== document.documentElement) {
            if (el.tagName === 'A') {
              var href = el.getAttribute('href') || '';
              if (
                isAdUrl(href) ||
                href.indexOf('pop') !== -1 ||
                href.indexOf('click') !== -1 ||
                (href.indexOf('http') === 0 && href.indexOf(location.hostname) === -1 && href.indexOf('9anime') === -1)
              ) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.warn("[AdBlock] Blocked malicious click to", href);
                return false;
              }
            }
            el = el.parentElement;
          }
        };
        window.addEventListener('click', killEvent, true);
        window.addEventListener('auxclick', killEvent, true);
        window.addEventListener('mousedown', killEvent, true);
      })();
    </script>
    <style>
      .__000ab,
      [class*="__000ab"],
      #ab-overlay,
      .adblock-overlay,
      .ad-overlay,
      .anti-adblock,
      [id*="adblock"],
      [class*="adblock"],
      div[style*="z-index: 999999"],
      div[style*="z-index:999999"],
      div[style*="z-index: 2147483647"],
      div[style*="z-index:2147483647"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    </style>
    `;

    // Inject shield at top of <head>
    if (html.includes("<head")) {
      html = html.replace(/<head[^>]*>/i, "$&" + adBlockShield);
    } else {
      html = adBlockShield + html;
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "X-Frame-Options": "ALLOWALL",
      },
    });
  } catch (err) {
    await logError("server4.player", err);
    return context.text("Error proxying player stream", 500);
  }
}
