import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Icon, ic } from "../utils/icons.jsx";
import { formatDate , NOTIFICATION_PREF_ITEMS, normaliseStatuses
} from "../utils/helpers.js";
const REPORT_EMAIL_FEATURE_VISIBLE = false; // feature flag â email reports hidden until ready

export function AddItemInput({ label, onAdd }) {
  const [val, setVal] = useState("");
  const placeholder = `Add new ${label.toLowerCase().replace(/ options$/,"").replace(/ types$/,"").replace(/ type$/,"")} optionâ¦`;
  const commit = () => { if (val.trim()) { onAdd(val); setVal(""); } };
  return (
    <div style={{ display:"flex",gap:8 }}>
      <input className="form-input" style={{ flex:1 }} placeholder={placeholder}
        value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter") commit(); }} />
      <button className="btn btn-secondary btn-sm" onClick={commit}>
        <Icon d={ic.plus} size={14}/> Add
      </button>
    </div>
  );
}

const TAG_CLS_COLORS = { green:"#3dba7e", blue:"#3ab8e8", orange:"#e8703a", purple:"#8b7cf8", red:"#e85a3a", gray:"#6b7280" };
const ACCENT_PRESETS = [
  { value: '#2b7fe8', name: 'Blue'   },
  { value: '#8b7cf8', name: 'Purple' },
  { value: '#3dba7e', name: 'Green'  },
  { value: '#e8c53a', name: 'Yellow' },
  { value: '#e8703a', name: 'Orange' },
  { value: '#e85a3a', name: 'Red'    },
  { value: '#3ab8e8', name: 'Cyan'   },
  { value: '#ec4899', name: 'Pink'   },
];

