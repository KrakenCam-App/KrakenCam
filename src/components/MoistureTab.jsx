/**
 * src/components/MoistureTab.jsx
 *
 * Production-grade room-level moisture tracking system for restoration.
 * Fully additive — no existing readings, columns, or RLS are modified.
 *
 * Exported: RoomMoistureTab
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { supabase } from "../lib/supabase.js";

// ── GPP / Dew-point formulas (duplicate-safe) ─────────────────────────────────
function calcGPP(humidity, tempF) {
  if (humidity == null || tempF == null) return null;
  const tempC = (tempF - 32) * 5 / 9;
  const es = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  const ea = (humidity / 100) * es;
  const absHum = (ea * 18.016) / (8.314 * (tempC + 273.15));
  return Math.round(absHum * 7000 * 100) / 100;
}
function calcDewPoint(humidity, tempF) {
  if (humidity == null || tempF == null) return null;
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.67, b = 243.5;
  const gamma = Math.log(humidity / 100) + (a * tempC) / (b + tempC);
  const dpC = (b * gamma) / (a - gamma);
  return Math.round(((dpC * 9) / 5 + 32) * 10) / 10;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function localDatetimeNow() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const READING_TYPES = [
  { value: "initial",      label: "Initial",      color: "#ef4444", bg: "#ef444418" },
  { value: "monitoring",   label: "Monitoring",   color: "#3ab8e8", bg: "#3ab8e818" },
  { value: "final",        label: "Final",        color: "#22c55e", bg: "#22c55e18" },
  { value: "control",      label: "Control",      color: "#a78bfa", bg: "#a78bfa18" },
  { value: "dry_standard", label: "Dry Standard", color: "#f59e0b", bg: "#f59e0b18" },
];
const READING_TYPE_MAP = Object.fromEntries(READING_TYPES.map(t => [t.value, t]));

const PHOTO_TYPES = [
  { value: "meter_reading",   label: "Meter Reading",   icon: "📷" },
  { value: "room_condition",  label: "Room Condition",  icon: "🏠" },
  { value: "drying_setup",    label: "Drying Setup",    icon: "💨" },
  { value: "material_closeup",label: "Material Close-Up",icon: "🔬" },
  { value: "other",           label: "Other",           icon: "📸" },
];
const PHOTO_TYPE_MAP = Object.fromEntries(PHOTO_TYPES.map(t => [t.value, t]));

const READING_METHODS = ["pin", "pinless", "ambient", "other"];
const MATERIAL_PRESETS = [
  "Drywall", "Subfloor", "Wood Framing", "Concrete",
  "Insulation", "OSB", "Plywood", "Carpet", "Hardwood Floor", "Tile Backer",
];

const LINE_COLORS = [
  "#3ab8e8", "#3dba7e", "#f59e0b", "#8b7cf8", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

// ── Mini Btn ──────────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, children, variant = "primary", size = "md", style: sx }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 8, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? .5 : 1, border: "none", transition: "opacity .15s",
    fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "5px 10px" : "8px 14px",
  };
  const variants = {
    primary:   { background: "var(--accent,#2563eb)", color: "#fff" },
    secondary: { background: "var(--surface2,#2a2a2a)", color: "var(--text,#fff)", border: "1px solid var(--border,#333)" },
    ghost:     { background: "transparent", color: "var(--text2,#aaa)" },
    danger:    { background: "#dc2626", color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...sx }}>
      {children}
    </button>
  );
}

// ── Reading Type Badge ─────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = READING_TYPE_MAP[type] || READING_TYPE_MAP.monitoring;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
      background: t.bg, color: t.color, border: `1px solid ${t.color}40`,
      letterSpacing: ".3px", whiteSpace: "nowrap",
    }}>{t.label}</span>
  );
}

// ── Stalled Alert Banner ──────────────────────────────────────────────────────
function StalledBanner({ flag }) {
  if (!flag) return null;
  const isStalled = flag === "stalled";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
      borderRadius: 10, marginBottom: 14,
      background: isStalled ? "#ef444418" : "#f59e0b18",
      border: `1px solid ${isStalled ? "#ef4444" : "#f59e0b"}60`,
    }}>
      <span style={{ fontSize: 20 }}>{isStalled ? "🚨" : "⚠️"}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: isStalled ? "#ef4444" : "#f59e0b" }}>
          {isStalled ? "Drying Stalled" : "Drying Needs Review"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text2,#aaa)", marginTop: 1 }}>
          {isStalled
            ? "Moisture readings have not decreased over the last 3+ readings. Action may be required."
            : "Drying progress has slowed. Monitor closely and consider adjusting equipment placement."}
        </div>
      </div>
    </div>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────
function SummaryCards({ readings }) {
  if (readings.length === 0) return null;
  const moistureReadings = readings.filter(r => r.material_moisture_value != null);
  const latest    = readings[0];
  const highest   = moistureReadings.reduce((a, b) => (b.material_moisture_value > a.material_moisture_value ? b : a), moistureReadings[0]);
  const lowest    = moistureReadings.reduce((a, b) => (b.material_moisture_value < a.material_moisture_value ? b : a), moistureReadings[0]);

  // Trend: compare last 3 moisture readings
  let trend = null;
  if (moistureReadings.length >= 2) {
    const sorted = [...moistureReadings].sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at));
    const last3 = sorted.slice(-3);
    const first = last3[0].material_moisture_value;
    const lastV = last3[last3.length - 1].material_moisture_value;
    const diff = lastV - first;
    if (Math.abs(diff) < 0.5)       trend = { label: "Stable",    icon: "→", color: "#f59e0b" };
    else if (diff < 0)              trend = { label: "Improving", icon: "↓", color: "#22c55e" };
    else                            trend = { label: "Worsening", icon: "↑", color: "#ef4444" };
  }

  const cards = [
    {
      label: "Latest Moisture",
      value: latest.material_moisture_value != null ? latest.material_moisture_value + "%" : "—",
      sub: latest.material_label || "",
      color: "var(--accent,#2563eb)",
    },
    {
      label: "Highest",
      value: highest ? highest.material_moisture_value + "%" : "—",
      sub: highest ? fmtDate(highest.reading_at) : "",
      color: "#ef4444",
    },
    {
      label: "Lowest",
      value: lowest ? lowest.material_moisture_value + "%" : "—",
      sub: lowest ? fmtDate(lowest.reading_at) : "",
      color: "#22c55e",
    },
    {
      label: "Trend",
      value: trend ? `${trend.icon} ${trend.label}` : "—",
      sub: `${moistureReadings.length} readings`,
      color: trend?.color || "var(--text3,#888)",
    },
    {
      label: "Latest RH",
      value: latest.humidity_percent != null ? latest.humidity_percent + "%" : "—",
      sub: latest.temperature_value != null ? latest.temperature_value + "°" + (latest.temperature_unit || "F") : "",
      color: "#3ab8e8",
    },
    {
      label: "Last Reading",
      value: fmtTime(latest.reading_at).split(" ").slice(0, 2).join(" "),
      sub: fmtTime(latest.reading_at).split(" ").slice(2).join(" "),
      color: "var(--text3,#888)",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
      gap: 10, marginBottom: 16,
    }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: "var(--surface2,#1a1a1a)", borderRadius: 10, padding: "10px 12px",
          border: "1px solid var(--border,#333)",
        }}>
          <div style={{ fontSize: 10.5, color: "var(--text3,#888)", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>{c.label}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
          {c.sub && <div style={{ fontSize: 11, color: "var(--text3,#888)", marginTop: 2 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Auto Summary ──────────────────────────────────────────────────────────────
function AutoSummary({ readings }) {
  const [editing, setEditing] = useState(false);
  const [customText, setCustomText] = useState("");

  const generated = useMemo(() => {
    const moist = readings.filter(r => r.material_moisture_value != null && r.material_label);
    if (moist.length < 2) return null;
    const sorted = [...moist].sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at));
    // Group by material
    const byMaterial = {};
    sorted.forEach(r => {
      const m = r.material_label.trim();
      if (!byMaterial[m]) byMaterial[m] = [];
      byMaterial[m].push(r);
    });
    const sentences = Object.entries(byMaterial)
      .filter(([, rs]) => rs.length >= 2)
      .map(([mat, rs]) => {
        const first = rs[0], last = rs[rs.length - 1];
        const firstV = first.material_moisture_value, lastV = last.material_moisture_value;
        const diff = Math.abs(lastV - firstV).toFixed(1);
        const direction = lastV < firstV ? "reduced" : "increased";
        const days = Math.round((new Date(last.reading_at) - new Date(first.reading_at)) / 86400000);
        const dayStr = days === 0 ? "same day" : days === 1 ? "1 day" : `${days} days`;
        return `${mat} moisture ${direction} from ${firstV}% to ${lastV}% over ${rs.length} readings (${dayStr}, ${fmtDate(first.reading_at)} – ${fmtDate(last.reading_at)}).`;
      });
    if (sentences.length === 0) return null;
    return sentences.join(" ");
  }, [readings]);

  const display = customText || generated;
  if (!display && !editing) return null;

  return (
    <div style={{
      background: "var(--surface2,#1a1a1a)", borderRadius: 10, padding: "12px 14px",
      border: "1px solid var(--border,#333)", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3,#888)", textTransform: "uppercase", letterSpacing: ".4px" }}>
          📝 Auto Summary
        </div>
        <Btn size="sm" variant="ghost" onClick={() => { setEditing(!editing); if (!customText && generated) setCustomText(generated); }}>
          {editing ? "Done" : "Edit"}
        </Btn>
      </div>
      {editing ? (
        <textarea
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          placeholder={generated || "Add a summary…"}
          rows={3}
          style={{
            width: "100%", background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
            borderRadius: 7, padding: "8px 10px", fontSize: 13, color: "var(--text,#fff)",
            resize: "vertical", boxSizing: "border-box",
          }}
        />
      ) : (
        <div style={{ fontSize: 13, color: "var(--text2,#ccc)", lineHeight: 1.6 }}>
          {display}
        </div>
      )}
    </div>
  );
}

// ── Drying Graph (SVG) ─────────────────────────────────────────────────────────
function DryingGraph({ readings }) {
  const [visibleLines, setVisibleLines] = useState(new Set(["moisture", "rh", "temp"]));
  const [filterMaterial, setFilterMaterial] = useState("all");
  const [hovered, setHovered] = useState(null); // { x, y, point }
  const svgRef = useRef(null);

  const WIDTH = 680, HEIGHT = 220, PAD = { top: 14, right: 60, bottom: 40, left: 50 };
  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  // All materials
  const materials = useMemo(() =>
    [...new Set(readings.filter(r => r.material_label).map(r => r.material_label.trim()))].sort(),
  [readings]);

  // Filter + sort readings
  const filtered = useMemo(() => {
    const sorted = [...readings].sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at));
    return sorted;
  }, [readings]);

  // Data series: one per material for moisture, plus env lines
  const moistureByMaterial = useMemo(() => {
    return materials
      .filter(m => filterMaterial === "all" || m === filterMaterial)
      .map((mat, idx) => ({
        key: `mat_${mat}`,
        label: mat,
        color: LINE_COLORS[idx % LINE_COLORS.length],
        points: filtered.filter(r => r.material_label?.trim() === mat && r.material_moisture_value != null)
          .map(r => ({ ts: new Date(r.reading_at).getTime(), v: r.material_moisture_value, r })),
      }))
      .filter(s => s.points.length > 0);
  }, [filtered, materials, filterMaterial]);

  const rhSeries = useMemo(() => ({
    key: "rh", label: "RH %", color: "#3ab8e8", dashed: true,
    points: filtered.filter(r => r.humidity_percent != null)
      .map(r => ({ ts: new Date(r.reading_at).getTime(), v: r.humidity_percent, r })),
  }), [filtered]);

  const tempSeries = useMemo(() => ({
    key: "temp", label: "Temp °F", color: "#f59e0b", dashed: true,
    points: filtered.filter(r => r.temperature_value != null)
      .map(r => ({ ts: new Date(r.reading_at).getTime(), v: r.temperature_value, r })),
  }), [filtered]);

  const gppSeries = useMemo(() => ({
    key: "gpp", label: "GPP", color: "#a78bfa", dashed: true,
    points: filtered.filter(r => r.gpp_value != null)
      .map(r => ({ ts: new Date(r.reading_at).getTime(), v: r.gpp_value, r })),
  }), [filtered]);

  const allSeries = useMemo(() => [
    ...moistureByMaterial,
    ...(visibleLines.has("rh")   ? [rhSeries]   : []),
    ...(visibleLines.has("temp") ? [tempSeries]  : []),
    ...(visibleLines.has("gpp")  ? [gppSeries]   : []),
  ].filter(s => s.points.length > 0), [moistureByMaterial, rhSeries, tempSeries, gppSeries, visibleLines]);

  // Scale
  const allPoints = allSeries.flatMap(s => s.points);
  if (allPoints.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3,#888)", fontSize: 13 }}>
        Not enough data to display graph. Add at least 2 readings.
      </div>
    );
  }

  const tsValues = allPoints.map(p => p.ts);
  const vValues  = allPoints.map(p => p.v);
  const tsMin = Math.min(...tsValues), tsMax = Math.max(...tsValues);
  const vMin  = Math.max(0, Math.min(...vValues) - 2);
  const vMax  = Math.max(...vValues) + 2;
  const tsRange = tsMax - tsMin || 1;
  const vRange  = vMax - vMin || 1;

  const toX = ts => PAD.left + ((ts - tsMin) / tsRange) * chartW;
  const toY = v  => PAD.top  + chartH - ((v - vMin) / vRange) * chartH;

  // X-axis ticks (up to 6)
  const nTicks = Math.min(6, allPoints.length);
  const xTicks = Array.from({ length: nTicks }, (_, i) => {
    const ts = tsMin + (tsRange * i) / Math.max(nTicks - 1, 1);
    return { ts, x: toX(ts), label: new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });

  // Y-axis ticks
  const ySteps = 4;
  const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => {
    const v = vMin + (vRange * i) / ySteps;
    return { v: Math.round(v * 10) / 10, y: toY(v) };
  });

  // Build path
  function makePath(points) {
    if (points.length < 2) return null;
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.ts).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ");
  }

  // Dry standard reference line
  const dryStdReadings = filtered.filter(r => r.is_dry_standard && r.material_moisture_value != null);
  const dryStdAvg = dryStdReadings.length > 0
    ? dryStdReadings.reduce((s, r) => s + r.material_moisture_value, 0) / dryStdReadings.length
    : null;

  const toggleLine = (key) => {
    setVisibleLines(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  // NOTE: plain function (not useCallback) — avoids calling a hook after the
  // conditional early-return above (would trigger React error #310).
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
    const mouseTs = tsMin + ((mouseX - PAD.left) / chartW) * tsRange;
    // Find closest point
    let closest = null, minDist = Infinity;
    allSeries.forEach(s => s.points.forEach(p => {
      const d = Math.abs(p.ts - mouseTs);
      if (d < minDist) { minDist = d; closest = p; }
    }));
    if (closest) {
      setHovered({
        x: toX(closest.ts),
        y: toY(closest.v),
        r: closest.r,
        ts: closest.ts,
      });
    }
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {/* Material filter */}
        {materials.length > 1 && (
          <select
            value={filterMaterial}
            onChange={e => setFilterMaterial(e.target.value)}
            style={{ background: "var(--surface2,#2a2a2a)", border: "1px solid var(--border,#333)",
              borderRadius: 7, padding: "4px 8px", fontSize: 12, color: "var(--text,#fff)", cursor: "pointer" }}>
            <option value="all">All Materials</option>
            {materials.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {/* Overlay toggles */}
        {[
          { key: "rh",   label: "RH %",    color: "#3ab8e8" },
          { key: "temp", label: "Temp",    color: "#f59e0b" },
          { key: "gpp",  label: "GPP",     color: "#a78bfa" },
        ].map(t => (
          <button key={t.key} onClick={() => toggleLine(t.key)} style={{
            padding: "3px 10px", borderRadius: 6, border: `1px solid ${t.color}60`,
            background: visibleLines.has(t.key) ? `${t.color}20` : "var(--surface2,#2a2a2a)",
            color: visibleLines.has(t.key) ? t.color : "var(--text3,#888)",
            fontSize: 11.5, cursor: "pointer", fontWeight: 600,
          }}>{t.label}</button>
        ))}
        {/* Material line toggles */}
        {moistureByMaterial.map(s => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11.5, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border,#333)", background: "var(--surface2,#1a1a1a)" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid lines */}
          {yTicks.map(t => (
            <line key={t.v} x1={PAD.left} y1={t.y} x2={WIDTH - PAD.right} y2={t.y}
              stroke="rgba(255,255,255,.06)" strokeWidth={1} />
          ))}

          {/* Y-axis labels */}
          {yTicks.map(t => (
            <text key={t.v} x={PAD.left - 6} y={t.y + 4} textAnchor="end"
              fill="rgba(255,255,255,.35)" fontSize={10}>{t.v}</text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={HEIGHT - PAD.bottom + 14} textAnchor="middle"
              fill="rgba(255,255,255,.35)" fontSize={10}>{t.label}</text>
          ))}

          {/* Dry standard reference line */}
          {dryStdAvg != null && (
            <>
              <line x1={PAD.left} y1={toY(dryStdAvg)} x2={WIDTH - PAD.right} y2={toY(dryStdAvg)}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,4" opacity={.7} />
              <text x={WIDTH - PAD.right + 4} y={toY(dryStdAvg) + 4}
                fill="#f59e0b" fontSize={10}>dry std {dryStdAvg.toFixed(1)}%</text>
            </>
          )}

          {/* Data lines */}
          {allSeries.map(s => {
            const path = makePath(s.points);
            if (!path) return null;
            return (
              <g key={s.key}>
                <path d={path} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.5}
                  strokeDasharray={s.dashed ? "5,3" : undefined} opacity={.85} />
                {s.points.map((p, i) => (
                  <circle key={i} cx={toX(p.ts)} cy={toY(p.v)} r={3}
                    fill={s.color} opacity={.8} />
                ))}
              </g>
            );
          })}

          {/* Hover line */}
          {hovered && (
            <>
              <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={HEIGHT - PAD.bottom}
                stroke="rgba(255,255,255,.25)" strokeWidth={1} strokeDasharray="3,2" />
              <circle cx={hovered.x} cy={hovered.y} r={5} fill="white" opacity={.9} />
            </>
          )}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hovered && hovered.r && (
        <div style={{
          background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
          borderRadius: 8, padding: "8px 12px", marginTop: 6,
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8,
          fontSize: 12,
        }}>
          <div style={{ gridColumn: "1/-1", fontSize: 11, color: "var(--text3,#888)", fontWeight: 600 }}>
            {fmtTime(hovered.r.reading_at)} {hovered.r.material_label ? `· ${hovered.r.material_label}` : ""}
          </div>
          {hovered.r.material_moisture_value != null && <div>🌡 <strong>{hovered.r.material_moisture_value}%</strong> mat.</div>}
          {hovered.r.humidity_percent        != null && <div>💧 <strong>{hovered.r.humidity_percent}%</strong> RH</div>}
          {hovered.r.temperature_value       != null && <div>🌡 <strong>{hovered.r.temperature_value}°{hovered.r.temperature_unit}</strong></div>}
          {hovered.r.gpp_value               != null && <div>GPP: <strong>{hovered.r.gpp_value}</strong></div>}
          {hovered.r.dew_point_value         != null && <div>DP: <strong>{hovered.r.dew_point_value}°F</strong></div>}
          {hovered.r.reading_type && <div><TypeBadge type={hovered.r.reading_type} /></div>}
        </div>
      )}
    </div>
  );
}

// ── Environmental Summary ─────────────────────────────────────────────────────
function EnvironmentalSummary({ readings }) {
  const withEnv = readings.filter(r => r.humidity_percent != null || r.temperature_value != null);
  if (withEnv.length === 0) return null;

  const latest = withEnv[0];
  const sorted = [...withEnv].sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at));

  // Simple trend: first vs last
  const rhFirst = sorted.find(r => r.humidity_percent != null);
  const rhLast  = sorted.findLast(r => r.humidity_percent != null);
  const rhTrend = rhFirst && rhLast && rhFirst !== rhLast
    ? (rhLast.humidity_percent - rhFirst.humidity_percent) < 0 ? "↓ Decreasing" : "↑ Increasing"
    : "Stable";

  const items = [
    { label: "RH %",       value: latest.humidity_percent != null ? latest.humidity_percent + "%" : "—",  color: "#3ab8e8", sub: `Trend: ${rhTrend}` },
    { label: "Temperature",value: latest.temperature_value != null ? latest.temperature_value + "°" + (latest.temperature_unit || "F") : "—", color: "#f59e0b", sub: "" },
    { label: "GPP",        value: latest.gpp_value != null ? latest.gpp_value : "—",                     color: "#a78bfa", sub: "gr/lb" },
    { label: "Dew Point",  value: latest.dew_point_value != null ? latest.dew_point_value + "°F" : "—",   color: "#06b6d4", sub: "" },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3,#888)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Environmental Conditions</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {items.map(item => (
          <div key={item.label} style={{
            background: "var(--surface2,#1a1a1a)", borderRadius: 8, padding: "10px 12px",
            border: `1px solid ${item.color}30`,
          }}>
            <div style={{ fontSize: 10.5, color: "var(--text3,#888)", fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: item.color }}>{item.value}</div>
            {item.sub && <div style={{ fontSize: 10.5, color: "var(--text3,#888)", marginTop: 2 }}>{item.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Equipment Snapshot ────────────────────────────────────────────────────────
function EquipmentSnapshot({ roomId, projectId, orgId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("room_equipment_assignments")
      .select("*, equipment(id,name,status,equipment_types(name))")
      .eq("room_id", roomId)
      .eq("project_id", projectId)
      .is("removed_at", null)
      .order("placed_at", { ascending: false })
      .then(({ data }) => { setAssignments(data || []); setLoading(false); });
  }, [roomId, projectId]);

  if (loading || assignments.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3,#888)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>
        Drying Equipment in Room
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {assignments.map(a => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 11px",
            background: "var(--surface2,#1a1a1a)", borderRadius: 8,
            border: "1px solid var(--border,#333)", fontSize: 12,
          }}>
            <span style={{ fontSize: 16 }}>💨</span>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text,#fff)" }}>{a.equipment?.name || "—"}</div>
              <div style={{ fontSize: 10.5, color: "var(--text3,#888)" }}>
                {a.equipment?.equipment_types?.name || ""} · Placed {fmtTime(a.placed_at)}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
              background: "#3dba7e18", color: "#3dba7e", border: "1px solid #3dba7e30",
            }}>Active</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Photo Upload Component ────────────────────────────────────────────────────
function PhotoUploader({ orgId, projectId, roomId, readingId, onUploaded }) {
  const fileRef = useRef(null);
  const [uploads, setUploads] = useState([]); // { file, type, caption, status, url }

  const handleFiles = (files) => {
    const items = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      previewUrl: URL.createObjectURL(f),
      type: "meter_reading",
      caption: "",
      status: "pending", // pending | uploading | done | error
      url: null,
    }));
    setUploads(prev => [...prev, ...items]);
  };

  const uploadAll = async () => {
    const pending = uploads.filter(u => u.status === "pending");
    for (const u of pending) {
      setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "uploading" } : x));
      try {
        const ext = u.file.name.split(".").pop() || "jpg";
        const path = `${orgId}/${projectId}/moisture-photos/${readingId}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-photos")
          .upload(path, u.file, { contentType: u.file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("project-photos").getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        const { data: photoRow, error: dbErr } = await supabase
          .from("moisture_reading_photos")
          .insert([{
            organization_id: orgId, project_id: projectId, room_id: roomId,
            reading_id: readingId, photo_url: publicUrl,
            photo_type: u.type, caption: u.caption || null,
          }])
          .select()
          .single();
        if (dbErr) throw dbErr;

        setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "done", url: publicUrl } : x));
        onUploaded?.(photoRow);
      } catch (e) {
        setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "error", err: e.message } : x));
      }
    }
  };

  const removeItem = (id) => setUploads(prev => prev.filter(x => x.id !== id));
  const updateItem = (id, updates) => setUploads(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));

  const hasPending = uploads.some(u => u.status === "pending");

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        style={{
          border: "2px dashed var(--border,#444)", borderRadius: 8, padding: "16px",
          textAlign: "center", cursor: "pointer", color: "var(--text3,#888)",
          fontSize: 13, marginBottom: 10,
          transition: "border-color .15s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent,#2563eb)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border,#444)"}
      >
        📷 Tap to take photo or upload · drag &amp; drop
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
        style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />

      {/* Preview list */}
      {uploads.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {uploads.map(u => (
            <div key={u.id} style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px",
              background: "var(--surface2,#2a2a2a)", borderRadius: 8,
              border: `1px solid ${u.status === "done" ? "#22c55e40" : u.status === "error" ? "#ef444440" : "var(--border,#333)"}`,
            }}>
              <img src={u.previewUrl} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <select
                  value={u.type}
                  onChange={e => updateItem(u.id, { type: e.target.value })}
                  disabled={u.status !== "pending"}
                  style={{ background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
                    borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text,#fff)" }}>
                  {PHOTO_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.icon} {pt.label}</option>
                  ))}
                </select>
                <input
                  placeholder="Caption (optional)"
                  value={u.caption}
                  onChange={e => updateItem(u.id, { caption: e.target.value })}
                  disabled={u.status !== "pending"}
                  style={{ background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
                    borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text,#fff)" }}
                />
              </div>
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {u.status === "pending"   && <span style={{ fontSize: 11, color: "var(--text3,#888)" }}>Ready</span>}
                {u.status === "uploading" && <span style={{ fontSize: 11, color: "#3ab8e8" }}>⬆️</span>}
                {u.status === "done"      && <span style={{ fontSize: 16 }}>✅</span>}
                {u.status === "error"     && <span style={{ fontSize: 11, color: "#ef4444" }}>❌</span>}
                {u.status === "pending" && (
                  <button onClick={() => removeItem(u.id)}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasPending && (
        <Btn variant="secondary" size="sm" onClick={uploadAll}>
          ⬆️ Upload {uploads.filter(u => u.status === "pending").length} Photo{uploads.filter(u => u.status === "pending").length !== 1 ? "s" : ""}
        </Btn>
      )}
    </div>
  );
}

// ── Enhanced Add Reading Modal ─────────────────────────────────────────────────
function MoistureAddModal({ room, orgId, projectId, userId, teamUsers = [], onSave, onClose }) {
  const [form, setForm] = useState({
    reading_at:             localDatetimeNow(),
    material_label:         "",
    material_moisture_value:"",
    humidity_percent:       "",
    temperature_value:      "",
    temperature_unit:       "F",
    gpp_value:              "",
    dew_point_value:        "",
    notes:                  "",
    reading_type:           "monitoring",
    location_detail:        "",
    meter_type:             "",
    reading_method:         "pin",
    is_dry_standard:        false,
  });
  const [saving, setSaving]     = useState(false);
  const [savedId, setSavedId]   = useState(null); // for photo attachment after save
  const [showPhotos, setShowPhotos] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calc GPP + dew point
  const autoGpp = calcGPP(
    form.humidity_percent ? parseFloat(form.humidity_percent) : null,
    form.temperature_value ? parseFloat(form.temperature_value) : null
  );
  const autoDp = calcDewPoint(
    form.humidity_percent ? parseFloat(form.humidity_percent) : null,
    form.temperature_value ? parseFloat(form.temperature_value) : null
  );

  const displayGpp = form.gpp_value || (autoGpp != null ? String(autoGpp) : "");
  const displayDp  = form.dew_point_value || (autoDp != null ? String(autoDp) : "");

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        organization_id:       orgId,
        project_id:            projectId,
        room_id:               room.id,
        entered_by_user_id:    userId || null,
        reading_at:            form.reading_at
          ? new Date(form.reading_at).toISOString()
          : new Date().toISOString(),
        material_label:        form.material_label         || null,
        material_moisture_value: form.material_moisture_value ? parseFloat(form.material_moisture_value) : null,
        humidity_percent:      form.humidity_percent        ? parseFloat(form.humidity_percent) : null,
        temperature_value:     form.temperature_value       ? parseFloat(form.temperature_value) : null,
        temperature_unit:      form.temperature_unit,
        gpp_value:             displayGpp ? parseFloat(displayGpp) : null,
        dew_point_value:       displayDp  ? parseFloat(displayDp)  : null,
        notes:                 form.notes                  || null,
        reading_type:          form.reading_type,
        location_detail:       form.location_detail        || null,
        meter_type:            form.meter_type             || null,
        reading_method:        form.reading_method         || null,
        is_dry_standard:       form.is_dry_standard,
      };

      const { data, error } = await supabase
        .from("room_moisture_readings")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      setSavedId(data.id);
      setShowPhotos(true);
      onSave(data);
    } catch (e) {
      alert("Error saving reading: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = {
    width: "100%", background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text,#fff)",
    boxSizing: "border-box", outline: "none",
  };
  const lbl = { fontSize: 11.5, fontWeight: 700, color: "var(--text3,#888)", marginBottom: 4, display: "block" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 16px", overflowY: "auto",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface,#111)", border: "1px solid var(--border,#333)", borderRadius: 14,
        width: "100%", maxWidth: 520, padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,.5)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Add Moisture Reading</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3,#888)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {showPhotos ? (
          /* Photo attachment phase */
          <div>
            <div style={{ fontSize: 13, color: "var(--text2,#ccc)", marginBottom: 14 }}>
              ✅ Reading saved. Optionally attach photos to this reading.
            </div>
            <PhotoUploader
              orgId={orgId} projectId={projectId} roomId={room.id} readingId={savedId}
              onUploaded={() => setPhotoCount(c => c + 1)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Btn variant="ghost" onClick={onClose}>Skip</Btn>
              <Btn variant="primary" onClick={onClose}>
                Done {photoCount > 0 ? `(${photoCount} photo${photoCount !== 1 ? "s" : ""})` : ""}
              </Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Reading type */}
            <div>
              <label style={lbl}>Reading Type</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {READING_TYPES.map(t => (
                  <button key={t.value} onClick={() => set("reading_type", t.value)} style={{
                    padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    border: `1px solid ${form.reading_type === t.value ? t.color : "var(--border,#333)"}`,
                    background: form.reading_type === t.value ? t.bg : "transparent",
                    color: form.reading_type === t.value ? t.color : "var(--text3,#888)",
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Date/time + material */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Date &amp; Time</label>
                <input type="datetime-local" style={inp} value={form.reading_at}
                  onChange={e => set("reading_at", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Material / Area</label>
                <input list="moisture-materials" style={inp}
                  placeholder="e.g. Drywall, Subfloor"
                  value={form.material_label}
                  onChange={e => set("material_label", e.target.value)} />
                <datalist id="moisture-materials">
                  {MATERIAL_PRESETS.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>

            {/* Location detail */}
            <div>
              <label style={lbl}>Exact Location <span style={{ fontWeight: 400, color: "#666" }}>(optional)</span></label>
              <input style={inp} placeholder='e.g. "North wall under window, 6 inches above floor"'
                value={form.location_detail}
                onChange={e => set("location_detail", e.target.value)} />
            </div>

            {/* Moisture + RH + Temp */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Mat. Moisture %</label>
                <input type="number" step="0.1" style={inp} placeholder="e.g. 18.5"
                  value={form.material_moisture_value}
                  onChange={e => set("material_moisture_value", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Humidity %</label>
                <input type="number" step="0.1" min="0" max="100" style={inp} placeholder="e.g. 65"
                  value={form.humidity_percent}
                  onChange={e => set("humidity_percent", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Temp °F</label>
                <input type="number" step="0.1" style={inp} placeholder="e.g. 72"
                  value={form.temperature_value}
                  onChange={e => set("temperature_value", e.target.value)} />
              </div>
            </div>

            {/* Auto-calculated GPP / Dew Point */}
            {(autoGpp != null || autoDp != null) && (
              <div style={{ display: "flex", gap: 12, padding: "9px 12px",
                background: "var(--surface2,#2a2a2a)", borderRadius: 8, border: "1px solid var(--border,#333)", fontSize: 12.5 }}>
                {autoGpp != null && <span>GPP: <strong style={{ color: "#a78bfa" }}>{autoGpp}</strong></span>}
                {autoDp  != null && <span>Dew Point: <strong style={{ color: "#06b6d4" }}>{autoDp}°F</strong></span>}
                <span style={{ color: "var(--text3,#888)", fontSize: 11 }}>auto-calculated</span>
              </div>
            )}

            {/* Meter / method */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>Meter Type <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input style={inp} placeholder="e.g. Delmhorst BD-10"
                  value={form.meter_type}
                  onChange={e => set("meter_type", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Reading Method</label>
                <select style={inp} value={form.reading_method} onChange={e => set("reading_method", e.target.value)}>
                  {READING_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Dry standard toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.is_dry_standard}
                onChange={e => set("is_dry_standard", e.target.checked)}
                style={{ width: 15, height: 15 }} />
              <span style={{ color: "var(--text2,#ccc)" }}>
                Mark as dry standard (baseline reference for comparison)
              </span>
            </label>

            {/* Notes */}
            <div>
              <label style={lbl}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }}
                placeholder="Observations, equipment state, conditions…"
                value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text3,#888)" }}>Photos can be added after saving</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn variant="primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save Reading →"}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reading Row (expandable) ──────────────────────────────────────────────────
function ReadingRow({ reading, orgId, userId, teamUsers = [], onUpdated }) {
  const [expanded, setExpanded]     = useState(false);
  const [photos, setPhotos]         = useState(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [auditLog, setAuditLog]     = useState(null);
  const [editing, setEditing]       = useState(false);
  const [editForm, setEditForm]     = useState({});
  const [saving, setSaving]         = useState(false);
  const [showAddPhoto, setShowAddPhoto] = useState(false);

  const loadPhotos = useCallback(async () => {
    if (photos !== null) return;
    setLoadingPhotos(true);
    const { data } = await supabase
      .from("moisture_reading_photos")
      .select("*")
      .eq("reading_id", reading.id)
      .order("created_at", { ascending: true });
    setPhotos(data || []);
    setLoadingPhotos(false);
  }, [reading.id, photos]);

  const loadAuditLog = useCallback(async () => {
    if (auditLog !== null) return;
    const { data } = await supabase
      .from("moisture_reading_audit_log")
      .select("*")
      .eq("reading_id", reading.id)
      .order("created_at", { ascending: false });
    setAuditLog(data || []);
  }, [reading.id, auditLog]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) { loadPhotos(); loadAuditLog(); }
  };

  const startEdit = () => {
    setEditForm({
      material_moisture_value: reading.material_moisture_value ?? "",
      humidity_percent: reading.humidity_percent ?? "",
      temperature_value: reading.temperature_value ?? "",
      notes: reading.notes ?? "",
      location_detail: reading.location_detail ?? "",
      reading_type: reading.reading_type ?? "monitoring",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const changes = [];
      const fields = ["material_moisture_value", "humidity_percent", "temperature_value",
        "notes", "location_detail", "reading_type"];
      const updates = {};

      fields.forEach(f => {
        const newVal = editForm[f] === "" ? null : editForm[f];
        const oldVal = reading[f] ?? null;
        const newValN = typeof newVal === "string" && ["material_moisture_value","humidity_percent","temperature_value"].includes(f)
          ? (newVal === null ? null : parseFloat(newVal))
          : newVal;
        if (String(oldVal) !== String(newValN)) {
          changes.push({ field_name: f, old_value: String(oldVal), new_value: String(newValN) });
          updates[f] = newValN;
        }
      });

      if (Object.keys(updates).length === 0) { setEditing(false); setSaving(false); return; }

      // Recalculate GPP / dew point if relevant fields changed
      const newHum  = updates.humidity_percent  ?? reading.humidity_percent;
      const newTemp = updates.temperature_value ?? reading.temperature_value;
      updates.gpp_value      = calcGPP(newHum, newTemp);
      updates.dew_point_value = calcDewPoint(newHum, newTemp);
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from("room_moisture_readings").update(updates).eq("id", reading.id);
      if (error) throw error;

      // Write audit log entries
      if (changes.length > 0) {
        await supabase.from("moisture_reading_audit_log").insert(
          changes.map(c => ({
            organization_id: reading.organization_id,
            reading_id: reading.id,
            ...c,
            changed_by_user_id: userId || null,
          }))
        );
        setAuditLog(null); // force reload
      }

      onUpdated?.({ ...reading, ...updates });
      setEditing(false);
    } catch (e) { alert("Error saving: " + e.message); }
    finally { setSaving(false); }
  };

  const t = READING_TYPE_MAP[reading.reading_type] || READING_TYPE_MAP.monitoring;
  const inp = {
    background: "var(--surface,#111)", border: "1px solid var(--border,#333)",
    borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "var(--text,#fff)", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${reading.is_dry_standard ? "#f59e0b50" : "var(--border,#333)"}`,
      overflow: "hidden", marginBottom: 8,
      background: reading.is_dry_standard ? "#f59e0b08" : "var(--surface2,#1a1a1a)",
    }}>
      {/* Main row */}
      <div
        onClick={handleExpand}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <TypeBadge type={reading.reading_type || "monitoring"} />
          {reading.is_dry_standard && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 8, marginLeft: 4,
              background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>⭐ Dry Std</span>
          )}
        </div>
        <div style={{ flex: "0 0 140px", fontSize: 12, color: "var(--text2,#aaa)" }}>{fmtTime(reading.reading_at)}</div>
        <div style={{ flex: "0 0 110px", fontSize: 13, fontWeight: 600 }}>{reading.material_label || <span style={{ color: "var(--text3,#888)" }}>—</span>}</div>
        <div style={{ flex: "0 0 70px", fontSize: 14, fontWeight: 800, color: "var(--text,#fff)" }}>
          {reading.material_moisture_value != null ? reading.material_moisture_value + "%" : "—"}
        </div>
        <div style={{ flex: "0 0 60px", fontSize: 12, color: "#3ab8e8" }}>
          {reading.humidity_percent != null ? reading.humidity_percent + "%" : "—"}
        </div>
        <div style={{ flex: "0 0 60px", fontSize: 12, color: "#f59e0b" }}>
          {reading.temperature_value != null ? reading.temperature_value + "°" + (reading.temperature_unit || "F") : "—"}
        </div>
        <div style={{ flex: 1, fontSize: 12, color: "var(--text3,#888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {reading.location_detail || reading.notes || ""}
        </div>
        <div style={{ fontSize: 16, color: "var(--text3,#888)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border,#333)", padding: "12px 14px" }}>
          {editing ? (
            /* Edit form */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3,#888)", marginBottom: 3 }}>Mat. Moisture %</div>
                  <input type="number" step="0.1" style={inp} value={editForm.material_moisture_value}
                    onChange={e => setEditForm(f => ({ ...f, material_moisture_value: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3,#888)", marginBottom: 3 }}>Humidity %</div>
                  <input type="number" step="0.1" style={inp} value={editForm.humidity_percent}
                    onChange={e => setEditForm(f => ({ ...f, humidity_percent: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3,#888)", marginBottom: 3 }}>Temp °F</div>
                  <input type="number" step="0.1" style={inp} value={editForm.temperature_value}
                    onChange={e => setEditForm(f => ({ ...f, temperature_value: e.target.value }))} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3,#888)", marginBottom: 3 }}>Location Detail</div>
                <input style={inp} value={editForm.location_detail}
                  onChange={e => setEditForm(f => ({ ...f, location_detail: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text3,#888)", marginBottom: 3 }}>Notes</div>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 52 }} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" variant="primary" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
              </div>
            </div>
          ) : (
            /* Detail view */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
              {[
                ["GPP",          reading.gpp_value        != null ? reading.gpp_value       : "—"],
                ["Dew Point",    reading.dew_point_value  != null ? reading.dew_point_value + "°F" : "—"],
                ["Method",       reading.reading_method   || "—"],
                ["Meter",        reading.meter_type       || "—"],
                ["Location",     reading.location_detail  || "—"],
                ["Notes",        reading.notes            || "—"],
                ["Entered By",   reading.entered_by_user_id ? "User ID:" + reading.entered_by_user_id.slice(0,8) : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--text3,#888)", fontWeight: 600 }}>{k}: </span>
                  <span style={{ color: "var(--text2,#ccc)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Photos section */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3,#888)", textTransform: "uppercase" }}>
                Photos {photos && photos.length > 0 ? `(${photos.length})` : ""}
              </div>
              <Btn size="sm" variant="secondary" onClick={() => setShowAddPhoto(!showAddPhoto)}>
                📷 Add Photos
              </Btn>
            </div>

            {showAddPhoto && (
              <div style={{ marginBottom: 10 }}>
                <PhotoUploader
                  orgId={reading.organization_id} projectId={reading.project_id}
                  roomId={reading.room_id} readingId={reading.id}
                  onUploaded={p => setPhotos(prev => [...(prev || []), p])}
                />
              </div>
            )}

            {loadingPhotos && <div style={{ fontSize: 12, color: "var(--text3,#888)" }}>Loading photos…</div>}
            {photos && photos.length === 0 && !showAddPhoto && (
              <div style={{ fontSize: 12, color: "var(--text3,#888)" }}>No photos attached.</div>
            )}
            {photos && photos.length > 0 && (
              /* Group by type */
              Object.entries(
                photos.reduce((acc, p) => {
                  const k = p.photo_type || "other";
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(p);
                  return acc;
                }, {})
              ).map(([type, typePhotos]) => {
                const pt = PHOTO_TYPE_MAP[type] || PHOTO_TYPE_MAP.other;
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--text3,#888)", fontWeight: 600, marginBottom: 5 }}>
                      {pt.icon} {pt.label}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {typePhotos.map(p => (
                        <div key={p.id} style={{ position: "relative" }}>
                          <a href={p.photo_url} target="_blank" rel="noreferrer">
                            <img src={p.photo_url} alt={p.caption || type}
                              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 7,
                                border: "1px solid var(--border,#333)", cursor: "pointer" }} />
                          </a>
                          {p.caption && (
                            <div style={{ fontSize: 10, color: "var(--text3,#888)", marginTop: 2,
                              maxWidth: 80, textAlign: "center", overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Audit log */}
          {auditLog && auditLog.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: "var(--text3,#888)", cursor: "pointer" }}>
                🔒 Edit History ({auditLog.length} change{auditLog.length !== 1 ? "s" : ""})
              </summary>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {auditLog.map(entry => (
                  <div key={entry.id} style={{ fontSize: 11, color: "var(--text3,#888)", padding: "4px 8px",
                    background: "var(--surface,#111)", borderRadius: 5, borderLeft: "2px solid var(--border,#333)" }}>
                    <span style={{ color: "var(--text2,#ccc)", fontWeight: 600 }}>{entry.field_name}</span>
                    {": "}<span style={{ textDecoration: "line-through" }}>{entry.old_value}</span>
                    {" → "}<span style={{ color: "var(--text,#fff)" }}>{entry.new_value}</span>
                    {" · "}{fmtTime(entry.created_at)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Action buttons */}
          {!editing && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <Btn size="sm" variant="secondary" onClick={startEdit}>✏️ Edit</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stall detection logic ─────────────────────────────────────────────────────
function detectStall(readings) {
  const moist = [...readings]
    .filter(r => r.material_moisture_value != null)
    .sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at));
  if (moist.length < 3) return null;
  const last3 = moist.slice(-3);
  const diffs = last3.slice(1).map((r, i) => r.material_moisture_value - last3[i].material_moisture_value);
  const allNonDecreasing = diffs.every(d => d >= 0);
  const allFlat = diffs.every(d => Math.abs(d) < 0.5);
  if (allFlat && moist.length >= 3)   return "stalled";
  if (allNonDecreasing && moist.length >= 4) return "stalled";
  const increasing = diffs.filter(d => d > 0.5).length;
  if (increasing >= 1) return "needs_review";
  return null;
}

// ── Main: RoomMoistureTab ─────────────────────────────────────────────────────
export function RoomMoistureTab({ room, orgId, projectId, userId, teamUsers = [] }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [filterType, setFilterType] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("room_moisture_readings")
      .select("*")
      .eq("room_id", room.id)
      .order("reading_at", { ascending: false })
      .limit(200);
    setReadings(data || []);
    setLoading(false);
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  const stalledFlag = useMemo(() => detectStall(readings), [readings]);

  const filteredReadings = useMemo(() => {
    if (filterType === "all") return readings;
    return readings.filter(r => (r.reading_type || "monitoring") === filterType);
  }, [readings, filterType]);

  const handleSaved = (row) => {
    setReadings(prev => [row, ...prev]);
  };

  const handleUpdated = (updated) => {
    setReadings(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
  };

  return (
    <div>
      {/* Stalled alert */}
      <StalledBanner flag={stalledFlag} />

      {/* Summary cards */}
      <SummaryCards readings={readings} />

      {/* Auto summary */}
      <AutoSummary readings={readings} />

      {/* Drying Graph */}
      <div style={{
        background: "var(--surface2,#1a1a1a)", borderRadius: 12, padding: "14px 16px",
        border: "1px solid var(--border,#333)", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>📊 Drying Progress</div>
          <Btn size="sm" variant="ghost" onClick={() => setShowGraph(!showGraph)}>
            {showGraph ? "Hide" : "Show"} Graph
          </Btn>
        </div>
        {showGraph && <DryingGraph readings={[...readings].sort((a, b) => new Date(a.reading_at) - new Date(b.reading_at))} />}
      </div>

      {/* Environmental Summary */}
      <EnvironmentalSummary readings={readings} />

      {/* Equipment snapshot */}
      <EquipmentSnapshot roomId={room.id} projectId={projectId} orgId={orgId} />

      {/* Reading History header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            💧 Reading History
            {readings.length > 0 && <span style={{ fontWeight: 400, color: "var(--text3,#888)", fontSize: 12, marginLeft: 6 }}>({readings.length})</span>}
          </div>
          {/* Type filter */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setFilterType("all")} style={{
              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${filterType === "all" ? "var(--accent,#2563eb)" : "var(--border,#333)"}`,
              background: filterType === "all" ? "rgba(37,99,235,.15)" : "transparent",
              color: filterType === "all" ? "var(--accent,#2563eb)" : "var(--text3,#888)",
            }}>All</button>
            {READING_TYPES.map(t => (
              <button key={t.value} onClick={() => setFilterType(filterType === t.value ? "all" : t.value)} style={{
                padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${filterType === t.value ? t.color : "var(--border,#333)"}`,
                background: filterType === t.value ? t.bg : "transparent",
                color: filterType === t.value ? t.color : "var(--text3,#888)",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          + Add Reading
        </Btn>
      </div>

      {/* Column headers */}
      {filteredReadings.length > 0 && (
        <div style={{ display: "flex", gap: 10, padding: "0 14px 6px",
          fontSize: 10.5, fontWeight: 700, color: "var(--text3,#888)", textTransform: "uppercase", letterSpacing: ".4px" }}>
          <div style={{ flex: "0 0 auto", minWidth: 90 }}>Type</div>
          <div style={{ flex: "0 0 140px" }}>Date/Time</div>
          <div style={{ flex: "0 0 110px" }}>Material</div>
          <div style={{ flex: "0 0 70px" }}>Moisture</div>
          <div style={{ flex: "0 0 60px" }}>RH</div>
          <div style={{ flex: "0 0 60px" }}>Temp</div>
          <div style={{ flex: 1 }}>Location / Notes</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3,#888)", fontSize: 13 }}>Loading…</div>
      ) : filteredReadings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text3,#888)", fontSize: 13 }}>
          {readings.length === 0 ? "No moisture readings yet. Add the first one above." : "No readings match the selected filter."}
        </div>
      ) : (
        <div>
          {filteredReadings.map(r => (
            <ReadingRow
              key={r.id}
              reading={r}
              orgId={orgId}
              userId={userId}
              teamUsers={teamUsers}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      {/* Add Reading Modal */}
      {showAdd && (
        <MoistureAddModal
          room={room}
          orgId={orgId}
          projectId={projectId}
          userId={userId}
          teamUsers={teamUsers}
          onClose={() => setShowAdd(false)}
          onSave={(row) => { handleSaved(row); }}
        />
      )}
    </div>
  );
}
