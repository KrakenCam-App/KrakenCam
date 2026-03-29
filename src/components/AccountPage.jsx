import React, { useState, useEffect, useRef } from "react";
import { uploadOrgLogo, uploadUserAvatar } from "../lib/uploadImage";
import { createTeamMember, updateTeamMember, removeUser as dbRemoveUser } from "../lib/team";
import { Icon, ic } from "../utils/icons.jsx";
import {
  PLAN_AI_LIMITS, FEATURE_PERMS, EMPTY_USER, EMPTY_CERT,
  hasPermissionLevel, getEffectivePermissions,
  getWeekWindowStart, getNextResetDate,
  getPermissionPolicies, getRolePermissionDefaults,
  normalisePermissionValue, setRolePermissionLevel,
  DEFAULT_ROLE_PERMISSIONS,
} from "../utils/constants.js";
import { uid, today, getCertStatus, ROLE_META } from "../utils/helpers.js";
import { useAuth } from "./AuthProvider.jsx";

const billingDaySuffix = (dateStr) => {
  const d = new Date(dateStr || "2025-03-11").getDate();
  const v = d % 100;
  // 11th, 12th, 13th are exceptions â always "th"
  if (v >= 11 && v <= 13) return d + "th";
  const s = { 1:"st", 2:"nd", 3:"rd" };
  return d + (s[d % 10] || "th");
};

// Returns { daysUsed, daysTotal, daysLeft, cycleStart, cycleEnd } for today in the billing cycle
const getBillingCycleInfo = (signupDate, billingCycle) => {
  const anchor = new Date(signupDate || "2025-03-11");
  // Guard against invalid date (e.g. settings reset)
  if (isNaN(anchor.getTime())) return { daysUsed:0, daysTotal:30, daysLeft:30, cycleStart:new Date(), cycleEnd:new Date(Date.now()+30*86400000) };
  const anchorDay = anchor.getDate();
  const today = new Date();

  if (billingCycle === "annual") {
    // Find current annual cycle start
    let cycleStart = new Date(today.getFullYear(), anchor.getMonth(), anchorDay);
    if (cycleStart > today) cycleStart.setFullYear(cycleStart.getFullYear() - 1);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
    const daysTotal = Math.round((cycleEnd - cycleStart) / 86400000);
    const daysUsed  = Math.round((today - cycleStart) / 86400000);
    return { daysUsed, daysTotal, daysLeft: daysTotal - daysUsed, cycleStart, cycleEnd };
  } else {
    // Find current monthly cycle start
    let cycleStart = new Date(today.getFullYear(), today.getMonth(), anchorDay);
    if (cycleStart > today) { cycleStart.setMonth(cycleStart.getMonth() - 1); }
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    const daysTotal = Math.round((cycleEnd - cycleStart) / 86400000);
    const daysUsed  = Math.round((today - cycleStart) / 86400000);
    return { daysUsed, daysTotal, daysLeft: daysTotal - daysUsed, cycleStart, cycleEnd };
  }
};

// Calculate proration amounts for a plan change mid-cycle
const calcProration = (settings, users, fromPlan, toPlan) => {
  const cycle = settings?.billingCycle || "monthly";
  const info   = getBillingCycleInfo(settings?.signupDate, cycle);
  const activeUserCount = users.filter(u => u.status !== "inactive").length;

  const fromPricing = PRICING[cycle]?.[fromPlan] || PRICING.monthly.base;
  const toPricing   = PRICING[cycle]?.[toPlan]   || PRICING.monthly.base;
  const fromTotal = fromPricing.admin + activeUserCount * fromPricing.user;
  const toTotal   = toPricing.admin   + activeUserCount * toPricing.user;

  const dailyFrom   = fromTotal / info.daysTotal;
  const dailyTo     = toTotal   / info.daysTotal;
  const unusedCredit = parseFloat((dailyFrom * info.daysLeft).toFixed(2));
  const newCharge    = parseFloat((dailyTo   * info.daysLeft).toFixed(2));
  const netCharge    = parseFloat((newCharge - unusedCredit).toFixed(2));

  return { unusedCredit, newCharge, netCharge, daysLeft: info.daysLeft, daysTotal: info.daysTotal, cycleEnd: info.cycleEnd, fromTotal, toTotal };
};

// ââ ACCOUNT PAGE âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const PRICING = {
  monthly: {
    base:    { admin: 39, user: 29 },
    pro:     { admin: 59, user: 29 },
    command: { admin: 79, user: 29 },
  },
  annual: {
    base:    { admin: 33, user: 26 },
    pro:     { admin: 50, user: 26 },
    command: { admin: 67, user: 26 },
  },
};
const PLAN_NAMES = { base: "Capture I", pro: "Intelligence II", command: "Command III" };

// Returns the start of the current week's generation window (Saturday 23:59 reset)
// Returns ISO date string of next Saturday 23:59 reset
// Returns "expired" | "expiring-soon" (â¤30d) | "expiring-warning" (â¤90d) | "valid" | "no-expiry"

const CERT_STATUS_META = {
  "expired":          { label:"Expired",       bg:"#e85a3a22", color:"#e85a3a", border:"#e85a3a55" },
  "expiring-soon":    { label:"Expires soon",  bg:"#e8803a22", color:"#e8803a", border:"#e8803a55" },
  "expiring-warning": { label:"Exp. in 3 mo",  bg:"#e8c53a22", color:"#b8950a", border:"#e8c53a66" },
  "valid":            { label:"Valid",          bg:"#3dba7e18", color:"#3dba7e", border:"#3dba7e44" },
  "no-expiry":        { label:"No expiry",      bg:"var(--surface2)", color:"var(--text3)", border:"var(--border)" },
};

