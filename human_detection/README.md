# MineScan live human detection

This service runs OpenCV's built-in HOG people detector on the computer running this backend. The Raspberry Pi only publishes its camera stream; it does not run OpenCV or an AI model. The provided camera URL is already saved in `human_detection\.env`.

## Run on Windows Command Prompt

Open a terminal in `D:\Tejas` and run:

```cmd
py -m venv human_detection\.venv
human_detection\.venv\Scripts\activate.bat
python -m pip install -r human_detection\requirements.txt
python -m uvicorn main:app --app-dir human_detection --host 0.0.0.0 --port 8000
```

In a second terminal, start the React app with `npm run dev`, sign in, and open **Live Human Detection** from the dashboard or navigation. If you view the page from another device, set `VITE_HUMAN_DETECTION_API` in the React `.env.local` to the detection computer's reachable LAN URL, then restart Vite.

The backend camera source is `http://10.152.229.149/camera` in `human_detection\.env`. The detection computer must be able to reach that URL. Change `CAMERA_SOURCE` there if the camera route changes.

This initial HOG detector is a quick baseline. It detects mostly upright, visible people and may miss small, distant, side-facing, or partially blocked people. Validate it with the actual camera before relying on it for safety decisions.