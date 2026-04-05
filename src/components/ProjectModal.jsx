import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getProjectSubcontractors } from "../lib/projects.js";
import { Icon, ic, RoomIcon, RoomIconBadge } from "../utils/icons.jsx";
import { hasPermissionLevel, getEffectivePermissions, getPermissionPolicies, FIELD_TYPES } from "../utils/constants.js";
import { uid, today , ROOM_ICONS, ROOM_COLORS, STATUS_META, normaliseStatuses, getStatusMeta, ROLE_META
} from "../utils/helpers.js";

// Shared across ProjectModal (editor stepper) and ProjectsList (card progress bar)
const TIMELINE_STAGES = [
  { id:"lead",             label:"Lead",             icon:"📋" },
  { id:"assessment",       label:"Assessment",       icon:"🔍" },
  { id:"approved",         label:"Approved",         icon:"✅" },
  { id:"planning",         label:"Planning",         icon:"🗂️" },
  { id:"in_progress",      label:"In Progress",      icon:"🔨" },
  { id:"final_walk",       label:"Final Walk",       icon:"🚶" },
  { id:"completion_phase", label:"Completion Phase", icon:"🧩" },
  { id:"invoiced",         label:"Invoiced",         icon:"🧾" },
  { id:"completed",        label:"Completed",        icon:"🏁" },
];

