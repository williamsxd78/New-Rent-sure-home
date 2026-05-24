import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check, AlertCircle } from "lucide-react";

/**
 * Live selfie capture modal.
 * Requests camera (front-facing where supported), shows live preview,
 * captures a frame to a Blob (JPEG), then calls onCapture(file).
 */
export default function SelfieCapture({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [shot, setShot] = useState(null); // dataURL of captured frame
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError("");
      setShot(null);
      setReady(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access and try again."
            : "Unable to access camera: " + (e?.message || "unknown error")
        );
      }
    })();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 640;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // Mirror to match preview (selfies feel natural mirrored)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
  };

  const retake = () => setShot(null);

  const confirm = async () => {
    if (!shot || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `ssn-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      onClose();
    }, "image/jpeg", 0.85);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#0A192F]/80 flex items-center justify-center p-4" data-testid="selfie-modal">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0A192F] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#C5A880]" /> SSN Verification — Live Selfie
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Used for identity verification. Encrypted and access-restricted.</p>
          </div>
          <button onClick={onClose} className="p-1" data-testid="selfie-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
            </div>
          )}

          <div className="relative aspect-square w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-900">
            {!shot ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                data-testid="selfie-video"
              />
            ) : (
              <img src={shot} alt="Captured selfie" className="w-full h-full object-cover" data-testid="selfie-preview" />
            )}
            {!shot && !ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                Starting camera…
              </div>
            )}
            {!shot && ready && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-xs text-center">
                Center your face in the frame and hold steady.
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-5 flex justify-center gap-3">
            {!shot ? (
              <button
                onClick={snap}
                disabled={!ready || !!error}
                className="rs-btn-primary disabled:opacity-40"
                data-testid="selfie-capture-btn"
              >
                <Camera className="w-4 h-4" /> Capture Selfie
              </button>
            ) : (
              <>
                <button onClick={retake} className="rs-btn-outline" data-testid="selfie-retake-btn"><RotateCcw className="w-4 h-4" /> Retake</button>
                <button onClick={confirm} className="rs-btn-primary" data-testid="selfie-confirm-btn"><Check className="w-4 h-4" /> Use this photo</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
