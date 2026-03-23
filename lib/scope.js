/**
 * Scope check: is current URL within user's scope? (subdomain strategy + depth)
 */
(function () {
  function getHost(url) {
    const m = url.match(/^(?:https?:\/\/)?(?:[^@\/\n]+@)?([^:\/\n]+)/);
    return m ? m[1].toLowerCase() : '';
  }

  function getPathDepth(url) {
    try {
      const u = new URL(url);
      const segments = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
      return segments.length;
    } catch (_) {
      return 0;
    }
  }

  /** Simple registrable domain: last two parts for common TLDs */
  function getRegistrableDomain(host) {
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const tld = parts[parts.length - 1];
    const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'fr', 'de', 'uk', 'eu', 'app', 'dev'];
    if (commonTlds.includes(tld)) {
      return parts.slice(-2).join('.');
    }
    return host;
  }

  function isChildSubdomain(childHost, parentHost) {
    if (childHost === parentHost) return true;
    return childHost.endsWith('.' + parentHost);
  }

  window.CEWLER_isInScope = function (currentUrl, scopeUrl, strategy, depthLimit) {
    const scopeHost = getHost(scopeUrl);
    const currentHost = getHost(currentUrl);
    if (!scopeHost || !currentHost) return false;

    let hostOk = false;
    if (strategy === 'exact') {
      hostOk = currentHost === scopeHost;
    } else if (strategy === 'children') {
      hostOk = isChildSubdomain(currentHost, scopeHost) || scopeHost === currentHost;
    } else {
      hostOk = getRegistrableDomain(currentHost) === getRegistrableDomain(scopeHost);
    }
    if (!hostOk) return false;

    if (depthLimit !== undefined && depthLimit !== null && depthLimit > 0) {
      const depth = getPathDepth(currentUrl);
      if (depth > depthLimit) return false;
    }
    return true;
  };
})();
