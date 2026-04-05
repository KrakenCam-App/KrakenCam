/**
 * src/components/JobsiteEquipmentTab.jsx
 * Equipment tab shown inside each jobsite detail view.
 * Shows equipment currently scheduled or deployed to this project.
 * Exports: JobsiteEquipmentTab
 */
import React, { useState, useEffect, useCallback } from "react";
import { Icon, ic } from "../utils/icons.jsx";
import {
  getActiveDeployments, returnEquipment, updateDeployment,
  getEquipment, createDeployment, logEquipmentActivity,
  updateEquipment,
} from "../lib/equipment.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META = {
  available:      { label:"Available",      color:"#3dba7e"  },
  scheduled:      { label:"Scheduled",      color:"#3ab8e8"  },
  deployed:       { label:"Deployed",       color:"#8b7cf8"  },
  in_maintenance: { label:"Maintenance",    color:"#e8c53a"  },
  out_of_service: { label:"Out of Service", color:"#e8703a"  },
  retired:        { label:"Retired",        color:"#6b7280"  },
};
const CONDITION_META = {
  excellent:"#3dba7e", good:"#6ee7b7", fair:"#e8c53a", poor:"#e8703a", damaged:"#e85a3a",
};
const LOCATIONS = ["shop","warehouse","vehicle","jobsite","maintenance_vendor","unknown"];

