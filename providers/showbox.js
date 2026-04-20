var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';

// IMPORTANT: Set this to your Phone's Local IP address
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // This only works if the device is on YOUR Wi-Fi
        const tokenResp = await fetch(LOCAL_COOKIE_URL, { timeout: 2000 });
        const token = (await tokenResp.text()).trim();

        if (!token) return [];

        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=${TMDB_KEY}`;
        const m = await (await fetch(tmdbUrl)).json();
        const api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/${s}/${e}?cookie=${token}`
            : `${SB_BASE}/movie/${tmdbId}?cookie=${token}`;

        const d = await (await fetch(api)).json();
        if (!d || !d.versions) return [];
        
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "private-local"
        })));
    } catch (e) {
        return []; // If not on your Wi-Fi, it finds nothing.
    }
}

global.getStreams = getStreams;
