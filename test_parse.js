const API = require('./services/hymnApiService');
const raw = '4 ContributorsAll Things Bright And Beautiful Lyrics“All Things Bright and Beautiful” is a Christian hymn. The words are by Cecil Frances Alexander and were first published in her Hymns for Little Children.All things bright and beautiful\nAll creatures great and small';
console.log(API.parseLyricsToJson(raw));
