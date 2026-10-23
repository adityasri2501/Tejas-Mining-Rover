import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "server" / ".env")
DB_PATH = Path(os.getenv("LOCATION_DB", str(ROOT / "server" / "locations.sqlite3")))
TOKEN = os.getenv("ROVER_INGEST_TOKEN", "")
SWITCH_MARGIN_DB = float(os.getenv("SWITCH_MARGIN_DB", "5"))
STABLE_SCANS = int(os.getenv("STABLE_SCANS", "3"))
LOCK = threading.Lock()
SMOOTHED: dict[tuple[str, str], float] = {}

with (ROOT / "nodes.json").open("r", encoding="utf-8") as file:
    NODE_LIST = json.load(file)["nodes"]
NODES = {node["node_id"]: node for node in NODE_LIST}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    with connect_db() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS rover_state (
            rover_id TEXT PRIMARY KEY,
            current_node_id TEXT,
            current_rssi REAL,
            last_fetched_at TEXT,
            last_location_at TEXT,
            visible_node_count INTEGER NOT NULL DEFAULT 0,
            candidate_node_id TEXT,
            candidate_count INTEGER NOT NULL DEFAULT 0
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rover_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            node_label TEXT NOT NULL,
            rssi REAL,
            fetched_at TEXT NOT NULL
        )""")


class NodeReading(BaseModel):
    node_id: str = Field(min_length=1, max_length=80)
    rssi: int = Field(ge=-127, le=20)


class ScanReport(BaseModel):
    rover_id: str = Field(default="rover-01", min_length=1, max_length=80)
    nodes: list[NodeReading] = Field(default_factory=list, max_length=100)


app = FastAPI(title="Rover BLE Location PoC")
initialize_db()


@app.get("/")
def dashboard():
    return FileResponse(ROOT / "web" / "index.html")


@app.get("/api/nodes")
def list_nodes():
    return [{"node_id": node["node_id"], "label": node["label"], "location": node["location"]} for node in NODE_LIST]


@app.post("/api/scan")
def receive_scan(report: ScanReport, authorization: Optional[str] = Header(default=None)):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid rover ingest token")

    received_at = now_iso()
    known = [reading for reading in report.nodes if reading.node_id in NODES]
    values: dict[str, float] = {}
    for reading in known:
        key = (report.rover_id, reading.node_id)
        previous = SMOOTHED.get(key, float(reading.rssi))
        values[reading.node_id] = 0.65 * reading.rssi + 0.35 * previous
        SMOOTHED[key] = values[reading.node_id]

    with LOCK, connect_db() as db:
        row = db.execute("SELECT * FROM rover_state WHERE rover_id = ?", (report.rover_id,)).fetchone()
        current_id = row["current_node_id"] if row else None
        current_rssi = row["current_rssi"] if row else None
        candidate_id = row["candidate_node_id"] if row else None
        candidate_count = row["candidate_count"] if row else 0
        last_location_at = row["last_location_at"] if row else None
        chosen_rssi = values.get(current_id) if current_id else None

        if values:
            best_id = max(values, key=values.get)
            best_rssi = values[best_id]
            if best_id == current_id:
                current_rssi = best_rssi
                candidate_id, candidate_count = None, 0
            else:
                current_seen = current_id in values if current_id else False
                clearly_stronger = current_id is None or not current_seen or best_rssi >= (chosen_rssi or -127) + SWITCH_MARGIN_DB
                if clearly_stronger:
                    if candidate_id == best_id:
                        candidate_count += 1
                    else:
                        candidate_id, candidate_count = best_id, 1
                else:
                    candidate_id, candidate_count = None, 0

                if candidate_count >= STABLE_SCANS:
                    current_id = best_id
                    current_rssi = best_rssi
                    chosen_rssi = best_rssi
                    candidate_id, candidate_count = None, 0
                    last_location_at = received_at
                    node = NODES[current_id]
                    db.execute(
                        "INSERT INTO location_history (rover_id,node_id,node_label,rssi,fetched_at) VALUES (?,?,?,?,?)",
                        (report.rover_id, current_id, node["label"], round(best_rssi), received_at),
                    )
                elif current_id in values:
                    current_rssi = values[current_id]

        db.execute("""INSERT INTO rover_state
            (rover_id,current_node_id,current_rssi,last_fetched_at,last_location_at,visible_node_count,candidate_node_id,candidate_count)
            VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(rover_id) DO UPDATE SET
              current_node_id=excluded.current_node_id,
              current_rssi=excluded.current_rssi,
              last_fetched_at=excluded.last_fetched_at,
              last_location_at=excluded.last_location_at,
              visible_node_count=excluded.visible_node_count,
              candidate_node_id=excluded.candidate_node_id,
              candidate_count=excluded.candidate_count""",
            (report.rover_id, current_id, current_rssi, received_at, last_location_at, len(values), candidate_id, candidate_count),
        )

    return {"ok": True, "received_at": received_at, "visible_nodes": len(values)}


def state_json(rover_id: str):
    with connect_db() as db:
        row = db.execute("SELECT * FROM rover_state WHERE rover_id = ?", (rover_id,)).fetchone()
    if not row:
        return {
            "rover_id": rover_id,
            "node_id": None,
            "label": None,
            "location": None,
            "rssi": None,
            "last_fetched_at": None,
            "last_location_at": None,
            "visible_nodes": 0,
        }
    node = NODES.get(row["current_node_id"])
    return {
        "rover_id": rover_id,
        "node_id": row["current_node_id"],
        "label": node["label"] if node else None,
        "location": node["location"] if node else None,
        "rssi": round(row["current_rssi"]) if row["current_rssi"] is not None else None,
        "last_fetched_at": row["last_fetched_at"],
        "last_location_at": row["last_location_at"],
        "visible_nodes": row["visible_node_count"],
    }


@app.get("/api/rovers/{rover_id}/location")
def latest_location(rover_id: str):
    return state_json(rover_id)


@app.get("/api/rovers/{rover_id}/history")
def location_history(rover_id: str, limit: int = 50):
    limit = max(1, min(limit, 200))
    with connect_db() as db:
        rows = db.execute(
            "SELECT node_id,node_label,rssi,fetched_at FROM location_history WHERE rover_id = ? ORDER BY id DESC LIMIT ?",
            (rover_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]