export function StatusListEditor({ items: rawItems, onChange }) {
  // Normalise old string[] to {id,label,cls}[] on the way in
  const items = normaliseStatuses(rawItems) || rawItems || [];
  const [newLabel, setNewLabel] = useState("");
  const [newCls,   setNewCls]   = useState("blue");

  const SYSTEM_STATUS_IDS = ["active","onhold","completed","archived"];

  const updateItem = (idx, patch) => {
    const next = items.map((s,i) => i===idx ? {...s,...patch} : s);
    onChange(next);
  };
  const removeItem = (idx) => onChange(items.filter((_,i) => i!==idx));
  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/__+/g,"_");
    if (items.find(s => s.id === id || s.label === label)) return;
    onChange([...items, { id, label, cls: newCls }]);
    setNewLabel(""); setNewCls("blue");
  };
  const moveItem = (from, to) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  return (
    <div>
      <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:12 }}>
        {items.map((s, idx) => {
          const isSystem = SYSTEM_STATUS_IDS.includes(s.id);
          return (
          <div key={s.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--surface2)",borderRadius:8,border:`1px solid ${isSystem?"var(--border)":"var(--border)"}`,opacity:1 }}>
            {/* Reorder */}
            <div style={{ display:"flex",flexDirection:"column",gap:2,flexShrink:0 }}>
              <button className="btn btn-ghost btn-sm btn-icon" style={{ width:20,height:16,padding:0,opacity:idx===0?0.3:1 }}
                onClick={() => moveItem(idx, idx-1)} disabled={idx===0}>
                <Icon d="M18 15l-6-6-6 6" size={11}/>
              </button>
              <button className="btn btn-ghost btn-sm btn-icon" style={{ width:20,height:16,padding:0,opacity:idx===items.length-1?0.3:1 }}
                onClick={() => moveItem(idx, idx+1)} disabled={idx===items.length-1}>
                <Icon d="M6 9l6 6 6-6" size={11}/>
              </button>
            </div>
            {/* Colour dot â locked for system statuses */}
            <div style={{ position:"relative",flexShrink:0 }}>
              <div style={{ width:14,height:14,borderRadius:"50%",background:TAG_CLS_COLORS[s.cls]||"#6b7280",
                cursor:isSystem?"default":"pointer",border:"2px solid var(--border)",
                opacity:isSystem?0.6:1 }}
                title={isSystem?"System status colour is fixed":"Click to change colour"}
                onClick={() => {
                  if (isSystem) return;
                  const opts = Object.keys(TAG_CLS_COLORS);
                  const next = opts[(opts.indexOf(s.cls)+1) % opts.length];
                  updateItem(idx, { cls: next });
                }} />
            </div>
            {/* Label â locked for system statuses */}
            {isSystem
              ? <span style={{ flex:1,fontSize:13,color:"var(--text)",display:"flex",alignItems:"center",gap:6 }}>
                  {s.label}
                  <span style={{ fontSize:10,color:"var(--text3)",fontWeight:600,padding:"1px 6px",borderRadius:4,background:"var(--surface3)",border:"1px solid var(--border)" }}>system</span>
                </span>
              : <input className="form-input" style={{ flex:1,padding:"3px 8px",height:30,fontSize:12.5 }}
                  value={s.label}
                  onChange={e => updateItem(idx, { label: e.target.value })} />
            }
            {/* Preview badge */}
            <span className={`tag tag-${s.cls}`} style={{ flexShrink:0,fontSize:11 }}>{s.label}</span>
            {/* Remove â hidden for system statuses */}
            {isSystem
              ? <div style={{ width:28,height:28,flexShrink:0 }} /> 
              : <button className="btn btn-ghost btn-sm btn-icon" style={{ width:28,height:28,color:"#e85a3a",flexShrink:0 }}
                  onClick={() => removeItem(idx)}>
                  <Icon d={ic.close} size={13}/>
                </button>
            }
          </div>
          );
        })}
      </div>
      {/* Add new status */}
      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
        <input className="form-input" style={{ flex:1 }} placeholder="New status labelâ¦"
          value={newLabel} onChange={e=>setNewLabel(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") addItem(); }} />
        <div style={{ display:"flex",gap:4,flexShrink:0 }}>
          {Object.entries(TAG_CLS_COLORS).map(([cls,col]) => (
            <div key={cls} onClick={()=>setNewCls(cls)}
              style={{ width:20,height:20,borderRadius:"50%",background:col,cursor:"pointer",
                border:`2px solid ${newCls===cls?"white":"transparent"}`,
                boxShadow:newCls===cls?`0 0 0 2px ${col}`:"none",
                transition:"all .15s" }} />
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ flexShrink:0 }}>
          <Icon d={ic.plus} size={14}/> Add
        </button>
      </div>
      <div style={{ fontSize:11,color:"var(--text3)",marginTop:8 }}>Click a colour dot to cycle through colours. Label edits apply immediately on Save.</div>
    </div>
  );
}

export function SettingsPage({ settings, onSave, onDeleteAccount, projects = [], users = [] }) {
  const [tab, setTab]   = useState(typeof window !== "undefined" && window.innerWidth <= 768 ? "appearance" : "company");
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  // Re-sync form when settings prop changes (e.g. authProfile seeds name/email on first load)
  useEffect(() => {
    setForm(prev => ({ ...settings, ...prev,
      // Always take these from settings if they were blank in form
      userFirstName: prev.userFirstName || settings.userFirstName || "",
      userLastName:  prev.userLastName  || settings.userLastName  || "",
      userEmail:     prev.userEmail     || settings.userEmail     || "",
      companyName:   prev.companyName   || settings.companyName   || "",
    }));
  }, [settings.userFirstName, settings.userEmail, settings.companyName]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    setExportDone(false);
    try {
      // Bundle all account data â only this org's data (already in local state, RLS-enforced on load)
      const exportPayload = {
        exported_at: new Date().toISOString(),
        account: {
          org_name:    settings.orgName || settings.companyName || "My Organization",
          plan:        settings.plan,
          export_note: "This export contains all data for your KrakenCam account only.",
        },
        settings: {
          ...settings,
          // Strip sensitive keys
          supabaseKey: undefined, serviceRoleKey: undefined,
        },
        users: users.map(u => ({
          name:  u.name || u.full_name,
          email: u.email,
          role:  u.role,
        })),
        projects: projects.map(p => ({
          id:       p.id,
          title:    p.title,
          type:     p.type,
          status:   p.status,
          date:     p.date,
          address:  p.address,
          rooms:    p.rooms,
          photos:   (p.photos  || []),   // includes dataUrl base64
          videos:   (p.videos  || []).map(v => ({ ...v, dataUrl: undefined, _blob: undefined })), // strip blobs
          reports:  p.reports  || [],
          files:    (p.files   || []).map(f => ({ ...f, dataUrl: undefined })), // strip file data
          notes:    p.notes    || [],
          tasks:    p.tasks    || [],
          checklists: p.checklists || [],
          gps:      p.gps,
          coords:   p.coords,
        })),
      };

      const json = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `krakencam-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      console.error("Export failed:", e);
    }
    setExporting(false);
  };
  const [pwForm, setPwForm] = useState({ current:"", newPw:"", confirm:"" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const validatePassword = (pw) => {
    if (pw.length < 8)             return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))         return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(pw))         return "Password must include at least one lowercase letter.";
    if (!/[0-9]/.test(pw))         return "Password must include at least one number.";
    return null;
  };

  const handleUpdatePassword = async () => {
    setPwError(""); setPwSuccess(false);
    if (!pwForm.current) return setPwError("Please enter your current password.");
    const err = validatePassword(pwForm.newPw);
    if (err) return setPwError(err);
    if (pwForm.newPw !== pwForm.confirm) return setPwError("New passwords do not match.");
    try {
      // Re-authenticate with current password first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return setPwError("Could not verify your account. Please sign out and back in.");
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.current });
      if (signInErr) return setPwError("Current password is incorrect.");
      // Now update to new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (updateErr) return setPwError(updateErr.message || "Failed to update password.");
      setPwSuccess(true);
      setPwForm({ current:"", newPw:"", confirm:"" });
    } catch (e) {
      setPwError("An error occurred. Please try again.");
    }
  };
  const logoRef   = useRef();
  const avatarRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Apply mode change immediately so the UI updates live (before Save)
  const applyMode = (mode) => {
    const applyDark = () => {
      document.documentElement.style.setProperty("--bg",       "#0d0f14");
      document.documentElement.style.setProperty("--surface",  "#13161e");
      document.documentElement.style.setProperty("--surface2", "#1a1e28");
      document.documentElement.style.setProperty("--surface3", "#22273a");
      document.documentElement.style.setProperty("--border",   "#2a2f42");
      document.documentElement.style.setProperty("--text",     "#f0f2f7");
      document.documentElement.style.setProperty("--text2",    "#8b9ab8");
      document.documentElement.style.setProperty("--text3",    "#4a5570");
    };
    const applyLight = () => {
      document.documentElement.style.setProperty("--bg",       "#f0f2f5");
      document.documentElement.style.setProperty("--surface",  "#ffffff");
      document.documentElement.style.setProperty("--surface2", "#f5f6fa");
      document.documentElement.style.setProperty("--surface3", "#e8eaf0");
      document.documentElement.style.setProperty("--border",   "#d8dce8");
      document.documentElement.style.setProperty("--text",     "#111827");
      document.documentElement.style.setProperty("--text2",    "#4b5563");
      document.documentElement.style.setProperty("--text3",    "#9ca3af");
    };
    if (mode === "light") applyLight();
    else if (mode === "dark") applyDark();
    else window.matchMedia("(prefers-color-scheme: light)").matches ? applyLight() : applyDark();
  };

  // Apply density immediately
  const applyDensity = (density) => {
    if (density === "compact") {
      document.documentElement.style.setProperty("--density-page-pad",  "16px");
      document.documentElement.style.setProperty("--density-nav-pad",   "10px 8px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "6px 10px");
      document.documentElement.style.setProperty("--density-card-pad",  "14px");
      document.documentElement.style.setProperty("--density-gap",       "12px");
      document.documentElement.style.setProperty("--density-font",      "12.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "48px");
    } else {
      document.documentElement.style.setProperty("--density-page-pad",  "26px");
      document.documentElement.style.setProperty("--density-nav-pad",   "14px 12px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "9px 12px");
      document.documentElement.style.setProperty("--density-card-pad",  "20px");
      document.documentElement.style.setProperty("--density-gap",       "20px");
      document.documentElement.style.setProperty("--density-font",      "13.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "58px");
    }
  };

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("userAvatar", ev.target.result);
    reader.readAsDataURL(file);
  };

  const TABS = [
    { id:"company",    label:"Company",        icon:ic.building,  mobileHidden:true },
    { id:"appearance", label:"Appearance",     icon:ic.grid       },
    { id:"account",    label:"Account",        icon:ic.user       },
    { id:"reports",    label:"Report Defaults",icon:ic.reports,   mobileHidden:true },
    ...(REPORT_EMAIL_FEATURE_VISIBLE ? [{ id:"email", label:"Email", icon:ic.mail, mobileHidden:true }] : []),
    { id:"prefs",      label:"Settings",       icon:ic.settings   },
    { id:"projects",   label:"Project Settings",icon:ic.folder,    mobileHidden:true },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const visibleTabs = TABS.filter(t => !(isMobile && t.mobileHidden));

  useEffect(() => {
    if (!REPORT_EMAIL_FEATURE_VISIBLE && tab === "email") setTab(isMobile ? "appearance" : "company");
  }, [tab, isMobile]);

  return (
    <div className="page fade-in" style={{ maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <div className="section-title">Settings</div>
        <div className="section-sub">Manage your company profile, appearance, account, and report defaults</div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex",borderBottom:"1px solid var(--border)",marginBottom:28 }}>
        {visibleTabs.map(t => (
          <button key={t.id} className="btn btn-ghost btn-sm"
            style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,gap:6,flex:1,justifyContent:"center" }}
            onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ââ COMPANY ââ */}
      {tab === "company" && (
        <div className="fade-in">
          {/* Logo upload */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Company Logo</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:24 }}>
                <div style={{ width:96,height:96,borderRadius:14,background:"var(--surface2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,cursor:"pointer" }}
                  onClick={() => logoRef.current?.click()}>
                  {form.logo
                    ? <img src={form.logo} alt="logo" style={{ width:"100%",height:"100%",objectFit:"contain",padding:8 }} />
                    : <div style={{ textAlign:"center",color:"var(--text3)" }}><Icon d={ic.image} size={28} /><div style={{ fontSize:10,marginTop:4 }}>Upload</div></div>
                  }
                </div>
                <div>
                  <div style={{ fontWeight:600,fontSize:13.5,marginBottom:6 }}>Company Logo</div>
                  <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:12,lineHeight:1.6 }}>
                    Appears in the nav sidebar and on all generated reports.<br />Recommended: PNG with transparent background, min 200×200px.
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                      <Icon d={ic.image} size={13} /> Upload Logo
                    </button>
                    {form.logo && <button className="btn btn-danger btn-sm" onClick={() => set("logo", null)}>
                      <Icon d={ic.trash} size={13} /> Remove
                    </button>}
                  </div>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Company details */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Company Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" placeholder="Apex Field Services Ltd." value={form.companyName} onChange={e => set("companyName", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">License / Registration #</label><input className="form-input" placeholder="e.g. LIC-2024-00482" value={form.license} onChange={e => set("license", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Primary Email</label><input className="form-input" type="email" placeholder="info@apexfieldservices.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" placeholder="(555) 400-7890" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Street Address</label><input className="form-input" placeholder="400 Industrial Pkwy" value={form.address} onChange={e => set("address", e.target.value)} /></div>
              <div className="form-row-3">
                <div className="form-group"><label className="form-label">City</label><input className="form-input" placeholder="Springfield" value={form.city} onChange={e => set("city", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" placeholder="IL or ON" value={form.state} onChange={e => set("state", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">ZIP / Postal Code</label><input className="form-input" placeholder="62701 or K1A 0A6" value={form.zip} onChange={e => set("zip", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Website</label><input className="form-input" placeholder="https://apexfieldservices.com" value={form.website} onChange={e => set("website", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Industry</label>
                  <select className="form-input form-select" value={form.industry} onChange={e => set("industry", e.target.value)}>
                    {["","Restoration & Remediation","Insurance Adjuster","Property Inspector","Plumbing","Electrical","HVAC","Roofing","Landscaping","Siding","Other"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ââ APPEARANCE ââ */}
      {tab === "appearance" && (
        <div className="fade-in">
          {/* Mode */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Color Mode</span></div>
            <div className="card-body">
              <div style={{ display:"flex",gap:12 }}>
                {[
                  { id:"dark",  label:"Dark",  desc:"Dark backgrounds, easy on the eyes in low light.", icon:"ð" },
                  { id:"light", label:"Light", desc:"Clean white UI, great for bright environments.",   icon:"âï¸" },
                  { id:"system",label:"System",desc:"Follows your device's OS preference automatically.",icon:"ð»", mobileHidden:true },
                ].filter(m => !(window.innerWidth <= 768 && m.mobileHidden)).map(m => (
                  <div key={m.id} onClick={() => { set("mode", m.id); applyMode(m.id); }}
                    style={{ flex:1,border:`2px solid ${form.mode===m.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"16px 14px",cursor:"pointer",background:form.mode===m.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                    <div style={{ fontSize:24,marginBottom:8 }}>{m.icon}</div>
                    <div style={{ fontWeight:700,fontSize:13.5,marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>{m.desc}</div>
                    {form.mode===m.id && <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:10,fontSize:11.5,color:"var(--accent)",fontWeight:600 }}><Icon d={ic.check} size={12} /> Active</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Accent color */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Accent Color</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:16 }}>Used for buttons, highlights, active states, and report accents across the entire app.</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20 }}>
                {ACCENT_PRESETS.map(p => (
                  <div key={p.value} onClick={() => set("accent", p.value)}
                    style={{ border:`2px solid ${form.accent===p.value?"var(--text)":"transparent"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",background:"var(--surface2)",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
                    <div style={{ width:36,height:36,borderRadius:8,background:p.value,boxShadow:form.accent===p.value?`0 0 0 3px ${p.value}44`:"none" }} />
                    <div style={{ fontSize:11.5,fontWeight:600,color:form.accent===p.value?"var(--text)":"var(--text2)" }}>{p.name}</div>
                    {form.accent===p.value && <Icon d={ic.check} size={12} stroke={p.value} />}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ fontSize:12.5,fontWeight:600,color:"var(--text2)" }}>Custom color</div>
                <div style={{ position:"relative" }}>
                  <input type="color" value={form.accent} onChange={e => set("accent", e.target.value)}
                    style={{ width:42,height:42,borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",background:"none",padding:2 }} />
                </div>
                <div style={{ fontFamily:"monospace",fontSize:12,color:"var(--text2)",background:"var(--surface2)",padding:"4px 10px",borderRadius:6 }}>{form.accent}</div>
              </div>

              {/* Live preview */}
              <div style={{ marginTop:20,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11.5,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Preview</div>
                <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
                  <button style={{ background:form.accent,color:"white",border:"none",padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"default" }}>Primary Button</button>
                  <button style={{ background:`${form.accent}18`,color:form.accent,border:`1px solid ${form.accent}44`,padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"default" }}>Outline Button</button>
                  <div style={{ display:"flex",alignItems:"center",gap:5,background:`${form.accent}18`,padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:600,color:form.accent }}>
                    <Icon d={ic.check} size={12} stroke={form.accent} /> Active Tag
                  </div>
                  <div style={{ width:24,height:24,borderRadius:6,background:form.accent }} />
                </div>
              </div>
            </div>
          </div>

          {/* UI density */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Interface Density</span></div>
            <div className="card-body">
              <div style={{ display:"flex",gap:10 }}>
                {[{id:"comfortable",label:"Comfortable",desc:"More spacing, easier to tap"},{id:"compact",label:"Compact",desc:"Denser layout, more content visible"}].map(d => (
                  <div key={d.id} onClick={() => { set("density", d.id); applyDensity(d.id); }}
                    style={{ flex:1,border:`2px solid ${form.density===d.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"14px",cursor:"pointer",background:form.density===d.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                    <div style={{ fontWeight:700,fontSize:13,marginBottom:3 }}>{d.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)" }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Camera Roll â mobile only */}
          {false && null}
        </div>
      )}

      {/* ââ ACCOUNT ââ */}
      {tab === "account" && (
        <div className="fade-in">
          {/* Profile */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Profile Information</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:20,marginBottom:22 }}>
                <div style={{ position:"relative",flexShrink:0 }}>
                  <div onClick={() => avatarRef.current.click()}
                    style={{ width:72,height:72,borderRadius:"50%",background:form.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"white",cursor:"pointer",overflow:"hidden",border:`3px solid ${form.accent}`,boxShadow:"0 0 0 3px var(--surface)" }}>
                    {form.userAvatar
                      ? <img src={form.userAvatar} alt="avatar" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : <>{form.userFirstName?.[0]?.toUpperCase()}{form.userLastName?.[0]?.toUpperCase()}</>
                    }
                  </div>
                  {/* Camera overlay on hover */}
                  <div onClick={() => avatarRef.current.click()}
                    style={{ position:"absolute",inset:0,borderRadius:"50%",background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",opacity:0,transition:"opacity .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1}
                    onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <Icon d={ic.camera} size={20} stroke="white" />
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAvatarUpload} />
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:16,marginBottom:3 }}>{form.userFirstName} {form.userLastName}</div>
                  <div style={{ fontSize:13,color:"var(--text2)",marginBottom:6 }}>{form.userEmail}</div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <span style={{ background:`${form.accent}18`,color:form.accent,fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20 }}>{PLAN_NAMES[form.plan||"base"]}</span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5,padding:"3px 10px",color:"var(--text3)" }} onClick={() => avatarRef.current.click()}>
                      <Icon d={ic.camera} size={12} /> Change Photo
                    </button>
                    {form.userAvatar && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5,padding:"3px 10px",color:"var(--text3)" }} onClick={() => set("userAvatar", null)}>
                        <Icon d={ic.trash} size={12} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={form.userFirstName} onChange={e => set("userFirstName", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.userLastName} onChange={e => set("userLastName", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" value={form.userEmail} onChange={e => set("userEmail", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={form.userTitle} onChange={e => set("userTitle", e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Mobile Phone</label><input className="form-input" value={form.userPhone} onChange={e => set("userPhone", e.target.value)} /></div>
            </div>
          </div>

          {/* Change password */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Change Password</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:16,lineHeight:1.6 }}>
                Must be at least 8 characters and include at least one uppercase letter, one lowercase letter, and one number.
              </div>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" placeholder="Enter current password" value={pwForm.current} onChange={e => setPwForm(f=>({...f,current:e.target.value}))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" placeholder="Min 8 characters" value={pwForm.newPw}
                    onChange={e => { setPwForm(f=>({...f,newPw:e.target.value})); setPwError(""); setPwSuccess(false); }}
                    style={{ borderColor: pwForm.newPw && validatePassword(pwForm.newPw) ? "#c0392b" : undefined }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" placeholder="Repeat new password" value={pwForm.confirm}
                    onChange={e => { setPwForm(f=>({...f,confirm:e.target.value})); setPwError(""); setPwSuccess(false); }}
                    style={{ borderColor: pwForm.confirm && pwForm.confirm !== pwForm.newPw ? "#c0392b" : undefined }} />
                </div>
              </div>
              {pwForm.newPw.length > 0 && (
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:12 }}>
                  {[
                    { label:"8+ chars",  ok: pwForm.newPw.length >= 8 },
                    { label:"Uppercase", ok: /[A-Z]/.test(pwForm.newPw) },
                    { label:"Lowercase", ok: /[a-z]/.test(pwForm.newPw) },
                    { label:"Number",    ok: /[0-9]/.test(pwForm.newPw) },
                  ].map(r => (
                    <span key={r.label} style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,
                      background: r.ok ? "#3dba7e22" : "var(--surface2)",
                      color: r.ok ? "#3dba7e" : "var(--text3)",
                      border: `1px solid ${r.ok ? "#3dba7e44" : "var(--border)"}` }}>
                      {r.ok ? "â" : "â"} {r.label}
                    </span>
                  ))}
                </div>
              )}
              {pwError   && <div style={{ fontSize:12.5,color:"#c0392b",marginBottom:10,padding:"8px 12px",background:"#c0392b15",borderRadius:"var(--radius-sm)",border:"1px solid #c0392b44" }}>{pwError}</div>}
              {pwSuccess && <div style={{ fontSize:12.5,color:"#3dba7e",marginBottom:10,padding:"8px 12px",background:"#3dba7e15",borderRadius:"var(--radius-sm)",border:"1px solid #3dba7e44" }}>â Password updated successfully.</div>}
              <button className="btn btn-secondary btn-sm" onClick={handleUpdatePassword}><Icon d={ic.check} size={13} /> Update Password</button>
            </div>
          </div>

          {/* Danger zone â admin only, desktop only */}
          {form.userRole === "admin" && !isMobile && (
            <div style={{ marginTop:32,paddingTop:24,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:10,alignItems:"center" }}>
              {/* Export Data */}
              <button
                onClick={() => { setShowExportModal(true); setExportDone(false); }}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:12,fontWeight:600,borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:"transparent",color:"var(--text2)",cursor:"pointer",opacity:0.85,transition:"opacity .15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity=1}
                onMouseLeave={e => e.currentTarget.style.opacity=0.85}>
                <Icon d={ic.download} size={13} /> Export My Data
              </button>
              {/* Delete Account */}
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(""); }}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:12,fontWeight:600,borderRadius:"var(--radius-sm)",border:"1px solid #b03030",background:"transparent",color:"#c0392b",cursor:"pointer",opacity:0.8,transition:"opacity .15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity=1}
                onMouseLeave={e => e.currentTarget.style.opacity=0.8}>
                <Icon d={ic.trash} size={13} stroke="#c0392b" /> Delete Account
              </button>
            </div>
          )}

          {/* Export Data Modal */}
          {showExportModal && form.userRole === "admin" && !isMobile && (
            <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
              <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",maxWidth:480,width:"100%",padding:28,boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:"rgba(74,144,217,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Icon d={ic.download} size={20} stroke="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:16,color:"var(--text)" }}>Export Your Data</div>
                    <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>Download everything in your account as a JSON file</div>
                  </div>
                </div>

                <div style={{ background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"12px 16px",marginBottom:20,fontSize:13,color:"var(--text)",lineHeight:1.7 }}>
                  <strong>Your export will include:</strong>
                  <ul style={{ margin:"8px 0 0 0",paddingLeft:18,color:"var(--text2)" }}>
                    <li>All jobsites and project data</li>
                    <li>All photos (full resolution)</li>
                    <li>All reports, checklists, and notes</li>
                    <li>Team members and account settings</li>
                    <li>GPS coordinates and timestamps</li>
                  </ul>
                  <div style={{ marginTop:10,fontSize:12,color:"var(--text3)" }}>
                    â ï¸ Photos are included as base64 â the file may be large depending on how many you have.
                  </div>
                </div>

                {exportDone && (
                  <div style={{ background:"rgba(61,186,126,.1)",border:"1px solid rgba(61,186,126,.3)",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:16,fontSize:13,color:"#3dba7e",fontWeight:600 }}>
                    â Export downloaded successfully!
                  </div>
                )}

                <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(false)}>Close</button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={exporting}
                    onClick={handleExportData}
                    style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <Icon d={ic.download} size={13} />
                    {exporting ? "Preparing exportâ¦" : "Download My Data"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {showDeleteModal && form.userRole === "admin" && !isMobile && (
            <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
              <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",maxWidth:460,width:"100%",padding:28,boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:"#b0303022",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Icon d={ic.alert} size={20} stroke="#c0392b" />
                  </div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:16,color:"#c0392b" }}>Delete Account</div>
                    <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>This action is permanent and cannot be undone</div>
                  </div>
                </div>

                <div style={{ background:"#b0303018",border:"1px solid #b0303040",borderRadius:"var(--radius-sm)",padding:"12px 16px",marginBottom:20,fontSize:13,color:"var(--text)",lineHeight:1.7 }}>
                  <strong>You will permanently lose:</strong>
                  <ul style={{ margin:"8px 0 0 0",paddingLeft:18,color:"var(--text2)" }}>
                    <li>All jobsites and project data</li>
                    <li>All photos, videos, and reports</li>
                    <li>All team members and account settings</li>
                    <li>All checklists and templates</li>
                    <li>Your billing history and subscription</li>
                  </ul>
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12.5,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8 }}>
                    Type <span style={{ fontFamily:"monospace",background:"var(--surface2)",padding:"1px 6px",borderRadius:4,color:"var(--text)",fontWeight:700 }}>DELETE</span> to confirm
                  </label>
                  <input
                    className="form-input"
                    placeholder="Type DELETE hereâ¦"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    style={{ borderColor: deleteConfirmText === "DELETE" ? "#c0392b" : undefined }}
                    autoFocus
                  />
                </div>

                <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}>Cancel</button>
                  <button
                    disabled={deleteConfirmText !== "DELETE"}
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); onDeleteAccount && onDeleteAccount(); }}
                    style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 18px",fontSize:13,fontWeight:600,borderRadius:"var(--radius-sm)",border:"none",background: deleteConfirmText === "DELETE" ? "#c0392b" : "var(--surface3)",color: deleteConfirmText === "DELETE" ? "white" : "var(--text3)",cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",transition:"all .15s" }}>
                    <Icon d={ic.trash} size={14} stroke="currentColor" /> Delete Everything
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ââ REPORT DEFAULTS ââ */}
      {tab === "reports" && (
        <div className="fade-in">
          {/* Header */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Header</span><span style={{ fontSize:11.5,color:"var(--text2)" }}>Appears at the top of every generated report</span></div>
            <div className="card-body">
              <div style={{ marginBottom:18,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Header Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"16px 20px",color:"#222" }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"2px solid "+form.accent,paddingBottom:12,marginBottom:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                      {form.logo
                        ? <img src={form.logo} alt="logo" style={{ height:40,width:40,objectFit:"contain" }} />
                        : <div style={{ width:40,height:40,borderRadius:8,background:form.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:14 }}>{(form.companyName||"AC")[0]}</div>
                      }
                      <div>
                        <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{form.companyName || "Your Company"}</div>
                        <div style={{ fontSize:11,color:"#666" }}>{form.phone} · {form.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right",fontSize:11,color:"#666",lineHeight:1.8 }}>
                      <div style={{ fontWeight:700,fontSize:13,color:"#111" }}>{form.reportHeaderTitle || "Property Inspection Report"}</div>
                      <div>{form.address}{form.city?`, ${form.city}`:""}</div>
                    </div>
                  </div>
                  {form.reportHeaderNote && <div style={{ fontSize:11,color:"#555",fontStyle:"italic" }}>{form.reportHeaderNote}</div>}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Header Title (e.g. "Property Inspection Report")</label><input className="form-input" value={form.reportHeaderTitle} onChange={e => set("reportHeaderTitle", e.target.value)} placeholder="Property Inspection Report" /></div>
              <div className="form-group"><label className="form-label">Header Tagline / Note (optional)</label><input className="form-input" value={form.reportHeaderNote} onChange={e => set("reportHeaderNote", e.target.value)} placeholder="Licensed & Insured · Serving the Greater Denver Area" /></div>
            </div>
          </div>

          {/* Footer */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Footer</span><span style={{ fontSize:11.5,color:"var(--text2)" }}>Appears at the bottom of every page</span></div>
            <div className="card-body">
              {/* Footer preview */}
              <div style={{ marginBottom:18,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Footer Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"12px 20px",color:"#222",borderTop:`2px solid ${form.accent}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10.5,color:"#666" }}>
                    <span>{form.reportFooterLeft || form.companyName || "Your Company"} · {form.phone}</span>
                    <span style={{ color:form.accent,fontWeight:600 }}>{form.reportFooterCenter || "Confidential"}</span>
                    <span>Page 1 of 1 · {formatDate(new Date().toISOString().slice(0,10), settings)}</span>
                  </div>
                  {form.reportFooterDisclaimer && <div style={{ marginTop:8,fontSize:9.5,color:"#aaa",lineHeight:1.5 }}>{form.reportFooterDisclaimer}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Footer Left Text</label><input className="form-input" value={form.reportFooterLeft} onChange={e => set("reportFooterLeft", e.target.value)} placeholder="Company name + phone" /></div>
                <div className="form-group"><label className="form-label">Footer Center Label</label><input className="form-input" value={form.reportFooterCenter} onChange={e => set("reportFooterCenter", e.target.value)} placeholder="Confidential" /></div>
              </div>
              <div className="form-group"><label className="form-label">Disclaimer / Legal Text (optional)</label><textarea className="form-input form-textarea" style={{ minHeight:64 }} value={form.reportFooterDisclaimer} onChange={e => set("reportFooterDisclaimer", e.target.value)} placeholder="This report is prepared for the exclusive use of the client named herein. Reproduction or distribution without written consent is prohibited." /></div>
            </div>
          </div>

          {/* Report defaults */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Defaults</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Default Report Type</label>
                  <select className="form-input form-select" value={form.defaultReportType} onChange={e => set("defaultReportType", e.target.value)}>
                    {["Assessment","Inspection","Quote","Progress Update","Damage Assessment","Insurance Report","Other"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Photo Layout</label>
                  <select className="form-input form-select" value={form.reportPhotoLayout} onChange={e => set("reportPhotoLayout", e.target.value)}>
                    {["2 per row","3 per row","4 per row","Full width"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Include GPS Coordinates</label>
                  <select className="form-input form-select" value={form.reportShowGps} onChange={e => set("reportShowGps", e.target.value)}>
                    <option value="yes">Yes â show on each photo</option>
                    <option value="summary">Summary page only</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Include Timestamps</label>
                  <select className="form-input form-select" value={form.reportShowTimestamp} onChange={e => set("reportShowTimestamp", e.target.value)}>
                    <option value="yes">Yes â on each photo</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "email" && (
        <div className="fade-in">
          {/* Email Template */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Email Template</span>
              <span style={{ fontSize:11.5,color:"var(--text2)" }}>Used when sending reports to clients or adjusters</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:12,color:"var(--text3)",lineHeight:1.7 }}>
                <strong style={{ color:"var(--text2)" }}>Available variables:</strong>{" "}
                {["{{company}}","{{project}}","{{address}}","{{recipient}}","{{reports_list}}","{{date}}","{{inspector}}"].map(v=>(
                  <span key={v} style={{ display:"inline-block",background:"var(--surface3)",border:"1px solid var(--border)",borderRadius:4,padding:"1px 7px",margin:"2px 3px",fontFamily:"monospace",fontSize:11.5,color:"var(--accent)" }}>{v}</span>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input className="form-input" value={form.emailSubject||""} onChange={e=>set("emailSubject",e.target.value)} placeholder="Report from {{company}} â {{project}}" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Body</label>
                <textarea className="form-input form-textarea" style={{ minHeight:180,fontSize:13,fontFamily:"inherit",lineHeight:1.7 }}
                  value={form.emailBody||""} onChange={e=>set("emailBody",e.target.value)}
                  placeholder={"Hello {{recipient}},\n\nPlease find attached the report(s) for {{project}}..."} />
                <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:6 }}>Your email signature will be appended automatically below the body.</div>
              </div>
            </div>
          </div>

          {/* Email Signature */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Email Signature</span>
              <span style={{ fontSize:11.5,color:"var(--text2)" }}>Appended to every outgoing report email</span>
            </div>
            <div className="card-body">
              {/* Signature preview */}
              <div style={{ marginBottom:20,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Signature Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"16px 20px",color:"#222",borderLeft:`3px solid ${form.accent}` }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:14 }}>
                    {form.emailSignatureLogoEnabled && form.logo && (
                      <img src={form.logo} alt="logo" style={{ height:40,width:40,objectFit:"contain",borderRadius:6,flexShrink:0 }} />
                    )}
                    <div>
                      <div style={{ fontWeight:700,fontSize:14,color:"#111",lineHeight:1.3 }}>
                        {form.emailSignatureName || `${form.userFirstName||""} ${form.userLastName||""}`.trim() || "Your Name"}
                      </div>
                      {(form.emailSignatureTitle||form.userTitle) && (
                        <div style={{ fontSize:12,color:"#555",marginTop:1 }}>{form.emailSignatureTitle||form.userTitle}</div>
                      )}
                      {(form.emailSignatureCompany||form.companyName) && (
                        <div style={{ fontSize:12,color:"#555" }}>{form.emailSignatureCompany||form.companyName}</div>
                      )}
                      <div style={{ marginTop:6,display:"flex",flexDirection:"column",gap:2 }}>
                        {(form.emailSignaturePhone||form.phone) && <div style={{ fontSize:11.5,color:"#666" }}>ð {form.emailSignaturePhone||form.phone}</div>}
                        {(form.emailSignatureEmail||form.email) && <div style={{ fontSize:11.5,color:"#666" }}>â {form.emailSignatureEmail||form.email}</div>}
                        {form.website && <div style={{ fontSize:11.5,color:form.accent }}>{form.website}</div>}
                      </div>
                    </div>
                  </div>
                  {/* Social icons preview â small clickable circles */}
                  {form.sigSocialsEnabled && (() => {
                    const SOCIALS = [
                      { key:"fb",  en:form.sigFacebookEnabled,  url:form.sigFacebookUrl,  icon:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",                                                      color:"#1877f2", label:"Facebook"  },
                      { key:"ig",  en:form.sigInstagramEnabled, url:form.sigInstagramUrl, icon:"M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2z", color:"#e1306c", label:"Instagram" },
                      { key:"x",   en:form.sigXEnabled,         url:form.sigXUrl,         icon:"M4 4l16 16M20 4L4 20",                                                                                                   color:"#111111", label:"X"         },
                      { key:"li",  en:form.sigLinkedInEnabled,  url:form.sigLinkedInUrl,  icon:"M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z", color:"#0a66c2", label:"LinkedIn"  },
                      { key:"yt",  en:form.sigYoutubeEnabled,   url:form.sigYoutubeUrl,   icon:"M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z", color:"#ff0000", label:"YouTube"   },
                    ].filter(x => x.en && x.url);
                    if (!SOCIALS.length) return null;
                    return (
                      <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #eee",display:"flex",gap:8,alignItems:"center" }}>
                        {SOCIALS.map(s => (
                          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}
                            style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:"50%",background:s.color,flexShrink:0,textDecoration:"none",cursor:"pointer" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Review button â clickable link */}
                  {form.sigReviewEnabled && form.sigReviewUrl && (
                    <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #eee" }}>
                      <a href={form.sigReviewUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:6,background:"#f59e0b",color:"white",fontSize:12.5,fontWeight:700,textDecoration:"none",cursor:"pointer" }}>
                        â­ {form.sigReviewLabel||"Leave us a Review"}
                      </a>
                    </div>
                  )}
                  {form.emailSignatureCustomHtml && (
                    <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #eee",fontSize:11.5,color:"#888" }}
                      dangerouslySetInnerHTML={{ __html: form.emailSignatureCustomHtml }} />
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" value={form.emailSignatureName||""} onChange={e=>set("emailSignatureName",e.target.value)} placeholder={`${form.userFirstName||""} ${form.userLastName||""}`.trim()||"Your name"} />
                </div>
                <div className="form-group">
                  <label className="form-label">Title / Role</label>
                  <input className="form-input" value={form.emailSignatureTitle||""} onChange={e=>set("emailSignatureTitle",e.target.value)} placeholder={form.userTitle||"e.g. Project Manager"} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" value={form.emailSignatureCompany||""} onChange={e=>set("emailSignatureCompany",e.target.value)} placeholder={form.companyName||"Company name"} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.emailSignaturePhone||""} onChange={e=>set("emailSignaturePhone",e.target.value)} placeholder={form.phone||"Phone number"} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={form.emailSignatureEmail||""} onChange={e=>set("emailSignatureEmail",e.target.value)} placeholder={form.email||"your@email.com"} />
                </div>
                <div className="form-group" style={{ display:"flex",alignItems:"center",gap:10,paddingTop:22 }}>
                  <input type="checkbox" id="sig_logo" checked={!!form.emailSignatureLogoEnabled} onChange={e=>set("emailSignatureLogoEnabled",e.target.checked)} style={{ accentColor:"var(--accent)" }} />
                  <label htmlFor="sig_logo" style={{ fontSize:13,cursor:"pointer" }}>Show company logo in signature</label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Custom HTML <span style={{ fontWeight:400,color:"var(--text3)" }}>(optional â added below signature)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight:72,fontSize:12,fontFamily:"monospace" }}
                  value={form.emailSignatureCustomHtml||""} onChange={e=>set("emailSignatureCustomHtml",e.target.value)}
                  placeholder={'<p style="color:#999">Licensed & Insured · CO License #12345</p>'} />
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Social Media Buttons</span>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginLeft:"auto" }}>
                <span style={{ fontSize:12,color:"var(--text3)" }}>Show in signature</span>
                <div onClick={() => set("sigSocialsEnabled", !form.sigSocialsEnabled)}
                  style={{ width:42,height:24,borderRadius:12,background:form.sigSocialsEnabled?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form.sigSocialsEnabled?21:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                </div>
              </div>
            </div>
            <div className="card-body" style={{ opacity:form.sigSocialsEnabled?1:0.45,pointerEvents:form.sigSocialsEnabled?"auto":"none",transition:"opacity .2s" }}>
              {[
                { enKey:"sigFacebookEnabled",  urlKey:"sigFacebookUrl",  color:"#1877f2", icon:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",                                                      label:"Facebook",  placeholder:"https://facebook.com/yourpage"   },
                { enKey:"sigInstagramEnabled", urlKey:"sigInstagramUrl", color:"#e1306c", icon:"M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2z", label:"Instagram", placeholder:"https://instagram.com/yourhandle" },
                { enKey:"sigXEnabled",         urlKey:"sigXUrl",         color:"#000000", icon:"M4 4l16 16M20 4L4 20",                                                                                                   label:"X (Twitter)",placeholder:"https://x.com/yourhandle"          },
                { enKey:"sigLinkedInEnabled",  urlKey:"sigLinkedInUrl",  color:"#0a66c2", icon:"M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z", label:"LinkedIn",   placeholder:"https://linkedin.com/company/yourco" },
                { enKey:"sigYoutubeEnabled",   urlKey:"sigYoutubeUrl",   color:"#ff0000", icon:"M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z", label:"YouTube", placeholder:"https://youtube.com/@yourchannel" },
              ].map(s => (
                <div key={s.enKey} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                  {/* Toggle */}
                  <div onClick={() => set(s.enKey, !form[s.enKey])}
                    style={{ width:38,height:22,borderRadius:11,background:form[s.enKey]?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                    <div style={{ width:16,height:16,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form[s.enKey]?19:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                  </div>
                  {/* Icon badge */}
                  <div style={{ width:30,height:30,borderRadius:6,background:s.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={s.icon}/>
                    </svg>
                  </div>
                  <span style={{ fontSize:13,fontWeight:600,width:90,flexShrink:0,color:form[s.enKey]?"var(--text)":"var(--text3)" }}>{s.label}</span>
                  <input className="form-input" style={{ flex:1,opacity:form[s.enKey]?1:0.5 }}
                    value={form[s.urlKey]||""} onChange={e=>set(s.urlKey,e.target.value)}
                    placeholder={s.placeholder} disabled={!form[s.enKey]} />
                </div>
              ))}
            </div>
          </div>

          {/* Leave a Review */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Leave a Review Button</span>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginLeft:"auto" }}>
                <span style={{ fontSize:12,color:"var(--text3)" }}>Show in signature</span>
                <div onClick={() => set("sigReviewEnabled", !form.sigReviewEnabled)}
                  style={{ width:42,height:24,borderRadius:12,background:form.sigReviewEnabled?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form.sigReviewEnabled?21:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                </div>
              </div>
            </div>
            <div className="card-body" style={{ opacity:form.sigReviewEnabled?1:0.45,pointerEvents:form.sigReviewEnabled?"auto":"none",transition:"opacity .2s" }}>
              <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:12.5,color:"var(--text3)" }}>
                Add a button that links clients to your Google Business review page, Yelp, Houzz, or any other review site.
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Button Label</label>
                  <input className="form-input" value={form.sigReviewLabel||""} onChange={e=>set("sigReviewLabel",e.target.value)} placeholder="Leave us a Review â­" />
                </div>
                <div className="form-group">
                  <label className="form-label">Review Link URL</label>
                  <input className="form-input" value={form.sigReviewUrl||""} onChange={e=>set("sigReviewUrl",e.target.value)} placeholder="https://g.page/r/your-google-review-link" />
                </div>
              </div>
              {form.sigReviewUrl && (
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>Preview:</span>
                  <a href={form.sigReviewUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:6,background:"#f59e0b",color:"white",fontSize:12.5,fontWeight:700,textDecoration:"none",cursor:"pointer" }}>
                    â­ {form.sigReviewLabel||"Leave us a Review"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ââ PREFS (Settings) ââ */}
      {tab === "prefs" && (
        <div className="fade-in">
          {/* Notifications */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Notifications</span></div>
            <div className="card-body">
              <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:12.5,color:"var(--text3)",lineHeight:1.55 }}>
                These settings control what appears in the notifications center for the current signed-in user.
              </div>
              {NOTIFICATION_PREF_ITEMS.map(n => (
                <div key={n.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight:600,fontSize:13.5,marginBottom:2 }}>{n.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)" }}>{n.desc}</div>
                  </div>
                  <div onClick={() => set(n.key, !form[n.key])}
                    style={{ width:44,height:24,borderRadius:12,background:form[n.key]?form.accent:"var(--surface3)",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0 }}>
                    <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form[n.key]?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camera */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>ð· Camera</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:0 }}>

              {/* Save to Camera Roll â mobile only */}
              {isMobile && (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer",paddingBottom:14,marginBottom:14,borderBottom:"1px solid var(--border)" }}
                  onClick={() => set("saveToCameraRoll", !form.saveToCameraRoll)}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:13.5,marginBottom:3 }}>Save to Camera Roll</div>
                    <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>Automatically save every photo you take to a SiteSnap folder on your device.</div>
                  </div>
                  <div style={{ flexShrink:0,width:48,height:28,borderRadius:14,background:form.saveToCameraRoll?"var(--accent)":"var(--border)",transition:"background .2s",position:"relative" }}>
                    <div style={{ position:"absolute",top:3,left:form.saveToCameraRoll?22:3,width:22,height:22,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,.3)",transition:"left .2s" }} />
                  </div>
                </div>
              )}

              {/* Photo Quality */}
              <div>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:4 }}>Picture Quality</div>
                <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,lineHeight:1.5 }}>Higher quality produces sharper images but larger file sizes.</div>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"low",      label:"Low",      desc:"720p · 50% JPEG",   icon:"ð" },
                    { id:"moderate", label:"Moderate", desc:"1080p · 85% JPEG",  icon:"â¡" },
                    { id:"high",     label:"High",     desc:"4K · 97% JPEG",     icon:"ð" },
                  ].map(q => (
                    <div key={q.id} onClick={() => set("photoQuality", q.id)}
                      style={{ flex:1,border:`2px solid ${form.photoQuality===q.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"12px 10px",cursor:"pointer",background:form.photoQuality===q.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontSize:20,marginBottom:6 }}>{q.icon}</div>
                      <div style={{ fontWeight:700,fontSize:13,marginBottom:2,color:form.photoQuality===q.id?"var(--accent)":"var(--text)" }}>{q.label}</div>
                      <div style={{ fontSize:11,color:"var(--text3)" }}>{q.desc}</div>
                      {form.photoQuality===q.id && <div style={{ marginTop:6,fontSize:11,color:"var(--accent)",fontWeight:600 }}>â Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:18,marginTop:6 }}>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:4 }}>Video Quality</div>
                <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,lineHeight:1.5 }}>Higher quality produces sharper video but uses more storage and bandwidth.</div>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"low",      label:"Low",      desc:"1 Mbps",   icon:"ð" },
                    { id:"moderate", label:"Moderate", desc:"2.5 Mbps", icon:"â¡" },
                    { id:"high",     label:"High",     desc:"5 Mbps",   icon:"ð" },
                  ].map(q => (
                    <div key={q.id} onClick={() => set("videoQuality", q.id)}
                      style={{ flex:1,border:`2px solid ${form.videoQuality===q.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"12px 10px",cursor:"pointer",background:form.videoQuality===q.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontSize:20,marginBottom:6 }}>{q.icon}</div>
                      <div style={{ fontWeight:700,fontSize:13,marginBottom:2,color:form.videoQuality===q.id?"var(--accent)":"var(--text)" }}>{q.label}</div>
                      <div style={{ fontSize:11,color:"var(--text3)" }}>{q.desc}</div>
                      {form.videoQuality===q.id && <div style={{ marginTop:6,fontSize:11,color:"var(--accent)",fontWeight:600 }}>â Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:18,marginTop:6 }}>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:4 }}>Save Media to Device</div>
                <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,lineHeight:1.5 }}>
                  When enabled, accepted field photos and videos are saved into KrakenCam and also downloaded to the user&apos;s phone, tablet, or desktop.
                </div>
                <button
                  type="button"
                  onClick={() => set("saveToCameraRoll", !form.saveToCameraRoll)}
                  style={{
                    width:"100%",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"space-between",
                    gap:12,
                    padding:"13px 14px",
                    borderRadius:"var(--radius)",
                    border:`2px solid ${form.saveToCameraRoll ? "var(--accent)" : "var(--border)"}`,
                    background:form.saveToCameraRoll ? "var(--accent-glow)" : "var(--surface2)",
                    color:"var(--text)",
                    cursor:"pointer",
                    transition:"all .15s",
                  }}
                >
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontWeight:700,fontSize:13,color:form.saveToCameraRoll ? "var(--accent)" : "var(--text)" }}>
                      {form.saveToCameraRoll ? "On â save to app and device" : "Off â save to app only"}
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:3 }}>
                      Uses the browser/device download flow during capture review.
                    </div>
                  </div>
                  <div
                    style={{
                      width:48,
                      height:28,
                      borderRadius:999,
                      background:form.saveToCameraRoll ? "var(--accent)" : "var(--surface3)",
                      border:`1px solid ${form.saveToCameraRoll ? "var(--accent)" : "var(--border)"}`,
                      position:"relative",
                      flexShrink:0,
                      transition:"all .15s",
                    }}
                  >
                    <div
                      style={{
                        position:"absolute",
                        top:3,
                        left:form.saveToCameraRoll ? 23 : 3,
                        width:20,
                        height:20,
                        borderRadius:"50%",
                        background:"#fff",
                        boxShadow:"0 2px 6px rgba(0,0,0,.22)",
                        transition:"left .15s",
                      }}
                    />
                  </div>
                </button>
              </div>

            </div>
          </div>

          {/* General preferences */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>General</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:20 }}>

              {/* Timezone */}
              <div>
                <label className="form-label" style={{ marginBottom:6,display:"block" }}>Timezone</label>
                <select className="form-input form-select" value={form.timezone||"America/Denver"} onChange={e => set("timezone", e.target.value)}>
                  {[
                    ["Pacific/Honolulu",   "Hawaii (UTCâ10)"],
                    ["America/Anchorage",  "Alaska (UTCâ9)"],
                    ["America/Los_Angeles","Pacific Time (UTCâ8)"],
                    ["America/Denver",     "Mountain Time (UTCâ7)"],
                    ["America/Chicago",    "Central Time (UTCâ6)"],
                    ["America/New_York",   "Eastern Time (UTCâ5)"],
                    ["America/Halifax",    "Atlantic Time (UTCâ4)"],
                    ["America/St_Johns",   "Newfoundland (UTCâ3:30)"],
                    ["America/Sao_Paulo",  "Brasília (UTCâ3)"],
                    ["UTC",                "UTC (UTC+0)"],
                    ["Europe/London",      "London (UTC+0/+1)"],
                    ["Europe/Paris",       "Central European (UTC+1/+2)"],
                    ["Europe/Helsinki",    "Eastern European (UTC+2/+3)"],
                    ["Europe/Moscow",      "Moscow (UTC+3)"],
                    ["Asia/Dubai",         "Gulf (UTC+4)"],
                    ["Asia/Karachi",       "Pakistan (UTC+5)"],
                    ["Asia/Kolkata",       "India (UTC+5:30)"],
                    ["Asia/Dhaka",         "Bangladesh (UTC+6)"],
                    ["Asia/Bangkok",       "Indochina (UTC+7)"],
                    ["Asia/Shanghai",      "China (UTC+8)"],
                    ["Asia/Tokyo",         "Japan (UTC+9)"],
                    ["Australia/Sydney",   "Sydney (UTC+10/+11)"],
                    ["Pacific/Auckland",   "New Zealand (UTC+12/+13)"],
                  ].map(([val,label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:5 }}>
                  Current time: {new Date().toLocaleTimeString("en-US", { timeZone: form.timezone||"America/Denver", hour:"2-digit", minute:"2-digit", hour12: form.timeFormat!=="24hr" })} â {form.timezone||"America/Denver"}
                </div>
              </div>

              {/* Date format */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Date Format</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                  {[
                    { id:"MM/DD/YYYY", example: "03/25/2025" },
                    { id:"DD/MM/YYYY", example: "25/03/2025" },
                    { id:"YYYY-MM-DD", example: "2025-03-25" },
                    { id:"MMM D, YYYY",example: "Mar 25, 2025" },
                  ].map(d => (
                    <div key={d.id} onClick={() => set("dateFormat", d.id)}
                      style={{ flex:1,minWidth:120,border:`2px solid ${form.dateFormat===d.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"10px 14px",cursor:"pointer",background:form.dateFormat===d.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                      <div style={{ fontWeight:700,fontSize:12.5,color:form.dateFormat===d.id?"var(--accent)":"var(--text)",marginBottom:2 }}>{d.id}</div>
                      <div style={{ fontSize:11.5,color:"var(--text3)" }}>{d.example}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time format */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Time Format</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"12hr", label:"12-Hour", example:"2:30 PM" },
                    { id:"24hr", label:"24-Hour", example:"14:30"   },
                  ].map(t => (
                    <div key={t.id} onClick={() => set("timeFormat", t.id)}
                      style={{ flex:1,border:`2px solid ${form.timeFormat===t.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",cursor:"pointer",background:form.timeFormat===t.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontWeight:700,fontSize:13.5,color:form.timeFormat===t.id?"var(--accent)":"var(--text)",marginBottom:3 }}>{t.label}</div>
                      <div style={{ fontSize:12,color:"var(--text3)" }}>{t.example}</div>
                      {form.timeFormat===t.id && <div style={{ fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:4 }}>â Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Measurement units */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Measurement Units</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"imperial", label:"Imperial", example:"ft, in, lbs, °F", icon:"ðºð¸" },
                    { id:"metric",   label:"Metric",   example:"m, cm, kg, °C",   icon:"ð" },
                  ].map(u => (
                    <div key={u.id} onClick={() => set("units", u.id)}
                      style={{ flex:1,border:`2px solid ${form.units===u.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",cursor:"pointer",background:form.units===u.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontSize:22,marginBottom:5 }}>{u.icon}</div>
                      <div style={{ fontWeight:700,fontSize:13.5,color:form.units===u.id?"var(--accent)":"var(--text)",marginBottom:3 }}>{u.label}</div>
                      <div style={{ fontSize:12,color:"var(--text3)" }}>{u.example}</div>
                      {form.units===u.id && <div style={{ fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:4 }}>â Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Default project sort order */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Default Project Sorting Order</label>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {[
                    { id:"recent",   label:"Most Recent",          desc:"Last modified or updated first" },
                    { id:"newest",   label:"Newest to Oldest",     desc:"By creation date, newest first" },
                    { id:"oldest",   label:"Oldest to Newest",     desc:"By creation date, oldest first" },
                    { id:"alpha",    label:"Name A â Z",           desc:"Alphabetical by project name"   },
                  ].map(s => (
                    <div key={s.id} onClick={() => set("projectSort", s.id)}
                      style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",border:`2px solid ${form.projectSort===s.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",cursor:"pointer",background:form.projectSort===s.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                      <div>
                        <div style={{ fontWeight:600,fontSize:13,color:form.projectSort===s.id?"var(--accent)":"var(--text)" }}>{s.label}</div>
                        <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:1 }}>{s.desc}</div>
                      </div>
                      {form.projectSort===s.id && <Icon d={ic.check} size={16} stroke="var(--accent)" />}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* About */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>About</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:16 }}>
              <div style={{ display:"flex",alignItems:"center",gap:14 }}>
                <div style={{ width:48,height:48,borderRadius:12,background:"#0d1a2e",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden" }}>
                  <img src={KRAKENCAM_LOGO} alt="KrakenCam" style={{ width:40,height:40,objectFit:"contain" }} />
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:15 }}>KrakenCam</div>
                  <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>Version 1.0.0</div>
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:14,display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ fontSize:12.5,color:"var(--text2)",lineHeight:1.6 }}>
                  Built for field professionals who need fast, reliable jobsite documentation. Questions, feedback, or issues? We're here to help.
                </div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <a
                    href="mailto:support@krakencam.com"
                    className="btn btn-primary btn-sm"
                    style={{ display:"flex",alignItems:"center",gap:7,textDecoration:"none" }}>
                    <Icon d={ic.mail} size={13} /> Email Support
                  </a>
                  <a
                    href="mailto:info@krakencam.com"
                    className="btn btn-secondary btn-sm"
                    style={{ display:"flex",alignItems:"center",gap:7,textDecoration:"none" }}>
                    <Icon d={ic.mail} size={13} /> Sales Inquiry
                  </a>
                </div>
                <div style={{ fontSize:11.5,color:"var(--text3)" }}>
                  ð§ support@krakencam.com &nbsp;·&nbsp; info@krakencam.com
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
                <div style={{ fontSize:11.5,color:"var(--text3)" }}>
                  © {new Date().getFullYear()} KrakenCam Inc. All rights reserved.
                </div>
                <div style={{ display:"flex",gap:12 }}>
                  <a href="https://www.krakencam.com/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ fontSize:11.5,color:"var(--text3)",textDecoration:"underline" }}>Privacy Policy</a>
                  <a href="https://www.krakencam.com/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ fontSize:11.5,color:"var(--text3)",textDecoration:"underline" }}>Terms of Use</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ââ PROJECT SETTINGS ââ */}
      {tab === "projects" && (
        <div className="fade-in">
          {[
            {
              key: "projectTypes",
              label: "Project Types",
              desc: "Options shown in the Project Type dropdown when creating or editing a jobsite.",
              defaults: ["Renovation","Insurance Claim","Inspection","Repair","New Construction","Mitigation","Remediation","Demolition","Consultation","Quote Request","Other"],
            },
            {
              key: "projectStatuses",
              label: "Project Statuses",
              desc: "Status options shown when creating or editing a jobsite. Each status has a label and colour.",
              defaults: [{id:"active",label:"Active",cls:"green"},{id:"onhold",label:"On Hold",cls:"orange"},{id:"completed",label:"Completed",cls:"blue"},{id:"archived",label:"Archived",cls:"purple"}],
              isStatuses: true
            },
            {
              key: "causeOfLossOptions",
              label: "Cause of Loss / Issue",
              desc: "Options shown in the Cause of Loss dropdown.",
              defaults: ["Water â Pipe Burst","Water â Flooding","Water â Sewage Backup","Water â Roof Leak","Fire â Structure","Fire â Smoke/Soot","Wind / Storm Damage","Mold / Microbial","Impact / Collision","Vandalism / Break-In","Earthquake","Hail","Electrical","Other"],
            },
            {
              key: "coverageTypeOptions",
              label: "Coverage Types",
              desc: "Options shown in the Coverage Type dropdown (Insurance section).",
              defaults: ["Dwelling","Contents","Liability","ALE (Additional Living Expenses)","Commercial Property","Business Interruption","Flood","Other"],
            },
          ].map(({ key, label, desc, defaults, isStatuses }) => {
            const rawVal = form[key];
            const items = key === "projectStatuses"
              ? (normaliseStatuses(rawVal) || defaults)
              : (rawVal || defaults);
            const addItem = (val) => {
              const v = val.trim();
              if (!v || items.includes(v)) return;
              set(key, [...items, v]);
            };
            const removeItem = (item) => set(key, items.filter(x => x !== item));
            const moveItem = (from, to) => {
              if (to < 0 || to >= items.length) return;
              const next = [...items];
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              set(key, next);
            };
            return (
              <div className="card" key={key} style={{ marginBottom:20 }}>
                <div className="card-header">
                  <span style={{ fontWeight:700 }}>{label}</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5,color:"var(--text3)",marginLeft:"auto" }}
                    onClick={() => set(key, [...defaults])}>Reset to defaults</button>
                </div>
                <div className="card-body">
                  <div style={{ fontSize:12,color:"var(--text2)",marginBottom:14 }}>{desc}</div>
                  {isStatuses ? (
                    <StatusListEditor items={items} onChange={v => set(key, v)} />
                  ) : (
                    <>
                      <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:12 }}>
                        {items.map((item, idx) => (
                          <div key={item} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)" }}>
                            <div style={{ display:"flex",flexDirection:"column",gap:2,flexShrink:0 }}>
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ width:20,height:16,padding:0,opacity:idx===0?0.3:1 }}
                                onClick={() => moveItem(idx, idx-1)} disabled={idx===0}>
                                <Icon d="M18 15l-6-6-6 6" size={11}/>
                              </button>
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ width:20,height:16,padding:0,opacity:idx===items.length-1?0.3:1 }}
                                onClick={() => moveItem(idx, idx+1)} disabled={idx===items.length-1}>
                                <Icon d="M6 9l6 6 6-6" size={11}/>
                              </button>
                            </div>
                            <span style={{ flex:1,fontSize:13,color:"var(--text)" }}>{item}</span>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ width:28,height:28,color:"#e85a3a",flexShrink:0 }}
                              onClick={() => removeItem(item)}>
                              <Icon d={ic.close} size={13}/>
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Add new item */}
                      <AddItemInput label={label} onAdd={addItem} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,marginTop:28,paddingTop:20,borderTop:"1px solid var(--border)" }}>
        {saved && <div style={{ display:"flex",alignItems:"center",gap:6,color:"var(--green)",fontSize:13,fontWeight:600 }}><Icon d={ic.check} size={15} stroke="var(--green)" /> Changes saved</div>}
        <button className="btn btn-secondary" onClick={() => setForm({ ...settings })}>Reset</button>
        <button className="btn btn-primary" onClick={handleSave}><Icon d={ic.check} size={14} /> Save All Changes</button>
      </div>
    </div>
  );
}
