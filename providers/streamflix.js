'use strict';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
// If this IP doesn't work, change it here directly first to test
var FALLBACK_IP = "http://192.168.1.176:8080"; 

function getStreams(tmdbId, type, s, e) {
    var isTV = (type === 'tv' || type === 'series');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

    // We use a simple fetch without 'async' to keep the TV's RAM happy
    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(tmdb) {
            var title = (isTV ? tmdb.name : tmdb.title).toLowerCase();

            // 1. Get the local config (hosts)
            return fetch(FALLBACK_IP + '/config-streamflixapp.json')
                .then(function(r) { return r.json(); })
                .then(function(config) {
                    var hosts = [].concat(config.premium || [], config.movies || []);

                    // 2. Get the database
                    return fetch(FALLBACK_IP + '/data.json')
                        .then(function(r) { return r.json(); })
                        .then(function(db) {
                            var list = db.data || [];
                            var match = null;

                            // Loop search is safer for TV than .find() or .filter()
                            for (var i = 0; i < list.length; i++) {
                                if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(title) !== -1) {
                                    match = list[i];
                                    break;
                                }
                            }

                            if (!match) return [];

                            var streams = [];
                            if (!isTV) {
                                // MOVIE
                                for (var j = 0; j < hosts.length; j++) {
                                    streams.push({
                                        name: "🎬 SF-TV",
                                        title: "1080p | " + match.moviename,
                                        url: hosts[j] + match.movielink,
                                        quality: "1080p"
                                    });
                                }
                                return streams;
                            } else {
                                // TV - talk to Firebase
                                var fb = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + s + "/episodes.json";
                                return fetch(fb)
                                    .then(function(r) { return r.json(); })
                                    .then(function(epData) {
                                        var ep = epData ? (epData[e - 1] || epData[e.toString()]) : null;
                                        if (ep && ep.link) {
                                            for (var k = 0; k < hosts.length; k++) {
                                                streams.push({
                                                    name: "🎬 SF-TV",
                                                    title: "S" + s + "E" + e + " | " + match.moviename,
                                                    url: hosts[k] + ep.link,
                                                    quality: "1080p"
                                                });
                                            }
                                        }
                                        return streams;
                                    });
                            }
                        });
                });
        })
        .catch(function() { return []; });
}

module.exports = { getStreams: getStreams };
