/**
 * SuperStream Provider for Nuvio App
 * 
 * Author: Xyr0nX/Antonio Ante
 * GitHub: https://github.com/Xyr0nX
 * 
 * Use Febbox Token for Streaming.
 */

// ─── CONFIGURATION ──────────────────────────────────────────────────────────────
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// SECURE TOKEN: Left empty - automatically fetched from local server (Simple HTTP Server)
// Do not fill this! Store your token in cookie.txt file on your Android server.
var FEBBOX_TOKEN = "";

// ─── LOCAL SERVER CONFIGURATION ─────────────────────────────────────────────────
// Replace this IP with your Android phone's local IP running Simple HTTP Server
// How to check IP: Settings -> WiFi -> network name -> IP Address
var LOCAL_TOKEN_URL = "http://192.168.100.77:8080/cookie.txt";

var FOURTH_API = "https://showbox.media";
var THIRD_API  = "https://www.febbox.com";
var TMDB_BASE  = "https://api.themoviedb.org/3";

// ─── HEADERS ──────────────────────────────────────────────────────────────────
var BASE_HEADERS = {
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "en",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
};

var VIDEO_HEADERS = {
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.8",
  "Connection": "keep-alive",
  "Range": "bytes=0-",
  "Referer": "https://www.febbox.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
};

// HARDCODED false - always use fetch() path (Nuvio/Hermes)
var IS_NODE = false;

// ─── UTILS ────────────────────────────────────────────────────────────────────
function copyObj(src) {
  var out = {};
  var keys = Object.keys(src);
  for (var i = 0; i < keys.length; i++) {
    out[keys[i]] = src[keys[i]];
  }
  return out;
}

// ─── TOKEN FETCHER (SECURE) ─────────────────────────────────────────────────────
// Fetches token from Simple HTTP Server on Android, with layered fallback
function getFebboxToken() {
  return fetch(LOCAL_TOKEN_URL)
    .then(function(resp) {
      if (!resp.ok) throw new Error("Local server error: " + resp.status);
      return resp.text();
    })
    .then(function(text) {
      var token = text.trim();
      if (token) {
        console.log("[SuperStream] Token successfully fetched from local server");
        return token;
      }
      throw new Error("Empty token from local server");
    })
    .catch(function(e) {
      console.log("[SuperStream] Local server unavailable: " + e.message);
      // Fallback 1: global SCRAPER_SETTINGS (Nuvio settings panel)
      try {
        if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.febboxToken) {
          console.log("[SuperStream] Using token from global.SCRAPER_SETTINGS");
          return String(global.SCRAPER_SETTINGS.febboxToken);
        }
        if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.febboxToken) {
          console.log("[SuperStream] Using token from window.SCRAPER_SETTINGS");
          return String(window.SCRAPER_SETTINGS.febboxToken);
        }
      } catch (ex) { /* ignore */ }
      // Fallback 2: hardcoded FEBBOX_TOKEN (empty by default, emergency only)
      if (FEBBOX_TOKEN) {
        console.log("[SuperStream] Using hardcoded FEBBOX_TOKEN as emergency fallback");
        return FEBBOX_TOKEN;
      }
      console.error("[SuperStream] No token found from any source!");
      return "";
    });
}

