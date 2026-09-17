/* Franime (franime.fr) — French anime catalogue (VOSTFR / VF) for Synthetiq Player.
 *
 * Verified live 2026-09-17 against the site's own bundle and API:
 *   title index : https://franime.fr/sitemap_animes.txt   (371 KB, 4637 lines: slug + anime_id + lang, whole catalogue)
 *   catalogue   : https://api.franime.fr/api/animes       (10.9 MB, query strings rejected — Cloudflare 403)
 *   details     : https://api.franime.fr/api/anime-by-id/<id> -> {title, titles, description, affiche, banner,
 *                 note, themes, format, status, saisons:[{title, episodes:[{title, lang:{vo:{lecteurs},vf:{lecteurs}}}]}]}
 *   episodes    : same payload; per-episode player availability comes from lang.{vo,vf}.lecteurs
 *   titles      : https://api.franime.fr/api/anime-seasons/<id>/<seasonNumber> -> episode titles (best effort)
 *   players     : https://api.franime.fr/api/anime/<id>/<sIdx>/<eIdx>/<vo|vf>/<lecteurIdx> -> text URL
 *                 -> https://franime.fr/watch2/?a=..&b=..&o=..  (base64 -> hex -> XOR k, key varies per request)
 *                 -> third-party player (sibnet / vidmoly / filemoon-family / sendvid)
 *                 -> direct .mp4 or .m3u8, probed before it is returned
 *   discovery   : /api/discord/voted/render-top-15-of-bestanimes, /api/calendrier_data
 *   search      : the franime API has no search route, so query -> title matching runs against the site's own
 *                 title sitemap (whole catalogue, one 371 KB fetch cached for the session) and every result is
 *                 verified through /anime-by-id before it is returned. The Kitsu index (the id space franime
 *                 is built on) is only used as a fallback when the sitemap is unreachable. Nothing is
 *                 returned that franime did not confirm.
 *
 * Sandbox rules honoured: no Node, no DOM, no setTimeout, no atob/URL/TextDecoder — local base64 decoder,
 * local URL splitter, Date.now() deadlines, fetchv2 only. Streams are resolved per play and never cached.
 */
