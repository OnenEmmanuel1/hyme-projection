const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false
}));

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api')(io);

app.use('/', indexRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let recognizerProcess = null;
    let recognizerReady = false;
    let silenceSince = null;
    let lastSpeechAt = 0;
    socket.on('voice_start', async () => {
        if (recognizerProcess) recognizerProcess.kill();
        recognizerReady = false;
        const modelPath = process.env.VOSK_MODEL_PATH || path.join(__dirname, 'models', 'vosk-model-small-en-us-0.15');
        try {
            const grammar = await (async () => {
                const pool = require('./config/database');
                const [rows] = await pool.query('SELECT hymn_number, title FROM hymns');
                const numbers = rows.flatMap(h => [String(h.hymn_number), String(h.hymn_number).split('').join(' ')]);
                return [...new Set([...numbers, ...rows.map(h => h.title), 'play', 'hymn', 'number', 'stop', 'repeat', 'next verse', 'next', 'previous verse', '[unk]'])];
            })();
            const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3');
            const pythonArgs = python === 'py' ? ['-3', path.join(__dirname, 'services', 'vosk_worker.py'), modelPath] : [path.join(__dirname, 'services', 'vosk_worker.py'), modelPath];
            recognizerProcess = spawn(python, pythonArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
            let stdout = '';
            recognizerProcess.stdout.on('data', chunk => {
                stdout += chunk.toString();
                const lines = stdout.split(/\r?\n/); stdout = lines.pop();
                for (const line of lines) {
                    if (!line) continue;
                    try {
                        const message = JSON.parse(line);
                        if (message.type === 'ready') { recognizerReady = true; socket.emit('voice_ready'); }
                        else if (message.type === 'transcript') socket.emit('voice_transcript', { text: message.text, final: message.final });
                        else if (message.type === 'error') socket.emit('voice_error', { message: message.message });
                    } catch (error) { console.error('Invalid Vosk worker response:', line); }
                }
            });
            recognizerProcess.stderr.on('data', chunk => console.error('Vosk worker:', chunk.toString().trim()));
            recognizerProcess.on('error', error => socket.emit('voice_error', { message: `Could not start local Vosk worker: ${error.message}` }));
            recognizerProcess.on('close', code => {
                recognizerReady = false;
                if (code && socket.connected) socket.emit('voice_error', { message: 'Local Vosk worker stopped unexpectedly. Check Python and the model installation.' });
            });
            recognizerProcess.stdin.write(`${JSON.stringify(grammar)}\n`);
        } catch (error) { socket.emit('voice_error', { message: `Offline recognizer could not start: ${error.message}` }); }
    });
    socket.on('voice_audio', (audio, settings = {}) => {
        if (!recognizerReady || !recognizerProcess || !Buffer.isBuffer(audio)) return;
        let energy = 0;
        for (let i = 0; i + 1 < audio.length; i += 2) { const n = audio.readInt16LE(i) / 32768; energy += n * n; }
        const rms = audio.length ? Math.sqrt(energy / (audio.length / 2)) : 0;
        if (rms > 0.012) { lastSpeechAt = Date.now(); silenceSince = null; }
        else if (!silenceSince) silenceSince = Date.now();
        const framed = Buffer.allocUnsafe(audio.length + 4);
        framed.writeUInt32LE(audio.length, 0);
        audio.copy(framed, 4);
        recognizerProcess.stdin.write(framed);
        const duration = Number(settings.silenceThresholdSeconds || 2.5) * 1000;
        if (settings.mode && ['SilenceDetection', 'Both'].includes(settings.mode) && silenceSince && lastSpeechAt && Date.now() - silenceSince >= duration) {
            socket.emit('silence_advance'); silenceSince = null; lastSpeechAt = 0;
        }
    });
    socket.on('voice_stop', () => { recognizerReady = false; if (recognizerProcess) recognizerProcess.kill(); recognizerProcess = null; });
    socket.on('disconnect', () => { if (recognizerProcess) recognizerProcess.kill(); });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
