/**
 * src/components/QrScannerModal.jsx
 *
 * Full-screen camera-based QR code scanner.
 * Uses jsQR (dynamically imported) + getUserMedia.
 * Calls onScan(decodedText) when a QR is found, onClose to dismiss.
 */
import React, { useEffect, useRef, useState } from "react";

// ── Dynamic import so jsQR doesn't block initial bundle ────────────────────────
let _jsQR = null;
async function loadJsQR() {
  if (_jsQR) return _jsQR;
  const mod = await import("jsqr");
  _jsQR = mod.default || mod;
  return _jsQR;
}

// ── Tiny corner-bracket SVG component ─────────────────────────────────────────
function ScanFrame({ size = 220, color = "#3dba7e" }) {
  const arm = 28;
  const w = 3;
  const s = { position: "absolute", width: arm, height: arm };
  const border = (top, right, bottom, left) => ({
    borderTop:    top    ? `${w}px solid ${color}` : "none",
    borderRight:  right  ? `${w}px solid ${color}` : "none",
    borderBottom: bottom ? `${w}px solid ${color}` : "none",
    borderLeft:   left   ? `${w}px solid ${color}` : "none",
  });
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* corners */}
      <div style={{ ...s, top: 0,    left: 0,    ...border(1,0,0,1) }} />
      <div style={{ ...s, top: 0,    right: 0,   ...border(1,1,0,0) }} />
      <div style={{ ...s, bottom: 0, left: 0,    ...border(0,0,1,1) }} />
      <div style={{ ...s, bottom: 0, right: 0,   ...border(0,1,1,0) }} />
      {/* scan line */}
      <div style={{
        position: "absolute", left: 4, right: 4, height: 2,
        background: `linear-gradient(90deg,transparent 0%,${color} 30%,${color} 70%,transparent 100%)`,
        animation: "qr-scan-line 2s ease-in-out infinite",
        boxShadow: `0 0 8px ${color}88`,
      }} />
      <style>{`
        @keyframes qr-scan-line {
          0%   { top: 8%; }
          50%  { top: 88%; }
          100% { top: 8%; }
        }
      `}</style>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function QrScannerModal({ onScan, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  const [status,   setStatus]   = useState("starting"); // starting | scanning | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const jsQR = await loadJsQR();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const vid = videoRef.current;
        if (!vid) return;
        vid.srcObject = stream;
        await vid.play().catch(() => {});
        setStatus("scanning");

        const tick = () => {
          if (!active || !videoRef.current || !canvasRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
            const canvas = canvasRef.current;
            canvas.width  = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data?.trim()) {
              // ✅ Found a QR code
              if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
              cancelAnimationFrame(rafRef.current);
              setStatus("success");
              if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
              const decoded = code.data.trim();
              setTimeout(() => { if (active) onScan(decoded); }, 700);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

      } catch (e) {
        if (!active) return;
        setStatus("error");
        if (e.name === "NotAllowedError") {
          setErrorMsg("Camera access was denied. Please allow camera access and try again.");
        } else if (e.name === "NotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else {
          setErrorMsg(e.message || "Camera error. Please try again.");
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, [onScan]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 400,
      display: "flex", flexDirection: "column", touchAction: "none",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px",
        background: "linear-gradient(to bottom, rgba(0,0,0,.85), transparent)",
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
      }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 15.5, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⬛</span> Scan Equipment QR Code
        </div>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "white",
            width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
      </div>

      {/* Camera video */}
      <video
        ref={videoRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        playsInline muted autoPlay
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Dark vignette overlay with cutout effect */}
      {status === "scanning" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          background: "radial-gradient(ellipse 260px 260px at 50% 45%, transparent 0%, rgba(0,0,0,.55) 100%)",
          pointerEvents: "none",
        }} />
      )}

      {/* Scanning frame */}
      {status === "scanning" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          paddingBottom: 80,
        }}>
          <ScanFrame size={220} />
        </div>
      )}

      {/* Starting indicator */}
      {status === "starting" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "white",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ color: "rgba(255,255,255,.7)", fontSize: 14 }}>Starting camera…</div>
          </div>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "linear-gradient(135deg, #3dba7e, #2da868)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 0 40px #3dba7e88",
              animation: "pop-in .3s ease-out",
            }}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 18 }}>QR Code Found!</div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 6 }}>Looking up equipment…</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Camera Error</div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13.5, marginBottom: 24, lineHeight: 1.6 }}>{errorMsg}</div>
            <button onClick={onClose} style={{
              background: "white", color: "#111", border: "none", padding: "10px 28px",
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}>
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Footer hint */}
      {status === "scanning" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
          background: "linear-gradient(to top, rgba(0,0,0,.85), transparent)",
          padding: "40px 20px 32px", textAlign: "center",
          color: "rgba(255,255,255,.7)", fontSize: 13.5,
        }}>
          Point your camera at the QR code on the equipment
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop-in {
          0%   { transform: scale(.6); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
