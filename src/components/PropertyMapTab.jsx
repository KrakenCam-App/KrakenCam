/**
 * PropertyMapTab.jsx
 * Upload floor plans / site maps, place photo pins, sticky notes.
 * Pins & notes store x/y as percentages so they scale with any display size.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getAuthHeaders } from "../lib/supabase";

// ── Icons ─────────────────────────────────────────────────────────────────────
const ic = {
  upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  pin:      "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  close:    "M6 18L18 6M6 6l12 12",
  edit:     "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  plus:     "M12 5v14M5 12h14",
  layers:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  check:    "M5 13l4 4L19 7",
  zoom_in:  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7",
  zoom_out: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7",
  fit:      "M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  hand:     "M7 11.5V14m0-2.5v-6a1.5 1.5 0 013 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11",
  note:     "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

function Icon({ d, size = 18, stroke = "currentColor", fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display:"inline-block", verticalAlign:"middle", flexShrink:0 }}>
      <path d={d} />
    </svg>
  );
}

// ── Pin types ─────────────────────────────────────────────────────────────────
const BUILTIN_PIN_TYPES = [
  { value:"general",     label:"General",          color:"#60a5fa" },
  { value:"damage",      label:"Damage",            color:"#f87171" },
  { value:"issue",       label:"Issue",             color:"#fb923c" },
  { value:"inspection",  label:"Inspection Point",  color:"#fbbf24" },
  { value:"equipment",   label:"Equipment",         color:"#94a3b8" },
  { value:"work_area",   label:"Work Area",         color:"#34d399" },
  { value:"access",      label:"Access",            color:"#a78bfa" },
  { value:"hazard",      label:"Hazard",            color:"#ef4444" },
];

function pinColor(type, customPinTypes = []) {
  const b = BUILTIN_PIN_TYPES.find(p => p.value === type);
  if (b) return b.color;
  const c = customPinTypes.find(p => p.id === type);
  return c?.color || "#60a5fa";
}

function pinLabel(type, customPinTypes = []) {
  const b = BUILTIN_PIN_TYPES.find(p => p.value === type);
  if (b) return b.label;
  const c = customPinTypes.find(p => p.id === type);
  return c?.label || type;
}

const NOTE_COLORS = ["#fbbf24","#34d399","#f87171","#60a5fa","#a78bfa","#fb923c","#e879f9"];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── DB helpers ────────────────────────────────────────────────────────────────
async function fetchMaps(projectId) {
  const { data, error } = await supabase.from("project_maps").select("*")
    .eq("project_id", projectId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function fetchPins(mapId) {
  const { data, error } = await supabase.from("map_pins")
    .select("*, map_pin_photos(photo_id, sort_order)")
    .eq("map_id", mapId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function fetchNotes(mapId) {
  const { data, error } = await supabase.from("map_notes").select("*")
    .eq("map_id", mapId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function fetchCustomPinTypes(orgId) {
  const { data, error } = await supabase.from("map_custom_pin_types").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function createPin(d) {
  const { data, error } = await supabase.from("map_pins").insert(d).select().single();
  if (error) throw error; return data;
}
async function updatePin(id, patch) {
  const { data, error } = await supabase.from("map_pins").update(patch).eq("id", id).select().single();
  if (error) throw error; return data;
}
async function deletePin(id) {
  const { error } = await supabase.from("map_pins").delete().eq("id", id);
  if (error) throw error;
}
async function createNote(d) {
  const { data, error } = await supabase.from("map_notes").insert(d).select().single();
  if (error) throw error; return data;
}
async function updateNote(id, patch) {
  const { data, error } = await supabase.from("map_notes").update(patch).eq("id", id).select().single();
  if (error) throw error; return data;
}
async function deleteNote(id) {
  const { error } = await supabase.from("map_notes").delete().eq("id", id);
  if (error) throw error;
}
async function deleteMap(id, storagePath) {
  if (storagePath) await supabase.storage.from("project-photos").remove([storagePath]);
  const { error } = await supabase.from("project_maps").delete().eq("id", id);
  if (error) throw error;
}
async function attachPhotoToPin(pinId, photoId) {
  await supabase.from("map_pin_photos").upsert(
    { pin_id: pinId, photo_id: photoId, sort_order: 0 }, { onConflict: "pin_id,photo_id" }
  );
}
async function detachPhotoFromPin(pinId, photoId) {
  await supabase.from("map_pin_photos").delete().eq("pin_id", pinId).eq("photo_id", photoId);
}

// ── PDF → PNG blob (renders page 1 via pdf.js loaded from CDN) ───────────────
async function pdfToImageBlob(file) {
  const pdfjsLib = await new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("Failed to load pdf.js from CDN"));
    document.head.appendChild(s);
  });
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 }); // 2× for sharpness
  const canvas = document.createElement("canvas");
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Canvas toBlob failed")), "image/png"));
}

async function uploadMapImage(orgId, projectId, file) {
  // Convert PDF → PNG blob before uploading
  let uploadFile = file;
  let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  if (file.type === "application/pdf" || ext === "pdf") {
    uploadFile = await pdfToImageBlob(file);
    ext = "png";
  }
  const mapId = crypto.randomUUID ? crypto.randomUUID() : `map_${Date.now()}`;
  const path = `${orgId}/${projectId}/maps/${mapId}.${ext}`;
  const headers = await getAuthHeaders({ "Content-Type": "image/png", "x-upsert": "true" });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/project-photos/${path}`, {
    method: "POST", headers, body: uploadFile,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/project-photos/${path}`;
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: null, h: null });
    img.src = publicUrl;
  });
  return { path, publicUrl, dims };
}

// ── Canvas snapshot (exported for ReportCreator) ──────────────────────────────
export async function generateMapSnapshot(mapId, { width = 1200 } = {}) {
  const [mapRes, pinsRes, notesRes, typesRes] = await Promise.all([
    supabase.from("project_maps").select("*").eq("id", mapId).single(),
    supabase.from("map_pins").select("*").eq("map_id", mapId),
    supabase.from("map_notes").select("*").eq("map_id", mapId),
    supabase.from("map_custom_pin_types").select("*"),
  ]);
  const map   = mapRes.data;
  const pins  = pinsRes.data  || [];
  const notes = notesRes.data || [];
  const cTypes = typesRes.data || [];
  if (!map) throw new Error("Map not found");

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale  = width / img.naturalWidth;
      const height = img.naturalHeight * scale;
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, width, height);

      // Draw notes — measure text first so box height matches content
      for (const note of notes) {
        const nx = (note.x_percent / 100) * width;
        const ny = (note.y_percent / 100) * height;
        const fs = 10, lineH = fs + 4, padX = 7, padY = 6;
        const maxNoteW = 150; // match on-screen maxWidth
        ctx.font = `bold ${fs}px sans-serif`;

        // Word-wrap to lines
        const rawWords = (note.content || "").split(" ");
        const lines = [];
        let cur = "";
        for (const word of rawWords) {
          const test = cur ? cur + " " + word : word;
          if (ctx.measureText(test).width > maxNoteW - padX * 2 && cur) {
            lines.push(cur); cur = word;
          } else { cur = test; }
        }
        if (cur) lines.push(cur);
        if (!lines.length) lines.push("");

        const nw = maxNoteW;
        const nh = lines.length * lineH + padY * 2;

        ctx.fillStyle = note.color || "#fbbf24";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(nx, ny, nw, nh);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.82)";
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], nx + padX, ny + padY + fs + i * lineH);
        }
      }

      // Draw pins
      for (const pin of pins) {
        const px = (pin.x_percent / 100) * width;
        const py = (pin.y_percent / 100) * height;
        const color = pinColor(pin.pin_type, cTypes);
        const r = 10;
        ctx.beginPath();
        ctx.arc(px, py - r, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px, py - r); ctx.lineTo(px, py);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        if (pin.title) {
          ctx.font = "bold 9px sans-serif";
          const tw = ctx.measureText(pin.title).width;
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fillRect(px - tw/2 - 3, py - r*2 - 17, tw + 6, 14);
          ctx.fillStyle = "white";
          ctx.fillText(pin.title, px - tw/2, py - r*2 - 6);
        }
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = map.public_url;
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export function PropertyMapTab({ project, orgId, userId, onUpdateProject, settings }) {
  const [maps,            setMaps]            = useState([]);
  const [activeMapId,     setActiveMapId]     = useState(null);
  const [pins,            setPins]            = useState([]);
  const [notes,           setNotes]           = useState([]);
  const [customPinTypes,  setCustomPinTypes]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [uploading,       setUploading]       = useState(false);
  const [activeTool,      setActiveTool]      = useState("pan"); // "pan"|"pin"|"note"
  const [editingPin,      setEditingPin]      = useState(null);
  const [editingNote,     setEditingNote]     = useState(null);
  const [confirmDel,      setConfirmDel]      = useState(null);
  const [filterType,      setFilterType]      = useState("all");
  const [zoom,            setZoom]            = useState(1);
  const [pan,             setPan]             = useState({ x: 0, y: 0 });
  const [panDragging,     setPanDragging]     = useState(false);
  const [panStart,        setPanStart]        = useState(null);
  const [showCustomTypes, setShowCustomTypes] = useState(false);
  const [showSketchPicker, setShowSketchPicker] = useState(false);
  const [editingTitle,    setEditingTitle]    = useState(false);
  const [titleDraft,      setTitleDraft]      = useState("");
  const [draggingPin,     setDraggingPin]     = useState(null);
  const [draggingNote,    setDraggingNote]    = useState(null);
  const [isMobile,        setIsMobile]        = useState(() => window.innerWidth < 768);
  const [showPinsList,    setShowPinsList]    = useState(false);

  const fileRef       = useRef(null);
  const mapRef        = useRef(null);
  const containerRef  = useRef(null);
  const titleInputRef = useRef(null);
  const pinDragTimer  = useRef(null);
  const pinDragActive = useRef(false);
  const noteDragTimer = useRef(null);
  const noteDragActive = useRef(false);

  const activeMap = maps.find(m => m.id === activeMapId) || null;
  const photos    = project.photos || [];

  // ── Load maps ──
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setLoading(true);
    fetchMaps(project.id)
      .then(data => {
        if (cancelled) return;
        setMaps(data);
        if (data.length > 0) setActiveMapId(prev => prev || data[0].id);
      })
      .catch(e => { if (!cancelled) console.error("[PropertyMap] fetchMaps:", e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]);

  // ── Load custom pin types ──
  useEffect(() => {
    if (!orgId) return;
    fetchCustomPinTypes(orgId).then(setCustomPinTypes).catch(() => {});
  }, [orgId]);

  // ── Load pins + notes when map changes ──
  useEffect(() => {
    if (!activeMapId) { setPins([]); setNotes([]); return; }
    fetchPins(activeMapId).then(setPins).catch(e => console.warn("[PropertyMap] fetchPins:", e.message));
    fetchNotes(activeMapId).then(setNotes).catch(e => console.warn("[PropertyMap] fetchNotes:", e.message));
  }, [activeMapId]);

  // ── Reset zoom/pan on map switch ──
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [activeMapId]);

  // ── Mobile breakpoint (resize-aware) ──
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // ── Wheel zoom (passive:false) ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const fitToScreen = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Upload ──
  const handleMapUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !orgId || !project?.id) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!file.type.startsWith("image/") && !isPdf) { alert("Please upload a JPG, PNG, WEBP, or PDF file."); return; }
    setUploading(true);
    try {
      const { path, publicUrl, dims } = await uploadMapImage(orgId, project.id, file);
      const mapTitle = file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim() || "Floor Plan";
      const { data, error } = await supabase.from("project_maps").insert({
        organization_id: orgId, project_id: project.id, title: mapTitle,
        storage_path: path, public_url: publicUrl,
        map_width: dims.w, map_height: dims.h, created_by: userId || null,
      }).select().single();
      if (error) throw error;
      setMaps(prev => [...prev, data]);
      setActiveMapId(data.id);
    } catch (err) {
      console.error("[PropertyMap] upload:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Map rename ──
  const startRename = () => {
    if (!activeMap) return;
    setTitleDraft(activeMap.title || "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 40);
  };
  const commitRename = async () => {
    const t = titleDraft.trim();
    if (t && t !== activeMap?.title) {
      try {
        await supabase.from("project_maps").update({ title: t }).eq("id", activeMapId);
        setMaps(prev => prev.map(m => m.id === activeMapId ? { ...m, title: t } : m));
      } catch (err) { console.error("[PropertyMap] rename:", err); }
    }
    setEditingTitle(false);
  };

  // ── Map click: place pin or note ──
  const handleMapClick = useCallback((e) => {
    if (!activeMap || activeTool === "pan" || panDragging || justDraggedRef.current) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100));
    if (activeTool === "pin") {
      setEditingPin({ _new:true, map_id:activeMap.id, organization_id:orgId, project_id:project.id,
        x_percent:x, y_percent:y, title:"", floor:"", location:"", notes:"", pin_type:"general", photo_ids:[] });
      setActiveTool("pan");
    } else if (activeTool === "note") {
      setEditingNote({ _new:true, map_id:activeMap.id, organization_id:orgId, project_id:project.id,
        x_percent:x, y_percent:y, content:"", color:"#fbbf24" });
      setActiveTool("pan");
    }
  }, [activeTool, activeMap, panDragging, orgId, project?.id]);

  // ── Pan (mouse) ──
  const handlePanDown = (e) => {
    if (activeTool !== "pan" || e.button !== 0) return;
    setPanDragging(false);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handlePanMove = (e) => {
    if (!panStart) return;
    const dx = Math.abs(e.clientX - panStart.x - pan.x);
    const dy = Math.abs(e.clientY - panStart.y - pan.y);
    if (dx > 3 || dy > 3) setPanDragging(true);
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handlePanUp = () => { setPanStart(null); setTimeout(() => setPanDragging(false), 50); };

  // ref to suppress spurious map click immediately after a drag finishes
  const justDraggedRef = useRef(false);

  // ── Pin drag ──
  const startPinDrag = (e, pin) => {
    e.stopPropagation();
    pinDragActive.current = false;
    pinDragTimer.current = setTimeout(() => {
      pinDragActive.current = true;
      setDraggingPin({ pinId: pin.id });
    }, 400);
  };
  const endPinDrag = (e, pin) => {
    clearTimeout(pinDragTimer.current);
    if (!pinDragActive.current && !draggingPin) {
      // Simple click — open editor, stop bubbling so map click doesn't fire
      e.stopPropagation();
      setEditingPin({ ...pin, photo_ids: (pin.map_pin_photos || []).map(pp => pp.photo_id) });
    }
    // When a drag was active let event bubble to handleMapMouseUp so it can save & clear state
  };

  // ── Note drag ──
  const startNoteDrag = (e, note) => {
    e.stopPropagation();
    noteDragActive.current = false;
    noteDragTimer.current = setTimeout(() => {
      noteDragActive.current = true;
      setDraggingNote({ noteId: note.id });
    }, 400);
  };
  const endNoteDrag = (e, note) => {
    clearTimeout(noteDragTimer.current);
    if (!noteDragActive.current && !draggingNote) {
      e.stopPropagation();
      setEditingNote({ ...note });
    }
    // When drag was active let it bubble to handleMapMouseUp
  };

  // ── Combined map mouse move / up ──
  const handleMapMouseMove = (e) => {
    if (draggingPin) {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100));
      setPins(prev => prev.map(p => p.id === draggingPin.pinId ? { ...p, x_percent:x, y_percent:y } : p));
    } else if (draggingNote) {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100));
      setNotes(prev => prev.map(n => n.id === draggingNote.noteId ? { ...n, x_percent:x, y_percent:y } : n));
    } else {
      handlePanMove(e);
    }
  };

  const handleMapMouseUp = async (e) => {
    if (draggingPin) {
      clearTimeout(pinDragTimer.current);
      const pin = pins.find(p => p.id === draggingPin.pinId);
      if (pin) {
        try { await updatePin(pin.id, { x_percent: pin.x_percent, y_percent: pin.y_percent }); }
        catch(err) { console.error("[PropertyMap] pin drag save:", err); }
      }
      setDraggingPin(null); pinDragActive.current = false;
      justDraggedRef.current = true; setTimeout(() => { justDraggedRef.current = false; }, 120);
      return;
    }
    if (draggingNote) {
      clearTimeout(noteDragTimer.current);
      const note = notes.find(n => n.id === draggingNote.noteId);
      if (note) {
        try { await updateNote(note.id, { x_percent: note.x_percent, y_percent: note.y_percent }); }
        catch(err) { console.error("[PropertyMap] note drag save:", err); }
      }
      setDraggingNote(null); noteDragActive.current = false;
      justDraggedRef.current = true; setTimeout(() => { justDraggedRef.current = false; }, 120);
      return;
    }
    handlePanUp();
  };

  // ── Touch drag support ──
  const handleMapTouchMove = (e) => {
    const t = e.touches[0]; if (!t) return;
    const rect = mapRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = Math.min(100, Math.max(0, ((t.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(100, Math.max(0, ((t.clientY - rect.top)  / rect.height) * 100));
    if (draggingPin)
      setPins(prev => prev.map(p => p.id === draggingPin.pinId ? { ...p, x_percent:x, y_percent:y } : p));
    else if (draggingNote)
      setNotes(prev => prev.map(n => n.id === draggingNote.noteId ? { ...n, x_percent:x, y_percent:y } : n));
  };
  const handleMapTouchEnd = async () => {
    if (draggingPin) {
      clearTimeout(pinDragTimer.current);
      const pin = pins.find(p => p.id === draggingPin.pinId);
      if (pin) { try { await updatePin(pin.id, { x_percent: pin.x_percent, y_percent: pin.y_percent }); } catch(e){} }
      setDraggingPin(null); pinDragActive.current = false; return;
    }
    if (draggingNote) {
      clearTimeout(noteDragTimer.current);
      const note = notes.find(n => n.id === draggingNote.noteId);
      if (note) { try { await updateNote(note.id, { x_percent: note.x_percent, y_percent: note.y_percent }); } catch(e){} }
      setDraggingNote(null); noteDragActive.current = false;
    }
  };

  // ── Save pin ──
  const savePin = async (pinData) => {
    try {
      if (pinData._new) {
        const { _new, photo_ids, ...insert } = pinData;
        const created = await createPin({ ...insert, created_by: userId || null });
        for (const pid of (photo_ids || [])) await attachPhotoToPin(created.id, pid);
        setPins(await fetchPins(activeMapId));
      } else {
        const { _new, photo_ids, map_pin_photos: _, id, ...patch } = pinData;
        await updatePin(id, patch);
        const existing = (pins.find(p => p.id === id)?.map_pin_photos || []).map(pp => pp.photo_id);
        for (const pid of (photo_ids||[]).filter(pid => !existing.includes(pid))) await attachPhotoToPin(id, pid);
        for (const pid of existing.filter(pid => !(photo_ids||[]).includes(pid))) await detachPhotoFromPin(id, pid);
        setPins(await fetchPins(activeMapId));
      }
    } catch (err) { console.error("[PropertyMap] savePin:", err); alert("Failed to save pin: " + err.message); }
    finally { setEditingPin(null); }
  };

  // ── Save note ──
  const saveNote = async (noteData) => {
    try {
      if (noteData._new) {
        const { _new, ...insert } = noteData;
        const created = await createNote({ ...insert, created_by: userId || null });
        setNotes(prev => [...prev, created]);
      } else {
        const { _new, id, created_at, created_by, ...patch } = noteData;
        await updateNote(id, patch);
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
      }
    } catch (err) { console.error("[PropertyMap] saveNote:", err); alert("Failed to save note: " + err.message); }
    finally { setEditingNote(null); }
  };

  // ── Delete handlers ──
  const handleDeletePin = async () => {
    if (!confirmDel || confirmDel.type !== "pin") return;
    try { await deletePin(confirmDel.id); setPins(prev => prev.filter(p => p.id !== confirmDel.id)); }
    catch(err) { alert("Failed to delete pin: " + err.message); }
    setConfirmDel(null);
  };
  const handleDeleteNote = async () => {
    if (!confirmDel || confirmDel.type !== "note") return;
    try { await deleteNote(confirmDel.id); setNotes(prev => prev.filter(n => n.id !== confirmDel.id)); }
    catch(err) { alert("Failed to delete note: " + err.message); }
    setConfirmDel(null);
  };
  const handleDeleteMap = async () => {
    if (!confirmDel || confirmDel.type !== "map") return;
    try {
      await deleteMap(confirmDel.id, confirmDel.storagePath);
      setMaps(prev => { const next = prev.filter(m => m.id !== confirmDel.id); setActiveMapId(next[0]?.id || null); return next; });
      setPins([]); setNotes([]);
    } catch(err) { alert("Failed to delete map: " + err.message); }
    setConfirmDel(null);
  };

  // ── Import sketch as map ──
  const handleImportSketch = async (sketch) => {
    if (!sketch || !orgId || !project?.id) return;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/project-photos/${sketch.storage_path}`;
    // Get image dimensions
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: null, h: null });
      img.src = publicUrl;
    });
    try {
      const { data, error } = await supabase.from("project_maps").insert({
        organization_id: orgId,
        project_id: project.id,
        title: sketch.title || "Sketch Map",
        // storage_path omitted → DB default '' so deleteMap won't try to delete the sketch file
        public_url: publicUrl,
        map_width: dims.w,
        map_height: dims.h,
        created_by: userId || null,
      }).select().single();
      if (error) throw error;
      setMaps(prev => [...prev, data]);
      setActiveMapId(data.id);
    } catch(err) {
      console.error("[PropertyMap] importSketch:", err);
      alert("Failed to import sketch: " + err.message);
    }
    setShowSketchPicker(false);
  };

  // ── Download ──
  const handleDownload = async () => {
    if (!activeMap) return;
    try {
      const dataUrl = await generateMapSnapshot(activeMapId);
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `${activeMap.title || "map"}.png`; a.click();
    } catch(err) { console.error("[PropertyMap] download:", err); alert("Download failed: " + err.message); }
  };

  const visiblePins = filterType === "all" ? pins : pins.filter(p => p.pin_type === filterType);
  const allPinTypes = [...BUILTIN_PIN_TYPES, ...customPinTypes.map(c => ({ value:c.id, label:c.label, color:c.color }))];
  const mapCursor = activeTool === "pin" ? "crosshair" : activeTool === "note" ? "cell"
    : draggingPin || draggingNote ? "grabbing" : panDragging ? "grabbing" : "grab";

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding:32, textAlign:"center", color:"var(--text2)", fontSize:13 }}>Loading maps…</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, height:"100%", minHeight:500 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 0 14px", flexWrap:"wrap" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", flex:1 }}>🗺️ Property Maps</div>
        {maps.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", width: isMobile ? "100%" : "auto" }}>
            {maps.map(m => (
              <button key={m.id} onClick={() => setActiveMapId(m.id)} style={{
                padding:"5px 12px", borderRadius:16, fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0,
                border: activeMapId === m.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: activeMapId === m.id ? "rgba(0,212,255,.1)" : "var(--surface2)",
                color: activeMapId === m.id ? "var(--accent)" : "var(--text2)",
              }}>{m.title}</button>
            ))}
          </div>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "⏳ Uploading…" : <><Icon d={ic.upload} size={13} /> Upload Map</>}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSketchPicker(true)} title="Import a sketch as a map">
          ✏️ From Sketch
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display:"none" }} onChange={handleMapUpload} />
      </div>

      {/* No maps */}
      {maps.length === 0 && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:40, background:"var(--surface2)", borderRadius:12, border:"2px dashed var(--border)" }}>
          <Icon d={ic.layers} size={40} stroke="var(--text3)" />
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>No maps uploaded yet</div>
          <div style={{ fontSize:13, color:"var(--text2)", textAlign:"center", maxWidth:340, lineHeight:1.6 }}>
            Upload a floor plan, site map, or plot plan (JPG, PNG, WEBP, or PDF) to start placing photo pins.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Icon d={ic.upload} size={14} /> {uploading ? "Uploading…" : "Upload Floor Plan"}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSketchPicker(true)}>
              ✏️ Import from Sketch
            </button>
          </div>
        </div>
      )}

      {/* Map viewer */}
      {activeMap && (
        <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 14, flex:1, minHeight:0 }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

            {/* Map title + rename */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              {editingTitle ? (
                <input ref={titleInputRef} value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key==="Enter") commitRename(); if (e.key==="Escape") setEditingTitle(false); }}
                  style={{ fontSize:15, fontWeight:700, background:"var(--surface2)", border:"1px solid var(--accent)", borderRadius:6, color:"var(--text)", padding:"4px 10px", flex:1 }} />
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>{activeMap.title}</span>
                  <button onClick={startRename} title="Rename map"
                    style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:2 }}>
                    <Icon d={ic.edit} size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
              {/* Tool buttons */}
              {[
                { tool:"pan",  icon:ic.hand, label:"Hand" },
                { tool:"pin",  icon:ic.pin,  label:"Place Pin" },
                { tool:"note", icon:ic.note, label:"Add Note" },
              ].map(({ tool, icon, label }) => (
                <button key={tool} onClick={() => setActiveTool(tool)} title={label} style={{
                  padding:"6px 11px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:4,
                  border: activeTool===tool ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: activeTool===tool ? "rgba(0,212,255,.15)" : "var(--surface2)",
                  color: activeTool===tool ? "var(--accent)" : "var(--text2)",
                }}>
                  <Icon d={icon} size={13} /> {label}
                </button>
              ))}

              <div style={{ display:"flex", gap:4, marginLeft:4 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setZoom(z => Math.min(5, z+0.25))} title="Zoom in"><Icon d={ic.zoom_in} size={14} /></button>
                <button className="btn btn-secondary btn-sm" onClick={() => setZoom(z => Math.max(0.3, z-0.25))} title="Zoom out"><Icon d={ic.zoom_out} size={14} /></button>
                <button className="btn btn-secondary btn-sm" onClick={fitToScreen} title="Fit"><Icon d={ic.fit} size={14} /></button>
              </div>
              <span style={{ fontSize:12, color:"var(--text3)" }}>{Math.round(zoom*100)}%</span>

              <button className="btn btn-secondary btn-sm" onClick={handleDownload} title="Download as PNG" style={{ marginLeft:4 }}>
                <Icon d={ic.download} size={13} /> Download
              </button>

              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ marginLeft: isMobile ? 0 : "auto", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text)", fontSize:12, padding:"5px 8px" }}>
                <option value="all">All pins ({pins.length})</option>
                {allPinTypes.map(t => {
                  const cnt = pins.filter(p => p.pin_type===t.value).length;
                  if (!cnt) return null;
                  return <option key={t.value} value={t.value}>{t.label} ({cnt})</option>;
                })}
              </select>

              <button className="btn btn-sm" onClick={() => setShowCustomTypes(true)} title="Custom pin types"
                style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text2)" }}>
                <Icon d={ic.settings} size={13} />
              </button>

              <button className="btn btn-sm"
                style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", color:"#f87171" }}
                onClick={() => setConfirmDel({ type:"map", id:activeMap.id, storagePath:activeMap.storage_path })}>
                <Icon d={ic.trash} size={13} /> Delete Map
              </button>
            </div>

            {/* Tool hint */}
            {activeTool !== "pan" && (
              <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600, marginBottom:6, padding:"4px 8px", background:"rgba(0,212,255,.08)", borderRadius:6 }}>
                {activeTool==="pin" ? "📍 Click on the map to place a pin" : "📝 Click on the map to place a note"}
              </div>
            )}

            {/* Map container */}
            <div ref={containerRef}
              style={{ flex:1, overflow:"hidden", borderRadius:10, border:"1px solid var(--border)", background:"#111", cursor:mapCursor, position:"relative", minHeight:340 }}>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div ref={mapRef}
                  onClick={handleMapClick}
                  onMouseDown={handlePanDown}
                  onMouseMove={handleMapMouseMove}
                  onMouseUp={handleMapMouseUp}
                  onMouseLeave={handleMapMouseUp}
                  onTouchMove={handleMapTouchMove}
                  onTouchEnd={handleMapTouchEnd}
                  style={{
                    position:"relative",
                    transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                    transformOrigin:"center center",
                    userSelect:"none", maxWidth:"100%", maxHeight:"100%",
                  }}>
                  <img src={activeMap.public_url} alt={activeMap.title}
                    style={{ display:"block", maxWidth: isMobile ? "95vw" : "80vw", maxHeight: isMobile ? "52vw" : "60vh", objectFit:"contain", borderRadius:6, pointerEvents:"none" }}
                    draggable={false} />

                  {/* Notes */}
                  {notes.map(note => (
                    <div key={note.id}
                      onMouseDown={(e) => startNoteDrag(e, note)}
                      onMouseUp={(e) => endNoteDrag(e, note)}
                      onTouchStart={(e) => {
                        e.stopPropagation(); noteDragActive.current = false;
                        const t = e.touches[0];
                        noteDragTimer.current = setTimeout(() => {
                          noteDragActive.current = true; setDraggingNote({ noteId: note.id });
                        }, 400);
                      }}
                      onTouchEnd={(e) => {
                        clearTimeout(noteDragTimer.current);
                        if (!noteDragActive.current && !draggingNote) {
                          e.stopPropagation();
                          setEditingNote({ ...note });
                        }
                        // drag release bubbles to handleMapTouchEnd
                      }}
                      style={{
                        position:"absolute", left:`${note.x_percent}%`, top:`${note.y_percent}%`,
                        zIndex:8, cursor: draggingNote?.noteId===note.id ? "grabbing" : "grab",
                        minWidth:90, maxWidth:150, padding:"5px 7px",
                        background: note.color || "#fbbf24",
                        borderRadius:5, boxShadow:"0 2px 8px rgba(0,0,0,.45)",
                      }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"rgba(0,0,0,.8)", lineHeight:1.4, wordBreak:"break-word" }}>
                        {note.content || <em style={{ opacity:.6 }}>Empty note</em>}
                      </div>
                    </div>
                  ))}

                  {/* Pins */}
                  {visiblePins.map(pin => (
                    <div key={pin.id}
                      onMouseDown={(e) => startPinDrag(e, pin)}
                      onMouseUp={(e) => endPinDrag(e, pin)}
                      onTouchStart={(e) => {
                        e.stopPropagation(); pinDragActive.current = false;
                        const t = e.touches[0];
                        pinDragTimer.current = setTimeout(() => {
                          pinDragActive.current = true; setDraggingPin({ pinId: pin.id });
                        }, 400);
                      }}
                      onTouchEnd={(e) => {
                        clearTimeout(pinDragTimer.current);
                        if (!pinDragActive.current && !draggingPin) {
                          e.stopPropagation();
                          setEditingPin({ ...pin, photo_ids:(pin.map_pin_photos||[]).map(pp=>pp.photo_id) });
                        }
                        // drag release bubbles to handleMapTouchEnd
                      }}
                      title={pin.title || pin.pin_type}
                      style={{
                        position:"absolute", left:`${pin.x_percent}%`, top:`${pin.y_percent}%`,
                        transform:"translate(-50%,-100%)",
                        cursor: draggingPin?.pinId===pin.id ? "grabbing" : "pointer",
                        zIndex:10, display:"flex", flexDirection:"column", alignItems:"center",
                      }}>
                      {pin.title && (
                        <div style={{
                          background:"rgba(0,0,0,.82)", color:"white", fontSize:9, fontWeight:700,
                          padding:"2px 5px", borderRadius:4, marginBottom:2, whiteSpace:"nowrap",
                          maxWidth:80, overflow:"hidden", textOverflow:"ellipsis",
                        }}>{pin.title}</div>
                      )}
                      <div style={{
                        width:22, height:22, borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)",
                        background:pinColor(pin.pin_type, customPinTypes),
                        border:"2px solid white", boxShadow:"0 2px 6px rgba(0,0,0,.5)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {(pin.map_pin_photos?.length > 0) && (
                          <div style={{ transform:"rotate(45deg)", fontSize:7, color:"white", fontWeight:700 }}>
                            {pin.map_pin_photos.length}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile — collapsible pins & notes list */}
            {isMobile && (
              <div style={{ marginTop:8 }}>
                <button onClick={() => setShowPinsList(v => !v)}
                  style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, cursor:"pointer", fontSize:12.5, fontWeight:700, color:"var(--text)", textAlign:"left" }}>
                  <span>Pins &amp; Notes ({visiblePins.length + notes.length})</span>
                  <span style={{ fontSize:11, color:"var(--text3)" }}>{showPinsList ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showPinsList && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6, maxHeight:220, overflowY:"auto" }}>
                    {visiblePins.length === 0 && (
                      <div style={{ fontSize:12, color:"var(--text3)", padding:"6px 0" }}>
                        {pins.length === 0 ? "Select \"Place Pin\" then tap the map." : "No pins match the filter."}
                      </div>
                    )}
                    {visiblePins.map(pin => (
                      <div key={pin.id} onClick={() => setEditingPin({ ...pin, photo_ids:(pin.map_pin_photos||[]).map(pp=>pp.photo_id) })}
                        style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderLeft:`3px solid ${pinColor(pin.pin_type, customPinTypes)}`, borderRadius:8, padding:"8px 10px", cursor:"pointer" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.title || "Untitled pin"}</div>
                        <div style={{ fontSize:11, color:"var(--text3)" }}>{pinLabel(pin.pin_type, customPinTypes)}{pin.map_pin_photos?.length > 0 && ` · ${pin.map_pin_photos.length} photo${pin.map_pin_photos.length!==1?"s":""}`}</div>
                      </div>
                    ))}
                    {notes.length > 0 && (
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:.5, marginTop:4 }}>Notes ({notes.length})</div>
                    )}
                    {notes.map(note => (
                      <div key={note.id} onClick={() => setEditingNote({ ...note })}
                        style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderLeft:`3px solid ${note.color||"#fbbf24"}`, borderRadius:8, padding:"7px 10px", cursor:"pointer" }}>
                        <div style={{ fontSize:11, color:"var(--text)", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                          {note.content || <em style={{ color:"var(--text3)" }}>Empty note</em>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — desktop only */}
          {!isMobile && <div style={{ width:210, flexShrink:0, display:"flex", flexDirection:"column", gap:6, overflowY:"auto", maxHeight:"70vh" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:.5 }}>
              Pins ({visiblePins.length})
            </div>
            {visiblePins.length === 0 && (
              <div style={{ fontSize:12, color:"var(--text3)", lineHeight:1.6 }}>
                {pins.length === 0 ? "Select \"Place Pin\" then click the map." : "No pins match the filter."}
              </div>
            )}
            {visiblePins.map(pin => (
              <div key={pin.id}
                onClick={() => setEditingPin({ ...pin, photo_ids:(pin.map_pin_photos||[]).map(pp=>pp.photo_id) })}
                style={{
                  background:"var(--surface2)", border:"1px solid var(--border)",
                  borderLeft:`3px solid ${pinColor(pin.pin_type, customPinTypes)}`,
                  borderRadius:8, padding:"8px 10px", cursor:"pointer",
                }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {pin.title || "Untitled pin"}
                </div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>
                  {pinLabel(pin.pin_type, customPinTypes)}
                  {pin.map_pin_photos?.length > 0 && ` · ${pin.map_pin_photos.length} photo${pin.map_pin_photos.length!==1?"s":""}`}
                </div>
                {pin.location && <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{pin.location}</div>}
              </div>
            ))}

            {notes.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:.5, marginTop:8 }}>
                  Notes ({notes.length})
                </div>
                {notes.map(note => (
                  <div key={note.id} onClick={() => setEditingNote({ ...note })}
                    style={{
                      background:"var(--surface2)", border:"1px solid var(--border)",
                      borderLeft:`3px solid ${note.color||"#fbbf24"}`,
                      borderRadius:8, padding:"7px 10px", cursor:"pointer",
                    }}>
                    <div style={{ fontSize:11, color:"var(--text)", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis",
                      display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                      {note.content || <em style={{ color:"var(--text3)" }}>Empty note</em>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>}
        </div>
      )}

      {/* Modals */}
      {editingPin && (
        <PinEditModal pin={editingPin} photos={photos} allPinTypes={allPinTypes} onSave={savePin}
          onDelete={editingPin._new ? null : () => { setEditingPin(null); setConfirmDel({ type:"pin", id:editingPin.id }); }}
          onClose={() => setEditingPin(null)} />
      )}
      {editingNote && (
        <NoteEditModal note={editingNote} onSave={saveNote}
          onDelete={editingNote._new ? null : () => { setEditingNote(null); setConfirmDel({ type:"note", id:editingNote.id }); }}
          onClose={() => setEditingNote(null)} />
      )}
      {showCustomTypes && (
        <CustomTypeModal orgId={orgId} userId={userId} customPinTypes={customPinTypes}
          setCustomPinTypes={setCustomPinTypes} onClose={() => setShowCustomTypes(false)} />
      )}
      {showSketchPicker && (
        <SketchPickerModal projectId={project?.id} onSelect={handleImportSketch}
          onClose={() => setShowSketchPicker(false)} />
      )}
      {confirmDel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 20px" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"26px 24px", width:"100%", maxWidth:360 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:8 }}>
              {confirmDel.type==="map" ? "Delete this map?" : confirmDel.type==="note" ? "Delete this note?" : "Delete this pin?"}
            </div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20, lineHeight:1.6 }}>
              {confirmDel.type==="map" ? "This will permanently delete the map and all its pins and notes." :
               confirmDel.type==="note" ? "This note will be permanently deleted." :
               "This pin and its photo links will be permanently deleted."}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn" style={{ flex:1, background:"#e85a3a", color:"white", border:"none" }}
                onClick={confirmDel.type==="map" ? handleDeleteMap : confirmDel.type==="note" ? handleDeleteNote : handleDeletePin}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pin edit modal ────────────────────────────────────────────────────────────
function PinEditModal({ pin, photos, allPinTypes, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...pin, photo_ids: pin.photo_ids || [] });
  const [saving, setSaving] = useState(false);
  const [photoSearch, setPhotoSearch] = useState("");
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const togglePhoto = (id) => setForm(prev => ({
    ...prev, photo_ids: prev.photo_ids.includes(id) ? prev.photo_ids.filter(x=>x!==id) : [...prev.photo_ids, id],
  }));

  const filteredPhotos = photos.filter(p => {
    if (!photoSearch.trim()) return true;
    const q = photoSearch.toLowerCase();
    return (p.name||"").toLowerCase().includes(q) || (p.room||"").toLowerCase().includes(q) || (p.tags||[]).some(t=>t.toLowerCase().includes(q));
  });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 10px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"16px 16px 0 0", padding:"22px 20px", width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>{pin._new ? "📍 New Pin" : "✏️ Edit Pin"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }}><Icon d={ic.close} size={18} /></button>
        </div>

        <div style={{ marginBottom:12 }}>
          <div className="form-label">Pin Type</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {allPinTypes.map(t => (
              <button key={t.value} onClick={() => set("pin_type", t.value)} style={{
                padding:"4px 10px", borderRadius:14, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${form.pin_type===t.value ? t.color : "var(--border)"}`,
                background: form.pin_type===t.value ? `${t.color}22` : "var(--surface2)",
                color: form.pin_type===t.value ? t.color : "var(--text2)",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <div className="form-label">Title</div>
          <input className="form-input" placeholder="e.g. Moisture damage north wall" value={form.title}
            onChange={e => set("title", e.target.value)} autoFocus={!!pin._new} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <div className="form-label">Floor</div>
            <input className="form-input" placeholder="Main Floor" value={form.floor||""}
              onChange={e => set("floor", e.target.value)} list="pin-floor-opts" />
            <datalist id="pin-floor-opts">
              {["Basement","Lower Level","Main Floor","Second Floor","Third Floor","Attic","Roof","Exterior"].map(f => <option key={f} value={f} />)}
            </datalist>
          </div>
          <div>
            <div className="form-label">Room / Location</div>
            <input className="form-input" placeholder="Kitchen, Bedroom 2…" value={form.location||""}
              onChange={e => set("location", e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div className="form-label">Notes</div>
          <textarea className="form-input form-textarea" placeholder="Describe what was found here…"
            value={form.notes||""} onChange={e => set("notes", e.target.value)} style={{ minHeight:72 }} />
        </div>

        <div style={{ marginBottom:16 }}>
          <div className="form-label" style={{ marginBottom:6 }}>Attach Photos ({form.photo_ids.length} selected)</div>
          {photos.length > 0 ? (
            <>
              <input className="form-input" placeholder="Search photos…" value={photoSearch}
                onChange={e => setPhotoSearch(e.target.value)} style={{ marginBottom:8 }} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))", gap:6, maxHeight:160, overflowY:"auto" }}>
                {filteredPhotos.map(p => {
                  const sel = form.photo_ids.includes(p.id);
                  return (
                    <div key={p.id} onClick={() => togglePhoto(p.id)} style={{
                      position:"relative", cursor:"pointer", borderRadius:6,
                      border:`2px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      overflow:"hidden", aspectRatio:"1",
                    }}>
                      <img src={p.public_url||p.dataUrl} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      {sel && <div style={{ position:"absolute", inset:0, background:"rgba(0,212,255,.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Icon d={ic.check} size={16} stroke="white" />
                      </div>}
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,.65)", fontSize:8, color:"white", padding:"2px 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {p.name||p.room}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <div style={{ fontSize:12, color:"var(--text3)" }}>No photos in this project yet.</div>}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {onDelete && <button onClick={onDelete}
            style={{ padding:"9px 14px", borderRadius:8, border:"1px solid rgba(239,68,68,.4)", background:"rgba(239,68,68,.1)", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <Icon d={ic.trash} size={13} /> Delete Pin
          </button>}
          <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2 }} disabled={saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}>
            {saving ? "⏳ Saving…" : <><Icon d={ic.check} size={14} /> {pin._new ? "Place Pin" : "Save Changes"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Note edit modal ───────────────────────────────────────────────────────────
function NoteEditModal({ note, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...note });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 10px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"16px 16px 0 0", padding:"22px 20px", width:"100%", maxWidth:460, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>{note._new ? "📝 New Note" : "✏️ Edit Note"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }}><Icon d={ic.close} size={18} /></button>
        </div>

        <div style={{ marginBottom:12 }}>
          <div className="form-label">Color</div>
          <div style={{ display:"flex", gap:8 }}>
            {NOTE_COLORS.map(c => (
              <button key={c} onClick={() => set("color", c)} style={{
                width:28, height:28, borderRadius:"50%", background:c, border:"none", cursor:"pointer",
                outline: form.color===c ? "2px solid white" : "none", outlineOffset:2,
                boxShadow: form.color===c ? "0 0 0 3px rgba(255,255,255,.25)" : "none",
              }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div className="form-label">Note Text</div>
          <textarea className="form-input form-textarea" placeholder="Write your note here…"
            value={form.content||""} onChange={e => set("content", e.target.value)}
            style={{ minHeight:100, background:`${form.color||"#fbbf24"}18` }} autoFocus />
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {onDelete && <button onClick={onDelete}
            style={{ padding:"9px 14px", borderRadius:8, border:"1px solid rgba(239,68,68,.4)", background:"rgba(239,68,68,.1)", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <Icon d={ic.trash} size={13} /> Delete Note
          </button>}
          <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2 }} disabled={saving}
            onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}>
            {saving ? "⏳ Saving…" : <><Icon d={ic.check} size={14} /> {note._new ? "Place Note" : "Save Changes"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom pin type manager ───────────────────────────────────────────────────
function CustomTypeModal({ orgId, userId, customPinTypes, setCustomPinTypes, onClose }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#60a5fa");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const PRESET = ["#60a5fa","#f87171","#34d399","#fbbf24","#a78bfa","#fb923c","#e879f9","#22d3ee","#f43f5e","#84cc16"];

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("map_custom_pin_types")
        .insert({ organization_id:orgId, label:newLabel.trim(), color:newColor, created_by:userId||null })
        .select().single();
      if (error) throw error;
      setCustomPinTypes(prev => [...prev, data]);
      setNewLabel("");
    } catch(err) { alert("Failed to add: " + err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await supabase.from("map_custom_pin_types").delete().eq("id", id); setCustomPinTypes(prev => prev.filter(t => t.id!==id)); }
    catch(err) { alert("Failed to delete: " + err.message); }
    setDeleting(null);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 20px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"24px 22px", width:"100%", maxWidth:400, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>⚙️ Custom Pin Types</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }}><Icon d={ic.close} size={18} /></button>
        </div>

        {customPinTypes.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
            {customPinTypes.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, background:"var(--surface2)", borderRadius:8, padding:"8px 12px" }}>
                <div style={{ width:14, height:14, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                <div style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text)" }}>{t.label}</div>
                <button onClick={() => handleDelete(t.id)} disabled={deleting===t.id}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", opacity:deleting===t.id?.5:1 }}>
                  <Icon d={ic.trash} size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize:13, color:"var(--text3)", marginBottom:16 }}>No custom types yet.</div>}

        <div style={{ fontSize:13, fontWeight:700, color:"var(--text2)", marginBottom:8 }}>Add Custom Type</div>
        <input className="form-input" placeholder="Type name…" value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter") handleAdd(); }}
          style={{ marginBottom:10 }} />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {PRESET.map(c => (
            <button key={c} onClick={() => setNewColor(c)} style={{
              width:24, height:24, borderRadius:"50%", background:c, border:"none", cursor:"pointer",
              outline: newColor===c ? "2px solid white" : "none", outlineOffset:2,
            }} />
          ))}
        </div>
        <button className="btn btn-primary" style={{ width:"100%" }} disabled={saving||!newLabel.trim()} onClick={handleAdd}>
          {saving ? "⏳ Adding…" : <><Icon d={ic.plus} size={13} /> Add Type</>}
        </button>
      </div>
    </div>
  );
}

// ── Sketch picker modal ───────────────────────────────────────────────────────
function SketchPickerModal({ projectId, onSelect, onClose }) {
  const [sketches, setSketches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const SUPABASE_URL_LOCAL = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!projectId) return;
    supabase.from("sketches").select("*").eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setSketches(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 20px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"24px 22px", width:"100%", maxWidth:520, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>✏️ Import Sketch as Map</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)" }}>
            <Icon d={ic.close} size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize:13, color:"var(--text3)", textAlign:"center", padding:24 }}>Loading sketches…</div>
        ) : sketches.length === 0 ? (
          <div style={{ fontSize:13, color:"var(--text3)", textAlign:"center", padding:24, lineHeight:1.7 }}>
            No sketches found for this project.<br />
            Create a sketch in the Sketches tab first.
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
            {sketches.map(s => {
              const url = s.storage_path
                ? `${SUPABASE_URL_LOCAL}/storage/v1/object/public/project-photos/${s.storage_path}`
                : null;
              return (
                <div key={s.id} onClick={() => onSelect(s)}
                  style={{ cursor:"pointer", borderRadius:10, border:"1px solid var(--border)", overflow:"hidden", background:"var(--surface2)", transition:"border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
                  {url ? (
                    <img src={url} alt={s.title} style={{ width:"100%", aspectRatio:"4/3", objectFit:"contain", background:"#1a1a2e", display:"block" }} />
                  ) : (
                    <div style={{ width:"100%", aspectRatio:"4/3", display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1a2e" }}>
                      <Icon d={ic.note} size={28} stroke="var(--text3)" />
                    </div>
                  )}
                  <div style={{ padding:"7px 10px", fontSize:12, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {s.title || "Untitled Sketch"}
                  </div>
                  <div style={{ padding:"0 10px 8px", fontSize:10, color:"var(--text3)" }}>
                    {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop:16, textAlign:"right" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