(function () {
  'use strict';

  var SITE = 'https://franime.fr';
  var API = 'https://api.franime.fr/api/';
  var SITEMAP = 'https://franime.fr/sitemap_animes.txt';
  var KITSU = 'https://kitsu.io/api/edge/anime';
  var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  var JSON_HDR = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' };
  var HTML_HDR = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' };

  var now = function () { return Date.now(); };
  var left = function (deadline, cap) { return Math.max(800, Math.min(deadline - now(), cap || 10000)); };

  /* ------------------------------------------------------------------ utils */

  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/&eacute;/gi, 'é').replace(/&egrave;/gi, 'è').replace(/&agrave;/gi, 'à')
      .replace(/&ccedil;/gi, 'ç').replace(/&ecirc;/gi, 'ê').replace(/&ocirc;/gi, 'ô')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fold(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5]/g, 'a').replace(/\u00e7/g, 'c')
      .replace(/[\u00e8\u00e9\u00ea\u00eb]/g, 'e').replace(/[\u00ec\u00ed\u00ee\u00ef]/g, 'i')
      .replace(/\u00f1/g, 'n').replace(/[\u00f2\u00f3\u00f4\u00f5\u00f6]/g, 'o')
      .replace(/[\u00f9\u00fa\u00fb\u00fc]/g, 'u').replace(/[\u00fd\u00ff]/g, 'y')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseUrl(u) {
    var m = String(u == null ? '' : u).match(/^([a-z][a-z0-9+.-]*):\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?(#[\s\S]*)?$/i);
    if (!m) return null;
    return { scheme: m[1].toLowerCase(), host: m[2], path: m[3] || '/', query: m[4] || '', hash: m[5] || '', origin: m[1] + '://' + m[2] };
  }

  function hostOf(u) { var p = parseUrl(u); return p ? p.host.toLowerCase() : ''; }

  function absolute(href, base) {
    var v = String(href == null ? '' : href).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return 'https:' + v;
    var b = parseUrl(base || SITE) || parseUrl(SITE);
    if (/^\//.test(v)) return b.origin + v;
    return b.origin + '/' + v.replace(/^\.?\//, '');
  }

  function b64decode(input) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var map = {};
    for (var i = 0; i < chars.length; i++) map[chars.charAt(i)] = i;
    var str = String(input == null ? '' : input).replace(/[^A-Za-z0-9+\/=]/g, '');
    var out = '';
    var buffer = 0;
    var bits = 0;
    for (var j = 0; j < str.length; j++) {
      var ch = str.charAt(j);
      if (ch === '=') break;
      var val = map[ch];
      if (val === undefined) continue;
      buffer = (buffer << 6) | val;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((buffer >> bits) & 0xFF);
      }
    }
    return out;
  }

  function isHex(s) { return typeof s === 'string' && s.length > 0 && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0; }

  function hexToText(hex) {
    var out = '';
    for (var i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return out;
  }

  function xorText(text, key) {
    var out = '';
    for (var i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ key);
    return out;
  }

  /* The watch2 wrapper hides the real player URL in one of its params: base64 -> hex -> XOR k with a
   * per-request key that is not advertised anywhere. Every key is tried; the value that yields a URL wins. */
  function decodeWatch2(url) {
    var p = parseUrl(url);
    if (!p || p.query.length < 2) return { player: String(url).indexOf('watch2') < 0 ? url : null };
    var pairs = p.query.replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (kv.length < 2) continue;
      var enc = kv.slice(1).join('=').replace(/\+/g, '%2B');
      var val = enc;
      try { val = decodeURIComponent(enc); } catch (_) { val = enc; }
      var raw = b64decode(val);
      if (!isHex(raw)) continue;
      var body = hexToText(raw);
      for (var k = 0; k < 256; k++) {
        var t = xorText(body, k);
        if (/^https?:\/\/[A-Za-z0-9.-]+\/[\x21-\x7E]*$/.test(t)) return { player: t, key: k };
      }
    }
    return { player: null };
  }

  /* ------------------------------------------------------------------ http */

  /* The Flutter bridge has shipped both method-valued and string-valued body
   * fields. JSON endpoints can also expose parsed data while their text body
   * is empty, so callers must try every supported representation. */
  async function responseText(res) {
    var values = [];
    if (res) {
      if (typeof res.body === 'function') { try { values.push(await res.body()); } catch (_) {} }
      else if (res.body != null) values.push(res.body);
      if (typeof res.text === 'function') { try { values.push(await res.text()); } catch (_) {} }
      else if (res.text != null) values.push(res.text);
    }
    var fallback = '';
    for (var i = 0; i < values.length; i++) {
      if (typeof values[i] !== 'string') continue;
      var value = String(values[i]);
      if (!fallback) fallback = value;
      if (value) return value;
    }
    return fallback;
  }

  async function requestText(url, headers, timeoutMs) {
    var res = await fetchv2(url, headers || {}, 'GET', null, { timeoutMs: timeoutMs });
    var status = Number(res && (res.status || res.statusCode)) || 0;
    var text = await responseText(res);
    return { status: status, text: String(text == null ? '' : text), headers: (res && res.headers) || {} };
  }

  async function requestJson(url, headers, timeoutMs) {
    var res = await fetchv2(url, headers || {}, 'GET', null, { timeoutMs: timeoutMs });
    var status = Number(res && (res.status || res.statusCode)) || 0;
    var data = null;
    if (res && typeof res.json === 'function') { try { data = await res.json(); } catch (_) {} }
    else if (res && res.json != null) data = res.json;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
    if (data == null && res && res.body && typeof res.body === 'object' && typeof res.body !== 'function') data = res.body;
    if (data == null) {
      var t = await responseText(res);
      if (t && String(t).trim()) { try { data = JSON.parse(String(t)); } catch (_) {} }
    }
    return { status: status, data: data };
  }

  /* Structural media check. A signature is proof of container, never proof of playback. */
  function signature(buf, ctype) {
    var ct = String(ctype || '').toLowerCase();
    if (buf.length >= 3 && buf.charAt(0) === '\u00ef' && buf.charAt(1) === '\u00bb') return 'utf8-bom';
    if (buf.length > 12 && buf.substr(4, 4) === 'ftyp') return 'iso-media';
    if (buf.length > 8 && buf.substr(0, 4) === '\u001a\u0045\u00df\u00a3') return 'webm-or-matroska';
    if (buf.length > 376 && buf.charCodeAt(0) === 0x47 && buf.charCodeAt(188) === 0x47) return 'mpeg-ts';
    if (buf.length > 3 && buf.charCodeAt(0) === 0xFF && buf.charCodeAt(1) === 0xD8) return 'image';
    if (buf.length > 8 && buf.charCodeAt(0) === 0x89 && buf.substr(1, 3) === 'PNG') return 'image';
    if (/^GIF8[79]a/.test(buf.substr(0, 6))) return 'image';
    if (ct.indexOf('video/') === 0) return 'declared-video';
    if (ct.indexOf('mpegurl') >= 0) return 'declared-hls';
    if (ct.indexOf('audio/') === 0) return 'audio';
    if (ct.indexOf('application/octet-stream') >= 0) return 'opaque';
    return 'unknown';
  }

  async function probeMedia(url, headers, timeoutMs) {
    var current = String(url || '');
    var requestHeaders = Object.assign({ 'User-Agent': UA, Range: 'bytes=0-1023' }, headers || {});
    var res = null;
    var status = 0;
    var ctype = '';
    var body = '';
    for (var hop = 0; hop < 3; hop++) {
      /* Do not hand a tier-1 routing URL to Player. Resolve each redirect here
       * while the embed Referer is still under module control. */
      res = await fetchv2(current, requestHeaders, 'GET', null, { timeoutMs: timeoutMs, followRedirects: false });
      status = Number(res && (res.status || res.statusCode)) || 0;
      var rh = (res && res.headers) || {};
      var loc = rh.location || rh.Location || '';
      if (status >= 300 && status < 400 && loc) {
        var next = absolute(String(loc), current);
        if (!next || next === current) return { ok: false, reason: 'redirect loop' };
        current = next;
        continue;
      }
      ctype = String(rh['content-type'] || rh['Content-Type'] || '');
      body = await responseText(res);
      break;
    }
    if (status >= 300 && status < 400) return { ok: false, reason: 'too many redirects' };
    if (!(status === 200 || status === 206)) return { ok: false, reason: 'HTTP ' + status };
    var head = String(body || '').slice(0, 1024);
    var trimmed = head.replace(/^\uFEFF/, '').trim();
    if (trimmed.indexOf('#EXTM3U') === 0) {
      return { ok: true, type: /#EXT-X-STREAM-INF/.test(trimmed) ? 'hls-master' : 'hls-media', body: trimmed, url: current };
    }
    if (/^\s*<(!doctype|html)/i.test(head) || head.indexOf('<html') >= 0) return { ok: false, reason: 'HTML document' };
    var sig = signature(head, ctype);
    if (sig === 'image') return { ok: false, reason: 'image payload' };
    if (!/\.m3u8(\?|$)/i.test(current) && !/^video\//i.test(ctype) && !/mpegurl/i.test(ctype) &&
        !/audio\//i.test(ctype) && !/octet-stream/i.test(ctype) && sig !== 'iso-media' && sig !== 'mpeg-ts' &&
        sig !== 'webm-or-matroska' && sig !== 'declared-video' && sig !== 'audio') {
      return { ok: false, reason: 'no media signature (' + (ctype || 'no content-type') + ')' };
    }
    if (head.length < 32) return { ok: false, reason: 'empty stream body' };
    return { ok: true, type: 'file', body: head, url: current };
  }

  function hlsQualities(masterText, masterUrl, headers) {
    var lines = String(masterText || '').split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0) continue;
      var res = (lines[i].match(/RESOLUTION=\d+x(\d+)/i) || [])[1];
      var child = '';
      for (var j = i + 1; j < lines.length; j++) {
        var s = lines[j].trim();
        if (!s) continue;
        if (s.charAt(0) !== '#') { child = s; break; }
      }
      if (!child) continue;
      var h = res ? Number(res) : 0;
      out.push({ label: (h ? h + 'p' : 'Auto'), height: h || undefined, url: absolute(child, masterUrl), headers: headers });
    }
    out.sort(function (a, b) { return (b.height || 0) - (a.height || 0); });
    return out;
  }

  /* ------------------------------------------------------------- resolvers */

  var MEDIA_PATTERNS = [
    /["'](https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)["']/i,
    /["'](\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)["']/i,
    /["']([^"'\s\\]*\/[^"'\s\\]+\.m3u8[^"'\s\\]*)["']/i
  ];
  var FILE_PATTERNS = [
    /player\.src\(\s*\[\s*\{[^}]*?src\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
    /["'](https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)["']/i,
    /["']([^"'\s\\]*\/[^"'\s\\]+\.mp4[^"'\s\\]*)["']/i
  ];

  function firstMatch(text, patterns, base) {
    for (var i = 0; i < patterns.length; i++) {
      var m = String(text || '').match(patterns[i]);
      if (!m) continue;
      var u = String(m[1]).replace(/\\\//g, '/').replace(/&amp;/g, '&');
      if (u.indexOf('//') === 0) u = 'https:' + u;
      if (/^https?:\/\//i.test(u)) return u;
      if (u.charAt(0) === '/') return absolute(u, base);
    }
    return null;
  }

  function firstIframe(text, base) {
    var m = String(text || '').match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!m) return null;
    var u = String(m[1]).replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (/^(https?:)?\/\//i.test(u) || u.charAt(0) === '/') return absolute(u, base);
    return null;
  }

  function playerKind(url) {
    var h = hostOf(url);
    if (!h) return 'plain';
    if (/sibnet\.ru$/.test(h)) return 'sibnet';
    if (/vidmoly\./.test(h) || /vmpx\.online$/.test(h) || /vmeas\.cloud$/.test(h) || /vmbox\.space$/.test(h)) return 'vidmoly';
    if (/sendvid\.com$/.test(h)) return 'sendvid';
    if (/filemoon|bysedikamoum|minochinos|dingtezuni|bingezove|movearnpre|smoothpre|lpayer|embed4me/.test(h)) return 'filemoon';
    if (/gofile\.io$/.test(h)) return 'download';
    return 'plain';
  }

  /* Returns { url, headers, type } or null. One nested-iframe hop only. */
  async function resolvePlayer(playerUrl, deadline, depth) {
    var kind = playerKind(playerUrl);
    if (kind === 'download') return null;
    if (/\.(mp4|m3u8)(\?|$)/i.test(playerUrl)) {
      var direct = await probeMedia(playerUrl, { Referer: SITE + '/' }, left(deadline, 4500));
      if (direct.ok) return { url: direct.url || playerUrl, headers: { 'User-Agent': UA, Referer: SITE + '/' }, type: direct.type === 'hls-media' || direct.type === 'hls-master' ? 'hls' : 'mp4', probe: direct };
      return null;
    }
    var page = await requestText(playerUrl, Object.assign({}, HTML_HDR, { Referer: SITE + '/' }), left(deadline, 7000));
    if (page.status < 200 || page.status >= 400 || !page.text) return null;
    var mediaUrl = firstMatch(page.text, MEDIA_PATTERNS, playerUrl) || firstMatch(page.text, FILE_PATTERNS, playerUrl);
    if (mediaUrl) {
      var hdr = { 'User-Agent': UA, Referer: playerUrl };
      var p = await probeMedia(mediaUrl, hdr, left(deadline, 4500));
      if (p.ok) {
        var resolvedMediaUrl = p.url || mediaUrl;
        var isHls = /\.m3u8(\?|$)/i.test(resolvedMediaUrl) || p.type === 'hls-master' || p.type === 'hls-media';
        return {
          url: resolvedMediaUrl,
          headers: hdr,
          type: isHls ? 'hls' : 'mp4',
          source: kind,
          qualities: isHls && p.type === 'hls-master' ? hlsQualities(p.body, resolvedMediaUrl, hdr) : [],
          probe: p
        };
      }
    }
    if (depth < 1) {
      var nested = firstIframe(page.text, playerUrl);
      if (nested && nested !== playerUrl) return await resolvePlayer(nested, deadline, depth + 1);
    }
    return null;
  }

  /* ------------------------------------------------------------ franime API */

  var idFrom = function (urlOrId) {
    var v = String(urlOrId == null ? '' : urlOrId).trim();
    var m = v.match(/animeId=(\d+)/i) || v.match(/anime_by_id=(\d+)/i);
    if (m) return m[1];
    m = v.match(/anime-by-id\/(\d+)/i);
    if (m) return m[1];
    m = v.match(/\/anime\/[^\/?#]*?(\d{2,})/);
    if (m) return m[1];
    m = v.match(/^(\d{2,})$/);
    if (m) return m[1];
    return '';
  };

  function seriesHref(anime) {
    var title = anime && (anime.titleO || anime.title);
    var slug = fold(title).replace(/\s+/g, '-') || 'anime';
    return SITE + '/anime/' + slug + '?animeId=' + anime.id;
  }

  function cardFrom(anime) {
    return {
      id: String(anime.id),
      href: seriesHref(anime),
      title: clean(anime.title || anime.titleO || ''),
      image: absolute(anime.affiche || anime.affiche_small || ''),
      poster: absolute(anime.affiche || ''),
      type: 'video',
      description: clean(anime.description || '').slice(0, 220)
    };
  }

  async function getAnime(animeId, deadline, timeoutMs) {
    var res = await requestJson(API + 'anime-by-id/' + animeId, JSON_HDR, timeoutMs || left(deadline, 9000));
    if (res.status === 404) return { status: 404, anime: null };
    if (res.status !== 200 || !res.data || !res.data.id) return { status: res.status, anime: null };
    return { status: 200, anime: res.data };
  }

  /* ------------------------------------------------------------------ search */

  var indexCache = { at: 0, rows: null };

  async function loadIndex(deadline) {
    if (indexCache.rows && now() - indexCache.at < 6 * 3600 * 1000) return indexCache.rows;
    var res = await requestText(SITEMAP, HTML_HDR, left(deadline, 15000));
    if (res.status !== 200 || !res.text) return null;
    var lines = res.text.split(/\r?\n/);
    var byId = {};
    var order = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line || line.charAt(0) === '#') continue;
      var idm = line.match(/[?&]anime_?id=(\d+)/i);
      if (!idm) continue;
      var id = idm[1];
      if (byId[id]) continue;
      var slugm = line.match(/\/anime\/([^\/?#]+)/i);
      byId[id] = slugm ? slugm[1] : '';
      order.push(id);
    }
    if (!order.length) return null;
    var rows = order.map(function (id) { return { id: id, slug: byId[id], folded: fold(byId[id].replace(/-/g, ' ')) }; });
    indexCache = { at: now(), rows: rows };
    return rows;
  }

  function scoreRow(row, wanted) {
    if (!wanted) return 0;
    var s = row.folded;
    if (s === wanted) return 100;
    if (s.indexOf(wanted) === 0) return 80;
    if (s.indexOf(' ' + wanted) >= 0) return 70;
    if (s.indexOf(wanted) > 0) return 55;
    var tokens = wanted.split(' ');
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].length > 2 && s.indexOf(tokens[i]) < 0) return 0;
    }
    return 25;
  }

  async function enrich(rows, deadline, cap) {
    var out = [];
    for (var i = 0; i < rows.length && out.length < cap; i++) {
      if (now() >= deadline - 2000) break;
      var got = await getAnime(rows[i].id, deadline, left(deadline, 6000));
      if (got.status === 200 && got.anime) out.push(cardFrom(got.anime));
    }
    return out;
  }

  async function kitsuCandidates(term, deadline) {
    var kt = await requestJson(KITSU + '?filter%5Btext%5D=' + encodeURIComponent(term) + '&page%5Blimit%5D=8',
      { 'User-Agent': UA, Accept: 'application/vnd.api+json' }, left(deadline, 8000));
    if (kt.status !== 200 || !kt.data || !Array.isArray(kt.data.data)) return [];
    var out = [];
    for (var i = 0; i < kt.data.data.length; i++) {
      var it = kt.data.data[i] || {};
      var kid = String(it.id || '');
      if (!/^\d+$/.test(kid)) continue;
      var attrs = it.attributes || {};
      var titles = attrs.titles || {};
      var variants = [attrs.canonicalTitle, titles.en, titles.en_jp, titles.ja_jp];
      var folded = [];
      for (var t = 0; t < variants.length; t++) {
        if (!variants[t]) continue;
        var f = fold(variants[t]);
        if (f && folded.indexOf(f) < 0) folded.push(f);
      }
      if (folded.length) out.push({ id: kid, folded: folded });
    }
    return out;
  }

  /* Two title sources are merged: the site's own sitemap (covers identities the Kitsu index does not
   * carry) and the Kitsu index (covers entries the sitemap omits). Every candidate is then verified
   * through /anime-by-id, so an id that franime does not actually have is dropped. */
  async function searchResults(query) {
    var deadline = now() + 25000;
    var term = clean(query);
    if (!term) return [];
    var wanted = fold(term);
    var matches = [];
    var order = 0;
    var indexOk = false;

    var rows = null;
    try { rows = await loadIndex(deadline); } catch (_) { rows = null; }
    if (rows) {
      indexOk = true;
      for (var i = 0; i < rows.length; i++) {
        var sc = scoreRow(rows[i], wanted);
        if (sc > 0) matches.push({ id: rows[i].id, score: sc, src: 0, order: order++ });
      }
    }
    if (now() < deadline - 8000) {
      var kt = [];
      try { kt = await kitsuCandidates(term, deadline); } catch (_) { kt = []; }
      for (var j = 0; j < kt.length; j++) {
        var best2 = 0;
        for (var v = 0; v < kt[j].folded.length; v++) {
          var s2 = scoreRow({ folded: kt[j].folded[v] }, wanted);
          if (s2 > best2) best2 = s2;
        }
        if (best2 > 0) matches.push({ id: kt[j].id, score: best2, src: 1, order: order++ });
      }
    }

    if (!matches.length) {
      if (!indexOk && !order) throw new Error('Franime search: title index unavailable');
      return [];
    }
    var best = {};
    for (var m = 0; m < matches.length; m++) {
      var cur = matches[m];
      var prev = best[cur.id];
      if (!prev || cur.score > prev.score) best[cur.id] = cur;
    }
    var list = [];
    for (var k in best) if (best.hasOwnProperty(k)) list.push(best[k]);
    list.sort(function (a, b) {
      return (b.score - a.score) || (a.src - b.src) || (a.order - b.order);
    });
    var cards = await enrich(list.slice(0, 8).map(function (r) { return { id: r.id }; }), deadline, 6);
    return cards;
  }

  /* ----------------------------------------------------------------- details */

  function isExcludedSeason(season) {
    return /\blive[\s-]*action\b/i.test(clean(season && season.title || ''));
  }

  async function extractDetails(urlOrId) {
    var deadline = now() + 15000;
    var id = idFrom(urlOrId);
    if (!id) throw new Error('Franime details: no anime id in "' + String(urlOrId).slice(0, 80) + '"');
    var got = await getAnime(id, deadline);
    if (got.status === 404) throw new Error('Franime details: unknown anime id ' + id);
    if (got.status !== 200) throw new Error('Franime details HTTP ' + got.status + ' for id ' + id);
    var a = got.anime;
    var seasonCount = 0;
    var episodeCount = 0;
    if (Array.isArray(a.saisons)) for (var i = 0; i < a.saisons.length; i++) {
      if (isExcludedSeason(a.saisons[i])) continue;
      seasonCount++;
      episodeCount += (a.saisons[i].episodes || []).length;
    }
    var href = seriesHref(a);
    return {
      id: String(a.id),
      href: href,
      url: href,
      type: 'video',
      title: clean(a.title || a.titleO || ''),
      originalTitle: clean(a.titleO || ''),
      description: clean(a.description || ''),
      image: absolute(a.affiche || ''),
      poster: absolute(a.affiche || ''),
      banner: absolute(a.banner || ''),
      author: '',
      status: clean(a.status || ''),
      genres: Array.isArray(a.themes) ? a.themes.map(clean) : [],
      year: String(a.startDate || '').slice(0, 4) || undefined,
      endYear: String(a.endDate || '').slice(0, 4) || undefined,
      rating: clean(a.note || '') || undefined,
      format: clean(a.format || '') || undefined,
      nsfw: a.nsfw === true ? true : undefined,
      seasons: seasonCount,
      episodes: episodeCount,
      titles: a.titles || undefined
    };
  }

  /* ---------------------------------------------------------------- episodes */

  function seasonNumber(title, index) {
    var all = String(title == null ? '' : title).match(/\d+(?:\.\d+)?/g);
    if (!all || !all.length) return index + 1;
    var n = Number(all[all.length - 1]);
    return isFinite(n) && n > 0 ? n : index + 1;
  }

  function episodeTitlesFromSeason(payload) {
    var map = {};
    if (!payload || !Array.isArray(payload.episodes)) return map;
    for (var i = 0; i < payload.episodes.length; i++) {
      var e = payload.episodes[i] || {};
      var n = Number(e.number);
      if (n > 0 && e.title) map[n] = clean(e.title);
    }
    return map;
  }

  function episodeNumberFromTitle(title) {
    var m = String(title == null ? '' : title).match(/(\d+(?:\.\d+)?)\s*$/);
    var n = m ? Number(m[1]) : NaN;
    return isFinite(n) && n > 0 ? n : null;
  }

  async function extractEpisodes(seriesId) {
    var deadline = now() + 18000;
    var id = idFrom(seriesId);
    if (!id) return [];
    var got = await getAnime(id, deadline);
    if (got.status !== 200 || !got.anime) return [];
    var anime = got.anime;
    var saisons = Array.isArray(anime.saisons) ? anime.saisons : [];
    var out = [];
    var slug = (seriesHref(anime).match(/\/anime\/([^?]+)/) || [])[1] || 'anime';
    for (var si = 0; si < saisons.length; si++) {
      var s = saisons[si] || {};
      if (isExcludedSeason(s)) continue;
      var snum = seasonNumber(s.title, si);
      var eps = Array.isArray(s.episodes) ? s.episodes : [];
      var niceTitles = {};
      if (now() < deadline - 3000) {
        var det = await requestJson(API + 'anime-seasons/' + id + '/' + snum, JSON_HDR, left(deadline, 6000));
        if (det.status === 200 && det.data) niceTitles = episodeTitlesFromSeason(det.data);
      }
      for (var ei = 0; ei < eps.length; ei++) {
        var ep = eps[ei] || {};
        var lang = ep.lang || {};
        var vo = !!(lang.vo && Array.isArray(lang.vo.lecteurs) && lang.vo.lecteurs.length);
        var vf = !!(lang.vf && Array.isArray(lang.vf.lecteurs) && lang.vf.lecteurs.length);
        var num = episodeNumberFromTitle(ep.title) || (ei + 1);
        out.push({
          number: num,
          href: SITE + '/anime/' + slug + '?animeId=' + id + '&sIdx=' + si + '&eIdx=' + ei + '&saison=' + snum + '&ep=' + num,
          title: niceTitles[num] || clean(ep.title) || ('Épisode ' + num),
          season: snum,
          subAvailable: vo,
          dubAvailable: vf
        });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ stream */

  function hrefParts(episodeHref) {
    var v = String(episodeHref == null ? '' : episodeHref);
    var si = (v.match(/[?&]sIdx=(\d+)/) || [])[1];
    var ei = (v.match(/[?&]eIdx=(\d+)/) || [])[1];
    return {
      id: idFrom(v),
      sIdx: si === undefined ? 0 : Number(si),
      eIdx: ei === undefined ? 0 : Number(ei)
    };
  }

  function langKey(lang) {
    var l = String(lang == null ? '' : lang).toLowerCase();
    if (l.indexOf('dub') >= 0 || l === 'vf' || l.indexOf('vf') >= 0) return 'vf';
    return 'vo';
  }

  var UNAVAILABLE = /indisponible|indispo|unavailable|aucun|n\/a/i;

  async function lecteursFor(animeId, sIdx, eIdx, langKeyValue, deadline) {
    var got = await getAnime(animeId, deadline);
    if (got.status !== 200 || !got.anime) return { status: got.status, lecteurs: [] };
    var s = (got.anime.saisons || [])[sIdx];
    if (!s || !Array.isArray(s.episodes) || !s.episodes[eIdx]) return { status: 404, lecteurs: [] };
    var entry = (s.episodes[eIdx].lang || {})[langKeyValue] || {};
    var list = Array.isArray(entry.lecteurs) ? entry.lecteurs.slice(0, 6) : [];
    var usable = [];
    var sawUnavailable = false;
    for (var i = 0; i < list.length; i++) {
      var name = String(list[i] == null ? '' : list[i]);
      if (UNAVAILABLE.test(name)) { sawUnavailable = true; continue; }
      usable.push({ index: i, name: name });
    }
    return { status: 200, lecteurs: usable, sawUnavailable: sawUnavailable, anime: got.anime };
  }

  async function extractStreamUrl(episodeHref, lang) {
    var deadline = now() + 20000;
    var parts = hrefParts(episodeHref);
    var want = langKey(lang);
    if (!parts.id) return { streams: [] };
    var info = await lecteursFor(parts.id, parts.sIdx, parts.eIdx, want, deadline);
    if (info.status === 404) throw new Error('Franime stream: episode not found (anime ' + parts.id + ', season index ' + parts.sIdx + ', episode index ' + parts.eIdx + ')');
    if (info.status !== 200) throw new Error('Franime stream: catalogue HTTP ' + info.status);

    var label = want === 'vf' ? 'VF (French dub)' : 'VOSTFR (original audio + French subtitles)';
    if (!info.lecteurs.length) {
      var other = want === 'vf' ? 'vo' : 'vf';
      var alt = await lecteursFor(parts.id, parts.sIdx, parts.eIdx, other, deadline);
      if (info.sawUnavailable) {
        throw new Error('Franime stream: the source marks this episode as unavailable (INDISPONIBLE) for ' + label);
      }
      throw new Error('Franime stream: no ' + label + ' player for this episode' +
        (alt.lecteurs && alt.lecteurs.length ? '; the other language track is available' : ''));
    }

    var verified = [];
    var seen = {};
    for (var i = 0; i < info.lecteurs.length; i++) {
      if (now() >= deadline - 2000) break;
      var meta = null;
      try {
        var lr = await requestText(API + 'anime/' + parts.id + '/' + parts.sIdx + '/' + parts.eIdx + '/' + want + '/' + info.lecteurs[i].index,
          Object.assign({}, JSON_HDR, { Referer: SITE + '/' }), left(deadline, 7000));
        if (lr.status !== 200 || !lr.text) continue;
        var playerUrl = String(lr.text).trim();
        if (playerUrl.indexOf('watch2') >= 0) playerUrl = decodeWatch2(playerUrl).player || '';
        if (!/^https?:\/\//i.test(playerUrl)) continue;
        meta = await resolvePlayer(playerUrl, deadline, 0);
      } catch (_) { meta = null; }
      if (!meta || !meta.url || seen[meta.url]) continue;
      seen[meta.url] = 1;
      verified.push({ label: info.lecteurs[i].name, url: meta.url, headers: meta.headers, streamType: meta.type, qualities: meta.qualities || [] });
      if (verified.length >= 4) break;
    }

    if (!verified.length) {
      throw new Error('Franime stream: no playable route could be verified for this episode (' + label +
        '); the source listed ' + info.lecteurs.length + ' player(s)');
    }

    var primary = verified[0];
    var streams = [];
    for (var j = 0; j < verified.length; j++) {
      streams.push(((want === 'vf' ? 'dub VF' : 'sub VOSTFR') + ' · ' + verified[j].label), verified[j].url);
    }
    var out = {
      url: primary.url,
      headers: primary.headers,
      streamType: primary.streamType,
      streams: streams,
      servers: verified.map(function (v) {
        return { label: v.label, url: v.url, headers: v.headers, streamType: v.streamType, lang: want === 'vf' ? 'dub' : 'sub' };
      }),
      language: label
    };
    if (primary.qualities && primary.qualities.length) {
      out.qualities = primary.qualities;
      out.quality = primary.qualities[0].label;
      out.defaultQuality = primary.qualities[0].label;
    }
    return out;
  }

  /* ---------------------------------------------------------------- discovery */

  async function topAnimes(deadline) {
    var res = await requestJson(API + 'discord/voted/render-top-15-of-bestanimes', JSON_HDR, left(deadline, 9000));
    if (res.status !== 200 || !Array.isArray(res.data)) throw new Error('top HTTP ' + res.status);
    return res.data;
  }

  async function calendarItems(deadline) {
    var res = await requestJson(API + 'calendrier_data', JSON_HDR, left(deadline, 9000));
    var rows = res.data && Array.isArray(res.data.data) ? res.data.data : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var id = String(r.id_anime || '');
      var title = clean(r.title_anime || '');
      if (!id || !title || seen[id]) continue;          // the calendar lists an anime once per upcoming slot
      seen[id] = 1;
      var slug = String(r.url_access_anime_page || '').replace(/^.*\/anime\//, '').replace(/\?.*$/, '');
      out.push({
        id: id,
        href: SITE + '/anime/' + slug + '?animeId=' + id,
        title: title,
        image: absolute(r.affiche || ''),
        type: 'video',
        description: clean('Saison ' + (r.saison || '?') + ' · épisode ' + (r.prochain_ep || '?') + ' · ' + (r.jour || '') +
          ' ' + (r.heures != null ? r.heures : '') + 'h' + (r.minutes != null ? (r.minutes < 10 ? '0' : '') + r.minutes : ''))
      });
    }
    return out;
  }

  async function discoveryHome() {
    var deadline = now() + 15000;
    var sections = [];
    var top = [];
    try { top = await topAnimes(deadline); } catch (_) { top = []; }
    if (top.length) {
      var cards = top.map(cardFrom);
      sections.push({ id: 'top-franime', title: 'Top 15 franime', style: 'hero', items: cards.slice(0, 8), viewAll: { mode: 'feed', feedId: 'top' } });
      if (cards.length > 8) sections.push({ id: 'top-franime-10', title: 'Le reste du Top 15', style: 'top10', items: cards.slice(8, 18) });
    }
    try {
      var cal = await calendarItems(deadline);
      if (cal.length) sections.push({ id: 'calendrier', title: 'Prochaines sorties', style: 'poster', items: cal.slice(0, 30), viewAll: { mode: 'feed', feedId: 'calendrier' } });
    } catch (_) {}
    return { sections: sections };
  }

  async function discoveryFeed(feedId, page) {
    var deadline = now() + 15000;
    var pageNum = Math.max(1, Number(page) || 1);
    var feed = String(feedId || '');
    if (pageNum > 1) return { items: [], page: pageNum, hasMore: false };   // single-page source: no duplicate pages
    if (feed === 'calendrier') {
      var cal = await calendarItems(deadline);
      return { items: cal.slice(0, 50), page: 1, hasMore: false };
    }
    var top = await topAnimes(deadline);
    return { items: top.map(cardFrom).slice(0, 50), page: 1, hasMore: false };
  }

  /* ------------------------------------------------------------------ exports */

  globalThis.searchResults = searchResults;
  globalThis.extractDetails = extractDetails;
  globalThis.extractEpisodes = extractEpisodes;
  globalThis.extractStreamUrl = extractStreamUrl;
  globalThis.discoveryHome = discoveryHome;
  globalThis.discoveryFeed = discoveryFeed;
})();
