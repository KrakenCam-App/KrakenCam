/**
 * src/components/EquipmentPage.jsx
 * Main Equipment management page — lazy loaded.
 * Exports: EquipmentPage
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Icon, ic } from "../utils/icons.jsx";
import { QrCodeDisplay } from "./QrCodeDisplay.jsx";
import { BulkQrPrint } from "./BulkQrPrint.jsx";
import { getMovementHistory, ACTION_LABELS, ACTION_ICONS } from "../lib/equipmentMovement.js";
import {
  getEquipment, createEquipment, updateEquipment, archiveEquipment,
  lockoutEquipment, clearLockout,
  getEquipmentTypes, createEquipmentType, updateEquipmentType, archiveEquipmentType,
  getEquipmentCategories, createEquipmentCategory, updateEquipmentCategory, archiveEquipmentCategory,
  getMaintenanceRecords, createMaintenanceRecord, deleteMaintenanceRecord,
  getDeployments, createDeployment, returnEquipment, updateDeployment,
  getEquipmentActivity, logEquipmentActivity,
  bulkArchiveEquipment, bulkUpdateStatus,
} from "../lib/equipment.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  available:      { label:"Available",      color:"#3dba7e",  bg:"#3dba7e18" },
  scheduled:      { label:"Scheduled",      color:"#3ab8e8",  bg:"#3ab8e818" },
  deployed:       { label:"Deployed",       color:"#8b7cf8",  bg:"#8b7cf818" },
  in_maintenance: { label:"Maintenance",    color:"#e8c53a",  bg:"#e8c53a18" },
  out_of_service: { label:"Out of Service", color:"#e8703a",  bg:"#e8703a18" },
  retired:        { label:"Retired",        color:"#6b7280",  bg:"#6b728018" },
};
const CONDITION_META = {
  excellent: { label:"Excellent", color:"#3dba7e" },
  good:      { label:"Good",      color:"#6ee7b7" },
  fair:      { label:"Fair",      color:"#e8c53a" },
  poor:      { label:"Poor",      color:"#e8703a" },
  damaged:   { label:"Damaged",   color:"#e85a3a" },
};
const LOCATIONS = ["shop","warehouse","vehicle","jobsite","maintenance_vendor","unknown"];
const MAINT_TYPES = ["general_maintenance","cleaning","oil_change","filter_change","inspection","calibration","repair","warranty_service","custom"];
const MAINT_TYPE_LABELS = {
  general_maintenance:"General Maintenance", cleaning:"Cleaning", oil_change:"Oil Change",
  filter_change:"Filter Change", inspection:"Inspection", calibration:"Calibration",
  repair:"Repair", warranty_service:"Warranty Service", custom:"Custom",
};

const EMPTY_EQ = {
  name:"", uniqueCode:"", typeId:null, categoryId:null, photoUrl:null,
  serialNumber:"", manufacturer:"", model:"",
  purchaseDate:null, manufactureDate:null, warrantyStartDate:null,
  warrantyTermMonths:null, warrantyExpiry:null,
  status:"available", condition:"good", currentLocation:"shop", notes:"",
  isLockedOut:false, lockoutReason:null, lockoutNotes:null,
};

const uid = () => Math.random().toString(36).slice(2,10);

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function StatusChip({ status, locked }) {
  if (locked) return (
    <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#e85a3a18",color:"#e85a3a",border:"1px solid #e85a3a40",display:"inline-flex",alignItems:"center",gap:4 }}>
      🔒 LOCKED OUT
    </span>
  );
  const m = STATUS_META[status] || STATUS_META.available;
  return <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:m.bg,color:m.color,border:`1px solid ${m.color}40` }}>{m.label}</span>;
}

function ConditionChip({ condition }) {
  if (!condition) return null;
  const m = CONDITION_META[condition] || CONDITION_META.good;
  return <span style={{ fontSize:11,padding:"2px 7px",borderRadius:10,background:`${m.color}15`,color:m.color,border:`1px solid ${m.color}30`,fontWeight:600 }}>{m.label}</span>;
}

function Avatar({ name, color="#2563eb", size=26 }) {
  const initials = (name||"?").split(" ").map(w=>w[0]||"").slice(0,2).join("").toUpperCase();
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"white",flexShrink:0 }}>
      {initials}
    </div>
  );
}

function SummaryCard({ label, value, color="#e8e8e8", onClick, active }) {
  return (
    <div onClick={onClick} style={{ background:active?"var(--surface2)":"var(--surface)",border:`1px solid ${active?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",flex:1,minWidth:110,cursor:onClick?"pointer":"default",transition:"all .15s" }}>
      <div style={{ fontSize:22,fontWeight:800,color }}>{value}</div>
      <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:2 }}>{label}</div>
    </div>
  );
}

// ── Equipment Form Modal ──────────────────────────────────────────────────────

function EquipmentFormModal({ equipment, types, categories, orgId, userId, onSave, onClose }) {
  const isNew = !equipment?.id;
  const [form, setForm] = useState(isNew
    ? { ...EMPTY_EQ, organizationId: orgId }
    : { ...equipment, organizationId: equipment.organizationId || orgId }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.uniqueCode.trim()) { setError("Name and Equipment Code are required."); return; }
    setSaving(true); setError(null);
    try {
      const saved = isNew
        ? await createEquipment(form, userId)
        : await updateEquipment(equipment.id, form, userId);
      if (!isNew) {
        await logEquipmentActivity(equipment.id, orgId, userId, isNew ? 'created' : 'updated', isNew ? 'Equipment created' : 'Equipment updated');
      }
      onSave(saved);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activeTypes = types.filter(t => !t.is_archived || t.id === form.typeId);
  const activeCats  = categories.filter(c => !c.is_archived || c.id === form.categoryId);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ maxWidth:580,maxHeight:"90vh",overflowY:"auto" }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Add Equipment" : "Edit Equipment"}</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"8px 12px",color:"#e85a3a",fontSize:13,marginBottom:12 }}>{error}</div>}

          {/* Photo URL */}
          <div className="form-group">
            <label className="form-label">Photo URL <span style={{ color:"var(--text3)",fontWeight:400,fontSize:11 }}>(optional)</span></label>
            <input className="form-input" value={form.photoUrl||""} onChange={e=>set("photoUrl",e.target.value||null)} placeholder="https://…" />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">Equipment Name *</label>
              <input className="form-input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Dehumidifier #1" autoFocus />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Equipment Code *</label>
              <input className="form-input" value={form.uniqueCode} onChange={e=>set("uniqueCode",e.target.value)} placeholder="e.g. DH-001" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input form-select" value={form.typeId||""} onChange={e=>set("typeId",e.target.value||null)}>
                <option value="">— None —</option>
                {activeTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input form-select" value={form.categoryId||""} onChange={e=>set("categoryId",e.target.value||null)}>
                <option value="">— None —</option>
                {activeCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select className="form-input form-select" value={form.condition||""} onChange={e=>set("condition",e.target.value||null)}>
                <option value="">— Not set —</option>
                {Object.entries(CONDITION_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Current Location</label>
              <select className="form-input form-select" value={form.currentLocation||"shop"} onChange={e=>set("currentLocation",e.target.value)}>
                {LOCATIONS.map(l=><option key={l} value={l}>{l.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input className="form-input" value={form.serialNumber||""} onChange={e=>set("serialNumber",e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Manufacturer</label>
              <input className="form-input" value={form.manufacturer||""} onChange={e=>set("manufacturer",e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input className="form-input" value={form.model||""} onChange={e=>set("model",e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input className="form-input" type="date" value={form.purchaseDate||""} onChange={e=>set("purchaseDate",e.target.value||null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Manufacture Date</label>
              <input className="form-input" type="date" value={form.manufactureDate||""} onChange={e=>set("manufactureDate",e.target.value||null)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Warranty Start</label>
              <input className="form-input" type="date" value={form.warrantyStartDate||""} onChange={e=>set("warrantyStartDate",e.target.value||null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty Term (months)</label>
              <input className="form-input" type="number" min="0" value={form.warrantyTermMonths||""} onChange={e=>set("warrantyTermMonths",e.target.value?parseInt(e.target.value):null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty Expiry</label>
              <input className="form-input" type="date" value={form.warrantyExpiry||""} onChange={e=>set("warrantyExpiry",e.target.value||null)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:70 }} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="General notes about this equipment…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.uniqueCode.trim()}>
            <Icon d={ic.check} size={14}/> {saving ? "Saving…" : isNew ? "Add Equipment" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance Modal ─────────────────────────────────────────────────────────

function MaintenanceModal({ equipmentId, orgId, userId, onSave, onClose }) {
  const [form, setForm] = useState({
    equipment_id:         equipmentId,
    organization_id:      orgId,
    maintenance_type:     "inspection",
    title:                "",
    performed_at:         new Date().toISOString().slice(0,16),
    performed_by_user_id: userId || null,
    vendor_name:          "",
    notes:                "",
    cost:                 "",
    next_due_at:          "",
    status:               "completed",
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const row = {
        ...form,
        cost:        form.cost ? parseFloat(form.cost) : null,
        next_due_at: form.next_due_at ? new Date(form.next_due_at).toISOString() : null,
        performed_at:new Date(form.performed_at).toISOString(),
        title:       form.title || null,
        vendor_name: form.vendor_name || null,
        notes:       form.notes || null,
      };
      const saved = await createMaintenanceRecord(row);
      onSave(saved);
    } catch(e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <div className="modal-title">Add Maintenance Record</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input form-select" value={form.maintenance_type} onChange={e=>set("maintenance_type",e.target.value)}>
                {MAINT_TYPES.map(t=><option key={t} value={t}>{MAINT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Title <span style={{ color:"var(--text3)",fontSize:11,fontWeight:400 }}>(optional)</span></label>
            <input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. 6-month service" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Performed At</label>
              <input className="form-input" type="datetime-local" value={form.performed_at} onChange={e=>set("performed_at",e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Next Due</label>
              <input className="form-input" type="date" value={form.next_due_at} onChange={e=>set("next_due_at",e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendor / Provider</label>
              <input className="form-input" value={form.vendor_name} onChange={e=>set("vendor_name",e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cost ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.cost} onChange={e=>set("cost",e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={form.notes} onChange={e=>set("notes",e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Icon d={ic.check} size={14}/> {saving?"Saving…":"Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Deploy Modal ──────────────────────────────────────────────────────────────

function DeployModal({ equipment, projects, orgId, userId, onSave, onClose }) {
  const [form, setForm] = useState({
    projectId:        "",
    status:           "deployed",
    startAt:          new Date().toISOString().slice(0,16),
    expectedReturnAt: "",
    notes:            "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.projectId) { setError("Please select a jobsite."); return; }
    setSaving(true); setError(null);
    try {
      const dep = await createDeployment({
        organizationId:    orgId,
        equipmentId:       equipment.id,
        projectId:         form.projectId,
        status:            form.status,
        startAt:           new Date(form.startAt).toISOString(),
        expectedReturnAt:  form.expectedReturnAt ? new Date(form.expectedReturnAt).toISOString() : null,
        notes:             form.notes || null,
      }, userId);
      // Update equipment status
      const newStatus = form.status === 'deployed' ? 'deployed' : 'scheduled';
      await updateEquipment(equipment.id, { ...equipment, status: newStatus }, userId);
      await logEquipmentActivity(equipment.id, orgId, userId, 'deployed', `Deployed to jobsite`);
      onSave(dep);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const blocked = equipment.isLockedOut || ['retired','out_of_service','in_maintenance'].includes(equipment.status);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:460 }}>
        <div className="modal-header">
          <div className="modal-title">Deploy Equipment</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          {blocked && (
            <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"10px 14px",color:"#e85a3a",fontSize:13,marginBottom:14 }}>
              ⚠️ This equipment {equipment.isLockedOut ? "is locked out" : `has status "${equipment.status}"`} and cannot be deployed.
            </div>
          )}
          {error && <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"8px 12px",color:"#e85a3a",fontSize:13,marginBottom:12 }}>{error}</div>}
          <div style={{ background:"var(--surface2)",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12 }}>
            {equipment.photoUrl
              ? <img src={equipment.photoUrl} alt="" style={{ width:42,height:42,objectFit:"cover",borderRadius:6 }} />
              : <div style={{ width:42,height:42,borderRadius:6,background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.briefcase} size={20} stroke="var(--text3)"/></div>
            }
            <div>
              <div style={{ fontWeight:700,fontSize:14 }}>{equipment.name}</div>
              <div style={{ fontSize:12,color:"var(--text3)" }}>{equipment.uniqueCode} · {equipment.typeName || "—"}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Jobsite *</label>
            <select className="form-input form-select" value={form.projectId} onChange={e=>set("projectId",e.target.value)} disabled={blocked}>
              <option value="">— Select jobsite —</option>
              {(projects||[]).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Deployment Type</label>
              <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)} disabled={blocked}>
                <option value="deployed">Deploy Now</option>
                <option value="scheduled">Schedule (Future)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date/Time</label>
              <input className="form-input" type="datetime-local" value={form.startAt} onChange={e=>set("startAt",e.target.value)} disabled={blocked} />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Return</label>
              <input className="form-input" type="datetime-local" value={form.expectedReturnAt} onChange={e=>set("expectedReturnAt",e.target.value)} disabled={blocked} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={form.notes} onChange={e=>set("notes",e.target.value)} disabled={blocked} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||blocked||!form.projectId}>
            <Icon d={ic.mapPin} size={14}/> {saving?"Deploying…":"Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Modal ──────────────────────────────────────────────────────────────

function ReturnModal({ deployment, equipment, userId, onSave, onClose }) {
  const [form, setForm] = useState({ returnLocation:"shop", condition:equipment?.condition||"good", notes:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const result = await returnEquipment(deployment.id, form, equipment.id, userId);
      onSave(result);
    } catch(e) {
      alert("Error: " + e.message);
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
          <div style={{ marginBottom:16,fontSize:13.5,color:"var(--text2)" }}>
            Returning <strong>{equipment?.name}</strong> ({equipment?.uniqueCode}) from jobsite.
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
                {Object.entries(CONDITION_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {form.condition==="damaged" && (
            <div style={{ background:"#e8c53a15",border:"1px solid #e8c53a40",borderRadius:8,padding:"8px 12px",fontSize:12.5,color:"#e8c53a",marginBottom:8 }}>
              ⚠️ Damaged equipment will be set to <strong>In Maintenance</strong> automatically.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Return Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any notes about the return…" />
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

// ── Lockout Modal ─────────────────────────────────────────────────────────────

function LockoutModal({ equipment, userId, onSave, onClose, clearing }) {
  const [form, setForm] = useState({ reason:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const updated = clearing
        ? await clearLockout(equipment.id, userId)
        : await lockoutEquipment(equipment.id, form, userId);
      onSave(updated);
    } catch(e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color:clearing?"#3dba7e":"#e85a3a" }}>
            {clearing ? "🔓 Clear Lockout" : "🔒 Lock Out Equipment"}
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize:13.5,color:"var(--text2)",marginBottom:14 }}>
            {clearing
              ? <>Clear the lockout on <strong>{equipment.name}</strong>? Status will be reset to <strong>Available</strong>.</>
              : <>Lock out <strong>{equipment.name}</strong>? It will be marked <strong>Out of Service</strong> and cannot be deployed.</>
            }
          </div>
          {!clearing && (
            <>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <input className="form-input" value={form.reason} onChange={e=>set("reason",e.target.value)} placeholder="e.g. Electrical fault, failed safety check" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={form.notes} onChange={e=>set("notes",e.target.value)} />
              </div>
            </>
          )}
          {clearing && equipment.lockoutReason && (
            <div style={{ background:"#e85a3a10",borderRadius:8,padding:"8px 12px",fontSize:12.5,color:"var(--text2)" }}>
              <strong>Current lockout reason:</strong> {equipment.lockoutReason}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||(!clearing&&!form.reason.trim())}
            style={{ background:clearing?"#3dba7e":"#e85a3a",borderColor:clearing?"#3dba7e":"#e85a3a" }}>
            {saving?"Saving…":clearing?"Clear Lockout":"Lock Out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Type/Category Manager Panel ───────────────────────────────────────────────

function TaxonomyManager({ types, categories, orgId, onTypesChange, onCategoriesChange, onClose }) {
  const [tab,      setTab]      = useState("types");
  const [newName,  setNewName]  = useState("");
  const [editId,   setEditId]   = useState(null);
  const [editName, setEditName] = useState("");
  const [saving,   setSaving]   = useState(false);

  const addType = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try { const t = await createEquipmentType(orgId, newName.trim()); onTypesChange([...types, t]); setNewName(""); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const saveTypeEdit = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    try { const t = await updateEquipmentType(id, editName.trim()); onTypesChange(types.map(x=>x.id===id?t:x)); setEditId(null); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const toggleTypeArchive = async (t) => {
    const updated = await archiveEquipmentType(t.id, !t.is_archived);
    onTypesChange(types.map(x=>x.id===t.id?updated:x));
  };

  const addCat = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try { const c = await createEquipmentCategory(orgId, newName.trim()); onCategoriesChange([...categories, c]); setNewName(""); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const saveCatEdit = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    try { const c = await updateEquipmentCategory(id, editName.trim()); onCategoriesChange(categories.map(x=>x.id===id?c:x)); setEditId(null); }
    catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const toggleCatArchive = async (c) => {
    const updated = await archiveEquipmentCategory(c.id, !c.is_archived);
    onCategoriesChange(categories.map(x=>x.id===c.id?updated:x));
  };

  const isTypes = tab === "types";
  const items   = isTypes ? types : categories;
  const add     = isTypes ? addType : addCat;
  const saveEdit= isTypes ? saveTypeEdit : saveCatEdit;
  const toggle  = isTypes ? toggleTypeArchive : toggleCatArchive;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:440 }}>
        <div className="modal-header">
          <div className="modal-title">Manage Types & Categories</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ display:"flex",gap:8,marginBottom:16 }}>
            {["types","categories"].map(t=>(
              <button key={t} className="btn btn-sm" onClick={()=>{setTab(t);setNewName("");setEditId(null);}}
                style={{ flex:1,background:tab===t?"var(--accent)":"var(--surface2)",color:tab===t?"white":"var(--text2)",border:`1.5px solid ${tab===t?"var(--accent)":"var(--border)"}` }}>
                {t==="types"?"Equipment Types":"Categories"}
              </button>
            ))}
          </div>

          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            <input className="form-input" style={{ flex:1 }} placeholder={`New ${isTypes?"type":"category"} name…`} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} />
            <button className="btn btn-primary btn-sm" onClick={add} disabled={saving||!newName.trim()}><Icon d={ic.plus} size={14}/> Add</button>
          </div>

          <div style={{ maxHeight:340,overflowY:"auto" }}>
            {items.length===0 && <div style={{ textAlign:"center",color:"var(--text3)",fontSize:13,padding:"20px 0" }}>No {isTypes?"types":"categories"} yet.</div>}
            {items.map(item=>(
              <div key={item.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 4px",borderBottom:"1px solid var(--border)",opacity:item.is_archived?.7:1 }}>
                {editId===item.id
                  ? <>
                      <input className="form-input" style={{ flex:1 }} autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit(item.id)} />
                      <button className="btn btn-sm btn-primary" onClick={()=>saveEdit(item.id)} disabled={saving}><Icon d={ic.check} size={13}/></button>
                      <button className="btn btn-sm btn-ghost" onClick={()=>setEditId(null)}><Icon d={ic.close} size={13}/></button>
                    </>
                  : <>
                      <span style={{ flex:1,fontSize:13.5,color:item.is_archived?"var(--text3)":"var(--text)" }}>{item.name}{item.is_archived&&" (archived)"}</span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditId(item.id);setEditName(item.name);}}><Icon d={ic.edit} size={13}/></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title={item.is_archived?"Restore":"Archive"} onClick={()=>toggle(item)}>
                        <Icon d={item.is_archived?ic.rotateCw:ic.minus} size={13}/>
                      </button>
                    </>
                }
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Equipment Detail Drawer ───────────────────────────────────────────────────

function EquipmentDetail({ equipment, types, categories, projects, orgId, userId, onUpdated, onClose }) {
  const [detailTab, setDetailTab]   = useState("overview");
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [deployments, setDeployments]               = useState([]);
  const [activityLog, setActivityLog]               = useState([]);
  const [movementHistory, setMovementHistory]       = useState([]);
  const [showMaintModal, setShowMaintModal]          = useState(false);
  const [showDeployModal, setShowDeployModal]        = useState(false);
  const [returnDep, setReturnDep]                   = useState(null);
  const [showLockout, setShowLockout]               = useState(false);
  const [clearingLockout, setClearingLockout]       = useState(false);
  const [loading, setLoading]                       = useState(false);

  useEffect(() => {
    if (!equipment?.id) return;
    setLoading(true);
    Promise.all([
      getMaintenanceRecords(equipment.id),
      getDeployments(equipment.id, null),
      getEquipmentActivity(equipment.id),
      getMovementHistory(equipment.id),
    ]).then(([m,d,a,mv]) => { setMaintenanceRecords(m); setDeployments(d); setActivityLog(a); setMovementHistory(mv); })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [equipment?.id]);

  const typeName = types.find(t=>t.id===equipment.typeId)?.name || equipment.typeName || "—";
  const catName  = categories.find(c=>c.id===equipment.categoryId)?.name || equipment.categoryName || "—";

  const nextMaint = maintenanceRecords
    .filter(r=>r.next_due_at)
    .sort((a,b)=>new Date(a.next_due_at)-new Date(b.next_due_at))[0];

  const isOverdueMaint = nextMaint && new Date(nextMaint.next_due_at) < new Date();
  const activeDeployment = deployments.find(d=>d.status==="deployed"||d.status==="scheduled");

  const DETAIL_TABS = ["overview","qr label","history","maintenance","deployments","activity"];

  return (
    <div style={{ position:"fixed",top:0,right:0,bottom:0,width:Math.min(560,window.innerWidth),background:"var(--surface)",borderLeft:"1px solid var(--border)",zIndex:200,display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,.3)" }}>
      {/* Header */}
      <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
        {equipment.photoUrl
          ? <img src={equipment.photoUrl} alt="" style={{ width:48,height:48,objectFit:"cover",borderRadius:8,flexShrink:0 }} />
          : <div style={{ width:48,height:48,borderRadius:8,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.briefcase} size={22} stroke="var(--text3)"/></div>
        }
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:800,fontSize:16,lineHeight:1.2,display:"flex",alignItems:"center",gap:8 }}>
            {equipment.name}
            {equipment.isLockedOut && <span style={{ fontSize:12 }}>🔒</span>}
          </div>
          <div style={{ fontSize:12,color:"var(--text3)",marginTop:2 }}>{equipment.uniqueCode} · {typeName}</div>
          <div style={{ display:"flex",gap:6,marginTop:6,flexWrap:"wrap" }}>
            <StatusChip status={equipment.status} locked={equipment.isLockedOut} />
            <ConditionChip condition={equipment.condition} />
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon d={ic.close} size={18}/></button>
      </div>

      {/* Action bar */}
      <div style={{ padding:"10px 20px",borderBottom:"1px solid var(--border)",display:"flex",gap:8,flexShrink:0,overflowX:"auto" }}>
        {!equipment.isLockedOut && !['retired','out_of_service','in_maintenance','deployed','scheduled'].includes(equipment.status) && (
          <button className="btn btn-sm btn-primary" onClick={()=>setShowDeployModal(true)} style={{ whiteSpace:"nowrap" }}>
            <Icon d={ic.mapPin} size={13}/> Deploy
          </button>
        )}
        {activeDeployment && ['deployed','scheduled'].includes(activeDeployment.status) && (
          <button className="btn btn-sm btn-secondary" onClick={()=>setReturnDep(activeDeployment)} style={{ whiteSpace:"nowrap" }}>
            <Icon d={ic.rotateCw} size={13}/> Return
          </button>
        )}
        <button className="btn btn-sm btn-secondary" onClick={()=>setShowMaintModal(true)} style={{ whiteSpace:"nowrap" }}>
          <Icon d={ic.settings} size={13}/> + Maintenance
        </button>
        {equipment.isLockedOut
          ? <button className="btn btn-sm" onClick={()=>{setClearingLockout(true);setShowLockout(true);}} style={{ background:"#3dba7e",color:"white",whiteSpace:"nowrap" }}>🔓 Clear Lockout</button>
          : <button className="btn btn-sm" onClick={()=>{setClearingLockout(false);setShowLockout(true);}} style={{ background:"#e85a3a18",color:"#e85a3a",border:"1px solid #e85a3a40",whiteSpace:"nowrap" }}>🔒 Lock Out</button>
        }
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:2,padding:"8px 20px 0",borderBottom:"1px solid var(--border)",flexShrink:0,overflowX:"auto" }}>
        {DETAIL_TABS.map(t=>(
          <button key={t} onClick={()=>setDetailTab(t)} className="btn btn-ghost btn-sm"
            style={{ borderBottom:detailTab===t?"2px solid var(--accent)":"2px solid transparent",borderRadius:0,fontWeight:detailTab===t?700:400,color:detailTab===t?"var(--accent)":"var(--text3)",textTransform:"capitalize",whiteSpace:"nowrap" }}>
            {t} {t==="maintenance"&&maintenanceRecords.length>0&&`(${maintenanceRecords.length})`}
            {t==="deployments"&&deployments.length>0&&`(${deployments.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1,overflowY:"auto",padding:"16px 20px" }}>
        {loading && <div style={{ textAlign:"center",padding:40,color:"var(--text3)" }}>Loading…</div>}

        {!loading && detailTab==="overview" && (
          <div>
            {isOverdueMaint && (
              <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#e85a3a",display:"flex",alignItems:"center",gap:8 }}>
                <Icon d={ic.alert} size={15} stroke="#e85a3a"/> Maintenance overdue since {new Date(nextMaint.next_due_at).toLocaleDateString()}
              </div>
            )}
            {equipment.isLockedOut && (
              <div style={{ background:"#e85a3a15",border:"1px solid #e85a3a40",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#e85a3a" }}>
                <strong>🔒 LOCKED OUT</strong>{equipment.lockoutReason && ` — ${equipment.lockoutReason}`}
                {equipment.lockoutNotes && <div style={{ marginTop:4,color:"var(--text3)" }}>{equipment.lockoutNotes}</div>}
              </div>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
              {[
                ["Type", typeName],
                ["Category", catName],
                ["Location", (equipment.currentLocation||"—").replace(/_/g," ")],
                ["Serial #", equipment.serialNumber||"—"],
                ["Manufacturer", equipment.manufacturer||"—"],
                ["Model", equipment.model||"—"],
                ["Purchase Date", equipment.purchaseDate ? new Date(equipment.purchaseDate+"T12:00:00").toLocaleDateString() : "—"],
                ["Warranty Expiry", equipment.warrantyExpiry ? new Date(equipment.warrantyExpiry+"T12:00:00").toLocaleDateString() : "—"],
                ["Next Maintenance", nextMaint ? new Date(nextMaint.next_due_at).toLocaleDateString() : "—"],
                ["Active Deployment", activeDeployment ? (activeDeployment.projects?.title||"Jobsite") : "None"],
              ].map(([label,value])=>(
                <div key={label} style={{ background:"var(--surface2)",borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:11,color:"var(--text3)",marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13,fontWeight:600 }}>{value}</div>
                </div>
              ))}
            </div>
            {equipment.notes && (
              <div style={{ background:"var(--surface2)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                <div style={{ fontSize:11,color:"var(--text3)",marginBottom:4 }}>Notes</div>
                {equipment.notes}
              </div>
            )}
          </div>
        )}

        {!loading && detailTab==="qr label" && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18, lineHeight: 1.6 }}>
              This QR code is uniquely tied to <strong>{equipment.name}</strong>. Scan it with the
              KrakenCam room equipment scanner to instantly assign this unit.
            </div>
            {equipment.qrCodeId ? (
              <QrCodeDisplay
                qrCodeId={equipment.qrCodeId}
                equipmentName={equipment.name}
                uniqueCode={equipment.uniqueCode}
                size={200}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text3)", fontSize: 13 }}>
                No QR code found. This equipment may have been created before the QR system was added.
                Contact support or archive and re-create this record to generate a QR code.
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border)", margin: "24px 0" }} />

            {/* Usage instructions */}
            <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: "var(--text2)", marginBottom: 8, fontSize: 13 }}>How to use this QR code</div>
              <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Download or print the QR label and attach it to this equipment unit.</li>
                <li>In any project → Rooms → Equipment tab, tap <strong>"Assign via QR"</strong>.</li>
                <li>Point the camera at the label — the equipment is instantly identified and assigned.</li>
                <li>Add optional notes (condition, placement, setup instructions) after scanning.</li>
              </ol>
            </div>
          </div>
        )}

        {!loading && detailTab==="maintenance" && (
          <div>
            <button className="btn btn-sm btn-primary" style={{ marginBottom:14 }} onClick={()=>setShowMaintModal(true)}>
              <Icon d={ic.plus} size={13}/> Add Record
            </button>
            {maintenanceRecords.length===0 && <div style={{ textAlign:"center",color:"var(--text3)",padding:"30px 0",fontSize:13 }}>No maintenance records yet.</div>}
            {maintenanceRecords.map(r=>{
              const overdue = r.next_due_at && new Date(r.next_due_at) < new Date();
              return (
                <div key={r.id} style={{ background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px",marginBottom:8 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:4 }}>
                    <div style={{ fontWeight:700,fontSize:13.5 }}>{r.title || MAINT_TYPE_LABELS[r.maintenance_type] || r.maintenance_type}</div>
                    <span style={{ fontSize:11,padding:"2px 7px",borderRadius:8,background:r.status==="completed"?"#3dba7e18":r.status==="overdue"?"#e85a3a18":"#3ab8e818",color:r.status==="completed"?"#3dba7e":r.status==="overdue"?"#e85a3a":"#3ab8e8",fontWeight:700,flexShrink:0 }}>
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize:12,color:"var(--text3)" }}>
                    {new Date(r.performed_at).toLocaleDateString()}
                    {r.vendor_name && ` · ${r.vendor_name}`}
                    {r.cost!=null && ` · $${parseFloat(r.cost).toFixed(2)}`}
                  </div>
                  {r.notes && <div style={{ fontSize:12.5,color:"var(--text2)",marginTop:5 }}>{r.notes}</div>}
                  {r.next_due_at && (
                    <div style={{ marginTop:6,fontSize:12,color:overdue?"#e85a3a":"var(--text3)",fontWeight:overdue?700:400 }}>
                      Next due: {new Date(r.next_due_at).toLocaleDateString()} {overdue&&"— OVERDUE"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && detailTab==="deployments" && (
          <div>
            {deployments.length===0 && <div style={{ textAlign:"center",color:"var(--text3)",padding:"30px 0",fontSize:13 }}>No deployment history.</div>}
            {deployments.map(d=>{
              const proj = projects.find(p=>p.id===d.project_id);
              const isActive = d.status==="deployed"||d.status==="scheduled";
              const statusColor = d.status==="deployed"?"#8b7cf8":d.status==="scheduled"?"#3ab8e8":d.status==="returned"?"#3dba7e":"#6b7280";
              return (
                <div key={d.id} style={{ background:"var(--surface2)",border:`1px solid ${isActive?"var(--accent)30":"var(--border)"}`,borderRadius:8,padding:"12px 14px",marginBottom:8 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
                    <div style={{ fontWeight:700,fontSize:13.5 }}>{proj?.title||d.projects?.title||"Jobsite"}</div>
                    <span style={{ fontSize:11,padding:"2px 7px",borderRadius:8,background:`${statusColor}18`,color:statusColor,fontWeight:700 }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize:12,color:"var(--text3)",marginTop:3 }}>
                    {new Date(d.start_at).toLocaleDateString()}
                    {d.expected_return_at && ` → ${new Date(d.expected_return_at).toLocaleDateString()}`}
                    {d.actual_return_at && ` (returned ${new Date(d.actual_return_at).toLocaleDateString()})`}
                  </div>
                  {d.notes && <div style={{ fontSize:12,color:"var(--text2)",marginTop:4 }}>{d.notes}</div>}
                  {isActive && (
                    <button className="btn btn-sm btn-secondary" style={{ marginTop:8 }} onClick={()=>setReturnDep(d)}>
                      <Icon d={ic.rotateCw} size={12}/> Return Equipment
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && detailTab==="history" && (
          <div>
            {movementHistory.length === 0 && (
              <div style={{ textAlign:"center",color:"var(--text3)",padding:"30px 0",fontSize:13 }}>
                No movement history yet. History is recorded when equipment is assigned, moved, or removed via QR or manual actions.
              </div>
            )}
            {movementHistory.map((entry, idx) => {
              const icon  = ACTION_ICONS[entry.action_type]  || "📋";
              const label = ACTION_LABELS[entry.action_type] || entry.action_type;
              const hasRoute = entry.from_room_name || entry.to_room_name;
              return (
                <div key={entry.id} style={{ display:"flex",gap:12,padding:"12px 0",
                  borderBottom:"1px solid var(--border)", position:"relative" }}>
                  {/* Timeline dot */}
                  <div style={{ flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center" }}>
                    <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--surface2)",border:"2px solid var(--border)",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,zIndex:1 }}>
                      {icon}
                    </div>
                    {idx < movementHistory.length - 1 && (
                      <div style={{ width:2,flex:1,minHeight:16,background:"var(--border)",marginTop:4 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1,minWidth:0,paddingBottom:4 }}>
                    <div style={{ fontWeight:600,fontSize:13,color:"var(--text)",marginBottom:2 }}>{label}</div>
                    {hasRoute && (
                      <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
                        {entry.from_room_name && <span style={{ background:"var(--surface2)",padding:"1px 7px",borderRadius:6,border:"1px solid var(--border)" }}>{entry.from_room_name}</span>}
                        {entry.from_room_name && entry.to_room_name && <span style={{ color:"var(--text3)" }}>→</span>}
                        {entry.to_room_name && <span style={{ background:"var(--surface2)",padding:"1px 7px",borderRadius:6,border:"1px solid var(--border)" }}>{entry.to_room_name}</span>}
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3,fontStyle:"italic" }}>"{entry.notes}"</div>
                    )}
                    <div style={{ fontSize:11,color:"var(--text3)",display:"flex",gap:8,flexWrap:"wrap" }}>
                      <span>{new Date(entry.created_at).toLocaleString()}</span>
                      {entry.scan_method === "qr_scan" && (
                        <span style={{ background:"#3dba7e18",color:"#3dba7e",border:"1px solid #3dba7e30",
                          padding:"0 5px",borderRadius:4,fontWeight:600 }}>⬛ QR</span>
                      )}
                      {entry.previous_status && entry.new_status && entry.previous_status !== entry.new_status && (
                        <span style={{ color:"var(--text3)" }}>{entry.previous_status} → {entry.new_status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && detailTab==="activity" && (
          <div>
            {activityLog.length===0 && <div style={{ textAlign:"center",color:"var(--text3)",padding:"30px 0",fontSize:13 }}>No activity yet.</div>}
            {activityLog.map(log=>(
              <div key={log.id} style={{ display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid var(--border)" }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",flexShrink:0,marginTop:1 }}>
                  {log.action_type?.[0]?.toUpperCase()||"?"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,color:"var(--text)",fontWeight:600 }}>{log.action_label}</div>
                  <div style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>{new Date(log.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showMaintModal && (
        <MaintenanceModal equipmentId={equipment.id} orgId={orgId} userId={userId}
          onSave={r=>{setMaintenanceRecords(prev=>[r,...prev]);setShowMaintModal(false);}}
          onClose={()=>setShowMaintModal(false)} />
      )}
      {showDeployModal && (
        <DeployModal equipment={equipment} projects={projects} orgId={orgId} userId={userId}
          onSave={dep=>{setDeployments(prev=>[dep,...prev]);setShowDeployModal(false);onUpdated({...equipment,status:dep.status==="deployed"?"deployed":"scheduled"});}}
          onClose={()=>setShowDeployModal(false)} />
      )}
      {returnDep && (
        <ReturnModal deployment={returnDep} equipment={equipment} userId={userId}
          onSave={({equipment:eq})=>{
            setDeployments(prev=>prev.map(d=>d.id===returnDep.id?{...d,status:"returned"}:d));
            setReturnDep(null);
            onUpdated(eq);
          }}
          onClose={()=>setReturnDep(null)} />
      )}
      {showLockout && (
        <LockoutModal equipment={equipment} userId={userId} clearing={clearingLockout}
          onSave={eq=>{setShowLockout(false);onUpdated(eq);}}
          onClose={()=>setShowLockout(false)} />
      )}
    </div>
  );
}

// ── Main Equipment Page ───────────────────────────────────────────────────────

export function EquipmentPage({ projects, teamUsers, settings, orgId, userId }) {
  const [equipment,   setEquipment]   = useState([]);
  const [types,       setTypes]       = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQ,     setSearchQ]     = useState("");
  const [filterStatus,setFilterStatus]= useState("all");
  const [filterType,  setFilterType]  = useState("all");
  const [filterCat,   setFilterCat]   = useState("all");
  const [filterCond,  setFilterCond]  = useState("all");
  const [filterLoc,   setFilterLoc]   = useState("all");
  const [sortBy,      setSortBy]      = useState("updated_at");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [editEquip,   setEditEquip]   = useState(null);
  const [showTaxonomy,setShowTaxonomy]= useState(false);
  const [bulkMode,    setBulkMode]    = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [showBulkPrint, setShowBulkPrint] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eq, ty, ca] = await Promise.all([getEquipment(), getEquipmentTypes(), getEquipmentCategories()]);
      setEquipment(eq);
      setTypes(ty);
      setCategories(ca);
    } catch(e) {
      console.warn("[Equipment] Load error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Summary counts
  const counts = {
    total:         equipment.length,
    available:     equipment.filter(e=>e.status==="available"&&!e.isLockedOut).length,
    deployed:      equipment.filter(e=>e.status==="deployed"||e.status==="scheduled").length,
    maintenance:   equipment.filter(e=>e.status==="in_maintenance").length,
    locked:        equipment.filter(e=>e.isLockedOut).length,
  };

  // Filter + sort
  const today = new Date();
  const filtered = equipment.filter(e => {
    if (filterStatus !== "all" && filterStatus === "locked") {
      if (!e.isLockedOut) return false;
    } else if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterType !== "all" && e.typeId !== filterType) return false;
    if (filterCat  !== "all" && e.categoryId !== filterCat) return false;
    if (filterCond !== "all" && e.condition !== filterCond) return false;
    if (filterLoc  !== "all" && e.currentLocation !== filterLoc) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (![e.name, e.uniqueCode, e.serialNumber, e.model, e.manufacturer].some(f=>f?.toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a,b) => {
    if (sortBy==="name")        return a.name.localeCompare(b.name);
    if (sortBy==="code")        return a.uniqueCode.localeCompare(b.uniqueCode);
    if (sortBy==="status")      return a.status.localeCompare(b.status);
    if (sortBy==="warranty")    return (a.warrantyExpiry||"9999").localeCompare(b.warrantyExpiry||"9999");
    if (sortBy==="purchase")    return (b.purchaseDate||"").localeCompare(a.purchaseDate||"");
    return (b.updatedAt||"").localeCompare(a.updatedAt||"");
  });

  const toggleSelect = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleSaved = (eq) => {
    setEquipment(prev => {
      const exists = prev.find(e=>e.id===eq.id);
      return exists ? prev.map(e=>e.id===eq.id?eq:e) : [eq,...prev];
    });
    setShowForm(false);
    setEditEquip(null);
    if (selectedDetail?.id === eq.id) setSelectedDetail(eq);
  };

  const handleArchive = async (id) => {
    if (!confirm("Archive this equipment? It won't appear in the main list.")) return;
    await archiveEquipment(id, userId);
    setEquipment(prev => prev.filter(e=>e.id!==id));
    if (selectedDetail?.id === id) setSelectedDetail(null);
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${selected.size} items?`)) return;
    await bulkArchiveEquipment([...selected], userId);
    setEquipment(prev => prev.filter(e=>!selected.has(e.id)));
    setSelected(new Set()); setBulkMode(false);
  };

  // Locations present in data
  const locOptions = [...new Set(equipment.map(e=>e.currentLocation).filter(Boolean))];

  return (
    <div className="page fade-in" style={{ maxWidth:"100%",paddingRight:0,position:"relative" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18,paddingRight:26 }}>
        <div>
          <div className="section-title" style={{ marginBottom:4 }}>Equipment</div>
          <div className="section-sub">Track, deploy and maintain your field equipment</div>
        </div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <button className="btn btn-sm btn-secondary" onClick={()=>setShowBulkPrint(true)} title="Print QR labels for multiple items">
            🖨️ Bulk Print QR
          </button>
          <button className="btn btn-sm btn-secondary" onClick={()=>setShowTaxonomy(true)}>
            <Icon d={ic.settings} size={14}/> Types & Categories
          </button>
          <button className="btn btn-sm btn-primary" onClick={()=>{setEditEquip(null);setShowForm(true);}}>
            <Icon d={ic.plus} size={14}/> Add Equipment
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",paddingRight:26 }}>
        <SummaryCard label="Total" value={counts.total} onClick={()=>setFilterStatus("all")} active={filterStatus==="all"} />
        <SummaryCard label="Available" value={counts.available} color="#3dba7e" onClick={()=>setFilterStatus("available")} active={filterStatus==="available"} />
        <SummaryCard label="Deployed / Scheduled" value={counts.deployed} color="#8b7cf8" onClick={()=>setFilterStatus("deployed")} active={filterStatus==="deployed"} />
        <SummaryCard label="Maintenance" value={counts.maintenance} color="#e8c53a" onClick={()=>setFilterStatus("in_maintenance")} active={filterStatus==="in_maintenance"} />
        <SummaryCard label="Locked Out" value={counts.locked} color="#e85a3a" onClick={()=>setFilterStatus("locked")} active={filterStatus==="locked"} />
      </div>

      {/* Filter bar */}
      <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",paddingRight:26,alignItems:"center" }}>
        <input className="form-input" style={{ width:200 }} placeholder="Search name, code, serial…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        <select className="form-input form-select" style={{ width:"auto" }} value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {types.filter(t=>!t.is_archived).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.filter(c=>!c.is_archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterCond} onChange={e=>setFilterCond(e.target.value)}>
          <option value="all">Any Condition</option>
          {Object.entries(CONDITION_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {locOptions.length > 0 && (
          <select className="form-input form-select" style={{ width:"auto" }} value={filterLoc} onChange={e=>setFilterLoc(e.target.value)}>
            <option value="all">All Locations</option>
            {locOptions.map(l=><option key={l} value={l}>{l.replace(/_/g," ")}</option>)}
          </select>
        )}
        <select className="form-input form-select" style={{ width:"auto" }} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="updated_at">Recently Updated</option>
          <option value="name">Name</option>
          <option value="code">Code</option>
          <option value="status">Status</option>
          <option value="warranty">Warranty Expiry</option>
          <option value="purchase">Purchase Date</option>
        </select>
        {(searchQ||filterStatus!=="all"||filterType!=="all"||filterCat!=="all"||filterCond!=="all"||filterLoc!=="all") && (
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--text3)" }} onClick={()=>{setSearchQ("");setFilterStatus("all");setFilterType("all");setFilterCat("all");setFilterCond("all");setFilterLoc("all");}}>✕ Clear</button>
        )}
        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
          <span style={{ fontSize:12,color:"var(--text3)" }}>{filtered.length} item{filtered.length!==1?"s":""}</span>
          <button className="btn btn-sm" onClick={()=>{setBulkMode(v=>!v);setSelected(new Set());}}
            style={{ padding:"0 12px",height:34,fontSize:12,background:bulkMode?"#e85a3a18":"var(--surface2)",color:bulkMode?"#e85a3a":"var(--text2)",border:`1.5px solid ${bulkMode?"#e85a3a":"var(--border)"}` }}>
            <Icon d={ic.check} size={12}/> {bulkMode?"Cancel":"Select"}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div style={{ display:"flex",gap:8,marginBottom:10,paddingRight:26,alignItems:"center" }}>
          <span style={{ fontSize:13,color:"var(--text2)" }}>{selected.size} selected</span>
          <button className="btn btn-sm btn-secondary" onClick={handleBulkArchive}>Archive selected</button>
          <button className="btn btn-sm btn-secondary" onClick={async()=>{await bulkUpdateStatus([...selected],"in_maintenance",userId);load();}}>→ Maintenance</button>
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--text3)" }} onClick={()=>setSelected(new Set())}>Deselect All</button>
        </div>
      )}

      {/* Equipment list */}
      {loading && <div style={{ textAlign:"center",padding:60,color:"var(--text3)" }}>Loading equipment…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--text3)" }}>
          <Icon d={ic.briefcase} size={40} stroke="var(--border)"/>
          <div style={{ marginTop:12,fontSize:15,fontWeight:600 }}>{equipment.length===0?"No equipment yet":"No results"}</div>
          {equipment.length===0 && <div style={{ fontSize:13,marginTop:6 }}><button className="btn btn-sm btn-primary" style={{ marginTop:8 }} onClick={()=>setShowForm(true)}><Icon d={ic.plus} size={13}/> Add your first piece of equipment</button></div>}
        </div>
      )}

      <div style={{ paddingRight:26 }}>
        {filtered.map(eq => {
          const typeName = types.find(t=>t.id===eq.typeId)?.name || eq.typeName || null;
          const catName  = categories.find(c=>c.id===eq.categoryId)?.name || eq.categoryName || null;
          const isSelected = selected.has(eq.id);
          const warrantyWarning = eq.warrantyExpiry && (() => {
            const exp = new Date(eq.warrantyExpiry+"T12:00:00");
            const diff = (exp - today) / 86400000;
            return diff < 0 ? "expired" : diff < 30 ? "expiring" : null;
          })();

          return (
            <div key={eq.id}
              onClick={()=>!bulkMode && setSelectedDetail(eq)}
              style={{ background:"var(--surface)",border:`1px solid ${isSelected?"var(--accent)":selectedDetail?.id===eq.id?"var(--accent)40":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 14px",marginBottom:8,cursor:bulkMode?"default":"pointer",display:"flex",gap:12,alignItems:"flex-start",transition:"border-color .15s" }}
              onMouseEnter={e=>{ if(!bulkMode)e.currentTarget.style.borderColor="var(--accent)40"; }}
              onMouseLeave={e=>{ if(!bulkMode&&selectedDetail?.id!==eq.id)e.currentTarget.style.borderColor="var(--border)"; }}>

              {/* Bulk checkbox */}
              {bulkMode && (
                <div onClick={e=>{e.stopPropagation();toggleSelect(eq.id);}}
                  style={{ width:20,height:20,borderRadius:4,border:`2px solid ${isSelected?"var(--accent)":"var(--border)"}`,background:isSelected?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,cursor:"pointer",transition:"all .15s" }}>
                  {isSelected && <Icon d={ic.check} size={12} stroke="white" strokeWidth={3}/>}
                </div>
              )}

              {/* Photo */}
              {eq.photoUrl
                ? <img src={eq.photoUrl} alt="" style={{ width:44,height:44,objectFit:"cover",borderRadius:6,flexShrink:0 }} />
                : <div style={{ width:44,height:44,borderRadius:6,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.briefcase} size={20} stroke="var(--text3)"/></div>
              }

              {/* Info */}
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                  <span style={{ fontWeight:700,fontSize:14 }}>{eq.name}</span>
                  {eq.isLockedOut && <span style={{ fontSize:12 }}>🔒</span>}
                  <span style={{ fontSize:12,color:"var(--text3)",fontFamily:"monospace" }}>{eq.uniqueCode}</span>
                  <StatusChip status={eq.status} locked={eq.isLockedOut} />
                  <ConditionChip condition={eq.condition} />
                  {warrantyWarning && (
                    <span style={{ fontSize:11,padding:"2px 7px",borderRadius:10,background:warrantyWarning==="expired"?"#e85a3a18":"#e8c53a18",color:warrantyWarning==="expired"?"#e85a3a":"#e8c53a",fontWeight:700 }}>
                      Warranty {warrantyWarning}
                    </span>
                  )}
                </div>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"var(--text3)" }}>
                  {typeName && <span>{typeName}</span>}
                  {catName  && <span>· {catName}</span>}
                  <span>· {(eq.currentLocation||"shop").replace(/_/g," ")}</span>
                  {eq.model && <span>· {eq.model}</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex",gap:4,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={()=>{setEditEquip(eq);setShowForm(true);}}>
                  <Icon d={ic.edit} size={15}/>
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" title="Archive" style={{ color:"var(--text3)" }} onClick={()=>handleArchive(eq.id)}>
                  <Icon d={ic.minus} size={15}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {(showForm) && (
        <EquipmentFormModal
          equipment={editEquip}
          types={types}
          categories={categories}
          orgId={orgId}
          userId={userId}
          onSave={handleSaved}
          onClose={()=>{setShowForm(false);setEditEquip(null);}}
        />
      )}
      {showTaxonomy && (
        <TaxonomyManager
          types={types}
          categories={categories}
          orgId={orgId}
          onTypesChange={setTypes}
          onCategoriesChange={setCategories}
          onClose={()=>setShowTaxonomy(false)}
        />
      )}
      {showBulkPrint && (
        <BulkQrPrint
          equipment={equipment}
          onClose={()=>setShowBulkPrint(false)}
        />
      )}

      {/* Detail drawer */}
      {selectedDetail && (
        <EquipmentDetail
          equipment={selectedDetail}
          types={types}
          categories={categories}
          projects={projects}
          orgId={orgId}
          userId={userId}
          onUpdated={eq=>{ setEquipment(prev=>prev.map(e=>e.id===eq.id?eq:e)); setSelectedDetail(eq); }}
          onClose={()=>setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
