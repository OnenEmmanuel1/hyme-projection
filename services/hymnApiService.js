const Genius = require('genius-lyrics');
const Client = new Genius.Client(); // Anonymous client

/**
 * Service to fetch hymns from an external API when not found locally.
 * Falls back to a mock/simulated JSON payload if the public API fails.
 */
class HymnApiService {
    
    /**
     * Parses a raw text lyrics string into a structured JSON array of verses.
     */
    static parseLyricsToJson(rawText) {
        if (!rawText) return [];
        
        let cleanedText = rawText;
        
        // Remove Genius "X Contributors... Lyrics..." header
        cleanedText = cleanedText.replace(/^[\s\S]*?Lyrics/i, '');
        // Remove optional quotes after Lyrics
        cleanedText = cleanedText.replace(/^[“"”]/, '');
        
        // Strip trailing "Embed" or "XEmbed"
        cleanedText = cleanedText.replace(/\d*Embed$/, '');
        
        // Add newline if description is glued to lyrics (e.g. "Children.All things")
        cleanedText = cleanedText.replace(/([a-z\.])([A-Z])/g, '$1\n$2');
        
        // Strip out lines that look like descriptions (long sentences)
        const lines = cleanedText.split('\n');
        const validLines = [];
        let inVerse = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!inVerse) {
                // If it's a long sentence, it's probably description
                if (line.length > 55 && (line.includes('.') || line.includes('by') || line.includes('hymn'))) {
                    continue; // Skip description
                } else if (line.length > 0) {
                    inVerse = true; // We hit the first short verse line!
                }
            }
            validLines.push(lines[i]); // Keep original spacing for valid lines
        }
        
        cleanedText = validLines.join('\n');
        
        const firstBracketIndex = cleanedText.indexOf('[');
        if (firstBracketIndex > -1 && firstBracketIndex < 500) {
            cleanedText = cleanedText.substring(firstBracketIndex);
        }
        
        // Split by double newlines to get verses, then trim each verse
        const verses = cleanedText.split(/\n\s*\n/).map(v => v.trim()).filter(v => v.length > 0);
        
        return verses.map((text, index) => {
            // Check if there is a header like [Verse 1] or [Chorus]
            let headerMatch = text.match(/^\[(.*?)\]/);
            let verseType = 'Verse';
            let cleanText = text;
            
            if (headerMatch) {
                verseType = headerMatch[1];
                // Remove the header from the text
                cleanText = text.replace(/^\[(.*?)\]\n?/, '').trim();
            }
            
            return {
                verseNumber: verseType.includes('Verse') ? (index + 1) : verseType,
                text: cleanText
            };
        });
    }

    /**
     * Fetches a hymn from an external API (Genius).
     */
    static async fetchHymnFromAPI(searchString) {
        console.log(`[API] Attempting to fetch hymn: "${searchString}" from Genius API...`);
        
        try {
            const searches = await Client.songs.search(searchString);
            if (searches && searches.length > 0) {
                const song = searches[0];
                const lyrics = await song.lyrics();
                
                console.log(`[API] Successfully fetched "${song.title}" from Genius.`);
                const versesJson = this.parseLyricsToJson(lyrics);
                
                return {
                    Title: song.title, // Use the proper title from Genius
                    Lyrics: lyrics,
                    VersesJSON: versesJson,
                    Category: 'External API (Genius)'
                };
            }
        } catch (error) {
            console.error(`[API] Genius API failed for "${searchString}": ${error.message}`);
        }

        // --- FALLBACK MOCK DATA ---
        // Since public APIs can fail, we provide a robust simulated fallback 
        console.log(`[API] Generating simulated API response for "${searchString}"`);
        
        const mockRawLyrics = `[Verse 1]\nThis is the first verse of ${searchString},\nGenerated dynamically from the mock API fallback.\nSinging praises loud and clear,\nBecause the public API didn't respond.\n\n[Verse 2]\nAnd this is the second verse of ${searchString},\nWith structured JSON verses built right in.\nIt ensures the system always works,\nAnd the projection display never hangs!`;
        
        return {
            Title: searchString,
            Lyrics: mockRawLyrics,
            VersesJSON: this.parseLyricsToJson(mockRawLyrics),
            Category: 'Simulated API'
        };
    }
}

module.exports = HymnApiService;
