import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bleak import BleakScanner
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
SERVER_URL = os.getenv("LOCATION_SERVER_URL", "http://127.0.0.1:8100").rstrip("/")
ROVER_ID = os.getenv("ROVER_ID", "rover-01")
TOKEN = os.getenv("ROVER_INGEST_TOKEN", "")
SCAN_SECONDS = float(os.getenv("SCAN_SECONDS", "2.5"))

with (HERE.parent / "nodes.json").open("r", encoding="utf-8") as file:
    node_config = json.load(file)["nodes"]
NAME_TO_ID = {node["advertisement_name"].strip().lower(): node["node_id"] for node in node_config}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def main():
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    print(f"Scanning BLE nodes for {ROVER_ID}; posting to {SERVER_URL}/api/scan")
    while True:
        started = time.monotonic()
        observed = {}
        try:
            advertisements = await BleakScanner.discover(timeout=SCAN_SECONDS, return_adv=True)
            for device, advertisement in advertisements.values():
                name = (advertisement.local_name or device.name or "").strip().lower()
                node_id = NAME_TO_ID.get(name)
                if node_id is None:
                    continue
                rssi = int(advertisement.rssi)
                if node_id not in observed or rssi > observed[node_id]:
                    observed[node_id] = rssi

            report = {
                "rover_id": ROVER_ID,
                "observed_at": utc_now(),
                "nodes": [{"node_id": node_id, "rssi": rssi} for node_id, rssi in observed.items()],
            }
            response = requests.post(f"{SERVER_URL}/api/scan", json=report, headers=headers, timeout=5)
            response.raise_for_status()
            nearest = max(observed, key=observed.get) if observed else None
            print(f"{utc_now()} visible={len(observed)} nearest={nearest or 'none'} rssi={observed.get(nearest) if nearest else '-'}")
        except Exception as error:
            print(f"{utc_now()} scan/report error: {error}")
        await asyncio.sleep(max(0, 1 - (time.monotonic() - started)))


if __name__ == "__main__":
    asyncio.run(main())