export function UserModal({ user, projects, settings = {}, currentUserRole = "admin", onSave, onClose }) {
  const isNew = !user?.id;
  const [form, setForm] = useState(() => {
    const base = isNew ? { ...EMPTY_USER, id:uid() } : { ...user };
    return {
      ...base,
      role: base.role || "user",
      permissions: getEffectivePermissions(base.role || "user", base.permissions, settings),
    };
  });
  const [tab, setTab]   = useState("info");
  const [tmpPw, setTmpPw]       = useState("");
  const [tmpPwConfirm, setTmpPwConfirm] = useState("");
  const [tmpPwError, setTmpPwError]     = useState("");
  const [editingCert, setEditingCert]   = useState(null);  // null | EMPTY_CERT | existing cert
  const [certImgPreview, setCertImgPreview] = useState(null);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));
  const setPermKey = (feat,val) => setForm(f => ({ ...f, permissions:{ ...getEffectivePermissions(f.role, f.permissions, settings), [feat]:normalisePermissionValue(val, "none") } }));
  const toggleProject = (pid) => set("assignedProjects", form.assignedProjects.includes(pid) ? form.assignedProjects.filter(x=>x!==pid) : [...form.assignedProjects, pid]);
  const applyRoleDefaults = (role) => {
    setForm(f => ({ ...f, role, permissions:{ ...getRolePermissionDefaults(role, settings) } }));
  };
  const currentUserPerms = getEffectivePermissions(currentUserRole, settings?.userPermissions, settings);
  const canAssignAdmin = currentUserRole === "admin";
  const canEditTeamPermissions = hasPermissionLevel(currentUserPerms, "team", "edit");

  const validatePassword = (pw) => {
    if (pw.length < 8)       return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))   return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(pw))   return "Password must include at least one lowercase letter.";
    if (!/[0-9]/.test(pw))   return "Password must include at least one number.";
    return null;
  };

  const handleSave = () => {
    if (isNew && tmpPw) {
      const err = validatePassword(tmpPw);
      if (err) return setTmpPwError(err);
      if (tmpPw !== tmpPwConfirm) return setTmpPwError("Passwords do not match.");
    }
    setTmpPwError("");
    onSave(form);
  };

  const TABS = [
    { id:"info",    label:"Contact Info"  },
    { id:"access",  label:"Role & Access" },
    { id:"projects",label:"Projects"      },
    { id:"certs",   label:"Certifications", badge: (form.certifications||[]).filter(c=>["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length || null },
    { id:"security",label:"Security"      },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Add New User" : `Edit â ${user.firstName} ${user.lastName}`}</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex",gap:2,borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {TABS.map(t => (
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
              style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,fontSize:12.5,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,position:"relative",gap:5 }}>
              {t.label}
              {t.badge ? <span style={{ fontSize:10,fontWeight:800,minWidth:16,height:16,borderRadius:8,background:"#e85a3a",color:"white",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight:480,overflowY:"auto" }}>

          {/* ââ INFO ââ */}
          {tab==="info" && (
            <div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={form.firstName} onChange={e=>set("firstName",e.target.value)} placeholder="Jane" /></div>
                <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={form.lastName} onChange={e=>set("lastName",e.target.value)} placeholder="Smith" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email Address * <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>â also updates login email</span></label>
                  <input className="form-input" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="jane@company.com" />
                </div>
                <div className="form-group"><label className="form-label">Mobile Phone</label><input className="form-input" value={form.mobile} onChange={e=>set("mobile",e.target.value)} placeholder="+1 (555) 000-0000" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Office Phone</label><input className="form-input" value={form.phone} onChange={e=>set("phone",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Employee ID</label><input className="form-input" value={form.employeeId} onChange={e=>set("employeeId",e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Field Technician" /></div>
                <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={form.department} onChange={e=>set("department",e.target.value)} placeholder="Operations" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <div className="date-input-wrap">
                    <input className="form-input" type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} />
                    <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                    <option value="pending">Pending Invite</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>set("address",e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e=>set("city",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" value={form.state} onChange={e=>set("state",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Zip / Postal Code</label><input className="form-input" value={form.zip} onChange={e=>set("zip",e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input form-textarea" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Internal notes about this userâ¦" style={{ minHeight:68 }} /></div>
            </div>
          )}

          {/* ââ ACCESS ââ */}
          {tab==="access" && (
            <div>
              <div style={{ marginBottom:18 }}>
                <div className="form-label" style={{ marginBottom:8 }}>User Role</div>
                <div style={{ display:"flex",gap:10 }}>
                  {Object.entries(ROLE_META).filter(([r]) => canAssignAdmin || r !== "admin").map(([r,meta])=>(
                    <div key={r} onClick={()=>applyRoleDefaults(r)}
                      style={{ flex:1,padding:"12px 14px",borderRadius:"var(--radius)",border:`2px solid ${form.role===r?meta.color:"var(--border)"}`,cursor:"pointer",background:form.role===r?`${meta.color}12`:"var(--surface2)",transition:"all .15s" }}>
                      <div style={{ fontWeight:700,fontSize:13,color:form.role===r?meta.color:"var(--text)",marginBottom:3 }}>{meta.label}</div>
                      <div style={{ fontSize:11.5,color:"var(--text2)",lineHeight:1.4 }}>{meta.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:8,fontSize:11.5,color:"var(--text3)" }}>
                  Selecting a role applies the current account defaults. You can fine-tune this user below with overrides.
                </div>
              </div>

              <div style={{ background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)",overflow:"hidden" }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",padding:"9px 14px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)" }}>
                  <span>Feature</span><span style={{ textAlign:"center" }}>View</span><span style={{ textAlign:"center" }}>Edit</span><span style={{ textAlign:"center" }}>None</span>
                </div>
                {FEATURE_PERMS.map((f,i) => {
                  const val = form.permissions?.[f.id] || "none";
                  return (
                    <div key={f.id} style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",padding:"10px 14px",borderBottom:i<FEATURE_PERMS.length-1?"1px solid var(--border)":"none",alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:13,fontWeight:600 }}>{f.label}</div>
                        <div style={{ fontSize:11,color:"var(--text3)",marginTop:2,lineHeight:1.4 }}>{f.desc}</div>
                      </div>
                      {["view","edit","none"].map(opt=>(
                        <div key={opt} style={{ display:"flex",justifyContent:"center" }}>
                          <div onClick={()=>canEditTeamPermissions && setPermKey(f.id,opt)}
                            style={{ width:18,height:18,borderRadius:"50%",border:`2px solid ${val===opt?"var(--accent)":"var(--border)"}`,background:val===opt?"var(--accent)":"transparent",cursor:canEditTeamPermissions?"pointer":"not-allowed",opacity:canEditTeamPermissions?1:0.5,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}>
                            {val===opt && <div style={{ width:7,height:7,borderRadius:"50%",background:"white" }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {!canEditTeamPermissions && (
                <div style={{ marginTop:10,fontSize:11.5,color:"var(--text3)" }}>
                  Your current role can view this access profile, but only a team manager with edit rights can change permission overrides.
                </div>
              )}
            </div>
          )}

          {/* ââ PROJECTS ââ */}
          {tab==="projects" && (
            <div>
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14,lineHeight:1.6 }}>
                Select which jobsites this user can access. Admins and Managers can see all projects by default.
              </div>
              {form.role==="admin" || form.role==="manager"
                ? <div style={{ padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)",fontSize:13,color:"var(--text2)",display:"flex",gap:10,alignItems:"center" }}>
                    <Icon d={ic.shield} size={16} stroke="var(--accent)" /><span>This role has access to <strong style={{ color:"var(--text)" }}>all projects</strong> automatically.</span>
                  </div>
                : projects.length === 0
                  ? <div style={{ padding:16,color:"var(--text3)",fontSize:13 }}>No projects yet â create a jobsite first.</div>
                  : <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {projects.map(p=>{
                        const sel = form.assignedProjects.includes(p.id);
                        return (
                          <div key={p.id} onClick={()=>toggleProject(p.id)}
                            style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:"var(--radius-sm)",border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                            <div style={{ width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0 }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600,fontSize:13 }}>{p.title}</div>
                              <div style={{ fontSize:11.5,color:"var(--text2)" }}>{p.address}{p.city?`, ${p.city}`:""}</div>
                            </div>
                            {sel && <Icon d={ic.check} size={15} stroke="var(--accent)" strokeWidth={2.5} />}
                          </div>
                        );
                      })}
                    </div>
              }
            </div>
          )}

          {/* ââ CERTIFICATIONS ââ */}
          {tab==="certs" && (() => {
            const certs = form.certifications || [];
            const saveCert = (cert) => {
              const exists = certs.find(c => c.id === cert.id);
              const updated = exists ? certs.map(c => c.id===cert.id ? cert : c) : [...certs, cert];
              set("certifications", updated);
              setEditingCert(null);
              setCertImgPreview(null);
            };
            const deleteCert = (id) => set("certifications", certs.filter(c => c.id !== id));

            return (
              <div>
                {/* Alert banner if any certs need attention */}
                {certs.some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))) && (
                  <div style={{ padding:"10px 14px",background:"#e85a3a12",border:"1px solid #e85a3a40",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10 }}>
                    <Icon d={ic.alert} size={15} stroke="#e85a3a" />
                    <span style={{ fontSize:12.5,color:"var(--text2)" }}>
                      <strong style={{ color:"#e85a3a" }}>
                        {certs.filter(c=>getCertStatus(c.dateExpires)==="expired").length > 0
                          ? `${certs.filter(c=>getCertStatus(c.dateExpires)==="expired").length} certification(s) expired`
                          : `${certs.filter(c=>["expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length} certification(s) expiring soon`}
                      </strong>
                      {" â update or renew before the expiry date"}
                    </span>
                  </div>
                )}

                {/* Cert list */}
                {certs.length === 0 && !editingCert && (
                  <div style={{ textAlign:"center",padding:"36px 20px",background:"var(--surface2)",borderRadius:10,border:"2px dashed var(--border)",marginBottom:14 }}>
                    <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={32} stroke="var(--text3)" />
                    <div style={{ fontWeight:700,fontSize:14,marginTop:10,marginBottom:5 }}>No certifications on file</div>
                    <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14 }}>Track licenses, safety certs, and trade qualifications for this team member.</div>
                    <button className="btn btn-primary btn-sm" onClick={()=>{ setEditingCert({...EMPTY_CERT,id:uid()}); setCertImgPreview(null); }}>
                      <Icon d={ic.plus} size={14} /> Add First Certification
                    </button>
                  </div>
                )}

                {certs.length > 0 && !editingCert && (
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                    {certs.map(cert => {
                      const status = getCertStatus(cert.dateExpires);
                      const sm     = CERT_STATUS_META[status];
                      const daysLeft = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                      return (
                        <div key={cert.id} style={{ display:"flex",gap:12,padding:"12px 14px",background:"var(--surface)",border:`1px solid ${sm.border}`,borderRadius:10,alignItems:"flex-start",transition:"border-color .15s" }}>
                          {/* Cert image thumbnail */}
                          <div style={{ width:44,height:44,borderRadius:7,flexShrink:0,overflow:"hidden",background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                            {cert.image
                              ? <img src={cert.image} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                              : <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={20} stroke="var(--text3)" />}
                          </div>
                          {/* Info */}
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                              <span style={{ fontWeight:700,fontSize:13.5 }}>{cert.name||"Unnamed Certification"}</span>
                              {cert.certCode && (
                                <span style={{ fontSize:11,fontWeight:800,padding:"1px 8px",borderRadius:6,background:"var(--surface2)",color:"var(--text2)",border:"1px solid var(--border)",letterSpacing:".04em",fontFamily:"monospace" }}>
                                  {cert.certCode}
                                </span>
                              )}
                              <span style={{ fontSize:10.5,fontWeight:700,padding:"1px 8px",borderRadius:10,background:sm.bg,color:sm.color,border:`1px solid ${sm.border}` }}>
                                {sm.label}
                              </span>
                            </div>
                            <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3 }}>
                              {cert.certifyingBody && <span style={{ marginRight:10 }}>ð¢ {cert.certifyingBody}</span>}
                              {cert.dateCertified && <span style={{ marginRight:10 }}>Issued: {new Date(cert.dateCertified+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                            </div>
                            {cert.dateExpires && (
                              <div style={{ fontSize:12,color:sm.color,fontWeight:600 }}>
                                {status==="expired"
                                  ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft)!==1?"s":""} ago`
                                  : status==="expiring-soon"
                                    ? `Expires in ${daysLeft} day${daysLeft!==1?"s":""} â renew now`
                                    : status==="expiring-warning"
                                      ? `Expires in ${daysLeft} days`
                                      : `Expires: ${new Date(cert.dateExpires+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`}
                              </div>
                            )}
                          </div>
                          {/* Actions */}
                          <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Edit certification" onClick={()=>{ setEditingCert({...cert}); setCertImgPreview(cert.image||null); }}>
                              <Icon d={ic.edit} size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={()=>deleteCert(cert.id)} style={{ color:"#e85a3a" }}>
                              <Icon d={ic.trash} size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add button when there are existing certs */}
                {certs.length > 0 && !editingCert && (
                  <button className="btn btn-secondary btn-sm" style={{ width:"100%",gap:6,justifyContent:"center" }}
                    onClick={()=>{ setEditingCert({...EMPTY_CERT,id:uid()}); setCertImgPreview(null); }}>
                    <Icon d={ic.plus} size={14} /> Add Certification
                  </button>
                )}

                {/* ââ Cert edit/add form ââ */}
                {editingCert && (
                  <div style={{ background:"var(--surface2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden" }}>
                    <div style={{ padding:"13px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--surface)" }}>
                      <div style={{ fontWeight:700,fontSize:14 }}>
                        {certs.find(c=>c.id===editingCert.id) ? "Edit Certification" : "Add Certification"}
                      </div>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>{ setEditingCert(null); setCertImgPreview(null); }}>
                        <Icon d={ic.close} size={16} />
                      </button>
                    </div>
                    <div style={{ padding:"16px" }}>

                      {/* Image upload */}
                      <div style={{ marginBottom:16 }}>
                        <label className="form-label">Certification Document / Photo</label>
                        <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                          <div style={{ width:80,height:80,borderRadius:10,overflow:"hidden",flexShrink:0,background:"var(--surface)",border:`2px dashed ${certImgPreview?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"border-color .15s" }}
                            onClick={()=>document.getElementById("cert-img-upload").click()}>
                            {certImgPreview
                              ? <img src={certImgPreview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                              : <div style={{ textAlign:"center",padding:"6px" }}>
                                  <Icon d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" size={22} stroke="var(--text3)" />
                                  <div style={{ fontSize:10,color:"var(--text3)",marginTop:3 }}>Upload</div>
                                </div>}
                          </div>
                          <input id="cert-img-upload" type="file" accept="image/*" style={{ display:"none" }}
                            onChange={e=>{
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                setCertImgPreview(ev.target.result);
                                setEditingCert(ec => ({...ec, image: ev.target.result}));
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:8 }}>Upload a photo or scan of the certificate. Supports JPEG, PNG, HEIC.</div>
                            {certImgPreview && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"#e85a3a" }}
                                onClick={()=>{ setCertImgPreview(null); setEditingCert(ec=>({...ec,image:null})); }}>
                                Remove image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cert name + code row */}
                      <div className="form-row" style={{ marginBottom:12 }}>
                        <div className="form-group" style={{ flex:2 }}>
                          <label className="form-label">Certification Name *</label>
                          <input className="form-input" placeholder="e.g. Water Restoration Technician, First Aid, Forklift Operator" value={editingCert.name}
                            onChange={e=>setEditingCert(ec=>({...ec,name:e.target.value}))} />
                        </div>
                        <div className="form-group" style={{ flex:1 }}>
                          <label className="form-label">Code <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(abbreviation)</span></label>
                          <input className="form-input" placeholder="e.g. WRT, OSHA30" value={editingCert.certCode||""}
                            onChange={e=>setEditingCert(ec=>({...ec,certCode:e.target.value.toUpperCase()}))}
                            style={{ fontFamily:"monospace",letterSpacing:".06em",textTransform:"uppercase" }} />
                        </div>
                      </div>

                      {/* Certifying body */}
                      <div className="form-group" style={{ marginBottom:12 }}>
                        <label className="form-label">Certifying Body / Issuing Organization</label>
                        <input className="form-input" placeholder="e.g. OSHA, Red Cross, NCCER" value={editingCert.certifyingBody}
                          onChange={e=>setEditingCert(ec=>({...ec,certifyingBody:e.target.value}))} />
                      </div>

                      {/* Dates */}
                      <div className="form-row" style={{ marginBottom:4 }}>
                        <div className="form-group">
                          <label className="form-label">Date Certified</label>
                          <div className="date-input-wrap">
                            <input className="form-input" type="date" value={editingCert.dateCertified}
                              onChange={e=>setEditingCert(ec=>({...ec,dateCertified:e.target.value}))} />
                            <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expiry Date <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(leave blank if no expiry)</span></label>
                          <div className="date-input-wrap">
                            <input className="form-input" type="date" value={editingCert.dateExpires}
                              onChange={e=>setEditingCert(ec=>({...ec,dateExpires:e.target.value}))} />
                            <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                          </div>
                        </div>
                      </div>

                      {/* Live status preview */}
                      {editingCert.dateExpires && (() => {
                        const st = getCertStatus(editingCert.dateExpires);
                        const sm = CERT_STATUS_META[st];
                        const days = Math.ceil((new Date(editingCert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
                        return (
                          <div style={{ padding:"8px 12px",borderRadius:8,background:sm.bg,border:`1px solid ${sm.border}`,marginBottom:12,fontSize:12,color:sm.color,fontWeight:600,display:"flex",alignItems:"center",gap:7 }}>
                            <span style={{ width:7,height:7,borderRadius:"50%",background:sm.color,display:"inline-block",flexShrink:0 }} />
                            {st==="expired" ? `Expired ${Math.abs(days)} days ago`
                              : st==="expiring-soon" ? `Expires in ${days} days â will trigger urgent notification`
                              : st==="expiring-warning" ? `Expires in ${days} days â will trigger 90-day warning`
                              : `Valid · expires ${new Date(editingCert.dateExpires+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`}
                          </div>
                        );
                      })()}

                      <div style={{ display:"flex",gap:8,paddingTop:4 }}>
                        <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>{ setEditingCert(null); setCertImgPreview(null); }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" style={{ flex:2 }} disabled={!editingCert.name?.trim()}
                          onClick={()=>saveCert(editingCert)}>
                          <Icon d={ic.check} size={13} /> {certs.find(c=>c.id===editingCert.id) ? "Update Certification" : "Add Certification"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {tab==="security" && (
            <div>
              {!isNew && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div className="card-header"><span style={{ fontWeight:700 }}>Reset Password</span></div>
                  <div className="card-body">
                    <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14,lineHeight:1.6 }}>
                      Send a password reset link to <strong style={{ color:"var(--text)" }}>{form.email}</strong>. The user will receive an email with instructions.
                    </div>
                    <button className="btn btn-secondary btn-sm"><Icon d={ic.key} size={13} /> Send Reset Link</button>
                  </div>
                </div>
              )}
              {isNew && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div className="card-header"><span style={{ fontWeight:700 }}>Set Temporary Password</span></div>
                  <div className="card-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Temporary Password</label>
                        <input className="form-input" type="password" placeholder="Min 8 characters" value={tmpPw}
                          onChange={e => { setTmpPw(e.target.value); setTmpPwError(""); }}
                          style={{ borderColor: tmpPw && validatePassword(tmpPw) ? "#c0392b" : undefined }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input className="form-input" type="password" placeholder="Repeat password" value={tmpPwConfirm}
                          onChange={e => { setTmpPwConfirm(e.target.value); setTmpPwError(""); }}
                          style={{ borderColor: tmpPwConfirm && tmpPwConfirm !== tmpPw ? "#c0392b" : undefined }} />
                      </div>
                    </div>
                    {tmpPw.length > 0 && (
                      <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                        {[
                          { label:"8+ chars",  ok: tmpPw.length >= 8 },
                          { label:"Uppercase", ok: /[A-Z]/.test(tmpPw) },
                          { label:"Lowercase", ok: /[a-z]/.test(tmpPw) },
                          { label:"Number",    ok: /[0-9]/.test(tmpPw) },
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
                    {tmpPwError && <div style={{ fontSize:12.5,color:"#c0392b",padding:"8px 12px",background:"#c0392b15",borderRadius:"var(--radius-sm)",border:"1px solid #c0392b44",marginBottom:4 }}>{tmpPwError}</div>}
                    <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:6 }}>User will be prompted to change this on first login.</div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-header"><span style={{ fontWeight:700 }}>Account Status</span></div>
                <div className="card-body">
                  <div style={{ display:"flex",gap:10 }}>
                    {[{v:"active",label:"Active",icon:ic.check,col:"#3dba7e"},{v:"inactive",label:"Deactivated",icon:ic.userX,col:"#e85a3a"},{v:"pending",label:"Pending",icon:ic.timer,col:"#e8c53a"}].map(s=>(
                      <div key={s.v} onClick={()=>set("status",s.v)}
                        style={{ flex:1,padding:"10px 12px",borderRadius:"var(--radius-sm)",border:`2px solid ${form.status===s.v?s.col:"var(--border)"}`,background:form.status===s.v?`${s.col}15`:"var(--surface2)",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
                        <Icon d={s.icon} size={16} stroke={form.status===s.v?s.col:"var(--text2)"} />
                        <div style={{ fontSize:12,fontWeight:600,marginTop:5,color:form.status===s.v?s.col:"var(--text2)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.firstName||!form.email}>
            <Icon d={ic.check} size={14} /> {isNew?"Add User & Confirm Charge":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BillingHistoryModal({ monthlyTotal, signupDate, cycle, onClose }) {
  const anchorDay = new Date(signupDate||"2025-03-11").getDate();
  const isAnnual  = cycle === "annual";
  const invoices  = Array.from({ length: isAnnual ? 3 : 12 }, (_, i) => {
    const d = new Date();
    if (isAnnual) {
      d.setFullYear(d.getFullYear() - (i + 1));
      d.setDate(anchorDay);
    } else {
      d.setMonth(d.getMonth() - (i + 1));
      d.setDate(anchorDay);
    }
    return {
      id: `INV-${2025000 + (12 - i)}`,
      date: isAnnual
        ? d.toLocaleDateString("en-US", { month:"long", year:"numeric" })
        : d.toLocaleDateString("en-US", { month:"long", year:"numeric" }),
      amount: isAnnual ? monthlyTotal * 12 : monthlyTotal,
      status: "Paid",
    };
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.creditCard} size={16} /> Billing History</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div className="bill-row" style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px", padding: "9px 18px", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 700, color: "var(--text2)" }}>
            <span>Invoice</span><span>Date</span><span style={{ textAlign: "right" }}>Amount</span><span style={{ textAlign: "right" }}>Status</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {invoices.map((inv, i) => (
              <div key={inv.id} className="bill-row" style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px", padding: "11px 18px", borderBottom: i < invoices.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 13, transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontWeight: 600, color: "var(--accent)", cursor: "pointer", fontSize: 12.5 }}>{inv.id}</span>
                <span style={{ color: "var(--text2)", fontSize: 12.5 }}>{inv.date}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>${inv.amount}.00</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#3dba7e18", color: "#3dba7e" }}>{inv.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Showing last 12 months</span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function UpdateCardModal({ current, onSave, onClose }) {
  const [num,    setNum]    = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc,    setCvc]    = useState("");
  const [name,   setName]   = useState("");
  const [errors, setErrors] = useState({});
  const [saved,  setSaved]  = useState(false);

  const detectBrand = (n) => {
    const d = n.replace(/\D/g,"");
    if (/^4/.test(d))            return "Visa";
    if (/^5[1-5]/.test(d))       return "Mastercard";
    if (/^3[47]/.test(d))        return "Amex";
    if (/^6(?:011|5)/.test(d))   return "Discover";
    return "Card";
  };

  const fmtNum = (v) => {
    const d = v.replace(/\D/g,"").slice(0,16);
    return d.replace(/(.{4})/g,"$1 ").trim();
  };
  const fmtExpiry = (v) => {
    const d = v.replace(/\D/g,"").slice(0,4);
    return d.length > 2 ? d.slice(0,2)+"/"+d.slice(2) : d;
  };

  const validate = () => {
    const e = {};
    const digits = num.replace(/\D/g,"");
    if (digits.length < 13) e.num = "Enter a valid card number";
    const parts = expiry.split("/");
    const mm = parts[0], yy = parts[1];
    if (!mm||!yy||+mm<1||+mm>12||+("20"+yy)<new Date().getFullYear()) e.expiry = "Enter a valid expiry";
    if (cvc.length < 3) e.cvc = "Enter a valid CVC";
    if (!name.trim()) e.name = "Enter the cardholder name";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const digits = num.replace(/\D/g,"");
    setSaved(true);
    setTimeout(() => onSave({ brand:detectBrand(num), last4:digits.slice(-4), displayExpiry:expiry }), 800);
  };

  const brand = detectBrand(num);
  const brandColor = {Visa:"#1a1f71",Mastercard:"#eb001b",Amex:"#007bc1",Discover:"#ff6600"}[brand]||"var(--accent)";

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.creditCard} size={16}/> Update Payment Method</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22}/></button>
        </div>
        <div className="modal-body" style={{ display:"flex",flexDirection:"column",gap:16 }}>

          {/* Card preview */}
          <div style={{ background:"linear-gradient(135deg,#1a1f2e,#2a3050)",borderRadius:12,padding:"18px 20px",color:"white",position:"relative",overflow:"hidden",minHeight:110 }}>
            <div style={{ position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.05)" }}/>
            <div style={{ position:"absolute",bottom:-30,right:30,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,.04)" }}/>
            <div style={{ fontSize:11,letterSpacing:".12em",opacity:.7,marginBottom:10,fontWeight:600 }}>PAYMENT METHOD</div>
            <div style={{ fontSize:15,fontWeight:700,letterSpacing:".18em",marginBottom:14,fontFamily:"monospace" }}>
              {num ? num.padEnd(19,"·").slice(0,19) : "â¢â¢â¢â¢ â¢â¢â¢â¢ â¢â¢â¢â¢ â¢â¢â¢â¢"}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
              <div>
                <div style={{ fontSize:9,opacity:.6,letterSpacing:".1em" }}>CARDHOLDER</div>
                <div style={{ fontSize:12,fontWeight:600 }}>{name||"YOUR NAME"}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9,opacity:.6,letterSpacing:".1em" }}>EXPIRES</div>
                <div style={{ fontSize:12,fontWeight:600 }}>{expiry||"MM/YY"}</div>
              </div>
              {num && <div style={{ fontSize:13,fontWeight:800,color:brandColor,background:"white",padding:"3px 8px",borderRadius:6 }}>{brand}</div>}
            </div>
          </div>

          <div>
            <div className="form-label">Card Number</div>
            <input className="form-input" placeholder="1234 5678 9012 3456" value={num}
              onChange={e=>setNum(fmtNum(e.target.value))} maxLength={19}
              style={{ fontFamily:"monospace",letterSpacing:".08em",borderColor:errors.num?"#e85a3a":"" }}/>
            {errors.num && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.num}</div>}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div>
              <div className="form-label">Expiry Date</div>
              <input className="form-input" placeholder="MM/YY" value={expiry}
                onChange={e=>setExpiry(fmtExpiry(e.target.value))} maxLength={5}
                style={{ borderColor:errors.expiry?"#e85a3a":"" }}/>
              {errors.expiry && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.expiry}</div>}
            </div>
            <div>
              <div className="form-label">CVC</div>
              <input className="form-input" placeholder="â¢â¢â¢" value={cvc} type="password"
                onChange={e=>setCvc(e.target.value.replace(/\D/g,"").slice(0,4))}
                style={{ borderColor:errors.cvc?"#e85a3a":"" }}/>
              {errors.cvc && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.cvc}</div>}
            </div>
          </div>

          <div>
            <div className="form-label">Cardholder Name</div>
            <input className="form-input" placeholder="Name on card" value={name}
              onChange={e=>setName(e.target.value)}
              style={{ borderColor:errors.name?"#e85a3a":"" }}/>
            {errors.name && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.name}</div>}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text3)" }}>
            <Icon d={ic.lock} size={12}/> Your card details are encrypted and stored securely.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ minWidth:130 }}>
            {saved ? <><Icon d={ic.check} size={14}/> Saved!</> : <><Icon d={ic.creditCard} size={14}/> Save Card</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ââ InviteUserButton ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function InviteUserButton({ canEdit }) {
  const { session } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("user");
  const [sending, setSending] = React.useState(false);
  const [msg, setMsg] = React.useState(null); // { type: 'success'|'error', text }

  const close = () => { setOpen(false); setEmail(""); setRole("user"); setMsg(null); };

  async function send() {
    if (!email.trim()) { setMsg({ type: "error", text: "Please enter an email." }); return; }
    setSending(true);
    setMsg(null);
    try {
      const jwt = session?.access_token;
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Failed to send invitation." });
      } else {
        setMsg({ type: "success", text: `Invitation sent to ${email.trim()}!` });
        setTimeout(close, 2000);
      }
    } catch (err) {
      setMsg({ type: "error", text: "Network error. Please try again." });
    }
    setSending(false);
  }

  if (!open) {
    return (
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        title="Invite a user to join your organization"
      >
        âï¸ Invite
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => e.target === e.currentTarget && close()}>
      <div style={{
        background: "#111318", border: "1px solid #1e2330", borderRadius: 14,
        padding: "32px 28px", width: "100%", maxWidth: 400,
        fontFamily: "'Inter','Segoe UI',sans-serif", color: "#e8eaf0",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Invite Team Member</h3>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Send an invitation link by email. They'll create their own account.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, display: "block", marginBottom: 5 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            autoFocus
            style={{
              width: "100%", background: "#0d1017", border: "1px solid #1e2638",
              borderRadius: 8, color: "#e8eaf0", fontSize: 14, padding: "10px 12px",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
            onKeyDown={e => e.key === "Enter" && send()}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, display: "block", marginBottom: 5 }}>Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={{
              width: "100%", background: "#0d1017", border: "1px solid #1e2638",
              borderRadius: 8, color: "#e8eaf0", fontSize: 14, padding: "10px 12px",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer",
            }}
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {msg && (
          <div style={{
            padding: "9px 12px", borderRadius: 7, fontSize: 13, marginBottom: 14,
            background: msg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${msg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
            color: msg.type === "success" ? "#22c55e" : "#f87171",
          }}>
            {msg.text}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={close}
            style={{
              background: "transparent", border: "1px solid #1e2638", color: "#9ca3af",
              borderRadius: 7, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            style={{
              background: "linear-gradient(135deg,#2563eb,#06b6d4)", color: "#fff",
              border: "none", borderRadius: 7, padding: "9px 18px", fontSize: 13,
              fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Sendingâ¦" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountPage({ settings, onSettingsChange, projects, users, onUsersChange, onProjectsChange, onNotify }) {
  const { profile: acctAuthProfile } = useAuth();
  const [tab, setTab]         = useState("team");
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser]   = useState(false);
  const [viewingUser, setViewingUser] = useState(null); // user id being viewed inline
  const [viewingAdmin, setViewingAdmin] = useState(false); // admin self-edit panel
  const [adminForm, setAdminForm] = useState(null); // working copy of admin profile
  const [adminEditingCert, setAdminEditingCert] = useState(null);
  const [adminCertImgPreview, setAdminCertImgPreview] = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [searchQ, setSearchQ]         = useState("");
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardInfo, setCardInfo] = useState({ number:"", expiry:"", cvc:"", name:"", brand:"Visa", last4:"4242", displayExpiry:"08/27" });
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [confirmUpgrade,   setConfirmUpgrade]   = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);

  const activeUsers   = users.filter(u => u.status !== "inactive");
  const currentPlan   = settings?.plan || "base";
  const isCommand     = currentPlan === "command";
  const isPro         = currentPlan === "pro" || isCommand;
  const cycle         = settings?.billingCycle || "monthly";
  const prices        = PRICING[cycle][currentPlan] || PRICING[cycle].base;
  const adminSeat     = prices.admin;
  const userSeat      = prices.user;
  const monthlyTotal  = adminSeat + (users.filter(u=>u.status!=="inactive").length * userSeat);
  const currentUserRole = settings?.userRole || "admin";
  const currentUserPerms = getEffectivePermissions(currentUserRole, settings?.userPermissions, settings);
  const permissionPolicies = getPermissionPolicies(settings);
  const canViewTeam = hasPermissionLevel(currentUserPerms, "team", "view");
  const canEditTeam = hasPermissionLevel(currentUserPerms, "team", "edit");
  const canViewBilling = hasPermissionLevel(currentUserPerms, "billing", "view");
  const canViewPerms = hasPermissionLevel(currentUserPerms, "settings", "view");
  const canEditPerms = currentUserRole === "admin" || (permissionPolicies.allowManagerPermissionEditing && currentUserRole === "manager" && hasPermissionLevel(currentUserPerms, "settings", "edit"));

  // AI generation tracking â reset if window has expired
  const aiLimit       = PLAN_AI_LIMITS[currentPlan] || 0;
  const hasAI         = aiLimit > 0;
  const windowStart   = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
  const currentWindowStart = getWeekWindowStart();
  const windowExpired = !windowStart || windowStart < currentWindowStart;
  const aiUsed        = windowExpired ? 0 : (settings?.aiGenerationsUsed || 0);
  const aiRemaining   = Math.max(0, aiLimit - aiUsed);
  const nextReset     = getNextResetDate();
  const aiPct         = aiLimit > 0 ? Math.min(100, (aiUsed / aiLimit) * 100) : 0;

  // Fire cert expiry notifications on mount and whenever users change
  const notifiedCertsRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!onNotify) return;
    users.forEach(u => {
      (u.certifications||[]).forEach(cert => {
        const status = getCertStatus(cert.dateExpires);
        if (status === "valid" || status === "no-expiry") return;
        const key = `${u.id}-${cert.id}-${status}`;
        if (notifiedCertsRef.current.has(key)) return;
        notifiedCertsRef.current.add(key);
        const name = `${u.firstName||""} ${u.lastName||""}`.trim();
        const days = Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
        const meta = CERT_STATUS_META[status];
        onNotify({
          id: uid(),
          author: "Certification Alert",
          authorInitials: "â ",
          authorColor: meta.color,
          action: status==="expired" ? "certification expired" : "certification expiring",
          context: cert.name,
          preview: status==="expired"
            ? `${name}'s "${cert.name}" expired ${Math.abs(days)} day${Math.abs(days)!==1?"s":""} ago`
            : `${name}'s "${cert.name}" expires in ${days} day${days!==1?"s":""}`,
          date: today(),
          read: false,
          type: "cert-alert",
          certStatus: status,
          recipientRoles: ["admin", "manager"],
        });
      });
    });
  }, [users]);

  const saveUser = (u) => {
    const normalizedUser = {
      ...u,
      permissions: getEffectivePermissions(u.role || "user", u.permissions, settings),
    };
    const exists = users.find(x => x.id === normalizedUser.id);
    onUsersChange(exists ? users.map(x => x.id===normalizedUser.id ? normalizedUser : x) : [...users, normalizedUser]);
    // Persist to Supabase profiles table
    if (normalizedUser.email) {
      if (!exists) {
        // Brand-new user â insert a pending profile (no auth account yet)
        const orgId = acctAuthProfile?.organization_id;
        if (orgId) {
          createTeamMember(normalizedUser, orgId).catch(err =>
            console.warn("[KrakenCam] Failed to create team member:", err.message || err)
          );
        }
      } else {
        // Existing user â update their profile (pass previous email so auth email can be updated if changed)
        const previousEmail = exists.email || null;
        updateTeamMember(normalizedUser, previousEmail).catch(err =>
          console.warn("[KrakenCam] Failed to save team member:", err.message || err)
        );
      }
    }

    // Sync user.assignedProjects â each project's assignedUserIds
    if (onProjectsChange) {
      onProjectsChange(prev => prev.map(proj => {
        const userWantsThisProject = (normalizedUser.assignedProjects||[]).includes(proj.id);
        const projHasUser          = (proj.assignedUserIds||[]).includes(normalizedUser.id);
        if (userWantsThisProject && !projHasUser)
          return { ...proj, assignedUserIds: [...(proj.assignedUserIds||[]), normalizedUser.id] };
        if (!userWantsThisProject && projHasUser)
          return { ...proj, assignedUserIds: (proj.assignedUserIds||[]).filter(id => id !== normalizedUser.id) };
        return proj;
      }));
    }

    // Fire notifications for newly assigned projects
    if (onNotify) {
      const prevUser           = users.find(x => x.id === normalizedUser.id);
      const prevProjectIds     = prevUser?.assignedProjects || [];
      const newlyAssignedProjs = (normalizedUser.assignedProjects||[]).filter(pid => !prevProjectIds.includes(pid));
      const isNewUser          = !prevUser;
      const assignerName       = `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim() || "Admin";
      const assignerInitials   = assignerName.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "AD";
      const userName           = `${normalizedUser.firstName||""} ${normalizedUser.lastName||""}`.trim();
      newlyAssignedProjs.forEach(pid => {
        const proj = projects.find(p => p.id === pid);
        if (!proj) return;
        onNotify({
          id: uid(),
          author: assignerName,
          authorInitials: assignerInitials,
          authorColor: "var(--accent)",
          action: isNewUser ? "added you to jobsite" : "assigned you to jobsite",
          context: proj.title,
          preview: userName
            ? `${userName} â assigned to: ${proj.title}`
            : `You've been assigned to "${proj.title}"`,
          date: today(),
          read: false,
          type: "assignment",
          recipientUserIds: [normalizedUser.id],
        });
      });
      if (isNewUser) {
        onNotify({
          id: uid(),
          author: assignerName,
          authorInitials: assignerInitials,
          authorColor: "var(--accent)",
          action: "added team member",
          context: userName || normalizedUser.email || "New User",
          preview: `${normalizedUser.role || "user"} access created${normalizedUser.email ? ` for ${normalizedUser.email}` : ""}`,
          date: today(),
          read: false,
          type: "team",
          recipientRoles: ["admin", "manager"],
        });
      } else {
        onNotify({
          id: uid(),
          author: assignerName,
          authorInitials: assignerInitials,
          authorColor: "var(--accent)",
          action: "updated team member",
          context: userName || normalizedUser.email || "User Account",
          preview: `Role: ${normalizedUser.role || "user"}${normalizedUser.status ? ` â¢ Status: ${normalizedUser.status}` : ""}`,
          date: today(),
          read: false,
          type: "team",
          recipientRoles: ["admin", "manager"],
        });
      }
    }

    setEditingUser(null); setAddingUser(false);
  };
  const removeUser = (id) => {
    const removedUser = users.find(u => u.id === id);
    onUsersChange(users.filter(u => u.id !== id));
    // Soft-remove in Supabase (sets is_active=false)
    if (removedUser?.email) {
      dbRemoveUser(removedUser.id).catch(() => {});
    }
    if (onProjectsChange) {
      onProjectsChange(prev => prev.map(proj => ({
        ...proj,
        assignedUserIds: (proj.assignedUserIds||[]).filter(uid => uid !== id)
      })));
    }
    if (onNotify && removedUser) {
      const actorName = `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim() || "Admin";
      const actorInitials = actorName.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "AD";
      onNotify({
        id: uid(),
        author: actorName,
        authorInitials: actorInitials,
        authorColor: "var(--accent)",
        action: "removed team member",
        context: `${removedUser.firstName||""} ${removedUser.lastName||""}`.trim() || removedUser.email || "User Account",
        preview: removedUser.email || "User access removed",
        date: today(),
        read: false,
        type: "team",
        recipientRoles: ["admin", "manager"],
      });
    }
    setConfirmDel(null);
  };

  const filtered = users.filter(u => {
    const q = searchQ.toLowerCase();
    return !q || `${u.firstName} ${u.lastName} ${u.email} ${u.role} ${u.title}`.toLowerCase().includes(q);
  });

  const TABS = [
    canViewTeam ? { id:"team", label:"Team Members", icon:ic.users } : null,
    canViewBilling ? { id:"billing", label:"Billing", icon:ic.creditCard } : null,
    canViewPerms ? { id:"perms", label:"Permissions", icon:ic.sliders } : null,
  ].filter(Boolean);

  useEffect(() => {
    if (!TABS.length) return;
    if (!TABS.some(t => t.id === tab)) setTab(TABS[0].id);
  }, [tab, TABS]);

  const RoleBadge = ({role}) => {
    const m = ROLE_META[role]||ROLE_META.user;
    return <span style={{ fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:`${m.color}18`,color:m.color }}>{m.label}</span>;
  };
  const StatusDot = ({status}) => {
    const col = status==="active"?"#3dba7e":status==="pending"?"#e8c53a":"#e85a3a";
    const lbl = status==="active"?"Active":status==="pending"?"Pending":"Deactivated";
    return <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:col,fontWeight:600 }}><span style={{ width:7,height:7,borderRadius:"50%",background:col,display:"inline-block" }}/>{lbl}</span>;
  };

  return (
    <div className="page fade-in" style={{ maxWidth:860 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:6 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <Icon d={ic.shield} size={20} stroke="white" />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom:0 }}>Account Management</div>
            <div className="section-sub" style={{ marginBottom:0 }}>
              {currentUserRole === "admin"
                ? "Admin controls for team access, billing, and company-wide permissions."
                : currentUserRole === "manager"
                  ? "Manager workspace for team operations and any controls granted to your role."
                  : "Your account access is limited by the permissions assigned to your role."}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:20 }} className="account-stats-grid">
          {[
            { label:"Team Members",    val:users.length,          icon:ic.users,      col:"#8b7cf8" },
            { label:"Active Users",    val:activeUsers.length,    icon:ic.check,      col:"#3dba7e" },
            { label:"Monthly Cost",    val:`$${monthlyTotal}/mo`, icon:ic.creditCard, col:"var(--accent)" },
            { label:"Projects",        val:projects.length,       icon:ic.folder,     col:"#3ab8e8" },
          ].map(s=>(
            <div key={s.label} style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"14px 16px",display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:`${s.col}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Icon d={s.icon} size={16} stroke={s.col} />
              </div>
              <div>
                <div style={{ fontSize:18,fontWeight:800,color:"var(--text)",lineHeight:1.1 }}>{s.val}</div>
                <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Generation Krakens usage box â shown for admins/managers on AI-enabled plans */}
        {hasAI && (
          <div style={{ marginTop:12,background:"var(--surface)",border:`1px solid ${aiRemaining===0?"#e85a3a44":isCommand?"#2b7fe844":isPro?"#a855f744":"#3dba7e44"}`,borderRadius:"var(--radius)",padding:"14px 18px",display:"flex",alignItems:"center",gap:16 }}>
            {/* Icon */}
            <div style={{ width:42,height:42,borderRadius:11,background:isCommand?"linear-gradient(135deg,#2b7fe822,#1a5fc822)":isPro?"linear-gradient(135deg,#7c3aed22,#a855f722)":"linear-gradient(135deg,#3dba7e22,#1a9e6e22)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isCommand?"#2b7fe8":isPro?"#a855f7":"#3dba7e"} strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            </div>
            {/* Text + bar */}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5 }}>
                <div style={{ fontWeight:700,fontSize:13,color:"var(--text)" }}>
                  AI Generation Krakens â {PLAN_NAMES[currentPlan]}
                </div>
                <div style={{ fontSize:12,fontWeight:800,color:aiRemaining===0?"#e85a3a":isCommand?"#2b7fe8":isPro?"#a855f7":"#3dba7e" }}>
                  {aiRemaining === 0 ? "â  Limit reached" : `${aiRemaining} remaining`}
                  <span style={{ fontWeight:400,color:"var(--text3)",fontSize:11 }}> / {aiLimit} this week</span>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height:6,background:"var(--surface2)",borderRadius:6,overflow:"hidden",border:"1px solid var(--border)" }}>
                <div style={{ height:"100%",borderRadius:6,transition:"width .4s",
                  background: aiPct >= 90 ? "#e85a3a" : aiPct >= 70 ? "#e8c53a" : isCommand ? "#2b7fe8" : isPro ? "#a855f7" : "#3dba7e",
                  width:`${aiPct}%` }} />
              </div>
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:4,display:"flex",justifyContent:"space-between" }}>
                <span>{aiUsed} used this week</span>
                <span>Resets Saturday 11:59 PM · {nextReset.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!TABS.length && (
        <div style={{ marginBottom:24,padding:"20px 18px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13.5,color:"var(--text2)",lineHeight:1.7 }}>
          This account does not currently have permission to view any management panels. An admin can grant `Team Management`, `Billing`, or `Company Settings` access from the Permissions tab.
        </div>
      )}

      {/* Tab bar */}
      {TABS.length > 0 && <div style={{ display:"flex",borderBottom:"1px solid var(--border)",marginBottom:24 }}>
        {TABS.map(t=>(
          <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
            style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,paddingLeft:10,paddingRight:10,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,gap:5,flex:1,justifyContent:"center",fontSize:12.5 }}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>}

      {/* ââ TEAM MEMBERS ââ */}
      {tab==="team" && (
        <div className="fade-in">
          <div style={{ display:"flex",gap:10,marginBottom:18,alignItems:"center" }}>
            <input className="form-input" style={{ flex:1,maxWidth:320 }} placeholder="Search usersâ¦" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={()=>canEditTeam && setAddingUser(true)} disabled={!canEditTeam}>
              <Icon d={ic.userPlus} size={14} /> Add User <span style={{ opacity:.7,fontSize:11 }}>+${userSeat}/mo</span>
            </button>
            <InviteUserButton canEdit={canEditTeam} />
          </div>

          {/* Admin row â clickable self-edit */}
          {(() => {
            const accentColor = ROLE_META.admin.color;
            const adminInitials = `${settings.userFirstName?.[0]||"A"}${settings.userLastName?.[0]||""}`.toUpperCase();
            const adminCerts = adminForm?.certifications || settings.userCertifications || [];
            const certAlertCount = adminCerts.filter(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length;
            const adminAssignedProjs = (adminForm?.assignedProjects || settings.userAssignedProjects || []).map(pid => projects.find(p=>p.id===pid)).filter(Boolean);

            const openAdmin = () => {
              setAdminForm({
                firstName:     settings.userFirstName || "",
                lastName:      settings.userLastName  || "",
                email:         settings.userEmail     || "",
                title:         settings.userTitle     || "",
                phone:         settings.userPhone     || "",
                mobile:        settings.userMobile    || "",
                address:       settings.userAddress   || "",
                city:          settings.userCity      || "",
                state:         settings.userState     || "",
                zip:           settings.userZip       || "",
                avatar:        settings.userAvatar    || null,
                certifications: settings.userCertifications || [],
                assignedProjects: settings.userAssignedProjects || [],
                notes:         settings.userNotes     || "",
              });
              setAdminEditingCert(null);
              setAdminCertImgPreview(null);
              setViewingAdmin(true);
              setViewingUser(null);
            };

            const closeAdmin = () => { setViewingAdmin(false); setAdminForm(null); };

            const saveAdmin = () => {
              if (!adminForm) return;
              // Sync project assignments
              if (onProjectsChange) {
                onProjectsChange(prev => prev.map(proj => {
                  const wants = (adminForm.assignedProjects||[]).includes(proj.id);
                  const has   = (proj.assignedAdminIds||[]).length > 0; // admin always has full access anyway
                  return proj;
                }));
              }
              onSettingsChange({
                ...settings,
                userFirstName:        adminForm.firstName,
                userLastName:         adminForm.lastName,
                userEmail:            adminForm.email,
                userTitle:            adminForm.title,
                userPhone:            adminForm.phone,
                userMobile:           adminForm.mobile,
                userAddress:          adminForm.address,
                userCity:             adminForm.city,
                userState:            adminForm.state,
                userZip:              adminForm.zip,
                userAvatar:           adminForm.avatar,
                userCertifications:   adminForm.certifications,
                userAssignedProjects: adminForm.assignedProjects,
                userNotes:            adminForm.notes,
              });
              closeAdmin();
            };

            const setAF = (key, val) => setAdminForm(f => ({...f, [key]: val}));

            return (
              <div style={{ background:"var(--surface)", border:`1px solid ${viewingAdmin ? accentColor : "var(--border)"}`, borderRadius:"var(--radius)", overflow:"hidden", marginBottom:12, boxShadow: viewingAdmin ? `0 0 0 3px ${accentColor}22` : "none", transition:"border-color .15s,box-shadow .15s" }}>

                {/* Header band */}
                <div style={{ padding:"11px 16px", background:`${accentColor}0e`, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                  <Icon d={ic.shield} size={14} stroke={accentColor} />
                  <span style={{ fontSize:12, fontWeight:700, color:accentColor }}>Account Owner</span>
                  {settings.userRole && settings.userRole !== "admin" && (
                    <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:8, background:`${ROLE_META[settings.userRole]?.color||accentColor}22`, color:ROLE_META[settings.userRole]?.color||accentColor, border:`1px solid ${ROLE_META[settings.userRole]?.color||accentColor}44` }}>
                      {ROLE_META[settings.userRole]?.label||settings.userRole}
                    </span>
                  )}
                  <span style={{ fontSize:11, color:"var(--text3)", marginLeft:"auto" }}>Included in {PLAN_NAMES[currentPlan]}</span>
                </div>

                {/* Clickable summary row */}
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => viewingAdmin ? closeAdmin() : openAdmin()}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14, color:"white", flexShrink:0, overflow:"hidden", border:`2px solid ${accentColor}`, boxShadow:`0 0 0 2px ${accentColor}33` }}>
                    {settings.userAvatar ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : adminInitials}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                      {settings.userFirstName} {settings.userLastName}
                      <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400 }}>(you)</span>
                      {certAlertCount > 0 && <span style={{ fontSize:10, fontWeight:800, padding:"1px 6px", borderRadius:8, background:"#e85a3a22", color:"#e85a3a", border:"1px solid #e85a3a44" }}>â  {certAlertCount} cert{certAlertCount!==1?"s":""}</span>}
                    </div>
                    <div style={{ fontSize:12, color:"var(--text2)" }}>{settings.userEmail} · {settings.userTitle||"Administrator"}</div>
                  </div>
                  <RoleBadge role={settings.userRole || "admin"} />
                  <StatusDot status="active" />
                  <span style={{ fontSize:12, color:"var(--text3)", marginLeft:4 }}>{viewingAdmin ? "â²" : "â¼"}</span>
                </div>

                {/* ââ Expanded self-edit panel ââ */}
                {viewingAdmin && adminForm && (
                  <div style={{ borderTop:"1px solid var(--border)", display:"flex", flexWrap:"wrap" }}>

                    {/* Left sidebar */}
                    <div style={{ width:200, flexShrink:0, background:`${accentColor}08`, borderRight:"1px solid var(--border)", padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                      {/* Avatar */}
                      <div style={{ position:"relative" }}>
                        <div style={{ width:72, height:72, borderRadius:"50%", background:accentColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:700, color:"white", overflow:"hidden", border:`3px solid ${accentColor}`, boxShadow:"0 0 0 3px var(--surface)" }}>
                          {adminForm.avatar ? <img src={adminForm.avatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : `${adminForm.firstName?.[0]||""}${adminForm.lastName?.[0]||""}`.toUpperCase()}
                        </div>
                        <label style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid var(--surface)" }}>
                          <Icon d={ic.camera} size={11} stroke="white" />
                          <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                            const f = e.target.files?.[0]; if(!f) return;
                            const r = new FileReader(); r.onload=ev=>setAF("avatar",ev.target.result); r.readAsDataURL(f);
                          }} />
                        </label>
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontWeight:700, fontSize:13 }}>{adminForm.firstName} {adminForm.lastName}</div>
                        <div style={{ fontSize:11, color:accentColor, fontWeight:700 }}>Administrator</div>
                      </div>
                      {adminForm.avatar && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:"var(--text3)", padding:"3px 8px" }} onClick={()=>setAF("avatar",null)}>Remove Photo</button>
                      )}
                      <div style={{ width:"100%", borderTop:"1px solid var(--border)", paddingTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                        <button className="btn btn-primary btn-sm" style={{ width:"100%", gap:5, justifyContent:"center", fontSize:12 }} onClick={saveAdmin}>
                          <Icon d={ic.check} size={13} /> Save Changes
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ width:"100%", gap:5, justifyContent:"center", fontSize:12 }} onClick={closeAdmin}>
                          Cancel
                        </button>
                      </div>
                    </div>

                    {/* Right: scrollable edit sections */}
                    <div style={{ flex:1, minWidth:0, background:"var(--surface2)", overflowY:"auto", maxHeight:600 }}>

                      {/* Profile */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.user} size={11} stroke="var(--text3)" /> Profile
                        </div>
                        <div className="form-row" style={{ marginBottom:10 }}>
                          <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="form-input" value={adminForm.firstName} onChange={e=>setAF("firstName",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={adminForm.lastName} onChange={e=>setAF("lastName",e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row" style={{ marginBottom:10 }}>
                          <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={adminForm.email} onChange={e=>setAF("email",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Job Title</label>
                            <input className="form-input" value={adminForm.title} onChange={e=>setAF("title",e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row" style={{ marginBottom:0 }}>
                          <div className="form-group">
                            <label className="form-label">Mobile</label>
                            <input className="form-input" value={adminForm.mobile} onChange={e=>setAF("mobile",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Office Phone</label>
                            <input className="form-input" value={adminForm.phone} onChange={e=>setAF("phone",e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.mapPin} size={11} stroke="var(--text3)" /> Address
                        </div>
                        <div className="form-group" style={{ marginBottom:10 }}>
                          <label className="form-label">Street Address</label>
                          <input className="form-input" value={adminForm.address} onChange={e=>setAF("address",e.target.value)} placeholder="123 Main St" />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">City</label>
                            <input className="form-input" value={adminForm.city} onChange={e=>setAF("city",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">State / Province</label>
                            <input className="form-input" value={adminForm.state} onChange={e=>setAF("state",e.target.value)} placeholder="e.g. CO or ON" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">ZIP / Postal Code</label>
                            <input className="form-input" value={adminForm.zip} onChange={e=>setAF("zip",e.target.value)} placeholder="e.g. 80202 or M5H 2N2" />
                          </div>
                        </div>
                      </div>

                      {/* Certifications */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={11} stroke="var(--text3)" />
                          Certifications ({adminForm.certifications.length})
                        </div>

                        {/* Alert banner */}
                        {adminForm.certifications.some(c=>["expired","expiring-soon"].includes(getCertStatus(c.dateExpires))) && (
                          <div style={{ padding:"8px 12px", background:"#e85a3a18", border:"1px solid #e85a3a44", borderRadius:7, fontSize:12, color:"#e85a3a", marginBottom:12 }}>
                            â  One or more certifications need attention.
                          </div>
                        )}

                        {/* Cert list */}
                        {adminForm.certifications.length > 0 && !adminEditingCert && (
                          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                            {adminForm.certifications.map(cert => {
                              const status = getCertStatus(cert.dateExpires);
                              const sm = CERT_STATUS_META[status];
                              const days = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                              return (
                                <div key={cert.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--surface)", borderRadius:8, border:`1px solid ${sm.border}` }}>
                                  {cert.image && <img src={cert.image} alt="" style={{ width:32, height:32, borderRadius:5, objectFit:"cover", flexShrink:0 }} />}
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                      <span style={{ fontWeight:700, fontSize:13 }}>{cert.name||"Unnamed"}</span>
                                      {cert.certCode && <span style={{ fontSize:10, fontWeight:800, padding:"0 6px", borderRadius:4, background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)", fontFamily:"monospace" }}>{cert.certCode}</span>}
                                      <span style={{ fontSize:10.5, fontWeight:700, padding:"1px 8px", borderRadius:10, background:sm.bg, color:sm.color, border:`1px solid ${sm.border}` }}>
                                        {status==="expired" ? `Expired ${Math.abs(days)}d ago` : status==="expiring-soon"||status==="expiring-warning" ? `${days}d left` : sm.label}
                                      </span>
                                    </div>
                                    {cert.certifyingBody && <div style={{ fontSize:11, color:"var(--text3)" }}>{cert.certifyingBody}</div>}
                                  </div>
                                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 8px" }}
                                      onClick={()=>{ setAdminEditingCert({...cert}); setAdminCertImgPreview(cert.image||null); }}>Edit</button>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 8px", color:"#e85a3a" }}
                                      onClick={()=>setAF("certifications", adminForm.certifications.filter(c=>c.id!==cert.id))}>Delete</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add cert button */}
                        {!adminEditingCert && (
                          <button className="btn btn-secondary btn-sm" onClick={()=>{ setAdminEditingCert({...EMPTY_CERT, id:uid()}); setAdminCertImgPreview(null); }}>
                            <Icon d={ic.plus} size={13} /> {adminForm.certifications.length===0 ? "Add First Certification" : "Add Certification"}
                          </button>
                        )}

                        {/* Inline cert form */}
                        {adminEditingCert && (
                          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"14px 16px", marginTop:8 }}>
                            {/* Image upload */}
                            <div style={{ display:"flex", gap:14, alignItems:"flex-start", marginBottom:14 }}>
                              <label style={{ width:64, height:64, borderRadius:8, border:"2px dashed var(--border)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"var(--surface2)", overflow:"hidden", flexShrink:0 }}>
                                {adminCertImgPreview
                                  ? <img src={adminCertImgPreview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                                  : <><Icon d={ic.camera} size={18} stroke="var(--text3)" /><span style={{ fontSize:10,color:"var(--text3)",marginTop:4 }}>Upload</span></>
                                }
                                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                                  const f=e.target.files?.[0]; if(!f) return;
                                  const r=new FileReader(); r.onload=ev=>{ setAdminCertImgPreview(ev.target.result); setAdminEditingCert(ec=>({...ec,image:ev.target.result})); }; r.readAsDataURL(f);
                                }} />
                              </label>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>Upload a photo of this certification card or document. Optional but recommended.</div>
                                {adminCertImgPreview && <button className="btn btn-ghost btn-sm" style={{ fontSize:11,marginTop:6,color:"var(--text3)" }} onClick={()=>{ setAdminCertImgPreview(null); setAdminEditingCert(ec=>({...ec,image:null})); }}>Remove image</button>}
                              </div>
                            </div>

                            {/* Name + Code */}
                            <div className="form-row" style={{ marginBottom:10 }}>
                              <div className="form-group" style={{ flex:2 }}>
                                <label className="form-label">Certification Name *</label>
                                <input className="form-input" placeholder="e.g. Water Restoration Technician" value={adminEditingCert.name}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,name:e.target.value}))} />
                              </div>
                              <div className="form-group" style={{ flex:1 }}>
                                <label className="form-label">Code <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(abbrev.)</span></label>
                                <input className="form-input" placeholder="WRT" value={adminEditingCert.certCode||""}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,certCode:e.target.value.toUpperCase()}))}
                                  style={{ fontFamily:"monospace",letterSpacing:".06em",textTransform:"uppercase" }} />
                              </div>
                            </div>

                            {/* Issuing org */}
                            <div className="form-group" style={{ marginBottom:10 }}>
                              <label className="form-label">Certifying Body / Issuing Organization</label>
                              <input className="form-input" placeholder="e.g. IICRC, OSHA, Red Cross" value={adminEditingCert.certifyingBody}
                                onChange={e=>setAdminEditingCert(ec=>({...ec,certifyingBody:e.target.value}))} />
                            </div>

                            {/* Dates */}
                            <div className="form-row" style={{ marginBottom:12 }}>
                              <div className="form-group">
                                <label className="form-label">Date Certified</label>
                                <input className="form-input" type="date" value={adminEditingCert.dateCertified}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,dateCertified:e.target.value}))} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Expiry Date <span style={{ fontWeight:400,color:"var(--text3)",fontSize:11 }}>(optional)</span></label>
                                <input className="form-input" type="date" value={adminEditingCert.dateExpires}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,dateExpires:e.target.value}))} />
                              </div>
                            </div>

                            {/* Live status preview */}
                            {adminEditingCert.dateExpires && (() => {
                              const s2=getCertStatus(adminEditingCert.dateExpires); const sm2=CERT_STATUS_META[s2];
                              return <div style={{ fontSize:11,padding:"4px 10px",borderRadius:8,background:sm2.bg,color:sm2.color,border:`1px solid ${sm2.border}`,display:"inline-block",marginBottom:12 }}>{sm2.label}</div>;
                            })()}

                            <div style={{ display:"flex", gap:8 }}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>{ setAdminEditingCert(null); setAdminCertImgPreview(null); }}>Cancel</button>
                              <button className="btn btn-primary btn-sm" disabled={!adminEditingCert.name}
                                onClick={()=>{
                                  const existing = adminForm.certifications.find(c=>c.id===adminEditingCert.id);
                                  const updated = existing
                                    ? adminForm.certifications.map(c=>c.id===adminEditingCert.id ? adminEditingCert : c)
                                    : [...adminForm.certifications, adminEditingCert];
                                  setAF("certifications", updated);
                                  setAdminEditingCert(null); setAdminCertImgPreview(null);
                                }}>
                                <Icon d={ic.check} size={13} /> {adminForm.certifications.find(c=>c.id===adminEditingCert.id) ? "Update" : "Add"} Certification
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Jobsite assignment */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:8, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.folder} size={11} stroke="var(--text3)" /> Jobsite Access
                        </div>
                        {(settings.userRole === "admin" || !settings.userRole) && (
                          <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600, padding:"7px 10px", background:"var(--accent-glow)", borderRadius:7, border:"1px solid var(--accent)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                            <Icon d={ic.shield} size={13} stroke="var(--accent)" /> As Account Owner, you have full access to all jobsites.
                          </div>
                        )}
                        <div style={{ fontSize:11, color:"var(--text3)", marginBottom:8 }}>
                          {(settings.userRole === "admin" || !settings.userRole)
                            ? "Tag specific jobsites you're personally responsible for:"
                            : "Select the jobsites you are responsible for:"}
                        </div>
                        {/* Assigned chips */}
                        {adminAssignedProjs.length > 0 && (
                          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:10 }}>
                            {adminAssignedProjs.map(p=>(
                              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:"var(--surface)", borderRadius:7, border:"1px solid var(--border)" }}>
                                <span style={{ width:9, height:9, borderRadius:"50%", background:p.color, display:"inline-block", flexShrink:0 }} />
                                <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>{p.title}</span>
                                <button style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 6px", borderRadius:4, color:"var(--text3)", fontSize:16, lineHeight:1 }}
                                  onClick={()=>setAF("assignedProjects",(adminForm.assignedProjects||[]).filter(id=>id!==p.id))}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Unassigned picker */}
                        {(() => {
                          const unassigned = projects.filter(p=>!(adminForm.assignedProjects||[]).includes(p.id));
                          if (unassigned.length === 0) return <div style={{ fontSize:12, color:"var(--text3)", fontStyle:"italic" }}>{projects.length===0 ? "No projects yet." : "All jobsites tagged â"}</div>;
                          return (
                            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                              {unassigned.map(p=>(
                                <div key={p.id}
                                  style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:"var(--surface2)", borderRadius:7, border:"1px solid var(--border)", cursor:"pointer", transition:"border-color .12s,background .12s" }}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-glow)";}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--surface2)";}}
                                  onClick={()=>setAF("assignedProjects",[...(adminForm.assignedProjects||[]),p.id])}>
                                  <span style={{ width:9, height:9, borderRadius:"50%", background:p.color, display:"inline-block", flexShrink:0 }} />
                                  <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>{p.title}</span>
                                  {p.address && <span style={{ fontSize:11, color:"var(--text3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{p.address}{p.city?`, ${p.city}`:""}</span>}
                                  <Icon d={ic.plus} size={13} stroke="var(--accent)" />
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Notes */}
                      <div style={{ padding:"16px 20px" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:8, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.text} size={11} stroke="var(--text3)" /> Notes
                        </div>
                        <textarea className="form-input" rows={3} style={{ resize:"vertical" }} placeholder="Personal notes, certifications summary, etc."
                          value={adminForm.notes} onChange={e=>setAF("notes",e.target.value)} />
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Additional users */}
          {filtered.length === 0 && searchQ === "" && (
            <div style={{ textAlign:"center",padding:"48px 20px",background:"var(--surface)",borderRadius:"var(--radius)",border:"2px dashed var(--border)" }}>
              <Icon d={ic.userPlus} size={36} stroke="var(--text3)" />
              <div style={{ fontWeight:700,fontSize:15,marginTop:12,marginBottom:6 }}>No team members yet</div>
              <div style={{ fontSize:13,color:"var(--text2)",marginBottom:18 }}>Add users to collaborate on jobsites. Each additional user is billed at <strong style={{ color:"var(--accent)" }}>${userSeat}/mo</strong>.</div>
              <button className="btn btn-primary" onClick={()=>canEditTeam && setAddingUser(true)} disabled={!canEditTeam}><Icon d={ic.userPlus} size={14} /> Add First User</button>
            </div>
          )}

          {filtered.map(u => {
            const isViewing = viewingUser === u.id;
            const meta = ROLE_META[u.role] || ROLE_META.user;
            const initials = `${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase() || "?";
            const assignedProjs = (u.assignedProjects||[]).map(pid => projects.find(p=>p.id===pid)).filter(Boolean);
            // Identify the current logged-in user's own team row by email match or explicit flag
            const isSelf = !!(u.email && settings.userEmail && u.email.toLowerCase() === settings.userEmail.toLowerCase()) || u._isSelf;
            const canSelfEdit = isSelf && (settings.userRole === "manager" || settings.userRole === "user");
            return (
              <div key={u.id} style={{ background:"var(--surface)",border:`1px solid ${isViewing ? "var(--accent)" : "var(--border)"}`,borderRadius:"var(--radius)",marginBottom:8,opacity:u.status==="inactive"?0.7:1,transition:"border-color .15s,box-shadow .15s",boxShadow:isViewing?"0 0 0 3px var(--accent-glow)":"none",overflow:"hidden" }}>

                {/* ââ Clickable summary row ââ */}
                <div style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",cursor:"pointer" }}
                  onClick={()=>setViewingUser(isViewing ? null : u.id)}>
                  <div style={{ width:40,height:40,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"white",flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:14,marginBottom:2,display:"flex",alignItems:"center",gap:8 }}>
                      {u.firstName} {u.lastName}
                      {isSelf && <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(you)</span>}
                      {u.status==="inactive" && <span style={{ fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"rgba(232,90,58,.12)",color:"#e85a3a",border:"1px solid rgba(232,90,58,.25)" }}>Deactivated</span>}
                      {u.status==="pending" && <span style={{ fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"rgba(232,197,58,.12)",color:"#b8950a",border:"1px solid rgba(232,197,58,.3)" }}>Pending Invite</span>}
                    </div>
                    <div style={{ fontSize:12,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {u.email}{u.title ? ` · ${u.title}` : ""}{u.department ? ` · ${u.department}` : ""}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
                    <RoleBadge role={u.role} />
                    <span style={{ fontSize:12,color:"var(--text3)" }}>${userSeat}/mo</span>
                    <Icon d={isViewing ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} size={16} stroke="var(--text3)" />
                  </div>
                </div>

                {/* ââ Expanded profile panel ââ */}
                {isViewing && (() => {
                  const statusColor = u.status==="active" ? "#3dba7e" : u.status==="pending" ? "#e8c53a" : "#e85a3a";
                  const statusLabel = u.status==="active" ? "Active" : u.status==="pending" ? "Pending Invite" : "Deactivated";
                  return (
                    <div style={{ borderTop:"1px solid var(--border)" }}>

                      {/* ââ Accent bar ââ */}
                      <div style={{ height:3,background:`linear-gradient(90deg,${meta.color},${meta.color}55,transparent)` }} />

                      <div style={{ display:"flex",gap:0 }}>

                        {/* ââ LEFT: profile sidebar ââ */}
                        <div style={{ width:200,flexShrink:0,padding:"20px 16px 20px 20px",borderRight:"1px solid var(--border)",background:"var(--surface)",display:"flex",flexDirection:"column",gap:16 }}>

                          {/* Avatar */}
                          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,paddingBottom:16,borderBottom:"1px solid var(--border)" }}>
                            <div style={{ width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${meta.color},${meta.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:22,color:"white",boxShadow:`0 0 0 3px var(--surface), 0 0 0 5px ${meta.color}44` }}>
                              {initials}
                            </div>
                            <div style={{ textAlign:"center" }}>
                              <div style={{ fontWeight:800,fontSize:14,lineHeight:1.3 }}>{u.firstName}<br/>{u.lastName}</div>
                            </div>
                            <RoleBadge role={u.role} />
                            <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:600,color:statusColor }}>
                              <span style={{ width:6,height:6,borderRadius:"50%",background:statusColor,display:"inline-block" }} />
                              {statusLabel}
                            </div>
                          </div>

                          {/* Quick facts */}
                          <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
                            {u.title && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Title</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.title}</div>
                              </div>
                            )}
                            {u.department && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Department</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.department}</div>
                              </div>
                            )}
                            {u.employeeId && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Employee ID</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.employeeId}</div>
                              </div>
                            )}
                            {u.startDate && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Start Date</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{new Date(u.startDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Billing</div>
                              <div style={{ fontSize:12,color:"var(--accent)",fontWeight:700 }}>${userSeat}/mo</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display:"flex",flexDirection:"column",gap:6,marginTop:"auto",paddingTop:14,borderTop:"1px solid var(--border)" }}>
                            <button className="btn btn-primary btn-sm" style={{ width:"100%",gap:5,justifyContent:"center" }}
                              onClick={e=>{ if (!(canEditTeam || canSelfEdit)) return; e.stopPropagation();setEditingUser(u); }}
                              disabled={!(canEditTeam || canSelfEdit)}>
                              <Icon d={ic.edit} size={13} /> {canSelfEdit ? "Edit My Profile" : "Edit Profile"}
                            </button>
                            {!canSelfEdit && canEditTeam && (
                              <button className="btn btn-ghost btn-sm" style={{ width:"100%",gap:5,justifyContent:"center",color:"#e85a3a",fontSize:12 }}
                                onClick={e=>{e.stopPropagation();setConfirmDel(u);}}>
                                <Icon d={ic.userX} size={13} /> Remove User
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ââ RIGHT: detail sections ââ */}
                        <div style={{ flex:1,minWidth:0,background:"var(--surface2)" }}>

                          {/* Contact */}
                          <div style={{ padding:"18px 20px",borderBottom:"1px solid var(--border)" }}>
                            <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:12,display:"flex",alignItems:"center",gap:7 }}>
                              <Icon d={ic.user} size={11} stroke="var(--text3)" /> Contact
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px" }}>
                              {u.email && (
                                <div style={{ gridColumn:"1/-1" }}>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Email</div>
                                  <div style={{ fontSize:13,color:"var(--text)",wordBreak:"break-all" }}>{u.email}</div>
                                </div>
                              )}
                              {u.mobile && (
                                <div>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Mobile</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{u.mobile}</div>
                                </div>
                              )}
                              {u.phone && (
                                <div>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Office Phone</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{u.phone}</div>
                                </div>
                              )}
                              {(u.address || u.city) && (
                                <div style={{ gridColumn:"1/-1" }}>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Address</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{[u.address,u.city,u.state,u.zip].filter(Boolean).join(", ")}</div>
                                </div>
                              )}
                              {!u.email && !u.mobile && !u.phone && !u.address && (
                                <div style={{ gridColumn:"1/-1",fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>No contact details on file</div>
                              )}
                            </div>
                          </div>

                          {/* Certifications */}
                          {(u.certifications||[]).length > 0 && (
                            <div style={{ padding:"0 20px 16px" }}>
                              <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:8,display:"flex",alignItems:"center",gap:7 }}>
                                <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={11} stroke="var(--text3)" />
                                Certifications ({u.certifications.length})
                              </div>
                              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                                {u.certifications.map(cert => {
                                  const status = getCertStatus(cert.dateExpires);
                                  const sm = CERT_STATUS_META[status];
                                  const days = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                                  return (
                                    <div key={cert.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface)",borderRadius:7,border:`1px solid ${sm.border}` }}>
                                      {cert.image && <img src={cert.image} alt="" style={{ width:28,height:28,borderRadius:5,objectFit:"cover",flexShrink:0 }} />}
                                      <div style={{ flex:1,minWidth:0 }}>
                                        <div style={{ fontSize:12.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6 }}>
                                          {cert.name}
                                          {cert.certCode && <span style={{ fontSize:10,fontWeight:800,padding:"0px 5px",borderRadius:4,background:"var(--surface2)",color:"var(--text3)",border:"1px solid var(--border)",fontFamily:"monospace",flexShrink:0 }}>{cert.certCode}</span>}
                                        </div>
                                        {cert.certifyingBody && <div style={{ fontSize:11,color:"var(--text3)" }}>{cert.certifyingBody}</div>}
                                      </div>
                                      <span style={{ fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:10,background:sm.bg,color:sm.color,border:`1px solid ${sm.border}`,whiteSpace:"nowrap",flexShrink:0 }}>
                                        {status==="expired" ? `Expired ${Math.abs(days)}d ago`
                                          : status==="expiring-soon" ? `${days}d left`
                                          : status==="expiring-warning" ? `${days}d left`
                                          : cert.dateExpires ? sm.label : sm.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Projects */}
                          <div style={{ padding:"18px 20px" }}>
                            <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:12,display:"flex",alignItems:"center",gap:7 }}>
                              <Icon d={ic.folder} size={11} stroke="var(--text3)" />
                              {u.role==="admin" ? "Project Access" : `Assigned Projects (${assignedProjs.length})`}
                            </div>
                            {u.role==="admin" ? (
                              <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--accent-glow)",borderRadius:8,border:"1px solid var(--accent)" }}>
                                <Icon d={ic.shield} size={13} stroke="var(--accent)" />
                                <span style={{ fontSize:12,color:"var(--accent)",fontWeight:600 }}>Full access to all jobsites</span>
                              </div>
                            ) : (
                              <>
                                {u.role==="manager" && (
                                  <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:10,padding:"6px 10px",background:"var(--surface2)",borderRadius:7,border:"1px solid var(--border)" }}>
                                    <Icon d={ic.shield} size={11} stroke="var(--accent)" /> {isSelf ? "Select the jobsites you are personally responsible for:" : "Managers have full access to all jobsites. Tag specific ones they're personally responsible for:"}
                                  </div>
                                )}
                                {/* Assigned chips with quick-remove */}
                                {assignedProjs.length > 0 && (
                                  <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:10 }}>
                                    {assignedProjs.map(p=>(
                                      <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface)",borderRadius:7,border:"1px solid var(--border)" }}>
                                        <span style={{ width:9,height:9,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />
                                        <span style={{ fontSize:12.5,fontWeight:600,flex:1 }}>{p.title}</span>
                                        <button style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4,color:"var(--text3)",fontSize:16,lineHeight:1 }}
                                          title="Remove from project"
                                          onClick={e=>{ e.stopPropagation();
                                            saveUser({...u, assignedProjects:(u.assignedProjects||[]).filter(id=>id!==p.id)});
                                          }}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Inline picker: all unassigned projects */}
                                {(() => {
                                  const unassigned = projects.filter(p=>!(u.assignedProjects||[]).includes(p.id));
                                  if (unassigned.length === 0 && assignedProjs.length === 0)
                                    return <div style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>No projects in the system yet.</div>;
                                  if (unassigned.length === 0)
                                    return <div style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>All jobsites assigned â</div>;
                                  return (
                                    <div>
                                      <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,marginBottom:7 }}>
                                        {assignedProjs.length > 0 ? "Add more jobsites:" : "Click a jobsite to assign:"}
                                      </div>
                                      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                                        {unassigned.map(p=>(
                                          <div key={p.id}
                                            style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface2)",borderRadius:7,border:"1px solid var(--border)",cursor:"pointer",transition:"border-color .12s,background .12s" }}
                                            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-glow)";}}
                                            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--surface2)";}}
                                            onClick={e=>{ e.stopPropagation();
                                              saveUser({...u, assignedProjects:[...(u.assignedProjects||[]), p.id]});
                                            }}>
                                            <span style={{ width:9,height:9,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />
                                            <span style={{ fontSize:12.5,fontWeight:600,flex:1 }}>{p.title}</span>
                                            {p.address && <span style={{ fontSize:11,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130 }}>{p.address}{p.city?`, ${p.city}`:""}</span>}
                                            <Icon d={ic.plus} size={13} stroke="var(--accent)" />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>

                          {/* Notes â editable inline for all users */}
                          <div style={{ padding:"0 20px 18px" }}>
                            <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:8,display:"flex",alignItems:"center",gap:7 }}>
                              <Icon d={ic.text} size={11} stroke="var(--text3)" /> Notes
                            </div>
                            <textarea className="form-input" rows={3} style={{ resize:"vertical",width:"100%",boxSizing:"border-box" }}
                              placeholder="Internal notes about this team memberâ¦"
                              defaultValue={u.notes||""}
                              onBlur={e=>{ if(e.target.value !== (u.notes||"")) saveUser({...u, notes:e.target.value}); }}
                            />
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {filtered.length===0 && searchQ && (
            <div style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No users match "{searchQ}"</div>
          )}
        </div>
      )}

      {/* ââ BILLING ââ */}
      {tab==="billing" && (
        <div className="fade-in">

          {/* ââ Billing cycle toggle ââ */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20 }}>
            <div style={{ display:"inline-flex",alignItems:"center",gap:0,background:"var(--surface2)",borderRadius:40,border:"1px solid var(--border)",padding:3 }}>
              <button onClick={()=>onSettingsChange({...settings,billingCycle:"monthly"})}
                style={{ padding:"7px 22px",borderRadius:36,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s",
                  background: cycle==="monthly" ? "var(--accent)" : "transparent",
                  color:       cycle==="monthly" ? "white"         : "var(--text2)" }}>
                Monthly
              </button>
              <button onClick={()=>onSettingsChange({...settings,billingCycle:"annual"})}
                style={{ padding:"7px 22px",borderRadius:36,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:7,
                  background: cycle==="annual" ? "var(--accent)" : "transparent",
                  color:       cycle==="annual" ? "white"         : "var(--text2)" }}>
                Annual
                <span style={{ fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:8,
                  background: cycle==="annual" ? "rgba(255,255,255,.25)" : "#3dba7e22",
                  color:       cycle==="annual" ? "white"                 : "#3dba7e",
                  border:      cycle==="annual" ? "none"                  : "1px solid #3dba7e55" }}>
                  Save up to 15%
                </span>
              </button>
            </div>
          </div>

          {/* ââ Current Plan card ââ */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontWeight:700 }}>Current Plan</span>
              <span style={{ fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:10,
                background: isCommand ? "linear-gradient(135deg,#2b7fe822,#1a5fc822)" : isPro ? "linear-gradient(135deg,#7c3aed22,#a855f722)" : "var(--surface2)",
                color: isCommand ? "#2b7fe8" : isPro ? "#a855f7" : "var(--text3)",
                border: `1px solid ${isCommand ? "#2b7fe850" : isPro ? "#a855f750" : "var(--border)"}` }}>
                {isCommand ? "â¬¡ Command III" : isPro ? "â¦ Intelligence II" : "Capture I"} · {cycle==="annual" ? "Annual" : "Monthly"}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20 }}>

                {/* Capture I */}
                <div style={{ padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:currentPlan==="base"?"2px solid var(--accent)":"1px solid var(--border)",position:"relative" }}>
                  {currentPlan==="base" && <div style={{ position:"absolute",top:-10,left:16,fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,background:"var(--accent)",color:"white",textTransform:"uppercase",letterSpacing:".06em" }}>Current</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:6 }}>Capture I</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:2 }}>
                    <span style={{ fontSize:24,fontWeight:900,color:"var(--text)",lineHeight:1 }}>${PRICING[cycle].base.admin}</span>
                    <span style={{ fontSize:11,color:"var(--text2)" }}>/mo</span>
                  </div>
                  {cycle==="annual" && <div style={{ fontSize:10,color:"#3dba7e",fontWeight:700,marginBottom:2 }}>Save ${(PRICING.monthly.base.admin-PRICING.annual.base.admin)*12}/yr</div>}
                  <div style={{ fontSize:11.5,color:"var(--text2)",fontWeight:500,marginBottom:10 }}>admin · +${PRICING[cycle].base.user}/user/mo</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:10 }}>
                    {["All core features","Unlimited projects","Video capture (1.5 mins)","Team Chat (4 groups)","Calendar (up to 10 users)","AI Report Writer","5 AI Generation Krakens/week"].map(f=>(
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text2)" }}><Icon d={ic.check} size={10} stroke="#3dba7e" /> {f}</div>
                    ))}
                  </div>
                  {currentPlan==="base"
                    ? <div style={{ fontSize:11,color:"var(--text3)",textAlign:"center",fontStyle:"italic" }}>Your current plan</div>
                    : <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"var(--text3)",width:"100%" }} onClick={()=>setConfirmDowngrade("base")}>Downgrade to Capture I</button>
                  }
                </div>

                {/* Intelligence II */}
                <div style={{ padding:16,background:currentPlan==="pro"?"linear-gradient(135deg,#7c3aed0d,#a855f70d)":"var(--surface2)",borderRadius:"var(--radius)",border:currentPlan==="pro"?"2px solid #a855f7":"1px solid var(--border)",position:"relative" }}>
                  {currentPlan==="pro" && <div style={{ position:"absolute",top:-10,left:16,fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"white",textTransform:"uppercase",letterSpacing:".06em" }}>Current</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:"#a855f7",marginBottom:6 }}>â¦ Intelligence II</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:2 }}>
                    <span style={{ fontSize:24,fontWeight:900,color:"var(--text)",lineHeight:1 }}>${PRICING[cycle].pro.admin}</span>
                    <span style={{ fontSize:11,color:"var(--text2)" }}>/mo</span>
                  </div>
                  {cycle==="annual" && <div style={{ fontSize:10,color:"#3dba7e",fontWeight:700,marginBottom:2 }}>Save ${(PRICING.monthly.pro.admin-PRICING.annual.pro.admin)*12}/yr</div>}
                  <div style={{ fontSize:11.5,color:"#a855f7",fontWeight:500,marginBottom:10 }}>admin · +${PRICING[cycle].pro.user}/user/mo</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:10 }}>
                    {["Everything in Capture I","Before & After comparison","Video capture (6 mins)","Team Chat (15 groups)","Calendar (up to 25 users)","AI Report Writer","75 AI Generation Krakens/week"].map(f=>(
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#a855f7" }}><Icon d={ic.check} size={10} stroke="#a855f7" /> {f}</div>
                    ))}
                  </div>
                  {currentPlan==="pro"
                    ? <div style={{ fontSize:11,color:"#a855f7",textAlign:"center",fontStyle:"italic" }}>Your current plan</div>
                    : currentPlan==="command"
                      ? <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"var(--text3)",width:"100%" }} onClick={()=>setConfirmDowngrade("pro")}>Downgrade to Intelligence II</button>
                      : <button className="btn btn-primary btn-sm" style={{ width:"100%",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",fontWeight:700,gap:6,fontSize:11 }} onClick={()=>setConfirmUpgrade("pro")}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                          Upgrade to Intelligence II
                        </button>
                  }
                </div>

                {/* Command III */}
                <div style={{ padding:16,background:currentPlan==="command"?"linear-gradient(135deg,#2b7fe80d,#1a5fc80d)":"var(--surface2)",borderRadius:"var(--radius)",border:currentPlan==="command"?"2px solid #2b7fe8":"1px solid var(--border)",position:"relative" }}>
                  {currentPlan==="command" && <div style={{ position:"absolute",top:-10,left:16,fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,background:"linear-gradient(135deg,#2b7fe8,#1a5fc8)",color:"white",textTransform:"uppercase",letterSpacing:".06em" }}>Current</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:"#2b7fe8",marginBottom:6 }}>â¬¡ Command III</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:2 }}>
                    <span style={{ fontSize:24,fontWeight:900,color:"var(--text)",lineHeight:1 }}>${PRICING[cycle].command.admin}</span>
                    <span style={{ fontSize:11,color:"var(--text2)" }}>/mo</span>
                  </div>
                  {cycle==="annual" && <div style={{ fontSize:10,color:"#3dba7e",fontWeight:700,marginBottom:2 }}>Save ${(PRICING.monthly.command.admin-PRICING.annual.command.admin)*12}/yr</div>}
                  <div style={{ fontSize:11.5,color:"#2b7fe8",fontWeight:500,marginBottom:10 }}>admin · +${PRICING[cycle].command.user}/user/mo</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:10 }}>
                    {["Everything in Intelligence II","Video capture (12 mins)","Team Chat (50 groups)","Calendar (unlimited users)","1,000 AI Generation Krakens/week","Client Portal (desktop only)"].map(f=>(
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#2b7fe8" }}><Icon d={ic.check} size={10} stroke="#2b7fe8" /> {f}</div>
                    ))}
                  </div>
                  {currentPlan==="command"
                    ? <div style={{ fontSize:11,color:"#2b7fe8",textAlign:"center",fontStyle:"italic" }}>Your current plan</div>
                    : <button className="btn btn-primary btn-sm" style={{ width:"100%",background:"linear-gradient(135deg,#2b7fe8,#1a5fc8)",border:"none",fontWeight:700,gap:6,fontSize:11 }} onClick={()=>setConfirmUpgrade("command")}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                        Upgrade to Command III
                      </button>
                  }
                </div>
              </div>

              {/* Total banner */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",background:"var(--accent-glow)",borderRadius:"var(--radius)",border:"1px solid var(--accent)" }}>
                <div>
                  <div style={{ fontWeight:700,fontSize:15,marginBottom:2 }}>{cycle==="annual" ? "Annual Total" : "Monthly Total"}</div>
                  <div style={{ fontSize:12.5,color:"var(--text2)" }}>
                    {cycle==="annual"
                      ? `$${monthlyTotal*12}/yr · renews on the ${billingDaySuffix(settings?.signupDate)} each year`
                      : `Renews on the ${billingDaySuffix(settings?.signupDate)} each month`
                    }
                    {" · "}{PLAN_NAMES[currentPlan]}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:28,fontWeight:900,color:"var(--accent)" }}>${monthlyTotal}<span style={{ fontSize:13,fontWeight:400,color:"var(--text2)" }}>/mo</span></div>
                  {cycle==="annual" && <div style={{ fontSize:11,color:"#3dba7e",fontWeight:700 }}>= ${monthlyTotal*12}/yr total</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ââ Pricing Breakdown ââ */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Pricing Breakdown</span></div>
            <div className="card-body">
              <div style={{ background:"var(--surface2)",borderRadius:"var(--radius)",overflow:"hidden",border:"1px solid var(--border)" }}>
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"9px 14px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)",gap:8 }}>
                  <span>Line Item</span><span>Rate</span><span style={{ textAlign:"right" }}>Amount/mo</span>
                </div>
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:13,gap:8 }}>
                  <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                    {isPro && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>}
                    {PLAN_NAMES[currentPlan]} â Admin seat
                  </span>
                  <span style={{ color:"var(--text2)" }}>${adminSeat}/mo</span>
                  <span style={{ textAlign:"right",fontWeight:600 }}>${adminSeat}.00</span>
                </div>
                {users.map(u=>(
                  <div key={u.id} className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:13,opacity:u.status==="inactive"?0.5:1,gap:8 }}>
                    <span style={{ display:"flex",alignItems:"center",gap:8,minWidth:0 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:ROLE_META[u.role]?.color||"#888",display:"inline-block",flexShrink:0 }} />
                      <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.firstName} {u.lastName} <span style={{ color:"var(--text3)",fontSize:11 }}>({ROLE_META[u.role]?.label}){u.status==="inactive"?" · Deactivated":""}</span></span>
                    </span>
                    <span style={{ color:"var(--text2)" }}>${userSeat}/mo</span>
                    <span style={{ textAlign:"right",fontWeight:600 }}>{u.status==="inactive"?"$0.00":`$${userSeat}.00`}</span>
                  </div>
                ))}
                {/* Proration line â shown when plan changed mid-cycle this billing period */}
                {settings?.planChangeDate && (() => {
                  const changeDate = new Date(settings.planChangeDate);
                  const info = getBillingCycleInfo(settings?.signupDate, cycle);
                  const withinCycle = changeDate >= info.cycleStart && changeDate <= info.cycleEnd;
                  if (!withinCycle) return null;
                  const prevPlan = isPro ? "base" : "pro";
                  const p = calcProration({...settings, plan: prevPlan}, users, prevPlan, settings.plan);
                  return (
                    <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:12,gap:8,background:"linear-gradient(90deg,#3dba7e08,transparent)" }}>
                      <span style={{ color:"var(--text2)",fontStyle:"italic" }}>
                        Mid-cycle adjustment ({changeDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}) · {p.daysLeft} days prorated
                      </span>
                      <span style={{ color:"var(--text2)" }}>â</span>
                      <span style={{ textAlign:"right",fontWeight:600,color: p.netCharge > 0 ? "var(--accent)" : "#3dba7e" }}>
                        {p.netCharge > 0 ? `+$${p.netCharge}` : `-$${Math.abs(p.netCharge)}`}
                      </span>
                    </div>
                  );
                })()}
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"11px 14px",alignItems:"center",fontSize:13.5,fontWeight:800,background:"var(--surface3)",gap:8,borderTop:"1px solid var(--border)" }}>
                  <span>Monthly subtotal</span><span></span><span style={{ textAlign:"right",color:"var(--accent)" }}>${monthlyTotal}/mo</span>
                </div>
                {cycle==="annual" && (
                  <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"11px 14px",alignItems:"center",fontSize:13,fontWeight:700,background:"linear-gradient(90deg,#3dba7e0d,transparent)",gap:8 }}>
                    <span style={{ color:"#3dba7e" }}>Annual charge (×12)</span><span></span><span style={{ textAlign:"right",color:"#3dba7e",fontWeight:800 }}>${monthlyTotal*12}/yr</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ââ Payment Method ââ */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Payment Method</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",marginBottom:12 }}>
                <Icon d={ic.creditCard} size={22} stroke="var(--accent)" />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600,fontSize:13.5 }}>{cardInfo.brand} ending in {cardInfo.last4}</div>
                  <div style={{ fontSize:12,color:"var(--text2)" }}>Expires {cardInfo.displayExpiry} · Auto-renews {cycle==="annual"?"annually":"monthly"} on the {billingDaySuffix(settings?.signupDate)}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={()=>setShowCardModal(true)}>Update Card</button>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color:"var(--text2)",fontSize:12 }} onClick={()=>setShowBillingHistory(true)}>View billing history â</button>
            </div>
          </div>

          {/* ââ Pending downgrade banner ââ */}
          {settings?.pendingPlan && settings.pendingPlan !== currentPlan && (
            <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(232,90,58,.08)",border:"1px solid rgba(232,90,58,.3)",borderRadius:10,marginBottom:16 }}>
              <Icon d={ic.alert} size={16} stroke="#e85a3a" />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>Downgrade scheduled</div>
                <div style={{ fontSize:12,color:"var(--text2)" }}>
                  Your account will switch to {PLAN_NAMES[settings.pendingPlan]} on <strong>{getBillingCycleInfo(settings?.signupDate, cycle).cycleEnd.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong>. Current plan features remain active until then.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:12,whiteSpace:"nowrap" }}
                onClick={()=>onSettingsChange({...settings, pendingPlan:null})}>
                Cancel downgrade
              </button>
            </div>
          )}

          {/* Upgrade confirm */}
          {confirmUpgrade && (() => {
            const toPlan = confirmUpgrade;
            const toPlanName = PLAN_NAMES[toPlan];
            const isToCommand = toPlan === "command";
            const gradFrom = isToCommand ? "#2b7fe8" : "#7c3aed";
            const gradTo   = isToCommand ? "#1a5fc8" : "#a855f7";
            const p = calcProration(settings, users, currentPlan, toPlan);
            return (
              <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
                onClick={e=>{if(e.target===e.currentTarget)setConfirmUpgrade(null);}}>
                <div style={{ background:"var(--surface)",border:`1px solid ${gradTo}50`,borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(460px,95vw)",overflow:"hidden" }}>
                  <div style={{ padding:"22px 24px 18px",background:`linear-gradient(135deg,${gradFrom}12,${gradTo}12)`,borderBottom:`1px solid ${gradTo}30` }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                      <div style={{ width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${gradFrom},${gradTo})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                      </div>
                      <div style={{ fontWeight:800,fontSize:16 }}>Upgrade to {toPlanName}</div>
                    </div>
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                      {isToCommand ? "1,000 AI Generation Krakens/week and all Command features" : "75 AI Generation Krakens/week and Intelligence features"} unlock immediately. You are only charged for the remaining days in your current billing cycle.
                    </div>
                  </div>
                  <div style={{ padding:"16px 24px" }}>
                    <div style={{ background:"var(--surface2)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,fontSize:12.5 }}>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>{PLAN_NAMES[currentPlan]} unused credit ({p.daysLeft} of {p.daysTotal} days)</span>
                        <span style={{ color:"#3dba7e",fontWeight:700 }}>-${p.unusedCredit}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>{toPlanName} prorated charge ({p.daysLeft} days)</span>
                        <span style={{ fontWeight:600 }}>+${p.newCharge}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"10px 12px",fontWeight:800,fontSize:13 }}>
                        <span>Charged today</span>
                        <span style={{ color: p.netCharge > 0 ? "var(--accent)" : "#3dba7e" }}>${p.netCharge > 0 ? p.netCharge : "0.00"}{p.netCharge <= 0 ? " (credit applied)" : ""}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",marginBottom:14 }}>
                      From <strong>{p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong> onwards: <strong>${p.toTotal}/mo</strong> ({cycle})
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirmUpgrade(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" style={{ flex:2,background:`linear-gradient(135deg,${gradFrom},${gradTo})`,border:"none",fontWeight:700,gap:6 }}
                        onClick={()=>{ onSettingsChange({...settings, plan:toPlan, pendingPlan:null, planChangeDate: new Date().toISOString().slice(0,10) }); setConfirmUpgrade(null); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                        Confirm - Pay ${Math.max(0, p.netCharge)} now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

                    {/* Downgrade confirm */}
          {confirmDowngrade && (() => {
            const toPlan = confirmDowngrade;
            const p = calcProration(settings, users, currentPlan, toPlan);
            const cycleEndStr = p.cycleEnd.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
            return (
              <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
                onClick={e=>{if(e.target===e.currentTarget)setConfirmDowngrade(null);}}>
                <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(460px,95vw)",overflow:"hidden" }}>
                  <div style={{ padding:"22px 24px 18px",borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:16,marginBottom:8 }}>Downgrade to {PLAN_NAMES[toPlan]}?</div>
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                      {PLAN_NAMES[currentPlan]} features stay active until your current cycle ends on <strong>{cycleEndStr}</strong>. After that, downgraded plan features will be locked.
                    </div>
                  </div>
                  <div style={{ padding:"16px 24px" }}>
                    {/* What you lose */}
                    <div style={{ background:"rgba(232,90,58,.06)",border:"1px solid rgba(232,90,58,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:"#e85a3a",marginBottom:6 }}>Features you'll lose on {p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}:</div>
                      {["AI Report Writer","Priority support","Advanced analytics (when released)","Future Intelligence II features"].map(f=>(
                        <div key={f} style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text2)",marginBottom:3 }}>
                          <Icon d={ic.close} size={11} stroke="#e85a3a" /> {f}
                        </div>
                      ))}
                    </div>
                    {/* Billing change */}
                    <div style={{ background:"var(--surface2)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,fontSize:12.5 }}>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>Current rate ({PLAN_NAMES[currentPlan]})</span>
                        <span style={{ fontWeight:600 }}>${p.fromTotal}/mo</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>Rate after {p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})} ({PLAN_NAMES[toPlan]})</span>
                        <span style={{ fontWeight:600,color:"#3dba7e" }}>${p.toTotal}/mo</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"10px 12px",fontWeight:800,fontSize:13 }}>
                        <span>Monthly savings</span>
                        <span style={{ color:"#3dba7e" }}>â${p.fromTotal - p.toTotal}/mo</span>
                      </div>
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",marginBottom:14 }}>No refund for the current period. Your data will not be affected.</div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirmDowngrade(null)}>Keep {PLAN_NAMES[currentPlan]}</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1,color:"#e85a3a",borderColor:"rgba(232,90,58,.3)" }}
                        onClick={()=>{ onSettingsChange({...settings, pendingPlan:toPlan, planChangeDate: new Date().toISOString().slice(0,10) }); setConfirmDowngrade(null); }}>
                        Schedule downgrade
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {showCardModal && (
            <UpdateCardModal
              current={cardInfo}
              onSave={info=>{ setCardInfo(info); setShowCardModal(false); }}
              onClose={()=>setShowCardModal(false)}
            />
          )}

          {showBillingHistory && (
            <BillingHistoryModal
              monthlyTotal={monthlyTotal}
              signupDate={settings?.signupDate}
              cycle={cycle}
              onClose={()=>setShowBillingHistory(false)}
            />
          )}
        </div>
      )}

      {/* ââ PERMISSIONS ââ */}
      {tab==="perms" && (
        <div className="fade-in">
          <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:18,lineHeight:1.7,padding:"12px 16px",background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
            <Icon d={ic.alert} size={14} stroke="var(--accent)" style={{ marginRight:6 }} />
            Role defaults set the starting point for every Admin, Manager, and User. Individual team members can still be fine-tuned from the add/edit user screen.
          </div>

          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10 }}>
              <span style={{ fontWeight:700 }}>Operational Controls</span>
              {!canEditPerms && <span style={{ fontSize:11,color:"var(--text3)" }}>View only</span>}
            </div>
            <div className="card-body" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12 }}>
              {[
                { key:"chatAllowDirect", label:"Allow Direct Messages", desc:"Let team members start private 1-on-1 chats." },
                { key:"chatAllowUserMsg", label:"Allow Users to Send Messages", desc:"If off, standard users can read chats but cannot send new messages." },
                { key:"allowUserExports", label:"Allow Users to Export / Print", desc:"Give users access to printing and PDF export actions." },
                { key:"allowUserDeletes", label:"Allow Users to Delete Content", desc:"Allow standard users to remove stored content." },
                { key:"allowUserFileDownloads", label:"Allow User File Downloads", desc:"Control whether standard users can download jobsite files." },
                { key:"allowUserFileUploads", label:"Allow User File Uploads", desc:"Control whether standard users can upload jobsite files." },
                { key:"allowUserProjectCreation", label:"Allow User Jobsite Creation", desc:"Let standard users create and edit jobsites instead of staying view-only." },
                { key:"allowManagerBillingAccess", label:"Allow Manager Billing Access", desc:"Let managers view plan, billing, and payment details." },
                { key:"allowManagerPermissionEditing", label:"Allow Manager Permission Editing", desc:"Let managers edit account-wide permission defaults." },
              ].map(item => {
                const enabled = permissionPolicies[item.key] !== false;
                return (
                  <div key={item.key} style={{ padding:"14px 16px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface2)",display:"flex",justifyContent:"space-between",gap:12 }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13.5,marginBottom:4 }}>{item.label}</div>
                      <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.55 }}>{item.desc}</div>
                    </div>
                    <div
                      onClick={() => canEditPerms && onSettingsChange({
                        ...settings,
                        [item.key]: !enabled,
                        permissionPolicies: { ...permissionPolicies, [item.key]: !enabled },
                      })}
                      style={{ flexShrink:0,width:48,height:28,borderRadius:14,background:enabled?"var(--accent)":"var(--border)",transition:"background .2s",position:"relative",cursor:canEditPerms?"pointer":"not-allowed",opacity:canEditPerms?1:0.65 }}>
                      <div style={{ position:"absolute",top:3,left:enabled?22:3,width:22,height:22,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,.3)",transition:"left .2s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {Object.entries(ROLE_META).map(([role,meta])=>(
            <div key={role} className="card" style={{ marginBottom:14 }}>
              <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
                <div>
                  <span style={{ fontWeight:700,color:meta.color }}>{meta.label}</span>
                  <span style={{ fontSize:12,color:"var(--text2)",display:"block",marginTop:2 }}>{meta.desc}</span>
                </div>
                {canEditPerms && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onSettingsChange({
                    ...settings,
                    rolePermissions: {
                      ...(settings?.rolePermissions || {}),
                      [role]: { ...DEFAULT_ROLE_PERMISSIONS[role] },
                    },
                  })}>
                    Reset Defaults
                  </button>
                )}
              </div>
              <div className="card-body" style={{ padding:0 }}>
                <div className="perm-row" style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",padding:"8px 16px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)" }}>
                  <span>Feature</span><span style={{ textAlign:"center" }}>View</span><span style={{ textAlign:"center" }}>Edit</span><span style={{ textAlign:"center" }}>None</span>
                </div>
                {FEATURE_PERMS.map((f,i)=>{
                  const val = getRolePermissionDefaults(role, settings)?.[f.id] || "none";
                  return (
                    <div key={f.id} className="perm-row" style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",padding:"10px 16px",borderBottom:i<FEATURE_PERMS.length-1?"1px solid var(--border)":"none",alignItems:"center",fontSize:13 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{f.label}</div>
                        <div style={{ fontSize:11,color:"var(--text3)",marginTop:2,lineHeight:1.4 }}>{f.desc}</div>
                      </div>
                      {["view","edit","none"].map(opt=>(
                        <div key={opt} style={{ display:"flex",justifyContent:"center" }}>
                          <div
                            onClick={() => canEditPerms && onSettingsChange({
                              ...settings,
                              rolePermissions: setRolePermissionLevel(settings, role, f.id, opt),
                            })}
                            style={{ width:16,height:16,borderRadius:"50%",border:`2px solid ${val===opt?meta.color:"var(--border)"}`,background:val===opt?meta.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:canEditPerms?"pointer":"default",opacity:canEditPerms?1:0.75 }}>
                            {val===opt && <div style={{ width:6,height:6,borderRadius:"50%",background:"white" }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ââ MODALS ââ */}
      {(addingUser || editingUser) && (
        <UserModal
          user={editingUser||null}
          projects={projects}
          settings={settings}
          currentUserRole={currentUserRole}
          onSave={saveUser}
          onClose={()=>{ setEditingUser(null); setAddingUser(false); }}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">Remove User</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13.5,lineHeight:1.7,color:"var(--text2)" }}>
                Remove <strong style={{ color:"var(--text)" }}>{confirmDel.firstName} {confirmDel.lastName}</strong> from your account?
                Their data will be retained but they will lose access immediately.
                Your monthly bill will decrease by <strong style={{ color:"var(--accent)" }}>${userSeat}/mo</strong>.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:"#e85a3a",borderColor:"#e85a3a" }} onClick={()=>removeUser(confirmDel.id)}>
                <Icon d={ic.trash} size={14} /> Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
