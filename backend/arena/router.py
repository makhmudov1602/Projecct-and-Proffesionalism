from __future__ import annotations

import asyncio
import threading
import time
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ai.service import (
    CameraSession,
    _build_histogram,
    _image_payload,
    _select_best_points,
    get_model,
    stream_manager,
)

router = APIRouter(prefix="/arena", tags=["Arena Sessions"])

GameMode = Literal["archery", "rifle"]
SessionStatus = Literal["waiting", "active", "finished"]


class CreateSessionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    mode: GameMode = "archery"
    max_shots: int = Field(default=5, ge=1, le=20)
    location: Optional[str] = Field(default=None, max_length=120)


class AddPlayerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    nickname: Optional[str] = Field(default=None, max_length=50)
    photo_url: Optional[str] = Field(default=None, max_length=100000)
    camera_id: Optional[int] = Field(default=None, ge=1)


class CapturePlayerRequest(BaseModel):
    camera_id: int = Field(..., ge=1)
    shot_count: int = Field(default=1, ge=1, le=3)
    mode: Optional[GameMode] = None


PROFILE_PRESETS: Dict[str, Dict[str, List[float] | List[int]]] = {
    "archery": {
        "ring_ratios": [0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72, 0.80],
        "scores": [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    },
    "rifle": {
        "ring_ratios": [0.05, 0.10, 0.16, 0.23, 0.31, 0.40, 0.50, 0.62, 0.76, 0.92],
        "scores": [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    },
}


class ArenaPlayer:
    def __init__(
        self,
        name: str,
        nickname: Optional[str] = None,
        photo_url: Optional[str] = None,
        camera_id: Optional[int] = None,
    ):
        self.id = uuid.uuid4().hex[:10]
        self.name = name.strip()
        self.nickname = nickname.strip() if nickname else None
        self.photo_url = photo_url
        self.camera_id = camera_id
        self.shots: List[int] = []
        self.hit_count = 0
        self.created_at = time.time()

    @property
    def total_score(self) -> int:
        return int(sum(self.shots))

    @property
    def last_shot(self) -> Optional[int]:
        return self.shots[-1] if self.shots else None

    @property
    def average_score(self) -> float:
        return round(self.total_score / len(self.shots), 2) if self.shots else 0.0

    @property
    def tens_count(self) -> int:
        return sum(1 for shot in self.shots if shot == 10)

    @property
    def best_shot(self) -> int:
        return max(self.shots) if self.shots else 0

    def to_public(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "nickname": self.nickname,
            "photo_url": self.photo_url,
            "camera_id": self.camera_id,
            "shots": list(self.shots),
            "shots_used": len(self.shots),
            "total_score": self.total_score,
            "average_score": self.average_score,
            "last_shot": self.last_shot,
            "best_shot": self.best_shot,
            "tens_count": self.tens_count,
            "hit_count": self.hit_count,
            "created_at": self.created_at,
        }


class ArenaSession:
    def __init__(self, title: str, mode: GameMode, max_shots: int, location: Optional[str] = None):
        self.id = uuid.uuid4().hex[:10]
        self.title = title.strip()
        self.mode = mode
        self.max_shots = max_shots
        self.location = location
        self.status: SessionStatus = "waiting"
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.finished_at: Optional[float] = None
        self.players: Dict[str, ArenaPlayer] = {}
        self.shots: List[Dict[str, Any]] = []

    def add_player(self, player: ArenaPlayer) -> ArenaPlayer:
        self.players[player.id] = player
        return player

    def start(self):
        self.status = "active"
        self.started_at = time.time()

    def finish(self):
        self.status = "finished"
        self.finished_at = time.time()

    def scoreboard(self) -> List[Dict[str, Any]]:
        ranked = sorted(
            self.players.values(),
            key=lambda p: (-p.total_score, -p.tens_count, -p.best_shot, p.name.lower()),
        )
        board: List[Dict[str, Any]] = []
        for idx, player in enumerate(ranked, start=1):
            row = player.to_public()
            row["rank"] = idx
            row["remaining_shots"] = max(0, self.max_shots - len(player.shots))
            row["is_finished"] = len(player.shots) >= self.max_shots
            board.append(row)
        return board

    def summary(self) -> Dict[str, Any]:
        scoreboard = self.scoreboard()
        winner = scoreboard[0] if scoreboard else None
        return {
            "id": self.id,
            "title": self.title,
            "mode": self.mode,
            "max_shots": self.max_shots,
            "location": self.location,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "player_count": len(self.players),
            "players": scoreboard,
            "winner": winner,
            "shots": list(self.shots),
        }


arena_sessions: Dict[str, ArenaSession] = {}
arena_lock = threading.Lock()


def _score_point_for_mode(point: Dict[str, Any], mode: GameMode, target_crop_info: Dict[str, Any]) -> Dict[str, Any]:
    profile = PROFILE_PRESETS[mode]
    bbox = target_crop_info.get("bbox") or (0, 0, 1, 1)
    x1, y1, x2, y2 = bbox
    crop_w = max(1, int(x2 - x1))
    crop_h = max(1, int(y2 - y1))
    center = target_crop_info.get("target_center") or ((x1 + x2) // 2, (y1 + y2) // 2)
    center_x, center_y = center

    px = point.get("x")
    py = point.get("y")
    if px is None or py is None:
        return {**point, "score": 0, "ring": 0}

    dx = float(px) - float(center_x)
    dy = float(py) - float(center_y)
    distance = (dx * dx + dy * dy) ** 0.5
    max_radius = min(crop_w, crop_h) / 2.0
    normalized = distance / max_radius if max_radius > 0 else 999.0

    score = 0
    ring = 0
    for idx, (ratio, value) in enumerate(zip(profile["ring_ratios"], profile["scores"]), start=1):
        if normalized <= float(ratio):
            score = int(value)
            ring = idx
            break

    return {**point, "score": score, "ring": ring, "dist_ratio": round(normalized, 4)}


def _simulate_detection(mode: GameMode) -> Dict[str, Any]:
    import random

    profile = PROFILE_PRESETS[mode]
    ring_idx = random.randint(0, len(profile["scores"]) - 1)
    score = int(profile["scores"][ring_idx])
    return {
        "point": {
            "x": 320 + random.randint(-70, 70),
            "y": 240 + random.randint(-70, 70),
            "x_rel": 0.5,
            "y_rel": 0.5,
            "score": score,
            "ring": ring_idx + 1,
            "conf": 0.9,
        },
        "visualization": None,
        "profile": mode,
        "raw_points": [],
    }


async def _capture_and_score(camera_id: int, mode: GameMode, shot_count: int) -> Dict[str, Any]:
    session = stream_manager.get_session(camera_id)
    if not session:
        raise HTTPException(status_code=404, detail="Camera session not found. Activate camera first.")

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
    except Exception:
        simulated = _simulate_detection(mode)
        return {
            "timestamp": current_ts or time.time(),
            "new_points": [simulated["point"]],
            "all_points": [simulated["point"]],
            "visualization": simulated["visualization"],
            "profile": mode,
            "histogram": _build_histogram([simulated["point"]]),
        }

    scoring = pipeline_result.get("scoring_results", {}) or {}
    scored_points = scoring.get("scored_points", []) or []
    public_points = CameraSession._scored_points_to_public(scored_points, current_frame.shape)
    rescored = [_score_point_for_mode(point, mode, pipeline_result.get("target_crop_info", {})) for point in public_points]
    new_points = session.register_upload(rescored, threshold=0.03)
    new_points = _select_best_points(new_points, limit=shot_count)
    rescored_new = [_score_point_for_mode(point, mode, pipeline_result.get("target_crop_info", {})) for point in new_points]

    return {
        "timestamp": current_ts or time.time(),
        "new_points": rescored_new,
        "all_points": rescored,
        "visualization": _image_payload(pipeline_result.get("visualization"), quality=90),
        "profile": mode,
        "histogram": _build_histogram(rescored),
    }


@router.post("/sessions")
async def create_session(payload: CreateSessionRequest):
    session = ArenaSession(
        title=payload.title,
        mode=payload.mode,
        max_shots=payload.max_shots,
        location=payload.location,
    )
    with arena_lock:
        arena_sessions[session.id] = session
    return {"status": "created", "session": session.summary()}


@router.get("/sessions")
async def list_sessions():
    with arena_lock:
        items = [session.summary() for session in arena_sessions.values()]
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session.summary()


@router.post("/sessions/{session_id}/players")
async def add_player(session_id: str, payload: AddPlayerRequest):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        player = ArenaPlayer(
            name=payload.name,
            nickname=payload.nickname,
            photo_url=payload.photo_url,
            camera_id=payload.camera_id,
        )
        session.add_player(player)
        return {"status": "player_added", "player": player.to_public(), "session": session.summary()}


@router.post("/sessions/{session_id}/start")
async def start_session(session_id: str):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if not session.players:
            raise HTTPException(status_code=400, detail="Add at least one player before starting")
        session.start()
        return {"status": "started", "session": session.summary()}


@router.post("/sessions/{session_id}/finish")
async def finish_session(session_id: str):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session.finish()
        return {"status": "finished", "session": session.summary()}


@router.get("/sessions/{session_id}/scoreboard")
async def get_scoreboard(session_id: str):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "session_id": session.id,
            "title": session.title,
            "mode": session.mode,
            "status": session.status,
            "max_shots": session.max_shots,
            "scoreboard": session.scoreboard(),
            "winner": session.scoreboard()[0] if session.scoreboard() else None,
        }


@router.get("/sessions/{session_id}/shots")
async def get_shots(session_id: str):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "session_id": session.id,
            "mode": session.mode,
            "shots": list(session.shots),
        }


@router.post("/sessions/{session_id}/players/{player_id}/capture")
async def capture_for_player(session_id: str, player_id: str, payload: CapturePlayerRequest):
    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        player = session.players.get(player_id)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Session is not active")
        if len(player.shots) >= session.max_shots:
            raise HTTPException(status_code=400, detail="Player has no remaining shots")

    resolved_mode = payload.mode or session.mode
    capture = await _capture_and_score(payload.camera_id, resolved_mode, payload.shot_count)
    new_points = capture["new_points"] or []
    if not new_points:
        raise HTTPException(status_code=409, detail="New hit was not detected. Try again.")

    accepted_points = new_points[: max(1, min(payload.shot_count, session.max_shots - len(player.shots)))]
    accepted_scores = [int(point.get("score", 0) or 0) for point in accepted_points]

    with arena_lock:
        session = arena_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        player = session.players.get(player_id)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")

        for point, score in zip(accepted_points, accepted_scores):
            player.shots.append(score)
            player.hit_count += 1
            session.shots.append(
                {
                    "id": uuid.uuid4().hex[:12],
                    "player_id": player.id,
                    "player_name": player.name,
                    "camera_id": payload.camera_id,
                    "mode": resolved_mode,
                    "shot_index": len(player.shots),
                    "score": score,
                    "ring": point.get("ring"),
                    "x": point.get("x"),
                    "y": point.get("y"),
                    "x_rel": point.get("x_rel"),
                    "y_rel": point.get("y_rel"),
                    "timestamp": capture["timestamp"],
                }
            )

        if all(len(p.shots) >= session.max_shots for p in session.players.values()):
            session.finish()

        scoreboard = session.scoreboard()
        winner = scoreboard[0] if scoreboard else None
        return {
            "status": "captured",
            "session_id": session.id,
            "mode": resolved_mode,
            "player": player.to_public(),
            "accepted_scores": accepted_scores,
            "accepted_points": accepted_points,
            "visualization": capture["visualization"],
            "histogram": capture["histogram"],
            "scoreboard": scoreboard,
            "winner": winner,
            "session_status": session.status,
            "remaining_shots": max(0, session.max_shots - len(player.shots)),
            "profile": resolved_mode,
        }
