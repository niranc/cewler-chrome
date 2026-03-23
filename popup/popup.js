const STORAGE_KEYS = {
  enabled: 'cewlerEnabled',
  scopeUrls: 'cewlerScopeUrls',
  config: 'cewlerConfig',
  words: 'cewlerWords',
  emails: 'cewlerEmails',
  urls: 'cewlerUrls',
};

const URLS_PER_PAGE = 5;
let currentUrlPage = 0;
let lastUrlList = [];

const configKeys = [
  'depth', 'crawl_threads', 'subdomain_strategy', 'min_word_length',
  'include_css', 'include_js', 'lowercase', 'without_numbers',
  'output_emails', 'output_urls', 'verbose',
];

function getScopeInputs() {
  return Array.from(document.querySelectorAll('#scopeList .scope-row input'));
}

function getScopeUrls() {
  return getScopeInputs()
    .map((input) => {
      let v = (input.value || '').trim();
      if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
      return v;
    })
    .filter(Boolean);
}

function renderScopeList(urls) {
  const list = document.getElementById('scopeList');
  list.innerHTML = '';
  const arr = urls && urls.length ? urls : [''];
  arr.forEach((url) => {
    const row = document.createElement('div');
    row.className = 'scope-row';
    row.innerHTML = `<input type="url" placeholder="https://example.com" value="${(url || '').replace(/"/g, '&quot;')}" />`;
    list.appendChild(row);
  });
  document.getElementById('scopeRemove').disabled = getScopeInputs().length <= 1;
  getScopeInputs().forEach((input) => {
    input.removeEventListener('change', save);
    input.removeEventListener('blur', save);
    input.addEventListener('change', save);
    input.addEventListener('blur', save);
  });
}

function load() {
  chrome.storage.local.get([STORAGE_KEYS.enabled, STORAGE_KEYS.scopeUrls, 'cewlerScopeUrl', STORAGE_KEYS.config], (data) => {
    document.getElementById('enabled').checked = !!data[STORAGE_KEYS.enabled];
    let urls = data[STORAGE_KEYS.scopeUrls];
    if (!Array.isArray(urls) && data.cewlerScopeUrl) {
      urls = [data.cewlerScopeUrl];
    }
    if (!Array.isArray(urls) || !urls.length) urls = [''];
    renderScopeList(urls);

    const cfg = data[STORAGE_KEYS.config] || {};
    document.getElementById('depth').value = cfg.depth !== undefined ? cfg.depth : 5;
    document.getElementById('crawl_threads').value = Math.min(10, Math.max(1, cfg.crawl_threads ?? 3));
    document.getElementById('subdomain_strategy').value = cfg.subdomain_strategy || 'exact';
    document.getElementById('min_word_length').value = cfg.min_word_length !== undefined ? cfg.min_word_length : 6;
    document.getElementById('include_css').checked = !!cfg.include_css;
    document.getElementById('include_js').checked = !!cfg.include_js;
    document.getElementById('lowercase').checked = cfg.lowercase !== undefined ? cfg.lowercase : true;
    document.getElementById('without_numbers').checked = cfg.without_numbers !== undefined ? cfg.without_numbers : true;
    document.getElementById('output_emails').checked = !!cfg.output_emails;
    document.getElementById('output_urls').checked = !!cfg.output_urls;
    document.getElementById('verbose').checked = !!cfg.verbose;
  });
  refreshStats();
}

function getConfig() {
  return {
    depth: parseInt(document.getElementById('depth').value, 10) || 0,
    crawl_threads: Math.min(10, Math.max(1, parseInt(document.getElementById('crawl_threads').value, 10) || 3)),
    subdomain_strategy: document.getElementById('subdomain_strategy').value,
    min_word_length: parseInt(document.getElementById('min_word_length').value, 10) || 6,
    include_css: document.getElementById('include_css').checked,
    include_js: document.getElementById('include_js').checked,
    lowercase: document.getElementById('lowercase').checked,
    without_numbers: document.getElementById('without_numbers').checked,
    output_emails: document.getElementById('output_emails').checked,
    output_urls: document.getElementById('output_urls').checked,
    verbose: document.getElementById('verbose').checked,
  };
}

function save() {
  const scopeUrls = getScopeUrls();
  chrome.storage.local.set({
    [STORAGE_KEYS.enabled]: document.getElementById('enabled').checked,
    [STORAGE_KEYS.scopeUrls]: scopeUrls.length ? scopeUrls : [],
    [STORAGE_KEYS.config]: getConfig(),
  });
  document.getElementById('scopeRemove').disabled = getScopeInputs().length <= 1;
  /** Ask the active tab to re-parse immediately (storage listener also fires, but this is a backup). */
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CEWLER_REPARSE' }).catch(() => {});
    }
  });
}

