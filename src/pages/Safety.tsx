import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { ROVER_URL } from "@/lib/rover";

import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";

import {

  Upload,

  Camera,

  Loader2,

  CheckCircle2,

  XCircle,

  HelpCircle,

  Save,

  Bot,

  ExternalLink,

  CalendarCheck,

  ClipboardEdit,

  LogOut,

} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

function createUniqueId(): string {

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {

    return crypto.randomUUID();

  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {

    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  }

  throw new Error("Secure ID generation is unavailable. Open MineScan using localhost or HTTPS.");

}

type PPEStatus = "present" | "missing" | "uncertain";

type PPEItem = {

  status: PPEStatus;

  evidence: string;

};

type PPE = {

  helmet: PPEItem;

  safety_vest: PPEItem;

  gloves: PPEItem;

  safety_boots: PPEItem;

  safety_goggles: PPEItem;

};

type AnalysisResult = {

  workers: {

    worker_id: number;

    ppe: PPE;

  }[];

  analyzedImage?: string;

  error?: string;

};

const PPE_LABELS: { key: keyof PPE; label: string }[] = [

  { key: "helmet", label: "Safety Helmet" },

  { key: "safety_vest", label: "Safety Vest" },

  { key: "gloves", label: "Safety Gloves" },

  { key: "safety_boots", label: "Safety Boots" },

  { key: "safety_goggles", label: "Safety Goggles" },

];

const Safety = () => {

  const navigate = useNavigate();

  const handleLogout = async () => {

    const { error } = await supabase.auth.signOut();

    if (error) {

      toast.error(error.message);

      return;

    }

    navigate("/login", { replace: true });

  };

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [employeeId, setEmployeeId] = useState("");

  const [name, setName] = useState("");

  const [age, setAge] = useState("");

  const [gender, setGender] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraStarting(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access is unavailable. Open MineScan on localhost or HTTPS, or use Upload worker photo.");
      return;
    }

    try {
      setCameraStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      // The video element is mounted after cameraOpen becomes true.
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch((error) => {
            console.error("Camera preview could not start:", error);
          });
        }
      }, 0);
    } catch (error) {
      console.error("Camera access failed:", error);
      toast.error(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings."
          : "Could not open the camera. Check that it is connected and not being used by another app."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera is not ready yet. Please wait a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Could not capture the camera image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Could not create the captured image.");
        return;
      }
      if (blob.size > 10 * 1024 * 1024) {
        toast.error("Captured image must be 10 MB or smaller.");
        return;
      }

      const file = new File([blob], `worker-camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
        setImageFile(file);
        setAnalysis(null);
        stopCamera();
        toast.success("Photo captured. Review it, then click Analyze PPE.");
      };
      reader.onerror = () => toast.error("Could not read the captured photo.");
      reader.readAsDataURL(file);
    }, "image/jpeg", 0.92);
  };

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleImageSelect = (

    event: React.ChangeEvent<HTMLInputElement>,

  ) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {

      toast.error("Choose a JPG, PNG, or WEBP image.");

      event.target.value = "";

      return;

    }

    if (file.size > 10 * 1024 * 1024) {

      toast.error("Image must be 10 MB or smaller.");

      event.target.value = "";

      return;

    }

    const reader = new FileReader();

    reader.onload = (e) => {

      setSelectedImage(e.target?.result as string);

      setImageFile(file);

      setAnalysis(null);

    };

    reader.onerror = () => toast.error("Could not read the image.");

    reader.readAsDataURL(file);

  };

  const analyzeImage = async () => {

    if (!imageFile || !selectedImage) {

      toast.error("Upload a worker photo first.");

      return;

    }

    try {

      setAnalyzing(true);

      setAnalysis(null);

      const base64Image = selectedImage.split(",")[1];

      const { data, error } = await supabase.functions.invoke(

        "analyze-photo",

        {

          body: {

            image: base64Image,

            imageMimeType: imageFile.type,

          },

        },

      );

      if (error) throw error;

      if (data?.error) throw new Error(data.error);

      if (!Array.isArray(data?.workers)) {

        throw new Error("Invalid PPE response from the analysis service.");

      }

      if (data.workers.length === 0) {

        throw new Error("No worker was detected. Try a clearer photo.");

      }

      // This registry stores one worker per photograph.

      const detected = data.workers[0];

      const ppeItems = [

        "helmet",

        "safety_vest",

        "gloves",

        "safety_boots",

        "safety_goggles",

      ] as const;

      for (const key of ppeItems) {

        const status = detected.ppe?.[key]?.status;

        if (!["present", "missing", "uncertain"].includes(status)) {

          throw new Error(`Invalid PPE status received for ${key}.`);

        }

      }

      setAnalysis({

        workers: [detected],

        analyzedImage: data.analyzedImage,

      });

      toast.success("PPE analysis completed. Review the results.");

    } catch (error) {

      console.error("PPE analysis error:", error);

      toast.error(

        error instanceof Error ? error.message : "PPE analysis failed.",

      );

    } finally {

      setAnalyzing(false);

    }

  };

  const saveWorker = async () => {

    if (!imageFile || !selectedImage || !analysis?.workers[0]) {

      toast.error("Upload a photo and analyze PPE first.");

      return;

    }

    const normalizedEmployeeId = employeeId.trim();

    const normalizedName = name.trim();

    const parsedAge = Number(age);

    if (!normalizedEmployeeId || !normalizedName || !age || !gender) {

      toast.error("Complete all worker details.");

      return;

    }

    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 100) {

      toast.error("Enter a valid age between 18 and 100.");

      return;

    }

    try {

      setSaving(true);

      const {

        data: { user },

        error: authError,

      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {

        throw new Error("Please sign in before saving worker records.");

      }

      const worker = analysis.workers[0];

      // First check whether this Employee ID is already registered by this user.

      const { data: existingWorker, error: lookupError } = await (supabase as any)

        .from("worker_ppe_registry")

        .select("id, employee_id, name")

        .eq("user_id", user.id)

        .eq("employee_id", normalizedEmployeeId)

        .maybeSingle();

      if (lookupError) throw lookupError;

      let workerId: string;

      let finalEmployeeId: string;

      let isNewWorker = false;

      if (existingWorker) {

        // Do not create a second open IN entry for the same worker.

        const { data: openEntry, error: openEntryError } = await (supabase as any)

          .from("worker_attendance")

          .select("id")

          .eq("user_id", user.id)

          .eq("worker_id", existingWorker.id)

          .is("exit_time", null)

          .maybeSingle();

        if (openEntryError) throw openEntryError;

        if (openEntry) {

          toast.error(

            `${existingWorker.employee_id} is already marked IN. Use Modify Attendance/OUT workflow when checking the worker out.`,

          );

          return;

        }

        workerId = existingWorker.id;

        finalEmployeeId = existingWorker.employee_id;

      } else {

        const extension =

          imageFile.type === "image/png"

            ? "png"

            : imageFile.type === "image/webp"

              ? "webp"

              : "jpg";

        const photoPath = `${user.id}/${createUniqueId()}.${extension}`;

        // Store the original image in the private Storage bucket.

        const { error: uploadError } = await supabase.storage

          .from("worker-photos")

          .upload(photoPath, imageFile, {

            contentType: imageFile.type,

            upsert: false,

          });

        if (uploadError) throw uploadError;

        const { data: savedWorker, error: insertError } = await supabase

          .from("worker_ppe_registry")

          .insert({

            user_id: user.id,

            employee_id: normalizedEmployeeId,

            name: normalizedName,

            age: parsedAge,

            gender,

            photo_path: photoPath,

            helmet: worker.ppe.helmet.status,

            safety_vest: worker.ppe.safety_vest.status,

            gloves: worker.ppe.gloves.status,

            safety_boots: worker.ppe.safety_boots.status,

            safety_goggles: worker.ppe.safety_goggles.status,

          })

          .select("id, employee_id")

          .single();

        if (insertError) {

          // Clean up the uploaded photo if the registry insert failed.

          const { error: cleanupError } = await supabase.storage

            .from("worker-photos")

            .remove([photoPath]);

          if (cleanupError) {

            console.error("Photo cleanup failed:", cleanupError);

          }

          // Handle a simultaneous duplicate registration safely.

          if (insertError.code === "23505") {

            throw new Error(

              "This Employee ID already exists. Refresh and try marking attendance for the existing worker.",

            );

          }

          throw insertError;

        }

        workerId = savedWorker.id;

        finalEmployeeId = savedWorker.employee_id;

        isNewWorker = true;

      }

      // Every successful registration or existing-worker check-in creates an IN event.

      const { error: attendanceError } = await (supabase as any)

        .from("worker_attendance")

        .insert({

          user_id: user.id,

          worker_id: workerId,

          entry_time: new Date().toISOString(),

        });

      if (attendanceError) {

        console.error("Attendance insert failed:", attendanceError);

        if (isNewWorker) {

          toast.error(

            `Worker ${finalEmployeeId} was saved, but attendance could not be added: ${attendanceError.message}`,

          );

        } else {

          toast.error(`Could not mark attendance: ${attendanceError.message}`);

        }

        return;

      }

      toast.success(

        isNewWorker

          ? `Worker ${finalEmployeeId} registered and marked IN successfully.`

          : `Existing worker ${finalEmployeeId} marked IN successfully.`,

      );

      // Clear the form after successful attendance insertion.

      setSelectedImage(null);

      setImageFile(null);

      setAnalysis(null);

      setEmployeeId("");

      setName("");

      setAge("");

      setGender("");

    } catch (error) {

      console.error("Saving worker/attendance failed:", error);

      toast.error(

        error instanceof Error

          ? error.message

          : "Could not save worker or attendance.",

      );

    } finally {

      setSaving(false);

    }

  };

  const getStatusStyle = (status: PPEStatus) => {

    if (status === "present") {

      return {

        label: "Present",

        className: "bg-green-500/10 text-green-600",

        Icon: CheckCircle2,

      };

    }

    if (status === "missing") {

      return {

        label: "Missing",

        className: "bg-red-500/10 text-red-600",

        Icon: XCircle,

      };

    }

    return {

      label: "Uncertain",

      className: "bg-amber-500/10 text-amber-600",

      Icon: HelpCircle,

    };

  };

  return (

    <div className="min-h-screen bg-background">

      <header className="sticky top-0 z-50 border-b border-border bg-black">

        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">

          <button

            type="button"

            onClick={() => navigate("/")}

            className="flex shrink-0 items-center gap-2"

            aria-label="Go to MineScan dashboard"

          >

            <span className="flex h-8 w-8 items-center justify-center rounded bg-primary font-bold text-white">

              MS

            </span>

            <span className="text-lg font-bold text-white">MineScan</span>

          </button>

          <nav className="flex flex-wrap items-center gap-2" aria-label="Main navigation">

            <Button

              variant="default"

              size="sm"

              onClick={() => navigate("/safety")}

            >

              <Camera className="mr-2 h-4 w-4" />

              Analyze Image &amp; Add Attendance

            </Button>

            <a

              href={ROVER_URL}

              target="\_blank"

              rel="noopener noreferrer"

              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"

            >

              <Bot className="mr-2 h-4 w-4" />

              Rover

              <ExternalLink className="ml-2 h-3 w-3" />

            </a>

            <Button

              variant="ghost"

              size="sm"

              className="text-white hover:bg-white/10 hover:text-white"

              onClick={() => navigate("/attendance")}

            >

              <CalendarCheck className="mr-2 h-4 w-4" />

              Today&apos;s Attendance

            </Button>

            <Button

              variant="ghost"

              size="sm"

              className="text-white hover:bg-white/10 hover:text-white"

              onClick={() => navigate("/modify-attendance")}

            >

              <ClipboardEdit className="mr-2 h-4 w-4" />

              Modify Attendance

            </Button>

            <Button variant="outline" size="sm" onClick={handleLogout}>

              <LogOut className="mr-2 h-4 w-4" />

              Logout

            </Button>

          </nav>

        </div>

      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">

        <div className="mb-8">

          <h1 className="text-3xl font-bold text-foreground">

            Worker PPE Registry

          </h1>

          <p className="mt-2 text-muted-foreground">

            Register a worker, analyze visible PPE, and save the record.

          </p>

        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Photo upload and analysis */}

          <Card className="space-y-5 border-border bg-card p-6">

            <h2 className="text-xl font-bold text-foreground">

              Worker Photograph

            </h2>

            {!selectedImage ? (

              <label className="block cursor-pointer">

                <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted transition-colors hover:border-primary">

                  <Upload className="h-12 w-12 text-muted-foreground" />

                  <div className="text-center">

                    <p className="font-medium text-foreground">

                      Upload worker photo

                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">

                      JPG, PNG or WEBP · Max 10 MB

                    </p>

                  </div>

                </div>

                <input

                  type="file"

                  accept="image/jpeg,image/png,image/webp"

                  onChange={handleImageSelect}

                  className="hidden"

                  disabled={analyzing || saving}

                />

              </label>

            ) : (

              <div className="space-y-3">

                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">

                  <img

                    src={selectedImage}

                    alt="Uploaded worker"

                    className="h-full w-full object-contain"

                  />

                </div>

                <Button

                  variant="outline"

                  className="w-full"

                  disabled={analyzing || saving}

                  onClick={() => {

                    setSelectedImage(null);

                    setImageFile(null);

                    setAnalysis(null);

                  }}

                >

                  <Upload className="mr-2 h-4 w-4" />

                  Choose Another Photo

                </Button>

              </div>

            )}

            {!selectedImage && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={openCamera}
                disabled={cameraStarting || analyzing || saving}
              >
                {cameraStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Camera...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Capture from Camera
                  </>
                )}
              </Button>
            )}

            <Button
              className="w-full"
              onClick={analyzeImage}

              disabled={!imageFile || analyzing || saving}

            >

              {analyzing ? (

                <>

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  Analyzing PPE...

                </>

              ) : (

                <>

                  <Camera className="mr-2 h-4 w-4" />

                  Analyze PPE

                </>

              )}

            </Button>

            {analysis && (

              <div className="space-y-4 border-t border-border pt-5">

                <h3 className="font-semibold text-foreground">

                  PPE Assessment

                </h3>

                {PPE_LABELS.map(({ key, label }) => {

                  const item = analysis.workers[0].ppe[key];

                  const style = getStatusStyle(item.status);

                  const StatusIcon = style.Icon;

                  return (

                    <div

                      key={key}

                      className="rounded-lg border border-border p-3"

                    >

                      <div className="flex items-center justify-between gap-3">

                        <span className="font-medium text-foreground">

                          {label}

                        </span>

                        <span

                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm ${style.className}`}

                        >

                          <StatusIcon className="h-4 w-4" />

                          {style.label}

                        </span>

                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">

                        {item.evidence}

                      </p>

                    </div>

                  );

                })}

                <p className="text-xs text-muted-foreground">

                  Review the visual assessment before saving. Uncertain means

                  the equipment could not be confirmed from this photo.

                </p>

              </div>

            )}

          </Card>

          {/* Manual worker details */}

          <Card className="space-y-5 border-border bg-card p-6">

            <h2 className="text-xl font-bold text-foreground">

              Worker Details

            </h2>

            <div className="space-y-2">

              <label htmlFor="employeeId" className="text-sm font-medium">

                Employee ID *

              </label>

              <input

                id="employeeId"

                value={employeeId}

                onChange={(e) => setEmployeeId(e.target.value)}

                placeholder="e.g. MINE-001"

                maxLength={50}

                disabled={saving}

                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"

              />

              <p className="text-xs text-muted-foreground">

                Must be unique across the registry.

              </p>

            </div>

            <div className="space-y-2">

              <label htmlFor="workerName" className="text-sm font-medium">

                Full Name *

              </label>

              <input

                id="workerName"

                value={name}

                onChange={(e) => setName(e.target.value)}

                placeholder="Enter worker's full name"

                maxLength={120}

                disabled={saving}

                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"

              />

            </div>

            <div className="space-y-2">

              <label htmlFor="workerAge" className="text-sm font-medium">

                Age *

              </label>

              <input

                id="workerAge"

                type="number"

                min={18}

                max={100}

                step={1}

                value={age}

                onChange={(e) => setAge(e.target.value)}

                placeholder="Enter age"

                disabled={saving}

                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"

              />

            </div>

            <div className="space-y-2">

              <label htmlFor="workerGender" className="text-sm font-medium">

                Gender *

              </label>

              <select

                id="workerGender"

                value={gender}

                onChange={(e) => setGender(e.target.value)}

                disabled={saving}

                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"

              >

                <option value="">Select gender</option>

                <option value="Male">Male</option>

                <option value="Female">Female</option>

                <option value="Other">Other</option>

              </select>

            </div>

            <Button

              className="w-full"

              onClick={saveWorker}

              disabled={!analysis || !employeeId.trim() || !name.trim() || !age || !gender || saving || analyzing}

            >

              {saving ? (

                <>

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  Saving Worker...

                </>

              ) : (

                <>

                  <Save className="mr-2 h-4 w-4" />

                  Save Worker Record

                </>

              )}

            </Button>

            <p className="text-xs text-muted-foreground">

              Worker details and PPE status will be saved only after you

              confirm the analysis by clicking Save Worker Record.

            </p>

          </Card>

        </div>

        {cameraOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-dialog-title"
          >
            <div className="w-full max-w-3xl space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="camera-dialog-title" className="text-xl font-bold text-foreground">
                    Capture Worker Photo
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep the worker and visible protective equipment in the frame.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={stopCamera} aria-label="Close camera">
                  <XCircle className="mr-2 h-4 w-4" /> Close
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[65vh] min-h-[220px] w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
                <Button type="button" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" /> Capture Photo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The captured image follows the existing PPE analysis and save workflow.
              </p>
            </div>
          </div>
        )}

      </main>

    </div>

  );

};

export default Safety;
