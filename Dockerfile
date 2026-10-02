FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip python3 python3-venv make g++ && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir vosk
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN mkdir -p /models && curl -L https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o /tmp/vosk-model.zip \
    && unzip -q /tmp/vosk-model.zip -d /models && rm /tmp/vosk-model.zip
COPY . .
ENV VOSK_MODEL_PATH=/models/vosk-model-small-en-us-0.15
ENV PYTHON_BIN=/opt/venv/bin/python
EXPOSE 3000
CMD ["npm", "start"]