function StatusChip({ status, locked }) {
  if (locked) return <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#e85a3a18",color:"#e85a3a",border:"1px solid #e85a3a40" }}>🔒 LOCKED</span>;
  const m = STATUS_META[status] || STATUS_META.available;
  return <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${m.color}18`,color:m.color,border:`1px solid ${m.color}40` }}>{m.label}</span>;
}

function DeployStatusChip({ status }) {
  const colors = { scheduled:"#3ab8e8", deployed:"#8b7cf8", returned:"#3dba7e", cancelled:"#6b7280" };
  const c = colors[status]||"#888";
  return <span style={{ fontSize:10.5,fontWeight:700,padding:"2px 7px",borderRadius:8,background:`${c}18`,color:c,border:`1px solid ${c}30` }}>{status}</span>;
}

// ── Return Modal ──────────────────────────────────────────────────────────────

function ReturnModal({ deployment, userId, onSave, onClose }) {
  const eq = deployment.equipment;
  const [form, setForm] = useState({ returnLocation:"shop", condition:eq?.condition||"good", notes:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const result = await returnEquipment(deployment.id, form, eq.id, userId);
      onSave(result);
    } catch(e) {
      alert("Error returning equipment: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:400 }}>
        <div className="modal-header">
          <div className="modal-title">Return Equipment</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom:14,fontSize:13.5,color:"var(--text2)" }}>
            Returning <strong>{eq?.name}</strong> ({eq?.unique_code}) to shop.
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Return To</label>
              <select className="form-input form-select" value={form.returnLocation} onChange={e=>set("returnLocation",e.target.value)}>
                {LOCATIONS.map(l=><option key={l} value={l}>{l.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Condition After Return</label>
              <select className="form-input form-select" value={form.condition||""} onChange={e=>set("condition",e.target.value||null)}>
                <option value="">— Not set —</option>
                {Object.keys(CONDITION_META).map(k=><option key={k} value={k}>{k.charAt(0).toUpperCase()+k.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {form.condition==="damaged" && (
            <div style={{ background:"#e8c53a15",border:"1px solid #e8c53a40",borderRadius:8,padding:"8px 12px",fontSize:12.5,color:"#e8c53a",marginBottom:8 }}>
              ⚠️ Damaged equipment will be set to <strong>In Maintenance</strong>.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Return notes…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Icon d={ic.check} size={14}/> {saving?"Returning…":"Confirm Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick-deploy from jobsite ─────────────────────────────────────────────────

function QuickDeployModal({ project, orgId, userId, onSave, onClose }) {
  const [allEquip, setAllEquip]  = useState([]);
  const [loading,  setLoading]   = useState(true);
  const [selected, setSelected]  = useState(null);
  const [form,     setForm]      = useState({ status:"deployed", startAt:new Date().toISOString().slice(0,16), expectedReturnAt:"", notes:"" });
  const [saving,   setSaving]    = useState(false);
  const [error,    setError]     = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    getEquipment()
      .then(eq => setAllEquip(eq.filter(e=>e.status==="available"&&!e.isLockedOut)))
      .catch(console.warn)
      .finally(()=>setLoading(false));
  },[]);

  const save = async () => {
    if (!selected) { setError("Select a piece of equipment."); return; }
    setSaving(true); setError(null);
    try {
      const dep = await createDeployment({
        organizationId: orgId,
        equipmentId:    selected.id,
        projectId:      project.id,
        status:         form.status,
        startAt:        new Date(form.startAt).toISOString(),
        expectedReturnAt: form.expectedReturnAt ? new Date(form.expectedReturnAt).toISOString() : null,
        notes:          form.notes || null,
      }, userId);
      const newStatus = form.status === "deployed" ? "deployed" : "scheduled";
      await updateEquipment(selected.id, { ...selected, status: newStatus }, userId);
      await logEquipmentActivity(selected.id, orgId, userId, "deployed", `Deployed to ${project.title}`);
      onSave(dep);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <div className="modal-title">Add Equipment to Jobsite</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"8px 12px",color:"#e85a3a",fontSize:13,marginBottom:12 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Select Available Equipment</label>
            {loading ? <div style={{ color:"var(--text3)",fontSize:13 }}>Loading…</div> : (
              <div style={{ maxHeight:200,overflowY:"auto",border:"1px solid var(--border)",borderRadius:8 }}>
                {allEquip.length===0 && <div style={{ padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:13 }}>No available equipment.</div>}
                {allEquip.map(e=>(
                  <div key={e.id} onClick={()=>setSelected(selected?.id===e.id?null:e)}
                    style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:selected?.id===e.id?"var(--accent)15":"transparent",borderBottom:"1px solid var(--border)",transition:"background .1s" }}>
                    {e.photoUrl
                      ? <img src={e.photoUrl} alt="" style={{ width:32,height:32,objectFit:"cover",borderRadius:5,flexShrink:0 }} />
                      : <div style={{ width:32,height:32,borderRadius:5,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.briefcase} size={15} stroke="var(--text3)"/></div>
                    }
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:600,fontSize:13 }}>{e.name}</div>
                      <div style={{ fontSize:11.5,color:"var(--text3)" }}>{e.uniqueCode}{e.typeName?` · ${e.typeName}`:""}</div>
                    </div>
                    {selected?.id===e.id && <Icon d={ic.check} size={16} stroke="var(--accent)" strokeWidth={2.5}/>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Deployment Type</label>
              <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                <option value="deployed">Deploy Now</option>
                <option value="scheduled">Schedule (Future)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start</label>
              <input className="form-input" type="datetime-local" value={form.startAt} onChange={e=>set("startAt",e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Return</label>
              <input className="form-input" type="datetime-local" value={form.expectedReturnAt} onChange={e=>set("expectedReturnAt",e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:50 }} value={form.notes} onChange={e=>set("notes",e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!selected}>
            <Icon d={ic.mapPin} size={14}/> {saving?"Deploying…":"Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function JobsiteEquipmentTab({ project, orgId, userId }) {
  const [deployments,  setDeployments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [returnDep,    setReturnDep]    = useState(null);
  const [showDeploy,   setShowDeploy]   = useState(false);
  const [expandedNote, setExpandedNote] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const deps = await getActiveDeployments(project.id);
      setDeployments(deps);
    } catch(e) {
      console.warn("[JobsiteEquipmentTab] Load error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  const handleReturned = ({ deployment, equipment: eq }) => {
    setDeployments(prev => prev.filter(d => d.id !== returnDep.id));
    setReturnDep(null);
  };

  const handleDeployed = (dep) => {
    load(); // refresh after new deployment
    setShowDeploy(false);
  };

  const scheduled   = deployments.filter(d=>d.status==="scheduled");
  const deployed    = deployments.filter(d=>d.status==="deployed");

  const renderCard = (dep) => {
    const eq = dep.equipment || {};
    const typeName  = eq.equipment_types?.name  || null;
    const catName   = eq.equipment_categories?.name || null;
    const isLocked  = eq.is_locked_out;
    const expectedReturn = dep.expected_return_at ? new Date(dep.expected_return_at) : null;
    const isOverdue = expectedReturn && expectedReturn < new Date() && dep.status==="deployed";

    return (
      <div key={dep.id} style={{ background:"var(--surface)",border:`1px solid ${isOverdue?"#e8c53a40":isLocked?"#e85a3a40":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 14px",marginBottom:8 }}>
        <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
          {eq.photo_url
            ? <img src={eq.photo_url} alt="" style={{ width:42,height:42,objectFit:"cover",borderRadius:6,flexShrink:0 }} />
            : <div style={{ width:42,height:42,borderRadius:6,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.briefcase} size={18} stroke="var(--text3)"/></div>
          }
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3 }}>
              <span style={{ fontWeight:700,fontSize:13.5 }}>{eq.name||"Equipment"}</span>
              {isLocked && <span style={{ fontSize:12 }}>🔒</span>}
              <span style={{ fontSize:12,color:"var(--text3)",fontFamily:"monospace" }}>{eq.unique_code}</span>
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:5 }}>
              <StatusChip status={eq.status} locked={isLocked} />
              <DeployStatusChip status={dep.status} />
              {eq.condition && (
                <span style={{ fontSize:11,padding:"2px 7px",borderRadius:8,background:`${CONDITION_META[eq.condition]||"#888"}15`,color:CONDITION_META[eq.condition]||"#888",fontWeight:600 }}>
                  {eq.condition.charAt(0).toUpperCase()+eq.condition.slice(1)}
                </span>
              )}
              {isOverdue && <span style={{ fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"#e8c53a18",color:"#e8c53a" }}>Return Overdue</span>}
            </div>
            <div style={{ fontSize:12,color:"var(--text3)" }}>
              {typeName && <span>{typeName}</span>}
              {catName  && <span>{typeName?" · ":""}{catName}</span>}
            </div>
            <div style={{ fontSize:12,color:"var(--text3)",marginTop:3 }}>
              Start: {new Date(dep.start_at).toLocaleDateString()}
              {dep.expected_return_at && ` · Expected: ${new Date(dep.expected_return_at).toLocaleDateString()}`}
            </div>
            {dep.notes && (
              <div style={{ fontSize:12,color:"var(--text2)",marginTop:4,lineHeight:1.5 }}>
                {dep.notes}
              </div>
            )}
          </div>
          <div style={{ flexShrink:0 }}>
            {dep.status==="deployed" && (
              <button className="btn btn-sm btn-secondary" onClick={()=>setReturnDep(dep)} style={{ whiteSpace:"nowrap" }}>
                <Icon d={ic.rotateCw} size={12}/> Return
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:700,fontSize:15 }}>Equipment on Site</div>
          <div style={{ fontSize:12.5,color:"var(--text3)",marginTop:2 }}>
            {deployed.length} deployed · {scheduled.length} scheduled
          </div>
        </div>
        <button className="btn btn-sm btn-primary" onClick={()=>setShowDeploy(true)}>
          <Icon d={ic.plus} size={13}/> Add Equipment
        </button>
      </div>

      {loading && <div style={{ textAlign:"center",padding:40,color:"var(--text3)",fontSize:13 }}>Loading…</div>}

      {!loading && deployments.length === 0 && (
        <div style={{ textAlign:"center",padding:"40px 20px",color:"var(--text3)" }}>
          <Icon d={ic.briefcase} size={36} stroke="var(--border)"/>
          <div style={{ marginTop:10,fontSize:14,fontWeight:600 }}>No equipment on this jobsite</div>
          <div style={{ fontSize:12.5,marginTop:4 }}>Deploy equipment from the Equipment tab or click Add Equipment above.</div>
        </div>
      )}

      {!loading && deployed.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Deployed</div>
          {deployed.map(renderCard)}
        </div>
      )}

      {!loading && scheduled.length > 0 && (
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Scheduled</div>
          {scheduled.map(renderCard)}
        </div>
      )}

      {/* Modals */}
      {returnDep && (
        <ReturnModal deployment={returnDep} userId={userId} onSave={handleReturned} onClose={()=>setReturnDep(null)} />
      )}
      {showDeploy && (
        <QuickDeployModal project={project} orgId={orgId} userId={userId} onSave={handleDeployed} onClose={()=>setShowDeploy(false)} />
      )}
    </div>
  );
}
