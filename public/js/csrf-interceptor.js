/**
 * SimuLearn CSRF Auto-Interceptor
 * 
 * Monkeypatches window.fetch to auto-inject X-CSRF-Token into all
 * POST/PUT/DELETE requests to /api/* endpoints.
 * Include early in BaseLayout before any other scripts.
 */
(function() {
  'use strict';

  var csrfToken = null;
  var fetchPromise = null;

  function ensureToken() {
    if (csrfToken) return Promise.resolve();
    if (!fetchPromise) {
      fetchPromise = fetch('/api/auth/csrf-token', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok && d.token) csrfToken = d.token;
        })
        .catch(function() { /* CSRF unavailable — mutations will fail with 403 */ });
    }
    return fetchPromise;
  }

  // Start fetching token immediately
  ensureToken();

  // Monkeypatch fetch
  var _fetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    var method = (init && init.method || 'GET').toUpperCase();
    var isApiPath = url.startsWith('/api/') || url.indexOf('/api/') !== -1;
    var needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

    if (isApiPath && needsCsrf) {
      return ensureToken().then(function() {
        var headers = new Headers(init && init.headers);
        if (csrfToken && !headers.has('X-CSRF-Token')) {
          headers.set('X-CSRF-Token', csrfToken);
        }
        return _fetch(input, Object.assign({}, init, { headers: headers }));
      });
    }
    return _fetch(input, init);
  };

  // Expose helpers for direct use
  window.__simulearn = {
    getCsrfToken: function() { return csrfToken; },
    refreshCsrfToken: function() { csrfToken = null; fetchPromise = null; return ensureToken(); }
  };
})();
