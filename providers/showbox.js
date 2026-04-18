var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';

function getStreams(tmdbId, type, s, e) {
    // This is the correct way Nuvio retrieves local settings
    var settings = (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ? global.SCRAPER_SETTINGS : {};
    var token = settings.sb_cookie_box;

    if (!token) {
        return Promise.resolve([]);
    }

    var tmdbUrl = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv/' : 'movie/') + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(m) {
        var name = (type === 'tv' ? m.name : m.title) || "Media";
        var api = (type === 'tv') 
            ? SB_BASE + '/tv/' + tmdbId + '/' + s + '/' + e + '?cookie=' + encodeURIComponent(token)
            : SB_BASE + '/movie/' + tmdbId + '?cookie=' + encodeURIComponent(token);

        return fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' } })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d || !d.versions) return [];
                var res = [];
                for (var i = 0; i < d.versions.length; i++) {
                    var v = d.versions[i];
                    if (v.links) {
                        for (var j = 0; j < v.links.length; j++) {
                            res.push({
                                name: "ShowBox " + (v.links[j].quality || "HD"),
                                title: name,
                                url: v.links[j].url,
                                quality: v.links[j].quality || "HD",
                                provider: "sb-private"
                            });
                        }
                    }
                }
                return res;
            });
    }).catch(function() { return []; });
}

global.getStreams = getStreams;
