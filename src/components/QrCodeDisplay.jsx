/**
 * src/components/QrCodeDisplay.jsx
 *
 * Renders a QR code onto a canvas using the `qrcode` npm package.
 * Provides Download PNG and Print Label buttons.
 *
 * Props:
 *   qrCodeId      — the UUID to encode (equipment.qr_code_id)
 *   equipmentName — display name for the label
 *   uniqueCode    — equipment unique_code shown under QR
 *   size          — canvas size in px (default 200)
 */
import React, { useEffect, useRef, useState } from "react";

// ── Dynamic import so qrcode doesn't block initial bundle ──────────────────────
let _QRCode = null;
async function loadQRCode() {
  if (_QRCode) return _QRCode;
  const mod = await import("qrcode");
  _QRCode = mod.default || mod;
  return _QRCode;
}

// ── Main export ────────────────────────────────────────────────────────────────
export function QrCodeDisplay({ qrCodeId, equipmentName, uniqueCode, size = 200 }) {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!qrCodeId) return;
    let active = true;
    setRendered(false);
    setError(null);

    loadQRCode()
      .then(QRCode => {
        if (!active || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, qrCodeId, {
          width:  size,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        }, err => {
          if (!active) return;
          if (err) { setError("Failed to generate QR code."); console.warn(err); }
          else setRendered(true);
        });
      })
      .catch(e => { if (active) setError("QR library failed to load."); console.warn(e); });

    return () => { active = false; };
  }, [qrCodeId, size]);

  // ── Download as PNG label ──────────────────────────────────────────────────
  const downloadLabel = () => {
    if (!canvasRef.current) return;
    const pad    = 20;
    const labH   = 64;
    const total  = size + pad * 2 + labH;
    const out    = document.createElement("canvas");
    out.width    = size + pad * 2;
    out.height   = total;
    const ctx    = out.getContext("2d");

    // white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, total);

    // QR image
    ctx.drawImage(canvasRef.current, pad, pad);

    // Equipment name
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    const cx = out.width / 2;
    const qBot = size + pad;

    ctx.font = "bold 14px system-ui, Arial, sans-serif";
    ctx.fillText(equipmentName || "Equipment", cx, qBot + 18);

    if (uniqueCode) {
      ctx.font = "12px system-ui, Arial, sans-serif";
      ctx.fillStyle = "#444444";
      ctx.fillText(`#${uniqueCode}`, cx, qBot + 36);
    }

    ctx.font = "9px monospace";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(qrCodeId, cx, qBot + 56);

    out.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${(equipmentName || "equipment").replace(/[^a-z0-9]/gi, "_")}_qr_label.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // ── Print label ────────────────────────────────────────────────────────────
  const printLabel = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank", "width=380,height=520,menubar=no,toolbar=no");
    if (!win) { alert("Pop-up blocked. Please allow pop-ups for this site."); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Label — ${equipmentName || "Equipment"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, Arial, sans-serif; background: #fff; padding: 24px; text-align: center; }
    img { display: block; width: 200px; height: 200px; margin: 0 auto 10px; }
    h2 { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
    .code { font-size: 12px; color: #555; margin-bottom: 4px; }
    .uuid { font-size: 9px; color: #aaa; font-family: monospace; word-break: break-all; margin-bottom: 16px; }
    .print-btn { background: #000; color: #fff; border: none; padding: 8px 22px; border-radius: 8px;
      font-size: 14px; cursor: pointer; margin-top: 8px; }
    @media print {
      .print-btn { display: none; }
      body { padding: 8px; }
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="QR Code" />
  <h2>${equipmentName || "Equipment"}</h2>
  ${uniqueCode ? `<div class="code">#${uniqueCode}</div>` : ""}
  <div class="uuid">${qrCodeId}</div>
  <button class="print-btn" onclick="window.print()">🖨️ Print</button>
</body>
</html>`);
    win.document.close();
    // Small delay so content renders before print dialog
    setTimeout(() => { try { win.print(); } catch(e) {} }, 400);
  };

  if (!qrCodeId) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>
        No QR code assigned to this equipment unit yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* Canvas — white background wrapper */}
      <div style={{
        background: "white", padding: 10, borderRadius: 10,
        border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,.1)",
      }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />
        {!rendered && !error && (
          <div style={{ width: size, height: size, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#999", fontSize: 12 }}>
            Generating…
          </div>
        )}
        {error && (
          <div style={{ width: size, height: size, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#e85a3a", fontSize: 12, padding: 12, textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>

      {/* Equipment name under QR */}
      {rendered && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{equipmentName || "Equipment"}</div>
          {uniqueCode && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>#{uniqueCode}</div>}
          <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace", marginTop: 4,
            wordBreak: "break-all", maxWidth: size }}>
            {qrCodeId}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {rendered && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadLabel} style={{ fontSize: 12.5 }}>
            ⬇ Download PNG
          </button>
          <button className="btn btn-secondary btn-sm" onClick={printLabel} style={{ fontSize: 12.5 }}>
            🖨 Print Label
          </button>
        </div>
      )}
    </div>
  );
}
