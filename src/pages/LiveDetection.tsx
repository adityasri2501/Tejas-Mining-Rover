import { useEffect, useState } from "react";
import { Camera, CircleAlert, Play, Radio, Users } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";

type DetectionStatus = {
  cameraConnected: boolean;
  personCount: number;
  fps: number;
  message: string;
};

const API_BASE = (import.meta.env.VITE_HUMAN_DETECTION_API || "http://localhost:8000").replace(/\/+$/, "");

export default function LiveDetection() {
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!streaming) return;
    let active = true;

    const refreshStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Detection server returned ${response.status}`);
        const next = (await response.json()) as DetectionStatus;
        if (active) {
          setStatus(next);
          setError("");
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Cannot reach the detection server.");
          setStatus(null);
        }
      }
    };

    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [streaming]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Human Detection</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Raspberry Pi streams video; OpenCV detects people on the detection server.
            </p>
          </div>
          <Button onClick={() => { setError(""); setStreaming((current) => !current); }}>
            {streaming ? <><Radio className="mr-2 h-4 w-4" /> Stop stream</> : <><Play className="mr-2 h-4 w-4" /> Start stream</>}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Camera className="h-4 w-4" /> Camera</div>
            <p className={`mt-2 font-semibold ${status?.cameraConnected ? "text-green-500" : "text-muted-foreground"}`}>
              {status?.cameraConnected ? "Connected" : streaming ? "Connecting…" : "Stopped"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> People detected</div>
            <p className="mt-2 text-2xl font-bold text-foreground">{status?.personCount ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Radio className="h-4 w-4" /> Processing speed</div>
            <p className="mt-2 font-semibold text-foreground">{status ? `${status.fps} FPS` : "—"}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="h-4 w-4 shrink-0" /> {error}. Start the Python detection service and check its camera source.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          {streaming ? (
            <img
              src={`${API_BASE}/video_feed`}
              alt="Live camera feed with human detection boxes"
              className="aspect-video w-full object-contain"
              onError={() => setError("Video feed unavailable")}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-center text-sm text-gray-300">
              Start the stream to view the camera and detection results.
            </div>
          )}
        </div>
        {status && <p className="text-sm text-muted-foreground">{status.message}</p>}
      </main>
    </div>
  );
}