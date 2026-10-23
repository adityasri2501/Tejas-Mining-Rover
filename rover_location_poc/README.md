# Rover BLE Location PoC

This standalone PoC keeps computer vision off the Raspberry Pi. The Pi only scans BLE advertisements and sends node IDs plus RSSI readings to the server. The server smooths signal readings, waits for a nearest node to remain strongest for several scans, saves location changes in SQLite, and serves a dashboard with current location, last fetched time, RSSI, live/stale state, and history.

## 1. Configure nodes

Edit `nodes.json` on both the server computer and Raspberry Pi. Each phone/beacon must advertise the configured name, such as `ROVER-NODE-A`. Replace `location` values with real mine locations. Keep `node_id` and `advertisement_name` unique.

For a phone-based PoC, use Android phones with a BLE advertiser app configured to advertise the node name. Keep advertising enabled. On Android 12+, grant the app Nearby devices / Bluetooth advertising permission. iPhone background advertising can be throttled, so keep it in the foreground for initial tests.

## 2. Start the location server on the dashboard computer

From this folder, in Windows Command Prompt:

```cmd
cd server
py -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
copy .env.example .env
```

Edit `server\.env` and replace `ROVER_INGEST_TOKEN` with a private value. Start the server:

```cmd
python -m uvicorn main:app --host 0.0.0.0 --port 8100
```

Open `http://localhost:8100` on the same computer. The Pi must be able to reach the server computer's LAN IP on port `8100`.

## 3. Start the BLE scanner on the Raspberry Pi 4

Copy `pi_scanner` and `nodes.json` to the Pi. In the Pi terminal:

```bash
cd pi_scanner
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
cp .env.example .env
```

Edit `pi_scanner/.env`: set `LOCATION_SERVER_URL` to `http://<SERVER-LAN-IP>:8100` and set the same `ROVER_INGEST_TOKEN` used by the server. Run:

```bash
python3 scanner.py
```

## Behavior and limits

- The dashboard updates the `Last fetched` time whenever the Pi reports a scan, including scans where no node is visible.
- Current location changes only after the same candidate is strongest for `STABLE_SCANS` reports and beats the current node by `SWITCH_MARGIN_DB`; this dampens RSSI jitter.
- History records stable node changes, not every scan. SQLite data is stored at `server/locations.sqlite3`.
- A stale status means no scan report arrived for 20 seconds. “No nodes visible” means the Pi is reporting scans but did not hear a configured node.
- RSSI estimates the nearest configured node; walls, machinery, phone placement, and multipath can alter signal strength. Treat this as a PoC estimate, not precise positioning.
- Keep the service on a trusted LAN for this PoC. The ingest token protects scan submissions; deploy with stronger authentication and HTTPS before exposing it outside the LAN.