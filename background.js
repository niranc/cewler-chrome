/**
 * Background: store config, aggregate words/emails/urls from content scripts, handle export, auto-crawl.
 */
const STORAGE_KEYS = {
  enabled: 'cewlerEnabled',
  scopeUrl: 'cewlerScopeUrl',
  scopeUrls: 'cewlerScopeUrls',
  config: 'cewlerConfig',
  words: 'cewlerWords',
  emails: 'cewlerEmails',
  urls: 'cewlerUrls',
  discoveredUrls: 'cewlerDiscoveredUrls',
};

const CRAWL_DELAY_MS = 2500;

let crawlState = null;

function getPathDepth(url) {
  try {
    const u = new URL(url);
    const segments = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    return segments.length;
  } catch (_) {
    return 0;
  }
}

function filterByDepth(urls, maxDepth) {
  if (!maxDepth) return urls;
  return urls.filter((u) => getPathDepth(u) <= maxDepth);
}

function mergeSets(key, newItems) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (data) => {
      const existing = new Set(Array.isArray(data[key]) ? data[key] : []);
      newItems.forEach((x) => existing.add(x));
      chrome.storage.local.set({ [key]: [...existing] }, resolve);
    });
  });
}

function scheduleNextForTab(tabId) {
  if (!crawlState || !crawlState.tabIds.includes(tabId)) return;
  const id = setTimeout(() => {
    delete crawlState.timeouts[tabId];
    if (!crawlState || crawlState.queue.length === 0) {
      chrome.tabs.remove(tabId).catch(() => {});
      if (crawlState) {
        crawlState.tabIds = crawlState.tabIds.filter((id) => id !== tabId);
        if (crawlState.tabIds.length === 0) crawlState = null;
      }
      return;
    }
    const url = crawlState.queue.shift();
    chrome.tabs.update(tabId, { url });
  }, CRAWL_DELAY_MS);
  crawlState.timeouts[tabId] = id;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete' || !crawlState || !crawlState.tabIds.includes(tabId)) return;
  if (crawlState.timeouts[tabId]) clearTimeout(crawlState.timeouts[tabId]);
  scheduleNextForTab(tabId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CEWLER_PAGE_DATA') {
    const { url, words, emails, links } = msg;
    const tabId = sender.tab && sender.tab.id;
    Promise.all([
      mergeSets(STORAGE_KEYS.words, words || []),
      mergeSets(STORAGE_KEYS.emails, emails || []),
      mergeSets(STORAGE_KEYS.urls, url ? [url] : []),
      mergeSets(STORAGE_KEYS.discoveredUrls, links || []),
    ]).then(() => {
      if (crawlState && tabId && crawlState.tabIds.includes(tabId) && Array.isArray(links) && links.length) {
        chrome.storage.local.get([STORAGE_KEYS.urls, STORAGE_KEYS.config], (data) => {
          const crawledSet = new Set(data[STORAGE_KEYS.urls] || []);
          const maxDepth = (data[STORAGE_KEYS.config] && data[STORAGE_KEYS.config].depth) !== undefined ? data[STORAGE_KEYS.config].depth : 5;
          const queue = crawlState.queue;
          const queueSet = new Set(queue);
          filterByDepth(links, maxDepth || 0).forEach((u) => {
            if (!crawledSet.has(u) && !queueSet.has(u)) { queue.push(u); queueSet.add(u); }
          });
          sendResponse({ ok: true });
        });
        return;
      }
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'CEWLER_START_AUTO_CRAWL') {
    chrome.storage.local.get([STORAGE_KEYS.scopeUrls, 'cewlerScopeUrl', STORAGE_KEYS.urls, STORAGE_KEYS.discoveredUrls, STORAGE_KEYS.config], (data) => {
      let scopeUrls = data[STORAGE_KEYS.scopeUrls];
      if (!Array.isArray(scopeUrls) && data.cewlerScopeUrl) scopeUrls = [data.cewlerScopeUrl];
      const crawled = new Set(data[STORAGE_KEYS.urls] || []);
      const discovered = new Set(data[STORAGE_KEYS.discoveredUrls] || []);
      const maxDepth = (data[STORAGE_KEYS.config] && data[STORAGE_KEYS.config].depth) !== undefined ? data[STORAGE_KEYS.config].depth : 5;
      const threads = Math.max(1, Math.min(10, (data[STORAGE_KEYS.config] && data[STORAGE_KEYS.config].crawl_threads) || 3));
      let queue = [...new Set([...(scopeUrls || []), ...discovered])].filter((u) => u && !crawled.has(u));
      queue = filterByDepth(queue, maxDepth || 0);
      if (!queue.length) {
        sendResponse({ ok: false, reason: 'no_urls' });
        return;
      }
      const numTabs = Math.min(threads, queue.length);
      const tabIds = [];
      const timeouts = {};
      for (let i = 0; i < numTabs; i++) {
        const url = queue.shift();
        chrome.tabs.create({ url, active: false }, (tab) => {
          tabIds.push(tab.id);
          if (tabIds.length === numTabs) {
            crawlState = { tabIds, queue, timeouts };
            sendResponse({ ok: true });
          }
        });
      }
    });
    return true;
  }
  if (msg.type === 'CEWLER_STOP_AUTO_CRAWL') {
    if (crawlState) {
      Object.values(crawlState.timeouts || {}).forEach((id) => clearTimeout(id));
      crawlState.tabIds.forEach((id) => chrome.tabs.remove(id).catch(() => {}));
      crawlState = null;
    }
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'CEWLER_GET_CRAWL_STATUS') {
    sendResponse({ active: !!crawlState });
    return true;
  }
  if (msg.type === 'CEWLER_GET_STATS') {
    chrome.storage.local.get([STORAGE_KEYS.words, STORAGE_KEYS.emails, STORAGE_KEYS.urls], (data) => {
      const urls = (data[STORAGE_KEYS.urls] || []).slice().sort();
      sendResponse({
        words: (data[STORAGE_KEYS.words] || []).length,
        emails: (data[STORAGE_KEYS.emails] || []).length,
        urls: urls.length,
        urlList: urls,
      });
    });
    return true;
  }
  if (msg.type === 'CEWLER_GET_EXPORT_DATA') {
    chrome.storage.local.get([STORAGE_KEYS.words, STORAGE_KEYS.emails, STORAGE_KEYS.urls, STORAGE_KEYS.config], (data) => {
      const words = (data[STORAGE_KEYS.words] || []).slice().sort();
      const emails = (data[STORAGE_KEYS.emails] || []).slice().sort();
      const urls = (data[STORAGE_KEYS.urls] || []).slice().sort();
      const config = data[STORAGE_KEYS.config] || {};
      sendResponse({
        words,
        emails,
        urls,
        wantEmails: config.output_emails !== false,
        wantUrls: !!config.output_urls,
      });
    });
    return true;
  }
  if (msg.type === 'CEWLER_CLEAR') {
    chrome.storage.local.set({
      [STORAGE_KEYS.words]: [],
      [STORAGE_KEYS.emails]: [],
      [STORAGE_KEYS.urls]: [],
      [STORAGE_KEYS.discoveredUrls]: [],
    }, () => sendResponse({ ok: true }));
    return true;
  }
});
