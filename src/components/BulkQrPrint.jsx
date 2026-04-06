/**
 * src/components/BulkQrPrint.jsx
 *
 * Bulk QR label printer for equipment.
 * - Multi-select from equipment list
 * - Choose label size (small / medium / large)
 * - Preview labels in a grid
 * - Print all on one page or download as PNG sheet
 *
 * Props:
 *   equipment   — array of equipment objects (must have qrCodeId)
 *   onClose     — dismiss modal
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Dynamic qrcode import ─────────────────────────────────────────────────────
let _QRCode = null;
async function loadQRCode() {
  if (_QRCode) return _QRCode;
  const mod = await import("qrcode");
  _QRCode = mod.default || mod;
  return _QRCode;
}

// ── Label size presets ────────────────────────────────────────────────────────
const SIZES = {
  small:  { label: 'Small',  qrPx: 80,  totalW: 120, totalH: 140, nameFontSize: 8,  codeFontSize: 7  },
  medium: { label: 'Medium', qrPx: 120, totalW: 160, totalH: 195, nameFontSize: 10, codeFontSize: 9  },
  large:  { label: 'Large',  qrPx: 180, totalW: 220, totalH: 270, nameFontSize: 12, codeFontSize: 11 },
};

// ── Render a single label onto a canvas ──────────────────────────────────────
async function renderLabelToCanvas(canvas, equipment, size) {
  const s       = SIZES[size];
  const QRCode  = await loadQRCode();
  const qrId    = equipment.qrCodeId;
  if (!qrId) return;

  // Render QR to temp canvas
  const qrCanvas = document.createElement('canvas');
  await new Promise((res, rej) => {
    QRCode.toCanvas(qrCanvas, qrId, {
      width: s.qrPx, margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }, err => err ? rej(err) : res());
  });

  const pad = (s.totalW - s.qrPx) / 2;

  canvas.width  = s.totalW;
  canvas.height = s.totalH;
  const ctx = canvas.getContext('2d');

  // White background + subtle border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s.totalW, s.totalH);
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth   = 1;
  ctx.strokeRect(0.5, 0.5, s.totalW - 1, s.totalH - 1);

  // QR code
  ctx.drawImage(qrCanvas, pad, pad);

  const yBase = pad + s.qrPx + 6;

  // Equipment name
  ctx.fillStyle  = '#000000';
  ctx.textAlign  = 'center';
  ctx.font       = `bold ${s.nameFontSize}px system-ui, Arial, sans-serif`;
  const name     = equipment.name || 'Equipment';
  // Truncate if too long
  let displayName = name;
  while (ctx.measureText(displayName).width > s.totalW - 8 && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== name) displayName = displayName.slice(0, -1) + '…';
  ctx.fillText(displayName, s.totalW / 2, yBase + s.nameFontSize);

  // Unique code
  if (equipment.unique_code || equipment.uniqueCode) {
    const code = equipment.unique_code || equipment.uniqueCode;
    ctx.font       = `${s.codeFontSize}px system-ui, Arial, sans-serif`;
    ctx.fillStyle  = '#555555';
    ctx.fillText(`#${code}`, s.totalW / 2, yBase + s.nameFontSize + s.codeFontSize + 3);
  }

  // Type/category
  const typeLine = [equipment.typeName, equipment.categoryName].filter(Boolean).join(' · ');
  if (typeLine) {
    ctx.font      = `${Math.max(s.codeFontSize - 1, 6)}px system-ui, Arial, sans-serif`;
    ctx.fillStyle = '#888888';
    ctx.fillText(typeLine, s.totalW / 2, yBase + s.nameFontSize + (s.codeFontSize + 3) * 2);
  }
}

// ── Label preview card ────────────────────────────────────────────────────────
function LabelPreview({ equipment, size }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!equipment.qrCodeId) return;
    setReady(false);
    let active = true;
    renderLabelToCanvas(canvasRef.current, equipment, size)
      .then(() => { if (active) setReady(true); })
      .catch(console.warn);
    return () => { active = false; };
  }, [equipment, size]);

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {!ready && !equipment.qrCodeId && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#f9f9f9', fontSize: 10, color: '#aaa' }}>
          No QR
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BulkQrPrint({ equipment = [], onClose }) {
  const [selected,    setSelected]    = useState(new Set(equipment.map(e => e.id)));
  const [labelSize,   setLabelSize]   = useState('medium');
  const [generating,  setGenerating]  = useState(false);

  const withQr = equipment.filter(e => e.qrCodeId);
  const withoutQr = equipment.filter(e => !e.qrCodeId);
  const selectedList = withQr.filter(e => selected.has(e.id));

  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleAll = () => {
    if (selectedList.length === withQr.length) setSelected(new Set());
    else setSelected(new Set(withQr.map(e => e.id)));
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    if (selectedList.length === 0) return;
    setGenerating(true);
    try {
      const s = SIZES[labelSize];
      const QRCode = await loadQRCode();

      // Build data URLs for each selected item
      const labelDataUrls = await Promise.all(
        selectedList.map(async (eq) => {
          if (!eq.qrCodeId) return null;
          const canvas = document.createElement('canvas');
          await renderLabelToCanvas(canvas, eq, labelSize);
          return { dataUrl: canvas.toDataURL('image/png'), name: eq.name };
        })
      );

      const valid = labelDataUrls.filter(Boolean);
      const labelsPerRow = labelSize === 'small' ? 5 : labelSize === 'medium' ? 4 : 3;
      const labelWidthMm = labelSize === 'small' ? 25 : labelSize === 'medium' ? 38 : 55;

      const win = window.open('', '_blank', 'width=900,height=700,menubar=no,toolbar=no');
      if (!win) { alert('Pop-up blocked. Allow pop-ups for this site.'); setGenerating(false); return; }

      const imgTags = valid.map(l =>
        `<div class="label">
          <img src="${l.dataUrl}" alt="${l.name}" />
        </div>`
      ).join('\n');

      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Labels — ${valid.length} item${valid.length !== 1 ? 's' : ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, Arial, sans-serif; background: #fff; padding: 10mm; }
    .grid { display: flex; flex-wrap: wrap; gap: 3mm; }
    .label { display: inline-block; }
    .label img { display: block; width: ${labelWidthMm}mm; height: auto; }
    .controls { margin-bottom: 8mm; display: flex; gap: 12px; align-items: center; }
    .print-btn { background: #000; color: #fff; border: none; padding: 8px 22px;
      border-radius: 8px; font-size: 14px; cursor: pointer; }
    .count { font-size: 13px; color: #555; }
    @media print {
      .controls { display: none; }
      body { padding: 5mm; }
      .grid { gap: 2mm; }
    }
  </style>
</head>
<body>
  <div class="controls">
    <button class="print-btn" onclick="window.print()">🖨️ Print ${valid.length} Label${valid.length !== 1 ? 's' : ''}</button>
    <span class="count">${valid.length} label${valid.length !== 1 ? 's' : ''} · ${SIZES[labelSize].label} size · ${labelsPerRow}/row</span>
  </div>
  <div class="grid">
    ${imgTags}
  </div>
</body>
</html>`);
      win.document.close();
      setTimeout(() => { try { win.print(); } catch (_) {} }, 500);

    } catch (err) {
      console.error('[BulkQrPrint] print error:', err);
      alert('Failed to generate labels. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [selectedList, labelSize]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 1100,
    background: 'rgba(0,0,0,.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  };
  const modal = {
    background: 'var(--surface1, #1e1e1e)',
    borderRadius: 16,
    width: '100%', maxWidth: 660,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border, #333)',
    boxShadow: '0 24px 80px rgba(0,0,0,.5)',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#333)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1,#fff)' }}>
              🖨️ Bulk QR Label Print
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3,#888)', marginTop: 2 }}>
              {selectedList.length} of {withQr.length} selected
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--text3,#888)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* Controls */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border,#333)',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
          {/* Label size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2,#aaa)', fontWeight: 600 }}>Size:</span>
            {Object.entries(SIZES).map(([key, val]) => (
              <button key={key} onClick={() => setLabelSize(key)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border,#444)',
                background: labelSize === key ? 'var(--accent,#2563eb)' : 'var(--surface2,#2a2a2a)',
                color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: labelSize === key ? 700 : 400,
              }}>{val.label}</button>
            ))}
          </div>

          {/* Select all */}
          <button onClick={toggleAll} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border,#444)',
            background: 'var(--surface2,#2a2a2a)', color: '#fff', fontSize: 13, cursor: 'pointer', marginLeft: 'auto',
          }}>
            {selectedList.length === withQr.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Equipment list + preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {withoutQr.length > 0 && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              ⚠️ {withoutQr.length} item{withoutQr.length !== 1 ? 's' : ''} without a QR code will be skipped.
            </div>
          )}

          {withQr.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3,#888)' }}>
              No equipment with QR codes found.
            </div>
          )}

          {withQr.map(eq => {
            const isSelected = selected.has(eq.id);
            return (
              <div key={eq.id} onClick={() => toggleOne(eq.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${isSelected ? 'var(--accent,#2563eb)' : 'var(--border,#333)'}`,
                  background: isSelected ? 'rgba(37,99,235,.1)' : 'var(--surface2,#2a2a2a)',
                  transition: 'all .15s',
                }}>
                {/* Checkbox */}
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isSelected ? 'var(--accent,#2563eb)' : '#555'}`,
                  background: isSelected ? 'var(--accent,#2563eb)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                </div>

                {/* Photo */}
                {eq.photoUrl
                  ? <img src={eq.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: 6, background: '#333',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                }

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1,#fff)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</div>
                  {(eq.uniqueCode || eq.unique_code) && (
                    <div style={{ fontSize: 12, color: 'var(--text3,#888)' }}>#{eq.uniqueCode || eq.unique_code}</div>
                  )}
                </div>

                {/* Tiny preview */}
                {isSelected && (
                  <div style={{ flexShrink: 0, border: '1px solid var(--border,#444)', borderRadius: 4, overflow: 'hidden' }}>
                    <LabelPreview equipment={eq} size={labelSize} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border,#333)',
          display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border,#444)',
            background: 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={handlePrint}
            disabled={selectedList.length === 0 || generating}
            style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: selectedList.length === 0 ? '#333' : 'var(--accent,#2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: selectedList.length === 0 || generating ? 'not-allowed' : 'pointer',
              opacity: selectedList.length === 0 ? .5 : 1,
            }}
          >
            {generating ? 'Generating…' : `🖨️ Print ${selectedList.length} Label${selectedList.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
