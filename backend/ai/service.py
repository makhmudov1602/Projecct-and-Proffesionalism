from __future__ import annotations

import asyncio
import base64
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status
from fastapi.params import Depends
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm.session import Session
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from app.database import get_db
from app.models import Camera


os.environ.setdefault(
    "OPENCV_FFMPEG_CAPTURE_OPTIONS",
    "rtsp_transport;tcp|max_delay;0|buffer_size;1024"
)

# IMPORT THE NEW MODEL CLASS (adjust path if needed)
try:
    from .models.model import UnifiedBulletModel
except Exception:
    try:
        from .models.model import UnifiedBulletModel  # adjust depending on your layout
    except Exception as e:
        raise RuntimeError("Cannot import UnifiedBulletModel. Adjust import path.") from e

# -------------------------
# Logging & Configuration
# -------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s"
)
log = logging.getLogger("ai.service")

AUTH_ENABLED = os.getenv("AUTH_ENABLED", "0") == "1"
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-env")
JWT_ALGORITHM = os.getenv("JWT_ALG", "HS256")

# Model paths (env vars)
TARGET_MODEL_PATH = os.getenv("TARGET_MODEL_PATH", "ai/models/target_detector.pt")
BULLET_MODEL_PATH = os.getenv("BULLET_MODEL_PATH", "ai/models/bullet_hole_detector.pt")

# Defaults for stream
DEFAULT_RTSP_SOURCE = os.getenv("DEFAULT_RTSP_SOURCE", "")

ROOT_DIR = Path(__file__).parent.resolve()
STATIC_DIR = ROOT_DIR / "static"

# Global state
REVOKED_TOKEN_IDS: Set[str] = set()
MODEL: Optional[UnifiedBulletModel] = None
MODEL_LOCK = threading.Lock()
EVENT_LOOP: Optional[asyncio.AbstractEventLoop] = None
MANUAL_CAMERAS: Dict[int, Dict[str, Any]] = {}
MANUAL_CAMERA_ID_START = 9000
MANUAL_CAMERA_LOCK = threading.Lock()


def _next_manual_camera_id() -> int:
    with MANUAL_CAMERA_LOCK:
        current = max(MANUAL_CAMERAS.keys(), default=MANUAL_CAMERA_ID_START - 1)
        return current + 1


def _manual_camera_public_payload(camera: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "Id": camera.get("Id"),
        "Description": camera.get("Description") or f"Manual kamera {camera.get('Id')}",
        "IpAddress": camera.get("IpAddress"),
        "Port": int(camera.get("Port") or 554),
        "Username": camera.get("Username") or "",
        "PasswordHash": camera.get("PasswordHash") or "",
        "Source": camera.get("Source") or (DEFAULT_RTSP_SOURCE or "/Streaming/Channels/101"),
        "BranchId": camera.get("BranchId", 1),
        "CreatedAt": camera.get("CreatedAt"),
        "UpdatedAt": camera.get("UpdatedAt"),
        "is_manual": True,
    }


def _get_manual_camera(camera_id: int) -> Optional[Dict[str, Any]]:
    return MANUAL_CAMERAS.get(int(camera_id))


# -------------------------
# Pydantic models
# -------------------------
class StreamSettings(BaseModel):
    fps: Optional[int] = Field(None, ge=1, le=30)
    width: Optional[int] = Field(None, ge=50, le=1920)
    height: Optional[int] = Field(None, ge=50, le=1080)
    format: Optional[str] = Field(None, pattern="^(webp|jpeg|jpg)$")
    quality: Optional[int] = Field(None, ge=1, le=100)
    emit_frames: Optional[bool] = None
    stream_kind: Optional[str] = Field(None, pattern="^(crop|annotated|both)$")


class ManualCameraConnectRequest(BaseModel):
    description: str = Field(default="Manual IP Camera", min_length=2, max_length=120)
    ip_address: str = Field(..., min_length=3, max_length=120)
    username: str = Field(default="admin", min_length=0, max_length=120)
    password: str = Field(default="", max_length=255)
    port: int = Field(default=554, ge=1, le=65535)
    source: str = Field(default="/Streaming/Channels/101", max_length=255)
    auto_start: bool = True


class DetectionPoint(BaseModel):
    x: Optional[int] = None
    y: Optional[int] = None
    x_rel: Optional[float] = None
    y_rel: Optional[float] = None
    score: Optional[int] = None
    conf: Optional[float] = None
    cam_id: Optional[int] = None


# -------------------------
# Router & static mount
# -------------------------
router = APIRouter(prefix="/ai", tags=["AI Detection"])

if STATIC_DIR.exists():
    router.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
else:
    log.warning(f"Static directory not found: {STATIC_DIR}")


def _capture_single_frame_from_rtsp(
    rtsp_url: str,
    max_attempts: int = 20,
    sleep_between: float = 0.05
) -> Optional[np.ndarray]:
    """
    Yangi ochilgan cv2.VideoCapture orqali BIR frame oladi (fresh capture).
    - rtsp_url: rtsp://...
    - max_attempts: read urinishlari
    - sleep_between: har urinish orasidagi kutish (sek)
    Returns: frame (np.ndarray) yoki None agar olinmasa.
    """
    try:
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        if not cap.isOpened():
            log.error("Failed to open RTSP for single-frame capture: %s", str(rtsp_url)[:200])
            try:
                cap.release()
            except Exception:
                pass
            return None

        frame = None
        attempts = 0
        while attempts < max_attempts and frame is None:
            attempts += 1
            success, f = cap.read()
            if success and f is not None:
                frame = f.copy()
                break
            time.sleep(sleep_between)

        try:
            cap.release()
        except Exception:
            pass

        return frame
    except Exception as e:
        log.exception("Error capturing single frame from RTSP: %s", e)
        return None


# -------------------------
# Helper utilities
# -------------------------
def load_model() -> UnifiedBulletModel:
    """Load UnifiedBulletModel (thread-safe)."""
    global MODEL

    if MODEL is not None:
        return MODEL

    with MODEL_LOCK:
        if MODEL is None:
            try:
                MODEL = UnifiedBulletModel(
                    target_model_path=os.getenv("TARGET_MODEL_PATH", TARGET_MODEL_PATH),
                    bullet_model_path=os.getenv("BULLET_MODEL_PATH", BULLET_MODEL_PATH),
                    target_conf_threshold=float(os.getenv("TARGET_CONF", "0.25")),
                    bullet_conf_threshold=float(os.getenv("BULLET_CONF", "0.25")),
                )
                log.info(f"✅ UnifiedBulletModel loaded: target={TARGET_MODEL_PATH}, bullet={BULLET_MODEL_PATH}")
            except Exception as e:
                log.exception("Failed to initialize UnifiedBulletModel")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Model initialization failed: {str(e)}"
                )

    return MODEL


