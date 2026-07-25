/*!
 * Halvo embed — a paste-anywhere checkout button.
 *
 * A seller drops one <script src=".../embed.js"> onto their own site (Webflow,
 * Framer, WordPress, Ghost, Carrd, a landing page…) and any element with a
 * data-halvo-checkout="<slug>" attribute opens Halvo checkout in an overlay,
 * so the buyer never leaves the seller's page.
 *
 * Progressive enhancement: the recommended snippet is a real <a href> to the
 * product page, so if this script is blocked or JS is off, the button still
 * works as a plain link. With the script, the click opens the overlay instead.
 *
 * No dependencies, ES5-compatible for old host sites, and it figures out the
 * Halvo origin from its own <script src> so it works on any Halvo domain.
 */
(function () {
  "use strict";

  // Resolve the Halvo origin from this very script's URL.
  function resolveOrigin() {
    var el = document.currentScript;
    if (!el) {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("embed.js") !== -1) {
          el = scripts[i];
          break;
        }
      }
    }
    try {
      return el ? new URL(el.src).origin : "https://halvo.io";
    } catch (e) {
      return "https://halvo.io";
    }
  }

  var ORIGIN = resolveOrigin();
  var overlay = null;

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? "hidden" : "";
  }

  function onKey(e) {
    if (e.key === "Escape" || e.keyCode === 27) close();
  }

  function close() {
    if (!overlay) return;
    var node = overlay;
    overlay = null;
    node.style.opacity = "0";
    lockScroll(false);
    document.removeEventListener("keydown", onKey);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 200);
  }

  function open(slug, opts) {
    opts = opts || {};
    if (!slug) return;
    if (overlay) close();

    var url = ORIGIN + "/p/" + encodeURIComponent(slug) + "?embed=1";

    overlay = document.createElement("div");
    overlay.setAttribute("data-halvo-overlay", "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Secure checkout");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:rgba(6,20,19,.55);" +
      "-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);display:flex;" +
      "align-items:center;justify-content:center;padding:16px;opacity:0;" +
      "transition:opacity .2s ease;box-sizing:border-box;";

    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:460px;height:100%;max-height:780px;" +
      "background:#fff;border-radius:16px;overflow:hidden;" +
      "box-shadow:0 24px 60px -20px rgba(0,0,0,.6);box-sizing:border-box;";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close checkout");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText =
      "position:absolute;top:8px;right:8px;z-index:2;width:34px;height:34px;border:0;" +
      "border-radius:99px;background:rgba(255,255,255,.92);color:#0a1c1a;font-size:22px;" +
      "line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18);";
    closeBtn.onclick = close;

    var loader = document.createElement("div");
    loader.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
      "color:#4e6c67;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";
    loader.textContent = "Loading secure checkout…";

    var iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Halvo secure checkout";
    iframe.setAttribute("allow", "payment");
    iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
    iframe.onload = function () {
      loader.style.display = "none";
    };

    panel.appendChild(closeBtn);
    panel.appendChild(loader);
    panel.appendChild(iframe);
    overlay.appendChild(panel);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
    // Force a reflow so the opacity transition actually runs.
    // eslint-disable-next-line no-unused-expressions
    overlay.offsetWidth;
    overlay.style.opacity = "1";
    lockScroll(true);
    document.addEventListener("keydown", onKey);
  }

  // The checkout iframe can ask us to close (same-origin messages only).
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !e.data) return;
    if (e.data === "halvo:close" || (e.data && e.data.type === "halvo:close")) close();
  });

  function wire(el) {
    if (el.__halvoWired) return;
    el.__halvoWired = true;
    el.addEventListener("click", function (e) {
      var slug = el.getAttribute("data-halvo-checkout");
      if (!slug) return;
      // data-halvo-target="blank" opts out of the overlay and opens a new tab.
      if (el.getAttribute("data-halvo-target") === "blank") {
        window.open(ORIGIN + "/p/" + encodeURIComponent(slug), "_blank", "noopener");
        return;
      }
      e.preventDefault();
      open(slug);
    });
  }

  function scan() {
    var els = document.querySelectorAll("[data-halvo-checkout]");
    for (var i = 0; i < els.length; i++) wire(els[i]);
  }

  // Public API — Halvo.open("slug") opens checkout programmatically;
  // Halvo.refresh() re-scans after you inject buttons dynamically.
  window.Halvo = { open: open, close: close, refresh: scan };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
