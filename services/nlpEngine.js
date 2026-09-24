const { NlpManager } = require('node-nlp');
const fs = require('fs');
const path = require('path');

const manager = new NlpManager({ languages: ['en'], forceNER: true });
const modelPath = path.join(__dirname, '..', 'data', 'model.nlp');

// Add Named Entities
manager.addNamedEntityText('stanza', 'verse', ['en'], ['stanza', 'verse', 'chorus']);

async function trainModel() {
    // Intent: Display Hymn
    manager.addDocument('en', 'display hymn %number%', 'intent.display_hymn');
    manager.addDocument('en', 'show me hymn %number%', 'intent.display_hymn');
    manager.addDocument('en', 'project hymn %number%', 'intent.display_hymn');
    manager.addDocument('en', 'open hymn %number%', 'intent.display_hymn');
    manager.addDocument('en', 'display %title%', 'intent.display_hymn');
    manager.addDocument('en', 'sing %title%', 'intent.display_hymn');
    manager.addDocument('en', 'hymn number %number%', 'intent.display_hymn');
    manager.addDocument('en', 'can you show hymn %number%', 'intent.display_hymn');
    
    // Intent: Next Verse
    manager.addDocument('en', 'next verse', 'intent.next_verse');
    manager.addDocument('en', 'go to the next stanza', 'intent.next_verse');
    manager.addDocument('en', 'next', 'intent.next_verse');
    manager.addDocument('en', 'move to the next', 'intent.next_verse');
    
    // Intent: Previous Verse
    manager.addDocument('en', 'previous verse', 'intent.prev_verse');
    manager.addDocument('en', 'go back', 'intent.prev_verse');
    manager.addDocument('en', 'previous stanza', 'intent.prev_verse');
    manager.addDocument('en', 'go to the previous verse', 'intent.prev_verse');
    
    // Intent: Specific Stanza
    manager.addDocument('en', 'go to verse %number%', 'intent.specific_stanza');
    manager.addDocument('en', 'display stanza %number%', 'intent.specific_stanza');
    manager.addDocument('en', 'jump to chorus', 'intent.specific_stanza');
    manager.addDocument('en', 'show verse %number%', 'intent.specific_stanza');
    
    // Train and save the model
    console.log('Training NLP model...');
    await manager.train();
    manager.save(modelPath);
    console.log('NLP model trained and saved.');
}

async function processCommand(text) {
    if (!fs.existsSync(modelPath)) {
        await trainModel();
    } else {
        manager.load(modelPath);
    }
    
    const response = await manager.process('en', text);
    return response;
}

module.exports = {
    trainModel,
    processCommand
};
