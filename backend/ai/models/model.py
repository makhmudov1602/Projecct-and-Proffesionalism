import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

logger = logging.getLogger(__name__)

DRAW_RADIUS = 6


class GeometryUtils:
    @staticmethod
    def point_in_rect(x: int, y: int, rects: List[Tuple[int, int, int, int]]) -> bool:
        for rx, ry, rw, rh in rects or []:
            if rx <= x < rx + rw and ry <= y < ry + rh:
                return True
        return False


class WhiteFilter:
    """
    Juda yorqin oq hududlarda yuzaga keladigan yolg'on deteksiyalarni kamaytirish.
    Oqartirilgan nishon markazi yoki reflekslar bo'lsa, shu filtr yordam beradi.
    """

    def __init__(self, sat_max: int = 80, val_min: int = 200, radius: int = 10):
        self.sat_max = sat_max
        self.val_min = val_min
        self.radius = radius

    def filter_points_by_white(
        self,
        crop_image: np.ndarray,
        points: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if crop_image is None or crop_image.size == 0 or not points:
            return points or [], []

        hsv = cv2.cvtColor(crop_image, cv2.COLOR_BGR2HSV)
        kept: List[Dict[str, Any]] = []
        dropped: List[Dict[str, Any]] = []
        h, w = crop_image.shape[:2]

        for point in points:
            x = int(point.get("x", 0))
            y = int(point.get("y", 0))
            x = int(np.clip(x, 0, w - 1))
            y = int(np.clip(y, 0, h - 1))

            x1 = max(0, x - self.radius)
            y1 = max(0, y - self.radius)
            x2 = min(w, x + self.radius + 1)
            y2 = min(h, y + self.radius + 1)
            patch = hsv[y1:y2, x1:x2]
            if patch.size == 0:
                kept.append(point)
                continue

            sat = patch[:, :, 1]
            val = patch[:, :, 2]
            white_ratio = float(np.mean((sat <= self.sat_max) & (val >= self.val_min)))

            if white_ratio > 0.85:
                dropped.append(point)
            else:
                kept.append(point)

        return kept, dropped


@dataclass(frozen=True)
class ScoringProfile:
    name: str
    ring_ratios: List[float]
    scores: List[int]


def _profile_from_env() -> ScoringProfile:
    profile_name = os.getenv("TARGET_SCORING_PROFILE", "archery_arena").strip().lower()

    presets = {
        # Archery arena uchun standart 10 halqali profil.
        "archery_arena": ScoringProfile(
            name="archery_arena",
            ring_ratios=[0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72, 0.80],
            scores=[10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        ),
        # Eski nishon tizimiga yaqinroq 6 ta halqa.
        "radial_6": ScoringProfile(
            name="radial_6",
            ring_ratios=[0.18, 0.36, 0.54, 0.72, 0.90, 1.08],
            scores=[10, 9, 8, 7, 6, 5],
        ),
        # Soddalashtirilgan tir/dart radial profili.
        "dart_radial": ScoringProfile(
            name="dart_radial",
            ring_ratios=[0.06, 0.12, 0.22, 0.34, 0.48, 0.64, 0.80],
            scores=[10, 9, 8, 7, 6, 5, 4],
        ),
    }

    env_ratios = os.getenv("TARGET_RING_RATIOS", "").strip()
    env_scores = os.getenv("TARGET_RING_SCORES", "").strip()
    if env_ratios and env_scores:
        try:
            ratios = [float(x.strip()) for x in env_ratios.split(",") if x.strip()]
            scores = [int(x.strip()) for x in env_scores.split(",") if x.strip()]
            if ratios and len(ratios) == len(scores):
                return ScoringProfile(
                    name=profile_name or "custom",
                    ring_ratios=sorted(ratios),
                    scores=scores,
                )
        except Exception:
            logger.warning("Custom TARGET_RING_RATIOS / TARGET_RING_SCORES could not be parsed")

    presets["archery_exam"] = presets["archery_arena"]
    presets["rifle_range"] = ScoringProfile(
        name="rifle_range",
        ring_ratios=[0.05, 0.10, 0.16, 0.23, 0.31, 0.40, 0.50, 0.62, 0.76, 0.92],
        scores=[10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    )

    return presets.get(profile_name, presets["archery_arena"])


class RingScorer:
    def __init__(self):
        self.geometry = GeometryUtils()
        self.profile = _profile_from_env()
        self.border_shrink = float(os.getenv("TARGET_BORDER_SHRINK", "0.98"))

    def calculate_ring_radii(self, frame_shape: Tuple[int, int]) -> List[float]:
        height, width = frame_shape[:2]
        min_half_size = min(height, width) / 2.0
        return [ratio * min_half_size * self.border_shrink for ratio in self.profile.ring_ratios]

    def determine_ring_value(self, distance: float, radii: List[float]) -> Tuple[int, int]:
        for index, (radius, score) in enumerate(zip(radii, self.profile.scores), start=1):
            if distance <= radius:
                return index, score
        return 0, 0

    def score_points(
        self,
        points: List[Dict[str, Any]],
        crop_shape: Tuple[int, int],
        crop_x1: int,
        crop_y1: int,
        ignore_rects: List[Tuple[int, int, int, int]],
        target_center_global: Optional[Tuple[int, int]] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        if not points:
            return [], 0

        crop_h, crop_w = crop_shape[:2]
        if target_center_global is not None:
            cx_global, cy_global = target_center_global
            crop_center_x = float(cx_global - crop_x1)
            crop_center_y = float(cy_global - crop_y1)
        else:
            crop_center_x = float(crop_w) / 2.0
            crop_center_y = float(crop_h) / 2.0

        radii = self.calculate_ring_radii((crop_h, crop_w))
        scored_points: List[Dict[str, Any]] = []
        total_score = 0

        for point in points:
            x_crop = int(point["x"]) - crop_x1
            y_crop = int(point["y"]) - crop_y1

            if x_crop < 0 or y_crop < 0 or x_crop >= crop_w or y_crop >= crop_h:
                continue
            if ignore_rects and self.geometry.point_in_rect(x_crop, y_crop, ignore_rects):
                continue

            distance = float(np.hypot(x_crop - crop_center_x, y_crop - crop_center_y))
            ring_index, score = self.determine_ring_value(distance, radii)
            scored_points.append(
                {
                    **point,
                    "ring": ring_index,
                    "score": score,
                    "dist": distance,
                    "x_crop": x_crop,
                    "y_crop": y_crop,
                }
            )
            total_score += score

        scored_points.sort(key=lambda p: (-p["score"], p["dist"], -p.get("conf", 0.0)))
        return scored_points, int(total_score)


class UnifiedBulletModel:
    """
    YOLO asosidagi nishon + zarba nuqtasi detektori.
    Model nomi tarixiy sabablarga ko'ra saqlab qolingan, lekin endi uni
    kamon, tir va umumiy nishon senariylarida ishlatish mumkin.
    """

    def __init__(
        self,
        target_model_path: str,
        bullet_model_path: str,
        target_conf_threshold: float = 0.25,
        bullet_conf_threshold: float = 0.25,
        mask_threshold: float = 0.5,
        min_target_area: int = 1000,
    ):
        try:
            self.target_model = YOLO(target_model_path)
            self.bullet_model = YOLO(bullet_model_path)
        except Exception as e:
            logger.error("Failed to load models: %s", e)
            raise

        self.target_conf_threshold = target_conf_threshold
        self.bullet_conf_threshold = bullet_conf_threshold
        self.mask_threshold = mask_threshold
        self.min_target_area = min_target_area

        self.white_filter = WhiteFilter()
        self.ring_scorer = RingScorer()
        self.geometry = GeometryUtils()

        logger.info(
            "✓ Loaded models: target=%s impact=%s profile=%s",
            target_model_path,
            bullet_model_path,
            self.ring_scorer.profile.name,
        )

    def mask_to_uint8(self, mask_tensor, target_h: int, target_w: int) -> np.ndarray:
        try:
            m_arr = mask_tensor.cpu().numpy()
        except Exception:
            m_arr = np.array(mask_tensor)

        if m_arr.ndim == 3 and m_arr.shape[0] == 1:
            m_arr = m_arr[0]
        if m_arr.max() > 1.0:
            m_arr = m_arr / 255.0

        m_bin = (m_arr > self.mask_threshold).astype(np.uint8) * 255
        if m_bin.shape != (target_h, target_w):
            m_bin = cv2.resize(m_bin, (target_w, target_h), interpolation=cv2.INTER_NEAREST)
        return m_bin

    def bbox_from_mask(self, mask_uint8: np.ndarray):
        cnts, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            return None
        allc = np.vstack(cnts)
        x, y, w, h = cv2.boundingRect(allc)
        return int(x), int(y), int(x + w), int(y + h)

    def detect_target_crop(self, image: np.ndarray) -> Dict[str, Any]:
        h, w = image.shape[:2]
        results = self.target_model(image, conf=self.target_conf_threshold)[0]

        best_crop = None
        best_bbox = None
        best_mask = None
        max_area = 0

        if hasattr(results, "masks") and results.masks is not None:
            masks_data = results.masks.data
            for i in range(masks_data.shape[0]):
                mask_uint8 = self.mask_to_uint8(masks_data[i], h, w)
                bbox = self.bbox_from_mask(mask_uint8)
                if bbox is None:
                    continue
                x1, y1, x2, y2 = bbox
                area = (x2 - x1) * (y2 - y1)
                if area > max_area and area >= self.min_target_area:
                    max_area = area
                    best_bbox = bbox
                    best_mask = mask_uint8
                    best_crop = image[y1:y2, x1:x2]

        if best_crop is None and hasattr(results, "boxes") and results.boxes is not None and len(results.boxes) > 0:
            boxes = results.boxes.xyxy.cpu().numpy()
            for box in boxes:
                x1, y1, x2, y2 = map(int, box)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w - 1, x2), min(h - 1, y2)
                area = (x2 - x1) * (y2 - y1)
                if area > max_area and area >= self.min_target_area:
                    max_area = area
                    best_bbox = (x1, y1, x2, y2)
                    best_crop = image[y1:y2, x1:x2]

        if best_crop is None:
            best_crop = image
            best_bbox = (0, 0, w, h)
            best_mask = None
            logger.warning("No target detected, using full image")

        x1, y1, x2, y2 = best_bbox
        if best_mask is not None:
            mask_crop = best_mask[y1:y2, x1:x2]
            M = cv2.moments(mask_crop)
            if M.get("m00", 0) != 0:
                cx = int(M["m10"] / M["m00"]) + x1
                cy = int(M["m01"] / M["m00"]) + y1
            else:
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
        else:
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

        return {
            "success": best_crop is not None,
            "crop": best_crop,
            "bbox": best_bbox,
            "mask": best_mask,
            "original_shape": (h, w),
            "target_center": (int(cx), int(cy)),
        }

    def detect_bullet_holes(self, image: np.ndarray, origin: Tuple[int, int] = (0, 0)) -> List[Dict[str, Any]]:
        results = self.bullet_model(image, conf=self.bullet_conf_threshold)[0]
        detections: List[Dict[str, Any]] = []

        if results.boxes is not None and len(results.boxes) > 0:
            boxes = results.boxes.xyxy.cpu().numpy()
            confidences = results.boxes.conf.cpu().numpy()
            x_off, y_off = origin
            for (x1, y1, x2, y2), confidence in zip(boxes, confidences):
                center_x = int((x1 + x2) * 0.5) + x_off
                center_y = int((y1 + y2) * 0.5) + y_off
                detections.append({"x": int(center_x), "y": int(center_y), "conf": float(confidence)})

        return detections

    def score_bullet_holes(
        self,
        bullet_points: List[Dict[str, Any]],
        image_shape: Tuple[int, int],
        target_crop_info: Dict[str, Any],
        target_center: Optional[Tuple[int, int]] = None,
        ignore_regions: Optional[List[Tuple[int, int, int, int]]] = None,
    ) -> Dict[str, Any]:
        ignore_regions = ignore_regions or []
        filtered_points, dropped_points = self.white_filter.filter_points_by_white(
            target_crop_info["crop"], bullet_points
        )

        x1, y1, x2, y2 = target_crop_info["bbox"]
        crop_h = y2 - y1
        crop_w = x2 - x1
        center_to_use = target_center if target_center is not None else target_crop_info.get("target_center")

        scored_points, total_score = self.ring_scorer.score_points(
            filtered_points,
            (crop_h, crop_w),
            x1,
            y1,
            ignore_regions,
            target_center_global=center_to_use,
        )

        return {
            "scored_points": scored_points,
            "total_score": total_score,
            "dropped_points": dropped_points,
            "target_center": center_to_use,
            "profile": self.ring_scorer.profile.name,
        }

    def create_visualization(
        self,
        crop_image: np.ndarray,
        target_crop_info: Dict[str, Any],
        scoring_results: Dict[str, Any],
    ) -> np.ndarray:
        vis_image = crop_image.copy()
        x1, y1, x2, y2 = target_crop_info["bbox"]
        crop_h, crop_w = vis_image.shape[:2]

        center = scoring_results.get("target_center") or target_crop_info.get("target_center")
        if center is not None:
            cx_global, cy_global = center
            crop_cx = int(cx_global - x1)
            crop_cy = int(cy_global - y1)
        else:
            crop_cx = crop_w // 2
            crop_cy = crop_h // 2

        for radius in self.ring_scorer.calculate_ring_radii((crop_h, crop_w)):
            cv2.circle(vis_image, (crop_cx, crop_cy), int(radius), (220, 220, 220), 1)

        for point in scoring_results.get("scored_points", []):
            x = int(point["x_crop"])
            y = int(point["y_crop"])
            score = int(point.get("score", 0))
            color = (0, 255, 0) if score > 0 else (0, 0, 255)
            cv2.circle(vis_image, (x, y), DRAW_RADIUS, color, -1)
            cv2.circle(vis_image, (x, y), DRAW_RADIUS, (255, 255, 255), 2)
            cv2.putText(
                vis_image,
                str(score),
                (x + 10, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )

        cv2.circle(vis_image, (crop_cx, crop_cy), 8, (0, 0, 0), 3)
        cv2.circle(vis_image, (crop_cx, crop_cy), 8, (255, 255, 255), 2)
        cv2.putText(
            vis_image,
            f"TOTAL: {scoring_results['total_score']}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
        )
        cv2.putText(
            vis_image,
            f"PROFILE: {scoring_results.get('profile', 'unknown')}",
            (10, 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2,
        )
        return vis_image

    def process_complete_pipeline(
        self,
        image: np.ndarray,
        output_dir: Optional[str] = None,
        save_intermediate: bool = False,
    ) -> Dict[str, Any]:
        target_crop_info = self.detect_target_crop(image)
        crop_image = target_crop_info["crop"]
        x1, y1, _, _ = target_crop_info["bbox"]
        impact_detections = self.detect_bullet_holes(crop_image, origin=(x1, y1))
        scoring_results = self.score_bullet_holes(
            impact_detections,
            image.shape,
            target_crop_info,
            target_center=None,
        )
        visualization = self.create_visualization(crop_image, target_crop_info, scoring_results)

        return {
            "target_crop_info": target_crop_info,
            "bullet_detections": impact_detections,
            "impact_detections": impact_detections,
            "scoring_results": scoring_results,
            "visualization": visualization,
            "total_score": scoring_results["total_score"],
        }
