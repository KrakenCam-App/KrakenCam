/**
 * src/components/RoomsTab.jsx
 *
 * Full Rooms workspace — lazy loaded.
 * All phases: status/progress, tasks, labels, notes, activity,
 * equipment assignments, moisture readings, AI summary, photo assignment,
 * search/filters, room templates, report-editor data hooks.
 *
 * Props:
 *   project            — full project object (project.rooms JSONB, project.photos JSONB, etc.)
 *   orgId              — organization UUID
 *   userId             — current user UUID
 *   settings           — org/user settings (plan, role, Kraken balance, etc.)
 *   onSettingsChange   — Kraken deduction callback
 *   tasks              — global tasks array (all org tasks)
 *   onTasksChange      — tasks update callback (mirrors TasksPage pattern)
 *   teamUsers          — team member array
 *   onUpdateProject    — (updatedProject) => void  — persists project JSONB changes
 *   onOpenCamera       — (room) => void  — opens CameraPage scoped to room
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from "react";
import { supabase } from "../lib/supabase.js";
import {
  checkAiPermission, deductKrakens, logAiEvent, KRAKEN_COSTS
} from "../lib/krakenUsage.js";
import { AiBlockedModal } from "./KrakenUsageBar.jsx";
import { QrScannerModal } from "./QrScannerModal.jsx";
import { QrActionModal } from "./QrActionModal.jsx";
import { removeAssignment, moveEquipmentToRoom, markInTransit, logMovement, MOVE_ACTION } from "../lib/equipmentMovement.js";
import { RoomMoistureTab } from "./MoistureTab.jsx";
import { saveNotification } from "../lib/notifications.js";

// ── tiny uuid ─────────────────────────────────────────────────────────────────
const uid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

// ── SVG icon helper ───────────────────────────────────────────────────────────
function Ico({ d, size = 16, stroke = "currentColor", fill = "none", sw = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  );
}

// ── Icon paths ────────────────────────────────────────────────────────────────
const I = {
  door:       "M3 9v12h18V9M3 21V3h18v6M9 21v-6h6v6",
  check:      "M9 12l2 2 4-4",
  plus:       "M12 5v14M5 12h14",
  search:     "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  filter:     "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  chevronR:   "M9 18l6-6-6-6",
  chevronD:   "M6 9l6 6 6-6",
  chevronL:   "M15 18l-6-6 6-6",
  close:      "M18 6L6 18M6 6l12 12",
  camera:     "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  task:       "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  note:       "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  moisture:   "M12 2.69l5.66 5.66a8 8 0 11-11.31 0z",
  equipment:  "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  activity:   "M22 12h-4l-3 9L9 3l-3 9H2",
  sparkle:    "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  tag:        "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
  warning:    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  photo:      "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z",
  trash:      "M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
  edit:       "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z",
  lock:       ["M12 17v-2m0 0a2 2 0 100-4 2 2 0 000 4z","M8 11V7a4 4 0 118 0v4","M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z"],
  zap:        "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  template:   "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  drag:       "M9 5h2M9 12h2M9 19h2M13 5h2M13 12h2M13 19h2",
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  not_started:  { label: "Not Started",  color: "#6b7280", bg: "#6b728018" },
  in_progress:  { label: "In Progress",  color: "#3ab8e8", bg: "#3ab8e818" },
  needs_review: { label: "Needs Review", color: "#e8c53a", bg: "#e8c53a18" },
  completed:    { label: "Completed",    color: "#3dba7e", bg: "#3dba7e18" },
};

const STATUS_ORDER = ["not_started","in_progress","needs_review","completed"];

// ── GPP / Dew-point formulas ──────────────────────────────────────────────────
function calcGPP(humidity, tempF) {
  if (humidity == null || tempF == null) return null;
  const tempC = (tempF - 32) * 5 / 9;
  const es = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  const ea = (humidity / 100) * es;
  const absHum = (ea * 18.016) / (8.314 * (tempC + 273.15));
  return Math.round(absHum * 7000 * 100) / 100; // grains per pound
}
function calcDewPoint(humidity, tempF) {
  if (humidity == null || tempF == null) return null;
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27, b = 237.7;
  const gamma = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  const dpC = (b * gamma) / (a - gamma);
  return Math.round(((dpC * 9) / 5 + 32) * 10) / 10; // back to °F
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// ── Small UI atoms ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.not_started;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
      background: c.bg, color: c.color, border: `1px solid ${c.color}40`, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}
function ProgressBar({ pct, color }) {
  const c = color || (pct >= 100 ? "#3dba7e" : pct >= 60 ? "#3ab8e8" : pct >= 30 ? "#8b7cf8" : "#6b7280");
  return (
    <div style={{ height: 4, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct || 0)}%`, background: c,
        borderRadius: 3, transition: "width .4s", minWidth: pct > 0 ? 4 : 0 }} />
    </div>
  );
}
function LabelChip({ label, onRemove }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
      fontWeight: 600, padding: "2px 7px", borderRadius: 10,
      background: `${label.color || "#6b7280"}18`, color: label.color || "#6b7280",
      border: `1px solid ${label.color || "#6b7280"}40` }}>
      {label.name}
      {onRemove && (
        <span onClick={onRemove} style={{ cursor: "pointer", lineHeight: 1, fontSize: 12, opacity: .7 }}>×</span>
      )}
    </span>
  );
}
function Btn({ children, onClick, variant = "default", size = "md", disabled, style: sx }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, transition: "all .15s", outline: "none", opacity: disabled ? .5 : 1,
    fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "5px 10px" : "8px 14px",
    background: variant === "primary" ? "var(--accent,#2b7fe8)"
      : variant === "ghost" ? "transparent"
      : variant === "danger" ? "#e85a3a18"
      : "var(--surface2)",
    color: variant === "primary" ? "white"
      : variant === "danger" ? "#e85a3a"
      : "var(--text)",
    border: variant === "ghost" ? "1px solid var(--border)" : "none",
    ...sx,
  };
  return <button style={base} onClick={disabled ? undefined : onClick} disabled={disabled}>{children}</button>;
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 8000, display: "flex",
      alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.5)",
      padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--bg)", borderRadius: 14, width: "100%", maxWidth: width,
        maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
            color: "var(--text3)", padding: 4 }}>
            <Ico d={I.close} size={16} />
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHdr({ icon, title, count, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Ico d={icon} size={14} stroke="var(--text3)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)",
          textTransform: "uppercase", letterSpacing: .5 }}>{title}</span>
        {count != null && count > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px",
            borderRadius: 6, background: "var(--surface3)", color: "var(--text3)" }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOISTURE ADD MODAL — replaced by MoistureTab.jsx → RoomMoistureTab
// ═══════════════════════════════════════════════════════════════════════════════
function MoistureAddModal_UNUSED({ room, orgId, projectId, userId, onSave, onClose }) {
  const [form, setForm] = useState({
    material_label: "", material_moisture_value: "",
    humidity_percent: "", temperature_value: "", temperature_unit: "F", notes: "",
    reading_at: new Date().toISOString().slice(0, 16),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const gpp = calcGPP(
    form.humidity_percent ? parseFloat(form.humidity_percent) : null,
    form.temperature_value ? parseFloat(form.temperature_value) : null
  );
  const dp = calcDewPoint(
    form.humidity_percent ? parseFloat(form.humidity_percent) : null,
    form.temperature_value ? parseFloat(form.temperature_value) : null
  );

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId, project_id: projectId, room_id: room.id,
        entered_by_user_id: userId || null,
        reading_at: form.reading_at ? new Date(form.reading_at).toISOString() : new Date().toISOString(),
        material_label: form.material_label || null,
        material_moisture_value: form.material_moisture_value ? parseFloat(form.material_moisture_value) : null,
        humidity_percent: form.humidity_percent ? parseFloat(form.humidity_percent) : null,
        temperature_value: form.temperature_value ? parseFloat(form.temperature_value) : null,
        temperature_unit: form.temperature_unit,
        gpp_value: gpp, dew_point_value: dp,
        notes: form.notes || null,
      };
      const { data, error } = await supabase.from("room_moisture_readings").insert([payload]).select().single();
      if (error) throw error;
      onSave(data);
    } catch (e) { alert("Error saving reading: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)",
    boxSizing: "border-box", outline: "none" };

  return (
    <Modal title="Add Moisture Reading" onClose={onClose} width={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Date &amp; Time</div>
            <input type="datetime-local" style={inp} value={form.reading_at}
              onChange={e => set("reading_at", e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Material / Area</div>
            <input style={inp} placeholder="e.g. Drywall, Subfloor" value={form.material_label}
              onChange={e => set("material_label", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Mat. Moisture %</div>
            <input type="number" step="0.1" style={inp} placeholder="e.g. 18.5" value={form.material_moisture_value}
              onChange={e => set("material_moisture_value", e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Humidity %</div>
            <input type="number" step="0.1" min="0" max="100" style={inp} placeholder="e.g. 65" value={form.humidity_percent}
              onChange={e => set("humidity_percent", e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Temp °F</div>
            <input type="number" step="0.1" style={inp} placeholder="e.g. 72" value={form.temperature_value}
              onChange={e => set("temperature_value", e.target.value)} />
          </div>
        </div>
        {(gpp != null || dp != null) && (
          <div style={{ display: "flex", gap: 12, padding: "10px 12px", background: "var(--surface2)",
            borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5 }}>
            {gpp != null && <span style={{ color: "var(--text2)" }}>GPP: <strong style={{ color: "var(--text)" }}>{gpp}</strong></span>}
            {dp  != null && <span style={{ color: "var(--text2)" }}>Dew Point: <strong style={{ color: "var(--text)" }}>{dp}°F</strong></span>}
            <span style={{ color: "var(--text3)", fontSize: 11 }}>(auto-calculated)</span>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Notes</div>
          <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Optional notes…"
            value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Reading"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT ASSIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EquipmentAssignModal({ room, orgId, projectId, userId, onSave, onClose }) {
  const [equipment, setEquipment] = useState([]);
  const [selected, setSelected]   = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase
      .from("equipment")
      .select("id, name, unique_code, manufacturer, model, status")
      .eq("organization_id", orgId)
      .in("status", ["available", "deployed", "scheduled"])
      .order("name")
      .then(({ data }) => { setEquipment(data || []); setLoading(false); });
  }, [orgId]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const eq = equipment.find(e => e.id === selected);
      const { data, error } = await supabase.from("room_equipment_assignments").insert([{
        organization_id: orgId, project_id: projectId, room_id: room.id,
        equipment_id: selected, placed_by_user_id: userId || null,
        notes: notes || null,
      }]).select(`*, equipment(id,name,unique_code,manufacturer,model,status,condition)`).single();
      if (error) throw error;
      onSave(data);
    } catch (e) { alert("Error assigning equipment: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)",
    boxSizing: "border-box", outline: "none" };

  return (
    <Modal title="Assign Equipment to Room" onClose={onClose} width={420}>
      {loading ? <div style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>Loading…</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Select Equipment</div>
            <select style={{ ...inp }} value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— choose equipment —</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} {eq.unique_code ? `(${eq.unique_code})` : ""} — {eq.manufacturer || ""} {eq.model || ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Notes (optional)</div>
            <input style={inp} placeholder="Placement notes…" value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving || !selected}>
              {saving ? "Assigning…" : "Assign to Room"}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK ADD MODAL (room-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
function RoomTaskModal({ room, projectId, orgId, userId, teamUsers, onSave, onClose, settings, projectName, initialValues }) {
  const [form, setForm] = useState({
    title: initialValues?.title || "", description: initialValues?.description || "",
    priority: initialValues?.priority || "medium", dueDate: "", dueTime: "",
    assigneeId: "", saveAsTemplate: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const taskId = uid();
      const newTask = {
        id: taskId,
        organization_id: orgId,
        project_id: projectId,
        room_id: room.id,
        title: form.title.trim(),
        description: form.description || "",
        priority: form.priority,
        status: "todo",
        completed: false,
        due_date: form.dueDate || null,
        due_time: form.dueTime || null,
        assignee_ids: form.assigneeId ? [form.assigneeId] : [],
        created_by_user_id: userId || null,
      };
      const { error } = await supabase.from("tasks").insert([newTask]);
      if (error) throw error;

      // Send notification to assigned user
      if (form.assigneeId) {
        try {
          const assignerName = settings?.userFirstName
            ? `${settings.userFirstName} ${settings.userLastName || ""}`.trim()
            : "Someone";
          await saveNotification(orgId, {
            type: "task_assigned",
            title: "New Task Assigned",
            body: `${assignerName} assigned you a task: "${form.title.trim()}"`,
            recipientUserIds: [form.assigneeId],
            context: JSON.stringify({ taskId, roomName: room.name, projectName: projectName || "" }),
            action: "rooms",
            author: assignerName,
          });
        } catch (_) { /* notification failure shouldn't block task creation */ }
      }

      // Save as template if checked
      if (form.saveAsTemplate) {
        try {
          await supabase.from("room_task_templates").insert([{
            organization_id: orgId,
            name: form.title.trim(),
            description: form.description || "",
            priority: form.priority,
            created_by: userId,
          }]);
        } catch (_) { /* template save failure shouldn't block */ }
      }

      onSave({ ...newTask, roomId: room.id, projectId, dueDate: form.dueDate || "", dueTime: form.dueTime || "", assigneeIds: newTask.assignee_ids });
    } catch (e) { alert("Error creating task: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)",
    boxSizing: "border-box", outline: "none" };

  return (
    <Modal title={`Add Task — ${room.name}`} onClose={onClose} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Task Title *</div>
          <input style={inp} placeholder="What needs to be done?" value={form.title}
            onChange={e => set("title", e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()} autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Priority</div>
            <select style={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
              {["critical","high","medium","low"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Due Date</div>
            <input type="date" style={inp} value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Due Time</div>
            <input type="time" style={inp} value={form.dueTime} onChange={e => set("dueTime", e.target.value)} />
          </div>
          <div />
        </div>
        {teamUsers && teamUsers.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Assign To</div>
            <select style={inp} value={form.assigneeId} onChange={e => set("assigneeId", e.target.value)}>
              <option value="">— unassigned —</option>
              {teamUsers.filter(u => u.status === "active").map(u => (
                <option key={u.userId || u.id} value={u.userId || u.id}>
                  {u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Description</div>
          <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Optional notes…"
            value={form.description} onChange={e => set("description", e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text2)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.saveAsTemplate} onChange={e => set("saveAsTemplate", e.target.checked)} />
          Save as task template
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? "Saving…" : "Create Task"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL MANAGER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const LABEL_COLORS = ["#3ab8e8","#3dba7e","#8b7cf8","#e8c53a","#e8703a","#e85a3a","#f0954e","#6b7280","#4a90d9","#e8508a"];

function LabelManagerModal({ orgId, onClose, onLabelsChange, currentLabels }) {
  const [labels, setLabels]   = useState([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("room_labels").select("*").eq("organization_id", orgId)
      .eq("is_archived", false).order("name")
      .then(({ data }) => { setLabels(data || []); setLoading(false); });
  }, [orgId]);

  const addLabel = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("room_labels").insert([{
        organization_id: orgId, name: newName.trim(), color: newColor,
      }]).select().single();
      if (error) throw error;
      const updated = [...labels, data];
      setLabels(updated);
      onLabelsChange && onLabelsChange(updated);
      setNewName(""); setNewColor(LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const archiveLabel = async (id) => {
    await supabase.from("room_labels").update({ is_archived: true }).eq("id", id);
    const updated = labels.filter(l => l.id !== id);
    setLabels(updated);
    onLabelsChange && onLabelsChange(updated);
  };

  const inp = { background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)", outline: "none" };

  return (
    <Modal title="Manage Room Labels" onClose={onClose} width={400}>
      {loading ? <div style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>Loading…</div> : (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, minHeight: 32 }}>
            {labels.length === 0
              ? <div style={{ fontSize: 13, color: "var(--text3)" }}>No labels yet. Add one below.</div>
              : labels.map(l => (
                <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
                  background: `${l.color || "#888"}18`, color: l.color || "#888",
                  border: `1px solid ${l.color || "#888"}40` }}>
                  {l.name}
                  <span onClick={() => archiveLabel(l.id)}
                    style={{ cursor: "pointer", opacity: .6, fontSize: 13 }}>×</span>
                </span>
              ))
            }
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...inp, flex: 1 }} placeholder="New label name…" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addLabel()} />
            <div style={{ display: "flex", gap: 4 }}>
              {LABEL_COLORS.map(c => (
                <div key={c} onClick={() => setNewColor(c)}
                  style={{ width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer",
                    border: newColor === c ? "2px solid white" : "2px solid transparent",
                    boxShadow: newColor === c ? "0 0 0 1px " + c : "none" }} />
              ))}
            </div>
            <Btn variant="primary" size="sm" onClick={addLabel} disabled={saving || !newName.trim()}>Add</Btn>
          </div>
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Btn variant="ghost" onClick={onClose}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHOTO ASSIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function PhotoAssignModal({ photos, rooms, targetRoom, onAssign, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const unassigned = photos.filter(p => !p.room || p.room === targetRoom.name);

  const toggle = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <Modal title={`Assign Photos → ${targetRoom.name}`} onClose={onClose} width={520}>
      <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text2)" }}>
        Select photos to assign to this room. Currently showing unassigned + this room's photos.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 8,
        maxHeight: 320, overflowY: "auto", marginBottom: 16 }}>
        {photos.map(p => {
          const isSel = selected.has(p.id);
          return (
            <div key={p.id} onClick={() => toggle(p.id)}
              style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden",
                cursor: "pointer", border: isSel ? "2px solid var(--accent,#2b7fe8)" : "2px solid transparent",
                background: "var(--surface2)" }}>
              {p.dataUrl && <img src={p.dataUrl} alt={p.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {isSel && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(43,127,232,.35)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ico d={I.check} size={22} stroke="white" sw={3} />
                </div>
              )}
              {p.room && p.room !== targetRoom.name && (
                <div style={{ position: "absolute", bottom: 2, left: 2, right: 2, fontSize: 9,
                  background: "rgba(0,0,0,.6)", color: "white", borderRadius: 4,
                  padding: "1px 4px", textAlign: "center", overflow: "hidden",
                  whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {p.room}
                </div>
              )}
            </div>
          );
        })}
        {photos.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text3)",
            padding: 32, fontSize: 13 }}>No photos to assign</div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--text3)" }}>
          {selected.size} photo{selected.size !== 1 ? "s" : ""} selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={selected.size === 0}
            onClick={() => { onAssign([...selected]); onClose(); }}>
            Assign to Room
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function RoomOverviewTab({ room, dbRoom, roomTasks, labels, roomLabels, orgId, onLabelToggle, onNoteLabelChange }) {
  const done  = roomTasks.filter(t => t.status === "done" || t.completed).length;
  const total = roomTasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : (dbRoom?.progress_percent || 0);
  const overdue = roomTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed && t.status !== "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Status + progress */}
      <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px",
        border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)",
            textTransform: "uppercase", letterSpacing: .5 }}>Progress</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} />
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5, color: "var(--text2)" }}>
          <span>{done}/{total} tasks done</span>
          {overdue > 0 && <span style={{ color: "#e85a3a", fontWeight: 600 }}>⚠ {overdue} overdue</span>}
        </div>
      </div>

      {/* Labels */}
      <div>
        <SectionHdr icon={I.tag} title="Labels" count={labels.length} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {labels.map(l => (
            <LabelChip key={l.id} label={l} onRemove={() => onLabelToggle(l, false)} />
          ))}
          {labels.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--text3)" }}>No labels assigned.</span>
          )}
        </div>
        {/* Add label dropdown */}
        {roomLabels.filter(l => !labels.find(a => a.id === l.id)).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {roomLabels.filter(l => !labels.find(a => a.id === l.id)).map(l => (
              <span key={l.id} onClick={() => onLabelToggle(l, true)}
                style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                  background: "var(--surface2)", color: "var(--text3)",
                  border: "1px dashed var(--border)", cursor: "pointer" }}>
                + {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: TASKS
// ═══════════════════════════════════════════════════════════════════════════════
function RoomTasksTab({ room, roomTasks, orgId, projectId, userId, teamUsers, onAddTask }) {
  const PRIORITY_COLOR = { critical:"#e85a3a", high:"#e8703a", medium:"#e8c53a", low:"#3dba7e" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn variant="primary" size="sm" onClick={onAddTask}>
          <Ico d={I.plus} size={13} stroke="white" /> Add Task
        </Btn>
      </div>
      {roomTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text3)", fontSize: 13 }}>
          No tasks for this room yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roomTasks.map(t => {
            const isDone = t.status === "done" || t.completed;
            const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !isDone;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", background: "var(--surface2)", borderRadius: 8,
                border: `1px solid ${isOverdue ? "#e85a3a33" : "var(--border)"}` }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid var(--border)",
                  background: isDone ? "var(--accent,#2b7fe8)" : "transparent",
                  flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center",
                  justifyContent: "center" }}>
                  {isDone && <Ico d={I.check} size={10} stroke="white" sw={3} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "var(--text3)" : "var(--text)",
                    textDecoration: isDone ? "line-through" : "none", marginBottom: 2 }}>
                    {t.title}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "var(--text3)" }}>
                    {t.priority && (
                      <span style={{ color: PRIORITY_COLOR[t.priority] || "#888", fontWeight: 600 }}>
                        {t.priority}
                      </span>
                    )}
                    {t.dueDate && (
                      <span style={{ color: isOverdue ? "#e85a3a" : "var(--text3)" }}>
                        Due {t.dueDate}
                      </span>
                    )}
                    {t.status && <span>{t.status.replace(/_/g," ")}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: NOTES
// ═══════════════════════════════════════════════════════════════════════════════
function RoomNotesTab({ room, dbRoom, orgId, onNotesSaved }) {
  const [notes, setNotes]   = useState(dbRoom?.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const timeout = useRef(null);

  useEffect(() => { setNotes(dbRoom?.notes || ""); }, [dbRoom?.notes]);

  const save = useCallback(async (val) => {
    setSaving(true);
    try {
      await supabase.from("rooms").update({ notes: val, updated_at: new Date().toISOString() }).eq("id", room.id);
      onNotesSaved && onNotesSaved(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.warn("Notes save failed:", e); }
    finally { setSaving(false); }
  }, [room.id, onNotesSaved]);

  const handleChange = (v) => {
    setNotes(v);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => save(v), 1200);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)",
          textTransform: "uppercase", letterSpacing: .5 }}>Room Notes</span>
        <span style={{ fontSize: 11.5, color: saving ? "#e8c53a" : saved ? "#3dba7e" : "var(--text3)" }}>
          {saving ? "Saving…" : saved ? "✓ Saved" : dbRoom?.updated_at ? `Updated ${timeAgo(dbRoom.updated_at)}` : ""}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={e => handleChange(e.target.value)}
        placeholder={`Add notes for ${room.name}…\n\nDocument observations, conditions, or anything relevant to this room.`}
        style={{ width: "100%", minHeight: 200, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "var(--text)", resize: "vertical",
          boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.65 }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: MOISTURE — replaced by import from MoistureTab.jsx
// ═══════════════════════════════════════════════════════════════════════════════
function RoomMoistureTab_UNUSED({ room, orgId, projectId, userId }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("room_moisture_readings")
      .select("*").eq("room_id", room.id)
      .order("reading_at", { ascending: false }).limit(50);
    setReadings(data || []);
    setLoading(false);
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  const latest = readings[0];

  return (
    <div>
      {/* Latest summary */}
      {latest && (
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px",
          border: "1px solid var(--border)", marginBottom: 16,
          display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 10 }}>
          {[
            ["Mat. Moisture", latest.material_moisture_value != null ? latest.material_moisture_value + "%" : "—"],
            ["Humidity",      latest.humidity_percent       != null ? latest.humidity_percent + "%" : "—"],
            ["Temp",          latest.temperature_value      != null ? latest.temperature_value + "°" + latest.temperature_unit : "—"],
            ["GPP",           latest.gpp_value              != null ? latest.gpp_value : "—"],
            ["Dew Point",     latest.dew_point_value        != null ? latest.dew_point_value + "°F" : "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: "var(--text3)", fontWeight: 600, marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{v}</div>
            </div>
          ))}
          <div style={{ gridColumn: "1/-1", fontSize: 11.5, color: "var(--text3)", textAlign: "right" }}>
            Latest reading: {fmtTime(latest.reading_at)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionHdr icon={I.moisture} title="Reading History" count={readings.length} />
        <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Ico d={I.plus} size={13} stroke="white" /> Add Reading
        </Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Loading…</div>
      ) : readings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text3)", fontSize: 13 }}>
          No moisture readings yet. Add the first one above.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                {["Date","Material","Mat. %","RH %","Temp","GPP","Dew Pt","Notes"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", fontWeight: 600,
                    textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readings.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: "var(--text2)" }}>{fmtTime(r.reading_at)}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text)" }}>{r.material_label || "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.material_moisture_value != null ? r.material_moisture_value+"%" : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.humidity_percent        != null ? r.humidity_percent+"%"       : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.temperature_value       != null ? r.temperature_value+"°"+r.temperature_unit : "—"}</td>
                  <td style={{ padding: "7px 8px", fontWeight: 600 }}>{r.gpp_value       != null ? r.gpp_value       : "—"}</td>
                  <td style={{ padding: "7px 8px", fontWeight: 600 }}>{r.dew_point_value != null ? r.dew_point_value+"°F" : "—"}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text3)", maxWidth: 120,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <MoistureAddModal room={room} orgId={orgId} projectId={projectId} userId={userId}
          onClose={() => setShowAdd(false)}
          onSave={row => { setReadings(prev => [row, ...prev]); setShowAdd(false); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: EQUIPMENT
// ═══════════════════════════════════════════════════════════════════════════════
function RoomEquipmentTab({ room, orgId, projectId, userId, allRooms = [], projectName = "" }) {
  const [assignments,   setAssignments]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showAssign,    setShowAssign]     = useState(false);
  const [showQrModal,   setShowQrModal]   = useState(false);

  // ── Quick action menu state ────────────────────────────────────────────────
  // quickAction: null | { type: 'move'|'remove'|'transit'|'notes', assignment }
  const [quickAction,   setQuickAction]   = useState(null);
  const [qaTargetRoom,  setQaTargetRoom]  = useState(null);
  const [qaNotes,       setQaNotes]       = useState('');
  const [qaSaving,      setQaSaving]      = useState(false);
  const [qaError,       setQaError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("room_equipment_assignments")
      .select(`*, equipment(id,name,unique_code,manufacturer,model,status,condition,qr_code_id,photo_url,equipment_types(name))`)
      .eq("room_id", room.id).order("placed_at", { ascending: false });
    setAssignments(data || []);
    setLoading(false);
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  // ── QrActionModal done callback ─────────────────────────────────────────────
  const handleQrDone = useCallback(({ action, equipment, assignment: newAssign }) => {
    setShowQrModal(false);
    load(); // Refresh the list
  }, [load]);

  // ── Quick action: open menu ─────────────────────────────────────────────────
  const openQuickAction = useCallback((type, assignment) => {
    setQuickAction({ type, assignment });
    setQaTargetRoom(null);
    setQaNotes('');
    setQaError(null);
  }, []);

  const closeQuickAction = useCallback(() => {
    setQuickAction(null);
    setQaTargetRoom(null);
    setQaNotes('');
    setQaError(null);
    setQaSaving(false);
  }, []);

  // ── Quick action: execute ───────────────────────────────────────────────────
  const executeQuickAction = useCallback(async () => {
    if (!quickAction) return;
    setQaSaving(true);
    setQaError(null);
    const { type, assignment: a } = quickAction;
    const eq = a.equipment;

    try {
      if (type === 'remove') {
        await removeAssignment(a.id, {
          equipmentId:    eq.id,
          equipmentName:  eq.name,
          organizationId: orgId,
          fromRoomId:     room.id,
          fromRoomName:   room.name,
          projectId,
          projectName,
          notes:          qaNotes || null,
          userId,
        });
        setAssignments(prev => prev.map(x => x.id === a.id
          ? { ...x, removed_at: new Date().toISOString() } : x));

      } else if (type === 'move') {
        if (!qaTargetRoom) { setQaError("Please select a destination room."); setQaSaving(false); return; }
        const newAssign = await moveEquipmentToRoom(a.id, {
          equipmentId:    eq.id,
          equipmentName:  eq.name,
          organizationId: orgId,
          fromRoomId:     room.id,
          fromRoomName:   room.name,
          toRoomId:       qaTargetRoom.id,
          toRoomName:     qaTargetRoom.name,
          projectId,
          projectName,
          notes:          qaNotes || null,
          userId,
        });
        // Mark current assignment removed locally
        setAssignments(prev => prev.map(x => x.id === a.id
          ? { ...x, removed_at: new Date().toISOString() } : x));

      } else if (type === 'transit') {
        await markInTransit(eq.id, {
          organizationId: orgId,
          equipmentName:  eq.name,
          fromRoomId:     room.id,
          fromRoomName:   room.name,
          projectId,
          projectName,
          notes:          qaNotes || null,
          userId,
        });
        // Update local status
        setAssignments(prev => prev.map(x => x.id === a.id
          ? { ...x, equipment: { ...x.equipment, status: 'in_transit' } } : x));

      } else if (type === 'notes') {
        await supabase.from("room_equipment_assignments")
          .update({ notes: qaNotes, updated_at: new Date().toISOString() })
          .eq("id", a.id);
        await logMovement({
          organizationId:    orgId,
          equipmentId:       eq.id,
          equipmentName:     eq.name,
          actionType:        MOVE_ACTION.NOTES_UPDATED,
          fromRoomId:        room.id,
          fromRoomName:      room.name,
          toRoomId:          room.id,
          toRoomName:        room.name,
          fromProjectId:     projectId,
          toProjectId:       projectId,
          performedByUserId: userId,
          assignmentId:      a.id,
          notes:             qaNotes,
          scanMethod:        'manual',
        });
        setAssignments(prev => prev.map(x => x.id === a.id
          ? { ...x, notes: qaNotes } : x));
      }

      closeQuickAction();
    } catch (err) {
      console.error("[RoomEquipmentTab] quick action error:", err);
      setQaError(err.message || "Something went wrong.");
      setQaSaving(false);
    }
  }, [quickAction, qaTargetRoom, qaNotes, orgId, room, projectId, projectName, userId, closeQuickAction]);

  const active   = assignments.filter(a => !a.removed_at);
  const historic = assignments.filter(a => a.removed_at);

  // ── Equipment status badge ──────────────────────────────────────────────────
  const statusDot = (status) => {
    const colors = { available: "#3dba7e", deployed: "#3ab8e8", in_transit: "#a78bfa",
      in_maintenance: "#f59e0b", out_of_service: "#ef4444" };
    return (
      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: colors[status] || "#6b7280", marginRight: 4, flexShrink: 0 }} />
    );
  };

  // ── Render active assignment card ───────────────────────────────────────────
  const renderAssignCard = (a) => {
    const eq     = a.equipment;
    const isQr   = a.assigned_via === "qr_scan";
    const isTransit = eq?.status === "in_transit";
    return (
      <div key={a.id} style={{ background: "var(--surface2)", borderRadius: 10,
        border: `1px solid ${isQr ? "rgba(61,186,126,.3)" : "var(--border)"}`,
        overflow: "hidden" }}>

        {/* Main row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
          {/* Photo or icon */}
          {eq?.photo_url
            ? <img src={eq.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: 7,
                objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 38, height: 38, borderRadius: 7, flexShrink: 0,
                background: isQr ? "#3dba7e18" : "#8b7cf818",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isQr ? <span style={{ fontSize: 17 }}>⬛</span>
                      : <Ico d={I.equipment} size={16} stroke="#8b7cf8" />}
              </div>
          }

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{eq?.name || "Equipment"}</span>
              {isQr && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8,
                  background: "#3dba7e18", color: "#3dba7e", border: "1px solid #3dba7e30",
                  fontWeight: 700, flexShrink: 0 }}>⬛ QR</span>
              )}
              {isTransit && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8,
                  background: "#a78bfa18", color: "#a78bfa", border: "1px solid #a78bfa30",
                  fontWeight: 700, flexShrink: 0 }}>🚚 In Transit</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>
              {[eq?.manufacturer, eq?.model, eq?.unique_code ? `#${eq.unique_code}` : ""].filter(Boolean).join(" · ")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
              {statusDot(eq?.status)}Placed {fmtTime(a.placed_at)}
            </div>
            {a.notes && (
              <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 4,
                background: "var(--surface)", borderRadius: 5, padding: "3px 7px",
                border: "1px solid var(--border)", lineHeight: 1.4 }}>
                📝 {a.notes}
              </div>
            )}
          </div>
        </div>

        {/* Quick action bar */}
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid var(--border)" }}>
          {[
            { key: "move",    label: "🔄 Move",    title: "Move to another room" },
            { key: "transit", label: "🚚 Transit",  title: "Mark in transit" },
            { key: "notes",   label: "📝 Notes",   title: "Add/edit notes" },
            { key: "remove",  label: "🚫 Remove",  title: "Remove from jobsite", danger: true },
          ].map((action, idx, arr) => (
            <button key={action.key}
              title={action.title}
              onClick={() => {
                if (action.key === "notes") setQaNotes(a.notes || "");
                openQuickAction(action.key, a);
              }}
              style={{
                flex: 1, padding: "7px 4px", border: "none", cursor: "pointer",
                borderRight: idx < arr.length - 1 ? "1px solid var(--border)" : "none",
                background: "transparent",
                color: action.danger ? "#ef4444" : "var(--text2)",
                fontSize: 11.5, fontWeight: 600, lineHeight: 1.2,
                transition: "background .12s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = action.danger ? "#ef444418" : "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >{action.label}</button>
          ))}
        </div>
      </div>
    );
  };

  // ── Quick action modal ──────────────────────────────────────────────────────
  const renderQuickActionModal = () => {
    if (!quickAction) return null;
    const { type, assignment: a } = quickAction;
    const eq = a.equipment;
    const titles = {
      move:    "🔄 Move Equipment",
      transit: "🚚 Mark In Transit",
      notes:   "📝 Edit Notes",
      remove:  "🚫 Remove Equipment",
    };
    const confirmLabels = {
      move:    qaTargetRoom ? `Move to ${qaTargetRoom.name}` : "Select a room",
      transit: "Mark In Transit",
      notes:   "Save Notes",
      remove:  "Confirm Remove",
    };
    const isDanger = type === "remove";

    return (
      <div className="modal-overlay" onClick={qaSaving ? undefined : closeQuickAction}>
        <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{titles[type]}</div>
            {!qaSaving && (
              <button className="btn btn-ghost btn-icon" onClick={closeQuickAction}>
                <Ico d="M18 6L6 18M6 6l12 12" size={16} />
              </button>
            )}
          </div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Equipment summary */}
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", background: "var(--surface2)", borderRadius: 8,
              border: "1px solid var(--border)" }}>
              {eq?.photo_url
                ? <img src={eq.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: 6, background: "#8b7cf818",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico d={I.equipment} size={14} stroke="#8b7cf8" />
                  </div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{eq?.name}</div>
                {eq?.unique_code && <div style={{ fontSize: 11, color: "var(--text3)" }}>#{eq.unique_code}</div>}
              </div>
            </div>

            {/* Move: room selector */}
            {type === "move" && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                  Destination Room
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {allRooms.filter(r => r.id !== room.id).length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text3)" }}>No other rooms in this project.</div>
                  ) : allRooms.filter(r => r.id !== room.id).map(r => (
                    <button key={r.id} onClick={() => setQaTargetRoom(r)}
                      style={{
                        padding: "9px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                        border: `1px solid ${qaTargetRoom?.id === r.id ? "var(--accent)" : "var(--border)"}`,
                        background: qaTargetRoom?.id === r.id ? "rgba(37,99,235,.12)" : "var(--surface2)",
                        color: "var(--text)", fontSize: 13, fontWeight: qaTargetRoom?.id === r.id ? 700 : 400,
                      }}>{r.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Transit: description */}
            {type === "transit" && (
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>
                This will update the equipment status to <strong>In Transit</strong> and log the movement.
              </p>
            )}

            {/* Remove: warning */}
            {type === "remove" && (
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>
                This will remove <strong>{eq?.name}</strong> from <strong>{room.name}</strong> and
                mark it as available in inventory.
              </p>
            )}

            {/* Notes textarea — all types */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>
                {type === "notes" ? "Notes" : "Notes"} <span style={{ fontWeight: 400, color: "var(--text3)" }}>(optional)</span>
              </div>
              <textarea
                className="form-input"
                rows={3}
                placeholder={
                  type === "notes"   ? "Condition, observations, reminders…" :
                  type === "move"    ? "Reason for move, setup notes…" :
                  type === "transit" ? "Driver, pickup location, ETA…" :
                                       "Reason for removal, return notes…"
                }
                value={qaNotes}
                onChange={e => setQaNotes(e.target.value)}
                disabled={qaSaving}
                style={{ resize: "vertical", minHeight: 60, fontSize: 13 }}
                autoFocus={type === "notes"}
              />
            </div>

            {qaError && (
              <div style={{ background: "#e85a3a15", border: "1px solid #e85a3a40", borderRadius: 7,
                padding: "8px 12px", fontSize: 13, color: "#e85a3a" }}>{qaError}</div>
            )}
          </div>
          <div className="modal-footer">
            <Btn variant="secondary" onClick={closeQuickAction} disabled={qaSaving}>Cancel</Btn>
            <Btn
              variant={isDanger ? "danger" : "primary"}
              onClick={executeQuickAction}
              disabled={qaSaving || (type === "move" && !qaTargetRoom)}
            >
              {qaSaving ? "Saving…" : confirmLabels[type]}
            </Btn>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <SectionHdr icon={I.equipment} title="Assigned Equipment" count={active.length} />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn variant="secondary" size="sm" onClick={() => setShowQrModal(true)}
            style={{ background: "var(--accent)", color: "white", border: "none", fontWeight: 700 }}>
            ⬛ Assign via QR
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => setShowAssign(true)}>
            <Ico d={I.plus} size={13} stroke="white" /> Assign Equipment
          </Btn>
        </div>
      </div>

      {/* ── Active assignments ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Loading…</div>
      ) : active.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--text3)", fontSize: 13 }}>
          No equipment currently in this room.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {active.map(renderAssignCard)}
        </div>
      )}

      {/* ── History ── */}
      {historic.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5, color: "var(--text3)", cursor: "pointer", marginBottom: 8 }}>
            {historic.length} removed
          </summary>
          {historic.map(a => {
            const eq = a.equipment;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", background: "var(--surface)", borderRadius: 6,
                border: "1px solid var(--border)", marginBottom: 6, opacity: .65 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{eq?.name}</span>
                    {a.assigned_via === "qr_scan" && (
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 6,
                        background: "#3dba7e18", color: "#3dba7e", border: "1px solid #3dba7e30", fontWeight: 700 }}>
                        ⬛ QR
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    Placed {fmtTime(a.placed_at)} → Removed {fmtTime(a.removed_at)}
                    {a.removal_reason && ` · ${a.removal_reason.replace(/_/g, " ")}`}
                  </div>
                </div>
              </div>
            );
          })}
        </details>
      )}

      {/* ── Manual assign modal ── */}
      {showAssign && (
        <EquipmentAssignModal room={room} orgId={orgId} projectId={projectId} userId={userId}
          onClose={() => setShowAssign(false)}
          onSave={row => { setAssignments(prev => [row, ...prev]); setShowAssign(false); }} />
      )}

      {/* ── QR Action Modal ── */}
      {showQrModal && (
        <QrActionModal
          mode="assign"
          room={room}
          projectId={projectId}
          orgId={orgId}
          userId={userId}
          allRooms={allRooms}
          onDone={handleQrDone}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* ── Quick action modal ── */}
      {renderQuickActionModal()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL — sub-tab: ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════
function RoomActivityTab({ room, project }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const items = [];

    // Photos tied to this room
    (project.photos || []).filter(p => p.room === room.name).forEach(p =>
      items.push({ id: "photo-"+p.id, type: "photo", label: p.name || "Photo added",
        when: p.createdAt || p.date || p.created_at, icon: I.camera, color: "#3ab8e8" })
    );
    // Videos
    (project.videos || []).filter(v => v.room === room.name).forEach(v =>
      items.push({ id: "vid-"+v.id, type: "video", label: v.name || "Video added",
        when: v.createdAt || v.date, icon: I.camera, color: "#8b7cf8" })
    );

    // Load DB activity logs
    supabase.from("room_activity_logs").select("*").eq("room_id", room.id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => {
        (data || []).forEach(l =>
          items.push({ id: l.id, type: l.action_type, label: l.action_label,
            when: l.created_at, icon: I.activity, color: "#6b7280" })
        );
        // Sort all by when desc
        items.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
        setActivity(items);
        setLoading(false);
      });
  }, [room.id, room.name, project]);

  const TYPE_ICON = { photo: I.camera, task: I.task, note: I.note, moisture: I.moisture,
    equipment: I.equipment, ai: I.sparkle };
  const TYPE_COLOR = { photo: "#3ab8e8", task: "#8b7cf8", note: "#e8c53a",
    moisture: "#3dba7e", equipment: "#e8703a", ai: "#a855f7" };

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Loading…</div>
      ) : activity.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text3)", fontSize: 13 }}>
          No activity recorded yet.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: 8, bottom: 8,
            width: 2, background: "var(--border)", borderRadius: 1 }} />
          {activity.map(a => {
            const col = TYPE_COLOR[a.type] || a.color || "#6b7280";
            const ico = TYPE_ICON[a.type] || a.icon || I.activity;
            return (
              <div key={a.id} style={{ display: "flex", gap: 14, alignItems: "flex-start",
                marginBottom: 14, position: "relative", paddingLeft: 32 }}>
                <div style={{ position: "absolute", left: 4, top: 2, width: 18, height: 18,
                  borderRadius: "50%", background: `${col}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${col}44` }}>
                  <Ico d={ico} size={9} stroke={col} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>{timeAgo(a.when)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
const AI_ROOM_COST = 1;

function AiSummarySection({ room, dbRoom, project, orgId, userId, settings, onSettingsChange, roomTasks, labels }) {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [blocked, setBlocked] = useState(false);

  // Load latest saved summary
  useEffect(() => {
    supabase.from("room_ai_summaries").select("*").eq("room_id", room.id)
      .order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setResult(data[0]); });
  }, [room.id]);

  const perm = checkAiPermission(settings);

  // Check Kraken balance
  const plan  = settings?.plan || "base";
  const limit = { base: 10, pro: 75, command: 1000 }[plan] || 0;
  const used  = settings?.aiGenerationsUsed || 0;
  const canAfford = (limit - used) >= AI_ROOM_COST;

  const generate = async () => {
    if (!perm.allowed) { setBlocked(true); return; }
    if (!canAfford) {
      setError("Not enough Krakens this week."); return;
    }
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token || "";

      const roomPhotos = (project.photos || []).filter(p => p.room === room.name);
      const ctx = {
        roomName: room.name,
        projectTitle: project.title || "Untitled",
        projectAddress: project.address || "",
        status: dbRoom?.status || "not_started",
        notes: dbRoom?.notes || "",
        labels: labels.map(l => l.name),
        taskSummary: `${roomTasks.filter(t=>!t.completed&&t.status!=="done").length} open, ${roomTasks.filter(t=>t.completed||t.status==="done").length} done`,
        photoCount: roomPhotos.length,
      };

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify({ feature: "room-summary", roomId: room.id, projectId: project.id, context: ctx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI error");

      // Save summary + deduct
      deductKrakens(AI_ROOM_COST, onSettingsChange);
      logAiEvent({ orgId, userId, projectId: project.id, featureKey: "room_ai_summary",
        krakensCost: AI_ROOM_COST, status: "success" });

      // Persist summary
      const { data: saved } = await supabase.from("room_ai_summaries").insert([{
        organization_id: orgId, project_id: project.id, room_id: room.id,
        created_by_user_id: userId, summary_text: data.summary, krakens_cost: AI_ROOM_COST,
      }]).select().single();
      setResult(saved || { summary_text: data.summary, created_at: new Date().toISOString() });
    } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: "linear-gradient(135deg,#a855f711,#7c3aed11)", borderRadius: 10,
      border: "1px solid #a855f733", padding: "14px 16px" }}>
      {blocked && <AiBlockedModal onClose={() => setBlocked(false)} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Ico d={I.sparkle} size={15} stroke="#a855f7" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>AI Room Summary</span>
        </div>
        <button onClick={generate} disabled={loading || !canAfford}
          style={{ display: "flex", alignItems: "center", gap: 5,
            background: loading || !canAfford ? "var(--border)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
            color: "white", border: "none", borderRadius: 8, padding: "6px 12px",
            fontSize: 12.5, fontWeight: 700, cursor: loading || !canAfford ? "not-allowed" : "pointer",
            opacity: loading || !canAfford ? .6 : 1 }}>
          {loading
            ? <><div style={{ width:12,height:12,border:"2px solid rgba(255,255,255,.4)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin .7s linear infinite"}} />Generating…</>
            : <><Ico d={I.sparkle} size={12} stroke="white" />Summarize this room · {AI_ROOM_COST} ⬡</>
          }
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12.5, color: "#e85a3a", marginBottom: 8 }}>{error}</div>
      )}
      {result ? (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {result.summary_text}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
            Generated {timeAgo(result.created_at)} · 1 ⬡ Kraken
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text3)" }}>
          Generate a concise AI summary of this room's current state — tasks, notes, labels, and photos.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════
const DETAIL_TABS = [
  { id: "overview",  label: "Overview",  icon: I.door      },
  { id: "tasks",     label: "Tasks",     icon: I.task      },
  { id: "notes",     label: "Notes",     icon: I.note      },
  { id: "moisture",  label: "Moisture",  icon: I.moisture  },
  { id: "equipment", label: "Equipment", icon: I.equipment },
  { id: "activity",  label: "Activity",  icon: I.activity  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM TASK TEMPLATE PICKER
// ═══════════════════════════════════════════════════════════════════════════════
function RoomTaskTemplatePicker({ orgId, onSelect, onManage, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase.from("room_task_templates").select("*").eq("organization_id", orgId)
      .order("name").then(({ data }) => { setTemplates(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orgId]);

  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)", boxSizing: "border-box", outline: "none" };
  const PRIO_COLOR = { critical: "#ef4444", high: "#f97316", medium: "#3b82f6", low: "#6b7280" };

  return (
    <Modal title="Add Task from Template" onClose={onClose} width={420}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ color: "var(--text3)", fontSize: 13, marginBottom: 12 }}>No task templates yet.</div>
          <Btn variant="primary" size="sm" onClick={onManage}>Create Template</Btn>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
          {templates.map(t => (
            <div key={t.id} onClick={() => onSelect(t)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
                cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#3b82f6", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
              </div>
              <span style={{ fontSize: 11, color: PRIO_COLOR[t.priority], fontWeight: 600, textTransform: "capitalize" }}>{t.priority}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Btn variant="ghost" size="sm" onClick={onManage}>Manage Templates</Btn>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM TASK TEMPLATE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
function RoomTaskTemplateManager({ orgId, userId, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null); // null = list view, object = editing
  const [form, setForm]           = useState({ name: "", description: "", priority: "medium" });
  const [saving, setSaving]       = useState(false);

  const load = () => {
    setLoading(true);
    supabase.from("room_task_templates").select("*").eq("organization_id", orgId)
      .order("name").then(({ data }) => { setTemplates(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, [orgId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveTemplate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing?.id) {
        await supabase.from("room_task_templates").update({
          name: form.name.trim(), description: form.description, priority: form.priority, updated_at: new Date().toISOString(),
        }).eq("id", editing.id);
      } else {
        await supabase.from("room_task_templates").insert([{
          organization_id: orgId, name: form.name.trim(), description: form.description,
          priority: form.priority, created_by: userId,
        }]);
      }
      setEditing(null);
      load();
    } catch (e) { alert("Error saving template: " + e.message); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("room_task_templates").delete().eq("id", id);
    load();
  };

  const startEdit = (tmpl) => {
    setEditing(tmpl);
    setForm({ name: tmpl.name, description: tmpl.description || "", priority: tmpl.priority || "medium" });
  };

  const startNew = () => {
    setEditing({});
    setForm({ name: "", description: "", priority: "medium" });
  };

  const inp = { width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)", boxSizing: "border-box", outline: "none" };
  const PRIO_COLOR = { critical: "#ef4444", high: "#f97316", medium: "#3b82f6", low: "#6b7280" };

  return (
    <Modal title={editing ? (editing.id ? "Edit Template" : "New Template") : "Manage Task Templates"} onClose={editing ? () => setEditing(null) : onClose} width={460}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Template Name *</div>
            <input style={inp} placeholder="e.g., Moisture Check" value={form.name} onChange={e => set("name", e.target.value)} autoFocus />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Default Priority</div>
            <select style={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
              {["critical","high","medium","low"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Description</div>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Optional task description…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveTemplate} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editing.id ? "Update" : "Create Template"}
            </Btn>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Btn variant="primary" size="sm" onClick={startNew} style={{ gap: 4 }}>
              <Ico d={I.plus} size={12} /> New Template
            </Btn>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Loading…</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>No templates yet. Create one to get started.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
              {templates.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#3b82f6", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>{t.description}</div>}
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => startEdit(t)} style={{ padding: "4px 8px" }}>
                    <Ico d={I.edit} size={12} />
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => deleteTemplate(t.id)} style={{ padding: "4px 8px", color: "#ef4444" }}>
                    <Ico d={I.trash} size={12} />
                  </Btn>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <Btn variant="ghost" onClick={onClose}>Done</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

function RoomDetailView({
  room, project, orgId, userId, settings, onSettingsChange,
  tasks, onTasksChange, teamUsers, onUpdateProject, onOpenCamera, onBack,
  allRoomLabels, onAllRoomLabelsChange,
}) {
  const [activeTab,   setActiveTab]   = useState("overview");
  const [dbRoom,      setDbRoom]      = useState(null);
  const [labels,      setLabels]      = useState([]);     // assigned labels for this room
  const [status,      setStatus]      = useState("not_started");
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateInitial, setTemplateInitial] = useState(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showPhotos,  setShowPhotos]  = useState(false);
  const [showLabels,  setShowLabels]  = useState(false);

  // Room-scoped tasks
  const roomTasks = useMemo(() =>
    tasks.filter(t => (t.room_id === room.id || t.roomId === room.id) &&
      (t.project_id === project.id || t.projectId === project.id)),
    [tasks, room.id, project.id]
  );

  // Load / upsert room DB record + labels
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingRoom(true);
      try {
        // Upsert room record (bridge from JSONB → DB)
        const { data: existing } = await supabase.from("rooms").select("*").eq("id", room.id).maybeSingle();
        let dbR = existing;
        if (!dbR) {
          const { data: created } = await supabase.from("rooms").insert([{
            id: room.id,
            organization_id: orgId,
            project_id: project.id,
            name: room.name,
            status: "not_started",
          }]).select().single();
          dbR = created;
        }
        if (!cancelled && dbR) {
          setDbRoom(dbR);
          setStatus(dbR.status || "not_started");
        }

        // Load labels
        const { data: labelMap } = await supabase
          .from("room_label_map")
          .select("label_id, room_labels(id,name,color)")
          .eq("room_id", room.id);
        if (!cancelled) {
          setLabels((labelMap || []).map(l => l.room_labels).filter(Boolean));
        }
      } catch (e) { console.warn("RoomDetailView load:", e.message); }
      finally { if (!cancelled) setLoadingRoom(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [room.id, orgId, project.id, room.name]);

  // Ensure org has default labels seeded on first load
  useEffect(() => {
    if (!orgId) return;
    supabase.from("room_labels").select("id").eq("organization_id", orgId).limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          // Seed starter labels
          const starters = [
            { name: "Water Damage", color: "#3ab8e8" }, { name: "Mold", color: "#e85a3a" },
            { name: "Structural",   color: "#8b7cf8" }, { name: "Electrical", color: "#e8c53a" },
            { name: "Plumbing",     color: "#4a90d9" }, { name: "Demo Required", color: "#6b7280" },
            { name: "Inspection Ready", color: "#3dba7e" }, { name: "Complete", color: "#3dba7e" },
          ];
          supabase.from("room_labels").insert(
            starters.map(s => ({ ...s, organization_id: orgId }))
          ).then(({ data: seeded }) => {
            if (seeded) onAllRoomLabelsChange && onAllRoomLabelsChange(prev => [...prev, ...seeded]);
          });
        }
      });
  }, [orgId]);

  const updateStatus = async (newStatus) => {
    setStatus(newStatus);
    await supabase.from("rooms").update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", room.id);
    setDbRoom(prev => ({ ...prev, status: newStatus }));
    // Log activity
    supabase.from("room_activity_logs").insert([{
      organization_id: orgId, project_id: project.id, room_id: room.id,
      user_id: userId || null, action_type: "status_change",
      action_label: `Status changed to ${STATUS_CFG[newStatus]?.label || newStatus}`,
    }]).catch(() => {});
  };

  const toggleLabel = async (label, adding) => {
    if (adding) {
      await supabase.from("room_label_map").insert([{ room_id: room.id, label_id: label.id }]).catch(() => {});
      setLabels(prev => [...prev, label]);
      supabase.from("room_activity_logs").insert([{
        organization_id: orgId, project_id: project.id, room_id: room.id,
        user_id: userId || null, action_type: "label_added",
        action_label: `Label "${label.name}" added`,
      }]).catch(() => {});
    } else {
      await supabase.from("room_label_map")
        .delete().eq("room_id", room.id).eq("label_id", label.id).catch(() => {});
      setLabels(prev => prev.filter(l => l.id !== label.id));
    }
  };

  const handleAddTask = (newTask) => {
    onTasksChange && onTasksChange([...tasks, { ...newTask, roomId: room.id }]);
    setShowAddTask(false);
    // Log activity
    supabase.from("room_activity_logs").insert([{
      organization_id: orgId, project_id: project.id, room_id: room.id,
      user_id: userId || null, action_type: "task_created",
      action_label: `Task created: "${newTask.title}"`,
    }]).catch(() => {});
  };

  const handlePhotoAssign = (photoIds) => {
    const updatedPhotos = (project.photos || []).map(p =>
      photoIds.includes(p.id) ? { ...p, room: room.name } : p
    );
    onUpdateProject && onUpdateProject({ ...project, photos: updatedPhotos });
  };

  // Room photos count
  const photoCount = (project.photos || []).filter(p => p.room === room.name).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px",
        borderBottom: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
            padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}>
          <Ico d={I.chevronL} size={14} /> Rooms
        </button>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${room.color || "#4a90d9"}22`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d={I.door} size={16} stroke={room.color || "#4a90d9"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{room.name}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {photoCount} photo{photoCount !== 1 ? "s" : ""} · {roomTasks.length} task{roomTasks.length !== 1 ? "s" : ""}
          </div>
        </div>
        {/* Status selector */}
        <select value={status} onChange={e => updateStatus(e.target.value)}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
            padding: "5px 8px", fontSize: 12, fontWeight: 600, color: STATUS_CFG[status]?.color || "var(--text)",
            cursor: "pointer", outline: "none" }}>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
          ))}
        </select>
        {/* Quick actions */}
        <div style={{ display: "flex", gap: 6 }}>
          <Btn size="sm" variant="ghost" onClick={() => onOpenCamera && onOpenCamera(room)}
            style={{ gap: 4 }} title="Take Photo">
            <Ico d={I.camera} size={13} />
            <span className="desktop-only">Photo</span>
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowAddTask(true)}
            style={{ gap: 4 }} title="Add Task">
            <Ico d={I.plus} size={13} />
            <span className="desktop-only">Task</span>
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowTemplatePicker(true)}
            style={{ gap: 4 }} title="Add from Template">
            <Ico d={I.template} size={13} />
            <span className="desktop-only">Template</span>
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowPhotos(true)}
            style={{ gap: 4 }} title="Assign Photos">
            <Ico d={I.photo} size={13} />
            <span className="desktop-only">Photos</span>
          </Btn>
        </div>
      </div>

      {/* ── Sub-tab bar ── */}
      <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid var(--border)",
        background: "var(--bg)", flexShrink: 0, overflowX: "auto" }}>
        {DETAIL_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 10px",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "none",
              border: "none", color: activeTab === t.id ? "var(--accent,#2b7fe8)" : "var(--text3)",
              borderBottom: activeTab === t.id ? "2px solid var(--accent,#2b7fe8)" : "2px solid transparent",
              whiteSpace: "nowrap", transition: "color .15s", outline: "none" }}>
            <Ico d={t.icon} size={13} stroke={activeTab === t.id ? "var(--accent,#2b7fe8)" : "var(--text3)"} />
            {t.label}
            {t.id === "tasks" && roomTasks.filter(t=>!t.completed&&t.status!=="done").length > 0 && (
              <span style={{ fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:8,
                background:"var(--accent,#2b7fe8)",color:"white" }}>
                {roomTasks.filter(t=>!t.completed&&t.status!=="done").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {loadingRoom ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text3)", fontSize: 13 }}>Loading room…</div>
        ) : (
          <>
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <RoomOverviewTab room={room} dbRoom={dbRoom} roomTasks={roomTasks}
                  labels={labels} roomLabels={allRoomLabels}
                  orgId={orgId} onLabelToggle={toggleLabel} />
                <AiSummarySection room={room} dbRoom={dbRoom} project={project}
                  orgId={orgId} userId={userId} settings={settings}
                  onSettingsChange={onSettingsChange} roomTasks={roomTasks} labels={labels} />
              </div>
            )}
            {activeTab === "tasks" && (
              <RoomTasksTab room={room} roomTasks={roomTasks} orgId={orgId}
                projectId={project.id} userId={userId} teamUsers={teamUsers}
                onAddTask={() => setShowAddTask(true)} />
            )}
            {activeTab === "notes" && (
              <RoomNotesTab room={room} dbRoom={dbRoom} orgId={orgId}
                onNotesSaved={v => setDbRoom(d => ({ ...d, notes: v }))} />
            )}
            {activeTab === "moisture" && (
              <RoomMoistureTab room={room} orgId={orgId} projectId={project.id} userId={userId} teamUsers={teamUsers} />
            )}
            {activeTab === "equipment" && (
              <RoomEquipmentTab room={room} orgId={orgId} projectId={project.id} userId={userId} allRooms={project.rooms || []} />
            )}
            {activeTab === "activity" && (
              <RoomActivityTab room={room} project={project} />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddTask && (
        <RoomTaskModal room={room} projectId={project.id} orgId={orgId}
          userId={userId} teamUsers={teamUsers} settings={settings}
          projectName={project.title || project.name}
          initialValues={templateInitial}
          onClose={() => { setShowAddTask(false); setTemplateInitial(null); }}
          onSave={t => { handleAddTask(t); setTemplateInitial(null); }} />
      )}
      {showTemplatePicker && (
        <RoomTaskTemplatePicker orgId={orgId}
          onSelect={tmpl => {
            setTemplateInitial({ title: tmpl.name, description: tmpl.description, priority: tmpl.priority });
            setShowTemplatePicker(false);
            setShowAddTask(true);
          }}
          onManage={() => { setShowTemplatePicker(false); setShowTemplateManager(true); }}
          onClose={() => setShowTemplatePicker(false)} />
      )}
      {showTemplateManager && (
        <RoomTaskTemplateManager orgId={orgId} userId={userId}
          onClose={() => setShowTemplateManager(false)} />
      )}
      {showPhotos && (
        <PhotoAssignModal photos={project.photos || []} rooms={project.rooms || []}
          targetRoom={room} onClose={() => setShowPhotos(false)} onAssign={handlePhotoAssign} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM CARD
// ═══════════════════════════════════════════════════════════════════════════════
function RoomCard({ room, dbRoom, labels, roomTasks, onOpen, onOpenCamera, onAddNote }) {
  const done    = roomTasks.filter(t => t.status === "done" || t.completed).length;
  const total   = roomTasks.length;
  const overdue = roomTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed && t.status !== "done").length;
  const pct     = dbRoom?.progress_percent != null
    ? dbRoom.progress_percent
    : total > 0 ? Math.round((done / total) * 100) : 0;
  const status  = dbRoom?.status || "not_started";
  const photoCount = room.photoCount || 0;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      overflow: "hidden", transition: "box-shadow .2s", cursor: "default" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>

      {/* Color bar */}
      <div style={{ height: 4, background: room.color || "#4a90d9" }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `${room.color || "#4a90d9"}22`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={I.door} size={17} stroke={room.color || "#4a90d9"} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {room.name}
            </div>
            <div style={{ marginTop: 4 }}>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 8 }}>
          <ProgressBar pct={pct} />
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, fontSize: 11.5, color: "var(--text3)", marginBottom: 10,
          flexWrap: "wrap" }}>
          <span>{photoCount} photo{photoCount !== 1 ? "s" : ""}</span>
          {total > 0 && <span>{done}/{total} tasks</span>}
          {overdue > 0 && <span style={{ color: "#e85a3a", fontWeight: 600 }}>⚠ {overdue} overdue</span>}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {labels.slice(0, 3).map(l => <LabelChip key={l.id} label={l} />)}
            {labels.length > 3 && (
              <span style={{ fontSize: 11, color: "var(--text3)", alignSelf: "center" }}>
                +{labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <button onClick={() => onOpenCamera && onOpenCamera(room)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7,
              padding: "7px 0", fontSize: 12, fontWeight: 600, color: "var(--text2)", cursor: "pointer" }}>
            <Ico d={I.camera} size={12} /> Photo
          </button>
          <button onClick={() => onOpen(room)}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "var(--accent,#2b7fe8)", border: "none", borderRadius: 7,
              padding: "7px 0", fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer" }}>
            Open Room <Ico d={I.chevronR} size={12} stroke="white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: RoomsTab
// ═══════════════════════════════════════════════════════════════════════════════
export function RoomsTab({
  project, projects = [], onProjectChange,
  orgId, userId, settings, onSettingsChange,
  tasks = [], onTasksChange, teamUsers = [],
  onUpdateProject, onOpenCamera,
}) {
  const rooms = project?.rooms || [];
  const activeProjects = projects.filter(p => p.status === "active");

  // ── Summary data from DB (status, labels, task counts) ────────────────────
  const [dbRoomsMap,   setDbRoomsMap]   = useState({});  // { [roomId]: dbRoom }
  const [labelsMap,    setLabelsMap]    = useState({});  // { [roomId]: [label,...] }
  const [allOrgLabels, setAllOrgLabels] = useState([]);
  const [loadingData,  setLoadingData]  = useState(true);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [selectedRoom, setSelectedRoom] = useState(null);

  // ── Search + Filter ────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterLabel,    setFilterLabel]    = useState("");
  const [filterOverdue,  setFilterOverdue]  = useState(false);
  const [filterNoPhotos, setFilterNoPhotos] = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  // ── Label manager ──────────────────────────────────────────────────────────
  const [showLabelMgr,   setShowLabelMgr]   = useState(false);

  // Load summary data for all rooms
  useEffect(() => {
    if (!project?.id || rooms.length === 0) { setLoadingData(false); return; }
    let cancelled = false;

    async function loadSummary() {
      setLoadingData(true);
      try {
        // Load all room DB records for this project
        const { data: dbRooms } = await supabase.from("rooms")
          .select("id,status,progress_percent,notes,updated_at")
          .eq("project_id", project.id);
        const map = {};
        (dbRooms || []).forEach(r => { map[r.id] = r; });
        if (!cancelled) setDbRoomsMap(map);

        // Load all room-label assignments for this project's rooms
        const roomIds = rooms.map(r => r.id);
        if (roomIds.length > 0) {
          const { data: labelMaps } = await supabase
            .from("room_label_map")
            .select("room_id, room_labels(id,name,color)")
            .in("room_id", roomIds);
          const lmap = {};
          (labelMaps || []).forEach(m => {
            if (!lmap[m.room_id]) lmap[m.room_id] = [];
            if (m.room_labels) lmap[m.room_id].push(m.room_labels);
          });
          if (!cancelled) setLabelsMap(lmap);
        }

        // Load org labels
        const { data: orgLabels } = await supabase.from("room_labels")
          .select("*").eq("organization_id", orgId).eq("is_archived", false).order("name");
        if (!cancelled) setAllOrgLabels(orgLabels || []);
      } catch (e) { console.warn("RoomsTab load:", e.message); }
      finally { if (!cancelled) setLoadingData(false); }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [project?.id, orgId, rooms.length]);

  // ── Filtered rooms ─────────────────────────────────────────────────────────
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (search && !room.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && (dbRoomsMap[room.id]?.status || "not_started") !== filterStatus) return false;
      if (filterLabel) {
        const rLabels = labelsMap[room.id] || [];
        if (!rLabels.find(l => l.id === filterLabel)) return false;
      }
      if (filterNoPhotos && (room.photoCount || 0) > 0) return false;
      if (filterOverdue) {
        const rTasks = tasks.filter(t =>
          (t.room_id === room.id || t.roomId === room.id) &&
          (t.project_id === project?.id || t.projectId === project?.id) &&
          t.dueDate && new Date(t.dueDate) < new Date() &&
          !t.completed && t.status !== "done"
        );
        if (rTasks.length === 0) return false;
      }
      return true;
    });
  }, [rooms, search, filterStatus, filterLabel, filterOverdue, filterNoPhotos, dbRoomsMap, labelsMap, tasks, project?.id]);

  // ── Render: room detail ────────────────────────────────────────────────────
  if (selectedRoom) {
    return (
      <RoomDetailView
        room={selectedRoom}
        project={project}
        orgId={orgId}
        userId={userId}
        settings={settings}
        onSettingsChange={onSettingsChange}
        tasks={tasks}
        onTasksChange={onTasksChange}
        teamUsers={teamUsers}
        onUpdateProject={onUpdateProject}
        onOpenCamera={onOpenCamera}
        onBack={() => setSelectedRoom(null)}
        allRoomLabels={allOrgLabels}
        onAllRoomLabelsChange={setAllOrgLabels}
      />
    );
  }

  // ── Render: rooms list ─────────────────────────────────────────────────────
  const activeFilters = [filterStatus, filterLabel, filterOverdue, filterNoPhotos].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Jobsite selector ── */}
      {activeProjects.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
          borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", whiteSpace: "nowrap" }}>Jobsite:</span>
          <select
            value={project?.id || ""}
            onChange={e => {
              const p = projects.find(p => p.id === e.target.value);
              if (p && onProjectChange) onProjectChange(p);
            }}
            style={{ flex: 1, maxWidth: 320, background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)", outline: "none" }}>
            {!project && <option value="">Select a jobsite…</option>}
            {activeProjects.map(p => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
          </select>
        </div>
      )}

      {!project && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 14 }}>
          Select a jobsite above to view its rooms.
        </div>
      )}

      {/* ── Top bar ── */}
      {project && <><div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px",
        borderBottom: "1px solid var(--border)", flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <Ico d={I.search} size={14} stroke="var(--text3)"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search rooms…"
            style={{ width: "100%", paddingLeft: 32, padding: "8px 10px 8px 32px",
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
              fontSize: 13, color: "var(--text)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <Btn variant="ghost" onClick={() => setShowFilters(v => !v)}
          style={{ gap: 5, position: "relative" }}>
          <Ico d={I.filter} size={14} />
          Filters
          {activeFilters > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
              background: "var(--accent,#2b7fe8)", color: "white" }}>{activeFilters}</span>
          )}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={() => setShowLabelMgr(true)}>
          <Ico d={I.tag} size={13} /> Labels
        </Btn>
      </div>

      {/* ── Filter bar ── */}
      {showFilters && (
        <div style={{ display: "flex", gap: 8, padding: "10px 20px", background: "var(--surface2)",
          borderBottom: "1px solid var(--border)", flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7,
              padding: "5px 8px", fontSize: 12, color: "var(--text)", outline: "none" }}>
            <option value="">All statuses</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7,
              padding: "5px 8px", fontSize: 12, color: "var(--text)", outline: "none" }}>
            <option value="">All labels</option>
            {allOrgLabels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12,
            color: "var(--text2)", cursor: "pointer" }}>
            <input type="checkbox" checked={filterOverdue} onChange={e => setFilterOverdue(e.target.checked)} />
            Has overdue tasks
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12,
            color: "var(--text2)", cursor: "pointer" }}>
            <input type="checkbox" checked={filterNoPhotos} onChange={e => setFilterNoPhotos(e.target.checked)} />
            No photos
          </label>
          {activeFilters > 0 && (
            <Btn variant="ghost" size="sm" onClick={() => {
              setFilterStatus(""); setFilterLabel(""); setFilterOverdue(false); setFilterNoPhotos(false);
            }}>Clear</Btn>
          )}
        </div>
      )}

      {/* ── Room grid ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {loadingData && rooms.length > 0 && (
          <div style={{ textAlign: "center", padding: 12, color: "var(--text3)", fontSize: 12.5,
            marginBottom: 12 }}>
            Loading room data…
          </div>
        )}

        {filteredRooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text3)" }}>
            <Ico d={I.door} size={40} stroke="var(--border)" />
            <div style={{ fontSize: 14, marginTop: 12, fontWeight: 600 }}>No rooms found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {search || activeFilters > 0 ? "Try adjusting your filters." : "Add rooms to this project to get started."}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))",
            gap: 14 }}>
            {filteredRooms.map(room => {
              const roomTasks = tasks.filter(t =>
                (t.room_id === room.id || t.roomId === room.id) &&
                (t.project_id === project?.id || t.projectId === project?.id)
              );
              return (
                <RoomCard key={room.id}
                  room={room}
                  dbRoom={dbRoomsMap[room.id]}
                  labels={labelsMap[room.id] || []}
                  roomTasks={roomTasks}
                  onOpen={setSelectedRoom}
                  onOpenCamera={onOpenCamera}
                />
              );
            })}
          </div>
        )}
      </div>

      {showLabelMgr && (
        <LabelManagerModal orgId={orgId} onClose={() => setShowLabelMgr(false)}
          currentLabels={allOrgLabels}
          onLabelsChange={setAllOrgLabels} />
      )}
      </>}
    </div>
  );
}

export default RoomsTab;
