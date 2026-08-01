"use strict";

const PROVIDER_NAME = "2Peckle";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// ─── LOCAL SERVER CONFIGURATION ─────────────────────────────────────────────────
// Replace this URL with your local Simple HTTP Server address and text file name
const LOCAL_TOKEN_URL = "http://192.168.1.244:8080/token.txt";

// Backup hardcoded auth token (Emergency Fallback)
const FALLBACK_AUTH_TOKEN = "";

// ─── TOKEN FETCHER (SECURE) ─────────────────────────────────────────────────────
function getAuthToken() {
  return fetch(LOCAL_TOKEN_URL)
    .then(resp => {
      if (!resp.ok) throw new Error(`Local server HTTP error: ${resp.status}`);
      return resp.text();
    })
    .then(text => {
      const token = text ? text.trim() : "";
      if (token) {
        console.log(`[${PROVIDER_NAME}] Token successfully fetched from local server`);
        return token;
      }
      throw new Error("Empty token received from local server");
    })
    .catch(e => {
      console.log(`[${PROVIDER_NAME}] Local server unavailable: ${e.message}`);
      
      // Fallback 1: global SCRAPER_SETTINGS
      try {
        if (typeof globalThis !== "undefined" && globalThis.SCRAPER_SETTINGS?.authToken) {
          console.log(`[${PROVIDER_NAME}] Using token from globalThis.SCRAPER_SETTINGS`);
          return String(globalThis.SCRAPER_SETTINGS.authToken).trim();
        }
      } catch (ex) { /* ignore */ }

      // Fallback 2: Hardcoded token
      if (FALLBACK_AUTH_TOKEN) {
        console.log(`[${PROVIDER_NAME}] Using fallback hardcoded token`);
        return FALLBACK_AUTH_TOKEN;
      }

      console.error(`[${PROVIDER_NAME}] No auth token found from any source!`);
      return "";
    });
}

// Helper function to build the base URL dynamically from the fetched token
function get2PeckleBaseUrl(token) {
    const config = {
        source_2peckle: "on",
        res_2160: "on",
        res_1080: "on",
        res_720: "on",
        disable_direct: "on",
        auth_token: token
    };
    return `https://pengu.uk/${encodeURIComponent(JSON.stringify(config))}`;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return getAuthToken().then(userAuthToken => {
    if (!userAuthToken) {
      console.warn(`[${PROVIDER_NAME}] Missing Auth Token. Aborting request.`);
      return [];
    }

    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    // Dynamically construct the base URL using the fetched auth token
    const baseUrl = get2PeckleBaseUrl(userAuthToken);

    // Fetch metadata from TMDB
    return fetch(tmdbUrl)
      .then(r => r.json())
      .catch(() => null)
      .then(meta => {
        const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
        const rawTmdbId = meta?.id || tmdbId;

        const titleName = meta?.title || meta?.name || "Movie/Show";
        const releaseYear = meta?.release_date ? meta.release_date.split('-')[0] : (meta?.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

        // Construct query endpoints for BOTH IMDb ID and TMDB ID
        const endpointsToFetch = [];

        if (imdbId) {
          endpointsToFetch.push(
            isSeries 
              ? `${baseUrl}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
              : `${baseUrl}/stream/movie/${imdbId}.json`
          );
        }

        if (rawTmdbId) {
          endpointsToFetch.push(
            isSeries 
              ? `${baseUrl}/stream/series/tmdb:${rawTmdbId}:${season || 1}:${episode || 1}.json`
              : `${baseUrl}/stream/movie/tmdb:${rawTmdbId}.json`
          );
        }

        if (endpointsToFetch.length === 0) return [];

        // Execute requests in parallel
        return Promise.allSettled(
          endpointsToFetch.map(url => fetch(url).then(r => r.json()))
        ).then(responses => {
          // Merge and deduplicate stream links by URL
          const streamMap = new Map();
          responses.forEach(res => {
            if (res.status === "fulfilled" && res.value?.streams) {
              res.value.streams.forEach(s => {
                if (s && s.url && !streamMap.has(s.url)) {
                  streamMap.set(s.url, s);
                }
              });
            }
          });

          const rawStreams = Array.from(streamMap.values());
          if (rawStreams.length === 0) return [];

          const allStreams = [];

          // Map language tags
          rawStreams.forEach(s => {
            const titleText = (s.title || s.description || s.name || "").toLowerCase();
            
            let detectedLang = "English 🇺🇲";
            
            if (/hindi|hin|dual/.test(titleText)) {
              detectedLang = "Hindi 🇮🇳";
            } else if (/multi|🌐/.test(titleText)) {
              detectedLang = "Multi 🌐";
            }

            allStreams.push({ ...s, lang: detectedLang });
          });

          const result = [];
          const grouped = {};

          // Group elements cleanly by quality tags
          allStreams.forEach(item => {
            const title = (item.title || item.description || item.name || "").toLowerCase();
            const res = /2160|4k/.test(title) ? "2160p" : 
                        /1080/.test(title) ? "1080p" : 
                        /720/.test(title)  ? "720p"  : 
                        /480/.test(title)  ? "480p"  : "1080p";
            
            const key = `${res}-${item.lang}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
          });

          // Generate final presentation structure
          Object.entries(grouped).forEach(([key, items]) => {
            const [res, lang] = key.split("-");
            
            items.forEach(item => {
              const rawText = (item.title || item.description || item.name || "").toLowerCase();

              let sizeStr = "Unknown Size";
              const sizeMatch = (item.title || item.description || item.name || "").match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/i);
              if (sizeMatch) {
                sizeStr = sizeMatch[1].toUpperCase();
              } else if (item.size) {
                const bytes = parseInt(item.size, 10);
                if (!isNaN(bytes) && bytes > 0) {
                  sizeStr = bytes > 1024 * 1024 * 1024 
                    ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
                    : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
                }
              }

              const formatStr = /\b(mp4|avi|m4v)\b/.test(rawText) ? "MP4" : "MKV";
              const cleanLangText = lang.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();

              const fullLayout = 
                `🎬 ${titleName} - (${releaseYear})\n` +
                `💎 ${res} | 🔊 ${cleanLangText} | 💾 ${sizeStr}\n` +
                `🎞️ ${formatStr} | ⛓️‍💥 ${PROVIDER_NAME}`;

              result.push({
                name: `${PROVIDER_NAME} | ${res} | ${lang}`,
                title: fullLayout,
                size: fullLayout,
                description: fullLayout,
                url: item.url,
                behaviorHints: {
                  proxyHeaders: {
                    request: {
                      "Referer": "https://stremio-moviebox-1.onrender.com/"
                    }
                  }
                }
              });
            });
          });

          return result;
        });
      });
  }).catch(err => {
    console.error(`[${PROVIDER_NAME}] Global processing failure context:`, err);
    return [];
  });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
