/**
 * Content script: collect text from current page (within scope) and send to background.
 * Equivalent to cewler XPath extraction from HTML.
 */
(function () {
  function collectTextNodes(root, includeScript, includeStyle, acc) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT + NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    while ((node = walk.nextNode())) {
      if (node.nodeType === Node.COMMENT_NODE) {
        acc.push(node.textContent);
        continue;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent) continue;
        const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
        if (tag === 'script' && !includeScript) continue;
        if (tag === 'style' && !includeStyle) continue;
        acc.push(node.textContent);
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName ? node.tagName.toLowerCase() : '';
        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          if (href.toLowerCase().startsWith('mailto:')) acc.push(href.replace(/^mailto:/i, '').trim());
        }
        if (tag === 'meta') {
          const name = node.getAttribute('name');
          const content = node.getAttribute('content');
          if (name && content) acc.push(content);
        }
      }
    }
  }

  function getAllText(includeScript, includeStyle) {
    const acc = [];
    collectTextNodes(document.documentElement, includeScript, includeStyle, acc);
    return acc.join('\n');
  }

  function collectInScopeLinks(scopeUrls, strategy, depthLimit) {
    const seen = new Set();
    const out = [];
    const anchors = document.querySelectorAll('a[href], area[href]');
    for (let i = 0; i < anchors.length; i++) {
      const href = (anchors[i].getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
      let abs;
      try {
        abs = new URL(href, window.location.href).href;
      } catch (_) {
        continue;
      }
      if (!/^https?:\/\//i.test(abs)) continue;
      if (seen.has(abs)) continue;
      seen.add(abs);
      const inScope = scopeUrls.some((scopeUrl) => CEWLER_isInScope(abs, scopeUrl, strategy, depthLimit));
      if (inScope) out.push(abs);
    }
    return out;
  }

  function runOnce() {
    chrome.storage.local.get(['cewlerEnabled', 'cewlerScopeUrls', 'cewlerScopeUrl', 'cewlerConfig'], (data) => {
      if (!data.cewlerEnabled) return;
      let scopeUrls = data.cewlerScopeUrls;
      if (!Array.isArray(scopeUrls) && data.cewlerScopeUrl) scopeUrls = [data.cewlerScopeUrl];
      if (!Array.isArray(scopeUrls) || !scopeUrls.length) return;
      const config = data.cewlerConfig || {};
      const strategy = config.subdomain_strategy || 'exact';
      const depth = config.depth !== undefined ? config.depth : 5;

      if (typeof CEWLER_isInScope !== 'function') return;
      const inScope = scopeUrls.some((scopeUrl) => CEWLER_isInScope(window.location.href, scopeUrl, strategy, depth));
      if (!inScope) return;

      const includeJs = !!config.include_js;
      const includeCss = !!config.include_css;
      const text = getAllText(includeJs, includeCss);
      if (typeof CEWLER_getWordsAndEmailsFromText !== 'function') return;
      const result = CEWLER_getWordsAndEmailsFromText(text, {
        minWordLength: config.min_word_length ?? 6,
        lowercase: config.lowercase !== undefined ? config.lowercase : true,
        withoutNumbers: config.without_numbers !== undefined ? config.without_numbers : true,
      });

      const links = collectInScopeLinks(scopeUrls, strategy, depth);
      chrome.runtime.sendMessage({
        type: 'CEWLER_PAGE_DATA',
        url: window.location.href,
        words: result.words,
        emails: result.emails,
        links,
      }).catch(() => {});
    });
  }

  /** Re-run when you enable CeWLeR or change scope/options in the popup (no full reload needed). */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (
      changes.cewlerEnabled ||
      changes.cewlerScopeUrls ||
      changes.cewlerScopeUrl ||
      changes.cewlerConfig
    ) {
      runOnce();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'CEWLER_REPARSE') {
      runOnce();
      sendResponse({ ok: true });
    }
  });

  /** SPAs: URL changes without full reload — re-parse after client-side navigation. */
  function hookSpaNavigation() {
    const schedule = () => setTimeout(runOnce, 400);
    window.addEventListener('popstate', schedule);
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(history, arguments);
      schedule();
    };
    history.replaceState = function () {
      origReplace.apply(history, arguments);
      schedule();
    };
  }

  runOnce();
  hookSpaNavigation();
})();
