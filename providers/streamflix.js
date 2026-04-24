'use strict';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

async function getStreams(tmdbId, type, s, e) {
    try {
        // --- SETTINGS FINDER ---
        // Nuvio stores settings in the global 'plugin' or 'manifest' object
        // We look for 'local_ip' which we defined in manifest.json
        var localIp = "http://192.168.1.176:8080"; // Default fallback
        
        try {
            // Try to find the user-entered IP from Nuvio settings
            if (typeof global !== 'undefined' && global.manifest && global.manifest.scrapers) {
                var scraper = global.manifest.scrapers.find(function(x) { return x.id === 'streamflix-local-bridge' });
                if (scraper && scraper.settings && scraper.settings.local_ip) {
                    localIp = scraper.settings.local_ip;
                }
            }
        } catch(e) { console.log("Settings read failed, using default"); }

        const isTV = (type === 'tv' || type === 'series');

        // 1. Fetch from your Phone/Server
        const configResp = await fetch(`${localIp}/config-streamflixapp.json`);
        const dataResp = await fetch(`${localIp}/data.json`);
        
        if (!configResp.ok || !dataResp.ok) return [];

        const config = await configResp.json();
        const db = await dataResp.json();

        // 2. TMDB Query
        const tmdbUrl = `https://api.themoviedb.org/3/${isTV ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`;
        const tmdb = await (await fetch(tmdbUrl)).json();
        const query = (isTV ? tmdb.name : tmdb.title).toLowerCase();

        // 3. Matching
        const list = db.data || [];
        let match = null;
        for (let i = 0; i < list.length; i++) {
            if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(query) !== -1) {
                match = list[i];
                break;
            }
        }

        if (!match) return [];

        const streams = [];
        const hosts = [].concat(config.premium || [], config.movies || []);

        if (!isTV) {
            hosts.forEach(host => {
                if (match.movielink) {
                    streams.push({
                        name: "🎬 StreamFlix Local",
                        title: "1080p • " + match.moviename,
                        url: host + match.movielink,
                        quality: "1080p"
                    });
                }
            });
        } else {
            // TV Logic via Firebase
            const fbUrl = `https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/${match.moviekey}/seasons/${s}/episodes.json`;
            const epData = await (await fetch(fbUrl)).json();
            const ep = epData ? (epData[e - 1] || epData[e.toString()]) : null;

            if (ep && ep.link) {
                hosts.forEach(host => {
                    streams.push({
                        name: "🎬 StreamFlix Local",
                        title: `S${s}E${e} • ` + match.moviename,
                        url: host + ep.link,
                        quality: "1080p"
                    });
                });
            }
        }
        return streams;
    } catch (err) {
        return [];
    }
}

global.getStreams = getStreams;