function renderUrlPage() {
  const listEl = document.getElementById('crawledUrlList');
  const total = lastUrlList.length;
  const totalPages = Math.max(1, Math.ceil(total / URLS_PER_PAGE));
  currentUrlPage = Math.min(currentUrlPage, totalPages - 1);
  const start = currentUrlPage * URLS_PER_PAGE;
  const slice = lastUrlList.slice(start, start + URLS_PER_PAGE);
  listEl.innerHTML = '';
  slice.forEach((url) => {
    const a = document.createElement('a');
    a.href = url;
    a.textContent = url;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url });
    });
    listEl.appendChild(a);
  });
  document.getElementById('urlPageInfo').textContent = total ? `Page ${currentUrlPage + 1} / ${totalPages}` : 'Page 1 / 1';
  document.getElementById('urlPrev').disabled = currentUrlPage <= 0;
  document.getElementById('urlNext').disabled = currentUrlPage >= totalPages - 1 || totalPages <= 1;
}

function refreshStats() {
  chrome.runtime.sendMessage({ type: 'CEWLER_GET_STATS' }, (res) => {
    if (res) {
      document.getElementById('statWords').textContent = res.words ?? 0;
      document.getElementById('statEmails').textContent = res.emails ?? 0;
      const urlCount = res.urls ?? 0;
      document.getElementById('statUrls').textContent = urlCount;
      document.getElementById('statUrlsLabel').textContent = urlCount;
      lastUrlList = res.urlList || [];
      renderUrlPage();
    }
  });
  chrome.runtime.sendMessage({ type: 'CEWLER_GET_CRAWL_STATUS' }, (status) => {
    const btn = document.getElementById('autoCrawlBtn');
    if (btn) btn.textContent = status && status.active ? 'Stop active crawl' : 'Start active crawl';
  });
}

document.getElementById('enabled').addEventListener('change', save);

document.getElementById('scopeAdd').addEventListener('click', () => {
  const list = document.getElementById('scopeList');
  const row = document.createElement('div');
  row.className = 'scope-row';
  row.innerHTML = '<input type="url" placeholder="https://example.com" />';
  list.appendChild(row);
  row.querySelector('input').addEventListener('change', save);
  row.querySelector('input').addEventListener('blur', save);
  document.getElementById('scopeRemove').disabled = false;
  save();
});

document.getElementById('scopeRemove').addEventListener('click', () => {
  const inputs = getScopeInputs();
  if (inputs.length <= 1) return;
  inputs[inputs.length - 1].closest('.scope-row').remove();
  document.getElementById('scopeRemove').disabled = getScopeInputs().length <= 1;
  save();
});

document.getElementById('urlPrev').addEventListener('click', () => {
  if (currentUrlPage <= 0) return;
  currentUrlPage--;
  renderUrlPage();
});
document.getElementById('urlNext').addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(lastUrlList.length / URLS_PER_PAGE));
  if (currentUrlPage >= totalPages - 1) return;
  currentUrlPage++;
  renderUrlPage();
});

document.getElementById('autoCrawlBtn').addEventListener('click', () => {
  save();
  chrome.runtime.sendMessage({ type: 'CEWLER_GET_CRAWL_STATUS' }, (status) => {
    if (status && status.active) {
      chrome.runtime.sendMessage({ type: 'CEWLER_STOP_AUTO_CRAWL' }, () => refreshStats());
    } else {
      chrome.runtime.sendMessage({ type: 'CEWLER_START_AUTO_CRAWL' }, (res) => {
        if (res && res.ok) refreshStats();
        else if (res && res.reason === 'no_urls') alert('No URLs to crawl. Add scope URLs and ensure "Enable collection" is on, then visit at least one page in scope to discover links.');
        refreshStats();
      });
    }
  });
});

configKeys.forEach((key) => {
  const el = document.getElementById(key);
  if (el) el.addEventListener('change', save);
});

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('exportBtn').addEventListener('click', () => {
  save();
  chrome.runtime.sendMessage({ type: 'CEWLER_GET_EXPORT_DATA' }, (data) => {
    if (!data || !data.words) return;
    const wordlist = data.words.join('\n');
    const emails = data.emails.join('\n');
    const urls = data.urls.join('\n');
    downloadBlob(wordlist, 'cewler-wordlist.txt');
    if (data.wantEmails) setTimeout(() => downloadBlob(emails, 'cewler-emails.txt'), 300);
    if (data.wantUrls) setTimeout(() => downloadBlob(urls, 'cewler-urls.txt'), 600);
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all collected words, emails and URLs?')) {
    chrome.runtime.sendMessage({ type: 'CEWLER_CLEAR' }, () => refreshStats());
  }
});

load();
setInterval(refreshStats, 2000);
