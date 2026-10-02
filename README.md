# Intelligent Content Display System (ICDS)

The **Intelligent Content Display System (ICDS)** is a production-grade, voice-controlled web application designed to automate the projection of church hymns. By leveraging machine learning-based Automatic Speech Recognition (ASR), the system allows worship leaders or operators to simply speak a hymn number or title (e.g., "Please display Amazing Grace" or "Hymn two four five"). The system accurately processes the speech, fuzzy-matches the intent against a database of hymns, and instantly pushes the correct lyrics to a large-format projection display without any manual typing or screen refreshing.

This project eliminates the friction of traditional presentation software by introducing a hands-free, intelligent voice pipeline, complete with real-time text-to-speech audio feedback on the projector and a secure, dark-themed administrative dashboard for managing hymn records.

## Features
- **Voice Input Module**: Streams microphone audio to a server-side Vosk model for grammar-constrained offline recognition.
- **Matching Engine**: Normalizes text and uses a fuzzy matching algorithm (Levenshtein distance) to match hymn titles and numbers.
- **Automated Projection Interface**: Real-time push via Socket.IO to instantly update the projection display without reloading.
- **Text-to-Voice Module**: Provides audible feedback on the display interface using the Web Speech Synthesis API.
- **Administrative Module**: Authenticated dashboard to manage Hymn records and view the Command Log.

## Prerequisites
- Docker and Docker Compose
- Python 3 and `pip` for running the local Vosk worker outside Docker
- Modern Chromium-based browser (Chrome, Edge) with microphone access. Microphone access requires HTTPS or localhost.

> **Offline recognition:** Vosk runs on the application server. Recognition audio is streamed to that server; it does not use a cloud speech service. Serve over HTTPS on a local network so the browser permits microphone access.
>
> The Operator page does not use browser speech recognition as a fallback. If Vosk or its local model is unavailable, voice input reports an error and sends no audio to an internet speech service.

## Setup Instructions

1. **Environment Variables**:
   The `.env` file is already created from `.env.example`. Make sure it exists in the root directory.

2. **Start the Application**:
   Run the following command to build and start the Docker containers:
   ```bash
   docker-compose up --build -d
   ```
   Docker installs the Vosk Python binding and downloads/extracts `vosk-model-small-en-us-0.15` into `/models` during image build. The one-time build needs internet access; subsequent recognition is fully offline. Rebuilds may download the model again unless the Docker build cache is retained. The app communicates with a local Python worker, avoiding Vosk's Node `ffi-napi` native build, which can fail on Windows/Node 24. For a local non-Docker run, install Python 3, run `py -m pip install vosk`, download [the small English Vosk model](https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip), extract it under `models/vosk-model-small-en-us-0.15/`, then run `npm install` and `npm start`. Set `VOSK_MODEL_PATH` if the model is elsewhere. Vosk is grammar-constrained using hymn numbers, titles, and command phrases fetched from the database when a recognition session starts; no custom model training is performed.

   This starts Node.js and MySQL. The database schema is initialized on first run.

3. **Access the System**:
   - **Operator Interface**: [http://localhost:3000/operator](http://localhost:3000/operator) (Requires microphone access)
   - **Projection Display**: [http://localhost:3000/display](http://localhost:3000/display) (Click "Enable Audio" to start and enter fullscreen)
   - **Admin Dashboard**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Seed Data
- **Admin Login**:
  - Username: `user`
  - Password: `password123`
- **Demo Hymns**:
  - 245: Amazing Grace
  - 100: Holy, Holy, Holy
  - 34: How Great Thou Art
  - 405: It Is Well With My Soul

## How to Test the Voice Interface
1. Open the **Projection Display** (`/display`) in one browser window and click "Start Fullscreen Display" if needed.
2. Open the **Operator Interface** (`/operator`) in another window or on another device (if using HTTPS).
3. Click "Listen" and say a command:
   - *Number match*: "Please display hymn number 245"
   - *Title match (fuzzy)*: "Show me amazing grace"
   - *Fuzzy match*: "Play how great thou art"
   - *Not found*: "Sing a random song"
4. Watch the Projection Display update instantly via Socket.IO and listen for the Text-to-Speech audio confirmation. Every attempt is logged in the DB (viewable in the Admin panel).

## Recognition and verse advancement notes

The pretrained Vosk English model runs locally on the application server after the model download. Grammar constraints narrow recognition to the installed hymn numbers, titles, and common commands. This is not a custom-trained acoustic model. The small model has lower raw accuracy than Google's cloud recognizer, particularly with noisy microphones or strong accents; the limited vocabulary helps but does not remove that limitation. If the model or native Vosk binding cannot load on a platform, the operator UI reports the startup error and voice recognition is unavailable until deployment is corrected.

Verse advancement defaults to **Timer** at 28 seconds per verse. Admin can change the global mode, duration, and silence threshold in **Admin → Settings**; `SilenceDetection` and `Both` use experimental RMS audio energy detection from the operator microphone stream. Silence detection can trigger early or miss a pause when there is background music/noise, so Timer is the dependable default. Manual verse navigation remains available from the operator's inline display, along with pause and timer restart controls.