// ─── HTTP CLIENT ──────────────────────────────────────────────────────────────
function httpGet(url, headers, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  headers   = headers   || BASE_HEADERS;

  if (IS_NODE) {
    return new Promise(function(resolve, reject) {
      var https  = require("https");
      var http   = require("http");
      var urlMod = require("url");
      var parsed = urlMod.parse(url);
      var isHttps = parsed.protocol === "https:";
      var client  = isHttps ? https : http;
      var options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.path,
        method:   "GET",
        headers:  headers,
        timeout:  timeoutMs
      };
      var req = client.request(options, function(res) {
        var chunks = [];
        res.on("data", function(c) { chunks.push(c); });
        res.on("end", function() {
          var body = Buffer.concat(chunks).toString("utf8");
          var sc   = res.statusCode;
          resolve({
            ok:     sc >= 200 && sc < 400,
            status: sc,
            text:   function() { return Promise.resolve(body); },
            json:   function() {
              return new Promise(function(rs, rj) {
                try { rs(JSON.parse(body)); } catch(e) { rj(e); }
              });
            }
          });
        });
      });
      req.on("error",   function(e) { reject(e); });
      req.on("timeout", function()  { req.destroy(); reject(new Error("Timeout: " + url)); });
      req.end();
    });
  } else {
    return fetch(url, { headers: headers });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeToken(token) {
  if (!token) return "";
  if (token.indexOf("eyJ") === 0) return "ui=" + token;
  if (token.indexOf("ui=") === 0) return token;
  return "ui=" + token;
}

function episodeSlug(n) {
  return n < 10 ? "0" + n : "" + n;
}

function extractQuality(str) {
  if (!str) return "Unknown";
  var m = str.match(/(\d{3,4})[pP]/);
  return m ? m[1] + "p" : str.toUpperCase();
}

function parseQualityDivs(html) {
  var results = [];
  var re = /<div[^>]*class="[^"]*file_quality[^"]*"[^>]*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var tag = m[0];
    var uM = tag.match(/data-url="([^"]+)"/);
    var qM = tag.match(/data-quality="([^"]+)"/);
    if (uM && qM) {
      results.push({
        url: uM[1].replace(new RegExp("\\/", "g"), "/"),
        quality: qM[1]
      });
    }
  }
  return results;
}

function parseSearchHref(html, baseUrl) {
  var m = html.match(/class="film-name[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"/i)
       || html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*film-name[^"]*"/i);
  return m ? baseUrl + m[1] : null;
}

function parseHeadingId(html) {
  var m = html.match(/class="heading-name[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i);
  if (!m) return null;
  var parts = m[1].split("/");
  var id = parseInt(parts[parts.length - 1]);
  return isNaN(id) ? null : id;
}

// ─── IMDB LOOKUP ──────────────────────────────────────────────────────────────
function getImdbId(tmdbId, mediaType) {
  var url1 = TMDB_BASE + "/" + mediaType + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
  console.log("[SuperStream] TMDB: " + url1);
  return httpGet(url1, BASE_HEADERS, 10000)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.imdb_id) {
        console.log("[SuperStream] IMDB ID: " + data.imdb_id);
        return data.imdb_id;
      }
      var url2 = TMDB_BASE + "/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US";
      return httpGet(url2, BASE_HEADERS, 10000)
        .then(function(r2) { return r2.json(); })
        .then(function(d2) {
          if (d2 && d2.imdb_id) {
            console.log("[SuperStream] IMDB ID fallback: " + d2.imdb_id);
            return d2.imdb_id;
          }
          return null;
        });
    })
    .catch(function(e) {
      console.log("[SuperStream] getImdbId error: " + e.message);
      return null;
    });
}

// ─── SUPERSTREAM API ──────────────────────────────────────────────────────────
function searchSuperstream(imdbId) {
  var url = FOURTH_API + "/search?keyword=" + encodeURIComponent(imdbId);
  console.log("[SuperStream] Search: " + url);
  return httpGet(url, BASE_HEADERS, 10000)
    .then(function(res) {
      if (!res.ok) return null;
      return res.text();
    })
    .then(function(html) {
      if (!html) return null;
      var href = parseSearchHref(html, FOURTH_API);
      if (!href) { console.log("[SuperStream] film-name href not found"); return null; }
      return httpGet(href, BASE_HEADERS, 10000)
        .then(function(r2) {
          if (!r2.ok) return null;
          return r2.text();
        })
        .then(function(h2) {
          return h2 ? parseHeadingId(h2) : null;
        });
    })
    .catch(function(e) {
      console.log("[SuperStream] searchSuperstream error: " + e.message);
      return null;
    });
}

function getShareKey(mediaId, type) {
  var url = FOURTH_API + "/index/share_link?id=" + mediaId + "&type=" + type;
  console.log("[SuperStream] share_link: " + url);
  return httpGet(url, BASE_HEADERS, 10000)
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(data) {
      var link = data && data.data && data.data.link ? data.data.link : null;
      if (!link) return null;
      var parts = link.split("/");
      return parts[parts.length - 1] || null;
    })
    .catch(function(e) {
      console.log("[SuperStream] getShareKey error: " + e.message);
      return null;
    });
}

