# CeWLeR — Chrome extension

Browser companion to [CeWLeR](https://github.com/roys/cewler): build a **wordlist** (plus emails / visited URLs) from page text. Data is extracted from what loads in Chrome — **no separate HTTP client** for passive mode.

## Install

`chrome://extensions/` → **Developer mode** → **Load unpacked** → select this `extension` folder.

## What it does

1. You define **scope** (one or more start URLs / domains).
2. Only pages that match the scope (host + subdomain strategy + path depth) are processed.
3. Words and emails are merged into storage; you **Export** as `.txt` files.

## Passive vs Active

| Mode | What happens |
|------|----------------|
| **Passive** | With *Enable passive collection* on, each page you open yourself in a normal tab is parsed. No extra tabs. Re-parses when you change settings or on many SPA navigations. |
| **Active** | *Start active crawl* opens **N background tabs** (`Crawl threads`) and walks the queue of in-scope URLs (respecting **Depth**). Stop with *Stop active crawl*. Same extraction logic; the browser loads pages for you. |

Use **passive** for everyday browsing; use **active** to cover many links without clicking them manually.

## Default configuration

| Setting | Default |
|---------|---------|
| Depth (max path segments) | **5** (`0` = unlimited) |
| Crawl threads | **3** (1–10, active mode only) |
| Subdomain strategy | **exact** |
| Min word length | **6** |
| Lowercase | **on** |
| Exclude words with digits | **on** |
| Include CSS / JS | **off** |
| Export emails / URLs to extra files | **off** |

Settings persist in `chrome.storage.local`.

## Quick use

1. Add scope URL(s), enable **passive** (and/or run **active crawl**).
2. Watch **Words / Emails / URLs** in the popup; paginate crawled URLs if needed.
3. **Export** wordlist (and optional email/URL files if enabled in options).
4. **Clear data** resets collected lists (and discovered URLs).

---

*CLI features not in the extension: proxy, custom User-Agent, PDF extraction.*
