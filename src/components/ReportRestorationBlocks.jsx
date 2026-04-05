/**
 * ReportRestorationBlocks.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained restoration/moisture block types for the KrakenCam Report Editor.
 * Adds three new block types: moisture_data, equipment_log, drying_timeline.
 *
 * Exports:
 *   MoistureDataBlock      — editor-view component (uses hooks, fetches live data)
 *   EquipmentLogBlock      — editor-view component
 *   DryingTimelineBlock    — editor-view component
 *   RestorationToolsPopup  — floating menu for inserting restoration blocks
 *   MoistureDataBlockPrint — pure print renderer (no hooks, uses block._resolved)
 *   EquipmentLogBlockPrint — pure print renderer
 *   DryingTimelineBlockPrint — pure print renderer
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Icon, ic } from "../utils/icons.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DRY_STANDARDS = {
  "Hardwood":           12,
  "Softwood":           14,
  "Engineered Wood":    12,
  "OSB":               14,
  "Plywood":            14,
  "Drywall":            16,
  "Concrete":           18,
  "Masonry":            18,
  "Vinyl":              16,
  "Laminate":           12,
  "Subfloor":           14,
  "Insulation":         18,
};

const MAT_COLORS = [
  "#2b7fe8", "#e85a3a", "#3dba7e", "#e8b83a", "#8b7cf8",
  "#f06292", "#26c6da", "#a5d6a7", "#ff8a65", "#b0bec5",
];

const READING_TYPE_LIST = [
  "Pin", "Pinless", "Thermo-hygrometer", "RH Probe", "Psychrometric",
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, dy] = d.split("-");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1];
  return `${mon} ${parseInt(dy)}, ${y}`;
}

function fmtDateShort(d) {
  if (!d) return "—";
  const [, m, dy] = d.split("-");
  return `${m}/${parseInt(dy)}`;
}

// Given sorted readings for a material/room, detect stalls (< 1% drop per 48 h)
function detectStalls(readings) {
  const stalled = new Set();
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const dt1 = new Date(`${prev.reading_date}T${prev.reading_time || "12:00"}`);
    const dt2 = new Date(`${curr.reading_date}T${curr.reading_time || "12:00"}`);
    const hours = (dt2 - dt1) / 3600000;
    const drop = (prev.mc_percent || 0) - (curr.mc_percent || 0);
    if (hours >= 20 && drop < 1) {
      stalled.add(curr.id);
    }
  }
  return stalled;
}

// ─────────────────────────────────────────────────────────────────────────────
// DryingGraphSVG — pure SVG, no external libraries, print-safe
// ─────────────────────────────────────────────────────────────────────────────

function DryingGraphSVG({ readings, width = 744, height = 260 }) {
  const P = { L: 52, R: 24, T: 18, B: 56 };
  const W = width - P.L - P.R;
  const H = height - P.T - P.B;

  const mc = readings.filter(r => r.mc_percent != null);
  if (mc.length === 0) {
    return (
      <svg width={width} height={height}>
        <rect x={P.L} y={P.T} width={W} height={H} fill="#f9f9f9" rx="4" />
        <text x={P.L + W / 2} y={P.T + H / 2 + 5} textAnchor="middle" fill="#bbb" fontSize="12">
          No moisture readings to chart
        </text>
      </svg>
    );
  }

  const sorted = [...mc].sort((a, b) => {
    const da = `${a.reading_date}T${a.reading_time || "00:00"}`;
    const db = `${b.reading_date}T${b.reading_time || "00:00"}`;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Time-scaled X axis
  const t0 = new Date(`${sorted[0].reading_date}T${sorted[0].reading_time || "00:00"}`);
  const tN = new Date(`${sorted[sorted.length-1].reading_date}T${sorted[sorted.length-1].reading_time || "23:59"}`);
  const totalMs = Math.max(tN - t0, 1);
  const xOf = r => P.L + ((new Date(`${r.reading_date}T${r.reading_time||"12:00"}`) - t0) / totalMs) * W;

  // Y axis (MC%)
  const maxMC = Math.max(5, Math.ceil(Math.max(...mc.map(r => r.mc_percent)) / 5) * 5 + 5);
  const yOf = v => P.T + H - Math.min(1, Math.max(0, v / maxMC)) * H;
  const yTicks = [];
  for (let v = 0; v <= maxMC; v += 5) yTicks.push(v);

  // Materials
  const materials = [...new Set(sorted.map(r => r.material_type || "Unknown"))];
  const matColor = mat => MAT_COLORS[materials.indexOf(mat) % MAT_COLORS.length];

  // Stalls per material
  const stallsByMat = {};
  materials.forEach(mat => {
    const series = sorted.filter(r => (r.material_type || "Unknown") === mat);
    stallsByMat[mat] = detectStalls(series);
  });

  // X tick dates (up to 8 evenly spaced)
  const uniqueDates = [...new Set(sorted.map(r => r.reading_date))].sort();
  const step = Math.max(1, Math.floor(uniqueDates.length / 7));
  const xTickDates = uniqueDates.filter((_, i) => i === 0 || i % step === 0 || i === uniqueDates.length - 1);

  return (
    <svg width={width} height={height} style={{ fontFamily: "system-ui, sans-serif", overflow: "visible" }}>
      {/* Background */}
      <rect x={P.L} y={P.T} width={W} height={H} fill="#fafafa" rx="2" />

      {/* Y grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={P.L} x2={P.L + W} y1={yOf(v)} y2={yOf(v)}
            stroke={v === 0 ? "#ccc" : "#ececec"} strokeWidth="1" />
          <text x={P.L - 5} y={yOf(v) + 3.5} textAnchor="end" fill="#999" fontSize="9">
            {v}%
          </text>
        </g>
      ))}

      {/* Dry standard dashed lines */}
      {materials.map(mat => {
        const std = DRY_STANDARDS[mat];
        if (!std || std > maxMC) return null;
        const color = matColor(mat);
        return (
          <g key={`std-${mat}`}>
            <line x1={P.L} x2={P.L + W} y1={yOf(std)} y2={yOf(std)}
              stroke={color} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.45" />
            <text x={P.L + W + 3} y={yOf(std) + 3.5} fill={color} fontSize="8" opacity="0.7">
              {std}%
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={P.L} x2={P.L} y1={P.T} y2={P.T + H} stroke="#bbb" strokeWidth="1.5" />
      <line x1={P.L} x2={P.L + W} y1={P.T + H} y2={P.T + H} stroke="#bbb" strokeWidth="1.5" />

      {/* X tick labels */}
      {xTickDates.map(d => {
        const x = P.L + ((new Date(`${d}T12:00`) - t0) / totalMs) * W;
        return (
          <g key={d}>
            <line x1={x} x2={x} y1={P.T + H} y2={P.T + H + 4} stroke="#bbb" strokeWidth="1" />
            <text x={x} y={P.T + H + 14} textAnchor="middle" fill="#888" fontSize="8.5">
              {fmtDateShort(d)}
            </text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text transform={`translate(${P.L - 38},${P.T + H / 2}) rotate(-90)`}
        textAnchor="middle" fill="#999" fontSize="9.5">
        Moisture Content %
      </text>

      {/* Lines per material */}
      {materials.map(mat => {
        const series = sorted.filter(r => (r.material_type || "Unknown") === mat);
        if (series.length < 2) return null;
        const pts = series.map(r => `${xOf(r).toFixed(1)},${yOf(r.mc_percent).toFixed(1)}`).join(" ");
        return (
          <polyline key={`line-${mat}`} points={pts}
            fill="none" stroke={matColor(mat)} strokeWidth="2" strokeLinejoin="round"
            strokeLinecap="round" />
        );
      })}

      {/* Data points */}
      {sorted.map((r, i) => {
        const mat = r.material_type || "Unknown";
        const color = matColor(mat);
        const stalled = stallsByMat[mat]?.has(r.id);
        const cx = xOf(r);
        const cy = yOf(r.mc_percent);
        return (
          <g key={`pt-${i}`}>
            {stalled && (
              <circle cx={cx} cy={cy} r="7" fill="none" stroke="#e85a3a" strokeWidth="1.5" opacity="0.6" />
            )}
            <circle cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2" />
          </g>
        );
      })}

      {/* Legend */}
      {materials.map((mat, mi) => {
        const perRow = Math.floor(W / 150);
        const col = mi % perRow;
        const row = Math.floor(mi / perRow);
        const lx = P.L + col * 150;
        const ly = P.T + H + 28 + row * 14;
        const color = matColor(mat);
        return (
          <g key={`leg-${mat}`}>
            <line x1={lx} x2={lx + 14} y1={ly} y2={ly} stroke={color} strokeWidth="2" />
            <circle cx={lx + 7} cy={ly} r="3" fill="white" stroke={color} strokeWidth="1.5" />
            <text x={lx + 18} y={ly + 4} fill="#444" fontSize="9.5">{mat}</text>
          </g>
        );
      })}

      {/* Stall legend note */}
      {[...Object.values(stallsByMat)].some(s => s.size > 0) && (
        <g>
          <circle cx={P.L + W - 90} cy={P.T + H + 28} r="5" fill="none" stroke="#e85a3a" strokeWidth="1.5" />
          <text x={P.L + W - 80} y={P.T + H + 32} fill="#e85a3a" fontSize="9">= Stalled drying</text>
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReadingTablePrint — 12-column table, print-safe
// ─────────────────────────────────────────────────────────────────────────────

function ReadingTablePrint({ readings, settings }) {
  if (!readings?.length) {
    return (
      <div style={{ padding: "10px 0", color: "#bbb", fontSize: 12, fontStyle: "italic" }}>
        No readings to display.
      </div>
    );
  }

  const cols = [
    { label: "Date",       key: r => `${fmtDateShort(r.reading_date)} ${r.reading_time ? r.reading_time.slice(0,5) : ""}`, w: 64 },
    { label: "Room",       key: r => r.room?.name || "—",                       w: 72 },
    { label: "Material",   key: r => r.material_type || "—",                    w: 72 },
    { label: "Location",   key: r => r.location_description || "—",             w: 90 },
    { label: "Type",       key: r => r.reading_type || "—",                     w: 54 },
    { label: "MC%",        key: r => r.mc_percent != null ? `${r.mc_percent}%` : "—", w: 38 },
    { label: "RH%",        key: r => r.rh_percent  != null ? `${r.rh_percent}%` : "—", w: 38 },
    { label: "Temp°F",     key: r => r.temp_f      != null ? `${r.temp_f}°`   : "—", w: 46 },
    { label: "GPP",        key: r => r.gpp         != null ? r.gpp              : "—", w: 36 },
    { label: "Dew Pt",     key: r => r.dew_point_f != null ? `${r.dew_point_f}°` : "—", w: 42 },
    { label: "Tech",       key: r => r.technician_name || "—",                  w: 72 },
    { label: "Notes",      key: r => r.notes || "",                              w: null },
  ];

  const thStyle = {
    fontSize: 9, fontWeight: 700, padding: "5px 6px",
    textTransform: "uppercase", letterSpacing: ".04em",
    background: "#1a2744", color: "white", textAlign: "left",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    border: "1px solid #1a2744",
  };
  const tdStyle = (i) => ({
    fontSize: 10.5, padding: "5px 6px", verticalAlign: "top",
    wordBreak: "break-word", border: "1px solid #e0e0e0",
    background: i % 2 === 0 ? "white" : "#f8f9fb",
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          {cols.map((c, i) => <col key={i} style={{ width: c.w || "auto" }} />)}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={thStyle}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {readings.map((r, ri) => (
            <tr key={r.id || ri}>
              {cols.map((c, ci) => (
                <td key={ci} style={tdStyle(ri)}>{c.key(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo evidence grid for print
// ─────────────────────────────────────────────────────────────────────────────

function PhotoEvidencePrint({ photos, readings }) {
  if (!photos?.length) return null;
  const readingMap = {};
  (readings || []).forEach(r => { readingMap[r.id] = r; });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {photos.map((ph, i) => {
        const reading = readingMap[ph.reading_id];
        const caption = ph.caption || ph.file_name || `Photo ${i + 1}`;
        const meta = reading
          ? `${fmtDateShort(reading.reading_date)} · ${reading.room?.name || ""} · ${reading.material_type || ""} · ${reading.mc_percent != null ? reading.mc_percent + "%" : ""}`
          : "";
        return (
          <div key={ph.id || i} style={{ border: "1px solid #e0e0e0", borderRadius: 6, overflow: "hidden", background: "#fafafa" }}>
            {ph.public_url
              ? <img src={ph.public_url} alt={caption}
                  style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
              : <div style={{ width: "100%", aspectRatio: "4/3", background: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11, color: "#bbb" }}>No preview</span>
                </div>
            }
            <div style={{ padding: "6px 8px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#333", marginBottom: 2 }}>{caption}</div>
              {meta && <div style={{ fontSize: 9.5, color: "#888" }}>{meta}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-summary generator
// ─────────────────────────────────────────────────────────────────────────────

function generateAutoSummary(readings, equipment, rooms, project) {
  if (!readings?.length) return "";

  const sorted = [...readings].filter(r => r.mc_percent != null)
    .sort((a, b) => (`${a.reading_date}T${a.reading_time||"00:00"}`).localeCompare(`${b.reading_date}T${b.reading_time||"00:00"}`));

  if (!sorted.length) return "";

  const firstDate = fmtDate(sorted[0].reading_date);
  const lastDate  = fmtDate(sorted[sorted.length - 1].reading_date);
  const dayCount  = Math.round((new Date(sorted[sorted.length-1].reading_date) - new Date(sorted[0].reading_date)) / 86400000);

  const materials = [...new Set(sorted.map(r => r.material_type || "Unknown"))];
  const matLines = materials.map(mat => {
    const series = sorted.filter(r => (r.material_type || "Unknown") === mat);
    const initial = series[0].mc_percent;
    const current = series[series.length - 1].mc_percent;
    const std = DRY_STANDARDS[mat];
    const stallSet = detectStalls(series);
    const stalled = series.some(r => stallSet.has(r.id));
    const dry = std ? current <= std : null;
    let line = `${mat}: initial ${initial}%, current ${current}%`;
    if (std) line += ` (dry standard ${std}%)`;
    if (dry === true)  line += " — ✅ At or below dry standard.";
    if (dry === false) line += ` — ⚠ ${(current - std).toFixed(1)}% above dry standard.`;
    if (stalled)       line += " Stalling detected.";
    return line;
  });

  const eqActive = (equipment || []).filter(e => e.status === "active" || !e.removal_date);
  const eqSummary = eqActive.length
    ? `Active equipment: ${eqActive.map(e => `${e.equipment_type}${e.unit_number ? " #"+e.unit_number : ""}`).join(", ")}.`
    : "";

  const roomList = rooms?.length
    ? `Affected areas monitored: ${rooms.map(r => r.name).join(", ")}.`
    : "";

  return [
    `Moisture monitoring commenced ${firstDate}. ${dayCount > 0 ? `This report covers ${dayCount} days of monitoring through ${lastDate}.` : ""}`,
    roomList,
    "",
    "Moisture content by material:",
    ...matLines.map(l => `• ${l}`),
    "",
    eqSummary,
  ].filter(l => l !== undefined).join("\n").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// useMoistureData — shared data-fetching hook for moisture blocks
// ─────────────────────────────────────────────────────────────────────────────

function useMoistureData({ project, block, updateBlock }) {
  const [rooms,    setRooms]    = useState(block._rooms    || []);
  const [allRooms, setAllRooms] = useState(block._allRooms || []);
  const [readings, setReadings] = useState(block._readings || []);
  const [equipment,setEquipment]= useState(block._equipment|| []);
  const [photos,   setPhotos]   = useState(block._photos   || []);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const fetchAll = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true); setError("");
    try {
      // 1. Fetch all project rooms
      const { data: rData } = await supabase
        .from("project_rooms")
        .select("id, name, floor")
        .eq("project_id", project.id)
        .order("name");
      const allR = rData || [];
      setAllRooms(allR);

      // 2. Determine room filter
      const filterIds = (block.roomIds || []).length ? block.roomIds : allR.map(r => r.id);
      const filteredRooms = allR.filter(r => filterIds.includes(r.id));
      setRooms(filteredRooms);

      if (!filterIds.length) { setLoading(false); return; }

      // 3. Fetch readings
      let q = supabase
        .from("room_moisture_readings")
        .select("*, room:project_rooms(id, name, floor)")
        .in("room_id", filterIds)
        .order("reading_date", { ascending: true })
        .order("reading_time", { ascending: true, nullsFirst: true });
      if (block.dateFrom) q = q.gte("reading_date", block.dateFrom);
      if (block.dateTo)   q = q.lte("reading_date", block.dateTo);
      if ((block.readingTypes || []).length) q = q.in("reading_type", block.readingTypes);
      const { data: rdData, error: rdErr } = await q;
      if (rdErr) throw rdErr;
      const rdList = rdData || [];
      setReadings(rdList);

      // 4. Fetch equipment
      const { data: eqData } = await supabase
        .from("room_equipment_assignments")
        .select("*, room:project_rooms(id, name, floor)")
        .in("room_id", filterIds)
        .order("placement_date", { ascending: true });
      const eqList = eqData || [];
      setEquipment(eqList);

      // 5. Fetch photos for these readings
      const rdIds = rdList.map(r => r.id);
      let phList = [];
      if (rdIds.length) {
        const { data: phData } = await supabase
          .from("moisture_reading_photos")
          .select("*")
          .in("reading_id", rdIds)
          .order("created_at");
        phList = phData || [];
      }
      setPhotos(phList);

      // 6. Generate summary if blank or auto
      let summary = block.summaryText;
      if (!summary || block._summaryAuto) {
        summary = generateAutoSummary(rdList, eqList, filteredRooms, project);
      }

      // 7. Cache on the block for print
      updateBlock(block.id, {
        _rooms:     filteredRooms,
        _allRooms:  allR,
        _readings:  rdList,
        _equipment: eqList,
        _photos:    phList,
        _summaryAuto: true,
        summaryText: summary,
      });
    } catch (e) {
      setError(e.message || "Failed to load moisture data.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, block.roomIds, block.dateFrom, block.dateTo, block.readingTypes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { rooms, allRooms, readings, equipment, photos, loading, error, refetch: fetchAll };
}

// ─────────────────────────────────────────────────────────────────────────────
// BlockConfigBar — shared pill-toggle row for section visibility
// ─────────────────────────────────────────────────────────────────────────────

function ConfigToggle({ label, value, onChange }) {
  return (
    <button onClick={onChange} style={{
      padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
      border: `1.5px solid ${value ? "var(--accent)" : "var(--border)"}`,
      background: value ? "var(--accent-glow, #e8f0fe)" : "transparent",
      color: value ? "var(--accent)" : "var(--text3)",
      transition: "all .12s",
    }}>
      {value ? "✓ " : ""}{label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MoistureDataBlock — editor view
// ─────────────────────────────────────────────────────────────────────────────

export function MoistureDataBlock({ block, updateBlock, project, settings }) {
  const { rooms, allRooms, readings, equipment, photos, loading, error, refetch } =
    useMoistureData({ project, block, updateBlock });

  const showGraph   = block.showGraph   !== false;
  const showTable   = block.showTable   !== false;
  const showPhotos  = block.showPhotos  !== false;
  const showSummary = block.showSummary !== false;
  const showEnv     = block.showEnv     === true;

  const hasData = readings.length > 0;

  const toggle = (key) => updateBlock(block.id, { [key]: !block[key] });

  return (
    <div style={{ border: "2px solid #c8d4f0", borderRadius: 8, background: "#f8f9ff", margin: "6px 0" }}>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #d8e0f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#5a72b0" }}>
          💧 Moisture &amp; Drying Data
        </span>
        {loading && <span style={{ fontSize: 10, color: "#a0b0d0", fontStyle: "italic" }}>Loading…</span>}
        {error && <span style={{ fontSize: 10, color: "#e85a3a" }}>⚠ {error}</span>}
        <button onClick={refetch} title="Refresh data from Supabase"
          style={{ marginLeft: 4, padding: "2px 8px", borderRadius: 4, border: "1px solid #c8d4f0", background: "white", fontSize: 10, cursor: "pointer", color: "#5a72b0" }}>
          ↻ Refresh
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <ConfigToggle label="Graph"   value={showGraph}   onChange={() => toggle("showGraph")} />
          <ConfigToggle label="Table"   value={showTable}   onChange={() => toggle("showTable")} />
          <ConfigToggle label="Photos"  value={showPhotos}  onChange={() => toggle("showPhotos")} />
          <ConfigToggle label="Summary" value={showSummary} onChange={() => toggle("showSummary")} />
          <ConfigToggle label="Env"     value={showEnv}     onChange={() => updateBlock(block.id, { showEnv: !showEnv })} />
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 8, padding: "6px 12px", borderBottom: "1px solid #d8e0f0", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#7a8fc0", whiteSpace: "nowrap" }}>ROOMS:</span>
        <select multiple value={block.roomIds || []}
          onChange={e => updateBlock(block.id, { roomIds: [...e.target.selectedOptions].map(o => o.value) })}
          style={{ fontSize: 11, background: "white", border: "1px solid #c8d4f0", borderRadius: 4, padding: "2px 4px", minWidth: 120, maxHeight: 54, color: "#333" }}>
          {allRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#a0b0d0" }}>(none = all)</span>

        <span style={{ fontSize: 10, fontWeight: 700, color: "#7a8fc0", marginLeft: 8, whiteSpace: "nowrap" }}>FROM:</span>
        <input type="date" value={block.dateFrom || ""} onChange={e => updateBlock(block.id, { dateFrom: e.target.value })}
          style={{ fontSize: 11, background: "white", border: "1px solid #c8d4f0", borderRadius: 4, padding: "3px 6px", color: "#333" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#7a8fc0", whiteSpace: "nowrap" }}>TO:</span>
        <input type="date" value={block.dateTo || ""} onChange={e => updateBlock(block.id, { dateTo: e.target.value })}
          style={{ fontSize: 11, background: "white", border: "1px solid #c8d4f0", borderRadius: 4, padding: "3px 6px", color: "#333" }} />

        <span style={{ fontSize: 10, fontWeight: 700, color: "#7a8fc0", marginLeft: 8, whiteSpace: "nowrap" }}>TYPES:</span>
        <select multiple value={block.readingTypes || []}
          onChange={e => updateBlock(block.id, { readingTypes: [...e.target.selectedOptions].map(o => o.value) })}
          style={{ fontSize: 11, background: "white", border: "1px solid #c8d4f0", borderRadius: 4, padding: "2px 4px", minWidth: 100, maxHeight: 54, color: "#333" }}>
          {READING_TYPE_LIST.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#a0b0d0" }}>(none = all)</span>
      </div>

      {/* Content */}
      {!hasData && !loading && (
        <div style={{ padding: "24px", textAlign: "center", color: "#a0b0d0", fontSize: 12, fontStyle: "italic" }}>
          No moisture readings found for this project yet.
          {allRooms.length === 0 && " Add rooms in the Rooms tab first."}
        </div>
      )}

      {hasData && (
        <div style={{ padding: "10px 12px" }}>
          {/* Stats bar */}
          <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              ["Readings", readings.length],
              ["Rooms", rooms.length],
              ["Materials", new Set(readings.map(r => r.material_type).filter(Boolean)).size],
              ["Date Range", readings.length ? `${fmtDateShort(readings[0].reading_date)} – ${fmtDateShort(readings[readings.length-1].reading_date)}` : "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ background: "white", border: "1px solid #d8e0f0", borderRadius: 6, padding: "5px 10px", minWidth: 80 }}>
                <div style={{ fontSize: 10, color: "#a0b0d0", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2744" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Drying Graph */}
          {showGraph && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7a8fc0", marginBottom: 6 }}>
                Drying Progress Graph
              </div>
              <div style={{ background: "white", border: "1px solid #d8e0f0", borderRadius: 6, padding: 8, overflowX: "auto" }}>
                <DryingGraphSVG readings={readings} width={700} height={240} />
              </div>
            </div>
          )}

          {/* Reading Table */}
          {showTable && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7a8fc0", marginBottom: 6 }}>
                Reading Evidence Table ({readings.length} readings)
              </div>
              <div style={{ background: "white", border: "1px solid #d8e0f0", borderRadius: 6, overflow: "auto", maxHeight: 320 }}>
                <ReadingTablePrint readings={readings} settings={settings} />
              </div>
            </div>
          )}

          {/* Photo Evidence */}
          {showPhotos && photos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7a8fc0", marginBottom: 6 }}>
                Photo Evidence ({photos.length} photos)
              </div>
              <div style={{ background: "white", border: "1px solid #d8e0f0", borderRadius: 6, padding: 8, maxHeight: 320, overflowY: "auto" }}>
                <PhotoEvidencePrint photos={photos} readings={readings} />
              </div>
            </div>
          )}
          {showPhotos && photos.length === 0 && (
            <div style={{ fontSize: 11, color: "#b0bdd8", fontStyle: "italic", marginBottom: 8 }}>
              No photos attached to readings.
            </div>
          )}

          {/* Drying Summary (editable) */}
          {showSummary && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7a8fc0", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                Drying Summary
                <button onClick={() => {
                  const text = generateAutoSummary(readings, equipment, rooms, project);
                  updateBlock(block.id, { summaryText: text, _summaryAuto: true });
                }} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, border: "1px solid #c8d4f0", background: "white", color: "#5a72b0", cursor: "pointer" }}>
                  ↻ Regenerate
                </button>
              </div>
              <textarea
                value={block.summaryText || ""}
                onChange={e => updateBlock(block.id, { summaryText: e.target.value, _summaryAuto: false })}
                rows={6}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, lineHeight: 1.7, padding: "8px 10px", border: "1px solid #c8d4f0", borderRadius: 6, background: "white", color: "#333", outline: "none", resize: "vertical" }}
                placeholder="Auto-generated drying summary will appear here. Edit as needed."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EquipmentLogBlock — editor view
// ─────────────────────────────────────────────────────────────────────────────

export function EquipmentLogBlock({ block, updateBlock, project, settings }) {
  const [allRooms,  setAllRooms]  = useState(block._allRooms  || []);
  const [equipment, setEquipment] = useState(block._equipment || []);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const fetchData = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true); setError("");
    try {
      const { data: rData } = await supabase.from("project_rooms").select("id, name, floor").eq("project_id", project.id).order("name");
      const allR = rData || [];
      setAllRooms(allR);

      const filterIds = (block.roomIds || []).length ? block.roomIds : allR.map(r => r.id);
      if (!filterIds.length) { setLoading(false); return; }

      const { data: eqData, error: eqErr } = await supabase
        .from("room_equipment_assignments")
        .select("*, room:project_rooms(id, name, floor)")
        .in("room_id", filterIds)
        .order("placement_date", { ascending: true });
      if (eqErr) throw eqErr;

      const eqList = eqData || [];
      setEquipment(eqList);
      updateBlock(block.id, { _allRooms: allR, _equipment: eqList });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, block.roomIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showNotes = block.showNotes !== false;

  return (
    <div style={{ border: "2px solid #c0d4c0", borderRadius: 8, background: "#f8fff8", margin: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #d0e8d0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#4a8a5a" }}>
          🔧 Equipment Log
        </span>
        {loading && <span style={{ fontSize: 10, color: "#a0b0d0", fontStyle: "italic" }}>Loading…</span>}
        {error && <span style={{ fontSize: 10, color: "#e85a3a" }}>⚠ {error}</span>}
        <button onClick={fetchData} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #c0d4c0", background: "white", fontSize: 10, cursor: "pointer", color: "#4a8a5a" }}>↻ Refresh</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <ConfigToggle label="Notes" value={showNotes} onChange={() => updateBlock(block.id, { showNotes: !showNotes })} />
        </div>
      </div>

      {/* Room filter */}
      <div style={{ display: "flex", gap: 8, padding: "6px 12px", borderBottom: "1px solid #d0e8d0", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#5a9a6a", whiteSpace: "nowrap" }}>ROOMS:</span>
        <select multiple value={block.roomIds || []}
          onChange={e => updateBlock(block.id, { roomIds: [...e.target.selectedOptions].map(o => o.value) })}
          style={{ fontSize: 11, background: "white", border: "1px solid #c0d4c0", borderRadius: 4, padding: "2px 4px", minWidth: 120, maxHeight: 54, color: "#333" }}>
          {allRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#a0b0d0" }}>(none = all)</span>
      </div>

      {/* Table */}
      <div style={{ padding: "10px 12px" }}>
        {equipment.length === 0 && !loading ? (
          <div style={{ textAlign: "center", color: "#a0d0a0", fontSize: 12, fontStyle: "italic", padding: 16 }}>
            No equipment assigned to this project yet.
          </div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#2a6640", color: "white" }}>
                {["Room", "Equipment Type", "Unit #", "Placed", "Removed", "Status", showNotes ? "Notes" : null]
                  .filter(Boolean).map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq, i) => (
                <tr key={eq.id || i} style={{ background: i % 2 === 0 ? "white" : "#f2faf2" }}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>{eq.room?.name || "—"}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>{eq.equipment_type || "—"}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>{eq.unit_number || "—"}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>{fmtDateShort(eq.placement_date)}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>{eq.removal_date ? fmtDateShort(eq.removal_date) : <em style={{ color: "#aaa" }}>Active</em>}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0" }}>
                    <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: eq.status === "active" || !eq.removal_date ? "#dcfce7" : "#f1f5f9",
                      color: eq.status === "active" || !eq.removal_date ? "#166534" : "#64748b" }}>
                      {eq.status || (eq.removal_date ? "Removed" : "Active")}
                    </span>
                  </td>
                  {showNotes && <td style={{ padding: "6px 8px", borderBottom: "1px solid #e0e8e0", color: "#666" }}>{eq.notes || ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DryingTimelineBlock — editor view
// ─────────────────────────────────────────────────────────────────────────────

function defaultTimelineEvents(project) {
  const events = [];
  if (project?.dateOfLoss) events.push({ id: "loss", date: project.dateOfLoss, label: "Date of Loss", type: "loss", description: "", locked: true });
  if (project?.dateInspection) events.push({ id: "inspection", date: project.dateInspection, label: "Initial Inspection", type: "mitigation", description: "", locked: false });
  if (project?.dateWorkPerformed) events.push({ id: "work", date: project.dateWorkPerformed, label: "Mitigation / Drying Started", type: "mitigation", description: "", locked: false });
  return events;
}

export function DryingTimelineBlock({ block, updateBlock, project, settings }) {
  const [autoEvents, setAutoEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load first/last reading dates as auto events
  useEffect(() => {
    if (!project?.id) return;
    setLoading(true);
    supabase.from("room_moisture_readings").select("reading_date")
      .eq("project_id", project.id).order("reading_date")
      .then(({ data }) => {
        if (!data?.length) { setLoading(false); return; }
        const first = data[0].reading_date;
        const last  = data[data.length - 1].reading_date;
        const autos = [
          { id: "auto_first", date: first, label: "First Moisture Reading", type: "monitoring", description: "", auto: true },
        ];
        if (first !== last) {
          autos.push({ id: "auto_last", date: last, label: "Most Recent Reading", type: "monitoring", description: "", auto: true });
        }
        setAutoEvents(autos);
        updateBlock(block.id, { _autoEvents: autos });
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Init events from project if empty
  useEffect(() => {
    if (!(block.events || []).length) {
      const defaults = defaultTimelineEvents(project);
      if (defaults.length) updateBlock(block.id, { events: defaults });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = block.events || [];
  const allEvents = [...events, ...autoEvents]
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const addEvent = () => {
    const newEv = { id: `ev_${Date.now()}`, date: new Date().toISOString().slice(0,10), label: "New Event", type: "monitoring", description: "" };
    updateBlock(block.id, { events: [...events, newEv] });
  };

  const updateEvent = (id, patch) => {
    updateBlock(block.id, { events: events.map(e => e.id === id ? { ...e, ...patch } : e) });
  };

  const deleteEvent = (id) => {
    updateBlock(block.id, { events: events.filter(e => e.id !== id) });
  };

  const typeColors = { loss: "#e85a3a", mitigation: "#2b7fe8", monitoring: "#3dba7e", compliance: "#8b7cf8", current: "#e8c53a" };
  const typeLabel  = { loss: "Loss", mitigation: "Mitigation", monitoring: "Monitoring", compliance: "Compliance", current: "Current" };

  return (
    <div style={{ border: "2px solid #d8c0f0", borderRadius: 8, background: "#faf8ff", margin: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #d8c0f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#6a4aaa" }}>
          📅 Drying Timeline
        </span>
        {loading && <span style={{ fontSize: 10, color: "#a0b0d0", fontStyle: "italic" }}>Loading auto-events…</span>}
        <button onClick={addEvent} style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 4, border: "1px solid #d8c0f0", background: "white", fontSize: 11, cursor: "pointer", color: "#6a4aaa", fontWeight: 600 }}>
          + Add Event
        </button>
      </div>

      {/* Timeline visual */}
      <div style={{ padding: "12px 16px" }}>
        {allEvents.length === 0 ? (
          <div style={{ textAlign: "center", color: "#c0a0e0", fontSize: 12, fontStyle: "italic", padding: 16 }}>
            No timeline events yet. Add key dates using the button above.
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Line */}
            <div style={{ position: "absolute", left: 12, top: 0, bottom: 0, width: 2, background: "#e8d0f8" }} />
            {allEvents.map((ev, i) => {
              const color = typeColors[ev.type] || "#888";
              const isAuto = ev.auto;
              const isLocked = ev.locked;
              return (
                <div key={ev.id} style={{ display: "flex", gap: 12, marginBottom: 16, paddingLeft: 32, position: "relative" }}>
                  {/* Dot */}
                  <div style={{ position: "absolute", left: 6, top: 4, width: 14, height: 14, borderRadius: "50%", background: color, border: "2px solid white", boxShadow: `0 0 0 2px ${color}30`, zIndex: 1 }} />
                  {/* Content */}
                  <div style={{ flex: 1, background: "white", border: `1px solid ${color}40`, borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: `${color}20`, color }}>
                        {typeLabel[ev.type] || ev.type}
                      </span>
                      {isAuto && <span style={{ fontSize: 9, color: "#a0b0d0", fontStyle: "italic" }}>auto</span>}
                      {!isAuto && !isLocked && (
                        <button onClick={() => deleteEvent(ev.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!isAuto && !isLocked
                        ? <>
                            <input type="date" value={ev.date || ""} onChange={e => updateEvent(ev.id, { date: e.target.value })}
                              style={{ fontSize: 11, border: "1px solid #e0d0f0", borderRadius: 4, padding: "2px 6px", color: "#333" }} />
                            <input value={ev.label || ""} onChange={e => updateEvent(ev.id, { label: e.target.value })}
                              style={{ flex: 1, fontSize: 12, fontWeight: 600, border: "none", borderBottom: "1px dashed #e0d0f0", outline: "none", color: "#333", background: "transparent" }}
                              placeholder="Event label" />
                            <select value={ev.type || "monitoring"} onChange={e => updateEvent(ev.id, { type: e.target.value })}
                              style={{ fontSize: 10, border: "1px solid #e0d0f0", borderRadius: 4, padding: "2px 6px", color: "#555" }}>
                              {Object.keys(typeColors).map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
                            </select>
                          </>
                        : <>
                            <span style={{ fontSize: 11, color: "#888", minWidth: 70 }}>{fmtDateShort(ev.date)}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{ev.label}</span>
                          </>
                      }
                    </div>
                    {!isAuto && (
                      <input value={ev.description || ""} onChange={e => updateEvent(ev.id, { description: e.target.value })}
                        style={{ width: "100%", marginTop: 4, fontSize: 11, color: "#666", border: "none", borderBottom: "1px dashed #e0d0f0", outline: "none", background: "transparent" }}
                        placeholder="Optional description…" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RestorationToolsPopup — floating insertion menu
// ─────────────────────────────────────────────────────────────────────────────

export function RestorationToolsPopup({ onAdd, onClose }) {
  const options = [
    {
      type: "moisture_data",
      icon: "💧",
      label: "Moisture & Drying Data",
      desc: "SVG drying graph, 12-col reading table, photo evidence, auto-summary",
    },
    {
      type: "equipment_log",
      icon: "🔧",
      label: "Equipment Log",
      desc: "Room-by-room equipment table with placement/removal dates and status",
    },
    {
      type: "drying_timeline",
      icon: "📅",
      label: "Drying Timeline",
      desc: "Date of loss → mitigation → monitoring → current state timeline",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.45)",
      }} />
      {/* Centered modal */}
      <div style={{
        position: "fixed", zIndex: 9999,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,.35)", padding: 16, minWidth: 360, maxWidth: 420, width: "90vw",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text3)" }}>
            🏗 Restoration Tools — Insert Block
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>✕</button>
        </div>
        {options.map(opt => (
          <button key={opt.type} onClick={() => { onAdd(opt.type); onClose(); }}
            style={{
              width: "100%", textAlign: "left", background: "transparent", border: "1px solid transparent",
              borderRadius: 7, padding: "10px 12px", cursor: "pointer", marginBottom: 4,
              transition: "background .1s, border-color .1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{opt.desc}</div>
              </div>
            </div>
          </button>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 10 }}>
          <div style={{ fontSize: 10.5, color: "var(--text3)", padding: "0 4px" }}>
            Data is pulled live from the Rooms tab. Configure date/room filters per block.
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Print renderers — pure components, no hooks, use block._resolved data
// ─────────────────────────────────────────────────────────────────────────────

export function MoistureDataBlockPrint({ block, settings }) {
  const readings  = block._readings  || [];
  const equipment = block._equipment || [];
  const photos    = block._photos    || [];
  const rooms     = block._rooms     || [];

  const showGraph   = block.showGraph   !== false;
  const showTable   = block.showTable   !== false;
  const showPhotos  = block.showPhotos  !== false;
  const showSummary = block.showSummary !== false;

  const sectionHead = (label) => (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#5a72b0", marginTop: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
      {label}
      <div style={{ flex: 1, height: 1, background: "#d8e0f0" }} />
    </div>
  );

  if (readings.length === 0 && equipment.length === 0) {
    return (
      <div style={{ padding: "12px 36px" }}>
        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic", padding: "16px 0", textAlign: "center", border: "1px dashed #e0e0e0", borderRadius: 6 }}>
          Moisture data not yet loaded — open the report in the editor to load data, then re-export.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 36px 18px" }}>
      {/* Block title */}
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1a2744", marginBottom: 2 }}>
        {block.title || "Moisture & Drying Data"}
      </div>
      {rooms.length > 0 && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
          Rooms: {rooms.map(r => r.name).join(", ")}
          {(block.dateFrom || block.dateTo) && ` · ${block.dateFrom ? fmtDateShort(block.dateFrom) : "All"} – ${block.dateTo ? fmtDateShort(block.dateTo) : "Current"}`}
        </div>
      )}

      {showGraph && readings.filter(r => r.mc_percent != null).length > 0 && (
        <>
          {sectionHead("Drying Progress Graph")}
          <DryingGraphSVG readings={readings} width={744} height={260} />
        </>
      )}

      {showTable && readings.length > 0 && (
        <>
          {sectionHead(`Reading Evidence (${readings.length} readings)`)}
          <ReadingTablePrint readings={readings} settings={settings} />
        </>
      )}

      {showPhotos && photos.length > 0 && (
        <>
          {sectionHead(`Photo Evidence (${photos.length} photos)`)}
          <PhotoEvidencePrint photos={photos} readings={readings} />
        </>
      )}

      {showSummary && block.summaryText && (
        <>
          {sectionHead("Drying Summary")}
          <div style={{ fontSize: 11.5, lineHeight: 1.75, color: "#333", whiteSpace: "pre-wrap" }}>
            {block.summaryText}
          </div>
        </>
      )}
    </div>
  );
}

export function EquipmentLogBlockPrint({ block, settings }) {
  const equipment = block._equipment || [];
  const showNotes = block.showNotes !== false;

  return (
    <div style={{ padding: "14px 36px 18px" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1a4a2a", marginBottom: 10 }}>
        {block.title || "Equipment Log"}
      </div>
      {equipment.length === 0 ? (
        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic", textAlign: "center", padding: "12px 0", border: "1px dashed #e0e0e0", borderRadius: 6 }}>
          No equipment data loaded.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#2a6640", color: "white" }}>
              {["Room", "Equipment", "Unit #", "Placed", "Removed", "Status", showNotes && "Notes"].filter(Boolean).map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", border: "1px solid #2a6640" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq, i) => (
              <tr key={eq.id || i} style={{ background: i % 2 === 0 ? "white" : "#f4fbf4" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>{eq.room?.name || "—"}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>{eq.equipment_type || "—"}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>{eq.unit_number || "—"}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>{fmtDate(eq.placement_date)}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>{eq.removal_date ? fmtDate(eq.removal_date) : "Active"}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8" }}>
                  <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9.5, fontWeight: 700,
                    background: (!eq.removal_date || eq.status === "active") ? "#dcfce7" : "#f1f5f9",
                    color: (!eq.removal_date || eq.status === "active") ? "#166534" : "#64748b" }}>
                    {eq.status || (eq.removal_date ? "Removed" : "Active")}
                  </span>
                </td>
                {showNotes && <td style={{ padding: "6px 8px", border: "1px solid #d8e8d8", color: "#555", fontStyle: "italic" }}>{eq.notes || ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DryingTimelineBlockPrint({ block, settings }) {
  const events = block.events || [];
  const autoEvents = block._autoEvents || [];
  const all = [...events, ...autoEvents]
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const typeColors = { loss: "#e85a3a", mitigation: "#2b7fe8", monitoring: "#3dba7e", compliance: "#8b7cf8", current: "#e8c53a" };
  const typeLabel  = { loss: "Loss", mitigation: "Mitigation", monitoring: "Monitoring", compliance: "Compliance", current: "Current" };

  return (
    <div style={{ padding: "14px 36px 18px" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#3a2a6a", marginBottom: 14 }}>
        {block.title || "Drying Timeline"}
      </div>
      {all.length === 0 ? (
        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>No timeline events defined.</div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: 8, top: 6, bottom: 6, width: 2, background: "#e0d0f0" }} />
          {all.map((ev, i) => {
            const color = typeColors[ev.type] || "#888";
            return (
              <div key={ev.id || i} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
                <div style={{ position: "absolute", left: -20, top: 5, width: 12, height: 12, borderRadius: "50%", background: color, border: "2px solid white", boxShadow: `0 0 0 2px ${color}50` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#888", minWidth: 56 }}>
                      {fmtDateShort(ev.date)}
                    </span>
                    <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 8, background: `${color}20`, color, fontWeight: 700 }}>
                      {typeLabel[ev.type] || ev.type}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{ev.label}</span>
                  </div>
                  {ev.description && (
                    <div style={{ fontSize: 11, color: "#666", marginTop: 3, paddingLeft: 66 }}>{ev.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
