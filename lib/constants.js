/**
 * Port of cewler constants (src/cewler/constants.py)
 */
const CEWLER_CONSTANTS = {
  CONTROL_CHARACTERS_TO_FILTER_AWAY: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g,
  EMOJI_RANGES_TO_FILTER_AWAY: /[\u2600-\u26FF\u2700-\u27BF\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu,
  CHARACTERS_TO_FILTER_AWAY: /[(),./"?!""´`:{}\[\]«»*…•‹≈=■◦☀️„|_~✓+<>@;￼\\]|&&|--/g,
  CHARACTERS_ALLOWED_IN_WORDS_BUT_NOT_IN_START_OR_END: "'ˈ'-–━—&",
  REGEX_EMAIL: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
};
