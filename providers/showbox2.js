// ShowBox Scraper for Nuvio Local Scrapers
// React Native compatible version - Promise-based approach

// TMDB API Configuration
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// ShowBox API Configuration
const SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';

// Your Private Cookie Server
const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie2.txt";

// Working headers for ShowBox API
const WORKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Content-Type': 'application/json'
};

/**
 * MODIFIED: This function is now async so it can wait for your server.
 * It checks your local server first, then falls back to settings.
 */
async function getUiToken() {
    // 1. Attempt to pick up private cookie from your server
    try {
        console.log(`[ShowBox] Fetching private cookie from: ${LOCAL_COOKIE_URL}`);
        const response = await fetch(LOCAL_COOKIE_URL);
        if (response.ok) {
            const serverCookie = await response.text();
            if (serverCookie && serverCookie.trim()) {
                console.log("[ShowBox] Using cookie from local server");
                return serverCookie.trim();
            }
        }
    } catch (e) {
        console.log(`[ShowBox] Local server fetch failed: ${e.message}`);
    }

    // 2. Fallback to original settings logic
    try {
        if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.uiToken) {
            return String(global.SCRAPER_SETTINGS.uiToken);
        }
        if (typeof window !== 'undefined' && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.uiToken) {
            return String(window.SCRAPER_SETTINGS.uiToken);
        }
    } catch (e) {
        // ignore and fall through
    }
    return '';
}

function getOssGroup() {
    try {
        if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.ossGroup) {
            return String(global.SCRAPER_SETTINGS.ossGroup);
        }
        if (typeof window !== 'undefined' && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.ossGroup) {
            return String(window.SCRAPER_SETTINGS.ossGroup);
        }
    } catch (e) {
        // ignore and fall through
    }
    return null;
}

// Your Original Utility Functions (Untouched)
function getQualityFromName(qualityStr) {
    if (!qualityStr) return 'Unknown';
    const quality = qualityStr.toUpperCase();
    if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
    if (quality === '4K' || quality === '2160P') return '4K';
    if (quality === '1440P' || quality === '2K') return '1440p';
    if (quality === '1080P' || quality === 'FHD') return '1080p';
    if (quality === '720P' || quality === 'HD') return '720p';
    if (quality === '480P' || quality === 'SD') return '480p';
    if (quality === '360P') return '360p';
    if (quality === '240P') return '240p';
    const match = qualityStr.match(/(\d{3,4})[pP]?/);
    if (match) {
        const resolution = parseInt(match[1]);
        if (resolution >= 2160) return '4K';
        if (resolution >= 1440) return '1440p';
        if (resolution >= 1080) return '1080p';
        if (resolution >= 720) return '720p';
        if (resolution >= 480) return '480p';
        if (resolution >= 360) return '360p';
        return '240p';
    }
    return 'Unknown';
}

function formatFileSize(sizeStr) {
    if (!sizeStr) return 'Unknown';
    if (typeof sizeStr === 'string' && (sizeStr.includes('GB') || sizeStr.includes('MB') || sizeStr.includes('KB'))) {
        return sizeStr;
    }
    if (typeof sizeStr === 'number') {
        const gb = sizeStr / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = sizeStr / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }
    return sizeStr;
}

function makeRequest(url, options = {}) {
    return fetch(url, {
        method: options.method || 'GET',
        headers: { ...WORKING_HEADERS, ...options.headers },
        ...options
    }).then(function(response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response;
    }).catch(function(error) {
        console.error(`[ShowBox] Request failed for ${url}: ${error.message}`);
        throw error;
    });
}

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    return makeRequest(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            const title = mediaType === 'tv' ? data.name : data.title;
            const releaseDate = mediaType === 'tv' ? data.first_air_date : data.release_date;
            const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
            return { title: title, year: year };
        })
        .catch(function(error) {
            console.log(`[ShowBox] TMDB lookup failed: ${error.message}`);
            return { title: `TMDB ID ${tmdbId}`, year: null };
        });
}

function processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum) {
    const streams = [];
    try {
        if (!data || !data.success || !data.versions || !Array.isArray(data.versions)) return streams;
        let streamTitle = mediaInfo.title || 'Unknown Title';
        if (mediaInfo.year) streamTitle += ` (${mediaInfo.year})`;
        if (mediaType === 'tv' && seasonNum && episodeNum) {
            streamTitle = `${mediaInfo.title || 'Unknown'} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
            if (mediaInfo.year) streamTitle += ` (${mediaInfo.year})`;
        }
        data.versions.forEach(function(version, versionIndex) {
            if (version.links && Array.isArray(version.links)) {
                version.links.forEach(function(link) {
                    if (!link.url) return;
                    const normalizedQuality = getQualityFromName(link.quality || 'Unknown');
                    let streamName = 'ShowBox';
                    if (data.versions.length > 1) streamName += ` V${versionIndex + 1}`;
                    streamName += ` ${normalizedQuality}`;
                    streams.push({
                        name: streamName,
                        title: streamTitle,
                        url: link.url,
                        quality: normalizedQuality,
                        size: formatFileSize(link.size || version.size),
                        provider: 'showbox',
                        speed: link.speed || null
                    });
                });
            }
        });
    } catch (error) {
        console.error(`[ShowBox] Error processing response: ${error.message}`);
    }
    return streams;
}

/**
 * MODIFIED: Changed to an async function to handle the async cookie fetch.
 */
async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[ShowBox] Fetching streams for TMDB ID: ${tmdbId}`);

    // Wait for the cookie to be fetched from your server
    const cookie = await getUiToken(); 
    
    if (!cookie) {
        console.error('[ShowBox] No UI token (cookie) found');
        return [];
    }

    const ossGroup = getOssGroup();

    // Carry on with original logic using the cookie we just got
    return getTMDBDetails(tmdbId, mediaType)
        .then(function(mediaInfo) {
            let apiUrl;
            if (mediaType === 'tv' && seasonNum && episodeNum) {
                apiUrl = ossGroup 
                    ? `${SHOWBOX_API_BASE}/tv/${tmdbId}/oss=${ossGroup}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`
                    : `${SHOWBOX_API_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`;
            } else {
                apiUrl = `${SHOWBOX_API_BASE}/movie/${tmdbId}?cookie=${encodeURIComponent(cookie)}`;
            }

            return makeRequest(apiUrl)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    const streams = processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum);
                    streams.sort(function(a, b) {
                        const qualityOrder = { 'Original': 6, '4K': 5, '1440p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0, '240p': -1, 'Unknown': -2 };
                        return (qualityOrder[b.quality] || -2) - (qualityOrder[a.quality] || -2);
                    });
                    return streams;
                });
        })
        .catch(function(error) {
            console.error(`[ShowBox] Error in getStreams: ${error.message}`);
            return [];
        });
}

// Exporting
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.ShowBoxScraperModule = { getStreams };
}