def _get_attr(obj: Any, *names, default=None):
    """ORM yoki dict ichidan birinchi mavjud nomni qaytaradi."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        for n in names:
            v = obj.get(n)
            if v not in (None, ""):
                return v
        return default
    for n in names:
        if hasattr(obj, n):
            v = getattr(obj, n)
            if v not in (None, ""):
                return v
    return default


def get_model() -> UnifiedBulletModel:
    if MODEL is None:
        return load_model()
    return MODEL


def build_rtsp_url(camera_config: Any) -> str:
    """
    Camera ORM obyekt yoki dict qabul qiladi va rtsp URL hosil qiladi.
    """
    username = _get_attr(camera_config, "Username", "UserName", "username", default="")
    password = _get_attr(
        camera_config,
        "Password",
        "RtspPassword",
        "rtsp_password",
        "PasswordHash",
        "passwordhash",
        default=None,
    )
    ip_address = _get_attr(camera_config, "IpAddress", "ip_address", "IP", default=None)
    if not ip_address:
        raise ValueError("IP address is required for RTSP URL (Camera.IpAddress)")

    port = _get_attr(camera_config, "Port", "port", default=554)
    try:
        port = int(port)
    except Exception:
        port = 554

    source = _get_attr(camera_config, "Source", "source", default=DEFAULT_RTSP_SOURCE or "")

    auth_part = ""
    if username and password is not None:
        # URL-encode username/password to be safer
        from urllib.parse import quote
        auth_part = f"{quote(username, safe='')}:{quote(str(password), safe='')}@"
    elif username and password is None:
        from urllib.parse import quote
        auth_part = f"{quote(username, safe='')}@"

    rtsp = f"rtsp://{auth_part}{ip_address}:{port}{source}"
    return rtsp


def camera_to_config(db_camera: Optional[Camera]) -> Dict[str, Any]:
    """Camera ORM -> dict (siz bergan Camera modeliga mos)"""
    if db_camera is None:
        return {}
    return {
        "Id": getattr(db_camera, "Id", None),
        "Username": getattr(db_camera, "Username", "") or "",
        "PasswordHash": getattr(db_camera, "PasswordHash", None),
        "IpAddress": getattr(db_camera, "IpAddress", None),
        "Port": getattr(db_camera, "Port", None),
        "Source": getattr(db_camera, "Source", None),
    }


def _camera_public_payload(db_camera: Optional[Camera]) -> Dict[str, Any]:
    config = camera_to_config(db_camera)
    return {
        "Id": config.get("Id"),
        "Description": getattr(db_camera, "Description", None),
        "IpAddress": config.get("IpAddress"),
        "Port": config.get("Port") or 554,
        "Username": config.get("Username") or "",
        "PasswordHash": config.get("PasswordHash") or "",
        "Source": config.get("Source") or (DEFAULT_RTSP_SOURCE or "/Streaming/Channels/101"),
        "BranchId": getattr(db_camera, "BranchId", None),
        "CreatedAt": getattr(db_camera, "CreatedAt", None),
        "UpdatedAt": getattr(db_camera, "UpdatedAt", None),
        "is_manual": False,
    }


def encode_image_to_base64(
    image: np.ndarray,
    image_format: str = "jpeg",
    quality: int = 85,
    size: Optional[Tuple[int, int]] = None
) -> Tuple[str, str]:
    if image is None or image.size == 0:
        return "", "image/jpeg"

    if size and size[0] > 0 and size[1] > 0:
        image = cv2.resize(image, size, interpolation=cv2.INTER_AREA)

    fmt = image_format.lower()
    if fmt == "webp":
        encode_params = [cv2.IMWRITE_WEBP_QUALITY, quality]
        ext = ".webp"
        mime_type = "image/webp"
    else:
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        ext = ".jpg"
        mime_type = "image/jpeg"

    success, buffer = cv2.imencode(ext, image, encode_params)
    if not success:
        success, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        mime_type = "image/jpeg"

    if not success:
        raise RuntimeError("Failed to encode image")

    base64_str = base64.b64encode(buffer.tobytes()).decode("ascii")
    return base64_str, mime_type


def encode_image_to_jpeg(
    image: np.ndarray,
    quality: int = 85,
    size: Optional[Tuple[int, int]] = None
) -> Tuple[bytes, str]:
    if image is None or image.size == 0:
        return b"", "image/jpeg"
    if size and size[0] > 0 and size[1] > 0:
        image = cv2.resize(image, size, interpolation=cv2.INTER_AREA)
    success, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise RuntimeError("Failed to encode JPEG")
    return buffer.tobytes(), "image/jpeg"


def simplify_detection_points(points: List[dict]) -> List[DetectionPoint]:
    """Normalize points into DetectionPoint pydantic objects."""
    simplified = []
    for point in points or []:
        try:
            dp = DetectionPoint(
                x=int(point["x"]) if point.get("x") is not None else None,
                y=int(point["y"]) if point.get("y") is not None else None,
                x_rel=float(point["x_rel"]) if point.get("x_rel") is not None else None,
                y_rel=float(point["y_rel"]) if point.get("y_rel") is not None else None,
                score=int(point["score"]) if point.get("score") is not None else None,
                conf=float(point["conf"]) if point.get("conf") is not None else None,
            )
            simplified.append(dp)
        except Exception:
            simplified.append(DetectionPoint(
                x=point.get("x"),
                y=point.get("y"),
                score=point.get("score"),
                conf=point.get("conf")
            ))
    return simplified


def calculate_point_distance(point_a: dict, point_b: dict) -> Optional[float]:
    if point_a.get("x_rel") is not None and point_b.get("x_rel") is not None:
        dx = float(point_a["x_rel"]) - float(point_b["x_rel"])
        dy = float(point_a["y_rel"]) - float(point_b["y_rel"])
        return (dx * dx + dy * dy) ** 0.5
    if point_a.get("x") is not None and point_b.get("x") is not None:
        dx = float(point_a["x"]) - float(point_b["x"])
        dy = float(point_a["y"]) - float(point_b["y"])
        return (dx * dx + dy * dy) ** 0.5
    return None


def find_new_points(baseline_points: List[dict], current_points: List[dict], threshold: float = 0.03) -> List[dict]:
    if not current_points:
        return []

    if not baseline_points:
        return current_points.copy()

    matched_baseline_indices = set()
    new_points = []

    for curr_point in current_points:
        best_distance = None
        best_index = None
        for idx, base_point in enumerate(baseline_points):
            if idx in matched_baseline_indices:
                continue
            distance = calculate_point_distance(base_point, curr_point)
            if distance is not None:
                if best_distance is None or distance < best_distance:
                    best_distance = distance
                    best_index = idx
        if best_distance is not None and best_distance <= threshold:
            matched_baseline_indices.add(best_index)
        else:
            new_points.append(curr_point)
    return new_points


# -------------------------
# WebSocket broadcast hub
# -------------------------
class ConnectionHub:
    def __init__(self, name: str = "hub"):
        self.name = name
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def add(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
            log.info(f"[{self.name}] Client connected. Total: {len(self._connections)}")

    async def remove(self, websocket: WebSocket):
        async with self._lock:
            self._connections.discard(websocket)
            log.info(f"[{self.name}] Client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, data: dict):
        dead_connections = []
        async with self._lock:
            for ws in list(self._connections):
                try:
                    await ws.send_json(data)
                except Exception as e:
                    log.warning(f"[{self.name}] Failed to send to client: {e}")
                    dead_connections.append(ws)
            for ws in dead_connections:
                self._connections.discard(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


frame_broadcast_hub = ConnectionHub("frames")
detection_broadcast_hub = ConnectionHub("detections")


# -------------------------
# Streaming & camera session
# -------------------------
class SettingsManager:
    def __init__(self):
        self._settings = {
            "fps": 1,
            "width": 640,
            "height": 360,
            "format": "webp",
            "quality": 50,
            "emit_frames": True,
            "stream_kind": "crop",
        }
        self._lock = threading.Lock()

    def update(self, settings: dict):
        with self._lock:
            for k, v in settings.items():
                if v is not None and k in self._settings:
                    self._settings[k] = v

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._settings.get(key, default)

    def get_all(self) -> dict:
        with self._lock:
            return self._settings.copy()


stream_settings = SettingsManager()


class CameraSession:
    POINT_MATCH_THRESHOLD_PX = 12
    POINT_MATCH_THRESHOLD_REL = 0.02

    def __init__(self, camera_id: int, rtsp_url: str):
        self.camera_id = int(camera_id)
        self.rtsp_url = rtsp_url
        self.is_active = False

        self._model_thread: Optional[threading.Thread] = None
        self._model_stop_event = threading.Event()
        self._frame_seq = 0  # increment for every read frame
        self._last_processed_seq = -1  # last seq processed by model
        self._model_lock = threading.Lock()  # optional, for safe access if needed

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._capture: Optional[cv2.VideoCapture] = None

        self._frame_count = 0
        self.process_every = 5
        self.model_min_interval_s = 0.5
        self._last_model_time = 0.0

        self._frame_lock = threading.Lock()
        self.first_frame: Optional[np.ndarray] = None
        self.first_frame_timestamp: Optional[float] = None
        self.current_frame: Optional[np.ndarray] = None
        self.current_frame_timestamp: Optional[float] = None

        # detection memory (stream)
        self.detected_points: List[dict] = []
        self.total_score: int = 0

        # per-round upload memory (yuklash uchun)
        self.round_baseline_points: List[dict] = []
        self.upload_index: int = 0

        # diagnostics
        self.last_reconnect_ts: Optional[float] = None
        self.consecutive_failures: int = 0

    # -------------------------
    # Lifecycle
    # -------------------------
    def start(self):
        if self.is_active:
            log.warning(f"[Camera {self.camera_id}] Session already active")
            return
        self._stop_event.clear()
        self._model_stop_event.clear()
        self._thread = threading.Thread(target=self._run, name=f"camera-{self.camera_id}", daemon=True)
        self._model_thread = threading.Thread(
            target=self._model_worker,
            name=f"camera-model-{self.camera_id}",
            daemon=True
        )
        self._thread.start()
        self._model_thread.start()
        self.is_active = True
        log.info(f"[Camera {self.camera_id}] Session started (reader + model worker)")

    def stop(self):
        if not self.is_active:
            return
        log.info(f"[Camera {self.camera_id}] Stopping session...")
        self._stop_event.set()
        self._model_stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        if self._model_thread and self._model_thread.is_alive():
            self._model_thread.join(timeout=3.0)
        if self._capture is not None:
            try:
                self._capture.release()
            except Exception as e:
                log.warning(f"[Camera {self.camera_id}] Error releasing capture: {e}")
        self.is_active = False
        self._reset_state()
        log.info(f"[Camera {self.camera_id}] Session stopped")

    def _reset_state(self):
        with self._frame_lock:
            self.first_frame = None
            self.first_frame_timestamp = None
            self.current_frame = None
            self.current_frame_timestamp = None
        self.detected_points.clear()
        self.total_score = 0
        self.round_baseline_points = []
        self.upload_index = 0
        self.last_reconnect_ts = None
        self.consecutive_failures = 0

    # -------------------------
    # Frames & capture
    # -------------------------
    def get_frames(self) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[float], Optional[float]]:
        """
        Session ichida keshlangan birinchi va hozirgi frame'ni qaytaradi.
        Yangi VideoCapture ochmaydi.
        """
        with self._frame_lock:
            first = self.first_frame.copy() if self.first_frame is not None else None
            current = self.current_frame.copy() if self.current_frame is not None else None
            return first, current, self.first_frame_timestamp, self.current_frame_timestamp

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        try:
            # try forcing tcp transport if possible by appending ?tcp
            rtsp = self.rtsp_url
            if "rtsp://" in rtsp and "?" not in rtsp:
                rtsp_try = rtsp + "?tcp"
            else:
                rtsp_try = rtsp

            cap = cv2.VideoCapture(rtsp_try, cv2.CAP_FFMPEG)
            try:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
            if not cap.isOpened():
                log.error(f"[Camera {self.camera_id}] Failed to open RTSP stream (tried with tcp): {rtsp_try}")
                try:
                    cap.release()
                except Exception:
                    pass
                return None

            # small warm-up: flush first frames
            try:
                for _ in range(2):
                    cap.grab()
            except Exception:
                pass

            self.last_reconnect_ts = time.time()
            self.consecutive_failures = 0
            return cap
        except Exception as e:
            log.exception(f"[Camera {self.camera_id}] Error opening capture: {e}")
            return None

    def _run(self):
        """
        Reader thread:
          - RTSP'dan kadrlarni imkon qadar real vaqtda o‘qiydi,
          - eski buffered kadrlarni grab() bilan tashlab yuboradi,
          - faqat eng so‘nggi kadrni self.current_frame ga yozadi,
          - modelni bu thread ichida ishlatmaydi (model alohida _model_worker da).
        Shuningdek, stream juda uzoq vaqt ochiq turgan bo‘lsa, davriy qayta ochib
        yuboradi (chuqur buffer yig‘ilib ketmasligi uchun).
        """
        backoff = 1.0
        consecutive_read_failures = 0
        max_consecutive_failures_before_reopen = 5

        # RTSP stream'ni davriy qayta ochish uchun (kechikishni cheklash)
        MAX_STREAM_AGE = int(os.getenv("MAX_STREAM_AGE", "30"))  # sekund
        stream_open_time: Optional[float] = None

        def open_capture_safe():
            nonlocal stream_open_time
            try:
                cap = self._open_capture()
                if cap is not None:
                    log.info(f"[Camera {self.camera_id}] Opened capture successfully")
                    stream_open_time = time.time()
                else:
                    log.warning(f"[Camera {self.camera_id}] _open_capture returned None")
                return cap
            except Exception as e:
                log.exception(f"[Camera {self.camera_id}] Exception while opening capture: {e}")
                return None

        # initial open
        self._capture = open_capture_safe()
        if self._capture is None:
            log.warning(f"[Camera {self.camera_id}] Initial capture open failed — will enter reconnect loop")

        while not self._stop_event.is_set():
            # stream juda uzoq ochiq turgan bo‘lsa – qayta ochib yuboramiz
            if self._capture is not None and stream_open_time is not None:
                if (time.time() - stream_open_time) > MAX_STREAM_AGE:
                    log.info(f"[Camera {self.camera_id}] Forcing periodic RTSP reopen to avoid lag")
                    try:
                        self._capture.release()
                    except Exception:
                        pass
                    self._capture = None

            if self._capture is None:
                # try to reopen with backoff
                log.info(f"[Camera {self.camera_id}] Attempting to (re)open RTSP (backoff={backoff}s)...")
                self._capture = open_capture_safe()
                if self._capture is None:
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 16.0)
                    continue
                backoff = 1.0
                consecutive_read_failures = 0

            try:
                # Fast flush: bir necha marta grab() qilib eski kadrlarni tashlaymiz,
                # faqat eng so‘nggi kadrni retrieve()/read() bilan olamiz.
                success, frame = False, None
                try:
                    for _ in range(4):
                        if not self._capture.grab():
                            break
                    success, frame = self._capture.retrieve()
                    if not success or frame is None:
                        success, frame = self._capture.read()
                except Exception:
                    success, frame = self._capture.read()
            except Exception as e:
                log.exception(f"[Camera {self.camera_id}] Exception on capture.read(): {e}")
                success, frame = False, None

            if not success or frame is None:
                consecutive_read_failures += 1
                self.consecutive_failures = consecutive_read_failures
                log.warning(
                    f"[Camera {self.camera_id}] capture.read() failed "
                    f"(consecutive={consecutive_read_failures})"
                )
                if consecutive_read_failures >= max_consecutive_failures_before_reopen:
                    try:
                        self._capture.release()
                    except Exception:
                        pass
                    self._capture = None
                    consecutive_read_failures = 0
                    time.sleep(0.5)
                else:
                    time.sleep(0.1)
                continue

            # successful read -> reset counters
            consecutive_read_failures = 0
            self.consecutive_failures = 0

            # update frames cache (first + current)
            now_ts = time.time()
            with self._frame_lock:
                if self.first_frame is None:
                    self.first_frame = frame.copy()
                    self.first_frame_timestamp = now_ts
                self.current_frame = frame.copy()
                self.current_frame_timestamp = now_ts
                self._frame_seq += 1

            # optional lightweight preview for WebSocket clients
            try:
                if stream_settings.get("emit_frames", True):
                    fmt = stream_settings.get("format", "jpeg")
                    q = int(stream_settings.get("quality", 50))
                    size = (
                        int(stream_settings.get("width", 640)),
                        int(stream_settings.get("height", 360)),
                    )
                    b64, mime = encode_image_to_base64(frame, fmt, q, size)
                    msg = {
                        "action": "frame",
                        "camera_id": self.camera_id,
                        "preview": b64,
                        "mime": mime,
                        "timestamp": now_ts,
                    }
                    if EVENT_LOOP is not None:
                        asyncio.run_coroutine_threadsafe(
                            frame_broadcast_hub.broadcast(msg),
                            EVENT_LOOP
                        )
            except Exception:
                # fail silently for preview broadcasting
                pass

            # throttle reader slightly based on fps setting
            fps = float(stream_settings.get("fps", 5))
            time.sleep(max(0.01, 1.0 / max(1.0, fps)))

        # cleanup
        try:
            if self._capture is not None:
                self._capture.release()
        except Exception:
            pass
        self.is_active = False
        log.info(f"[Camera {self.camera_id}] Reader loop exiting (stop_event set)")

    # -------------------------
    # Model worker (separate thread)
    # -------------------------
    def _model_worker(self):
        """
        Separate thread that always processes the latest available frame.
        U backlog yig‘maydi: har qayta aylanganda self.current_frame ning eng so‘nggi
        versiyasini oladi va faqat yangi seq uchun modelni ishlatadi.
        """
        model = get_model()
        while not self._model_stop_event.is_set():
            # snapshot current frame & seq
            with self._frame_lock:
                frame = None if self.current_frame is None else self.current_frame.copy()
                seq = self._frame_seq

            # nothing to process
            if frame is None or seq == self._last_processed_seq:
                time.sleep(0.02)
                continue

            # throttling by time (model_min_interval_s)
            now = time.time()
            if (now - self._last_model_time) < self.model_min_interval_s:
                time.sleep(0.02)
                continue
            self._last_model_time = now

            # Update last processed sequence early to avoid double-processing same frame
            self._last_processed_seq = seq

            # Run model (blocking here is OK since in separate thread)
            try:
                pipeline_result = model.process_complete_pipeline(frame)
            except Exception as e:
                log.exception(f"[Camera {self.camera_id}] Model pipeline error in model_worker: {e}")
                continue

            # Extract scored_points etc and handle merging/broadcast
            scoring = pipeline_result.get("scoring_results", {}) or {}
            scored_points = scoring.get("scored_points", []) or []
            frame_shape = frame.shape
            public_points = CameraSession._scored_points_to_public(scored_points, frame_shape)

            newly_added = self._merge_detection_points(public_points)

            if newly_added:
                det_msg = {
                    "action": "new_detections",
                    "camera_id": self.camera_id,
                    "timestamp": time.time(),
                    "new_points": newly_added,
                    "total_count": len(self.detected_points),
                    "total_score": self.total_score
                }
                try:
                    if EVENT_LOOP is not None:
                        asyncio.run_coroutine_threadsafe(
                            detection_broadcast_hub.broadcast(det_msg),
                            EVENT_LOOP
                        )
                except Exception as e:
                    log.warning(
                        f"[Camera {self.camera_id}] Failed to broadcast detections from model_worker: {e}"
                    )

            # Optionally cache frames for HTTP endpoints
            try:
                target_info = pipeline_result.get("target_crop_info", {}) or {}
                crop_image = target_info.get("crop")
                visualization = pipeline_result.get("visualization")

                if crop_image is not None:
                    crop_annot = self._annotate_frame(crop_image, newly_added)
                else:
                    crop_annot = None
                if visualization is not None:
                    vis_annot = self._annotate_frame(visualization, newly_added)
                else:
                    vis_annot = None

                base_crop = crop_annot if crop_annot is not None else frame
                self._cache_encoded_frames(base_crop, vis_annot)
            except Exception:
                pass

            # small sleep to yield
            time.sleep(0.01)

        log.info(f"[Camera {self.camera_id}] Model worker exiting")

    # -------------------------
    # Points & detections
    # -------------------------
    def _is_duplicate_point(self, new_point: dict, existing_point: dict) -> bool:
        if new_point.get("x") is not None and existing_point.get("x") is not None:
            dx = float(new_point["x"]) - float(existing_point["x"])
            dy = float(new_point["y"]) - float(existing_point["y"])
            return (dx * dx + dy * dy) <= (self.POINT_MATCH_THRESHOLD_PX ** 2)
        if new_point.get("x_rel") is not None and existing_point.get("x_rel") is not None:
            dx = float(new_point["x_rel"]) - float(existing_point["x_rel"])
            dy = float(new_point["y_rel"]) - float(existing_point["y_rel"])
            return (dx * dx + dy * dy) <= (self.POINT_MATCH_THRESHOLD_REL ** 2)
        return False

    def _merge_detection_points(self, new_points: List[dict]) -> List[dict]:
        """
        Stream davomida topilgan nuqtalarni yagona ro'yxatga merg qiladi.
        Qaytargani – faqat shu chaqiriq ichida YANGI qo'shilgan nuqtalar.
        """
        added_now: List[dict] = []

        for new_point in new_points:
            is_duplicate = False
            for existing_point in self.detected_points:
                if self._is_duplicate_point(new_point, existing_point):
                    # weighted avg for coordinates if absolute coords exist
                    if new_point.get("x") is not None and existing_point.get("x") is not None:
                        existing_point["x"] = int(0.7 * existing_point["x"] + 0.3 * new_point["x"])
                        existing_point["y"] = int(0.7 * existing_point["y"] + 0.3 * new_point["y"])
                    if new_point.get("x_rel") is not None and existing_point.get("x_rel") is not None:
                        existing_point["x_rel"] = 0.7 * existing_point["x_rel"] + 0.3 * new_point["x_rel"]
                        existing_point["y_rel"] = 0.7 * existing_point["y_rel"] + 0.3 * new_point["y_rel"]
                    if new_point.get("score") is not None:
                        existing_point["score"] = max(existing_point.get("score", 0), new_point.get("score"))
                    is_duplicate = True
                    break
            if not is_duplicate:
                p = dict(new_point)
                p["cam_id"] = self.camera_id
                self.detected_points.append(p)
                self.total_score += int(new_point.get("score", 0))
                added_now.append(p)
        return added_now

    def _annotate_frame(self, frame: np.ndarray, new_points: List[dict]) -> Optional[np.ndarray]:
        if frame is None:
            return None
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        def get_pixel_coords(point: dict) -> Tuple[int, int]:
            if point.get("x_rel") is not None and point.get("y_rel") is not None:
                x = int(np.clip(point["x_rel"] * w, 0, w - 1))
                y = int(np.clip(point["y_rel"] * h, 0, h - 1))
            else:
                x = int(np.clip(point.get("x", 0), 0, w - 1))
                y = int(np.clip(point.get("y", 0), 0, h - 1))
            return x, y

        # draw existing points (gray)
        for point in self.detected_points:
            x, y = get_pixel_coords(point)
            cv2.circle(annotated, (x, y), 8, (160, 160, 160), 2)

        # draw new points (red)
        for point in new_points:
            x, y = get_pixel_coords(point)
            cv2.circle(annotated, (x, y), 10, (0, 0, 255), 3)
        return annotated

    def _cache_encoded_frames(self, crop_frame: Optional[np.ndarray], annotated_frame: Optional[np.ndarray]):
        """
        Crop va annotated frame'larni jpeg ga kodlab global frame_cache ga saqlaydi.
        """
        try:
            enc_size = (int(stream_settings.get("width", 640)), int(stream_settings.get("height", 360)))
            quality = int(stream_settings.get("quality", 85))
            cache_key = self.camera_id

            with frame_cache_lock:
                if cache_key not in frame_cache:
                    frame_cache[cache_key] = {}
                if crop_frame is not None:
                    try:
                        jpg_bytes, mime = encode_image_to_jpeg(crop_frame, quality=quality, size=enc_size)
                        frame_cache[cache_key]["crop"] = (jpg_bytes, mime)
                    except Exception as e:
                        log.warning(f"[Camera {self.camera_id}] Failed to encode/cache crop frame: {e}")
                if annotated_frame is not None:
                    try:
                        jpg_bytes, mime = encode_image_to_jpeg(annotated_frame, quality=quality, size=enc_size)
                        frame_cache[cache_key]["annotated"] = (jpg_bytes, mime)
                    except Exception as e:
                        log.warning(f"[Camera {self.camera_id}] Failed to encode/cache annotated frame: {e}")
        except Exception as e:
            log.warning(f"[Camera {self.camera_id}] Frame caching error: {e}")

    def _broadcast_frames(self, crop_frame: Optional[np.ndarray], annotated_frame: Optional[np.ndarray]):
        """
        Crop va annotated frame'larni base64 qilib websocket orqali broadcast qiladi.
        Hozircha _model_worker caching’ni qiladi, bu metod HTTP/websocket uchun kerak bo‘lsa ishlatilishi mumkin.
        """
        try:
            fmt = stream_settings.get("format", "jpeg")
            quality = int(stream_settings.get("quality", 85))
            size = (int(stream_settings.get("width", 640)), int(stream_settings.get("height", 360)))
            kind = stream_settings.get("stream_kind", "crop")

            message = {
                "action": "frame",
                "camera_id": self.camera_id,
                "timestamp": time.time(),
                "total_count": len(self.detected_points),
                "total_score": self.total_score
            }

            if kind in ("crop", "both") and crop_frame is not None:
                try:
                    b64, mime = encode_image_to_base64(crop_frame, fmt, quality, size)
                    message["crop"] = b64
                    message["crop_mime"] = mime
                except Exception as e:
                    log.warning(f"[Camera {self.camera_id}] Failed to encode crop for broadcast: {e}")

            if kind in ("annotated", "both") and annotated_frame is not None:
                try:
                    b64, mime = encode_image_to_base64(annotated_frame, fmt, quality, size)
                    message["annotated"] = b64
                    message["annotated_mime"] = mime
                except Exception as e:
                    log.warning(f"[Camera {self.camera_id}] Failed to encode annotated for broadcast: {e}")

            if EVENT_LOOP is not None:
                try:
                    asyncio.run_coroutine_threadsafe(frame_broadcast_hub.broadcast(message), EVENT_LOOP)
                except Exception as e:
                    log.warning(f"[Camera {self.camera_id}] Failed to schedule broadcast: {e}")
        except Exception as e:
            log.warning(f"[Camera {self.camera_id}] Frame broadcast error: {e}")

    @staticmethod
    def _scored_points_to_public(scored_points: List[dict], frame_shape: Tuple[int, int]) -> List[dict]:
        """
        Modeldan kelgan scored_points -> public dict'lar.
        x,y,conf,score va x_rel/y_rel ni hisoblab beradi.
        """
        out = []
        h, w = frame_shape[:2]
        for p in scored_points or []:
            px = p.get("x")
            py = p.get("y")
            conf = p.get("conf", p.get("confidence"))
            score = p.get("score", p.get("ring", 0))
            if px is None and p.get("x_crop") is not None:
                px = p.get("x_crop")
            if py is None and p.get("y_crop") is not None:
                py = p.get("y_crop")
            point = {
                "x": int(px) if px is not None else None,
                "y": int(py) if py is not None else None,
                "score": int(score) if score is not None else None,
                "conf": float(conf) if conf is not None else None,
            }
            if point["x"] is not None and w > 0:
                point["x_rel"] = float(point["x"]) / float(w)
            if point["y"] is not None and h > 0:
                point["y_rel"] = float(point["y"]) / float(h)
            out.append(point)
        return out

    # -------------------------
    # Upload logic (unchanged)
    # -------------------------
    def register_upload(self, current_points: List[dict], threshold: float) -> List[dict]:
        """
        'Yuklash' bosilganda chaqiriladi.
        current_points – hozirgi kadrdagi barcha teshiklar.
        Qaytaradi – faqat shu upload uchun YANGI nuqtalar (o'q tegishlari).
        """
        if not self.round_baseline_points:
            # Birinchi yuklash: hammasi yangi deb olinadi
            new_points = list(current_points)
        else:
            # Oldingi baseline nuqtalarga nisbatan yangi nuqtalarni topamiz
            new_points = find_new_points(self.round_baseline_points, current_points, threshold)

        # Baseline'ni yangilaymiz (eski + yangi)
        self.round_baseline_points.extend(new_points)
        self.upload_index += 1
        return new_points


# -------------------------
# Stream manager & caches
# -------------------------
class StreamManager:
    def __init__(self):
        self._sessions: Dict[int, CameraSession] = {}
        self._lock = threading.Lock()

    def start_session(self, camera_id: int, rtsp_url: str):
        with self._lock:
            if camera_id in self._sessions:
                session = self._sessions[camera_id]
                if session.is_active:
                    log.info(f"Session for camera {camera_id} already active")
                    return session
            session = CameraSession(camera_id, rtsp_url)
            self._sessions[camera_id] = session
            session.start()
            return session

    def stop_session(self, camera_id: int):
        with self._lock:
            session = self._sessions.get(camera_id)
            if session:
                session.stop()
                log.info(f"Session for camera {camera_id} stopped")

    def restart_session(self, camera_id: int, rtsp_url: Optional[str] = None):
        with self._lock:
            old = self._sessions.get(camera_id)
            if old:
                try:
                    old.stop()
                except Exception:
                    pass
            rtsp = rtsp_url or (old.rtsp_url if old else None)
            if not rtsp:
                raise RuntimeError("No RTSP URL available to restart session")
            session = CameraSession(camera_id, rtsp)
            self._sessions[camera_id] = session
            session.start()
            log.info(f"Session for camera {camera_id} restarted")
            return session

    def get_session(self, camera_id: int) -> Optional[CameraSession]:
        return self._sessions.get(camera_id)

    def get_session_status(self, camera_id: int) -> Dict[str, Any]:
        with self._lock:
            s = self._sessions.get(camera_id)
            if not s:
                return {"active": False}
            return {
                "active": s.is_active,
                "upload_index": getattr(s, "upload_index", 0),
                "detected_count": len(s.detected_points),
                "last_frame_ts": s.current_frame_timestamp,
                "last_reconnect_ts": s.last_reconnect_ts,
                "consecutive_failures": s.consecutive_failures,
            }

    def stop_all(self):
        with self._lock:
            for session in self._sessions.values():
                session.stop()
            self._sessions.clear()
            log.info("All sessions stopped")


stream_manager = StreamManager()

frame_cache: Dict[int, Dict[str, Tuple[bytes, str]]] = {}
frame_cache_lock = threading.Lock()


# -------------------------
# API endpoints
# -------------------------
@router.get("/", include_in_schema=False)
async def index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Index file not found")
    return FileResponse(index_file, media_type="text/html")


@router.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": MODEL is not None,
        "auth_enabled": AUTH_ENABLED,
        "active_sessions": len(stream_manager._sessions),
        "frame_connections": frame_broadcast_hub.connection_count,
        "detection_connections": detection_broadcast_hub.connection_count,
        "active_camera": next(iter(stream_manager._sessions.keys()), None) if stream_manager._sessions else None
    }


@router.get("/cameras", tags=["University Exam"])
async def list_cameras(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    cameras = db.query(Camera).offset(skip).limit(limit).all()
    payload = [_camera_public_payload(camera) for camera in cameras]
    manual_payload = [_manual_camera_public_payload(camera) for camera in MANUAL_CAMERAS.values()]
    combined = sorted(payload + manual_payload, key=lambda item: int(item.get("Id") or 0))
    return combined[skip : skip + limit]


@router.get("/cameras/{camera_id}", tags=["University Exam"])
async def get_camera_info(camera_id: int, db: Session = Depends(get_db)):
    manual_camera = _get_manual_camera(camera_id)
    if manual_camera:
        return _manual_camera_public_payload(manual_camera)
    camera = db.query(Camera).filter(Camera.Id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return _camera_public_payload(camera)


@router.post("/cameras/manual-connect", tags=["Camera Control"])
async def create_manual_camera_connection(payload: ManualCameraConnectRequest):
    camera_id = _next_manual_camera_id()
    camera_config = {
        "Id": camera_id,
        "Description": payload.description.strip(),
        "IpAddress": payload.ip_address.strip(),
        "Port": int(payload.port),
        "Username": payload.username.strip(),
        "PasswordHash": payload.password,
        "Source": payload.source.strip() or "/Streaming/Channels/101",
        "BranchId": 1,
        "CreatedAt": time.time(),
        "UpdatedAt": time.time(),
    }
    MANUAL_CAMERAS[camera_id] = camera_config

    rtsp_url = build_rtsp_url(camera_config)
    connection_status = "saved"
    if payload.auto_start:
        try:
            await run_in_threadpool(lambda: stream_manager.start_session(camera_id, rtsp_url))
            connection_status = "connected"
        except Exception as e:
            connection_status = f"saved_but_not_connected: {str(e)}"

    return {
        "status": connection_status,
        "camera": _manual_camera_public_payload(camera_config),
        "rtsp_url_preview": rtsp_url.replace(payload.password, "***") if payload.password else rtsp_url,
    }


@router.delete("/cameras/{camera_id}/manual", tags=["Camera Control"], include_in_schema=False)
async def delete_manual_camera(camera_id: int):
    camera = MANUAL_CAMERAS.pop(int(camera_id), None)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual camera not found")
    try:
        stream_manager.stop_session(int(camera_id))
    except Exception:
        pass
    return {"status": "deleted", "camera_id": int(camera_id)}


@router.post("/settings", tags=["Configuration"], include_in_schema=False)
async def update_settings(settings: StreamSettings):
    stream_settings.update(settings.model_dump(exclude_unset=True))
    return {"status": "success", "settings": stream_settings.get_all()}


@router.get("/settings", tags=["Configuration"], include_in_schema=False)
async def get_settings():
    return stream_settings.get_all()


@router.post("/cameras/{camera_id}/start", tags=["Camera Control"], include_in_schema=False)
async def start_camera_stream(
    camera_id: int,
    rtsp_url: Optional[str] = Query(None, description="Optional RTSP URL; agar yuborilmasa DB dan olinadi"),
    db: Session = Depends(get_db),
):
    """
    Kamera sessiyasini boshlash.
    Agar `rtsp_url` yuborilmasa, DB dagi Camera yozuvidan RTSP URL quriladi.
    """
    manual_camera = _get_manual_camera(camera_id)
    db_camera = None
    if manual_camera is None:
        try:
            db_camera = await run_in_threadpool(lambda: db.query(Camera).filter(Camera.Id == camera_id).first())
        except Exception as e:
            log.exception("DB query failed while retrieving camera %s", camera_id)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

    if db_camera is None and manual_camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Camera {camera_id} not found")

    if rtsp_url is None:
        try:
            cfg = manual_camera or camera_to_config(db_camera)
            rtsp_url = await run_in_threadpool(lambda: build_rtsp_url(cfg))
        except ValueError as ve:
            log.warning("Camera %s cannot produce RTSP URL: %s", camera_id, str(ve))
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except Exception as e:
            log.exception("Failed to build RTSP URL for camera %s", camera_id)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to build RTSP URL")

    if not isinstance(rtsp_url, str) or not rtsp_url.strip().startswith("rtsp://"):
        log.warning("Invalid RTSP URL for camera %s: %s", camera_id, str(rtsp_url)[:200])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RTSP URL (must start with rtsp://)"
        )

    try:
        log.info("Starting session for camera %s using provided/generated RTSP URL", camera_id)
        await run_in_threadpool(lambda: stream_manager.start_session(camera_id, rtsp_url))
    except Exception as e:
        log.exception("Failed to start session for camera %s", camera_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start camera stream: {str(e)}"
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "success", "camera_id": camera_id, "message": "Camera stream started"}
    )


@router.post("/cameras/{camera_id}/restart", tags=["Camera Control"], include_in_schema=False)
async def restart_camera_stream(camera_id: int, db: Session = Depends(get_db)):
    try:
        db_camera = await run_in_threadpool(lambda: db.query(Camera).filter(Camera.Id == camera_id).first())
    except Exception as e:
        log.exception("DB query failed while retrieving camera %s", camera_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
    if db_camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Camera {camera_id} not found")

    try:
        rtsp_url = await run_in_threadpool(lambda: build_rtsp_url(camera_to_config(db_camera)))
    except ValueError as ve:
        log.warning("Camera %s cannot produce RTSP URL: %s", camera_id, str(ve))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        log.exception("Failed to build RTSP URL for camera %s", camera_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to build RTSP URL")

    try:
        await run_in_threadpool(lambda: stream_manager.restart_session(camera_id, rtsp_url))
    except Exception as e:
        log.exception("Failed to restart session for camera %s", camera_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"status": "restarted", "camera_id": camera_id}


@router.get("/cameras/{camera_id}/status", tags=["Camera Control"], include_in_schema=False)
async def camera_status(camera_id: int):
    status_info = stream_manager.get_session_status(camera_id)
    return status_info


@router.get("/test/{camera_id}/first-frame", tags=["Test"], include_in_schema=False)
async def test_first(camera_id: int):
    session_ = stream_manager.get_session(camera_id)
    if not session_:
        raise HTTPException(status_code=404, detail="Camera session not found")

    first_camera, _, _, _ = session_.get_frames()
    if first_camera is None:
        raise HTTPException(status_code=503, detail="First frame not available")

    annotated_frame = first_camera.copy()
    model = get_model()

    first_res = await run_in_threadpool(lambda: model.process_complete_pipeline(annotated_frame))
    first_frame_points = first_res.get("scoring_results", {}).get("scored_points", []) or []

    h, w = annotated_frame.shape[:2]
    for p in first_frame_points:
        if p.get("x_rel") is not None and p.get("y_rel") is not None:
            x = int(p["x_rel"] * w)
            y = int(p["y_rel"] * h)
        else:
            x = int(p.get("x", 0))
            y = int(p.get("y", 0))
        cv2.circle(annotated_frame, (x, y), 12, (0, 0, 255), 3)

    jpg_bytes, mime_type = encode_image_to_jpeg(annotated_frame, quality=100)

    return Response(
        content=jpg_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


@router.get("/test/{camera_id}/current-frame", tags=["Test"], include_in_schema=False)
async def test_current_frame(camera_id: int):
    session_ = stream_manager.get_session(camera_id)
    if not session_:
        raise HTTPException(status_code=404, detail="Camera session not found")

    _, current_camera, _, _ = session_.get_frames()
    if current_camera is None:
        raise HTTPException(status_code=503, detail="Current frame not available")

    annotated_frame = current_camera.copy()
    model = get_model()

    current_res = await run_in_threadpool(lambda: model.process_complete_pipeline(annotated_frame))
    current_frame_points = current_res.get("scoring_results", {}).get("scored_points", []) or []

    h, w = annotated_frame.shape[:2]
    for p in current_frame_points:
        if p.get("x_rel") is not None and p.get("y_rel") is not None:
            x = int(p["x_rel"] * w)
            y = int(p["y_rel"] * h)
        else:
            x = int(p.get("x", 0))
            y = int(p.get("y", 0))
        cv2.circle(annotated_frame, (x, y), 12, (0, 0, 255), 3)

    jpg_bytes, mime_type = encode_image_to_jpeg(annotated_frame, quality=100)

    return Response(
        content=jpg_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


@router.post("/cameras/{camera_id}/stop", tags=["Camera Control"], include_in_schema=False)
async def stop_camera_stream(camera_id: int):
    stream_manager.stop_session(camera_id)
    return {"status": "success", "camera_id": camera_id, "message": "Camera stream stopped"}


@router.get("/cameras/{camera_id}/frame", tags=["Camera Feed"], include_in_schema=False)
async def get_camera_frame(camera_id: int, kind: str = Query("crop", regex="^(crop|annotated)$")):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera session not found")

    first_frame, current_frame, first_ts, current_ts = session.get_frames()
    timeout = time.time() + 5.0
    while (first_frame is None or current_frame is None) and time.time() < timeout:
        await asyncio.sleep(0.1)
        first_frame, current_frame, first_ts, current_ts = session.get_frames()

    if first_frame is None or current_frame is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Frames not available")

    model = get_model()
    try:
        first_res = await run_in_threadpool(lambda: model.process_complete_pipeline(first_frame))
        curr_res = await run_in_threadpool(lambda: model.process_complete_pipeline(current_frame))
    except Exception as e:
        log.exception("Detection failed during frame comparison")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Detection failed: {str(e)}")

    first_points = first_res.get("scoring_results", {}).get("scored_points", []) or []
    curr_points = curr_res.get("scoring_results", {}).get("scored_points", []) or []

    first_pub = CameraSession._scored_points_to_public(first_points, first_frame.shape)
    curr_pub = CameraSession._scored_points_to_public(curr_points, current_frame.shape)

    new_points = find_new_points(first_pub, curr_pub, threshold=0.03)

    annotated_frame = current_frame.copy()
    h, w = annotated_frame.shape[:2]
    for p in new_points:
        if p.get("x_rel") is not None and p.get("y_rel") is not None:
            x = int(p["x_rel"] * w)
            y = int(p["y_rel"] * h)
        else:
            x = int(p.get("x", 0))
            y = int(p.get("y", 0))
        cv2.circle(annotated_frame, (x, y), 12, (0, 0, 255), 3)

    jpg_bytes, mime_type = encode_image_to_jpeg(annotated_frame, quality=90)

    return Response(
        content=jpg_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


@router.get("/cameras/{camera_id}/detections", tags=["Detection"], include_in_schema=False)
async def get_camera_detections(camera_id: int):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera session not found")
    return {
        "camera_id": camera_id,
        "total_count": len(session.detected_points),
        "total_score": session.total_score,
        "points": simplify_detection_points(session.detected_points)
    }


@router.get("/cameras/{camera_id}/compare", tags=["Detection"], include_in_schema=False)
async def compare_first_and_current(camera_id: int):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera session not found")

    first_frame, current_frame, first_ts, current_ts = session.get_frames()
    timeout = time.time() + 5.0
    while (first_frame is None or current_frame is None) and time.time() < timeout:
        await asyncio.sleep(0.1)
        first_frame, current_frame, first_ts, current_ts = session.get_frames()
    if first_frame is None or current_frame is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Frames not available")

    model = get_model()
    try:
        first_res = await run_in_threadpool(lambda: model.process_complete_pipeline(first_frame))
        curr_res = await run_in_threadpool(lambda: model.process_complete_pipeline(current_frame))
    except Exception as e:
        log.exception("Detection failed during comparison")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Detection failed: {str(e)}")

    first_points = first_res.get("scoring_results", {}).get("scored_points", []) or []
    curr_points = curr_res.get("scoring_results", {}).get("scored_points", []) or []

    first_pub = [p for p in CameraSession._scored_points_to_public(first_points, first_frame.shape)]
    curr_pub = [p for p in CameraSession._scored_points_to_public(curr_points, current_frame.shape)]

    return {
        "camera_id": camera_id,
        "first": {"timestamp": first_ts, "count": len(first_pub), "points": simplify_detection_points(first_pub)},
        "current": {"timestamp": current_ts, "count": len(curr_pub), "points": simplify_detection_points(curr_pub)}
    }


@router.get("/cameras/{camera_id}/new-points", tags=["Detection"], include_in_schema=False)
async def get_new_points(
    camera_id: int,
    threshold: float = Query(0.03, ge=0.001, le=0.2),
):
    """
    'Yuklash' tugmasi uchun endpoint.
    Hozircha eski logika: har safar current_frame dan model o‘tkazib,
    session.register_upload orqali yangi nuqtalarni topadi.
    """
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera session not found")

    # Hozirgi frame'ni session'dan olamiz
    _, current_frame, first_ts, current_ts = session.get_frames()
    timeout = time.time() + 5.0
    while current_frame is None and time.time() < timeout:
        await asyncio.sleep(0.1)
        _, current_frame, first_ts, current_ts = session.get_frames()

    if current_frame is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to obtain current frame from camera session"
        )

    model = get_model()
    try:
        curr_res = await run_in_threadpool(lambda: model.process_complete_pipeline(current_frame))
    except Exception as e:
        log.exception("Detection failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Detection failed: {str(e)}")

    curr_points = curr_res.get("scoring_results", {}).get("scored_points", []) or []
    curr_pub = CameraSession._scored_points_to_public(curr_points, current_frame.shape)

    # Har 'yuklash' bosilganda shu chaqiriladi
    new_points = session.register_upload(curr_pub, threshold)
    log.info(
        f"[Camera {camera_id}] upload_index={session.upload_index}, "
        f"current_count={len(curr_pub)}, new_count={len(new_points)}"
    )

    return {
        "camera_id": camera_id,
        "upload_index": session.upload_index,
        "first_timestamp": first_ts,
        "current_timestamp": current_ts,
        "current_count": len(curr_pub),
        "new_count": len(new_points),
        "new_points": simplify_detection_points(new_points)
    }



class CaptureRequestModel(BaseModel):
    candidate_id: Optional[str] = None
    soldier_id: Optional[str] = None
    round_type: Optional[str] = Field(default=None, pattern="^(test|main)$")
    shot_count: int = Field(default=1, ge=1, le=10)
    reset_state: bool = False


class ParticipantSessionState:
    def __init__(self, participant_id: str, camera_id: int):
        self.participant_id = participant_id
        self.camera_id = int(camera_id)
        self.test_scores: List[int] = []
        self.main_scores: List[int] = []
        self.created_at = time.time()
        self.completed_at: Optional[float] = None

    @property
    def total_score(self) -> int:
        return int(sum(self.main_scores))

    @property
    def total_test_points(self) -> int:
        return int(sum(self.test_scores))

    @property
    def total_main_points(self) -> int:
        return int(sum(self.main_scores))

    @property
    def test_shots(self) -> int:
        return len(self.test_scores)

    @property
    def main_shots(self) -> int:
        return len(self.main_scores)

    @property
    def is_completed(self) -> bool:
        return self.completed_at is not None or self.main_shots >= 5

    def next_round(self) -> str:
        return "test" if self.test_shots < 3 else "main"

    def add_shots(self, scores: List[int], round_type: Optional[str] = None) -> Dict[str, Any]:
        resolved_round = round_type or self.next_round()
        accepted: List[int] = []
        rejected: List[int] = []

        for score in scores:
            if resolved_round == "test":
                if self.test_shots < 3:
                    self.test_scores.append(int(score))
                    accepted.append(int(score))
                    if self.test_shots >= 3:
                        resolved_round = "main"
                else:
                    resolved_round = "main"

            if resolved_round == "main":
                if self.main_shots < 5:
                    self.main_scores.append(int(score))
                    accepted.append(int(score))
                else:
                    rejected.append(int(score))

        if self.main_shots >= 5 and self.completed_at is None:
            self.completed_at = time.time()

        return {
            "accepted_scores": accepted,
            "rejected_scores": rejected,
            "round_type": round_type or ("main" if self.test_shots >= 3 else "test"),
            "session_completed": self.is_completed,
        }

    def summary(self) -> Dict[str, Any]:
        shots = self.test_scores + self.main_scores
        histogram = {}
        for s in shots:
            histogram[str(s)] = histogram.get(str(s), 0) + 1
        total_shots = len(shots)
        return {
            "participant_id": self.participant_id,
            "camera_id": self.camera_id,
            "test_scores": list(self.test_scores),
            "main_scores": list(self.main_scores),
            "total_score": self.total_score,
            "total_test_points": self.total_test_points,
            "total_main_points": self.total_main_points,
            "test_shots": self.test_shots,
            "main_shots": self.main_shots,
            "histogram": histogram,
            "average_score": (sum(shots) / total_shots) if total_shots else 0.0,
            "is_completed": self.is_completed,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }


participant_sessions: Dict[str, ParticipantSessionState] = {}
participant_sessions_lock = threading.Lock()


def _resolve_participant_id(candidate_id: Optional[str], soldier_id: Optional[str]) -> Optional[str]:
    return (candidate_id or soldier_id or "").strip() or None


def _image_payload(image: Optional[np.ndarray], quality: int = 90) -> Optional[Dict[str, Any]]:
    if image is None:
        return None
    try:
        base64_image, mime_type = encode_image_to_base64(image, image_format="jpeg", quality=quality)
        return {
            "image": base64_image,
            "mime_type": mime_type,
            "size": [int(image.shape[1]), int(image.shape[0])],
        }
    except Exception as e:
        log.warning("Unable to encode visualization: %s", e)
        return None


def _build_histogram(points: List[dict]) -> Dict[str, Any]:
    hist: Dict[str, int] = {}
    total_score = 0
    for point in points or []:
        score = int(point.get("score", 0) or 0)
        total_score += score
        hist[str(score)] = hist.get(str(score), 0) + 1
    total_shots = len(points or [])
    distribution = {k: (v / total_shots * 100.0 if total_shots else 0.0) for k, v in hist.items()}
    return {
        "total_shots": total_shots,
        "average_score": (total_score / total_shots) if total_shots else 0.0,
        "histogram": hist,
        "distribution": distribution,
    }


def _select_best_points(points: List[dict], limit: int = 1) -> List[dict]:
    ranked = sorted(
        points or [],
        key=lambda p: (-(p.get("score") or 0), -(p.get("conf") or 0.0), p.get("dist") or 10**9),
    )
    return ranked[: max(1, limit)]


@router.post("/cameras/{camera_id}/activate", tags=["Camera Control"])
async def activate_camera_alias(camera_id: int, db: Session = Depends(get_db)):
    return await start_camera_stream(camera_id=camera_id, rtsp_url=None, db=db)


@router.post("/cameras/{camera_id}/clear-baseline", tags=["Detection"])
async def clear_baseline(camera_id: int):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera session not found")
    session.round_baseline_points = []
    session.upload_index = 0
    return {"status": "success", "camera_id": camera_id, "message": "Baseline cleared"}


@router.get("/cameras/{camera_id}/test-capture", tags=["Test"])
async def test_capture(camera_id: int):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=404, detail="Camera session not found")

    _, current_frame, _, _ = session.get_frames()
    if current_frame is None:
        raise HTTPException(status_code=503, detail="Current frame not available")

    model = get_model()
    result = await run_in_threadpool(lambda: model.process_complete_pipeline(current_frame))
    visualization = result.get("visualization")
    if visualization is None:
        visualization = current_frame
    jpg_bytes, mime_type = encode_image_to_jpeg(visualization, quality=90)
    return Response(content=jpg_bytes, media_type=mime_type, headers={"Cache-Control": "no-store"})


@router.post("/participants/{participant_id}/start", tags=["Exam Sessions"], include_in_schema=False)
async def start_participant_session(participant_id: str, camera_id: int = Query(..., ge=1)):
    participant_id = participant_id.strip()
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=404, detail="Camera session not found. Activate camera first.")

    with participant_sessions_lock:
        participant = ParticipantSessionState(participant_id=participant_id, camera_id=camera_id)
        participant_sessions[participant_id] = participant

    session.round_baseline_points = []
    session.upload_index = 0

    return {
        "status": "started",
        "session": {
            "candidate_id": participant_id,
            "total_score": 0,
            "test_shots": 0,
            "main_shots": 0,
            "total_test_points": 0,
            "total_main_points": 0,
            "is_completed": False,
            "created_at": participant.created_at,
        },
    }


@router.get("/participants/{participant_id}/status", tags=["Exam Sessions"], include_in_schema=False)
async def get_participant_status(participant_id: str):
    with participant_sessions_lock:
        participant = participant_sessions.get(participant_id.strip())
    if not participant:
        raise HTTPException(status_code=404, detail="Participant session not found")
    return {"candidate_id": participant.participant_id, **participant.summary()}


@router.post("/participants/{participant_id}/complete", tags=["Exam Sessions"], include_in_schema=False)
async def complete_participant_session(participant_id: str):
    with participant_sessions_lock:
        participant = participant_sessions.get(participant_id.strip())
        if not participant:
            raise HTTPException(status_code=404, detail="Participant session not found")
        if participant.completed_at is None:
            participant.completed_at = time.time()
        summary = participant.summary()
    return {"status": "completed", "summary": summary}


@router.post("/soldiers/{participant_id}/start", tags=["Exam Sessions"], include_in_schema=False)
async def start_soldier_session_alias(participant_id: str, camera_id: int = Query(..., ge=1)):
    return await start_participant_session(participant_id=participant_id, camera_id=camera_id)


@router.get("/soldiers/{participant_id}/status", tags=["Exam Sessions"], include_in_schema=False)
async def get_soldier_status_alias(participant_id: str):
    return await get_participant_status(participant_id=participant_id)


@router.post("/soldiers/{participant_id}/complete", tags=["Exam Sessions"], include_in_schema=False)
async def complete_soldier_session_alias(participant_id: str):
    return await complete_participant_session(participant_id=participant_id)


@router.post("/cameras/{camera_id}/capture", tags=["Detection"], include_in_schema=False)
async def capture_frame_for_exam(camera_id: int, payload: CaptureRequestModel):
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=404, detail="Camera session not found")

    participant_id = _resolve_participant_id(payload.candidate_id, payload.soldier_id)
    participant = None
    if participant_id:
        with participant_sessions_lock:
            participant = participant_sessions.get(participant_id)
        if participant is None:
            raise HTTPException(status_code=404, detail="Participant session not found")

    if payload.reset_state:
        session.round_baseline_points = []
        session.upload_index = 0

    _, current_frame, _, current_ts = session.get_frames()
    timeout = time.time() + 5.0
    while current_frame is None and time.time() < timeout:
        await asyncio.sleep(0.1)
        _, current_frame, _, current_ts = session.get_frames()

    if current_frame is None:
        raise HTTPException(status_code=503, detail="Current frame not available")

    model = get_model()
    try:
        pipeline_result = await run_in_threadpool(lambda: model.process_complete_pipeline(current_frame))
    except Exception as e:
        log.exception("Capture pipeline failed")
        raise HTTPException(status_code=500, detail=f"Detection failed: {e}")

    scoring = pipeline_result.get("scoring_results", {}) or {}
    scored_points = scoring.get("scored_points", []) or []
    public_points = CameraSession._scored_points_to_public(scored_points, current_frame.shape)
    new_points = session.register_upload(public_points, threshold=0.03)
    new_points = _select_best_points(new_points, limit=payload.shot_count)

    if new_points:
        session.detected_points.extend([])

    shot_result = None
    if participant is not None:
        current_round = payload.round_type or participant.next_round()
        score_values = [int(p.get("score", 0) or 0) for p in new_points]
        update_result = participant.add_shots(score_values, round_type=current_round)
        shot_result = {
            "candidate_id": participant.participant_id,
            "soldier_id": participant.participant_id,
            "round_type": current_round,
            "shot_count": len(score_values),
            "timestamp": current_ts or time.time(),
            "total_score": int(sum(score_values)),
            "points": new_points,
            "histogram": _build_histogram(new_points),
            "session_completed": update_result["session_completed"],
            "session_summary": participant.summary(),
        }

    visualization_payload = _image_payload(pipeline_result.get("visualization"), quality=90)
    all_points = public_points

    return {
        "camera_id": camera_id,
        "candidate_id": participant_id,
        "soldier_id": participant_id,
        "timestamp": current_ts or time.time(),
        "total_points_detected": len(all_points),
        "new_points_count": len(new_points),
        "new_points": new_points,
        "all_points": all_points,
        "total_score": int(sum(int(p.get("score", 0) or 0) for p in all_points)),
        "histogram": _build_histogram(all_points),
        "visualization": visualization_payload,
        "shot_result": shot_result,
        "profile": scoring.get("profile", "archery_exam"),
    }


# -------------------------
# WebSocket endpoints
# -------------------------
@router.websocket("/ws/frames")
async def websocket_frames(websocket: WebSocket):
    await frame_broadcast_hub.add(websocket)
    try:
        while True:
            try:
                message = await websocket.receive_json()
            except Exception as e:
                log.warning(f"Invalid message received from client: {e}")
                await websocket.send_json({"action": "error", "message": "Invalid message format"})
                continue

            action = message.get("action")

            if action == "settings":
                settings_data = message.get("settings", {})
                stream_settings.update(settings_data)
                await websocket.send_json({
                    "action": "settings_updated",
                    "settings": stream_settings.get_all()
                })

            elif action == "ping":
                await websocket.send_json({"action": "pong", "timestamp": time.time()})

            elif action == "frame":
                camera_id = message.get("camera_id")
                if camera_id is None:
                    await websocket.send_json({"action": "error", "message": "Missing camera_id"})
                    continue

                session = stream_manager.get_session(camera_id)
                if not session:
                    await websocket.send_json({"action": "error", "message": "Camera session not found"})
                    continue

                _, current_frame, _, _ = session.get_frames()
                if current_frame is None:
                    await websocket.send_json({"action": "error", "message": "Frames not available"})
                    continue

                try:
                    fmt = stream_settings.get("format", "jpeg")
                    quality = int(stream_settings.get("quality", 85))
                    size = (
                        int(stream_settings.get("width", 640)),
                        int(stream_settings.get("height", 360)),
                    )
                    b64, mime = encode_image_to_base64(current_frame, fmt, quality, size)
                    await websocket.send_json({
                        "action": "frame",
                        "camera_id": camera_id,
                        "frame": b64,
                        "mime": mime,
                        "timestamp": time.time(),
                    })
                except Exception as e:
                    log.exception(f"Error encoding/sending frame: {e}")
                    await websocket.send_json({"action": "error", "message": str(e)})

            else:
                await websocket.send_json({
                    "action": "error",
                    "message": f"Unknown action: {action}"
                })

    except WebSocketDisconnect:
        log.info("Frame WebSocket client disconnected normally")
    except Exception as e:
        log.exception(f"Unhandled Frame WebSocket error: {e}")
        try:
            await websocket.send_json({"action": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await frame_broadcast_hub.remove(websocket)
        try:
            await websocket.close()
        except Exception:
            pass
        log.info("Frame WebSocket connection fully cleaned up")


@router.websocket("/ws/detections")
async def websocket_detections(websocket: WebSocket):
    await detection_broadcast_hub.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        log.info("Detection WebSocket client disconnected")
    except Exception as e:
        log.exception(f"Detection WebSocket error: {e}")
    finally:
        await detection_broadcast_hub.remove(websocket)


# -------------------------
# Startup & shutdown
# -------------------------
@router.on_event("startup")
async def startup_event():
    global EVENT_LOOP
    EVENT_LOOP = asyncio.get_running_loop()
    log.info("🚀 AI Service starting up...")

    def load_bg():
        try:
            load_model()
            log.info("✅ Model loaded successfully (background)")
        except Exception as e:
            log.exception("❌ Failed to load model in background")

    threading.Thread(target=load_bg, daemon=True).start()


@router.on_event("shutdown")
async def shutdown_event():
    log.info("🛑 AI Service shutting down...")
    stream_manager.stop_all()
    log.info("✅ Shutdown complete")


import httpx


@router.get("/cameras/{camera_id}/preview", response_class=HTMLResponse, include_in_schema=False)
async def proxy_camera_preview(camera_id: int, db: Session = Depends(get_db)):
    """
    Proxy camera preview page through backend.
    Loads http://<IpAddress>/doc/page/preview.asp and returns it as HTML.
    """
    camera = db.query(Camera).filter(Camera.Id == camera_id).first()
    if not camera or not getattr(camera, "IpAddress", None):
        raise HTTPException(status_code=404, detail="Camera not found or missing IP address")

    ip = camera.IpAddress
    port = getattr(camera, "Port", 80) or 80
    url = f"http://{ip}:{port}/doc/page/preview.asp"

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
        return HTMLResponse(content=resp.text, status_code=resp.status_code)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to load camera page: {e}")