function getFileList(shareKey, parentId, page) {
  page = page || 1;
  var url = THIRD_API + "/file/file_share_list?share_key=" + shareKey;
  if (parentId) url += "&parent_id=" + parentId + "&page=" + page;
  return httpGet(url, BASE_HEADERS, 10000)
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(data) {
      return data && data.data ? data.data : null;
    })
    .catch(function(e) {
      console.log("[SuperStream] getFileList error: " + e.message);
      return null;
    });
}

function getVideoQualities(fid, shareKey, token) {
  var cookieHeader = normalizeToken(token);
  var url = THIRD_API + "/console/video_quality_list?fid=" + fid + "&share_key=" + shareKey;
  var hdrs = copyObj(BASE_HEADERS);
  if (cookieHeader) hdrs["Cookie"] = cookieHeader;
  return httpGet(url, hdrs, 12000)
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(data) {
      var h = data && data.html ? data.html : "";
      return h ? parseQualityDivs(h) : [];
    })
    .catch(function(e) {
      console.log("[SuperStream] getVideoQualities error: " + e.message);
      return [];
    });
}

// ─── MAIN getStreams ───────────────────────────────────────────────────────────
// Starts with getFebboxToken() for token security
// Pure Promise chains - ZERO async/await - 100% Hermes compatible
function getStreams(tmdbId, mediaType, season, episode) {
  var _shareKey = null;

  // FIRST STEP: Fetch token from local server before anything else
  return getFebboxToken()
    .then(function(fetchedToken) {
      var token = fetchedToken;
      if (!token) {
        console.error("[SuperStream] No token available, aborting getStreams");
        return [];
      }

      return getImdbId(String(tmdbId), mediaType)

        .then(function(imdbId) {
          if (!imdbId) return Promise.reject(new Error("IMDB ID not found"));
          return searchSuperstream(imdbId);
        })

        .then(function(mediaId) {
          if (!mediaId) return Promise.reject(new Error("Media ID not found"));
          var type = (mediaType === "tv") ? 2 : 1;
          return getShareKey(mediaId, type);
        })

        .then(function(shareKey) {
          if (!shareKey) return Promise.reject(new Error("Share key not found"));
          _shareKey = shareKey;
          return getFileList(shareKey, null, 1);
        })

        .then(function(data) {
          if (!data) return [];
          var fileList = data.file_list || [];
          if (!fileList.length) return [];

          if (mediaType === "tv" && season && episode) {
            var seasonStr  = episodeSlug(season);
            var episodeStr = episodeSlug(episode);
            var seasonFolders = fileList.filter(function(f) {
              return f.is_dir && f.file_name &&
                (f.file_name.toLowerCase().indexOf("season " + parseInt(seasonStr)) !== -1 ||
                 f.file_name.toLowerCase().indexOf("s" + seasonStr) !== -1);
            });
            if (!seasonFolders.length) {
              seasonFolders = fileList.filter(function(f) { return f.is_dir; });
            }
            if (!seasonFolders.length) return [];

            return getFileList(_shareKey, seasonFolders[0].fid, 1)
              .then(function(epData) {
                if (!epData) return [];
                var epList = epData.file_list || [];
                var epFile = epList.filter(function(f) {
                  if (f.is_dir) return false;
                  var name = (f.file_name || "").toLowerCase();
                  return name.indexOf("e" + episodeStr) !== -1 ||
                         name.indexOf("ep" + episodeStr) !== -1 ||
                         name.indexOf("episode " + parseInt(episodeStr)) !== -1;
                });
                if (!epFile.length) epFile = epList.filter(function(f) { return !f.is_dir; });
                if (!epFile.length) return [];
                return getVideoQualities(epFile[0].fid, _shareKey, token);
              });
          } else {
            var videoFiles = fileList.filter(function(f) { return !f.is_dir; });
            if (!videoFiles.length) return [];
            return getVideoQualities(videoFiles[0].fid, _shareKey, token);
          }
        })

        .then(function(qualities) {
          if (!qualities || !qualities.length) return [];
          return qualities.map(function(q) {
            return {
              name:     "SuperStream " + extractQuality(q.quality),
              url:      q.url,
              quality:  extractQuality(q.quality),
              provider: "superstream",
              headers:  VIDEO_HEADERS
            };
          });
        })

        .catch(function(e) {
          console.log("[SuperStream] getStreams error: " + e.message);
          return [];
        });
    });
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
