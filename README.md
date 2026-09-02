# Intelligent Content Display System (ICDS)

The **Intelligent Content Display System (ICDS)** is a production-grade, voice-controlled web application designed to automate the projection of church hymns. By leveraging machine learning-based Automatic Speech Recognition (ASR), the system allows worship leaders or operators to simply speak a hymn number or title (e.g., "Please display Amazing Grace" or "Hymn two four five"). The system accurately processes the speech, fuzzy-matches the intent against a database of hymns, and instantly pushes the correct lyrics to a large-format projection display without any manual typing or screen refreshing.

This project eliminates the friction of traditional presentation software by introducing a hands-free, intelligent voice pipeline, complete with real-time text-to-speech audio feedback on the projector and a secure, dark-themed administrative dashboard for managing hymn records.

## Features
- **Voice Input Module**: Captures voice commands using the native Web Speech API (Machine Learning-based ASR).
- **Matching Engine**: Normalizes text and uses a fuzzy matching algorithm (Levenshtein distance) to match hymn titles and numbers.
- **Automated Projection Interface**: Real-time push via Socket.IO to instantly update the projection display without reloading.
- **Text-to-Voice Module**: Provides audible feedback on the display interface using the Web Speech Synthesis API.
- **Administrative Module**: Authenticated dashboard to manage Hymn records and view the Command Log.

## Prerequisites
- Docker and Docker Compose
- Modern Chromium-based browser (Chrome, Edge) with microphone access for the Web Speech API to work correctly.

> **Important Deployment Constraint (Web Speech API):**
> The browser's native `SpeechRecognition` API requires user microphone permission. In modern browsers, this permission can only be granted in a Secure Context (HTTPS) or on `localhost`. When deploying this application for production use on a local network, you **must** serve it over HTTPS (e.g., using a reverse proxy like Nginx with self-signed certificates or Let's Encrypt), otherwise the browser will block the microphone request and the voice interface will not work.

## Setup Instructions

1. **Environment Variables**:
   The `.env` file is already created from `.env.example`. Make sure it exists in the root directory.

2. **Start the Application**:
   Run the following command to build and start the Docker containers:
   ```bash
   docker-compose up --build -d
   ```
   This will start a Node.js web server on port 3000 and a MySQL 8 database. The database will automatically initialize and seed itself with demo data.

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
1. Open the **Projection Display** (`/display`) in one browser window and click "Enable Audio & Start Display".
2. Open the **Operator Interface** (`/operator`) in another window or on another device (if using HTTPS).
3. Click "Listen" and say a command:
   - *Number match*: "Please display hymn number 245"
   - *Title match (fuzzy)*: "Show me amazing grace"
   - *Fuzzy match*: "Play how great thou art"
   - *Not found*: "Sing a random song"
4. Watch the Projection Display update instantly via Socket.IO and listen for the Text-to-Speech audio confirmation. Every attempt is logged in the DB (viewable in the Admin panel).
