/**
 * @name ShowBox-Hardcoded-TV
 * @description ShowBox API with Hardcoded Token for TV Stability
 * @author Gemini
 * @version 2.1.0
 */

// --- PASTE YOUR COOKIE HERE ---
var HARDCODED_COOKIE = "http://192.168.1.3:8080/cookie.txt";
// ------------------------------

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';

function getStreams(tmdbId, type, s, e) {
    // We use the hardcoded variable directly instead of looking for UI settings
    var token = HARDCODED_COOKIE;

    if (!token || token === "PASTE_YOUR_UI_TOKEN_HERE") {
        console.log("ShowBox: Please paste your cookie into the code!");
        return Promise.resolve([]);
    }

    var tmdbUrl = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv/' : 'movie/') + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(m) {
        var name = (type === 'tv' ? m.name : m.title) || "Media";
        var year = (type === 'tv' ? m.first_air_date : m.release_date || "").split('-')[0];
        
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
                            var l = v.links[j];
                            res.push({
                                name: "ShowBox " + (l.quality || "HD"),
                                title: name + (year ? " (" + year + ")" : ""),
                                url: l.url,
                                quality: l.quality || "HD",
                                provider: "showbox-hardcoded"
                            });
                        }
                    }
                }
                return res;
            });
    }).catch(function() { return []; });
}

// Ensure it attaches to the global object for Nuvio TV
global.getStreams = getStreams;
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
