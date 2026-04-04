"""
ML Bridge Service — Connects intrusion-suite detection to HMS.

Consumes detection data from the intrusion-suite detection service WebSocket,
and relays alerts/overlays to HMS via its API and WebSocket.

Usage:
    Activate env: E:\\CSIR\\env\\Scripts\\activate
    python bridge.py
"""
import asyncio
import json
import os
import time
import websockets
import httpx
from pathlib import Path

# Configuration
HMS_API_URL = os.getenv("HMS_API_URL", "http://localhost:3000")
HMS_WS_URL = os.getenv("HMS_WS_URL", "ws://localhost:4000")
DETECTION_WS_URL = os.getenv("DETECTION_WS_URL", "ws://localhost:8010/ws/detections")
DETECTION_API_URL = os.getenv("DETECTION_API_URL", "http://localhost:8010")
ML_API_KEY = os.getenv("ML_API_KEY", "hms-ml-key-2026")
CAMERA_ID = os.getenv("CAMERA_ID", "default")

# Rate limiting: don't flood HMS with alerts
ALERT_COOLDOWN_SEC = 5.0
last_alert_time: dict[str, float] = {}

# Surveillance status per camera
surveillance_active: dict[str, bool] = {}


async def connect_hms_ws():
    """Connect to HMS media server WebSocket."""
    while True:
        try:
            ws = await websockets.connect(HMS_WS_URL, ping_interval=20, ping_timeout=10)
            print(f"[bridge] Connected to HMS WS: {HMS_WS_URL}")
            return ws
        except Exception as e:
            print(f"[bridge] Failed to connect to HMS WS: {e}, retrying in 3s...")
            await asyncio.sleep(3)


async def send_hms_ws(ws, msg_type: str, payload: dict):
    """Send a message to HMS WebSocket."""
    msg = json.dumps({
        "type": msg_type,
        "payload": payload,
        "timestamp": int(time.time() * 1000)
    })
    try:
        await ws.send(msg)
    except Exception as e:
        print(f"[bridge] Failed to send WS message: {e}")


