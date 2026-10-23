import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

load_dotenv(Path(__file__).with_name(".env"))


def get_camera_source():
    value = os.getenv("CAMERA_SOURCE", "0").strip()
    return int(value) if value.isdigit() else value


class HumanDetector:
    def __init__(self):
        self.source = get_camera_source()
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        self.lock = threading.Lock()
        self.latest_jpeg = None
        self.person_count = 0
        self.camera_connected = False
        self.message = "Waiting for camera stream"
        self.running = False
        self.thread = None
        self.fps = 0.0

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)

    def status(self):
        with self.lock:
            return {
                "cameraConnected": self.camera_connected,
                "personCount": self.person_count,
                "fps": round(self.fps, 1),
                "message": self.message,
            }

    def _capture_loop(self):
        while self.running:
            capture = cv2.VideoCapture(self.source)
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not capture.isOpened():
                with self.lock:
                    self.camera_connected = False
                    self.person_count = 0
                    self.message = "Camera stream unavailable. Check CAMERA_SOURCE."
                capture.release()
                time.sleep(2)
                continue

            last_frame_time = time.monotonic()
            with self.lock:
                self.camera_connected = True
                self.message = "Camera connected; detecting people"

            while self.running:
                ok, frame = capture.read()
                if not ok or frame is None:
                    with self.lock:
                        self.camera_connected = False
                        self.person_count = 0
                        self.message = "Camera stream interrupted; reconnecting"
                    break

                height, width = frame.shape[:2]
                if width > 640:
                    scale = 640 / width
                    frame = cv2.resize(frame, (640, int(height * scale)))

                boxes, _weights = self.hog.detectMultiScale(
                    frame,
                    winStride=(8, 8),
                    padding=(8, 8),
                    scale=1.05,
                )
                for (x, y, box_width, box_height) in boxes:
                    cv2.rectangle(frame, (x, y), (x + box_width, y + box_height), (0, 220, 80), 2)
                    cv2.putText(
                        frame,
                        "Person",
                        (x, max(22, y - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (0, 220, 80),
                        2,
                        cv2.LINE_AA,
                    )

                now = time.monotonic()
                elapsed = now - last_frame_time
                last_frame_time = now
                current_fps = 1 / elapsed if elapsed > 0 else 0
                cv2.putText(
                    frame,
                    f"People: {len(boxes)}  |  {current_fps:.1f} FPS",
                    (12, 28),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )
                encoded, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if encoded:
                    with self.lock:
                        self.latest_jpeg = jpeg.tobytes()
                        self.person_count = len(boxes)
                        self.fps = current_fps
                        self.camera_connected = True
                        self.message = "Person detected" if boxes else "No person detected"

            capture.release()
            if self.running:
                time.sleep(1)

    def stream(self):
        while self.running:
            with self.lock:
                frame = self.latest_jpeg
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            else:
                time.sleep(0.1)


detector = HumanDetector()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    detector.start()
    yield
    detector.stop()


app = FastAPI(title="MineScan Human Detection", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/status")
def get_status():
    return detector.status()


@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        detector.stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )