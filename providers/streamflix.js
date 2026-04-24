'use strict';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Setup Local IP from Settings
        var localIp = "http://192.168.1.176:8080"; 
        try {
            if (typeof global !== 'undefined' && global.manifest) {
                var sc = global.manifest.scrapers.find(x => x.id === 'streamflix-local-bridge');
                if (sc && sc.settings && sc.settings.local_ip) localIp = sc.settings.local_ip;
            }
        } catch(e) {}

        const isTV = (type === 'tv' || type === 'series');

        // 2. Get the TMDB Info to find the exact title
        const tmdbUrl = `https://api.themoviedb.org/3/${isTV ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`;
        const tmdb = await (await fetch(tmdbUrl)).json();
        const title = (isTV ? tmdb.name : tmdb.title).toLowerCase();

        // 3. Search via Firebase (This is the secret sauce - it's fast and light)
        // We search the 'Data' node directly for a match
        const searchUrl = `https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data.json?orderBy="moviename"&equalTo="${title}"&limitToFirst=1`;
        const searchResult = await (await fetch(searchUrl)).json();

        // If direct match fails, we try a fallback search or specific key mapping
        let match = null;
        if (searchResult && Object.keys(searchResult).length > 0) {
            match = Object.values(searchResult)[0];
        }

        // 4. Fallback: If Firebase search fails, try searching your local data.json 
        // but ONLY if the TV didn't crash yet.
        if (!match) {
            const dataResp = await fetch(`${localIp}/data.json`);
            const db = await dataResp.json();
            const list = db.data || [];
            for (let i = 0; i < list.length; i++) {
                if (list[i].moviename && list[i].moviename.toLowerCase().includes(title)) {
                    match = list[i];
                    break;
                }
            }
        }

        if (!match) return [];

        // 5. Get Hosts (Config) from your local server
        const configResp = await fetch(`${localIp}/config-streamflixapp.json`);
        const config = await configResp.json();
        const hosts = [].concat(config.premium || [], config.movies || []);

        const streams = [];

        if (!isTV) {
            // MOVIE
            hosts.forEach(host => {
                if (match.movielink) {
                    streams.push({
                        name: "🎬 StreamFlix",
                        title: "1080p | " + match.moviename,
                        url: host + match.movielink,
                        quality: "1080p"
                    });
                }
            });
        } else {
            // TV SERIES
            const fbUrl = `https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/${match.moviekey}/seasons/${s}/episodes.json`;
            const epData = await (await fetch(fbUrl)).json();
            const ep = epData ? (epData[e - 1] || epData[e.toString()]) : null;

            if (ep && ep.link) {
                hosts.forEach(host => {
                    streams.push({
                        name: "🎬 StreamFlix",
                        title: `S${s}E${e} | ` + match.moviename,
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
