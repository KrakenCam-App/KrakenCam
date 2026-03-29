import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icon, ic, RoomIcon } from "../utils/icons.jsx";
import { hasPermissionLevel, getEffectivePermissions, getPermissionPolicies } from "../utils/constants.js";
import { uid, today , ROOM_ICONS, ROOM_COLORS, STATUS_META, normaliseStatuses, getStatusMeta, ROLE_META
} from "../utils/helpers.js";

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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const COLORS_PROJECT = ["#4a90d9","#3dba7e","#8b7cf8","#e85a3a","#e8703a","#e8c53a","#3ab8e8","#f0954e"];
  const PROJECT_TYPES = settings?.projectTypes?.length ? settings.projectTypes : ["Renovation","Insurance Claim","Inspection","Repair","New Construction","Mitigation","Remediation","Demolition","Consultation","Quote Request","Other"];
  const PROPERTY_TYPES = ["Single Family Home","Multi-Family Unit","Apartment","Commercial Building","Warehouse","Other"];
  const CAUSE_OF_LOSS = settings?.causeOfLossOptions?.length ? settings.causeOfLossOptions : ["Water â Pipe Burst","Water â Flooding","Water â Sewage Backup","Water â Roof Leak","Fire â Structure","Fire â Smoke/Soot","Wind / Storm Damage","Mold / Microbial","Impact / Collision","Vandalism / Break-In","Earthquake","Hail","Electrical","Other"];
  const PPE_OPTIONS = ["Hard Hat","Safety Glasses / Goggles","Work Boots","Respirator","Tyvek Suit","Gloves","High Viz","Hearing Protection"];
  const togglePPE = item => set("ppeItems", form.ppeItems.includes(item) ? form.ppeItems.filter(x => x !== item) : [...form.ppeItems, item]);
  const TIMELINE_STAGES = [
    { id:"lead",        label:"Lead",           icon:"ð" },
    { id:"assessment",  label:"Assessment",     icon:"ð" },
    { id:"approved",    label:"Approved",       icon:"â" },
    { id:"planning",    label:"Planning",       icon:"ðï¸" },
    { id:"in_progress", label:"In Progress",    icon:"ð¨" },
    { id:"final_walk",  label:"Final Walk",     icon:"ð¶" },
    { id:"completion_phase", label:"Completion Phase", icon:"ð§©" },
    { id:"invoiced",    label:"Invoiced",       icon:"ð§¾" },
    { id:"completed",   label:"Completed",      icon:"ð" },
  ];

  const [geocodeState, setGeocodeState] = useState(
    project?.lat && project?.lng ? "done" : "idle"
  ); // "idle" | "loading" | "done" | "error"

  // Geocode via Nominatim â called on save if coords are missing/stale
  const geocodeAddress = async (f) => {
    const parts = [f.address, f.city, f.state, f.zip].filter(Boolean);
    if (parts.length === 0) return { lat: "", lng: "", zip: "" };
    setGeocodeState("loading");
    try {
      // ââ Proxy via Supabase Edge Function âââââââââââââââââââââââââââââââââ
      // Browsers cannot set the User-Agent header required by Nominatim, so
      // we proxy through our own edge function which sets it server-side.
      // Replace KRAKENCAM_SUPABASE_URL with your project ref.
      const GEOCODE_URL = "https://nszoateefidwhhsyexjd.supabase.co/functions/v1/geocode";
      // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // Coordinates come from photo GPS or manual override â no auto-geocoding

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
                  <option value="">â Select â</option>
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cause of Loss / Issue</label>
                <select className="form-input form-select" value={form.causeOfLoss} onChange={e => set("causeOfLoss", e.target.value)}>
                  <option value="">â Select â</option>
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
                    ð Manual GPS: {parseFloat(form.lat||0).toFixed(6)}, {parseFloat(form.lng||0).toFixed(6)}
                    <span style={{ fontSize:10.5,fontWeight:400,color:"var(--text3)",marginLeft:6 }}>overriding photo GPS</span>
                  </span>
                : form.lat && form.lng
                ? <span style={{ color:"#3dba7e",fontWeight:600 }}>
                    ð Located: {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
                    <span style={{ fontSize:10.5,fontWeight:400,color:"var(--text3)",marginLeft:6 }}>from photo GPS</span>
                  </span>
                : <span style={{ color:"var(--text3)" }}>
                    ð· Map pin will be set automatically from your first on-site photo's GPS
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
                      â Valid coordinates â will show on map
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
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="client@email.com" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Relationship to Property</label>
                <select className="form-input form-select" value={form.clientRelationship} onChange={e => set("clientRelationship", e.target.value)}>
                  <option value="">â Select â</option>
                  {["Owner","Tenant","Property Manager","Manager","Office Admin","Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Building Occupancy Status</label>
                <select className="form-input form-select" value={form.occupancyStatus} onChange={e => set("occupancyStatus", e.target.value)}>
                  <option value="">â Select â</option>
                  {["Occupied","Unoccupied","Vacant","Partially Occupied","Condemned","Restricted","Seasonal Occupancy"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
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

          {/* Site Conditions */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.alert} size={15} stroke="var(--accent)" /> Site Conditions</div>

            <div className="form-group">
              <label className="form-label">Access Limitations / Restricted Areas</label>
              <input className="form-input" placeholder="e.g. Basement locked, roof access restrictedâ¦" value={form.accessLimitations} onChange={e => set("accessLimitations", e.target.value)} />
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
                      {active ? "â " : ""}{item}
                    </div>
                  );
                })}
                {/* Other option */}
                <div onClick={() => togglePPE("Other")}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.ppeItems.includes("Other") ? "var(--accent)" : "var(--border)"}`, background: form.ppeItems.includes("Other") ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: form.ppeItems.includes("Other") ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                  {form.ppeItems.includes("Other") ? "â " : ""}Other
                </div>
              </div>
              {form.ppeItems.includes("Other") && (
                <input className="form-input" style={{ marginTop:10 }} placeholder="Describe other PPE requiredâ¦" value={form.ppeOtherText} onChange={e => set("ppeOtherText", e.target.value)} />
              )}
            </div>
          </div>

          {/* Insurance â collapsible */}
          <div className="form-section">
            <div className="form-section-title" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => set("insuranceEnabled", !form.insuranceEnabled)}>
              <Icon d={ic.briefcase} size={15} stroke="var(--accent)" /> Insurance Information
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text3)", fontWeight:400, background:"var(--surface3)", padding:"2px 10px", borderRadius:10 }}>
                {form.insuranceEnabled ? "â² Hide" : "â¼ Add"}
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
                    <option value="">â Select â</option>
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
                <span>No managers or users in your account yet. Add team members in <strong style={{ color:"var(--accent)" }}>Account â Team Members</strong> first.</span>
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
                  <span>{ROOM_ICONS[r]||"ð¦"}</span>
                  <RoomIconBadge name={r} size={14} box={28} /><span style={{ fontSize:13 }}>{r}</span>
                  <span style={{ color:"var(--text3)",cursor:"pointer",marginLeft:2,fontSize:12,lineHeight:1 }} onClick={() => removeRoom(r)}>Ã</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <input className="form-input" style={{ flex:1 }} placeholder="Add custom room (e.g. Sunroom)â¦" value={newRoom} onChange={e => setNewRoom(e.target.value)} onKeyDown={e => e.key==="Enter"&&addRoom()} />
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
            <textarea className="form-input form-textarea" placeholder="Any notes about this projectâ¦" value={form.notes} onChange={e => set("notes", e.target.value)} />
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
                  placeholder={`Internal note for "${TIMELINE_STAGES.find(s=>s.id===form.timelineStage)?.label}"â¦`}
                  value={form.timelineNotes?.[form.timelineStage] || ""}
                  onChange={e => set("timelineNotes", { ...form.timelineNotes, [form.timelineStage]: e.target.value })}
                />
                <input className="form-input" style={{ fontSize:12.5 }}
                  placeholder={`Client portal note for "${TIMELINE_STAGES.find(s=>s.id===form.timelineStage)?.label}"â¦`}
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
              ? <><span style={{ display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite" }} /> Locatingâ¦</>
              : <><Icon d={ic.check} size={14} /> {isEdit ? "Save Changes" : "Create Jobsite"}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ââ Projects List (Home) âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function ProjectsList({ projects, teamUsers = [], settings = {}, onSelect, onNew, onEdit, onDelete }) {
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [myOnly, setMyOnly] = useState(false);

  // Current user is __admin__ (the logged-in account holder)
  const currentUserId = "__admin__";
  const projectPerms = getEffectivePermissions(settings?.userRole || "admin", settings?.userPermissions, settings);
  const permissionPolicies = getPermissionPolicies(settings);
  const canCreateProjects = hasPermissionLevel(projectPerms, "projects", "edit") || (settings?.userRole === "user" && permissionPolicies.allowUserProjectCreation);
  const canEditProjects = hasPermissionLevel(projectPerms, "projects", "edit");
  const canDeleteProjects = hasPermissionLevel(projectPerms, "deletes", "edit") || (settings?.userRole === "user" && permissionPolicies.allowUserDeletes);

  const filtered = projects
    .filter(p => !myOnly || (p.assignedUserIds||[]).includes(currentUserId))
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase()) || (p.clientName||"").toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const sort = settings.projectSort || "recent";
      if (sort === "alpha")  return a.title.localeCompare(b.title);
      if (sort === "oldest") return new Date(a.createdAt||0) - new Date(b.createdAt||0);
      if (sort === "newest") return new Date(b.createdAt||0) - new Date(a.createdAt||0);
      // "recent" â by updatedAt falling back to createdAt
      return new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0);
    });

  const totalPhotos = projects.reduce((a, p) => a + (p.photos?.length || 0), 0);

  return (
    <div className="page fade-in">
      {/* Top stats */}
      <div className="stats-grid">
        {[
          { label:"Total Jobsites", value:String(projects.length),  sub:`${projects.filter(p=>p.status==="active").length} active`, cls:"orange" },
          { label:"Total Photos",   value:String(totalPhotos),      sub:"Across all projects",                                       cls:"blue"   },
          { label:"Active Reports", value:String(projects.reduce((a,p)=>a+(p.reports?.length||0),0)), sub:"Across all projects",     cls:"green"  },
          { label:"Completed",      value:String(projects.filter(p=>p.status==="completed").length),  sub:"Finished projects",       cls:"purple" },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:20 }}>
        <input className="form-input" style={{ width:"100%",padding:"8px 14px",boxSizing:"border-box" }} placeholder="Search jobsites, addresses, clientsâ¦" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
          <div style={{ display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",width:"100%",paddingBottom:2 }}>
            {[["all","All"],... ((normaliseStatuses(settings.projectStatuses)||[{id:"active",label:"Active"},{id:"onhold",label:"On Hold"},{id:"completed",label:"Completed"},{id:"archived",label:"Archived"}]).map(s=>[s.id,s.label]))].map(([k,l]) => (
              <button key={k} className={`btn btn-sm ${filterStatus===k?"btn-primary":"btn-secondary"}`} style={{ flexShrink:0 }} onClick={() => setFilterStatus(k)}>{l}</button>
            ))}
          </div>
          <button
            onClick={() => setMyOnly(v => !v)}
            style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 13px",borderRadius:"var(--radius-sm)",border:`1.5px solid ${myOnly?"var(--accent)":"var(--border)"}`,background:myOnly?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",fontSize:12.5,fontWeight:600,color:myOnly?"var(--accent)":"var(--text2)",transition:"all .15s",flexShrink:0 }}>
            <div style={{ width:16,height:16,borderRadius:4,border:`2px solid ${myOnly?"var(--accent)":"var(--border)"}`,background:myOnly?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0 }}>
              {myOnly && <Icon d={ic.check} size={10} stroke="white" strokeWidth={3} />}
            </div>
            My Jobsites
          </button>
          <button className="btn btn-primary" style={{ marginLeft:"auto" }} onClick={canCreateProjects ? onNew : undefined} disabled={!canCreateProjects}><Icon d={ic.plus} size={16} /> New Jobsite</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.briefcase} size={28} stroke="var(--text3)" /></div>
          <h3>{search ? "No results found" : myOnly ? "No assigned jobsites" : "No jobsites yet"}</h3>
          <p>{search ? "Try a different search term." : myOnly ? "You haven't been assigned to any jobsites yet." : "Create your first jobsite to start capturing photos and building reports."}</p>
          {!search && !myOnly && <button className="btn btn-primary" onClick={canCreateProjects ? onNew : undefined} disabled={!canCreateProjects}><Icon d={ic.plus} size={15} /> Create First Jobsite</button>}
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(project => {
            const sm = getStatusMeta(project.status, settings);
            return (
              <div key={project.id} className="project-card" onClick={() => onSelect(project)}>
                <div className="project-card-bar" style={{ background: project.color }} />
                <div className="project-card-body">
                  {/* Top row: status + edit/delete */}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                    <span className={`tag tag-${sm.cls}`}>{sm.label}</span>
                    <div style={{ display:"flex",gap:6 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-ghost btn-icon" title="Edit" onClick={() => canEditProjects && onEdit(project)} disabled={!canEditProjects}><Icon d={ic.edit} size={14} /></button>
                      <button className="btn btn-sm btn-ghost btn-icon" title="Delete" onClick={() => canDeleteProjects && setShowDeleteId(project.id)} disabled={!canDeleteProjects}><Icon d={ic.trash} size={14} /></button>
                    </div>
                  </div>
                  {/* Title + address always below */}
                  <div className="project-card-title" style={{ marginBottom:4,whiteSpace:"normal" }}>{project.title}</div>
                  <div className="project-card-addr"><Icon d={ic.mapPin} size={12} stroke="var(--text3)" />{project.address}{project.city ? `, ${project.city}` : ""}{project.state ? `, ${project.state}` : ""}</div>
                  <div className="project-card-meta">
                    <div className="project-card-stat"><Icon d={ic.camera} size={12} />{project.photos?.length || 0} photos</div>
                    <div className="project-card-stat"><Icon d={ic.rooms} size={12} />{project.rooms?.length || 0} rooms</div>
                    <div className="project-card-stat"><Icon d={ic.reports} size={12} />{project.reports?.length || 0} reports</div>
                  </div>
                  <div style={{ fontSize:11,color:"var(--text2)",background:"var(--surface2)",borderRadius:6,padding:"5px 9px",display:"inline-flex",alignItems:"center",gap:5 }}>
                    <Icon d={ic.hash} size={11} />{project.type}
                  </div>
                </div>
                <div className="project-card-footer">
                  <div className="project-card-client"><Icon d={ic.user} size={12} />{project.clientName || "No client set"}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    {(project.assignedUserIds||[]).length > 0 && (() => {
                      const assigned = (project.assignedUserIds||[])
                        .map(id => teamUsers.find(u => u.id === id))
                        .filter(Boolean);
                      const show = assigned.slice(0,3);
                      const extra = assigned.length - show.length;
                      return (
                        <div style={{ display:"flex",alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                          {show.map((u,i) => {
                            const m = ROLE_META[u.role]||ROLE_META.user;
                            return (
                              <div key={u.id} title={`${u.firstName} ${u.lastName}`}
                                style={{ width:22,height:22,borderRadius:"50%",background:m.color,border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",marginLeft:i>0?-6:0,zIndex:show.length-i,position:"relative" }}>
                                {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()}
                              </div>
                            );
                          })}
                          {extra > 0 && <div style={{ width:22,height:22,borderRadius:"50%",background:"var(--surface3)",border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text2)",marginLeft:-6 }}>+{extra}</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
          {/* New jobsite card */}
          <div className="project-card" style={{ border:"2px dashed var(--border)",cursor:canCreateProjects?"pointer":"not-allowed",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:200,opacity:canCreateProjects?1:0.6 }} onClick={canCreateProjects ? onNew : undefined}>
            <div style={{ width:52,height:52,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}>
              <Icon d={ic.plus} size={24} stroke="var(--accent)" />
            </div>
            <div style={{ fontSize:13,fontWeight:700,color:"var(--text2)" }}>New Jobsite</div>
            <div style={{ fontSize:12,color:"var(--text3)",marginTop:4 }}>Create a new project</div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {showDeleteId && (() => { const proj = projects.find(p=>p.id===showDeleteId); return (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal fade-in" style={{ maxWidth:440 }}>
            <div className="modal-header"><div className="modal-title">Delete Jobsite?</div><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowDeleteId(null)}><Icon d={ic.close} size={16} /></button></div>
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

// ââ Checklist System ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const FIELD_TYPES = [
  { id:"checkbox",       label:"Single Checkbox",    icon:"â" },
  { id:"multi_checkbox", label:"Multi Checkbox",     icon:"ââ" },
  { id:"dropdown",       label:"Dropdown",           icon:"â¾" },
  { id:"text",           label:"Text Answer",        icon:"â" },
  { id:"yesno",          label:"Yes / No",           icon:"Y/N" },
  { id:"number",         label:"Number",             icon:"#" },
];

// Default checklist templates available to all projects