async def post_alert(alert_data: dict):
    """Post alert to HMS API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{HMS_API_URL}/api/alerts/ml",
                json=alert_data,
                headers={"x-api-key": ML_API_KEY}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"[bridge] Alert posted: {data.get('data', {}).get('alertId', 'unknown')}")
            else:
                print(f"[bridge] Alert post failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"[bridge] Alert post error: {e}")


def should_alert(camera_id: str, cls: str) -> bool:
    """Rate-limit alerts per camera+class."""
    key = f"{camera_id}:{cls}"
    now = time.time()
    if key in last_alert_time:
        if now - last_alert_time[key] < ALERT_COOLDOWN_SEC:
            return False
    last_alert_time[key] = now
    return True


def classify_detection(cls: str) -> tuple[str, str]:
    """Map detected class to alert type and risk level."""
    animal_classes = {"dog", "cat", "bird", "horse", "cow", "elephant", "bear", "zebra", "giraffe", "monkey"}
    weapon_classes = {"knife", "scissors", "baseball bat"}
    fire_classes = {"fire", "smoke"}
    food_classes = {"pizza", "bottle", "cup", "bowl", "banana", "apple", "sandwich", "hot dog", "donut", "cake"}

    cls_lower = cls.lower()
    if cls_lower in animal_classes:
        return "ANIMAL_INTRUSION", "YELLOW"
    elif cls_lower in weapon_classes:
        return "WEAPON", "RED"
    elif cls_lower in fire_classes:
        return "FIRE_DETECTED", "RED"
    elif cls_lower in food_classes:
        return "FOOD_INTRUSION", "YELLOW"
    elif cls_lower == "person":
        return "UNAUTHORIZED_PERSON", "YELLOW"
    else:
        return "ANIMAL_INTRUSION", "YELLOW"


async def listen_hms_ws(hms_ws):
    """Listen for messages from HMS (e.g., SURVEILLANCE_TOGGLE)."""
    try:
        async for message in hms_ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                payload = data.get("payload", {})

                if msg_type == "SURVEILLANCE_TOGGLE":
                    cam_id = payload.get("cameraId")
                    active = payload.get("active", True)
                    surveillance_active[cam_id] = active
                    print(f"[bridge] Surveillance {'ON' if active else 'OFF'} for camera {cam_id}")

            except json.JSONDecodeError:
                continue
    except websockets.exceptions.ConnectionClosed:
        print("[bridge] HMS WS connection closed")
    except Exception as e:
        print(f"[bridge] HMS WS listener error: {e}")


async def sync_zones_loop():
    """Periodically fetch zones from HMS and update the detection service."""
    while True:
        try:
            # 1. Fetch zones from HMS DB
            async with httpx.AsyncClient(timeout=10.0) as client:
                hms_resp = await client.get(f"{HMS_API_URL}/api/cameras/{CAMERA_ID}/zones")
                if hms_resp.status_code == 200:
                    zones_data = hms_resp.json().get("data", [])
                    
                    # 2. Format zones for detection service
                    # HMS zones currently might have id, name, type, points
                    # detection-service expects format {"id": str, "name": str, "type": str, "points": [[x,y]]}
                    detection_zones = []
                    for z in zones_data:
                        pts = z.get("points", [])
                        if not pts: continue
                        # scale normalized points to 640x480 for the ML service since the UI uses 100x100 relative
                        scaled_pts = [[int(p["x"] * 6.4), int(p["y"] * 4.8)] for p in pts]
                        detection_zones.append({
                            "id": z.get("id"),
                            "name": z.get("name", "Zone"),
                            "type": z.get("type", "restricted"),
                            "points": scaled_pts
                        })

                    # 3. Send update to detection service
                    detect_resp = await client.post(
                        f"{DETECTION_API_URL}/detector/update-zones",
                        json={"zones": detection_zones}
                    )
                    if detect_resp.status_code != 200:
                        print(f"[bridge] Warning: Failed to sync zones to detectsvc: {detect_resp.text}")
        except Exception as e:
            pass # suppress zone sync error logs to avoid spam
            
        await asyncio.sleep(10.0)  # Every 10 seconds


async def relay_detections():
    """Main loop: connect to detection service WS and relay to HMS."""
    hms_ws = await connect_hms_ws()

    # Start HMS listener and zone sync in background
    asyncio.create_task(listen_hms_ws(hms_ws))
    asyncio.create_task(sync_zones_loop())

    while True:
        try:
            print(f"[bridge] Connecting to detection service: {DETECTION_WS_URL}")
            async with websockets.connect(DETECTION_WS_URL, ping_interval=20, ping_timeout=10) as detect_ws:
                print("[bridge] Connected to detection service")

                async for message in detect_ws:
                    try:
                        data = json.loads(message)
                        boxes = data.get("boxes", [])
                        frame_w = data.get("width", 640)
                        frame_h = data.get("height", 480)
                        fps = data.get("fps", 0)

                        if not boxes:
                            continue

                        # Check if surveillance is active for this camera
                        if not surveillance_active.get(CAMERA_ID, True):
                            continue

                        # Forward detection overlay to HMS dashboard
                        overlay_payload = {
                            "cameraId": CAMERA_ID,
                            "boxes": boxes,
                            "fps": fps,
                            "width": frame_w,
                            "height": frame_h
                        }
                        await send_hms_ws(hms_ws, "DETECTION_OVERLAY", overlay_payload)

                        # Check for alertable detections
                        for box in boxes:
                            cls = box.get("cls", "unknown")
                            conf = box.get("conf", 0)
                            zone = box.get("zone")
                            event = box.get("event")

                            # Only alert on significant detections
                            if conf < 0.45:
                                continue

                            alert_type, risk_level = classify_detection(cls)

                            # Zone intrusion events get elevated
                            if event == "intrusion" and zone:
                                risk_level = "RED"
                                await send_hms_ws(hms_ws, "ZONE_INTRUSION", {
                                    "cameraId": CAMERA_ID,
                                    "zone": zone,
                                    "cls": cls,
                                    "confidence": conf,
                                    "riskLevel": risk_level
                                })

                            # Rate-limited alert posting
                            if should_alert(CAMERA_ID, cls):
                                xyxy = box.get("xyxy", [0, 0, 0, 0])
                                alert_data = {
                                    "cameraId": CAMERA_ID,
                                    "type": alert_type,
                                    "class": cls,
                                    "confidence": conf,
                                    "boundingBox": {
                                        "x": int(xyxy[0]),
                                        "y": int(xyxy[1]),
                                        "w": int(xyxy[2] - xyxy[0]),
                                        "h": int(xyxy[3] - xyxy[1])
                                    },
                                    "zone": zone,
                                    "riskLevel": risk_level,
                                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                }

                                # Post alert to HMS API
                                asyncio.create_task(post_alert(alert_data))

                                # Broadcast ML_ALERT via WS
                                await send_hms_ws(hms_ws, "ML_ALERT", alert_data)

                                # Trigger buzzer for RED alerts
                                if risk_level == "RED":
                                    await send_hms_ws(hms_ws, "BUZZER_CONTROL", {
                                        "cameraId": CAMERA_ID,
                                        "action": "on",
                                        "tone": "high"
                                    })

                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        print(f"[bridge] Processing error: {e}")

        except websockets.exceptions.ConnectionClosed:
            print("[bridge] Detection WS closed, reconnecting in 3s...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"[bridge] Detection WS error: {e}, reconnecting in 3s...")
            await asyncio.sleep(3)

        # Reconnect HMS WS if needed
        try:
            await hms_ws.ping()
        except Exception:
            hms_ws = await connect_hms_ws()
            asyncio.create_task(listen_hms_ws(hms_ws))


if __name__ == "__main__":
    print("=" * 50)
    print("  HMS ML Bridge Service")
    print("=" * 50)
    print(f"  Detection WS: {DETECTION_WS_URL}")
    print(f"  HMS API:      {HMS_API_URL}")
    print(f"  HMS WS:       {HMS_WS_URL}")
    print(f"  Camera ID:    {CAMERA_ID}")
    print("=" * 50)
    asyncio.run(relay_detections())
