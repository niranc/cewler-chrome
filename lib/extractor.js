/**
 * Port of cewler word/email extraction (spider._get_words_and_emails_from_text)
 */
(function () {
  const C = typeof CEWLER_CONSTANTS !== 'undefined' ? CEWLER_CONSTANTS : {};

  function unescapeHtml(text) {
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
  }

  function decodeUri(text) {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch (_) {
      return text;
    }
  }

  function stripWordEdges(word, chars) {
    let w = word;
    let changed;
    do {
      changed = false;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (w.startsWith(c)) { w = w.slice(1); changed = true; }
        if (w.endsWith(c)) { w = w.slice(0, -1); changed = true; }
      }
    } while (changed);
    return w;
  }

  window.CEWLER_getWordsAndEmailsFromText = function (text, config) {
    const minWordLength = Math.max(1, config.minWordLength ?? 5);
    const lowercase = !!config.lowercase;
    const withoutNumbers = !!config.withoutNumbers;
    const charsEdge = C.CHARACTERS_ALLOWED_IN_WORDS_BUT_NOT_IN_START_OR_END || "'ˈ'-–━—&";

    const newWords = [];
    const newEmails = [];

    text = unescapeHtml(text);
    text = decodeUri(text);
    text = text.replace(C.CONTROL_CHARACTERS_TO_FILTER_AWAY, '');
    text = text.replace(C.EMOJI_RANGES_TO_FILTER_AWAY, ' ');

    const emailList = text.match(C.REGEX_EMAIL) || [];
    for (let i = 0; i < emailList.length; i++) {
      let email = emailList[i];
      if (lowercase) email = email.toLowerCase();
      newEmails.push(email);
      newWords.push(email);
    }

    text = text.replace(C.CHARACTERS_TO_FILTER_AWAY, ' ');
    text = text.replace(/\s+/g, ' ');
    if (lowercase) text = text.toLowerCase();

    const tokens = text.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      let word = tokens[i].trim();
      word = stripWordEdges(word, charsEdge);
      if (word.length < minWordLength) continue;
      if (withoutNumbers && /\d/.test(word)) continue;
      newWords.push(word);
    }

    return { words: [...new Set(newWords)], emails: [...new Set(newEmails)] };
  };
})();
