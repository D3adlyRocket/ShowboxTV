'use strict';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

// Change this to your Phone's Local IP (the same one as ShowBox)
var LOCAL_SERVER = "http://192.168.1.176:8080";

async function getStreams(tmdbId, type, s, e) {
    try {
        const isTV = (type === 'tv' || type === 'series');

        // 1. Fetch the files from YOUR local server instead of the internet
        const [configResp, dataResp] = await Promise.all([
            fetch(`${LOCAL_SERVER}/config-streamflixapp.json`),
            fetch(`${LOCAL_SERVER}/data.json`)
        ]);

        const config = await configResp.json();
        const db = await dataResp.json();

        // 2. TMDB Info
        const tmdbUrl = `https://api.themoviedb.org/3/${isTV ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`;
        const tmdb = await (await fetch(tmdbUrl)).json();
        const query = (isTV ? tmdb.name : tmdb.title).toLowerCase();

        // 3. Find the Movie/Show in your local data.json
        const list = db.data || [];
        let match = null;
        for (let i = 0; i < list.length; i++) {
            if (list[i].moviename && list[i].moviename.toLowerCase().includes(query)) {
                match = list[i];
                break;
            }
        }

        if (!match) return [];

        const streams = [];
        const hosts = [].concat(config.premium || [], config.movies || []);

        if (!isTV) {
            // Movie Logic
            hosts.forEach(host => {
                if (match.movielink) {
                    streams.push({
                        name: "SF Local | Movie",
                        url: host + match.movielink,
                        quality: "1080p"
                    });
                }
            });
            return streams;
        } else {
            // TV Logic - Direct Firebase (The TV can usually handle this if metadata is local)
            const fbUrl = `https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/${match.moviekey}/seasons/${s}/episodes.json`;
            const epData = await (await fetch(fbUrl)).json();
            const ep = epData ? (epData[s - 1] || epData[e.toString()]) : null;

            if (ep && ep.link) {
                hosts.forEach(host => {
                    streams.push({
                        name: `SF Local | S${s}E${e}`,
                        url: host + ep.link,
                        quality: "1080p"
                    });
                });
            }
            return streams;
        }
    } catch (err) {
        return [];
    }
}

global.getStreams = getStreams;