export function ProjectModal({ project, teamUsers = [], settings = {}, onSave, onClose }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    title:               project?.title               || "",
    address:             project?.address             || "",
    city:                project?.city               || "",
    state:               project?.state               || "",
    zip:                 project?.zip                 || "",
    // Prefer stored split fields; fall back to parsing the legacy single clientName for old records
    clientFirstName: (() => {
      if (project?.clientFirstName) return project.clientFirstName;
      if (!project?.clientName)     return "";
      const parts = project.clientName.trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || "";
    })(),
    clientLastName: (() => {
      if (project?.clientLastName)  return project.clientLastName;
      if (!project?.clientName)     return "";
      const parts = project.clientName.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : "";
    })(),
    clientEmail:         project?.clientEmail         || "",
    clientPhone:         project?.clientPhone         || "",
    clientCellPhone:     project?.clientCellPhone     || "",
    clientBusinessName:  project?.clientBusinessName  || "",
    clientRelationship:  project?.clientRelationship  || "",
    occupancyStatus:     project?.occupancyStatus     || "",
    contractorName:      project?.contractorName      || "",
    contractorPhone:     project?.contractorPhone     || "",
    type:                project?.type               || "Renovation",
    status:              project?.status              || "active",
    notes:               project?.notes               || "",
    color:               project?.color               || "#4a90d9",
    // New fields
    projectNumber:       project?.projectNumber       || "",
    propertyType:        project?.propertyType        || "",
    causeOfLoss:         project?.causeOfLoss         || "",
    dateInspection:      project?.dateInspection      || "",
    timeInspection:      project?.timeInspection      || "",
    dateWorkPerformed:   project?.dateWorkPerformed   || "",
    timeWorkPerformed:   project?.timeWorkPerformed   || "",
    completionDate:      project?.completionDate      || "",
    completionTime:      project?.completionTime      || "",
    accessLimitations:   project?.accessLimitations   || "",
    lat:                 project?.lat                 || "",
    lng:                 project?.lng                 || "",
    manualGps:           project?.manualGps           || false,
    powerStatus:         project?.powerStatus         || "unknown",
    waterStatus:         project?.waterStatus         || "unknown",
    ppeItems:            project?.ppeItems            || [],
    ppeOtherText:        project?.ppeOtherText        || "",
    // Insurance
    insuranceEnabled:    project?.insuranceEnabled    || false,
    insuranceCarrier:    project?.insuranceCarrier    || "",
    insurancePolicyNum:  project?.insurancePolicyNum  || "",
    claimNumber:         project?.claimNumber         || "",
    adjusterName:        project?.adjusterName        || "",
    adjusterPhone:       project?.adjusterPhone       || "",
    adjusterEmail:       project?.adjusterEmail       || "",
    adjusterCompany:     project?.adjusterCompany     || "",
    dateOfLoss:          project?.dateOfLoss          || "",
    coverageType:        project?.coverageType        || "",
    // Timeline
    timelineStage:       project?.timelineStage       || "",
    timelineNotes:       project?.timelineNotes       || {},
    timelineClientNotes: project?.timelineClientNotes || {},
  });
  const [teamMembers, setTeamMembers] = useState(project?.teamMembers || []);
  // assignedUserIds: array of user IDs from the account's teamUsers
  const [assignedUserIds, setAssignedUserIds] = useState(project?.assignedUserIds || []);
  const toggleAssignUser = (id) => setAssignedUserIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const assignableUsers = teamUsers.filter(u => u.status === "active" && (u.role === "manager" || u.role === "user"));
  const [customRooms, setCustomRooms] = useState(
    project?.rooms?.map(r => r.name) || []
  );
  const [newRoom, setNewRoom] = useState("");
  const [siteConditionsOpen, setSiteConditionsOpen] = useState(
    !!(project?.accessLimitations || (project?.powerStatus && project.powerStatus !== "unknown") || (project?.waterStatus && project.waterStatus !== "unknown") || project?.ppeItems?.length)
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const COLORS_PROJECT = ["#4a90d9","#3dba7e","#8b7cf8","#e85a3a","#e8703a","#e8c53a","#3ab8e8","#f0954e"];
  const PROJECT_TYPES = settings?.projectTypes?.length ? settings.projectTypes : ["Renovation","Insurance Claim","Inspection","Repair","New Construction","Mitigation","Remediation","Demolition","Consultation","Quote Request","Other"];
  const PROPERTY_TYPES = ["Single Family Home","Multi-Family Unit","Apartment","Commercial Building","Warehouse","Other"];
  const CAUSE_OF_LOSS = settings?.causeOfLossOptions?.length ? settings.causeOfLossOptions : ["Water — Pipe Burst","Water — Flooding","Water — Sewage Backup","Water — Roof Leak","Fire — Structure","Fire — Smoke/Soot","Wind / Storm Damage","Mold / Microbial","Impact / Collision","Vandalism / Break-In","Earthquake","Hail","Electrical","Other"];
  const PPE_OPTIONS = ["Hard Hat","Safety Glasses / Goggles","Work Boots","Respirator","Tyvek Suit","Gloves","High Viz","Hearing Protection"];
  const togglePPE = item => set("ppeItems", form.ppeItems.includes(item) ? form.ppeItems.filter(x => x !== item) : [...form.ppeItems, item]);
  // TIMELINE_STAGES is defined at module level above (shared with ProjectsList)

  // ── Subcontractors ───────────────────────────────────────────────────────────
  const [subcontractors, setSubcontractors] = useState([]);
  const [subcontractorsOpen, setSubcontractorsOpen] = useState(false);

  const newSubcontractor = () => ({ _key: Math.random().toString(36).slice(2), companyName: "", contactName: "", phoneNumber: "", serviceDescription: "", notes: "" });
  const addSubcontractor = () => setSubcontractors(s => [...s, newSubcontractor()]);
  const removeSubcontractor = (key) => setSubcontractors(s => s.filter(x => x._key !== key));
  const setSubField = (key, field, val) => setSubcontractors(s => s.map(x => x._key === key ? { ...x, [field]: val } : x));

  // Load existing subcontractors when editing
  useEffect(() => {
    if (!project?.id) return;
    getProjectSubcontractors(project.id)
      .then(subs => {
        if (subs.length > 0) {
          setSubcontractors(subs.map(s => ({ ...s, _key: s.id || Math.random().toString(36).slice(2) })));
          setSubcontractorsOpen(true);
        }
      })
      .catch(() => {}); // non-fatal — form still works without
  }, [project?.id]);

  const [geocodeState, setGeocodeState] = useState(
    project?.lat && project?.lng ? "done" : "idle"
  ); // "idle" | "loading" | "done" | "error"

  // Geocode via Nominatim — called on save if coords are missing/stale
  const geocodeAddress = async (f) => {
    const parts = [f.address, f.city, f.state, f.zip].filter(Boolean);
    if (parts.length === 0) return { lat: "", lng: "", zip: "" };
    setGeocodeState("loading");
    try {
      // ── Proxy via Supabase Edge Function ─────────────────────────────────
      // Browsers cannot set the User-Agent header required by Nominatim, so
      // we proxy through our own edge function which sets it server-side.
      // Replace KRAKENCAM_SUPABASE_URL with your project ref.
      const GEOCODE_URL = "https://nszoateefidwhhsyexjd.supabase.co/functions/v1/geocode";
      // ─────────────────────────────────────────────────────────────────────
      const params = new URLSearchParams();
      if (f.address) params.set("address", f.address);
      if (f.city)    params.set("city",    f.city);
      if (f.state)   params.set("state",   f.state);
      if (f.zip)     params.set("zip",     f.zip);
      const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
      const data = await res.json();
      if (data?.lat && data?.lng) {
        setGeocodeState("done");
        return { lat: data.lat, lng: data.lng, zip: data.postcode || "" };
      }
      setGeocodeState("error");
      return { lat: f.lat || "", lng: f.lng || "", zip: "" };
    } catch {
      setGeocodeState("error");
      return { lat: f.lat || "", lng: f.lng || "", zip: "" };
    }
  };

  const [zipAutoFilled, setZipAutoFilled] = useState(false);

  const handleSave = () => {
    if (!form.title.trim()) return;
    const rooms = customRooms.map((n, i) => ({
      id: project?.rooms?.find(r => r.name===n)?.id || uid(),
      name: n, icon: n,
      color: ROOM_COLORS[i % ROOM_COLORS.length],
      photoCount: project?.rooms?.find(r => r.name===n)?.photoCount || 0,
    }));
    onSave({
      id: project?.id || `proj_${uid()}`,
      ...form,
      // Derive combined clientName so project cards display correctly immediately
      clientName: [form.clientFirstName, form.clientLastName].filter(Boolean).join(' '),
      rooms,
      teamMembers,
      assignedUserIds,
      // Pass subcontractors separately — saved by parent after project upsert
      _subcontractors: subcontractors.filter(s => s.companyName?.trim()),
      lat: form.lat || "",
      lng: form.lng || "",
      zip: form.zip?.trim() || "",
      photos:  project?.photos  || [],
      videos: project?.videos || [],
      voiceNotes: project?.voiceNotes || [],
      sketches: project?.sketches || [],
      files: project?.files || [],
      reports: project?.reports || [],
      checklists: project?.checklists || [],
      scratchPad: project?.scratchPad || "",
      clientPortal: project?.clientPortal || undefined,
      createdAt: project?.createdAt || today(),
    });
  };

  // Coordinates come from photo GPS or manual override — no auto-geocoding

  const addRoom = () => {
    const n = newRoom.trim();
    if (n && !customRooms.includes(n)) { setCustomRooms(r => [...r, n]); setNewRoom(""); }
  };
  const removeRoom = (n) => setCustomRooms(r => r.filter(x => x !== n));

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:680 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Jobsite" : "New Jobsite"}</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>
        <div className="modal-body">

          {/* Color bar */}
          <div style={{ display:"flex",gap:8,marginBottom:20,alignItems:"center" }}>
            <span style={{ fontSize:11.5,color:"var(--text2)",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em" }}>Project Color</span>
            {COLORS_PROJECT.map(c => (
              <div key={c} onClick={() => set("color", c)} style={{ width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:form.color===c?"3px solid white":"3px solid transparent",transition:"border .1s" }} />
            ))}
          </div>

          {/* Project info */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.briefcase} size={15} stroke="var(--accent)" /> Project Details</div>
            <div className="form-row">
              <div className="form-group" style={{ flex:2 }}>
                <label className="form-label">Job Title *</label>
                <input className="form-input" placeholder="e.g. 123 Oak Street Full Renovation" value={form.title} onChange={e => set("title", e.target.value)} />
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Project Number</label>
                <input className="form-input" placeholder="e.g. PRJ-2024-001" value={form.projectNumber} onChange={e => set("projectNumber", e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select className="form-input form-select" value={form.type} onChange={e => set("type", e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                  {(normaliseStatuses(settings?.projectStatuses) || Object.keys(STATUS_META).map(k=>({id:k,...STATUS_META[k]}))).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Property Type</label>
                <select className="form-input form-select" value={form.propertyType} onChange={e => set("propertyType", e.target.value)}>
                  <option value="">— Select —</option>
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cause of Loss / Issue</label>
                <select className="form-input form-select" value={form.causeOfLoss} onChange={e => set("causeOfLoss", e.target.value)}>
                  <option value="">— Select —</option>
                  {CAUSE_OF_LOSS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Inspection / Assessment</label>
                <div className="date-input-wrap">
                  <input className="form-input" type="date" value={form.dateInspection} onChange={e => set("dateInspection", e.target.value)} />
                  <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Time of Inspection / Assessment</label>
                <input className="form-input" type="time"
                  value={form.timeInspection}
                  onChange={e => set("timeInspection", e.target.value)}
                  style={{ colorScheme:"dark" }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date Work Performed</label>
                <div className="date-input-wrap">
                  <input className="form-input" type="date" value={form.dateWorkPerformed} onChange={e => set("dateWorkPerformed", e.target.value)} />
                  <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Time Work Performed</label>
                <input className="form-input" type="time" value={form.timeWorkPerformed} onChange={e => set("timeWorkPerformed", e.target.value)} style={{ colorScheme:"dark" }} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Completion Date</label>
                <div className="date-input-wrap">
                  <input className="form-input" type="date" value={form.completionDate} onChange={e => set("completionDate", e.target.value)} />
                  <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Completion Time</label>
                <input className="form-input" type="time" value={form.completionTime} onChange={e => set("completionTime", e.target.value)} style={{ colorScheme:"dark" }} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.mapPin} size={15} stroke="var(--accent)" /> Property Address</div>
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input className="form-input" placeholder="123 Main Street" value={form.address} onChange={e => set("address", e.target.value)} />
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">City</label><input className="form-input" placeholder="Denver" value={form.city} onChange={e => set("city", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" placeholder="CO or ON" value={form.state} onChange={e => set("state", e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label" style={{ display:"flex",alignItems:"center",gap:6 }}>
                  ZIP / Postal Code
                  {zipAutoFilled && form.zip && (
                    <span style={{ fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,background:"#3dba7e22",color:"#3dba7e",border:"1px solid #3dba7e44" }}>auto-filled</span>
                  )}
                </label>
                <input className="form-input" placeholder="80202 or M5H 2N2" value={form.zip}
                  onChange={e => { set("zip", e.target.value); setZipAutoFilled(false); }}
                  style={{ borderColor: zipAutoFilled && form.zip ? "#3dba7e66" : undefined }}
                />
              </div>
            </div>
            {/* Map pin status */}
            <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:6,padding:"9px 13px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",border:"1px solid var(--border)",fontSize:12.5 }}>
              <Icon d={ic.mapPin} size={15} stroke={form.manualGps?"var(--accent)":form.lat&&form.lng?"#3dba7e":"var(--text3)"} />
              {form.manualGps
                ? <span style={{ color:"var(--accent)",fontWeight:600,flex:1 }}>
                    📍 Manual GPS: {parseFloat(form.lat||0).toFixed(6)}, {parseFloat(form.lng||0).toFixed(6)}
                    <span style={{ fontSize:10.5,fontWeight:400,color:"var(--text3)",marginLeft:6 }}>overriding photo GPS</span>
                  </span>
                : form.lat && form.lng
                ? <span style={{ color:"#3dba7e",fontWeight:600 }}>
                    📍 Located: {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
                    <span style={{ fontSize:10.5,fontWeight:400,color:"var(--text3)",marginLeft:6 }}>from photo GPS</span>
                  </span>
                : <span style={{ color:"var(--text3)" }}>
                    📷 Map pin will be set automatically from your first on-site photo's GPS
                  </span>
              }
            </div>

            {/* GPS Override */}
            <div style={{ marginTop:8,padding:"10px 13px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",border:`1px solid ${form.manualGps?"var(--accent)":"var(--border)"}`,transition:"border-color .2s" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom: form.manualGps ? 10 : 0 }}>
                <Icon d={ic.mapPin} size={14} stroke="var(--text3)" />
                <span style={{ fontSize:12.5,fontWeight:600,flex:1 }}>GPS Coordinate Override</span>
                <span style={{ fontSize:11,color:"var(--text3)",marginRight:4 }}>{form.manualGps ? "On" : "Off"}</span>
                <div onClick={() => {
                    const next = !form.manualGps;
                    set("manualGps", next);
                    if (!next) { set("lat",""); set("lng",""); } // clear manual coords when turning off
                  }}
                  style={{ width:36,height:20,borderRadius:10,background:form.manualGps?"var(--accent)":"var(--border)",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:2,left:form.manualGps?18:2,width:16,height:16,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"left .2s" }} />
                </div>
              </div>
              {form.manualGps && (
                <>
                  <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:8,lineHeight:1.5 }}>
                    Enter precise GPS coordinates to manually set this jobsite's map pin. This overrides the automatic photo GPS detection.
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                    <div className="form-group" style={{ margin:0 }}>
                      <label className="form-label" style={{ fontSize:11 }}>Latitude</label>
                      <input className="form-input" placeholder="e.g. 39.7392"
                        value={form.lat}
                        onChange={e => set("lat", e.target.value)}
                        style={{ fontFamily:"monospace",fontSize:12.5 }} />
                    </div>
                    <div className="form-group" style={{ margin:0 }}>
                      <label className="form-label" style={{ fontSize:11 }}>Longitude</label>
                      <input className="form-input" placeholder="e.g. -104.9903"
                        value={form.lng}
                        onChange={e => set("lng", e.target.value)}
                        style={{ fontFamily:"monospace",fontSize:12.5 }} />
                    </div>
                  </div>
                  {form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng)) && (
                    <div style={{ marginTop:8,fontSize:11,color:"#3dba7e",fontWeight:600 }}>
                      ✓ Valid coordinates — will show on map
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Client */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.user} size={15} stroke="var(--accent)" /> Client Information</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">First Name</label><input className="form-input" placeholder="Jane" value={form.clientFirstName} onChange={e => set("clientFirstName", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" placeholder="Smith" value={form.clientLastName} onChange={e => set("clientLastName", e.target.value)} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Business <span style={{ fontWeight:400, color:"var(--text3)", fontSize:11 }}>optional</span></label>
              <input className="form-input" placeholder="Company or business name" value={form.clientBusinessName} onChange={e => set("clientBusinessName", e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="client@email.com" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cell <span style={{ fontWeight:400, color:"var(--text3)", fontSize:11 }}>optional</span></label>
                <input className="form-input" placeholder="(555) 000-0000" value={form.clientCellPhone} onChange={e => set("clientCellPhone", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Relationship to Property</label>
                <select className="form-input form-select" value={form.clientRelationship} onChange={e => set("clientRelationship", e.target.value)}>
                  <option value="">— Select —</option>
                  {["Owner","Tenant","Property Manager","Manager","Office Admin","Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Building Occupancy Status</label>
              <select className="form-input form-select" value={form.occupancyStatus} onChange={e => set("occupancyStatus", e.target.value)}>
                <option value="">— Select —</option>
                {["Occupied","Unoccupied","Vacant","Partially Occupied","Condemned","Restricted","Seasonal Occupancy"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Contractor */}
          <div className="form-section">
            <div className="form-section-title" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
              <span style={{ display:"flex",alignItems:"center",gap:7 }}><Icon d={ic.building} size={15} stroke="var(--accent)" /> Contractor / Inspector</span>
              <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize:11.5,padding:"3px 12px" }}
                onClick={()=>{ set("contractorName", settings?.companyName||""); set("contractorPhone", settings?.phone||""); }}>
                <Icon d={ic.building} size={12} /> Use My Company Info
              </button>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Company / Name</label><input className="form-input" placeholder="Apex Builders" value={form.contractorName} onChange={e => set("contractorName", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.contractorPhone} onChange={e => set("contractorPhone", e.target.value)} /></div>
            </div>
          </div>

          {/* Subcontractors — collapsible */}
          <div className="form-section">
            <div className="form-section-title" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => setSubcontractorsOpen(o => !o)}>
              <Icon d={ic.users} size={15} stroke="var(--accent)" /> Subcontractors
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text3)", fontWeight:400, background:"var(--surface3)", padding:"2px 10px", borderRadius:10 }}>
                {subcontractorsOpen ? "▲ Hide" : "▼ Add"}
              </span>
            </div>
            {subcontractorsOpen && (
              <>
                {subcontractors.length === 0 && (
                  <div style={{ fontSize:13, color:"var(--text3)", padding:"10px 0 6px" }}>No subcontractors added yet.</div>
                )}
                {subcontractors.map((sub, idx) => (
                  <div key={sub._key} style={{ position:"relative", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"14px 14px 10px", marginBottom:10 }}>
                    {/* Row header */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".04em" }}>
                        Subcontractor {idx + 1}
                      </span>
                      <button type="button" onClick={() => removeSubcontractor(sub._key)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:18, lineHeight:1, padding:"0 2px" }}
                        title="Remove subcontractor">×</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Company Name *</label>
                        <input className="form-input" placeholder="e.g. ABC Plumbing" value={sub.companyName} onChange={e => setSubField(sub._key, "companyName", e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Name</label>
                        <input className="form-input" placeholder="e.g. John Doe" value={sub.contactName} onChange={e => setSubField(sub._key, "contactName", e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input className="form-input" placeholder="(555) 000-0000" value={sub.phoneNumber} onChange={e => setSubField(sub._key, "phoneNumber", e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Service Completing</label>
                        <input className="form-input" placeholder="e.g. Plumbing, HVAC, Framing…" value={sub.serviceDescription} onChange={e => setSubField(sub._key, "serviceDescription", e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Notes</label>
                      <input className="form-input" placeholder="Any notes about this subcontractor…" value={sub.notes} onChange={e => setSubField(sub._key, "notes", e.target.value)} />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" style={{ width:"100%", marginTop:4, fontSize:13 }} onClick={addSubcontractor}>
                  <Icon d={ic.plus} size={14} /> Add Subcontractor
                </button>
              </>
            )}
          </div>

          {/* Site Conditions — collapsible */}
          <div className="form-section">
            <div className="form-section-title" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => setSiteConditionsOpen(o => !o)}>
              <Icon d={ic.alert} size={15} stroke="var(--accent)" /> Site Conditions
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text3)", fontWeight:400, background:"var(--surface3)", padding:"2px 10px", borderRadius:10 }}>
                {siteConditionsOpen ? "▲ Hide" : "▼ Add"}
              </span>
            </div>
            {siteConditionsOpen && (
              <>
                <div className="form-group">
                  <label className="form-label">Access Limitations / Restricted Areas</label>
                  <input className="form-input" placeholder="e.g. Basement locked, roof access restricted…" value={form.accessLimitations} onChange={e => set("accessLimitations", e.target.value)} />
                </div>

                <div className="form-row">
                  {/* Power Status */}
                  <div className="form-group">
                    <label className="form-label">Power Status</label>
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
                      {[{v:"on",label:"On"},{v:"off",label:"Off"},{v:"unknown",label:"N/A"}].map(({v,label}) => (
                        <div key={v} onClick={() => set("powerStatus", v)}
                          style={{ flex:1, padding:"9px 0", textAlign:"center", borderRadius:"var(--radius-sm)", border:`2px solid ${form.powerStatus===v ? "var(--accent)" : "var(--border)"}`, background: form.powerStatus===v ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color: form.powerStatus===v ? "var(--accent)" : "var(--text2)", transition:"all .15s" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Water Status */}
                  <div className="form-group">
                    <label className="form-label">Water Status</label>
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
                      {[{v:"on",label:"On"},{v:"off",label:"Off"},{v:"unknown",label:"N/A"}].map(({v,label}) => (
                        <div key={v} onClick={() => set("waterStatus", v)}
                          style={{ flex:1, padding:"9px 0", textAlign:"center", borderRadius:"var(--radius-sm)", border:`2px solid ${form.waterStatus===v ? "var(--accent)" : "var(--border)"}`, background: form.waterStatus===v ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color: form.waterStatus===v ? "var(--accent)" : "var(--text2)", transition:"all .15s" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PPE */}
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">PPE Required On Site</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
                    {PPE_OPTIONS.map(item => {
                      const active = form.ppeItems.includes(item);
                      return (
                        <div key={item} onClick={() => togglePPE(item)}
                          style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: active ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                          {active ? "✓ " : ""}{item}
                        </div>
                      );
                    })}
                    {/* Other option */}
                    <div onClick={() => togglePPE("Other")}
                      style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.ppeItems.includes("Other") ? "var(--accent)" : "var(--border)"}`, background: form.ppeItems.includes("Other") ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: form.ppeItems.includes("Other") ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                      {form.ppeItems.includes("Other") ? "✓ " : ""}Other
                    </div>
                  </div>
                  {form.ppeItems.includes("Other") && (
                    <input className="form-input" style={{ marginTop:10 }} placeholder="Describe other PPE required…" value={form.ppeOtherText} onChange={e => set("ppeOtherText", e.target.value)} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Insurance — collapsible */}
          <div className="form-section">
            <div className="form-section-title" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => set("insuranceEnabled", !form.insuranceEnabled)}>
              <Icon d={ic.briefcase} size={15} stroke="var(--accent)" /> Insurance Information
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text3)", fontWeight:400, background:"var(--surface3)", padding:"2px 10px", borderRadius:10 }}>
                {form.insuranceEnabled ? "▲ Hide" : "▼ Add"}
              </span>
            </div>
            {form.insuranceEnabled && (
              <>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Insurance Carrier</label><input className="form-input" placeholder="e.g. State Farm" value={form.insuranceCarrier} onChange={e => set("insuranceCarrier", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Policy Number</label><input className="form-input" placeholder="POL-000000" value={form.insurancePolicyNum} onChange={e => set("insurancePolicyNum", e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Claim Number</label><input className="form-input" placeholder="CLM-000000" value={form.claimNumber} onChange={e => set("claimNumber", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Date of Loss</label><div className="date-input-wrap"><input className="form-input" type="date" value={form.dateOfLoss} onChange={e => set("dateOfLoss", e.target.value)} /><span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span></div></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Coverage Type</label>
                  <select className="form-input form-select" value={form.coverageType} onChange={e => set("coverageType", e.target.value)}>
                    <option value="">— Select —</option>
                    {(settings?.coverageTypeOptions?.length ? settings.coverageTypeOptions : ["Dwelling","Contents","Liability","ALE (Additional Living Expenses)","Commercial Property","Business Interruption","Flood","Other"]).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, marginTop:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:12 }}>Adjuster Contact</div>
                  <div className="form-group"><label className="form-label">Adjuster Name</label><input className="form-input" placeholder="John Smith" value={form.adjusterName} onChange={e => set("adjusterName", e.target.value)} /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Adjuster Company</label><input className="form-input" placeholder="e.g. Crawford & Company" value={form.adjusterCompany} onChange={e => set("adjusterCompany", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.adjusterPhone} onChange={e => set("adjusterPhone", e.target.value)} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="adjuster@carrier.com" value={form.adjusterEmail} onChange={e => set("adjusterEmail", e.target.value)} /></div>
                </div>
              </>
            )}
          </div>

          {/* Team Members */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.users} size={15} stroke="var(--accent)" /> Team Members</div>

            {assignableUsers.length === 0 ? (
              <div style={{ padding:"14px 16px",background:"var(--surface2)",border:"1px dashed var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--text2)",display:"flex",alignItems:"center",gap:10 }}>
                <Icon d={ic.users} size={16} stroke="var(--text3)" />
                <span>No managers or users in your account yet. Add team members in <strong style={{ color:"var(--accent)" }}>Account → Team Members</strong> first.</span>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {assignableUsers.map(u => {
                  const sel = assignedUserIds.includes(u.id);
                  const meta = ROLE_META[u.role] || ROLE_META.user;
                  return (
                    <div key={u.id} onClick={() => toggleAssignUser(u.id)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 13px",borderRadius:"var(--radius-sm)",border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                      <div style={{ width:34,height:34,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:"white",flexShrink:0 }}>
                        {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:13.5 }}>{u.firstName} {u.lastName}</div>
                        <div style={{ fontSize:12,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.title||u.email}</div>
                      </div>
                      <span style={{ fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:`${meta.color}18`,color:meta.color,flexShrink:0 }}>{meta.label}</span>
                      <div style={{ width:20,height:20,borderRadius:"50%",border:`2px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {sel && <Icon d={ic.check} size={11} stroke="white" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {assignedUserIds.length > 0 && (
              <div style={{ marginTop:10,fontSize:12,color:"var(--text2)" }}>
                {assignedUserIds.length} user{assignedUserIds.length!==1?"s":""} assigned to this jobsite
              </div>
            )}
          </div>

          {/* Rooms */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.rooms} size={15} stroke="var(--accent)" /> Rooms / Areas</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:12 }}>
              {customRooms.map(r => (
                <div key={r} style={{ display:"flex",alignItems:"center",gap:8,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 10px 4px 8px",fontSize:0 }}>
                  <span>{ROOM_ICONS[r]||"📦"}</span>
                  <RoomIconBadge name={r} size={14} box={28} /><span style={{ fontSize:13 }}>{r}</span>
                  <span style={{ color:"var(--text3)",cursor:"pointer",marginLeft:2,fontSize:12,lineHeight:1 }} onClick={() => removeRoom(r)}>×</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <input className="form-input" style={{ flex:1 }} placeholder="Add custom room (e.g. Sunroom)…" value={newRoom} onChange={e => setNewRoom(e.target.value)} onKeyDown={e => e.key==="Enter"&&addRoom()} />
              <button className="btn btn-secondary" onClick={addRoom}><Icon d={ic.plus} size={15} /></button>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:10 }}>
              {Object.keys(ROOM_ICONS).filter(n => !customRooms.includes(n)).map(n => (
                <div key={n} style={{ fontSize:12,background:"var(--surface3)",border:"1px dashed var(--border)",borderRadius:20,padding:"3px 10px",cursor:"pointer",color:"var(--text2)" }}
                  onClick={() => setCustomRooms(r => [...r, n])}>+ {n}</div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" placeholder="Any notes about this project…" value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Project Timeline */}
          <div className="form-section" style={{ marginBottom:0 }}>
            <div className="form-section-title"><Icon d={ic.activity} size={15} stroke="var(--accent)" /> Project Timeline</div>
            {/* Stage track */}
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", marginBottom:16 }}>
            <div style={{ position:"relative", minWidth:480 }}>
              {/* Connector line */}
              <div style={{ position:"absolute", top:18, left:18, right:18, height:2, background:"var(--border)", zIndex:0 }} />
              {/* Active fill */}
              {(() => {
                const idx = TIMELINE_STAGES.findIndex(s => s.id === form.timelineStage);
                const pct = idx < 0 ? 0 : (idx / (TIMELINE_STAGES.length - 1)) * 100;
                return <div style={{ position:"absolute", top:18, left:18, height:2, width:`calc(${pct}% * (1 - 36/${TIMELINE_STAGES.length * 52}))`, background:"var(--accent)", zIndex:1, transition:"width .3s" }} />;
              })()}
              <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:2 }}>
                {TIMELINE_STAGES.map((stage, i) => {
                  const activeIdx = TIMELINE_STAGES.findIndex(s => s.id === form.timelineStage);
                  const isDone    = activeIdx >= 0 && i < activeIdx;
                  const isActive  = form.timelineStage === stage.id;
                  return (
                    <div key={stage.id} onClick={() => set("timelineStage", form.timelineStage === stage.id ? "" : stage.id)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", flex:1 }}>
                      <div style={{
                        width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:15, border:`2px solid ${isActive ? "var(--accent)" : isDone ? "var(--accent)" : "var(--border)"}`,
                        background: isActive ? "var(--accent)" : isDone ? "var(--accent-glow)" : "var(--surface)",
                        transition:"all .2s", boxShadow: isActive ? "0 0 0 4px var(--accent-glow)" : "none",
                      }}>
                        {isDone ? <Icon d={ic.check} size={14} stroke={isActive ? "white" : "var(--accent)"} /> : stage.icon}
                      </div>
                      <span style={{ fontSize:10, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--accent)" : isDone ? "var(--text2)" : "var(--text3)", textAlign:"center", lineHeight:1.2, whiteSpace:"nowrap" }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
            {/* Stage note */}
            {form.timelineStage && (
              <div style={{ display:"grid", gap:10 }}>
                <input className="form-input" style={{ fontSize:12.5 }}
                  placeholder={`Internal note for "${TIMELINE_STAGES.find(s=>s.id===form.timelineStage)?.label}"…`}
                  value={form.timelineNotes?.[form.timelineStage] || ""}
                  onChange={e => set("timelineNotes", { ...form.timelineNotes, [form.timelineStage]: e.target.value })}
                />
                <input className="form-input" style={{ fontSize:12.5 }}
                  placeholder={`Client portal note for "${TIMELINE_STAGES.find(s=>s.id===form.timelineStage)?.label}"…`}
                  value={form.timelineClientNotes?.[form.timelineStage] || ""}
                  onChange={e => set("timelineClientNotes", { ...form.timelineClientNotes, [form.timelineStage]: e.target.value })}
                />
              </div>
            )}
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim() || geocodeState==="loading"}>
            {geocodeState==="loading"
              ? <><span style={{ display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite" }} /> Locating…</>
              : <><Icon d={ic.check} size={14} /> {isEdit ? "Save Changes" : "Create Jobsite"}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Projects List (Home) ───────────────────────────────────────────────────────
export function ProjectsList({ projects, teamUsers = [], settings = {}, onSelect, onNew, onEdit, onDelete, onUpdateProject, tasks = [], calEvents = [], userId = null, orgId = null }) {
  const [showDeleteId,      setShowDeleteId]      = useState(null);
  const [filterStatus,      setFilterStatus]      = useState("active");
  const [search,            setSearch]            = useState("");
  const [myOnly,            setMyOnly]            = useState(false);
  const [sortBy,            setSortBy]            = useState("recent");
  const [menuOpenId,        setMenuOpenId]        = useState(null);
  const [bulkMode,          setBulkMode]          = useState(false);
  const [selected,          setSelected]          = useState([]);
  const [pinnedIds,         setPinnedIds]         = useState([]);
  const [filterPinned,      setFilterPinned]      = useState(false);
  const [filterEventsToday, setFilterEventsToday] = useState(false);
  const [filterOverdue,     setFilterOverdue]     = useState(false);
  const menuRef = useRef(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const projectPerms     = getEffectivePermissions(settings?.userRole || "admin", settings?.userPermissions, settings);
  const permissionPolicies = getPermissionPolicies(settings);
  const canCreateProjects = hasPermissionLevel(projectPerms, "projects", "edit") || (settings?.userRole === "user" && permissionPolicies.allowUserProjectCreation);
  const canEditProjects   = hasPermissionLevel(projectPerms, "projects", "edit");
  const canDeleteProjects = hasPermissionLevel(projectPerms, "deletes", "edit") || (settings?.userRole === "user" && permissionPolicies.allowUserDeletes);

  // ── Load pins from Supabase ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from("jobsite_pins").select("project_id").eq("user_id", userId)
      .then(({ data }) => { if (data) setPinnedIds(data.map(r => r.project_id)); });
  }, [userId]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // ── Pin toggle ───────────────────────────────────────────────────────────────
  const togglePin = useCallback(async (e, projectId) => {
    e.stopPropagation();
    const isPinned = pinnedIds.includes(projectId);
    if (isPinned) {
      setPinnedIds(ids => ids.filter(id => id !== projectId));
      if (userId) supabase.from("jobsite_pins").delete().eq("user_id", userId).eq("project_id", projectId).then(() => {});
    } else {
      setPinnedIds(ids => [...ids, projectId]);
      if (userId && orgId) supabase.from("jobsite_pins").insert([{ user_id: userId, organization_id: orgId, project_id: projectId }]).then(() => {});
    }
  }, [pinnedIds, userId, orgId]);

  // ── Per-project derived helpers ──────────────────────────────────────────────
  const getNextEvent = useCallback((projectId) => {
    return calEvents
      .filter(e => e.projectId === projectId && e.startDate >= todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null;
  }, [calEvents, todayStr]);

  const getOverdueCount = useCallback((projectId) => {
    return tasks.filter(t => t.projectId === projectId && t.dueDate && t.dueDate < todayStr && t.status !== "done" && t.status !== "completed").length;
  }, [tasks, todayStr]);

  const getProjectProgress = useCallback((project) => {
    // Mirror the Project Timeline stepper: progress = stage index / (total stages - 1)
    if (!project.timelineStage) return 0; // no stage set → empty bar
    const idx = TIMELINE_STAGES.findIndex(s => s.id === project.timelineStage);
    if (idx < 0) return 0;
    return Math.round((idx / (TIMELINE_STAGES.length - 1)) * 100);
  }, []);

  const getLastActivity = useCallback((project) => {
    return project.last_activity_at || project.updatedAt || project.createdAt || null;
  }, []);

  const getHealthWarnings = useCallback((project) => {
    const w = [];
    const clientName = [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ") || project.clientName;
    if (!clientName)                         w.push("No client");
    if (!project.address)                    w.push("No address");
    if (!(project.reports || []).length)     w.push("No reports");
    if (!(project.photos  || []).length)     w.push("No photos");
    if (!getNextEvent(project.id))           w.push("No upcoming event");
    const lastAct = getLastActivity(project);
    if (lastAct) {
      const daysAgo = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000);
      if (daysAgo >= 30) w.push(`Inactive ${daysAgo}d`);
    }
    return w;
  }, [getNextEvent, getLastActivity]);

  const formatRelTime = useCallback((iso) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }, []);

  const formatDateShort = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ── Summary metrics ──────────────────────────────────────────────────────────
  const overdueTasksTotal  = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== "done" && t.status !== "completed").length;
  const eventsTodayTotal   = calEvents.filter(e => e.startDate === todayStr).length;
  const pendingReportsTotal = projects.reduce((a, p) => a + (p.reports || []).filter(r => r.status === "draft" || r.status === "pending" || !r.status).length, 0);

  // ── Filter helpers ────────────────────────────────────────────────────────────
  const hasEventsToday = (p) => calEvents.some(e => e.projectId === p.id && e.startDate === todayStr);
  const hasOverdueTasks = (p) => tasks.some(t => t.projectId === p.id && t.dueDate && t.dueDate < todayStr && t.status !== "done" && t.status !== "completed");
  const effectiveUserId = userId || "__admin__";

  // ── Filtered + sorted list ────────────────────────────────────────────────────
  const filtered = projects
    .filter(p => !filterPinned      || pinnedIds.includes(p.id))
    .filter(p => !filterEventsToday || hasEventsToday(p))
    .filter(p => !filterOverdue     || hasOverdueTasks(p))
    .filter(p => !myOnly            || (p.assignedUserIds || []).includes(effectiveUserId))
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      const client = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ").toLowerCase() || (p.clientName || "").toLowerCase();
      return p.title.toLowerCase().includes(q) || (p.address || "").toLowerCase().includes(q) || client.includes(q);
    })
    .slice()
    .sort((a, b) => {
      // Pinned always float first
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      switch (sortBy) {
        case "alpha":        return a.title.localeCompare(b.title);
        case "alpha_desc":   return b.title.localeCompare(a.title);
        case "oldest":       return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case "newest":       return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case "most_photos":  return (b.photos?.length || 0) - (a.photos?.length || 0);
        case "most_reports": return (b.reports?.length || 0) - (a.reports?.length || 0);
        case "overdue":      return getOverdueCount(b.id) - getOverdueCount(a.id);
        case "next_event": {
          const aEv = getNextEvent(a.id), bEv = getNextEvent(b.id);
          if (!aEv && !bEv) return 0;
          if (!aEv) return 1; if (!bEv) return -1;
          return aEv.startDate.localeCompare(bEv.startDate);
        }
        default: // recent
          return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      }
    });

  // ── Bulk helpers ─────────────────────────────────────────────────────────────
  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelected(sel => sel.includes(id) ? sel.filter(s => s !== id) : [...sel, id]);
  };
  const selectAll   = () => setSelected(filtered.map(p => p.id));
  const clearSelect = () => { setSelected([]); setBulkMode(false); };
  const bulkArchive = () => {
    if (onUpdateProject) selected.forEach(id => { const p = projects.find(pr => pr.id === id); if (p) onUpdateProject({ ...p, status: "archived" }); });
    clearSelect();
  };
  const bulkSetStatus = (status) => {
    if (onUpdateProject) selected.forEach(id => { const p = projects.find(pr => pr.id === id); if (p) onUpdateProject({ ...p, status }); });
    clearSelect();
  };

  // ── 3-dot menu action ────────────────────────────────────────────────────────
  const menuAction = (e, fn) => { e.stopPropagation(); fn(); setMenuOpenId(null); };

  // Warning chip color map
  const warnColor = { "No client":"#e8a33a", "No address":"#e8a33a", "No reports":"#3ab8e8", "No photos":"#3ab8e8", "No upcoming event":"#8b7cf8" };

  const SORT_OPTIONS = [
    ["recent",       "Recently Updated"],
    ["newest",       "Date Created (Newest)"],
    ["oldest",       "Date Created (Oldest)"],
    ["alpha",        "Name A→Z"],
    ["alpha_desc",   "Name Z→A"],
    ["most_photos",  "Most Photos"],
    ["most_reports", "Most Reports"],
    ["overdue",      "Most Overdue Tasks"],
    ["next_event",   "Next Upcoming Event"],
  ];

  return (
    <div className="page fade-in" onClick={() => setMenuOpenId(null)}>

      {/* ── Summary metrics ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18 }}>
        {[
          { label:"Overdue Tasks",    value:overdueTasksTotal,  sub:"need attention",   color:"#e85a3a", onClick:() => setFilterOverdue(v => !v),     active:filterOverdue     },
          { label:"Events Today",     value:eventsTodayTotal,   sub:"scheduled today",  color:"#3ab8e8", onClick:() => setFilterEventsToday(v => !v), active:filterEventsToday },
          { label:"Pending Reports",  value:pendingReportsTotal, sub:"draft / pending", color:"#8b7cf8", onClick:null,                                active:false             },
        ].map(s => (
          <div key={s.label}
            onClick={s.onClick || undefined}
            style={{ background:s.active?"var(--accent-glow)":"var(--surface2)",border:`1.5px solid ${s.active?s.color:"var(--border)"}`,borderRadius:"var(--radius)",padding:"12px 14px",cursor:s.onClick?"pointer":"default",transition:"all .15s" }}>
            <div style={{ fontSize:22,fontWeight:800,color:s.value > 0 ? s.color : "var(--text)",lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11.5,fontWeight:700,color:"var(--text)",marginTop:3 }}>{s.label}</div>
            <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <input className="form-input" style={{ width:"100%",padding:"8px 14px",boxSizing:"border-box",marginBottom:10 }}
        placeholder="Search jobsites, addresses, clients…" value={search} onChange={e => setSearch(e.target.value)} />

      {/* ── Status filter pills + sort + new ── */}
      {/* proj-filter-bar stacks to two rows on mobile via CSS */}
      <div className="proj-filter-bar" style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
        {/* Pills — get their own full row on mobile */}
        <div className="proj-filter-pills" style={{ display:"flex",gap:5,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",flex:1,paddingBottom:2 }}>
          {[["all","All"],... ((normaliseStatuses(settings.projectStatuses)||[{id:"active",label:"Active"},{id:"onhold",label:"On Hold"},{id:"completed",label:"Completed"},{id:"archived",label:"Archived"}]).map(s=>[s.id,s.label]))].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${filterStatus===k?"btn-primary":"btn-secondary"}`} style={{ flexShrink:0 }} onClick={e => { e.stopPropagation(); setFilterStatus(k); }}>{l}</button>
          ))}
        </div>
        {/* Sort + New — pushed to their own row on mobile */}
        <div className="proj-filter-actions" style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
          <select
            value={sortBy} onChange={e => setSortBy(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{ fontSize:12,padding:"5px 8px",borderRadius:"var(--radius-sm)",border:"1.5px solid var(--border)",background:"var(--surface2)",color:"var(--text)",cursor:"pointer" }}>
            {SORT_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-primary" style={{ flexShrink:0 }} onClick={canCreateProjects ? onNew : undefined} disabled={!canCreateProjects}>
            <Icon d={ic.plus} size={15} /> New
          </button>
        </div>
      </div>

      {/* ── Quick filter toggles + bulk mode ── */}
      <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:16 }}>
        {[
          ["📌 Pinned",       filterPinned,      () => setFilterPinned(v => !v)      ],
          ["⚑ Overdue",      filterOverdue,     () => setFilterOverdue(v => !v)     ],
          ["📅 Today",        filterEventsToday, () => setFilterEventsToday(v => !v) ],
          ["👤 Mine",         myOnly,            () => setMyOnly(v => !v)            ],
        ].map(([label, active, toggle]) => (
          <button key={label}
            onClick={e => { e.stopPropagation(); toggle(); }}
            style={{ fontSize:11.5,fontWeight:600,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${active?"var(--accent)":"var(--border)"}`,background:active?"var(--accent-glow)":"var(--surface2)",color:active?"var(--accent)":"var(--text2)",cursor:"pointer",transition:"all .15s" }}>
            {label}
          </button>
        ))}
        <button onClick={e => { e.stopPropagation(); setBulkMode(v => !v); if (bulkMode) clearSelect(); }}
          style={{ marginLeft:"auto",fontSize:11.5,fontWeight:600,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${bulkMode?"var(--accent)":"var(--border)"}`,background:bulkMode?"var(--accent-glow)":"var(--surface2)",color:bulkMode?"var(--accent)":"var(--text2)",cursor:"pointer" }}>
          {bulkMode ? "✕ Cancel" : "☑ Select"}
        </button>
      </div>

      {/* ── Bulk action bar ── */}
      {bulkMode && selected.length > 0 && (
        <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:"var(--radius)",background:"var(--accent-glow)",border:"1.5px solid var(--accent)",marginBottom:14,flexWrap:"wrap" }}>
          <span style={{ fontSize:12.5,fontWeight:700,color:"var(--accent)" }}>{selected.length} selected</span>
          <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); selectAll(); }}>Select All ({filtered.length})</button>
          <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); bulkSetStatus("active"); }}>Set Active</button>
          <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); bulkSetStatus("onhold"); }}>Set On Hold</button>
          <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); bulkArchive(); }}>Archive</button>
          <button className="btn btn-sm btn-ghost" style={{ marginLeft:"auto" }} onClick={e => { e.stopPropagation(); clearSelect(); }}>Clear</button>
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.briefcase} size={28} stroke="var(--text3)" /></div>
          <h3>{search ? "No results found" : filterPinned ? "No pinned jobsites" : myOnly ? "No assigned jobsites" : "No jobsites yet"}</h3>
          <p>{search ? "Try a different search term." : filterPinned ? "Pin a jobsite by clicking the pin icon on any card." : myOnly ? "You haven't been assigned to any jobsites yet." : "Create your first jobsite to start capturing photos and building reports."}</p>
          {!search && !myOnly && !filterPinned && <button className="btn btn-primary" onClick={canCreateProjects ? onNew : undefined} disabled={!canCreateProjects}><Icon d={ic.plus} size={15} /> Create First Jobsite</button>}
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(project => {
            const sm        = getStatusMeta(project.status, settings);
            const isPinned  = pinnedIds.includes(project.id);
            const nextEv    = getNextEvent(project.id);
            const overdueN  = getOverdueCount(project.id);
            const progress  = getProjectProgress(project);
            const lastAct   = getLastActivity(project);
            const warnings  = getHealthWarnings(project);
            const isSelected = selected.includes(project.id);
            const clientName = [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ") || project.clientName || "";
            const owner = project.internal_owner_user_id ? teamUsers.find(u => u.id === project.internal_owner_user_id) : null;
            const assigned = (project.assignedUserIds || []).map(id => teamUsers.find(u => u.id === id)).filter(Boolean);

            return (
              <div key={project.id} className="project-card"
                style={{ outline: isSelected ? "2px solid var(--accent)" : "none", position:"relative" }}
                onClick={() => { if (bulkMode) { toggleSelect({stopPropagation:()=>{}}, project.id); } else { onSelect(project); } }}>

                {/* Color bar */}
                <div className="project-card-bar" style={{ background: project.color || "#4a90d9" }} />

                <div className="project-card-body">

                  {/* Row 1: bulk checkbox / pin / status / 3-dot */}
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                    {bulkMode && (
                      <div onClick={e => toggleSelect(e, project.id)}
                        style={{ width:17,height:17,borderRadius:4,border:`2px solid ${isSelected?"var(--accent)":"var(--border)"}`,background:isSelected?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer" }}>
                        {isSelected && <Icon d={ic.check} size={10} stroke="white" strokeWidth={3} />}
                      </div>
                    )}
                    {/* Pin */}
                    <button onClick={e => togglePin(e, project.id)}
                      title={isPinned ? "Unpin" : "Pin to top"}
                      style={{ background:"none",border:"none",cursor:"pointer",padding:2,color:isPinned?"var(--accent)":"var(--text3)",fontSize:14,lineHeight:1,flexShrink:0 }}>
                      {isPinned ? "📌" : "⊙"}
                    </button>
                    <span className={`tag tag-${sm.cls}`} style={{ flexShrink:0 }}>{sm.label}</span>
                    {/* Overdue badge — hidden on mobile (shown at card bottom instead) */}
                    {overdueN > 0 && (
                      <span className="proj-overdue-top" style={{ background:"#e85a3a",color:"white",fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 7px",flexShrink:0 }}>
                        ⚑ {overdueN} overdue
                      </span>
                    )}
                    {/* 3-dot menu */}
                    <div style={{ marginLeft:"auto",position:"relative" }} onClick={e => e.stopPropagation()} ref={menuOpenId === project.id ? menuRef : null}>
                      <button
                        className="btn btn-sm btn-ghost btn-icon"
                        onClick={e => { e.stopPropagation(); setMenuOpenId(id => id === project.id ? null : project.id); }}
                        style={{ fontSize:16,lineHeight:1,padding:"2px 6px" }}>⋯</button>
                      {menuOpenId === project.id && (
                        <div style={{ position:"absolute",right:0,top:"100%",zIndex:9999,background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"0 8px 24px rgba(0,0,0,.3)",minWidth:170,maxWidth:"min(210px,calc(100vw - 20px))",overflow:"hidden" }}>
                          {[
                            ["Open",          () => onSelect(project)                                                       ],
                            ["Edit",          () => canEditProjects && onEdit(project)                                       ],
                            [isPinned?"Unpin":"Pin to Top", () => togglePin({ stopPropagation:()=>{} }, project.id)         ],
                            ["Open in Maps",  () => { if (project.address) window.open(`https://maps.google.com/?q=${encodeURIComponent([project.address,project.city,project.state].filter(Boolean).join(", "))}`, "_blank"); }],
                            ["Archive",       () => onUpdateProject && onUpdateProject({ ...project, status:"archived" })    ],
                            ["Delete",        () => canDeleteProjects && setShowDeleteId(project.id)                         ],
                          ].map(([label, fn]) => (
                            <button key={label}
                              onClick={e => menuAction(e, fn)}
                              style={{ display:"block",width:"100%",textAlign:"left",padding:"9px 14px",fontSize:13,background:"none",border:"none",cursor:"pointer",color: label==="Delete"?"#e85a3a":"var(--text)",borderBottom:"1px solid var(--border)" }}
                              onMouseEnter={e => e.currentTarget.style.background="var(--surface2)"}
                              onMouseLeave={e => e.currentTarget.style.background="none"}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="project-card-title" style={{ marginBottom:3,whiteSpace:"normal",lineHeight:1.3 }}>{project.title}</div>

                  {/* Address */}
                  {project.address && (
                    <div className="project-card-addr" style={{ marginBottom:6 }}>
                      <Icon d={ic.mapPin} size={12} stroke="var(--text3)" />
                      {project.address}{project.city ? `, ${project.city}` : ""}{project.state ? `, ${project.state}` : ""}
                    </div>
                  )}

                  {/* Client */}
                  <div style={{ fontSize:12,color:clientName?"var(--text2)":"var(--text3)",display:"flex",alignItems:"center",gap:5,marginBottom:8 }}>
                    <Icon d={ic.user} size={12} stroke={clientName?"var(--text2)":"var(--text3)"} />
                    {clientName || <em>No client set</em>}
                  </div>

                  {/* Counts row */}
                  <div className="project-card-meta" style={{ marginBottom:8 }}>
                    <div className="project-card-stat"><Icon d={ic.camera}  size={12} />{project.photos?.length  || 0} photos</div>
                    <div className="project-card-stat"><Icon d={ic.rooms}   size={12} />{project.rooms?.length   || 0} rooms</div>
                    <div className="project-card-stat"><Icon d={ic.reports} size={12} />{project.reports?.length || 0} reports</div>
                  </div>

                  {/* Next event */}
                  {nextEv && (
                    <div style={{ fontSize:11.5,color:"var(--text2)",display:"flex",alignItems:"center",gap:5,marginBottom:6,background:"var(--surface2)",borderRadius:6,padding:"4px 8px" }}>
                      <span style={{ color:"#3ab8e8" }}>📅</span>
                      <span style={{ fontWeight:600 }}>{nextEv.startDate === todayStr ? "Today" : formatDateShort(nextEv.startDate)}</span>
                      <span style={{ color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{nextEv.title}</span>
                    </div>
                  )}

                  {/* Internal owner + assigned avatars */}
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                    {owner ? (
                      <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text2)" }}>
                        <div style={{ width:18,height:18,borderRadius:"50%",background:(ROLE_META[owner.role]||ROLE_META.user).color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white" }}>
                          {(owner.firstName?.[0]||"")+(owner.lastName?.[0]||"")}
                        </div>
                        {owner.firstName}
                      </div>
                    ) : <div />}
                    {assigned.length > 0 && (
                      <div style={{ display:"flex",alignItems:"center" }}>
                        {assigned.slice(0, 3).map((u, i) => {
                          const m = ROLE_META[u.role] || ROLE_META.user;
                          return (
                            <div key={u.id} title={`${u.firstName} ${u.lastName}`}
                              style={{ width:22,height:22,borderRadius:"50%",background:m.color,border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",marginLeft:i>0?-6:0,zIndex:3-i,position:"relative" }}>
                              {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()}
                            </div>
                          );
                        })}
                        {assigned.length > 3 && <div style={{ width:22,height:22,borderRadius:"50%",background:"var(--surface3)",border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text2)",marginLeft:-6 }}>+{assigned.length-3}</div>}
                      </div>
                    )}
                  </div>

                  {/* Last activity */}
                  {lastAct && (
                    <div style={{ fontSize:11,color:"var(--text3)",marginBottom:6,display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ opacity:.6 }}>⏱</span> {formatRelTime(lastAct)}
                      {project.last_activity_type && <span style={{ opacity:.6 }}>· {project.last_activity_type}</span>}
                    </div>
                  )}

                  {/* Progress bar — mirrors Project Timeline stage stepper */}
                  <div style={{ marginBottom:7 }}
                    title={project.timelineStage
                      ? `Timeline: ${TIMELINE_STAGES.find(s => s.id === project.timelineStage)?.label ?? project.timelineStage}`
                      : "Timeline not set"}>
                    <div style={{ height:5,background:"var(--surface3)",borderRadius:3,overflow:"hidden" }}>
                      <div style={{ height:"100%",width:`${progress}%`,background: progress >= 100 ? "#3dba7e" : progress >= 55 ? "#f0954e" : "var(--accent)",borderRadius:3,transition:"width .4s" }} />
                    </div>
                  </div>

                  {/* Health warning chips */}
                  {warnings.length > 0 && (
                    <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginTop:4 }}>
                      {warnings.slice(0, 3).map(w => (
                        <span key={w} style={{ fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:"rgba(0,0,0,.2)",color: warnColor[w] || "#e8a33a",border:`1px solid ${warnColor[w] || "#e8a33a"}40` }}>{w}</span>
                      ))}
                      {warnings.length > 3 && <span style={{ fontSize:10,color:"var(--text3)" }}>+{warnings.length-3} more</span>}
                    </div>
                  )}

                  {/* Overdue badge — mobile only, shown at bottom so it doesn't crowd the top row */}
                  {overdueN > 0 && (
                    <span className="proj-overdue-bot" style={{ background:"#e85a3a",color:"white",fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 7px",marginTop:6,alignSelf:"flex-start" }}>
                      ⚑ {overdueN} overdue
                    </span>
                  )}
                </div>

                {/* Card footer: type tag */}
                <div className="project-card-footer" style={{ justifyContent:"space-between" }}>
                  <div style={{ fontSize:11,color:"var(--text2)",display:"inline-flex",alignItems:"center",gap:5 }}>
                    <Icon d={ic.hash} size={11} />{project.type || "General"}
                  </div>
                  {project.projectNumber && (
                    <div style={{ fontSize:11,color:"var(--text3)" }}>#{project.projectNumber}</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* New jobsite card */}
          <div className="project-card"
            style={{ border:"2px dashed var(--border)",cursor:canCreateProjects?"pointer":"not-allowed",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:220,opacity:canCreateProjects?1:0.5 }}
            onClick={canCreateProjects ? onNew : undefined}>
            <div style={{ width:48,height:48,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10 }}>
              <Icon d={ic.plus} size={22} stroke="var(--accent)" />
            </div>
            <div style={{ fontSize:13,fontWeight:700,color:"var(--text2)" }}>New Jobsite</div>
            <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:3 }}>Create a new project</div>
          </div>
        </div>
      )}

      {/* ── Confirm delete modal ── */}
      {showDeleteId && (() => { const proj = projects.find(p => p.id === showDeleteId); return (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal fade-in" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Jobsite?</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowDeleteId(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,lineHeight:1.6,color:"var(--text2)" }}>Are you sure you want to delete <strong style={{ color:"var(--text)" }}>{proj?.title}</strong>? This will permanently delete all {proj?.photos?.length || 0} photos and {proj?.reports?.length || 0} reports associated with this project.</p>
              <div className="confirm-box">
                <Icon d={ic.alert} size={20} stroke="#ff6b6b" />
                <span style={{ fontSize:13,color:"#ff6b6b" }}>This action cannot be undone.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { onDelete(showDeleteId); setShowDeleteId(null); }}>Delete Jobsite</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}

// ── Checklist System ─────────────────────────────────────────────────────────
// FIELD_TYPES imported from utils/constants.js

// Default checklist templates available to all projects