import json
import struct
import sys


def send(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def read_exact(stream, size):
    chunks = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            return None
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def main():
    try:
        from vosk import KaldiRecognizer, Model, SetLogLevel

        SetLogLevel(-1)
        grammar_line = sys.stdin.buffer.readline()
        grammar = json.loads(grammar_line.decode("utf-8"))
        model = Model(sys.argv[1])
        recognizer = KaldiRecognizer(model, 16000, json.dumps(grammar, ensure_ascii=False))
        send({"type": "ready"})

        while True:
            frame_size = read_exact(sys.stdin.buffer, 4)
            if frame_size is None:
                break
            size = struct.unpack("<I", frame_size)[0]
            if size == 0 or size > 1024 * 1024:
                continue
            audio = read_exact(sys.stdin.buffer, size)
            if audio is None:
                break
            if recognizer.AcceptWaveform(audio):
                text = json.loads(recognizer.Result()).get("text", "")
                if text:
                    send({"type": "transcript", "text": text, "final": True})
            else:
                text = json.loads(recognizer.PartialResult()).get("partial", "")
                if text:
                    send({"type": "transcript", "text": text, "final": False})
    except Exception as error:
        send({"type": "error", "message": str(error)})
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
