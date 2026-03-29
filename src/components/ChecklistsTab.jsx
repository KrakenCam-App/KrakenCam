import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { uploadVoiceNote as dbUploadVoiceNote, deleteVoiceNote as dbDeleteVoiceNote } from "../lib/voiceNotes.js";
import { deleteVideo as dbDeleteVideo } from "../lib/videos.js";
import { deleteProjectFile as dbDeleteProjectFile } from "../lib/projectFiles.js";
import { Icon, ic } from "../utils/icons.jsx";
import { hasPermissionLevel, getEffectivePermissions, DEFAULT_CL_TEMPLATES, getPermissionPolicies, FIELD_TYPES } from "../utils/constants.js";
import { uid, formatDate, formatDateTimeLabel, today, buildEmbedCode, formatDurationLabel , isPortalApprovedItem, filterPortalApprovedItems, withPortalFilteredProject, getPortalItemDateValue, formatPortalRelativeLabel, buildPortalActivity, formatFileSizeLabel, getFileExtension, isPreviewableFile, inferProjectFileKind, normaliseProjectFile, parseTagInput, decodeDataUrlText
} from "../utils/helpers.js";
import { getAuthHeaders } from "../lib/supabase.js";
const REPORT_EMAIL_FEATURE_VISIBLE = false; // feature flag â email reports hidden until ready

function LegacyChecklistsTab({ project, onUpdateProject }) {
  const [view,          setView]          = useState("list");   // list | run | build
  const [activeChecklist, setActive]      = useState(null);     // checklist being run/built
  const [showTmplPicker, setShowTmplPicker] = useState(false);
  const [templates,     setTemplates]     = useState(DEFAULT_CL_TEMPLATES);
  const [editingTmpl,   setEditingTmpl]   = useState(null);
  const [pickerSearch,  setPickerSearch]  = useState("");
  const [pickerCat,     setPickerCat]     = useState("All");

  const checklists = project.checklists || [];

  const saveChecklist = (cl) => {
    const existing = checklists.find(c => c.id === cl.id);
    const updated  = existing
      ? checklists.map(c => c.id === cl.id ? cl : c)
      : [...checklists, cl];
    onUpdateProject({ ...project, checklists: updated });
  };

  const deleteChecklist = (id) => onUpdateProject({ ...project, checklists: checklists.filter(c => c.id !== id) });

  const startFromTemplate = (tmpl) => {
    const cl = {
      id: uid(), name: tmpl.name, templateId: tmpl.id,
      createdAt: today(), completedAt: null, assignee: "",
      status: "in_progress",
      fields: tmpl.fields.map(f => ({ ...f, value: f.type==="multi_checkbox" ? [] : "" })),
    };
    setActive(cl); setShowTmplPicker(false); setView("run");
  };

  const startBlank = () => {
    const cl = { id:uid(), name:"New Checklist", createdAt:today(), completedAt:null, assignee:"", status:"in_progress", fields:[] };
    setActive(cl); setView("build");
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:13, color:"var(--text2)" }}>{checklists.length} checklist{checklists.length!==1?"s":""}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-sm btn-secondary desktop-only" onClick={() => setEditingTmpl("new")}><Icon d={ic.edit} size={13} /> Manage Templates</button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={13} /> New Checklist</button>
        </div>
      </div>

      {checklists.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div>
          <h3>No checklists yet</h3>
          <p>Start a checklist from a template or build a custom one for this site visit.</p>
          <button className="btn btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={15} /> Start Checklist</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {checklists.map(cl => {
            const total   = cl.fields?.length || 0;
            const done    = cl.fields?.filter(f => {
              if (f.type==="multi_checkbox") return f.value?.length > 0;
              if (f.type==="checkbox") return f.value === true || f.value === "true";
              return f.value !== "" && f.value !== null && f.value !== undefined;
            }).length || 0;
            const pct = total > 0 ? Math.round((done/total)*100) : 0;
            return (
              <div key={cl.id} className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px" }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:`conic-gradient(var(--accent) ${pct*3.6}deg, var(--surface2) 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--accent)" }}>{pct}%</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{cl.name}</div>
                    <div style={{ fontSize:12, color:"var(--text2)" }}>
                      {done}/{total} items · {cl.createdAt}
                      {cl.assignee && <span style={{ marginLeft:8, color:"var(--text3)" }}>· {cl.assignee}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
                    background: cl.status==="complete" ? "rgba(61,186,126,.15)" : "rgba(43,127,232,.1)",
                    color: cl.status==="complete" ? "#3dba7e" : "var(--accent)" }}>
                    {cl.status==="complete" ? "✓ Complete" : "In Progress"}
                  </span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setActive(cl); setView("run"); }}><Icon d={ic.edit} size={12} /> Open</button>
                    <button className="btn btn-sm btn-danger btn-icon" onClick={() => deleteChecklist(cl.id)}><Icon d={ic.trash} size={12} /></button>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height:3, background:"var(--surface2)" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background: pct===100 ? "#3dba7e" : "var(--accent)", transition:"width .3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template picker modal */}
      {showTmplPicker && (() => {
        const CATEGORY_COLORS = {"General":"#4a90d9","Water Damage":"#3ab8e8","Safety":"#e8703a","Fire":"#e85a3a","Mold":"#3dba7e","Structural":"#8b7cf8","Electrical":"#f0c040","HVAC":"#4ec9b0","Roofing":"#c792ea"};
        const pickerCategories = ["All", ...Array.from(new Set(templates.map(t => t.category||"General")))];
        return (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowTmplPicker(false)}>
          <div className="modal fade-in" style={{ maxWidth:540 }}>
            <div className="modal-header">
              <div className="modal-title">Start a Checklist</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowTmplPicker(false)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body" style={{ paddingBottom:0 }}>
              {/* Search */}
              <input className="form-input" placeholder="Search templates…" value={pickerSearch||""} onChange={e=>setPickerSearch(e.target.value)} style={{ marginBottom:10 }} />
              {/* Category pills */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {pickerCategories.map(cat => (
                  <button key={cat} onClick={()=>setPickerCat(cat)}
                    style={{ padding:"3px 11px", borderRadius:20, fontSize:11.5, fontWeight:600, cursor:"pointer", border:"none",
                      background: (pickerCat||"All")===cat ? (CATEGORY_COLORS[cat]||"var(--accent)") : "var(--surface3)",
                      color: (pickerCat||"All")===cat ? "white" : "var(--text2)" }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:340, overflowY:"auto", paddingBottom:8 }}>
                {templates.filter(t => {
                  const q = (pickerSearch||"").trim().toLowerCase();
                  const catOk = (pickerCat||"All")==="All" || (t.category||"General")===(pickerCat||"All");
                  const searchOk = !q || t.name.toLowerCase().includes(q) || (t.desc||"").toLowerCase().includes(q) || (t.tags||[]).some(g=>g.includes(q));
                  return catOk && searchOk;
                }).map(t => {
                  const catColor = CATEGORY_COLORS[t.category||"General"]||"var(--accent)";
                  return (
                  <div key={t.id} onClick={() => startFromTemplate(t)}
                    style={{ padding:"12px 14px", border:"1px solid var(--border)", borderLeft:`3px solid ${catColor}`, borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12, background:"var(--surface2)", transition:"border-color .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=catColor}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:700, fontSize:13.5 }}>{t.name}</span>
                        <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:`${catColor}22`, color:catColor, fontWeight:600 }}>{t.category||"General"}</span>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{t.desc} · {t.fields.length} fields</div>
                      {(t.tags||[]).length > 0 && (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                          {(t.tags||[]).map(tag => <span key={tag} style={{ fontSize:10, padding:"1px 6px", borderRadius:8, background:"var(--surface3)", color:"var(--text3)" }}>#{tag}</span>)}
                        </div>
                      )}
                    </div>
                    <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                  </div>
                  );
                })}
                <div onClick={startBlank}
                  style={{ padding:"12px 14px", border:"2px dashed var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13.5 }}>â Build Custom Checklist</div>
                    <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>Start from scratch with any field types</div>
                  </div>
                  <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Template manager modal */}
      {editingTmpl && (
        <TemplateManagerModal templates={templates} setTemplates={setTemplates} onClose={() => setEditingTmpl(null)} />
      )}
    </div>
  );

  // ── RUN VIEW (fill out checklist) ─────────────────────────────────────────
  if (view === "run") return (
    <ChecklistRunner
      checklist={activeChecklist}
      onSave={cl => { saveChecklist(cl); setView("list"); }}
      onBack={() => setView("list")}
    />
  );

  // ── BUILD VIEW (design checklist) ────────────────────────────────────────
  if (view === "build") return (
    <ChecklistBuilder
      checklist={activeChecklist}
      onSave={cl => { saveChecklist(cl); setView("list"); }}
      onBack={() => setView("list")}
    />
  );
}

// ── Checklist Runner ──────────────────────────────────────────────────────────
function LegacyChecklistRunner({ checklist, onSave, onBack }) {
  const [cl, setCl] = useState({ ...checklist, fields: checklist.fields.map(f => ({ ...f })) });

  const updateField = (id, value) => setCl(prev => ({ ...prev, fields: prev.fields.map(f => f.id===id ? { ...f, value } : f) }));
  const toggleMulti = (id, opt) => {
    const f = cl.fields.find(f => f.id===id);
    const cur = f.value || [];
    updateField(id, cur.includes(opt) ? cur.filter(x=>x!==opt) : [...cur, opt]);
  };

  const complete = cl.fields.filter(f => {
    if (f.type==="multi_checkbox") return f.value?.length > 0;
    if (f.type==="checkbox") return f.value === true;
    return f.value !== "" && f.value !== null && f.value !== undefined;
  }).length;
  const total  = cl.fields.length;
  const pct    = total > 0 ? Math.round((complete/total)*100) : 0;
  const allReqDone = cl.fields.filter(f=>f.required).every(f => {
    if (f.type==="multi_checkbox") return f.value?.length > 0;
    if (f.type==="checkbox") return f.value === true;
    return f.value !== "" && f.value !== null;
  });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <div style={{ flex:1, minWidth:150 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{cl.name}</div>
          <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{complete}/{total} completed · {pct}%</div>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button className="btn btn-sm btn-secondary" onClick={() => onSave({ ...cl, status:"in_progress" })}>Save Draft</button>
          <button className="btn btn-sm btn-primary" disabled={!allReqDone}
            onClick={() => onSave({ ...cl, status:"complete", completedAt:today() })}>
            <Icon d={ic.check} size={13} /> Mark Complete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:6, background:"var(--surface2)", borderRadius:3, marginBottom:24, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#3dba7e":"var(--accent)", transition:"width .3s", borderRadius:3 }} />
      </div>

      {/* Assignee */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".04em", whiteSpace:"nowrap" }}>Assigned To</label>
            <input className="form-input" style={{ flex:1 }} placeholder="Inspector name…" value={cl.assignee} onChange={e => setCl(p=>({...p, assignee:e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {cl.fields.map((field, i) => {
          const answered = field.type==="multi_checkbox" ? field.value?.length>0 : field.type==="checkbox" ? field.value===true : (field.value!==""&&field.value!=null);
          return (
            <div key={field.id} className="card" style={{ borderLeft:`3px solid ${answered?"var(--accent)":"var(--border)"}`, overflow:"hidden" }}>
              <div className="card-body" style={{ padding:"14px 16px", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom: field.type==="checkbox"||field.type==="yesno" ? 0 : 10 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text3)", flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>
                      {field.label}
                      {field.required && <span style={{ color:"var(--accent)", marginLeft:4 }}>*</span>}
                    </div>
                  </div>
                  {answered && <Icon d={ic.check} size={14} stroke="#3dba7e" />}
                </div>

                {/* Single checkbox */}
                {field.type==="checkbox" && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:32, marginTop:6 }}>
                    <input type="checkbox" checked={!!field.value} onChange={e=>updateField(field.id, e.target.checked)} style={{ width:18,height:18,accentColor:"var(--accent)",cursor:"pointer" }} />
                    <span style={{ fontSize:13, color:"var(--text2)" }}>Confirmed</span>
                  </div>
                )}

                {/* Yes / No */}
                {field.type==="yesno" && (
                  <div style={{ display:"flex", gap:8, marginLeft:32, marginTop:6 }}>
                    {["Yes","No","N/A"].map(opt => (
                      <div key={opt} onClick={()=>updateField(field.id, opt)}
                        style={{ padding:"6px 20px", borderRadius:"var(--radius-sm)", border:`2px solid ${field.value===opt?"var(--accent)":"var(--border)"}`, background:field.value===opt?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color:field.value===opt?"var(--accent)":"var(--text2)", transition:"all .15s" }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                {/* Multi checkbox */}
                {field.type==="multi_checkbox" && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginLeft:32, marginTop:6 }}>
                    {(field.options||[]).map(opt => {
                      const sel = (field.value||[]).includes(opt);
                      return (
                        <div key={opt} onClick={()=>toggleMulti(field.id, opt)}
                          style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${sel?"var(--accent)":"var(--border)"}`, background:sel?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color:sel?"var(--accent)":"var(--text2)", transition:"all .15s", userSelect:"none" }}>
                          {sel?"✓ ":""}{opt}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown */}
                {field.type==="dropdown" && (
                  <select className="form-input form-select" style={{ marginLeft:32, marginTop:6, width:"calc(100% - 32px)", minWidth:0 }} value={field.value||""} onChange={e=>updateField(field.id, e.target.value)}>
                    <option value="">— Select —</option>
                    {(field.options||[]).map(o=><option key={o}>{o}</option>)}
                  </select>
                )}

                {/* Text */}
                {field.type==="text" && (
                  <textarea className="form-input form-textarea" style={{ marginLeft:32, marginTop:6, minHeight:72, fontSize:13, resize:"vertical", width:"calc(100% - 32px)", boxSizing:"border-box" }} placeholder="Enter your answer…" value={field.value||""} onChange={e=>updateField(field.id, e.target.value)} />
                )}

                {/* Number */}
                {field.type==="number" && (
                  <input type="number" className="form-input" style={{ marginLeft:32, marginTop:6, width:"calc(100% - 32px)", boxSizing:"border-box" }} placeholder="0" value={field.value||""} onChange={e=>updateField(field.id, e.target.value)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cl.fields.length === 0 && (
        <div className="empty"><div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div><h3>No fields</h3><p>This checklist has no fields yet. Edit it to add some.</p></div>
      )}
    </div>
  );
}

// ── Checklist Builder ────────────────────────────────────────────────────────
function LegacyChecklistBuilder({ checklist, onSave, onBack }) {
  const [cl, setCl] = useState({ ...checklist });
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ type:"checkbox", label:"", options:"", required:false });
  const [editingField, setEditingField] = useState(null);

  const addField = () => {
    if (!newField.label.trim()) return;
    const f = {
      id: uid(), type:newField.type, label:newField.label.trim(), required:newField.required,
      options: ["multi_checkbox","dropdown"].includes(newField.type)
        ? newField.options.split("\n").map(s=>s.trim()).filter(Boolean)
        : undefined,
      value: newField.type==="multi_checkbox" ? [] : "",
    };
    setCl(p=>({...p, fields:[...p.fields, f]}));
    setNewField({ type:"checkbox", label:"", options:"", required:false });
    setAddingField(false);
  };

  const removeField = id => setCl(p=>({...p, fields:p.fields.filter(f=>f.id!==id)}));
  const moveField   = (id, dir) => {
    const idx = cl.fields.findIndex(f=>f.id===id); if (idx<0) return;
    const arr = [...cl.fields];
    const swap = idx+dir;
    if (swap<0||swap>=arr.length) return;
    [arr[idx],arr[swap]]=[arr[swap],arr[idx]];
    setCl(p=>({...p,fields:arr}));
  };

  const needsOptions = ["multi_checkbox","dropdown"].includes(newField.type);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <input className="form-input" style={{ flex:1, fontWeight:700, fontSize:15 }} value={cl.name} onChange={e=>setCl(p=>({...p,name:e.target.value}))} placeholder="Checklist name…" />
        <button className="btn btn-sm btn-primary" disabled={!cl.name.trim()||cl.fields.length===0}
          onClick={()=>onSave(cl)}><Icon d={ic.check} size={13} /> Save Checklist</button>
      </div>

      {/* Fields list */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {cl.fields.map((f, i) => (
          <div key={f.id} className="card" style={{ padding:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <button onClick={()=>moveField(f.id,-1)} disabled={i===0} style={{ background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>â²</button>
                <button onClick={()=>moveField(f.id,1)} disabled={i===cl.fields.length-1} style={{ background:"none",border:"none",cursor:i===cl.fields.length-1?"default":"pointer",color:i===cl.fields.length-1?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>â¼</button>
              </div>
              <div style={{ width:28, height:28, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>
                {FIELD_TYPES.find(t=>t.id===f.type)?.icon || "?"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{f.label}{f.required && <span style={{ color:"var(--accent)",marginLeft:4 }}>*</span>}</div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:1 }}>
                  {FIELD_TYPES.find(t=>t.id===f.type)?.label}
                  {f.options?.length > 0 && ` · ${f.options.length} options`}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>removeField(f.id)}><Icon d={ic.trash} size={13} stroke="#ff6b6b" /></button>
            </div>
          </div>
        ))}
        {cl.fields.length===0 && <div style={{ textAlign:"center",padding:"24px 0",color:"var(--text3)",fontSize:13 }}>No fields yet — add one below</div>}
      </div>

      {/* Add field panel */}
      {!addingField ? (
        <button className="btn btn-secondary" style={{ width:"100%", justifyContent:"center", borderStyle:"dashed" }} onClick={()=>setAddingField(true)}>
          <Icon d={ic.plus} size={14} /> Add Field
        </button>
      ) : (
        <div className="card" style={{ border:"1.5px solid var(--accent)" }}>
          <div className="card-body" style={{ padding:"16px" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"var(--accent)" }}>New Field</div>
            <div className="form-group">
              <label className="form-label">Field Type</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {FIELD_TYPES.map(ft => (
                  <div key={ft.id} onClick={()=>setNewField(p=>({...p,type:ft.id}))}
                    style={{ padding:"6px 12px", borderRadius:"var(--radius-sm)", border:`1.5px solid ${newField.type===ft.id?"var(--accent)":"var(--border)"}`, background:newField.type===ft.id?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color:newField.type===ft.id?"var(--accent)":"var(--text2)", display:"flex", gap:5, alignItems:"center", transition:"all .15s" }}>
                    <span style={{ fontSize:13 }}>{ft.icon}</span>{ft.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Field Label</label>
              <input className="form-input" placeholder="e.g. Was PPE worn by all personnel?" value={newField.label} onChange={e=>setNewField(p=>({...p,label:e.target.value}))} />
            </div>
            {needsOptions && (
              <div className="form-group">
                <label className="form-label">Options <span style={{ fontWeight:400, color:"var(--text3)" }}>(one per line)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight:90, fontSize:13 }} placeholder={"Option 1\nOption 2\nOption 3"} value={newField.options} onChange={e=>setNewField(p=>({...p,options:e.target.value}))} />
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <input type="checkbox" id="req_cb" checked={newField.required} onChange={e=>setNewField(p=>({...p,required:e.target.checked}))} style={{ accentColor:"var(--accent)" }} />
              <label htmlFor="req_cb" style={{ fontSize:13, cursor:"pointer" }}>Required field</label>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setAddingField(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={addField} disabled={!newField.label.trim()}><Icon d={ic.plus} size={12} /> Add Field</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Manager Modal ────────────────────────────────────────────────────
export function ChecklistsTab({ project, onUpdateProject }) {
  const [view, setView] = useState("list");
  const [activeChecklist, setActive] = useState(null);
  const [showTmplPicker, setShowTmplPicker] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_CL_TEMPLATES);
  const [editingTmpl, setEditingTmpl] = useState(null);
  const roomOptions = ["General", ...(project.rooms || []).map(r => r.name).filter(Boolean)];

  // Load custom templates from Supabase on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id; if (!uid) return;
        const h1 = await getAuthHeaders();
        const profRes = await fetch(`${url}/rest/v1/profiles?user_id=eq.${uid}&select=organization_id`, { headers: h1 });
        const profs = await profRes.json();
        const oid = profs?.[0]?.organization_id; if (!oid) return;
        const h2 = await getAuthHeaders();
        const tmplRes = await fetch(`${url}/rest/v1/checklist_templates?organization_id=eq.${oid}&select=*&order=created_at`, { headers: h2 });
        const rows = await tmplRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const dbTmpls = rows.map(r => ({ id: r.id, name: r.name, desc: r.description || '', category: r.category || 'General', tags: r.tags || [], fields: r.fields || [], completionSettings: r.completion_settings || {} }));
          // Merge: keep built-ins that aren't overridden, add DB templates
          setTemplates(prev => {
            const dbIds = new Set(dbTmpls.map(t => t.id));
            const kept = prev.filter(t => !dbIds.has(t.id));
            return [...kept, ...dbTmpls];
          });
        }
      } catch {}
    };
    loadTemplates();
  }, []);

  const normalizeField = (field) => ({
    ...field,
    value: field?.value ?? (field?.type === "multi_checkbox" ? [] : field?.type === "checkbox" ? false : ""),
    responseStatus: field?.responseStatus || "",
    comment: field?.comment || "",
    photos: (field?.photos || []).map((p, i) => ({ id: p.id || uid(), name: p.name || `Evidence ${i + 1}`, dataUrl: p.dataUrl || p })),
    room: field?.room || "General",
    requireCommentOnFail: field?.requireCommentOnFail ?? false,
    requireEvidenceOnFail: field?.requireEvidenceOnFail ?? false,
    createIssueOnFail: field?.createIssueOnFail ?? true,
    issue: field?.issue ? { id: field.issue.id || uid(), title: field.issue.title || field.label || "Checklist issue", assignee: field.issue.assignee || "", dueDate: field.issue.dueDate || "", status: field.issue.status || "open", notes: field.issue.notes || "" } : null,
  });
  const normalizeChecklist = (cl) => ({
    ...cl,
    assignee: cl.assignee || "",
    status: cl.status || "in_progress",
    createdAt: cl.createdAt || today(),
    completedAt: cl.completedAt || null,
    completionSettings: {
      requireSignature: cl?.completionSettings?.requireSignature ?? true,
      lockAfterComplete: cl?.completionSettings?.lockAfterComplete ?? true,
      requireCompletedBy: cl?.completionSettings?.requireCompletedBy ?? true,
      signatureLabel: cl?.completionSettings?.signatureLabel || "Site Supervisor Signature",
    },
    completion: {
      completedBy: cl?.completion?.completedBy || "",
      completedTitle: cl?.completion?.completedTitle || "",
      completionNotes: cl?.completion?.completionNotes || "",
      signatureImg: cl?.completion?.signatureImg || null,
    },
    fields: (cl.fields || []).map(normalizeField)
  });
  const checklists = (project.checklists || []).map(normalizeChecklist);

  const saveChecklist = (cl) => {
    const next = normalizeChecklist(cl);
    const updated = checklists.some(c => c.id === next.id) ? checklists.map(c => c.id === next.id ? next : c) : [...checklists, next];
    onUpdateProject({ ...project, checklists: updated });
  };
  const deleteChecklist = (id) => onUpdateProject({ ...project, checklists: checklists.filter(c => c.id !== id) });
  const startFromTemplate = (tmpl) => {
    setActive(normalizeChecklist({
      id: uid(),
      name: tmpl.name,
      templateId: tmpl.id,
      createdAt: today(),
      completedAt: null,
      assignee: "",
      status: "in_progress",
      completionSettings: tmpl.completionSettings,
      fields: tmpl.fields.map(f => ({ ...f, room: f.room || "General" }))
    }));
    setShowTmplPicker(false);
    setView("run");
  };
  const startBlank = () => { setActive(normalizeChecklist({ id:uid(), name:"New Checklist", createdAt:today(), completedAt:null, assignee:"", status:"in_progress", fields:[] })); setView("build"); };

  if (view === "run") return <ChecklistRunner checklist={activeChecklist} project={project} onSave={cl => { saveChecklist(cl); setView("list"); }} onBack={() => setView("list")} />;
  if (view === "build") return <ChecklistBuilder checklist={activeChecklist} rooms={roomOptions} onSave={cl => { saveChecklist(cl); setView("list"); }} onBack={() => setView("list")} />;

  const totals = checklists.reduce((acc, cl) => {
    acc.items += cl.fields.length;
    acc.failed += cl.fields.filter(f => f.responseStatus === "fail").length;
    acc.issues += cl.fields.filter(f => f.issue && f.issue.status !== "resolved").length;
    return acc;
  }, { items:0, failed:0, issues:0 });

  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16 }}>
        {[
          { label:"Checklists", value:checklists.length, tone:"var(--accent)" },
          { label:"Items", value:totals.items, tone:"#4a90d9" },
          { label:"Failed", value:totals.failed, tone:"#e85a3a" },
          { label:"Open Issues", value:totals.issues, tone:"#8b7cf8" },
        ].map(card => (
          <div key={card.label} className="card"><div className="card-body" style={{ padding:"14px 16px" }}><div style={{ fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:6 }}>{card.label}</div><div style={{ fontSize:24,fontWeight:800,color:card.tone }}>{card.value}</div></div></div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:8, flexWrap:"wrap" }}>
        <div style={{ fontSize:13, color:"var(--text2)" }}>Room-based inspections with evidence capture and punchlist tracking</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn btn-sm btn-secondary desktop-only" onClick={() => setEditingTmpl("new")}><Icon d={ic.edit} size={13} /> Manage Templates</button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={13} /> New Checklist</button>
        </div>
      </div>
      {checklists.length === 0 ? (
        <div className="empty"><div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div><h3>No checklists yet</h3><p>Start a checklist from a template or build a room-based inspection with evidence and issues.</p><button className="btn btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={15} /> Start Checklist</button></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {checklists.map(cl => {
            const total = cl.fields?.length || 0;
            const done = cl.fields?.filter(f => f.responseStatus || (f.type==="multi_checkbox" ? f.value?.length > 0 : f.type==="checkbox" ? !!f.value : f.value !== "" && f.value !== null && f.value !== undefined)).length || 0;
            const pct = total > 0 ? Math.round((done/total)*100) : 0;
            const failed = cl.fields.filter(f => f.responseStatus === "fail").length;
            const issues = cl.fields.filter(f => f.issue && f.issue.status !== "resolved").length;
            const evidence = cl.fields.reduce((n, f) => n + (f.photos?.length || 0), 0);
            const roomsUsed = Array.from(new Set(cl.fields.map(f => f.room).filter(Boolean)));
            return (
              <div key={cl.id} className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px" }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:`conic-gradient(var(--accent) ${pct*3.6}deg, var(--surface2) 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><div style={{ width:34, height:34, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--accent)" }}>{pct}%</div></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{cl.name}</div>
                    <div style={{ fontSize:12, color:"var(--text2)" }}>{done}/{total} items · {cl.createdAt}{cl.assignee && <span style={{ marginLeft:8, color:"var(--text3)" }}>· {cl.assignee}</span>}</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                      <span className="tag tag-blue">{roomsUsed.length} room{roomsUsed.length!==1?"s":""}</span>
                      <span className="tag tag-orange">{evidence} evidence</span>
                      {failed > 0 && <span className="tag tag-red">{failed} failed</span>}
                      {issues > 0 && <span className="tag tag-purple">{issues} issue{issues!==1?"s":""}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background: cl.status==="complete" ? "rgba(61,186,126,.15)" : "rgba(43,127,232,.1)", color: cl.status==="complete" ? "#3dba7e" : "var(--accent)" }}>{cl.status==="complete" ? "Complete" : "In Progress"}</span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setActive(cl); setView("run"); }}><Icon d={ic.edit} size={12} /> Open</button>
                    <button className="btn btn-sm btn-danger btn-icon" onClick={() => deleteChecklist(cl.id)}><Icon d={ic.trash} size={12} /></button>
                  </div>
                </div>
                <div style={{ height:3, background:"var(--surface2)" }}><div style={{ height:"100%", width:`${pct}%`, background: pct===100 ? "#3dba7e" : "var(--accent)", transition:"width .3s" }} /></div>
              </div>
            );
          })}
        </div>
      )}
      {showTmplPicker && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowTmplPicker(false)}>
          <div className="modal fade-in" style={{ maxWidth:520 }}>
            <div className="modal-header"><div className="modal-title">Start a Checklist</div><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowTmplPicker(false)}><Icon d={ic.close} size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {templates.map(t => (
                  <div key={t.id} onClick={() => startFromTemplate(t)} style={{ padding:"12px 14px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12, background:"var(--surface2)" }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:"var(--accent-glow)", border:"1px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>ð</div>
                    <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13.5 }}>{t.name}</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{t.desc} · {t.fields.length} fields</div></div>
                    <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                  </div>
                ))}
                <div onClick={startBlank} style={{ padding:"12px 14px", border:"2px dashed var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>â</div>
                  <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13.5 }}>Build Custom Checklist</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>Start from scratch with room routing, evidence, and issues</div></div>
                  <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {editingTmpl && <TemplateManagerModal templates={templates} setTemplates={setTemplates} onClose={() => setEditingTmpl(null)} />}
    </div>
  );
}

function ChecklistRunner({ checklist, project, onSave, onBack }) {
  const _draftKey = `kc_cl_draft_${checklist?.id || 'new'}`;
  const [cl, setCl] = useState(() => {
    // Restore draft progress if available
    try {
      const draft = localStorage.getItem(_draftKey);
      if (draft) {
        const saved = JSON.parse(draft);
        if (saved.id === checklist?.id) return saved;
      }
    } catch {}
    return {
      ...checklist,
      completionSettings: {
        requireSignature: checklist?.completionSettings?.requireSignature ?? true,
        lockAfterComplete: checklist?.completionSettings?.lockAfterComplete ?? true,
        requireCompletedBy: checklist?.completionSettings?.requireCompletedBy ?? true,
        signatureLabel: checklist?.completionSettings?.signatureLabel || "Site Supervisor Signature",
      },
      completion: {
        completedBy: checklist?.completion?.completedBy || "",
        completedTitle: checklist?.completion?.completedTitle || "",
        completionNotes: checklist?.completion?.completionNotes || "",
        signatureImg: checklist?.completion?.signatureImg || null,
      },
      fields: (checklist.fields || []).map(f => ({ ...f, photos: [...(f.photos || [])], issue: f.issue ? { ...f.issue } : null }))
    };
  });
  const [roomFilter, setRoomFilter] = useState("All Items");
  const [showSignatureDraw, setShowSignatureDraw] = useState(false);
  const uploadRefs = useRef({});
  const signatureInputRef = useRef(null);
  const roomOptions = ["All Items", "General", ...(project.rooms || []).map(r => r.name).filter(Boolean)];
  const completionSettings = cl.completionSettings || {};
  const isLocked = cl.status === "complete" && completionSettings.lockAfterComplete !== false;

  const patchField = (id, patch) => setCl(prev => ({ ...prev, fields: prev.fields.map(f => {
    if (f.id !== id) return f;
    const next = { ...f, ...patch };
    if (patch.responseStatus === "fail" && next.createIssueOnFail !== false && !next.issue) next.issue = { id: uid(), title: f.label, assignee:"", dueDate:"", status:"open", notes:"" };
    return next;
  }) }));
  // Auto-save progress to localStorage on every change (large checklists won't lose work)
  useEffect(() => {
    try { localStorage.setItem(_draftKey, JSON.stringify(cl)); } catch {}
  }, [cl]);

  const updateFieldValue = (id, value) => patchField(id, { value });
  const toggleMulti = (id, opt) => {
    const field = cl.fields.find(f => f.id === id);
    const cur = field?.value || [];
    patchField(id, { value: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] });
  };
  const addEvidence = (fieldId, files) => {
    Array.from(files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        setCl(prev => ({ ...prev, fields: prev.fields.map(f => f.id === fieldId ? { ...f, photos: [...(f.photos || []), { id: uid(), name: file.name.replace(/\.[^/.]+$/, ""), dataUrl: e.target.result }] } : f) }));
      };
      reader.readAsDataURL(file);
    });
  };
  const removeEvidence = (fieldId, photoId) => setCl(prev => ({ ...prev, fields: prev.fields.map(f => f.id === fieldId ? { ...f, photos: (f.photos || []).filter(p => p.id !== photoId) } : f) }));
  const updateIssue = (id, patch) => patchField(id, { issue: { id: cl.fields.find(f => f.id === id)?.issue?.id || uid(), title: cl.fields.find(f => f.id === id)?.label || "Checklist issue", assignee:"", dueDate:"", status:"open", notes:"", ...(cl.fields.find(f => f.id === id)?.issue || {}), ...patch } });
  const updateCompletion = (patch) => setCl(prev => ({ ...prev, completion: { ...(prev.completion || {}), ...patch } }));
  const uploadSignature = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => updateCompletion({ signatureImg: e.target.result });
    reader.readAsDataURL(file);
  };

  const complete = cl.fields.filter(f => f.responseStatus || (f.type==="multi_checkbox" ? f.value?.length > 0 : f.type==="checkbox" ? !!f.value : f.value !== "" && f.value !== null && f.value !== undefined)).length;
  const total = cl.fields.length;
  const pct = total > 0 ? Math.round((complete/total)*100) : 0;
  const failedCount = cl.fields.filter(f => f.responseStatus === "fail").length;
  const openIssues = cl.fields.filter(f => f.issue && f.issue.status !== "resolved").length;
  const allReqDone = cl.fields.filter(f => f.required).every(f => !!f.responseStatus || (f.type==="multi_checkbox" ? f.value?.length > 0 : f.type==="checkbox" ? !!f.value : f.value !== "" && f.value !== null));
  const failRequirementsMet = cl.fields.every(f => {
    if (f.responseStatus !== "fail") return true;
    if (f.requireCommentOnFail && !f.comment?.trim()) return false;
    if (f.requireEvidenceOnFail && !(f.photos?.length > 0)) return false;
    return true;
  });
  const completionRequirementsMet = (!completionSettings.requireCompletedBy || !!cl.completion?.completedBy?.trim()) && (!completionSettings.requireSignature || !!cl.completion?.signatureImg);
  const canMarkComplete = allReqDone && failRequirementsMet && completionRequirementsMet;
  const visibleFields = cl.fields.filter(f => roomFilter === "All Items" || (f.room || "General") === roomFilter);
  const groups = visibleFields.reduce((acc, field) => { const room = field.room || "General"; acc[room] = acc[room] || []; acc[room].push(field); return acc; }, {});

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <div style={{ flex:1, minWidth:150 }}><div style={{ fontWeight:700, fontSize:16 }}>{cl.name}</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{complete}/{total} completed · {pct}% · {failedCount} failed · {openIssues} issues</div></div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap" }}>
          {isLocked && <button className="btn btn-sm btn-secondary" onClick={() => setCl(prev => ({ ...prev, status:"in_progress", completedAt:null }))}>Reopen Checklist</button>}
          <button className="btn btn-sm btn-secondary" onClick={() => { try { localStorage.removeItem(_draftKey); } catch {} onSave({ ...cl, status:isLocked ? "complete" : "in_progress" }); }}>Save Draft</button>
          <button className="btn btn-sm btn-primary" disabled={!canMarkComplete} onClick={() => { try { localStorage.removeItem(_draftKey); } catch {} onSave({ ...cl, status:"complete", completedAt:today() }); }}><Icon d={ic.check} size={13} /> Mark Complete</button>
        </div>
      </div>

      <div style={{ height:6, background:"var(--surface2)", borderRadius:3, marginBottom:16, overflow:"hidden" }}><div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#3dba7e":"var(--accent)", transition:"width .3s", borderRadius:3 }} /></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:"12px 16px", display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}><label style={{ fontSize:12, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".04em", whiteSpace:"nowrap" }}>Assigned To</label><input className="form-input" style={{ flex:1 }} placeholder="Inspector name..." value={cl.assignee} disabled={isLocked} onChange={e => setCl(p=>({...p, assignee:e.target.value}))} /></div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}><label style={{ fontSize:12, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".04em", whiteSpace:"nowrap" }}>Room View</label><select className="form-input form-select" style={{ flex:1 }} value={roomFilter} onChange={e => setRoomFilter(e.target.value)}>{roomOptions.filter((v, i, arr) => arr.indexOf(v) === i).map(room => <option key={room}>{room}</option>)}</select></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:12, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Completion Workflow</div>
              <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>
                {completionSettings.requireSignature ? "Signature required" : "Signature optional"} · {completionSettings.lockAfterComplete === false ? "Remains editable" : "Locks after complete"}
              </div>
            </div>
            {cl.completedAt && <span className="tag tag-green">Completed {cl.completedAt}</span>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Completed By{completionSettings.requireCompletedBy && <span style={{ color:"var(--accent)", marginLeft:4 }}>*</span>}</label>
              <input className="form-input" value={cl.completion?.completedBy || ""} disabled={isLocked} onChange={e => updateCompletion({ completedBy: e.target.value })} placeholder="Inspector / supervisor" />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Title / Role</label>
              <input className="form-input" value={cl.completion?.completedTitle || ""} disabled={isLocked} onChange={e => updateCompletion({ completedTitle: e.target.value })} placeholder="Project manager, foreman..." />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom:10 }}>
            <label className="form-label">Completion Notes</label>
            <textarea className="form-input form-textarea" style={{ minHeight:72, resize:"vertical" }} value={cl.completion?.completionNotes || ""} disabled={isLocked} onChange={e => updateCompletion({ completionNotes: e.target.value })} placeholder="Wrap-up notes, approvals, site conditions..." />
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button className="btn btn-sm btn-primary" disabled={isLocked} onClick={() => setShowSignatureDraw(true)}>
              <Icon d={ic.edit} size={12} /> {cl.completion?.signatureImg ? "Draw Again" : "Draw Signature"}
            </button>
            <button className="btn btn-sm btn-secondary" disabled={isLocked} onClick={() => signatureInputRef.current?.click()}>
              <Icon d={ic.upload} size={12} /> {cl.completion?.signatureImg ? "Upload Instead" : "Upload Signature"}
            </button>
            {cl.completion?.signatureImg && !isLocked && <button className="btn btn-sm btn-danger" onClick={() => updateCompletion({ signatureImg: null })}><Icon d={ic.trash} size={12} /> Remove</button>}
            <span style={{ fontSize:11.5, color:"var(--text3)" }}>{completionSettings.requireSignature ? "Required before completion" : "Optional attachment"}</span>
            <input ref={signatureInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { uploadSignature(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {cl.completion?.signatureImg && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11.5, color:"var(--text3)", marginBottom:6 }}>{completionSettings.signatureLabel || "Signature"}</div>
              <div style={{ width:"100%", maxWidth:320, border:"1px solid var(--border)", borderRadius:12, overflow:"hidden", background:"white" }}>
                <img src={cl.completion.signatureImg} alt="Signature" style={{ width:"100%", display:"block", objectFit:"contain" }} />
              </div>
            </div>
          )}
          {!canMarkComplete && (
            <div style={{ marginTop:12, fontSize:12, color:"#e85a3a" }}>
              {!allReqDone ? "Complete all required checklist items before marking complete." : !failRequirementsMet ? "Failed items still need required comments or evidence." : "Completion details are still missing."}
            </div>
          )}
        </div>
      </div>
      {showSignatureDraw && <SignatureDrawModal onSave={dataUrl => { updateCompletion({ signatureImg: dataUrl }); setShowSignatureDraw(false); }} onClose={() => setShowSignatureDraw(false)} />}

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {Object.keys(groups).map(room => (
          <div key={room} style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ fontWeight:800, fontSize:15 }}>{room}</div><span style={{ fontSize:11.5, color:"var(--text3)" }}>{groups[room].length} item{groups[room].length!==1?"s":""}</span></div>
            {groups[room].map((field, i) => {
              const answered = !!field.responseStatus || (field.type==="multi_checkbox" ? field.value?.length>0 : field.type==="checkbox" ? !!field.value : field.value!==""&&field.value!=null);
              const tone = field.responseStatus === "fail" ? "#e85a3a" : field.responseStatus === "pass" ? "#3dba7e" : field.responseStatus === "na" ? "#8b9ab8" : "var(--border)";
              return (
                <div key={field.id} className="card" style={{ borderLeft:`3px solid ${tone}`, overflow:"hidden" }}>
                  <div className="card-body" style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                      <div style={{ width:22, height:22, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text3)", flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>{field.label}{field.required && <span style={{ color:"var(--accent)", marginLeft:4 }}>*</span>}</div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
                          {[{ id:"pass", label:"Pass", tone:"#3dba7e" },{ id:"fail", label:"Fail", tone:"#e85a3a" },{ id:"na", label:"N/A", tone:"#8b9ab8" }].map(opt => (
                            <button key={opt.id} className="btn btn-sm" disabled={isLocked} onClick={() => patchField(field.id, { responseStatus: opt.id })} style={{ background:field.responseStatus===opt.id?`${opt.tone}20`:"var(--surface2)", color:field.responseStatus===opt.id?opt.tone:"var(--text2)", border:`1px solid ${field.responseStatus===opt.id?opt.tone:"var(--border)"}`, padding:"5px 12px", opacity:isLocked?0.65:1 }}>{opt.label}</button>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                          {field.requireCommentOnFail && <span className="tag tag-orange">Comment on fail</span>}
                          {field.requireEvidenceOnFail && <span className="tag tag-blue">Evidence on fail</span>}
                          {field.createIssueOnFail !== false && <span className="tag tag-purple">Punchlist on fail</span>}
                        </div>
                      </div>
                      {answered && <Icon d={ic.check} size={14} stroke="#3dba7e" />}
                    </div>

                    {field.type==="checkbox" && <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:32 }}><input type="checkbox" checked={!!field.value} disabled={isLocked} onChange={e=>updateFieldValue(field.id, e.target.checked)} style={{ width:18,height:18,accentColor:"var(--accent)" }} /><span style={{ fontSize:13, color:"var(--text2)" }}>Confirmed</span></div>}
                    {field.type==="yesno" && <div style={{ display:"flex", gap:8, marginLeft:32, flexWrap:"wrap" }}>{["Yes","No","N/A"].map(opt => <div key={opt} onClick={()=>!isLocked&&updateFieldValue(field.id, opt)} style={{ padding:"6px 20px", borderRadius:"var(--radius-sm)", border:`2px solid ${field.value===opt?"var(--accent)":"var(--border)"}`, background:field.value===opt?"var(--accent-glow)":"var(--surface2)", cursor:isLocked?"default":"pointer", fontSize:13, fontWeight:600, color:field.value===opt?"var(--accent)":"var(--text2)", opacity:isLocked?0.7:1 }}>{opt}</div>)}</div>}
                    {field.type==="multi_checkbox" && <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginLeft:32 }}>{(field.options||[]).map(opt => { const sel = (field.value||[]).includes(opt); return <div key={opt} onClick={()=>!isLocked&&toggleMulti(field.id, opt)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${sel?"var(--accent)":"var(--border)"}`, background:sel?"var(--accent-glow)":"var(--surface2)", cursor:isLocked?"default":"pointer", fontSize:12.5, fontWeight:600, color:sel?"var(--accent)":"var(--text2)", opacity:isLocked?0.7:1 }}>{sel?"✓ ":""}{opt}</div>; })}</div>}
                    {field.type==="dropdown" && <select className="form-input form-select" disabled={isLocked} style={{ marginLeft:32, width:"calc(100% - 32px)" }} value={field.value||""} onChange={e=>updateFieldValue(field.id, e.target.value)}><option value="">— Select —</option>{(field.options||[]).map(o=><option key={o}>{o}</option>)}</select>}
                    {field.type==="text" && <textarea className="form-input form-textarea" disabled={isLocked} style={{ marginLeft:32, minHeight:72, width:"calc(100% - 32px)", resize:"vertical" }} placeholder="Enter your answer..." value={field.value||""} onChange={e=>updateFieldValue(field.id, e.target.value)} />}
                    {field.type==="number" && <input type="number" className="form-input" disabled={isLocked} style={{ marginLeft:32, width:"calc(100% - 32px)" }} placeholder="0" value={field.value||""} onChange={e=>updateFieldValue(field.id, e.target.value)} />}

                    <div style={{ marginLeft:32, marginTop:12, display:"grid", gap:10 }}>
                      <textarea className="form-input form-textarea" disabled={isLocked} style={{ minHeight:64, resize:"vertical", borderColor:field.responseStatus==="fail" && field.requireCommentOnFail && !field.comment?.trim() ? "#e85a3a" : undefined }} placeholder="Comments / observations..." value={field.comment||""} onChange={e=>patchField(field.id, { comment:e.target.value })} />
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                        <button className="btn btn-sm btn-secondary" disabled={isLocked} onClick={() => uploadRefs.current[field.id]?.click()}><Icon d={ic.camera} size={13} /> Add Evidence</button>
                        <input ref={el => uploadRefs.current[field.id] = el} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => { addEvidence(field.id, e.target.files); e.target.value = ""; }} />
                        <span style={{ fontSize:11.5, color:field.responseStatus==="fail" && field.requireEvidenceOnFail && !(field.photos?.length > 0) ? "#e85a3a" : "var(--text3)" }}>{field.photos?.length || 0} photo{(field.photos?.length || 0)!==1?"s":""}</span>
                      </div>
                      {(field.photos?.length || 0) > 0 && <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>{field.photos.map(photo => <div key={photo.id} style={{ width:84, flexShrink:0 }}><div style={{ position:"relative", width:84, height:84, borderRadius:10, overflow:"hidden", border:"1px solid var(--border)" }}><img src={photo.dataUrl} alt={photo.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />{!isLocked && <button className="btn btn-ghost btn-sm btn-icon" style={{ position:"absolute", top:4, right:4, width:22, height:22, background:"rgba(0,0,0,.55)" }} onClick={() => removeEvidence(field.id, photo.id)}><Icon d={ic.close} size={10} stroke="white" /></button>}</div></div>)}</div>}
                      {field.responseStatus === "fail" && field.createIssueOnFail !== false && (
                        <div style={{ padding:"12px 14px", borderRadius:12, border:"1px solid #e85a3a33", background:"#e85a3a14" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:10, flexWrap:"wrap" }}><div style={{ fontSize:12.5, fontWeight:700, color:"#e85a3a" }}>Punchlist Issue</div><select className="form-input form-select" disabled={isLocked} style={{ maxWidth:150, fontSize:12.5 }} value={field.issue?.status || "open"} onChange={e => updateIssue(field.id, { status:e.target.value })}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select></div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8 }}><input className="form-input" disabled={isLocked} placeholder="Assign to" value={field.issue?.assignee || ""} onChange={e => updateIssue(field.id, { assignee:e.target.value })} /><input type="date" className="form-input" disabled={isLocked} value={field.issue?.dueDate || ""} onChange={e => updateIssue(field.id, { dueDate:e.target.value })} /></div>
                          <textarea className="form-input form-textarea" disabled={isLocked} style={{ minHeight:60, marginTop:8, fontSize:12.5 }} placeholder="Issue notes / required action..." value={field.issue?.notes || ""} onChange={e => updateIssue(field.id, { notes:e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {cl.fields.length === 0 && <div className="empty"><div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div><h3>No fields</h3><p>This checklist has no fields yet. Edit it to add some.</p></div>}
    </div>
  );
}

function ChecklistBuilder({ checklist, rooms = [], onSave, onBack }) {
  const [cl, setCl] = useState({
    ...checklist,
    completionSettings: {
      requireSignature: checklist?.completionSettings?.requireSignature ?? true,
      lockAfterComplete: checklist?.completionSettings?.lockAfterComplete ?? true,
      requireCompletedBy: checklist?.completionSettings?.requireCompletedBy ?? true,
      signatureLabel: checklist?.completionSettings?.signatureLabel || "Site Supervisor Signature",
    },
    fields: (checklist.fields || []).map(f => ({
      ...f,
      room: f.room || "General",
      requireCommentOnFail: f.requireCommentOnFail ?? false,
      requireEvidenceOnFail: f.requireEvidenceOnFail ?? false,
      createIssueOnFail: f.createIssueOnFail ?? true,
    }))
  });
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ type:"checkbox", label:"", options:"", required:false, room:"General", requireCommentOnFail:false, requireEvidenceOnFail:false, createIssueOnFail:true });
  const roomOptions = ["General", ...rooms.filter((v, i, arr) => v && arr.indexOf(v) === i)];
  const addField = () => {
    if (!newField.label.trim()) return;
    const f = { id: uid(), type:newField.type, label:newField.label.trim(), required:newField.required, room:newField.room || "General", requireCommentOnFail:newField.requireCommentOnFail, requireEvidenceOnFail:newField.requireEvidenceOnFail, createIssueOnFail:newField.createIssueOnFail, options: ["multi_checkbox","dropdown"].includes(newField.type) ? newField.options.split("\n").map(s=>s.trim()).filter(Boolean) : undefined, value: newField.type==="multi_checkbox" ? [] : newField.type==="checkbox" ? false : "", responseStatus: "", comment: "", photos: [], issue: null };
    setCl(p=>({...p, fields:[...(p.fields||[]), f]}));
    setNewField({ type:"checkbox", label:"", options:"", required:false, room:"General", requireCommentOnFail:false, requireEvidenceOnFail:false, createIssueOnFail:true });
    setAddingField(false);
  };
  const removeField = id => setCl(p=>({...p, fields:(p.fields||[]).filter(f=>f.id!==id)}));
  const moveField = (id, dir) => {
    const idx = (cl.fields || []).findIndex(f=>f.id===id); if (idx<0) return;
    const arr = [...cl.fields];
    const swap = idx+dir;
    if (swap<0||swap>=arr.length) return;
    [arr[idx],arr[swap]]=[arr[swap],arr[idx]];
    setCl(p=>({...p,fields:arr}));
  };
  const needsOptions = ["multi_checkbox","dropdown"].includes(newField.type);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <input className="form-input" style={{ flex:1, fontWeight:700, fontSize:15 }} value={cl.name} onChange={e=>setCl(p=>({...p,name:e.target.value}))} placeholder="Checklist name..." />
        <button className="btn btn-sm btn-primary" disabled={!cl.name?.trim()||(cl.fields||[]).length===0} onClick={()=>onSave(cl)}><Icon d={ic.check} size={13} /> Save Checklist</button>
      </div>
      <div className="card" style={{ marginBottom:14 }}>
        <div className="card-body" style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>Completion Workflow</div>
          <div style={{ display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
              <input type="checkbox" checked={!!cl.completionSettings?.requireCompletedBy} onChange={e=>setCl(p=>({...p, completionSettings:{ ...(p.completionSettings||{}), requireCompletedBy:e.target.checked }}))} style={{ accentColor:"var(--accent)" }} />
              Require completed by name
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
              <input type="checkbox" checked={!!cl.completionSettings?.requireSignature} onChange={e=>setCl(p=>({...p, completionSettings:{ ...(p.completionSettings||{}), requireSignature:e.target.checked }}))} style={{ accentColor:"var(--accent)" }} />
              Require signature before closeout
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
              <input type="checkbox" checked={!!cl.completionSettings?.lockAfterComplete} onChange={e=>setCl(p=>({...p, completionSettings:{ ...(p.completionSettings||{}), lockAfterComplete:e.target.checked }}))} style={{ accentColor:"var(--accent)" }} />
              Lock checklist after completion
            </label>
          </div>
          <div className="form-group" style={{ marginTop:10, marginBottom:0 }}>
            <label className="form-label">Signature Label</label>
            <input className="form-input" value={cl.completionSettings?.signatureLabel || ""} onChange={e=>setCl(p=>({...p, completionSettings:{ ...(p.completionSettings||{}), signatureLabel:e.target.value }}))} placeholder="Site supervisor signature" />
          </div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {(cl.fields||[]).map((f, i) => (
          <div key={f.id} className="card" style={{ padding:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <button onClick={()=>moveField(f.id,-1)} disabled={i===0} style={{ background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>â²</button>
                <button onClick={()=>moveField(f.id,1)} disabled={i===(cl.fields||[]).length-1} style={{ background:"none",border:"none",cursor:i===(cl.fields||[]).length-1?"default":"pointer",color:i===(cl.fields||[]).length-1?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>â¼</button>
              </div>
              <div style={{ width:28, height:28, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{FIELD_TYPES.find(t=>t.id===f.type)?.icon || "?"}</div>
              <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:600 }}>{f.label}{f.required && <span style={{ color:"var(--accent)",marginLeft:4 }}>*</span>}</div><div style={{ fontSize:11.5, color:"var(--text3)", marginTop:1 }}>{FIELD_TYPES.find(t=>t.id===f.type)?.label}{f.options?.length > 0 && ` · ${f.options.length} options`}{` · ${f.room || "General"}`}</div><div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>{f.requireCommentOnFail && <span className="tag tag-orange">Comment on fail</span>}{f.requireEvidenceOnFail && <span className="tag tag-blue">Evidence on fail</span>}{f.createIssueOnFail !== false && <span className="tag tag-purple">Punchlist on fail</span>}</div></div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>removeField(f.id)}><Icon d={ic.trash} size={13} stroke="#ff6b6b" /></button>
            </div>
          </div>
        ))}
        {(cl.fields||[]).length===0 && <div style={{ textAlign:"center",padding:"24px 0",color:"var(--text3)",fontSize:13 }}>No fields yet — add one below</div>}
      </div>
      {!addingField ? (
        <button className="btn btn-secondary" style={{ width:"100%", justifyContent:"center", borderStyle:"dashed" }} onClick={()=>setAddingField(true)}><Icon d={ic.plus} size={14} /> Add Field</button>
      ) : (
        <div className="card" style={{ border:"1.5px solid var(--accent)" }}>
          <div className="card-body" style={{ padding:"16px" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"var(--accent)" }}>New Field</div>
            <div className="form-group"><label className="form-label">Field Type</label><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{FIELD_TYPES.map(ft => <div key={ft.id} onClick={()=>setNewField(p=>({...p,type:ft.id}))} style={{ padding:"6px 12px", borderRadius:"var(--radius-sm)", border:`1.5px solid ${newField.type===ft.id?"var(--accent)":"var(--border)"}`, background:newField.type===ft.id?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color:newField.type===ft.id?"var(--accent)":"var(--text2)", display:"flex", gap:5, alignItems:"center" }}><span style={{ fontSize:13 }}>{ft.icon}</span>{ft.label}</div>)}</div></div>
            <div className="form-group"><label className="form-label">Field Label</label><input className="form-input" placeholder="e.g. Was PPE worn by all personnel?" value={newField.label} onChange={e=>setNewField(p=>({...p,label:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Room / Area</label><select className="form-input form-select" value={newField.room} onChange={e=>setNewField(p=>({...p,room:e.target.value}))}>{roomOptions.map(room => <option key={room}>{room}</option>)}</select></div>
            {needsOptions && <div className="form-group"><label className="form-label">Options <span style={{ fontWeight:400, color:"var(--text3)" }}>(one per line)</span></label><textarea className="form-input form-textarea" style={{ minHeight:90, fontSize:13 }} placeholder={"Option 1\nOption 2\nOption 3"} value={newField.options} onChange={e=>setNewField(p=>({...p,options:e.target.value}))} /></div>}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}><input type="checkbox" id="req_cb_v2" checked={newField.required} onChange={e=>setNewField(p=>({...p,required:e.target.checked}))} style={{ accentColor:"var(--accent)" }} /><label htmlFor="req_cb_v2" style={{ fontSize:13, cursor:"pointer" }}>Required field</label></div>
            <div style={{ display:"grid", gap:8, marginBottom:14 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
                <input type="checkbox" checked={newField.requireCommentOnFail} onChange={e=>setNewField(p=>({...p,requireCommentOnFail:e.target.checked}))} style={{ accentColor:"var(--accent)" }} />
                Require comment when failed
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
                <input type="checkbox" checked={newField.requireEvidenceOnFail} onChange={e=>setNewField(p=>({...p,requireEvidenceOnFail:e.target.checked}))} style={{ accentColor:"var(--accent)" }} />
                Require photo evidence when failed
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
                <input type="checkbox" checked={newField.createIssueOnFail} onChange={e=>setNewField(p=>({...p,createIssueOnFail:e.target.checked}))} style={{ accentColor:"var(--accent)" }} />
                Auto-create punchlist issue when failed
              </label>
            </div>
            <div style={{ display:"flex", gap:8 }}><button className="btn btn-secondary btn-sm" onClick={()=>setAddingField(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={addField} disabled={!newField.label.trim()}><Icon d={ic.plus} size={12} /> Add Field</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const BUILT_IN_CATEGORIES = ["General","Water Damage","Safety","Fire","Mold","Structural","Electrical","HVAC","Roofing","Flood","Contents"];

function TemplateManagerModal({ templates, setTemplates, onClose }) {
  const [editing, setEditing] = useState(null);
  const [newTmplName, setNewTmplName] = useState("");
  const [tmplSearch, setTmplSearch] = useState("");
  const [tmplCategory, setTmplCategory] = useState("All");
  // Local tags string — decoupled from the parsed array so commas work freely
  const [tagsInput, setTagsInput] = useState("");
  const [customCatInput, setCustomCatInput] = useState("");
  // Custom categories — seeded from localStorage cache, then overwritten by Supabase on load
  const [customCats, setCustomCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kc_cl_custom_cats") || "[]"); } catch { return []; }
  });

  const [hiddenBuiltIn, setHiddenBuiltIn] = useState([]);
  const [orgId, setOrgId] = useState(null);

  // Load categories from Supabase on mount
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data?.session?.user?.id;
      if (!uid) return;
      const headers = await getAuthHeaders();
      fetch(`${url}/rest/v1/profiles?user_id=eq.${uid}&select=organization_id`, { headers })
        .then(r => r.json()).then(async rows => {
          const oid = rows?.[0]?.organization_id;
          if (!oid) return;
          setOrgId(oid);
          const headers2 = await getAuthHeaders();
          fetch(`${url}/rest/v1/checklist_categories?organization_id=eq.${oid}&select=custom_cats,hidden_cats`, { headers: headers2 })
            .then(r => r.json()).then(data => {
              if (data?.[0]) {
                setCustomCats(data[0].custom_cats || []);
                setHiddenBuiltIn(data[0].hidden_cats || []);
              }
            }).catch(() => {});
        }).catch(() => {});
    }).catch(() => {});
  }, []);

  const persistCats = async (custom, hidden, oid) => {
    if (!oid) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' });
    fetch(`${url}/rest/v1/checklist_categories?on_conflict=organization_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organization_id: oid, custom_cats: custom, hidden_cats: hidden, updated_at: new Date().toISOString() }),
    }).catch(() => {});
    // Also keep localStorage as fast local cache
    localStorage.setItem("kc_cl_custom_cats", JSON.stringify(custom));
    localStorage.setItem("kc_cl_hidden_cats",  JSON.stringify(hidden));
  };

  const allCats = [
    ...BUILT_IN_CATEGORIES.filter(c => !hiddenBuiltIn.includes(c)),
    ...customCats.filter(c => !BUILT_IN_CATEGORIES.includes(c)),
  ];

  const saveCustomCat = (cat) => {
    if (!cat.trim() || allCats.includes(cat.trim())) return;
    const updated = [...customCats, cat.trim()];
    setCustomCats(updated);
    persistCats(updated, hiddenBuiltIn, orgId);
  };

  const removeCategory = (cat) => {
    const isBuiltIn = BUILT_IN_CATEGORIES.includes(cat);
    let newCustom = customCats, newHidden = hiddenBuiltIn;
    if (isBuiltIn) {
      newHidden = [...hiddenBuiltIn, cat];
      setHiddenBuiltIn(newHidden);
    } else {
      newCustom = customCats.filter(c => c !== cat);
      setCustomCats(newCustom);
    }
    persistCats(newCustom, newHidden, orgId);
    if (tmplCategory === cat) setTmplCategory("All");
    if (editing?.category === cat) setEditing(p => ({...p, category:"General"}));
  };

  const restoreBuiltIn = (cat) => {
    const updated = hiddenBuiltIn.filter(c => c !== cat);
    setHiddenBuiltIn(updated);
    persistCats(customCats, updated, orgId);
  };

  const openEdit = (t) => {
    setEditing({...t});
    setTagsInput((t.tags||[]).join(", "));
    setCustomCatInput("");
  };

  const startNew = () => {
    const blank = { id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); })), name:"", desc:"", category:"General", tags:[], completionSettings:{ requireSignature:true, lockAfterComplete:true, requireCompletedBy:true, signatureLabel:"Site Supervisor Signature" }, fields:[] };
    setEditing(blank);
    setTagsInput("");
    setCustomCatInput("");
  };

  const upsertTmplDB = async (tmpl, oid) => {
    if (!oid) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const headers = await getAuthHeaders({ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' });
    fetch(`${url}/rest/v1/checklist_templates?on_conflict=id`, {
      method: 'POST', headers,
      body: JSON.stringify({ id: tmpl.id, organization_id: oid, name: tmpl.name || '', description: tmpl.desc || '', category: tmpl.category || 'General', tags: tmpl.tags || [], fields: tmpl.fields || [], completion_settings: tmpl.completionSettings || {}, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  };

  const deleteTmplDB = async (id, oid) => {
    if (!oid) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const headers = await getAuthHeaders();
    fetch(`${url}/rest/v1/checklist_templates?id=eq.${id}`, { method: 'DELETE', headers }).catch(() => {});
  };

  const saveTmpl = (t) => {
    // Parse tags from the local string input at save time
    const parsedTags = tagsInput.split(",").map(s=>s.trim()).filter(Boolean);
    const withMeta = { ...t, tags: parsedTags, category: editing?.category || t.category || "General" };
    setTemplates(prev => prev.find(x=>x.id===withMeta.id) ? prev.map(x=>x.id===withMeta.id?withMeta:x) : [...prev,withMeta]);
    upsertTmplDB(withMeta, orgId);
    setEditing(null);
  };
  const deleteTmpl = (id) => {
    setTemplates(prev => prev.filter(t=>t.id!==id));
    deleteTmplDB(id, orgId);
  };

  if (editing) return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditing(null)}>
      <div className="modal fade-in modal-lg" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <div className="modal-title">{editing.name||"New Template"}</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setEditing(null)}><Icon d={ic.close} size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight:"60vh", overflowY:"auto" }}>
          <div className="form-group"><label className="form-label">Template Name</label><input className="form-input" value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} placeholder="e.g. Fire Damage Walkthrough" /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={editing.desc||""} onChange={e=>setEditing(p=>({...p,desc:e.target.value}))} placeholder="Short description…" /></div>
          <div style={{ display:"flex", gap:10, marginBottom:6 }}>
            <div className="form-group" style={{ flex:1, marginBottom:0 }}>
              <label className="form-label">Category</label>
              <select className="form-input form-select" value={editing.category||"General"}
                onChange={e => setEditing(p=>({...p, category: e.target.value}))}>
                {allCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:1, marginBottom:0 }}>
              <label className="form-label">Tags <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400 }}>(comma separated)</span></label>
              <input className="form-input"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="insurance, restoration, mold"
              />
            </div>
          </div>
          {/* Add custom category */}
          <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
            <input className="form-input" style={{ flex:1, fontSize:12 }}
              value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
              placeholder="Add custom category…"
              onKeyDown={e=>{ if(e.key==="Enter"){ saveCustomCat(customCatInput); setEditing(p=>({...p,category:customCatInput.trim()})); setCustomCatInput(""); }}}
            />
            <button className="btn btn-secondary btn-sm" disabled={!customCatInput.trim()} onClick={()=>{ saveCustomCat(customCatInput); setEditing(p=>({...p,category:customCatInput.trim()})); setCustomCatInput(""); }}>
              + Add Category
            </button>
          </div>
          <ChecklistBuilder checklist={editing} onSave={saveTmpl} onBack={()=>setEditing(null)} />
        </div>
      </div>
    </div>
  );

  const allCategories = ["All", ...Array.from(new Set(templates.map(t => t.category || "General").filter(Boolean)))];
  const filteredTmpls = templates.filter(t => {
    const q = tmplSearch.trim().toLowerCase();
    const matchCat = tmplCategory === "All" || (t.category || "General") === tmplCategory;
    const matchSearch = !q ||
      t.name.toLowerCase().includes(q) ||
      (t.desc||"").toLowerCase().includes(q) ||
      (t.tags||[]).some(tag => tag.toLowerCase().includes(q)) ||
      (t.category||"").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const CATEGORY_COLORS = {
    "General":"#4a90d9","Water Damage":"#3ab8e8","Safety":"#e8703a",
    "Fire":"#e85a3a","Mold":"#3dba7e","Structural":"#8b7cf8",
    "Electrical":"#f0c040","HVAC":"#4ec9b0","Roofing":"#c792ea",
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div className="modal-title">Checklist Templates</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>
        <div className="modal-body" style={{ paddingBottom:0 }}>
          {/* Search + category filter */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input className="form-input" placeholder="Search templates or tags…" value={tmplSearch} onChange={e=>setTmplSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setTmplCategory(cat)}
                style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                  background: tmplCategory===cat ? (CATEGORY_COLORS[cat]||"var(--accent)") : "var(--surface3)",
                  color: tmplCategory===cat ? "white" : "var(--text2)" }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto", paddingBottom:8 }}>
            {filteredTmpls.length === 0 && (
              <div style={{ textAlign:"center", padding:"24px", color:"var(--text3)", fontSize:13 }}>No templates match your search.</div>
            )}
            {filteredTmpls.map(t => {
              const catColor = CATEGORY_COLORS[t.category||"General"] || "var(--accent)";
              return (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"var(--surface2)", borderLeft:`3px solid ${catColor}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, fontSize:13 }}>{t.name}</span>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${catColor}22`, color:catColor, fontWeight:600, border:`1px solid ${catColor}44` }}>{t.category||"General"}</span>
                    </div>
                    <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:2 }}>{t.fields.length} fields · {t.desc}</div>
                    {(t.tags||[]).length > 0 && (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                        {(t.tags||[]).map(tag => (
                          <span key={tag} style={{ fontSize:10, padding:"1px 6px", borderRadius:8, background:"var(--surface3)", color:"var(--text3)", border:"1px solid var(--border)" }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(t)}><Icon d={ic.edit} size={12} /></button>
                    {!t.id.startsWith("tmpl_general")&&!t.id.startsWith("tmpl_water")&&!t.id.startsWith("tmpl_ppe") && (
                      <button className="btn btn-sm btn-danger btn-icon" onClick={()=>deleteTmpl(t.id)}><Icon d={ic.trash} size={12} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Manage categories section */}
        <div style={{ borderTop:"1px solid var(--border)", padding:"12px 20px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:8 }}>ð Manage Categories</div>
          {/* Active categories with remove button */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
            {allCats.map(cat => {
              const color = CATEGORY_COLORS[cat] || "var(--accent)";
              return (
                <div key={cat} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px 3px 10px", borderRadius:20, background:`${color}18`, border:`1px solid ${color}44`, fontSize:11, fontWeight:600, color }}>
                  {cat}
                  <button onClick={() => removeCategory(cat)} title={`Remove ${cat}`}
                    style={{ background:"none", border:"none", cursor:"pointer", color, opacity:.7, fontSize:13, lineHeight:1, padding:"0 1px", display:"flex", alignItems:"center" }}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1}
                    onMouseLeave={e=>e.currentTarget.style.opacity=0.7}>×</button>
                </div>
              );
            })}
          </div>
          {/* Restore hidden built-ins */}
          {hiddenBuiltIn.length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
              <span style={{ fontSize:11, color:"var(--text3)" }}>Hidden:</span>
              {hiddenBuiltIn.map(cat => (
                <button key={cat} onClick={() => restoreBuiltIn(cat)}
                  style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, border:"1px dashed var(--border)", background:"transparent", color:"var(--text3)", cursor:"pointer" }}>
                  + {cat}
                </button>
              ))}
            </div>
          )}
          {/* Add new custom category */}
          <div style={{ display:"flex", gap:8 }}>
            <input className="form-input" style={{ flex:1, fontSize:12, height:32 }}
              value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
              placeholder="Add new category…"
              onKeyDown={e=>{ if(e.key==="Enter" && customCatInput.trim()){ saveCustomCat(customCatInput); setCustomCatInput(""); }}}
            />
            <button className="btn btn-secondary btn-sm" disabled={!customCatInput.trim()} onClick={()=>{ saveCustomCat(customCatInput); setCustomCatInput(""); }}>
              + Add
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={startNew}><Icon d={ic.plus} size={13} /> New Template</button>
        </div>
      </div>
    </div>
  );
}

// ── Reports Tab (with multi-select + email send) ──────────────────────────────
export function ReportsTab({ project, onUpdateProject, onOpenReportCreator, settings }) {
  const [selected,    setSelected]    = useState(new Set());
  const [showEmail,   setShowEmail]   = useState(false);
  const [search,      setSearch]      = useState("");

  const reports = project.reports || [];
  const filteredReports = reports.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.title, r.reportType, r.type, r.status, r.date, r.lastSentTo].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const visibleSelectedCount = filteredReports.filter(r => selected.has(r.id)).length;
  const toggleAll = () => setSelected(
    visibleSelectedCount === filteredReports.length
      ? new Set([...selected].filter(id => !filteredReports.some(r => r.id === id)))
      : new Set([...selected, ...filteredReports.map(r=>r.id)])
  );

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10 }}>
        <div style={{ fontSize:13,color:"var(--text2)" }}>{filteredReports.length} of {reports.length} report{reports.length!==1?"s":""}{selected.size>0&&<span style={{ marginLeft:8,color:"var(--accent)",fontWeight:600 }}> · {selected.size} selected</span>}</div>
        <div style={{ display:"flex",gap:8 }}>
          {REPORT_EMAIL_FEATURE_VISIBLE && selected.size > 0 && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowEmail(true)}>
              <Icon d={ic.mail} size={13} /> Send {selected.size} Report{selected.size>1?"s":""} via Email
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onOpenReportCreator(project, null)}>
            <Icon d={ic.plus} size={13} /> New Report
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.reports} size={28} stroke="var(--text3)" /></div>
          <h3>No reports yet</h3>
          <p>Create a report to compile photos and information for insurance, contractors, or inspections.</p>
          <button className="btn btn-primary" onClick={() => onOpenReportCreator(project, null)}>
            <Icon d={ic.plus} size={15} /> Create Report
          </button>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports by title, type, date, status, or recipient" style={{ marginBottom:4 }} />
          {/* Select all row */}
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 2px",borderBottom:"1px solid var(--border)",marginBottom:4 }}>
            <input type="checkbox" checked={visibleSelectedCount===filteredReports.length&&filteredReports.length>0} onChange={toggleAll} style={{ accentColor:"var(--accent)",width:15,height:15,cursor:"pointer" }} />
            <span style={{ fontSize:12,color:"var(--text3)" }}>Select all</span>
            {REPORT_EMAIL_FEATURE_VISIBLE && selected.size > 0 && (
              <button className="btn btn-sm btn-secondary" style={{ marginLeft:"auto" }} onClick={() => setShowEmail(true)}>
                <Icon d={ic.mail} size={12} /> Send Selected via Email
              </button>
            )}
          </div>

          {filteredReports.length === 0 ? (
            <div style={{ padding:"24px 16px",border:"1px dashed var(--border)",borderRadius:12,textAlign:"center",fontSize:13,color:"var(--text2)" }}>
              No reports match your search.
            </div>
          ) : filteredReports.map(r => (
            <div key={r.id} className="report-row" style={{ borderLeft:`3px solid ${selected.has(r.id)?"var(--accent)":"transparent"}`, transition:"border-color .15s" }}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)}
                style={{ accentColor:"var(--accent)",width:15,height:15,cursor:"pointer",flexShrink:0 }} />
              <div className="report-row-icon" style={{ background:(r.color||"#4a90d9")+"20" }}>
                <Icon d={ic.reports} size={16} stroke={r.color||"#4a90d9"} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:2 }}>{r.title}</div>
                <div style={{ fontSize:12,color:"var(--text2)" }}>
                  {r.reportType||r.type} · {r.date} · {r.photos||0} photo{r.photos!==1?"s":""}
                  {r.lastSentTo && <span style={{ marginLeft:8,color:"var(--text3)" }}>· Last sent to {r.lastSentTo}</span>}
                </div>
              </div>
              <span className={`tag tag-${r.status==="sent"?"green":r.status==="final"?"blue":r.status==="review"?"purple":"orange"}`}>{r.status}</span>
              <div className="report-row-actions">
                {REPORT_EMAIL_FEATURE_VISIBLE && (
                  <button className="btn btn-sm btn-secondary" title="Send via email" onClick={()=>{ setSelected(new Set([r.id])); setShowEmail(true); }}>
                    <Icon d={ic.mail} size={12} />
                  </button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => onOpenReportCreator(project, r)}>
                  <Icon d={ic.edit} size={12} /> Open
                </button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => onUpdateProject({ ...project, reports: project.reports.filter(x => x.id !== r.id) })}>
                  <Icon d={ic.trash} size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {REPORT_EMAIL_FEATURE_VISIBLE && showEmail && (
        <SendEmailModal
          project={project}
          reports={reports.filter(r => selected.has(r.id))}
          settings={settings}
          onClose={() => setShowEmail(false)}
          onSent={(reportIds, sentTo) => {
            const updated = { ...project, reports: project.reports.map(r =>
              reportIds.includes(r.id) ? { ...r, status:"sent", lastSentTo: sentTo } : r
            )};
            onUpdateProject(updated);
            setSelected(new Set());
            setShowEmail(false);
          }}
        />
      )}
    </div>
  );
}

// ── Send Email Modal ───────────────────────────────────────────────────────────
function SendEmailModal({ project, reports, settings, onClose, onSent }) {
  const interpolate = (str, recipient) => (str||"")
    .replace(/{{company}}/g,     settings?.companyName||"")
    .replace(/{{project}}/g,     project.title||"")
    .replace(/{{address}}/g,     [project.address,project.city,project.state].filter(Boolean).join(", ")||"")
    .replace(/{{recipient}}/g,   recipient||"")
    .replace(/{{date}}/g,        formatDate(new Date().toISOString().slice(0,10), settings))
    .replace(/{{inspector}}/g,   `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim())
    .replace(/{{reports_list}}/g, reports.map(r=>`  â¢ ${r.title} (${r.reportType||r.type})`).join("\n"));

  const QUICK_RECIPIENTS = [
    project.clientName    && project.clientEmail    ? { label:`Client — ${project.clientName}`,    email:project.clientEmail,    name:project.clientName }    : null,
    project.adjusterName  && project.adjusterEmail  ? { label:`Adjuster — ${project.adjusterName}`,email:project.adjusterEmail,  name:project.adjusterName }  : null,
    project.insuranceCarrier                         ? { label:`Carrier — ${project.insuranceCarrier}`, email:"",                name:project.insuranceCarrier } : null,
  ].filter(Boolean);

  const [toList,    setToList]    = useState(QUICK_RECIPIENTS.length>0 ? [QUICK_RECIPIENTS[0]] : [{ label:"Custom", email:"", name:"" }]);
  const [customEmail, setCustomEmail] = useState("");
  const [customName,  setCustomName]  = useState("");
  const [subject,   setSubject]   = useState(() => interpolate(settings?.emailSubject || "Report from {{company}} — {{project}}", QUICK_RECIPIENTS[0]?.name||""));
  const [body,      setBody]      = useState(() => interpolate(settings?.emailBody || "Hello {{recipient}},\n\nPlease find attached the reports for {{project}}.\n\n{{reports_list}}\n\nBest regards,", QUICK_RECIPIENTS[0]?.name||""));
  const [activeTab, setActiveTab] = useState("compose"); // compose | preview

  const sig = settings ? buildSignature(settings) : "";

  const addQuick = (r) => { if (!toList.find(t=>t.email===r.email)) setToList(p=>[...p,r]); };
  const addCustom = () => {
    if (!customEmail.trim()) return;
    setToList(p=>[...p,{ label:customName||customEmail, email:customEmail.trim(), name:customName||customEmail }]);
    setCustomEmail(""); setCustomName("");
  };
  const removeRecipient = (email) => setToList(p=>p.filter(r=>r.email!==email));

  const handleSend = () => {
    const allEmails = toList.map(r=>r.email).filter(Boolean);
    if (allEmails.length===0) { alert("Add at least one recipient email address."); return; }
    const fullBody = `${body}\n\n${sig}`;
    const mailto = `mailto:${allEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    window.open(mailto, "_blank");
    onSent(reports.map(r=>r.id), toList.map(r=>r.name||r.email).join(", "));
  };

  const previewHtml = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:600px;padding:20px;">
      <p><strong>To:</strong> ${toList.map(r=>r.email||r.name).join(", ")||"—"}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr style="border:1px solid #eee;margin:12px 0"/>
      <div style="white-space:pre-wrap">${body}</div>
      <hr style="border:1px solid #eee;margin:16px 0"/>
      ${sig.replace(/\n/g,"<br/>")}
    </div>`;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in modal-lg" style={{ maxWidth:660,maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.mail} size={16} /> Send Report{reports.length>1?"s":""} via Email</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display:"flex",borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {["compose","preview"].map(t=>(
            <button key={t} className="btn btn-ghost btn-sm"
              style={{ borderBottom:`2px solid ${activeTab===t?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,color:activeTab===t?"var(--accent)":"var(--text2)",fontWeight:activeTab===t?700:500,textTransform:"capitalize" }}
              onClick={()=>setActiveTab(t)}>{t==="compose"?"â Compose":"ð Preview"}</button>
          ))}
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6,paddingBottom:8 }}>
            <span style={{ fontSize:11.5,color:"var(--text3)" }}>Sending:</span>
            {reports.map(r=>(
              <span key={r.id} style={{ fontSize:11.5,padding:"2px 8px",borderRadius:10,background:"var(--accent-glow)",color:"var(--accent)",fontWeight:600,border:"1px solid var(--accent)" }}>{r.title}</span>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{ flex:1,overflowY:"auto" }}>
          {activeTab==="compose" ? (
            <div>
              {/* Recipients */}
              <div className="form-group">
                <label className="form-label">Recipients</label>
                {/* Quick-add pills */}
                {QUICK_RECIPIENTS.length>0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {QUICK_RECIPIENTS.map(r=>{
                      const added = toList.find(t=>t.email===r.email);
                      return (
                        <div key={r.email} onClick={()=>added?removeRecipient(r.email):addQuick(r)}
                          style={{ padding:"5px 12px",borderRadius:20,border:`1.5px solid ${added?"var(--accent)":"var(--border)"}`,background:added?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",fontSize:12.5,fontWeight:600,color:added?"var(--accent)":"var(--text2)",transition:"all .15s",userSelect:"none" }}>
                          {added?"✓ ":""}{r.label}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Added recipients */}
                {toList.length>0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {toList.map(r=>(
                      <div key={r.email||r.name} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,background:"var(--surface2)",border:"1px solid var(--border)",fontSize:12.5 }}>
                        <span style={{ fontWeight:600 }}>{r.name||r.email}</span>
                        {r.email && <span style={{ color:"var(--text3)" }}>&lt;{r.email}&gt;</span>}
                        <button onClick={()=>removeRecipient(r.email)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:0,lineHeight:1,fontSize:14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Custom email */}
                <div style={{ display:"flex",gap:8 }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Name (optional)" value={customName} onChange={e=>setCustomName(e.target.value)} />
                  <input className="form-input" style={{ flex:2 }} placeholder="email@address.com" value={customEmail} onChange={e=>setCustomEmail(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addCustom()} />
                  <button className="btn btn-secondary btn-sm" onClick={addCustom}><Icon d={ic.plus} size={13} /> Add</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={subject} onChange={e=>setSubject(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Message Body</label>
                <textarea className="form-input form-textarea" style={{ minHeight:160,fontSize:13,fontFamily:"inherit",lineHeight:1.7,resize:"vertical" }}
                  value={body} onChange={e=>setBody(e.target.value)} />
              </div>

              {/* Signature preview */}
              <div style={{ padding:"12px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",borderLeft:"3px solid var(--border)",fontSize:12.5 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8 }}>Signature (from Settings → Email)</div>
                <div style={{ color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{sig||"No signature configured — add one in Settings → Email"}</div>
              </div>
            </div>
          ) : (
            <div style={{ background:"white",borderRadius:"var(--radius-sm)",overflow:"hidden" }}
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend}>
            <Icon d={ic.mail} size={13} /> Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Videos Tab ────────────────────────────────────────────────────────────────
export function VideosTab({ project, onUpdateProject, onOpenCamera, orgId }) {
  const videos = project.videos || [];
  const [playing,      setPlaying]      = useState(null);
  const [editingVid,   setEditingVid]   = useState(null);
  const [confirmDel,   setConfirmDel]   = useState(null); // null | video obj | "batch"
  const [filterRoom,   setFilterRoom]   = useState("all");
  const [selectMode,   setSelectMode]   = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());

  const rooms = ["all", ...(project.rooms?.map(r => r.name) || [])];
  const filtered = filterRoom === "all" ? videos : videos.filter(v => v.room === filterRoom);

  const fmtTime = s => {
    if (!s && s !== 0) return "";
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  };

  const toggleSelect = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteVideo = (id) => {
    const vid = videos.find(v => v.id === id);
    onUpdateProject({ ...project, videos: videos.filter(v => v.id !== id) });
    if (playing === id) setPlaying(null);
    setConfirmDel(null);
    // Remove from Supabase
    if (vid?.supabaseId) dbDeleteVideo(vid.supabaseId, vid.storagePath).catch(() => {});
  };

  const deleteBatch = () => {
    const toDelete = videos.filter(v => selectedIds.has(v.id));
    onUpdateProject({ ...project, videos: videos.filter(v => !selectedIds.has(v.id)) });
    if (selectedIds.has(playing)) setPlaying(null);
    toDelete.forEach(v => { if (v.supabaseId) dbDeleteVideo(v.supabaseId, v.storagePath).catch(() => {}); });
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDel(null);
  };

  const saveEdit = () => {
    if (!editingVid) return;
    onUpdateProject({ ...project, videos: videos.map(v => v.id === editingVid.id ? { ...v, name: editingVid.name, room: editingVid.room } : v) });
    setEditingVid(null);
  };

  const playingVid = videos.find(v => v.id === playing);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div className="section-title" style={{ marginBottom:0 }}>Videos</div>
          <span style={{ fontSize:12,color:"var(--text3)",padding:"2px 9px",background:"var(--surface2)",borderRadius:10,border:"1px solid var(--border)" }}>{videos.length} clip{videos.length!==1?"s":""}</span>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          {rooms.length > 2 && (
            <select className="form-input form-select" value={filterRoom} onChange={e=>setFilterRoom(e.target.value)} style={{ width:"auto",fontSize:12.5,padding:"5px 28px 5px 10px",height:"auto" }}>
              {rooms.map(r=><option key={r} value={r}>{r==="all"?"All Rooms":r}</option>)}
            </select>
          )}
          {selectMode ? (<>
            {selectedIds.size > 0 && (
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }} onClick={() => setConfirmDel("batch")}>
                <Icon d={ic.trash} size={13}/> Delete {selectedIds.size}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>Cancel</button>
          </>) : (<>
            {videos.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setSelectMode(true)}>â Select</button>}
            <button className="btn btn-primary btn-sm" onClick={()=>onOpenCamera(project)}>
              <Icon d={ic.video} size={14}/> Record Video
            </button>
          </>)}
        </div>
      </div>

      {/* Empty state */}
      {videos.length === 0 && (
        <div style={{ textAlign:"center",padding:"70px 20px",color:"var(--text3)" }}>
          <Icon d={ic.video} size={48} stroke="var(--text3)"/>
          <div style={{ fontSize:17,fontWeight:700,marginTop:16,marginBottom:8,color:"var(--text2)" }}>No videos yet</div>
          <div style={{ fontSize:13,marginBottom:20 }}>Record up to 90-second clips directly from the camera.</div>
          <button className="btn btn-primary" onClick={()=>onOpenCamera(project)}><Icon d={ic.video} size={14}/> Record Video</button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14 }}>
          {filtered.map(v => (
            <div key={v.id} style={{ background:"var(--surface)",border:`1px solid ${selectedIds.has(v.id)?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",overflow:"hidden",transition:"box-shadow .15s",position:"relative" }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 18px rgba(0,0,0,.18)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              {selectMode && (
                <div style={{ position:"absolute",top:8,left:8,zIndex:10 }} onClick={e=>{e.stopPropagation();toggleSelect(v.id);}}>
                  <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${selectedIds.has(v.id)?"var(--accent)":"rgba(255,255,255,0.7)"}`,
                    background:selectedIds.has(v.id)?"var(--accent)":"rgba(0,0,0,0.4)",
                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                    {selectedIds.has(v.id) && <Icon d="M20 6L9 17l-5-5" size={13} stroke="white" strokeWidth={2.5}/>}
                  </div>
                </div>
              )}
              {/* Thumbnail / play area */}
              <div style={{ position:"relative",aspectRatio:"16/9",background:"#0d0f14",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                onClick={()=>selectMode ? toggleSelect(v.id) : setPlaying(v.id)}>
                <div style={{ width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.12)",border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",transition:"transform .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  <Icon d="M5 3l14 9-14 9V3z" size={22} stroke="white" fill="white"/>
                </div>
                {v.duration != null && (
                  <span style={{ position:"absolute",bottom:8,right:8,fontSize:11,fontWeight:700,background:"rgba(0,0,0,.75)",color:"white",padding:"2px 7px",borderRadius:6,letterSpacing:".03em" }}>
                    {fmtTime(v.duration)}
                  </span>
                )}
                <span style={{ position:"absolute",top:8,left:8,fontSize:10.5,background:"rgba(0,0,0,.6)",color:"rgba(255,255,255,.85)",padding:"2px 8px",borderRadius:6 }}>
                  ð¬ {v.room || "General"}
                </span>
              </div>
              {/* Meta */}
              <div style={{ padding:"11px 13px" }}>
                <div style={{ fontWeight:700,fontSize:13.5,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.name}</div>
                <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--text3)",marginBottom:10 }}>
                  <Icon d={ic.clockIcon} size={11}/>{v.date}
                  {v.gps && <><span>·</span><Icon d={ic.mapPin} size={11} stroke="#3dba7e"/><span style={{ color:"#3dba7e" }}>GPS</span></>}
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1,justifyContent:"center" }} onClick={()=>setPlaying(v.id)}>
                    <Icon d="M5 3l14 9-14 9V3z" size={12} fill="var(--accent)" stroke="var(--accent)"/> Play
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ width:30 }} onClick={()=>setEditingVid({ id:v.id, name:v.name, room:v.room||"General" })}>
                    <Icon d={ic.edit} size={13}/>
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ width:30,color:"#e85a3a" }} onClick={()=>setConfirmDel(v)} title="Delete">
                    <Icon d={ic.trash} size={13}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && videos.length > 0 && (
        <div style={{ textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13 }}>No videos in "{filterRoom}"</div>
      )}

      {/* Lightbox player */}
      {playing && playingVid && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setPlaying(null); }} style={{ zIndex:150 }}>
          <div style={{ background:"#000",borderRadius:"var(--radius)",overflow:"hidden",width:"min(90vw,900px)",boxShadow:"0 24px 80px rgba(0,0,0,.7)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"#111",borderBottom:"1px solid #222" }}>
              <div style={{ fontWeight:700,fontSize:14,color:"white" }}>{playingVid.name}</div>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:11.5,color:"rgba(255,255,255,.5)" }}>{playingVid.room} · {playingVid.date}{playingVid.duration!=null?` · ${fmtTime(playingVid.duration)}`:""}</span>
                <button className="btn btn-ghost btn-icon" style={{ color:"white",width:30,height:30 }} onClick={()=>setPlaying(null)}><Icon d={ic.close} size={16}/></button>
              </div>
            </div>
            <video src={playingVid.dataUrl} controls autoPlay style={{ width:"100%",display:"block",background:"#000",maxHeight:"75vh" }} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingVid && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditingVid(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header"><div className="modal-title">Edit Video</div><button className="btn btn-ghost btn-icon" onClick={()=>setEditingVid(null)}><Icon d={ic.close} size={16}/></button></div>
            <div className="modal-body" style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div>
                <div className="form-label">Video Name</div>
                <input className="form-input" value={editingVid.name} onChange={e=>setEditingVid(v=>({...v,name:e.target.value}))} />
              </div>
              <div>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={editingVid.room} onChange={e=>setEditingVid(v=>({...v,room:e.target.value}))}>
                  {(project.rooms||[]).map(r=><option key={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setEditingVid(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}><Icon d={ic.check} size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:"#e85a3a" }}><Icon d={ic.trash} size={15}/> Delete Video{confirmDel==="batch"?"s":""}</div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,color:"var(--text2)",margin:0 }}>
                {confirmDel === "batch"
                  ? `Delete ${selectedIds.size} video${selectedIds.size!==1?"s":""}? This cannot be undone.`
                  : `"${confirmDel.name}" will be permanently deleted. This cannot be undone.`}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={()=>confirmDel==="batch" ? deleteBatch() : deleteVideo(confirmDel.id)}>
                <Icon d={ic.trash} size={14}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────────────────────────
// ── Embed code builder — lives outside JSX so </div> strings don't confuse the parser ──
export function VoiceNotesTab({ project, teamUsers = [], settings = {}, onUpdateProject, onSendToDirectMessage, orgId }) {
  const voiceNotes = project.voiceNotes || [];
  const [recState,     setRecState]     = useState("idle");
  const [recMs,        setRecMs]        = useState(0);
  const [recError,     setRecError]     = useState("");
  const [sendingNoteId,setSendingNoteId]= useState(null);
  const [sendTargetId, setSendTargetId] = useState("");
  const [selectMode,   setSelectMode]   = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [confirmDel,   setConfirmDel]   = useState(null); // null | noteId | "batch"
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  const toggleSelect = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const authorName = `${settings?.userFirstName || "Admin"} ${settings?.userLastName || ""}`.trim();
  const voicePerms = getEffectivePermissions(settings?.userRole || "admin", settings?.userPermissions, settings);
  const voicePolicies = getPermissionPolicies(settings);
  const directMsgOk = hasPermissionLevel(voicePerms, "messages", "edit") && voicePolicies.chatAllowDirect;

  useEffect(() => {
    if (recState !== "recording") return;
    const timer = setInterval(() => setRecMs(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(timer);
  }, [recState]);

  useEffect(() => () => {
    streamRef.current?.getTracks?.().forEach(track => track.stop());
  }, []);

  const persistVoiceNote = (blob) => {
    const durationMs = Math.max(1000, Date.now() - startedAtRef.current);
    const title = `Voice Note ${voiceNotes.length + 1}`;
    const reader = new FileReader();
    reader.onloadend = () => {
      const note = {
        id: uid(),
        title,
        createdAt: new Date().toISOString(),
        createdById: "__admin__",
        createdByName: authorName,
        durationMs,
        mimeType: blob.type || "audio/webm",
        size: blob.size || 0,
        dataUrl: reader.result,
      };
      onUpdateProject({ ...project, voiceNotes: [note, ...voiceNotes] });
      setRecState("idle");
      setRecMs(0);
      // Upload to Supabase and replace base64 with Storage URL
      if (orgId && project.id) {
        const durationSeconds = Math.round(durationMs / 1000);
        dbUploadVoiceNote(project.id, orgId, blob, durationSeconds, title, authorName, durationMs).then(row => {
          // Base64 dataUrl already works for playback this session.
          // Just tag the note with its DB id in local state so delete works later.
          // Don't call onUpdateProject again — the stale project closure would wipe the note.
          if (row?.id) {
            note.supabaseId  = row.id;
            note.storagePath = row.storage_path;
          }
        }).catch(err => console.warn("[KrakenCam] Voice note Supabase upload failed:", err.message || err));
      }
    };
    reader.readAsDataURL(blob);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecError("Voice notes are not supported in this browser.");
      return;
    }
    try {
      setRecError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecMs(0);
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        if (blob.size) persistVoiceNote(blob);
        else {
          setRecState("idle");
          setRecError("No audio was captured. Please try again.");
        }
      };
      recorder.start();
      setRecState("recording");
    } catch (err) {
      setRecError(err?.message || "Microphone access was blocked.");
      setRecState("idle");
    }
  };

  const deleteVoiceNote = (noteId) => {
    const note = voiceNotes.find(n => n.id === noteId);
    onUpdateProject({ ...project, voiceNotes: voiceNotes.filter(n => n.id !== noteId) });
    setConfirmDel(null);
    if (note?.supabaseId) dbDeleteVoiceNote(note.supabaseId, note.storagePath).catch(() => {});
  };

  const deleteBatch = () => {
    const toDelete = voiceNotes.filter(n => selectedIds.has(n.id));
    onUpdateProject({ ...project, voiceNotes: voiceNotes.filter(n => !selectedIds.has(n.id)) });
    toDelete.forEach(n => { if (n.supabaseId) dbDeleteVoiceNote(n.supabaseId, n.storagePath).catch(() => {}); });
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDel(null);
  };

  const handleSend = () => {
    if (!sendingNoteId || !sendTargetId) return;
    const note = voiceNotes.find(n => n.id === sendingNoteId);
    if (!note) return;
    onSendToDirectMessage?.(project, note, sendTargetId);
    setSendingNoteId(null);
    setSendTargetId("");
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div className="card">
        <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontWeight:700 }}>Voice Notes</span>
            <span style={{ fontSize:12,color:"var(--text3)" }}>{voiceNotes.length} saved</span>
            {selectMode && selectedIds.size > 0 && <span style={{ fontSize:12,fontWeight:700,color:"var(--accent)" }}>{selectedIds.size} selected</span>}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {selectMode ? (<>
              {selectedIds.size > 0 && (
                <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }} onClick={() => setConfirmDel("batch")}>
                  <Icon d={ic.trash} size={13}/> Delete {selectedIds.size}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>Cancel</button>
            </>) : voiceNotes.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectMode(true)}>â Select</button>
            )}
          </div>
        </div>
        <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap",padding:"14px 16px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12 }}>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:recState==="recording"?"#e85a3a":"var(--text)" }}>
                {recState === "recording" ? `Recording ${formatDurationLabel(recMs)}` : "Ready to record"}
              </div>
              <div style={{ fontSize:12,color:"var(--text2)",marginTop:4 }}>
                Notes are saved with your name and timestamp, and can be sent into direct messages.
              </div>
            </div>
            {recState === "recording" ? (
              <button className="btn btn-danger" onClick={stopRecording}><Icon d={ic.mic} size={15} /> Stop Recording</button>
            ) : (
              <button className="btn btn-primary" onClick={startRecording}><Icon d={ic.mic} size={15} /> Record Voice Note</button>
            )}
          </div>
          {recError && (
            <div style={{ padding:"10px 12px",borderRadius:10,background:"#e85a3a18",border:"1px solid #e85a3a33",color:"#e85a3a",fontSize:12.5 }}>
              {recError}
            </div>
          )}
        </div>
      </div>

      {voiceNotes.length === 0 ? (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 24px",gap:12,textAlign:"center",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16 }}>
          <div style={{ width:60,height:60,borderRadius:16,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Icon d={ic.mic} size={24} stroke="var(--text3)" />
          </div>
          <div style={{ fontSize:16,fontWeight:700 }}>No voice notes yet</div>
          <div style={{ fontSize:13.5,color:"var(--text2)",maxWidth:320 }}>
            Capture walkthrough notes, updates, and reminders right from the jobsite.
          </div>
        </div>
      ) : (
        <div style={{ display:"grid",gap:14 }}>
          {voiceNotes.map(note => (
            <div key={note.id} className="card" style={{ outline: selectedIds.has(note.id) ? "2px solid var(--accent)" : "none", borderRadius: 12 }}>
              <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                    {selectMode && (
                      <div style={{ marginTop:2,cursor:"pointer" }} onClick={() => toggleSelect(note.id)}>
                        <div style={{ width:20,height:20,borderRadius:5,border:`2px solid ${selectedIds.has(note.id)?"var(--accent)":"var(--border)"}`,
                          background:selectedIds.has(note.id)?"var(--accent)":"var(--surface2)",
                          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                          {selectedIds.has(note.id) && <Icon d="M20 6L9 17l-5-5" size={12} stroke="white" strokeWidth={2.5}/>}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                        <span style={{ fontSize:14,fontWeight:700 }}>{note.title || "Voice Note"}</span>
                        <span className="tag tag-blue">{formatDurationLabel(note.durationMs)}</span>
                      </div>
                      <div style={{ fontSize:12,color:"var(--text2)",marginTop:5 }}>
                        {note.createdByName || authorName} â¢ {formatDateTimeLabel(note.createdAt, settings)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                    {!selectMode && <>
                      <button className="btn btn-secondary btn-sm" disabled={!directMsgOk || teamUsers.length===0} onClick={() => { setSendingNoteId(note.id); setSendTargetId(teamUsers[0]?.id || ""); }}>
                        <Icon d={ic.message} size={13} /> Send to DM
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={() => setConfirmDel(note.id)} style={{ color:"#e85a3a" }}>
                        <Icon d={ic.trash} size={14} />
                      </button>
                    </>}
                  </div>
                </div>
                <audio controls preload="metadata" src={note.dataUrl} style={{ width:"100%" }} />
                {sendingNoteId === note.id && (
                  <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"12px 14px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12 }}>
                    <div style={{ fontSize:12.5,fontWeight:600 }}>Send this voice note to:</div>
                    <select className="form-input" value={sendTargetId} onChange={e => setSendTargetId(e.target.value)} style={{ maxWidth:240,minWidth:180 }}>
                      {teamUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary btn-sm" disabled={!sendTargetId} onClick={handleSend}>Send</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSendingNoteId(null); setSendTargetId(""); }}>Cancel</button>
                    {!directMsgOk && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Direct messages are disabled in settings.</span>}
                    {directMsgOk && teamUsers.length===0 && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Add team members to use direct messages.</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:"#e85a3a" }}><Icon d={ic.trash} size={15}/> Delete Voice Note{confirmDel==="batch"?"s":""}</div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,color:"var(--text2)",margin:0 }}>
                {confirmDel === "batch"
                  ? `Delete ${selectedIds.size} voice note${selectedIds.size!==1?"s":""}? This cannot be undone.`
                  : "Delete this voice note? This cannot be undone."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={()=>confirmDel==="batch" ? deleteBatch() : deleteVoiceNote(confirmDel)}>
                <Icon d={ic.trash} size={13}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectFilesTab({ project, teamUsers = [], settings = {}, onUpdateProject, onSendFileToDirectMessage, orgId }) {
  const files = (project.files || []).map(normaliseProjectFile);
  const uploadRef = useRef(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [kindFilter, setKindFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadTagsInput, setUploadTagsInput] = useState("");
  const [shareFileId, setShareFileId] = useState(null);
  const [shareTargetId, setShareTargetId] = useState("");
  const [reportFileId, setReportFileId] = useState(null);
  const [reportTargetId, setReportTargetId] = useState("");
  const [draftTagInputs, setDraftTagInputs] = useState({});
  const [selectMode,   setSelectMode]   = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [confirmDel,   setConfirmDel]   = useState(null); // null | fileId | "batch"
  const [imgZoom,      setImgZoom]      = useState(1);
  const [imgPan,       setImgPan]       = useState({x:0,y:0});
  const imgPanStart = useRef(null);
  const filePerms = getEffectivePermissions(settings?.userRole || "admin", settings?.userPermissions, settings);
  const filePolicies = getPermissionPolicies(settings);
  const canUploadFiles = hasPermissionLevel(filePerms, "files", "edit") && (settings?.userRole !== "user" || filePolicies.allowUserFileUploads);
  const canDownloadFiles = hasPermissionLevel(filePerms, "files", "view") && (settings?.userRole !== "user" || filePolicies.allowUserFileDownloads);
  const canShareToDm = hasPermissionLevel(filePerms, "messages", "edit") && filePolicies.chatAllowDirect;
  const canDeleteFiles = hasPermissionLevel(filePerms, "deletes", "edit") || (settings?.userRole === "user" && filePolicies.allowUserDeletes);

  const availableUsers = teamUsers.filter(u => u.status === "active");
  const reports = project.reports || [];
  const categoryOptions = ["All", ...Array.from(new Set(files.map(f => f.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const tagOptions = ["All", ...Array.from(new Set(files.flatMap(f => f.tags || []).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const kindOptions = ["All", "PDF", "Image", "Document", "Spreadsheet", "Text", "Audio", "Video", "Other"];

  const filteredFiles = files.filter(file => {
    const q = search.trim().toLowerCase();
    const haystack = [file.name, file.category, file.kind, file.uploadedByName, ...(file.tags || [])].join(" ").toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (categoryFilter !== "All" && file.category !== categoryFilter) return false;
    if (kindFilter !== "All" && file.kind !== kindFilter) return false;
    if (tagFilter !== "All" && !(file.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const patchFiles = (nextFiles) => onUpdateProject({ ...project, files: nextFiles.map(normaliseProjectFile) });
  const updateFileMeta = (fileId, patch) => {
    patchFiles(files.map(file => file.id === fileId ? normaliseProjectFile({ ...file, ...patch }) : file));
    if (viewerFile?.id === fileId) setViewerFile(prev => prev ? normaliseProjectFile({ ...prev, ...patch }) : prev);
  };
  useEffect(() => {
    setDraftTagInputs(prev => {
      const next = {};
      files.forEach(file => {
        next[file.id] = Object.prototype.hasOwnProperty.call(prev, file.id)
          ? prev[file.id]
          : (file.tags || []).join(", ");
      });
      return next;
    });
  }, [files]);

  const commitDraftTags = (fileId) => {
    const raw = draftTagInputs[fileId];
    updateFileMeta(fileId, { tags: parseTagInput(raw || "") });
    setDraftTagInputs(prev => ({ ...prev, [fileId]: parseTagInput(raw || "").join(", ") }));
  };

  const handleUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const maxSize = 10 * 1024 * 1024;
    const tooBig = selected.find(f => f.size > maxSize);
    if (tooBig) {
      alert(`"${tooBig.name}" is too large. Please keep files under 10 MB.`);
      e.target.value = "";
      return;
    }
    const nextFiles = [];
    selected.forEach(file => {
      const fileId = uid();
      const reader = new FileReader();
      reader.onload = async ev => {
        const newFile = {
          id: fileId,
          name: file.name,
          type: file.type || "",
          size: file.size || 0,
          dataUrl: ev.target.result, // base64 for instant display
          uploadedAt: new Date().toISOString(),
          uploadedByName: `${settings?.userFirstName || "Admin"} ${settings?.userLastName || ""}`.trim(),
          category: uploadCategory.trim() || "General",
          tags: parseTagInput(uploadTagsInput),
          kind: inferProjectFileKind(file),
        };
        nextFiles.push(newFile);
        if (nextFiles.length === selected.length) {
          nextFiles.sort((a, b) => a.name.localeCompare(b.name));
          // Read latest files from project to avoid stale closure
          const currentFiles = (project.files || []).map(normaliseProjectFile);
          patchFiles([...nextFiles.reverse(), ...currentFiles]);
        }
        // Upload to Supabase using raw fetch (avoids RLS issues with JS client)
        if (orgId && project?.id) {
          try {
            const supaUrl = import.meta.env.VITE_SUPABASE_URL;
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${orgId}/${project.id}/files/${timestamp}_${safeName}`;
            const uploadHeaders = await getAuthHeaders({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' });
            const uploadRes = await fetch(`${supaUrl}/storage/v1/object/project-photos/${storagePath}`, {
              method: 'POST', headers: uploadHeaders, body: file,
            });
            if (uploadRes.ok) {
              const publicUrl = `${supaUrl}/storage/v1/object/public/project-photos/${storagePath}`;
              // Insert DB row
              const headers = await getAuthHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' });
              const dbRes = await fetch(`${supaUrl}/rest/v1/project_files`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ organization_id: orgId, project_id: project.id, name: file.name, storage_path: storagePath, file_size: file.size || null, mime_type: file.type || null }),
              });
              const dbRow = dbRes.ok ? (await dbRes.json())[0] : null;
              // Tag the local file object with its Storage URL and DB id in-place
              // Do NOT call patchFiles here — it would use a stale snapshot and wipe the file
              // Instead, update only the specific file via onUpdateProject with the latest project state
              newFile.dataUrl = publicUrl;
              newFile.storagePath = storagePath;
              if (dbRow?.id) newFile.supabaseId = dbRow.id;
            }
          } catch (err) {
            console.error('[KrakenCam] Project file upload failed:', err.message || err);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const openFile = (file) => {
    // Use the storage URL if available, otherwise fall back to dataUrl
    const url = file.dataUrl?.startsWith("http") ? file.dataUrl : file.dataUrl;
    if (!url) { alert("File URL unavailable."); return; }
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) alert("Please allow pop-ups to open files.");
  };

  const toggleSelect = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteFile = (fileId) => {
    const file = files.find(f => f.id === fileId);
    patchFiles(files.filter(f => f.id !== fileId));
    if (viewerFile?.id === fileId) setViewerFile(null);
    setConfirmDel(null);
    // Remove from Supabase
    if (file?.supabaseId && file?.storagePath) {
      dbDeleteProjectFile(file.supabaseId, file.storagePath).catch(() => {});
    }
  };

  const deleteBatch = () => {
    const toDelete = files.filter(f => selectedIds.has(f.id));
    patchFiles(files.filter(f => !selectedIds.has(f.id)));
    if (viewerFile && selectedIds.has(viewerFile.id)) setViewerFile(null);
    toDelete.forEach(f => { if (f.supabaseId && f.storagePath) dbDeleteProjectFile(f.supabaseId, f.storagePath).catch(() => {}); });
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDel(null);
  };

  const attachFileToReport = (fileId, reportId) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !reportId) return;
    onUpdateProject({
      ...project,
      reports: reports.map(report => report.id !== reportId ? report : {
        ...report,
        blocks: [
          ...(report.blocks || []),
          {
            id: uid(),
            type: "files",
            label: file.category || "Attached Files",
            files: [{
              id: file.id,
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: file.dataUrl,
              uploadedAt: file.uploadedAt,
              uploadedByName: file.uploadedByName,
              category: file.category,
              tags: file.tags || [],
              kind: file.kind || inferProjectFileKind(file),
            }],
            caption: "",
          },
        ],
      }),
    });
    setReportFileId(null);
    setReportTargetId("");
  };

  const activeShareFile = files.find(f => f.id === shareFileId) || null;
  const activeReportFile = files.find(f => f.id === reportFileId) || null;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div className="card">
        <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontWeight:700 }}>Jobsite Files</span>
            {selectMode && selectedIds.size > 0 && <span style={{ fontSize:12,fontWeight:700,color:"var(--accent)" }}>{selectedIds.size} selected</span>}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {selectMode ? (<>
              {selectedIds.size > 0 && (
                <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }} onClick={() => setConfirmDel("batch")}>
                  <Icon d={ic.trash} size={13}/> Delete {selectedIds.size}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>Cancel</button>
            </>) : (<>
              {files.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setSelectMode(true)}>â Select</button>}
              <button className="btn btn-primary btn-sm" onClick={() => canUploadFiles && uploadRef.current?.click()} disabled={!canUploadFiles}><Icon d={ic.upload} size={13} /> Upload Files</button>
            </>)}
          </div>
        </div>
        <div className="card-body" style={{ display:"grid",gap:12 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap" }}>
            <div style={{ fontSize:12.5,color:"var(--text2)" }}>
              Upload PDFs, images, spreadsheets, scope docs, and notes. Files stay attached to this jobsite.
            </div>
            <div style={{ fontSize:12,color:"var(--text3)" }}>{files.length} file{files.length!==1?"s":""}</div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"minmax(180px,1fr) minmax(180px,1fr)",gap:10 }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--text3)",marginBottom:6 }}>Category</div>
              <input className="form-input" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="General" />
            </div>
            <div>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--text3)",marginBottom:6 }}>Tags</div>
              <input className="form-input" value={uploadTagsInput} onChange={e => setUploadTagsInput(e.target.value)} placeholder="permit, estimate, change order" />
            </div>
          </div>
          <input
            ref={uploadRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.md"
            style={{ display:"none" }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {files.length > 0 && (
        <div className="card">
          <div className="card-body" style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.5fr) repeat(3,minmax(140px,1fr))",gap:10 }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files, tags, category, uploader" />
            <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              {categoryOptions.map(opt => <option key={opt} value={opt}>{opt === "All" ? "All categories" : opt}</option>)}
            </select>
            <select className="form-select" value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
              {kindOptions.map(opt => <option key={opt} value={opt}>{opt === "All" ? "All types" : opt}</option>)}
            </select>
            <select className="form-select" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              {tagOptions.map(opt => <option key={opt} value={opt}>{opt === "All" ? "All tags" : opt}</option>)}
            </select>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 24px",gap:12,textAlign:"center",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16 }}>
          <div style={{ width:60,height:60,borderRadius:16,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Icon d={ic.folder} size={24} stroke="var(--text3)" />
          </div>
          <div style={{ fontSize:16,fontWeight:700 }}>No files yet</div>
          <div style={{ fontSize:13.5,color:"var(--text2)",maxWidth:360 }}>
            Keep project documents together so the field team can pull up PDFs, photos, notes, and reference files on-site.
          </div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"42px 24px",gap:10,textAlign:"center",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16 }}>
          <div style={{ fontSize:15,fontWeight:700 }}>No files match these filters</div>
          <div style={{ fontSize:13,color:"var(--text2)" }}>Try a different search, category, type, or tag.</div>
        </div>
      ) : (
        <div style={{ display:"grid",gap:12 }}>
          {filteredFiles.map(file => {
            const previewable = isPreviewableFile(file);
            const ext = getFileExtension(file.name).toUpperCase() || "FILE";
            return (
              <div key={file.id} className="card" style={{ outline: selectedIds.has(file.id) ? "2px solid var(--accent)" : "none", borderRadius:12 }}>
                <div className="card-body" style={{ display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" }}>
                  {selectMode && (
                    <div style={{ cursor:"pointer",flexShrink:0 }} onClick={() => toggleSelect(file.id)}>
                      <div style={{ width:20,height:20,borderRadius:5,border:`2px solid ${selectedIds.has(file.id)?"var(--accent)":"var(--border)"}`,background:selectedIds.has(file.id)?"var(--accent)":"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        {selectedIds.has(file.id) && <Icon d="M20 6L9 17l-5-5" size={12} stroke="white" strokeWidth={2.5}/>}
                      </div>
                    </div>
                  )}
                  <div style={{ width:54,height:54,borderRadius:12,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"var(--accent)",flexShrink:0,border:"1px solid var(--border)",overflow:"hidden" }}>
                    {file.type?.startsWith("image/")
                      ? <img src={file.dataUrl} alt={file.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : ext}
                  </div>
                  <div style={{ flex:1,minWidth:220 }}>
                    <div style={{ fontSize:13.5,fontWeight:700,marginBottom:4,wordBreak:"break-word" }}>{file.name}</div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:6 }}>
                      <span className="tag tag-blue">{file.category || "General"}</span>
                      <span className="tag tag-gray">{file.kind}</span>
                      {(file.tags || []).map(tag => <span key={tag} className="tag tag-purple">{tag}</span>)}
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",display:"flex",gap:8,flexWrap:"wrap" }}>
                      <span>{formatFileSizeLabel(file.size)}</span>
                      <span>â¢</span>
                      <span>{file.uploadedByName || "Unknown"}</span>
                      <span>â¢</span>
                      <span>{formatDateTimeLabel(file.uploadedAt, settings)}</span>
                    </div>
                  </div>
                  {!selectMode && (
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,max-content))",gap:8,justifyContent:"end" }}>
                    {/* Single Preview button — opens in new tab for all types, or shows inline viewer for supported types */}
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      if (previewable) setViewerFile(file);
                      else openFile(file);
                    }}><Icon d={ic.eye} size={13} /> Preview</button>
                    {availableUsers.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { if (!canShareToDm) return; setShareFileId(file.id); setShareTargetId(availableUsers[0]?.id || ""); }} disabled={!canShareToDm}><Icon d={ic.message} size={13} /> Send to DM</button>}
                    {reports.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setReportFileId(file.id); setReportTargetId(reports[0]?.id || ""); }}><Icon d={ic.reports} size={13} /> Add to Report</button>}
                    {canDownloadFiles
                      ? <a className="btn btn-ghost btn-sm" href={file.dataUrl} download={file.name}><Icon d={ic.download} size={13} /> Download</a>
                      : <button className="btn btn-ghost btn-sm" disabled><Icon d={ic.download} size={13} /> Download</button>}
                    <button className="btn btn-ghost btn-sm btn-icon" title="Delete" style={{ color:"#e85a3a" }} onClick={() => canDeleteFiles && setConfirmDel(file.id)} disabled={!canDeleteFiles}><Icon d={ic.trash} size={14} /></button>
                  </div>
                  )}
                  <div style={{ width:"100%",display:"grid",gridTemplateColumns:"minmax(180px,220px) minmax(220px,1fr)",gap:10,paddingTop:8,borderTop:"1px solid var(--border)" }}>
                    <input className="form-input" value={file.category || ""} onChange={e => updateFileMeta(file.id, { category: e.target.value || "General" })} placeholder="Category" disabled={!canUploadFiles} />
                    <input
                      className="form-input"
                      value={draftTagInputs[file.id] ?? (file.tags || []).join(", ")}
                      onChange={e => canUploadFiles && setDraftTagInputs(prev => ({ ...prev, [file.id]: e.target.value }))}
                      onBlur={() => canUploadFiles && commitDraftTags(file.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (canUploadFiles) commitDraftTags(file.id);
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Tags separated by commas"
                      disabled={!canUploadFiles}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:"#e85a3a" }}><Icon d={ic.trash} size={15}/> Delete File{confirmDel==="batch"?"s":""}</div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,color:"var(--text2)",margin:0 }}>
                {confirmDel === "batch"
                  ? `Delete ${selectedIds.size} file${selectedIds.size!==1?"s":""}? This cannot be undone.`
                  : "Delete this file? This cannot be undone."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={()=>confirmDel==="batch" ? deleteBatch() : deleteFile(confirmDel)}>
                <Icon d={ic.trash} size={13}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerFile && (() => {
        const vUrl       = viewerFile.dataUrl || "";
        const vIsStorage = vUrl.startsWith("http");
        const vIsImg     = viewerFile.type?.startsWith("image/");
        // PDFs: use <object> only for base64 (data:) — storage URLs fail silently in many browsers
        const vIsPdfInline = viewerFile.type === "application/pdf" && !vIsStorage;
        const vIsText    = (viewerFile.type?.startsWith("text/") || ["txt","csv","json","md"].includes(getFileExtension(viewerFile.name))) && !vIsStorage;
        const onImgDown  = e => { e.preventDefault(); imgPanStart.current = { mx:e.clientX, my:e.clientY, px:imgPan.x, py:imgPan.y }; };
        const onImgMove  = e => { if (!imgPanStart.current) return; setImgPan({ x:imgPanStart.current.px+e.clientX-imgPanStart.current.mx, y:imgPanStart.current.py+e.clientY-imgPanStart.current.my }); };
        const onImgUp    = () => { imgPanStart.current = null; };
        const onImgWheel = e => { e.preventDefault(); setImgZoom(z => Math.max(0.2, Math.min(8, z*(e.deltaY<0?1.15:0.87)))); };
        const closeViewer = () => { setViewerFile(null); setImgZoom(1); setImgPan({x:0,y:0}); };
        return (
          <div key={viewerFile.id} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.93)",display:"flex",flexDirection:"column" }}>
            {/* Toolbar */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"rgba(0,0,0,0.55)",borderBottom:"1px solid rgba(255,255,255,0.12)",flexShrink:0,gap:10 }}>
              <div style={{ fontSize:13.5,fontWeight:600,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0 }}>{viewerFile.name}</div>
              <div style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
                {vIsImg && <>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setImgZoom(1); setImgPan({x:0,y:0}); }} style={{ fontSize:11 }}>Reset</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setImgZoom(z => Math.min(8,z*1.3))} style={{ minWidth:32 }}>+</button>
                  <span style={{ color:"rgba(255,255,255,.6)",fontSize:12,minWidth:44,textAlign:"center" }}>{Math.round(imgZoom*100)}%</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => setImgZoom(z => Math.max(0.2,z*0.77))} style={{ minWidth:32 }}>â</button>
                </>}
                <button className="btn btn-sm btn-secondary" onClick={() => openFile(viewerFile)}><Icon d={ic.arrowUpRight} size={13}/> Open</button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color:"white" }} onClick={closeViewer}><Icon d={ic.close} size={20}/></button>
              </div>
            </div>
            {/* Content */}
            <div style={{ flex:1,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {vIsImg ? (
                <div style={{ width:"100%",height:"100%",overflow:"hidden",cursor:imgZoom>1?"grab":"zoom-in",userSelect:"none",display:"flex",alignItems:"center",justifyContent:"center" }}
                  onMouseDown={onImgDown} onMouseMove={onImgMove} onMouseUp={onImgUp} onMouseLeave={onImgUp} onWheel={onImgWheel}>
                  <img src={vUrl} alt={viewerFile.name} draggable={false}
                    style={{ transform:`translate(${imgPan.x}px,${imgPan.y}px) scale(${imgZoom})`,transformOrigin:"center",maxWidth:"90vw",maxHeight:"90vh",objectFit:"contain",pointerEvents:"none" }}
                  />
                </div>
              ) : vIsPdfInline ? (
                <object data={vUrl} type="application/pdf" style={{ width:"100%",height:"100%",border:"none" }}>
                  <div style={{ textAlign:"center",padding:40,color:"rgba(255,255,255,.7)" }}>
                    <div style={{ fontSize:15,marginBottom:16,color:"white" }}>PDF cannot display inline.</div>
                    <button className="btn btn-primary" onClick={() => openFile(viewerFile)}><Icon d={ic.arrowUpRight} size={14}/> Open in New Tab</button>
                  </div>
                </object>
              ) : vIsText ? (
                <div style={{ width:"100%",height:"100%",overflow:"auto",padding:24 }}>
                  <pre style={{ margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"monospace",fontSize:13,lineHeight:1.7,color:"rgba(255,255,255,.9)" }}>
                    {decodeDataUrlText(vUrl)}
                  </pre>
                </div>
              ) : (
                /* Storage URL PDF, unsupported type, or anything else → Open in New Tab */
                <div style={{ textAlign:"center",color:"rgba(255,255,255,.7)",padding:40 }}>
                  <div style={{ fontSize:56,marginBottom:16 }}>ð</div>
                  <div style={{ fontSize:15,fontWeight:600,color:"white",marginBottom:8 }}>{viewerFile.name}</div>
                  <div style={{ fontSize:13,marginBottom:24,color:"rgba(255,255,255,.5)" }}>
                    {viewerFile.type === "application/pdf" ? "PDF preview opens in your browser's PDF viewer." : "Preview not available for this file type."}
                  </div>
                  <button className="btn btn-primary" onClick={() => openFile(viewerFile)}><Icon d={ic.arrowUpRight} size={14}/> Open in New Tab</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeShareFile && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShareFileId(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon d={ic.message} size={15} /> Send File to Direct Message</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShareFileId(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body" style={{ display:"grid",gap:12 }}>
              <div style={{ fontSize:12.5,color:"var(--text2)" }}>
                Send <strong>{activeShareFile.name}</strong> from {project.title} into a teammate&apos;s direct message thread.
              </div>
              <select className="form-select" value={shareTargetId} onChange={e => setShareTargetId(e.target.value)}>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>{`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Team Member"}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShareFileId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={!shareTargetId} onClick={() => { onSendFileToDirectMessage?.(project, activeShareFile, shareTargetId); setShareFileId(null); }}>
                <Icon d={ic.check} size={13} /> Send File
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReportFile && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReportFileId(null)}>
          <div className="modal fade-in" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon d={ic.reports} size={15} /> Add File to Report</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setReportFileId(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body" style={{ display:"grid",gap:12 }}>
              <div style={{ fontSize:12.5,color:"var(--text2)" }}>
                Add <strong>{activeReportFile.name}</strong> to one of this jobsite&apos;s reports as a file attachment section.
              </div>
              <select className="form-select" value={reportTargetId} onChange={e => setReportTargetId(e.target.value)}>
                {reports.map(report => (
                  <option key={report.id} value={report.id}>{report.title || "Untitled Report"}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setReportFileId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={!reportTargetId} onClick={() => attachFileToReport(activeReportFile.id, reportTargetId)}>
                <Icon d={ic.check} size={13} /> Add to Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientPortalPreview({ project, settings = {}, portal, onAddClientNote }) {
  const [passwordInput, setPasswordInput] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [portalUnlocked, setPortalUnlocked] = React.useState(!portal?.passwordEnabled || !portal?.password);
  React.useEffect(() => {
    setPortalUnlocked(!portal?.passwordEnabled || !portal?.password);
    setPasswordInput("");
    setPasswordError("");
  }, [portal?.passwordEnabled, portal?.password, project?.id]);
  const brandColor = settings?.accent || "#2b7fe8";
  const clientProject = withPortalFilteredProject(project);
  const photos = (portal.sharePhotos ? (clientProject.photos || []) : []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const videos = (portal.shareVideos ? (clientProject.videos || []) : []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const sketches = (portal.shareSketches ? (clientProject.sketches || []) : []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const reports = (portal.shareReports ? (clientProject.reports || []) : []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const files = (portal.shareFiles ? (clientProject.files || []) : []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const activity = portal.shareProgress ? buildPortalActivity(clientProject) : [];
  const teamMessages = (portal.teamMessages || []).slice().sort((a, b) => getPortalItemDateValue(b) - getPortalItemDateValue(a));
  const timelineStages = [
    ["approved", "Approved"],
    ["planning", "Planning"],
    ["in_progress", "Work in progress"],
    ["final_walk", "Final walkthrough"],
    ["completion_phase", "Completion phase"],
    ["invoiced", "Invoiced"],
    ["completed", "Completed"],
  ];
  const visibleStageId = timelineStages.some(([id]) => id === project.timelineStage) ? project.timelineStage : "";
  const activeStageIndex = timelineStages.findIndex(([id]) => id === visibleStageId);
  const clientStageNote = visibleStageId ? project.timelineClientNotes?.[visibleStageId] : "";
  const Section = ({ title, sub, children }) => (
    <div style={{ background:"#fff",border:"1px solid #d9e5f4",borderRadius:22,padding:"18px 18px 16px",boxShadow:"0 12px 32px rgba(20,42,74,.06)" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14 }}>
        <div>
          <div style={{ fontSize:18,fontWeight:800,color:"#17324d" }}>{title}</div>
          {sub && <div style={{ fontSize:13,color:"#68819b",marginTop:3,lineHeight:1.5 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
  function unlockPortal() {
    if (!portal?.passwordEnabled || !portal?.password) {
      setPortalUnlocked(true);
      setPasswordError("");
      return;
    }
    if (passwordInput === portal.password) {
      setPortalUnlocked(true);
      setPasswordError("");
      return;
    }
    setPasswordError("That password doesn’t match this portal.");
  }
  if (portal?.passwordEnabled && portal?.password && !portalUnlocked) {
    return (
      <div style={{ background:"linear-gradient(180deg,#f7fbff 0%,#eef6ff 100%)",border:"1px solid #d6e6f7",borderRadius:28,overflow:"hidden" }}>
        <div style={{ padding:"26px 24px 22px",background:`linear-gradient(135deg, ${brandColor} 0%, #7cb6ff 100%)`,color:"white" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap" }}>
            <div style={{ display:"flex",gap:14,alignItems:"center",minWidth:0 }}>
              {settings?.logo
                ? <img src={settings.logo} alt="Company Logo" style={{ width:58,height:58,borderRadius:16,background:"rgba(255,255,255,.95)",objectFit:"contain",padding:8 }} />
                : <div style={{ width:58,height:58,borderRadius:16,background:"rgba(255,255,255,.95)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:22,color:brandColor }}>{(settings?.companyName||"K")[0]}</div>}
              <div>
                <div style={{ fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",opacity:.82 }}>Client Portal</div>
                <div style={{ fontSize:26,fontWeight:900,lineHeight:1.05,marginTop:2 }}>{portal.welcomeTitle || `Hi${project.clientName ? ` ${project.clientName}` : ""}, here’s your project update`}</div>
                <div style={{ fontSize:14.5,opacity:.95,lineHeight:1.55,marginTop:10,maxWidth:720 }}>This portal is password protected. Enter the project password to continue.</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding:"24px 20px" }}>
          <div style={{ maxWidth:460,margin:"0 auto",background:"#fff",border:"1px solid #d9e5f4",borderRadius:22,padding:"20px 20px 18px",boxShadow:"0 12px 32px rgba(20,42,74,.06)",display:"grid",gap:12 }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#17324d" }}>Enter Portal Password</div>
            <div style={{ fontSize:13,color:"#68819b",lineHeight:1.55 }}>For privacy, this project portal requires a password set by the project team.</div>
            <input
              className="form-input"
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); if (passwordError) setPasswordError(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); unlockPortal(); } }}
              placeholder="Enter password"
              style={{ background:"#fff" }}
            />
            {passwordError && <div style={{ fontSize:12.5,color:"#c24646" }}>{passwordError}</div>}
            <button className="btn btn-primary" onClick={unlockPortal} style={{ justifyContent:"center",background:brandColor,border:"none" }}>
              <Icon d={ic.lock} size={14} /> Unlock Portal
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background:"linear-gradient(180deg,#f7fbff 0%,#eef6ff 100%)",border:"1px solid #d6e6f7",borderRadius:28,overflow:"hidden" }}>
      <div style={{ padding:"26px 24px 22px",background:`linear-gradient(135deg, ${brandColor} 0%, #7cb6ff 100%)`,color:"white" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap" }}>
          <div style={{ display:"flex",gap:14,alignItems:"center",minWidth:0 }}>
            {settings?.logo
              ? <img src={settings.logo} alt="Company Logo" style={{ width:58,height:58,borderRadius:16,background:"rgba(255,255,255,.95)",objectFit:"contain",padding:8 }} />
              : <div style={{ width:58,height:58,borderRadius:16,background:"rgba(255,255,255,.95)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:22,color:brandColor }}>{(settings?.companyName||"K")[0]}</div>}
            <div>
              <div style={{ fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",opacity:.82 }}>Client Portal</div>
              <div style={{ fontSize:26,fontWeight:900,lineHeight:1.05,marginTop:2 }}>{portal.welcomeTitle || `Hi${project.clientName ? ` ${project.clientName}` : ""}, here’s your project update`}</div>
              <div style={{ fontSize:14.5,opacity:.95,lineHeight:1.55,marginTop:10,maxWidth:720 }}>{portal.welcomeMessage}</div>
            </div>
          </div>
          <div style={{ minWidth:220,background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.24)",borderRadius:18,padding:"14px 16px",backdropFilter:"blur(8px)" }}>
            <div style={{ fontSize:12,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",opacity:.82,marginBottom:8 }}>Your Project</div>
            <div style={{ fontSize:18,fontWeight:800 }}>{project.title}</div>
            <div style={{ fontSize:13.5,opacity:.9,marginTop:6,lineHeight:1.45 }}>
              {[project.address, project.city, project.state, project.zip].filter(Boolean).join(", ") || "Project address on file"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:"22px 20px 24px",display:"grid",gap:16 }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12 }}>
          {[
            { label:"Current Stage", value:timelineStages.find(([id]) => id === visibleStageId)?.[1] || "Preparing update", sub:project.status || "Active" },
            { label:"Photos Shared", value:String(photos.length), sub:"Visual progress" },
            { label:"Files Shared", value:String(files.length + reports.length), sub:"Files and reports" },
            { label:"Last Activity", value:activity[0] ? formatPortalRelativeLabel(activity[0].when) : "No updates yet", sub:"We’ll keep this fresh" },
          ].map(card => (
            <div key={card.label} style={{ background:"#fff",border:"1px solid #d9e5f4",borderRadius:20,padding:"16px 16px 14px" }}>
              <div style={{ fontSize:11.5,fontWeight:800,color:"#5f7b96",letterSpacing:".08em",textTransform:"uppercase" }}>{card.label}</div>
              <div style={{ fontSize:24,fontWeight:900,color:"#17324d",marginTop:6 }}>{card.value}</div>
              <div style={{ fontSize:13,color:"#6c849b",marginTop:4 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {portal.shareProgress && (
          <Section title="Progress Updates" sub="A simple project snapshot your client can read quickly on mobile or desktop.">
            <div style={{ display:"grid",gap:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap" }}>
                {timelineStages.map(([id, label], idx) => {
                  const done = activeStageIndex >= idx && activeStageIndex !== -1;
                  const active = visibleStageId === id;
                  return (
                    <div key={id} style={{ flex:"1 1 120px",minWidth:120 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                        <div style={{ width:14,height:14,borderRadius:"50%",background:active ? brandColor : done ? "#7cb6ff" : "#d8e4f0",boxShadow:active ? `0 0 0 4px ${brandColor}22` : "none" }} />
                        <div style={{ fontSize:13,fontWeight:700,color:active ? "#17324d" : "#58718a" }}>{label}</div>
                      </div>
                      <div style={{ height:6,borderRadius:999,background:"#e8f0f8",overflow:"hidden" }}>
                        <div style={{ width:done ? "100%" : "0%",height:"100%",background:brandColor,transition:"width .25s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {clientStageNote && (
                <div style={{ padding:"12px 14px",borderRadius:16,background:"#f5f9ff",border:"1px solid #dce9f6",fontSize:13.5,color:"#4d6780",lineHeight:1.6 }}>
                  {clientStageNote}
                </div>
              )}
              {activity.length > 0 && (
                <div style={{ display:"grid",gap:10 }}>
                  {activity.map(item => (
                    <div key={item.id} style={{ display:"flex",gap:12,alignItems:"flex-start",padding:"12px 0",borderBottom:"1px solid #e7eef6" }}>
                      <div style={{ width:12,height:12,borderRadius:"50%",marginTop:5,background:item.type === "report" ? "#f0954e" : item.type === "file" ? "#4a90d9" : item.type === "video" ? "#8b7cf8" : item.type === "note" ? "#3dba7e" : brandColor,flexShrink:0 }} />
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:14,fontWeight:700,color:"#17324d" }}>{item.title}</div>
                        <div style={{ fontSize:13,color:"#68819b",marginTop:2 }}>{item.detail}</div>
                      </div>
                      <div style={{ fontSize:12,color:"#8aa0b5",whiteSpace:"nowrap" }}>{formatPortalRelativeLabel(item.when)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {teamMessages.length > 0 && (
          <Section title="Messages From Our Team" sub="Client-friendly notes and updates posted by your project team.">
            <div style={{ display:"grid",gap:10 }}>
              {teamMessages.map(message => (
                <div key={message.id} style={{ padding:"14px 15px",borderRadius:18,background:"#f8fbff",border:"1px solid #dfeaf5" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:6,flexWrap:"wrap" }}>
                    <div style={{ fontSize:13.5,fontWeight:800,color:"#17324d" }}>{message.author || "Project team"}</div>
                    <div style={{ fontSize:12,color:"#8aa0b5",whiteSpace:"nowrap" }}>{formatPortalRelativeLabel(message.createdAt)}</div>
                  </div>
                  <div style={{ fontSize:13.4,color:"#55708a",lineHeight:1.65 }}>{message.text}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {photos.length > 0 && (
          <Section title="Project Photos" sub="Recent images shared for this project.">
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12 }}>
              {photos.slice(0, 12).map(photo => (
                <div key={photo.id} style={{ background:"#f8fbff",border:"1px solid #dfeaf5",borderRadius:18,overflow:"hidden" }}>
                  <div style={{ aspectRatio:"4 / 3",background:"#eaf2fb" }}>
                    {photo.dataUrl
                      ? <img src={photo.dataUrl} alt={photo.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.image} size={26} stroke="#7a95af" /></div>}
                  </div>
                  <div style={{ padding:"12px 12px 13px" }}>
                    <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{photo.name || "Project photo"}</div>
                    <div style={{ fontSize:12.5,color:"#6c849b",marginTop:4 }}>{photo.room || "General"}{photo.floor ? ` â¢ ${photo.floor}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {videos.length > 0 && (
          <Section title="Project Videos" sub="Video walk-throughs and shared clips.">
            <div style={{ display:"grid",gap:10 }}>
              {videos.slice(0, 8).map(video => (
                <div key={video.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 14px",borderRadius:18,background:"#f8fbff",border:"1px solid #dfeaf5" }}>
                  <div style={{ width:42,height:42,borderRadius:14,background:"#e9f2ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.video} size={18} stroke={brandColor} /></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{video.name || "Project video"}</div>
                    <div style={{ fontSize:12.5,color:"#6c849b",marginTop:3 }}>{video.room || "General area"}</div>
                  </div>
                  {video.dataUrl && <a href={video.dataUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12.5,fontWeight:700,color:brandColor,textDecoration:"none" }}>Open</a>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {sketches.length > 0 && (
          <Section title="Sketches & Plans" sub="Reference sketches, markups, and floor plans shared with the client.">
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12 }}>
              {sketches.slice(0, 8).map(sketch => (
                <div key={sketch.id} style={{ border:"1px solid #dfeaf5",borderRadius:18,overflow:"hidden",background:"#fff" }}>
                  <div style={{ aspectRatio:"4 / 3",background:"#edf5ff" }}>
                    {sketch.dataUrl
                      ? <img src={sketch.dataUrl} alt={sketch.title} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.sketch} size={26} stroke="#7a95af" /></div>}
                  </div>
                  <div style={{ padding:"12px 13px 14px" }}>
                    <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{sketch.title || "Project sketch"}</div>
                    <div style={{ fontSize:12.5,color:"#6c849b",marginTop:4 }}>{sketch.floorLabel || sketch.roomTag || "Shared drawing"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {(reports.length > 0 || files.length > 0) && (
          <Section title="Documents & Files" sub="Reports and shared project documents for easy client access.">
            <div style={{ display:"grid",gap:10 }}>
              {reports.slice(0, 8).map(report => (
                <div key={report.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 14px",borderRadius:18,background:"#f8fbff",border:"1px solid #dfeaf5" }}>
                  <div style={{ width:42,height:42,borderRadius:14,background:"#fff2e5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.reports} size={18} stroke="#f0954e" /></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{report.title || report.type || "Project report"}</div>
                    <div style={{ fontSize:12.5,color:"#6c849b",marginTop:3 }}>{report.type || "Report"}{report.createdAt ? ` â¢ ${formatPortalRelativeLabel(report.createdAt)}` : ""}</div>
                  </div>
                </div>
              ))}
              {files.slice(0, 10).map(file => (
                <div key={file.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 14px",borderRadius:18,background:"#f8fbff",border:"1px solid #dfeaf5" }}>
                  <div style={{ width:42,height:42,borderRadius:14,background:"#e9f2ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.folder} size={18} stroke={brandColor} /></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{file.name || "Shared file"}</div>
                    <div style={{ fontSize:12.5,color:"#6c849b",marginTop:3 }}>{file.category || file.kind || "Project file"}{file.size ? ` â¢ ${formatFileSizeLabel(file.size)}` : ""}</div>
                  </div>
                  {file.dataUrl && <a href={file.dataUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12.5,fontWeight:700,color:brandColor,textDecoration:"none" }}>Open</a>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {portal.allowClientNotes && (
          <Section title="Client Notes" sub="A simple place for the client to leave notes, questions, or additional details.">
            <div style={{ display:"grid",gap:12 }}>
              <ClientPortalNotesForm onAdd={onAddClientNote} accent={brandColor} />
              {(portal.clientNotes || []).length > 0 && (
                <div style={{ display:"grid",gap:10 }}>
                  {(portal.clientNotes || []).slice().reverse().map(note => (
                    <div key={note.id} style={{ padding:"12px 14px",borderRadius:18,background:"#f8fbff",border:"1px solid #dfeaf5" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",gap:10,marginBottom:5 }}>
                        <div style={{ fontSize:13.5,fontWeight:700,color:"#17324d" }}>{note.author || "Client note"}</div>
                        <div style={{ fontSize:12,color:"#8aa0b5",whiteSpace:"nowrap" }}>{formatPortalRelativeLabel(note.createdAt)}</div>
                      </div>
                      <div style={{ fontSize:13.2,color:"#55708a",lineHeight:1.6 }}>{note.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {portal.reviewEnabled && portal.reviewUrl && (
          <div style={{ background:"#fff7ec",border:"1px solid #f5d7aa",borderRadius:22,padding:"18px 18px 16px",display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:18,fontWeight:800,color:"#17324d" }}>Enjoying the experience so far?</div>
              <div style={{ fontSize:13,color:"#7b6a52",marginTop:5,lineHeight:1.55 }}>If you’d like, you can leave feedback for our team using the review link below.</div>
            </div>
            <a href={portal.reviewUrl} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"12px 18px",borderRadius:999,background:"#f0a34d",color:"white",fontWeight:800,textDecoration:"none" }}>
              <Icon d={ic.star} size={15} stroke="white" /> {portal.reviewLabel || "Leave us a Review"}
            </a>
          </div>
        )}

        <div style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",padding:"8px 2px 2px" }}>
          <div style={{ display:"flex",gap:16,flexWrap:"wrap",fontSize:13,color:"#58718a" }}>
            {settings?.companyName && <span>{settings.companyName}</span>}
            {settings?.email && <a href={`mailto:${settings.email}`} style={{ color:"#58718a",textDecoration:"none" }}>{settings.email}</a>}
            {settings?.phone && <a href={`tel:${String(settings.phone).replace(/\D/g,"")}`} style={{ color:"#58718a",textDecoration:"none" }}>{settings.phone}</a>}
            {settings?.website && <a href={settings.website} target="_blank" rel="noopener noreferrer" style={{ color:"#58718a",textDecoration:"none" }}>{settings.website}</a>}
          </div>
          <div style={{ fontSize:12.5,color:"#8aa0b5" }}>Powered by <strong>KrakenCam</strong></div>
        </div>
      </div>
    </div>
  );
}

function ClientPortalNotesForm({ onAdd, accent = "#2b7fe8" }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const submit = () => {
    if (!note.trim()) return;
    onAdd({ author: name.trim() || "Client", text: note.trim() });
    setName("");
    setNote("");
  };
  return (
    <div style={{ display:"grid",gap:10 }}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10 }}>
        <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name (optional)" style={{ background:"#fff" }} />
        <button className="btn btn-primary" onClick={submit} style={{ justifyContent:"center",background:accent,border:"none" }}>
          <Icon d={ic.message} size={14} /> Send Note
        </button>
      </div>
      <textarea className="form-input form-textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="Share a question, scheduling note, or anything else you'd like our team to know." style={{ minHeight:96,background:"#fff" }} />
    </div>
  );
}

export function ClientPortalUpgradePrompt({ settings = {} }) {
  const userRole = settings?.userRole || "admin";
  const canUpgrade = userRole === "admin" || userRole === "manager";
  return (
    <div className="card">
      <div className="card-header"><span style={{ fontWeight:700 }}>Client Portal</span></div>
      <div className="card-body" style={{ display:"grid",gap:16 }}>
        <div style={{ padding:"16px 18px",borderRadius:18,background:"linear-gradient(180deg,#f7fbff 0%,#eff6ff 100%)",border:"1px solid #d8e8fb" }}>
          <div style={{ fontSize:12,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",color:"var(--accent)",marginBottom:8 }}>Command III Feature</div>
          <div style={{ fontSize:20,fontWeight:900,color:"#17324d",marginBottom:8 }}>Client Portal is available on Command III desktop only</div>
          <div style={{ fontSize:13.5,color:"#5f7b96",lineHeight:1.6 }}>
            This feature is locked on Capture I and Intelligence II. Upgrade to Command III to share a branded project portal with clients and control exactly what they can see.
          </div>
        </div>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          {canUpgrade
            ? <button className="btn btn-primary" onClick={() => alert("Upgrade this workspace to Command III in Account > Billing when the hosted billing flow is connected.")}>
                <Icon d={ic.arrowUpRight} size={14} /> Upgrade to Command III
              </button>
            : <button className="btn btn-secondary" onClick={() => alert("Please contact your admin or manager to upgrade this workspace to Command III.")}>
                <Icon d={ic.message} size={14} /> Talk to Your Admin
              </button>}
          <button className="btn btn-secondary" onClick={() => alert("Client Portal works on desktop only so you can review and approve shared items more comfortably.")}>
            <Icon d={ic.eye} size={14} /> Why Desktop Only?
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClientPortalDesktopOnlyPrompt() {
  return (
    <div className="card">
      <div className="card-header"><span style={{ fontWeight:700 }}>Client Portal</span></div>
      <div className="card-body" style={{ display:"grid",gap:14 }}>
        <div style={{ padding:"16px 18px",borderRadius:18,background:"linear-gradient(180deg,#f7fbff 0%,#eff6ff 100%)",border:"1px solid #d8e8fb" }}>
          <div style={{ fontSize:20,fontWeight:900,color:"#17324d",marginBottom:8 }}>Open this feature on desktop</div>
          <div style={{ fontSize:13.5,color:"#5f7b96",lineHeight:1.6 }}>
            Client Portal approvals are desktop-only so your team can review photos, videos, files, and reports comfortably before sharing them with the client.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientPortalTab({ project, settings = {}, onUpdateProject }) {
  const portal = ensureClientPortal(project, settings);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [expandedPreviewKey, setExpandedPreviewKey] = useState(null);
  const [teamMessageDraft, setTeamMessageDraft] = useState("");
  const portalLink = `${typeof window !== "undefined" ? window.location.origin : "https://app.krakencam.com"}/client-portal/${portal.slug}`;
  const canManagePortalMessages = ["admin", "manager"].includes(settings?.userRole || "admin");
  const patchPortal = (patch) => onUpdateProject({ ...project, clientPortal: { ...portal, ...patch } });
  const toggle = (key) => patchPortal({ [key]: !portal[key] });
  const updateProjectItems = (key, updater) => onUpdateProject({ ...project, [key]: updater(project[key] || []) });
  const toggleItemApproval = (key, itemId) => updateProjectItems(key, items => items.map(item => item.id !== itemId ? item : { ...item, clientPortalVisible: !item.clientPortalVisible }));
  const addClientNote = ({ author, text }) => patchPortal({
    clientNotes: [...(portal.clientNotes || []), { id:uid(), author, text, createdAt:new Date().toISOString() }],
  });
  const addTeamMessage = () => {
    const text = teamMessageDraft.trim();
    if (!text || !canManagePortalMessages) return;
    patchPortal({
      teamMessages: [
        ...(portal.teamMessages || []),
        {
          id: uid(),
          author: `${settings?.userFirstName || ""} ${settings?.userLastName || ""}`.trim() || "Project team",
          role: settings?.userRole || "admin",
          text,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setTeamMessageDraft("");
  };
  const removeTeamMessage = (messageId) => patchPortal({
    teamMessages: (portal.teamMessages || []).filter(msg => msg.id !== messageId),
  });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const visibleCounts = [
    portal.sharePhotos ? `${filterPortalApprovedItems(project.photos).length || 0} approved photos` : null,
    portal.shareVideos ? `${filterPortalApprovedItems(project.videos).length || 0} approved videos` : null,
    portal.shareSketches ? `${filterPortalApprovedItems(project.sketches).length || 0} approved sketches` : null,
    portal.shareReports ? `${filterPortalApprovedItems(project.reports).length || 0} approved reports` : null,
    portal.shareFiles ? `${filterPortalApprovedItems(project.files).length || 0} approved files` : null,
  ].filter(Boolean);
  const approvalSections = [
    { key:"photos", title:"Approved Photos", enabled:portal.sharePhotos, items:(project.photos || []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a)), label:item => item.name || "Project photo", sub:item => `${item.room || "General"}${item.floor ? ` â¢ ${item.floor}` : ""}`, previewKind:"image" },
    { key:"videos", title:"Approved Videos", enabled:portal.shareVideos, items:(project.videos || []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a)), label:item => item.name || "Project video", sub:item => item.room || "General area", previewKind:"video" },
    { key:"sketches", title:"Approved Sketches", enabled:portal.shareSketches, items:(project.sketches || []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a)), label:item => item.title || "Project sketch", sub:item => item.floorLabel || item.roomTag || "Shared drawing", previewKind:"image" },
    { key:"reports", title:"Approved Reports", enabled:portal.shareReports, items:(project.reports || []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a)), label:item => item.title || item.type || "Project report", sub:item => item.type || "Report", previewKind:"report" },
    { key:"files", title:"Approved Files", enabled:portal.shareFiles, items:(project.files || []).slice().sort((a,b) => getPortalItemDateValue(b) - getPortalItemDateValue(a)), label:item => item.name || "Shared file", sub:item => item.category || item.kind || "Project file", previewKind:"file" },
  ];
  return (
    <div style={{ display:"grid",gap:16 }}>
      <div className="card">
        <div className="card-header"><span style={{ fontWeight:700 }}>Client Portal</span></div>
        <div className="card-body" style={{ display:"grid",gap:18 }}>
          <div style={{ display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap",padding:"14px 16px",border:"1px solid var(--border)",borderRadius:16,background:"linear-gradient(180deg,#f7fbff 0%,#f1f7ff 100%)" }}>
            <div>
              <div style={{ fontSize:16,fontWeight:800,color:"#17324d" }}>Private, project-only client portal</div>
              <div style={{ fontSize:13,color:"#5f7b96",marginTop:5,lineHeight:1.55,maxWidth:720 }}>
                Share a clean project page with your client that only shows this jobsite’s updates, files, photos, videos, sketches, reports, and notes.
              </div>
            </div>
            <div onClick={() => toggle("enabled")} style={{ width:56,height:30,borderRadius:999,background:portal.enabled ? "var(--accent)" : "var(--surface3)",position:"relative",cursor:"pointer",flexShrink:0 }}>
              <div style={{ position:"absolute",top:3,left:portal.enabled ? 29 : 3,width:24,height:24,borderRadius:"50%",background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,.18)",transition:"left .2s" }} />
            </div>
          </div>

          <div className="form-row" style={{ alignItems:"end" }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Portal Link</label>
              <input className="form-input" value={portalLink} readOnly style={{ background:"var(--surface2)" }} />
            </div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              <button className="btn btn-secondary" onClick={copyLink}><Icon d={ic.copy} size={14} /> {copied ? "Copied" : "Copy Link"}</button>
              <button className="btn btn-primary" onClick={async () => {
                // Publish portal snapshot to Supabase so clients can view it publicly
                const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
                const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const approvedProject = withPortalFilteredProject(project);
                const payload = {
                  slug:          portal.slug,
                  project_id:    project.id,
                  project_data:  { ...approvedProject, clientPortal: portal },
                  portal_config: portal,
                  brand_color:   settings?.accent || "#2b7fe8",
                  active:        true,
                  updated_at:    new Date().toISOString(),
                };
                await fetch(`${SUPABASE_URL}/rest/v1/published_portals`, {
                  method: "POST",
                  headers: await getAuthHeaders({ "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" }),
                  body: JSON.stringify(payload),
                }).catch(e => console.warn("Portal publish error:", e));
                await copyLink();
              }}>
                <Icon d={ic.arrowUpRight} size={14} /> Publish & Copy Link
              </button>
              <button className="btn btn-secondary" onClick={() => setShowPreview(v => !v)}><Icon d={ic.eye} size={14} /> {showPreview ? "Hide Preview" : "Show Preview"}</button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Welcome Title</label>
              <input className="form-input" value={portal.welcomeTitle || ""} onChange={e=>patchPortal({ welcomeTitle:e.target.value })} placeholder={`Hi${project.clientName ? ` ${project.clientName}` : ""}, here’s your project update`} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Review Button Label</label>
              <input className="form-input" value={portal.reviewLabel || ""} onChange={e=>patchPortal({ reviewLabel:e.target.value })} placeholder="Leave us a Review" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Friendly Welcome Message</label>
            <textarea className="form-input form-textarea" value={portal.welcomeMessage || ""} onChange={e=>patchPortal({ welcomeMessage:e.target.value })} placeholder="Write a short, client-friendly note to explain what they’ll find here." style={{ minHeight:90 }} />
          </div>

          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Team Messages For The Client</label>
            {canManagePortalMessages ? (
              <div style={{ display:"grid",gap:10 }}>
                <textarea
                  className="form-input form-textarea"
                  value={teamMessageDraft}
                  onChange={e=>setTeamMessageDraft(e.target.value)}
                  placeholder="Leave a friendly update, scheduling note, or project message for the client portal."
                  style={{ minHeight:90 }}
                />
                <div style={{ display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap" }}>
                  <div style={{ fontSize:12.5,color:"var(--text2)" }}>These messages appear in a dedicated client-facing section on the portal.</div>
                  <button className="btn btn-secondary" onClick={addTeamMessage} disabled={!teamMessageDraft.trim()}>
                    <Icon d={ic.message} size={14} /> Post Message
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding:"12px 14px",borderRadius:14,background:"var(--surface2)",border:"1px solid var(--border)",fontSize:12.8,color:"var(--text2)",lineHeight:1.6 }}>
                Only admins and managers can post client-facing team messages.
              </div>
            )}
            {(portal.teamMessages || []).length > 0 && (
              <div style={{ display:"grid",gap:8,marginTop:10 }}>
                {(portal.teamMessages || []).slice().reverse().map(message => (
                  <div key={message.id} style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",padding:"11px 12px",borderRadius:14,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13.2,fontWeight:700 }}>{message.author || "Project team"}</div>
                      <div style={{ fontSize:12,color:"var(--text3)",marginTop:2 }}>{formatPortalRelativeLabel(message.createdAt)}</div>
                      <div style={{ fontSize:12.8,color:"var(--text2)",marginTop:7,lineHeight:1.55 }}>{message.text}</div>
                    </div>
                    {canManagePortalMessages && (
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeTeamMessage(message.id)} title="Delete message">
                        <Icon d={ic.trash} size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10 }}>
            {[
              ["shareProgress","Progress updates"],
              ["sharePhotos","Photos"],
              ["shareVideos","Videos"],
              ["shareSketches","Sketches"],
              ["shareReports","Reports"],
              ["shareFiles","Files"],
              ["allowClientNotes","Client notes"],
            ].map(([key, label]) => (
              <div key={key} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 12px",border:"1px solid var(--border)",borderRadius:14,background:"var(--surface2)" }}>
                <span style={{ fontSize:13.2,fontWeight:700 }}>{label}</span>
                <div onClick={() => toggle(key)} style={{ width:44,height:24,borderRadius:999,background:portal[key] ? "var(--accent)" : "var(--surface3)",position:"relative",cursor:"pointer",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:3,left:portal[key] ? 23 : 3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Review Request</label>
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"1px solid var(--border)",borderRadius:14,background:"var(--surface2)" }}>
                <div style={{ fontSize:13,color:"var(--text2)",flex:1 }}>Show a Google or custom review link in the portal</div>
                <div onClick={() => toggle("reviewEnabled")} style={{ width:44,height:24,borderRadius:999,background:portal.reviewEnabled ? "var(--accent)" : "var(--surface3)",position:"relative",cursor:"pointer",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:3,left:portal.reviewEnabled ? 23 : 3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s" }} />
                </div>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Review URL</label>
              <input className="form-input" value={portal.reviewUrl || ""} onChange={e=>patchPortal({ reviewUrl:e.target.value })} placeholder="https://g.page/r/your-google-review-link" />
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Portal Password</label>
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"1px solid var(--border)",borderRadius:14,background:"var(--surface2)" }}>
                <div style={{ fontSize:13,color:"var(--text2)",flex:1 }}>Require a password before the client can open this portal</div>
                <div onClick={() => patchPortal({ passwordEnabled: !portal.passwordEnabled })} style={{ width:44,height:24,borderRadius:999,background:portal.passwordEnabled ? "var(--accent)" : "var(--surface3)",position:"relative",cursor:"pointer",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:3,left:portal.passwordEnabled ? 23 : 3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s" }} />
                </div>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Project Password</label>
              <input
                className="form-input"
                type="text"
                value={portal.password || ""}
                onChange={e=>patchPortal({ password: e.target.value })}
                placeholder="Set a unique portal password"
                disabled={!portal.passwordEnabled}
              />
            </div>
          </div>

          <div style={{ padding:"12px 14px",borderRadius:14,background:"var(--surface2)",border:"1px solid var(--border)",fontSize:12.8,color:"var(--text2)",lineHeight:1.6 }}>
            <strong style={{ color:"var(--text)" }}>Portal scope:</strong> this share is limited to <strong>{project.title}</strong> only. It does not expose any other jobsites or internal account information.
            {visibleCounts.length > 0 && <span> Currently shared: {visibleCounts.join(", ")}.</span>}
            {portal.passwordEnabled && portal.password && <span> Password protection is enabled for this project.</span>}
          </div>

          <div style={{ display:"grid",gap:14 }}>
            <div style={{ fontSize:15,fontWeight:800 }}>Approve Exactly What The Client Sees</div>
            <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
              Turning a section on does not share everything automatically. Use the approvals below to choose the exact photos, videos, sketches, reports, and files that should appear in this portal.
            </div>
            {approvalSections.map(section => {
              const approvedCount = filterPortalApprovedItems(section.items).length;
              return (
                <div key={section.key} style={{ border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",background:"var(--surface)" }}>
                  <div style={{ padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:14,fontWeight:800 }}>{section.title}</div>
                      <div style={{ fontSize:12.5,color:"var(--text2)",marginTop:3 }}>
                        {section.enabled ? `${approvedCount} of ${section.items.length} approved for the client` : "This section is currently hidden from the client portal"}
                      </div>
                    </div>
                    <div style={{ fontSize:11.5,fontWeight:700,padding:"4px 10px",borderRadius:999,background:approvedCount ? "var(--accent-glow)" : "var(--surface2)",color:approvedCount ? "var(--accent)" : "var(--text3)" }}>
                      {approvedCount} Approved
                    </div>
                  </div>
                  <div style={{ padding:"10px 12px",display:"grid",gap:8,maxHeight:320,overflowY:"auto" }}>
                    {section.items.length === 0 && (
                      <div style={{ fontSize:12.5,color:"var(--text3)",padding:"8px 4px" }}>No items available in this section yet.</div>
                    )}
                    {section.items.map(item => {
                      const approved = isPortalApprovedItem(item);
                      const canPreview = section.previewKind === "image" || section.previewKind === "video" || (section.previewKind === "file" && isPreviewableFile(item));
                      const previewKey = `${section.key}-${item.id}`;
                      const previewOpen = expandedPreviewKey === previewKey;
                      return (
                        <div key={item.id} style={{ display:"grid",gap:10,padding:"10px 12px",borderRadius:14,background:approved ? "var(--accent-glow)" : "var(--surface2)",border:`1px solid ${approved ? "var(--accent)" : "var(--border)"}` }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                            {(section.previewKind === "image" || section.previewKind === "video") ? (
                              <button
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={() => setExpandedPreviewKey(previewOpen ? null : previewKey)}
                                style={{ width:64,height:64,padding:0,borderRadius:12,overflow:"hidden",border:"1px solid var(--border)",background:"var(--surface)",flexShrink:0 }}
                                title="Preview"
                              >
                                {item.dataUrl
                                  ? section.previewKind === "video"
                                    ? <div style={{ position:"relative",width:"100%",height:"100%" }}>
                                        <video src={item.dataUrl} style={{ width:"100%",height:"100%",objectFit:"cover" }} muted />
                                        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.18)" }}><Icon d={ic.video} size={18} stroke="white" /></div>
                                      </div>
                                    : <img src={item.dataUrl} alt={section.label(item)} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                                  : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={section.previewKind === "video" ? ic.video : ic.image} size={18} stroke="var(--text3)" /></div>}
                              </button>
                            ) : (
                              <div style={{ width:64,height:64,borderRadius:12,overflow:"hidden",border:"1px solid var(--border)",background:"var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                <Icon d={section.previewKind === "report" ? ic.reports : ic.folder} size={20} stroke={section.previewKind === "report" ? "#f0954e" : "var(--accent)"} />
                              </div>
                            )}
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:13.4,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{section.label(item)}</div>
                              <div style={{ fontSize:12,color:"var(--text2)",marginTop:4,display:"flex",gap:8,flexWrap:"wrap" }}>
                                <span>{section.sub(item)}</span>
                                <span>{formatPortalRelativeLabel(item.updatedAt || item.createdAt || item.addedAt || item.date)}</span>
                              </div>
                            </div>
                            <div style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
                              {canPreview && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setExpandedPreviewKey(previewOpen ? null : previewKey)} style={{ minWidth:96,justifyContent:"center" }}>
                                  <Icon d={previewOpen ? ic.chevDown : ic.eye} size={14} /> {previewOpen ? "Hide" : "Preview"}
                                </button>
                              )}
                              <button className={approved ? "btn btn-primary" : "btn btn-secondary"} onClick={() => toggleItemApproval(section.key, item.id)} style={{ minWidth:116,justifyContent:"center" }}>
                                <Icon d={approved ? ic.check : ic.eye} size={14} /> {approved ? "Approved" : "Approve"}
                              </button>
                            </div>
                          </div>
                          {previewOpen && canPreview && (
                            <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden" }}>
                              {(section.previewKind === "image" || section.previewKind === "video") && (
                                item.dataUrl
                                  ? section.previewKind === "video"
                                    ? <video src={item.dataUrl} controls style={{ width:"100%",maxHeight:420,background:"#000",display:"block" }} />
                                    : <img src={item.dataUrl} alt={section.label(item)} style={{ width:"100%",maxHeight:420,objectFit:"contain",display:"block",background:"var(--surface2)" }} />
                                  : <div style={{ padding:24,textAlign:"center",color:"var(--text3)" }}>No preview available.</div>
                              )}
                              {section.previewKind === "file" && item.dataUrl && isPreviewableFile(item) && (
                                item.type === "application/pdf"
                                  ? <iframe title={section.label(item)} src={item.dataUrl} style={{ width:"100%",height:420,border:"none" }} />
                                  : item.type?.startsWith("image/")
                                    ? <img src={item.dataUrl} alt={section.label(item)} style={{ width:"100%",maxHeight:420,objectFit:"contain",display:"block" }} />
                                    : <iframe title={section.label(item)} src={item.dataUrl} style={{ width:"100%",height:420,border:"none",background:"#fff" }} />
                              )}
                              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,padding:12 }}>
                                <div style={{ padding:"10px 12px",border:"1px solid var(--border)",borderRadius:12,background:"var(--surface2)" }}>
                                  <div style={{ fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)" }}>Details</div>
                                  <div style={{ fontSize:13.2,color:"var(--text2)",marginTop:5 }}>{section.sub(item)}</div>
                                </div>
                                <div style={{ padding:"10px 12px",border:"1px solid var(--border)",borderRadius:12,background:"var(--surface2)" }}>
                                  <div style={{ fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)" }}>Status</div>
                                  <div style={{ fontSize:13.2,color:approved ? "var(--accent)" : "var(--text2)",fontWeight:700,marginTop:5 }}>{approved ? "Approved for client portal" : "Not approved yet"}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showPreview && (
        <ClientPortalPreview
          project={{ ...withPortalFilteredProject(project), clientPortal: portal }}
          settings={settings}
          portal={portal}
          onAddClientNote={addClientNote}
        />
      )}
    </div>
  );
}

export function BAPairCard({ pair, bPhoto, aPhoto, onDelete, settings }) {
  const [mode, setMode] = useState("slider"); // "slider" | "sidebyside"
  const [confirmDel, setConfirmDel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [maxWidth, setMaxWidth] = useState("800");
  const [showCompanyLogo, setShowCompanyLogo] = useState(true);

  const companyLogo = settings?.logo || null;

  const generateEmbed = () => buildEmbedCode(pair, bPhoto, aPhoto, maxWidth, showCompanyLogo ? companyLogo : null, settings?.logo);

  const copyEmbed = () => {
    const code = generateEmbed();
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    });
  };

  const exportPair = () => {
    if (!bPhoto?.dataUrl || !aPhoto?.dataUrl) return;
    setExporting(true);
    const W=1200, H=500, pad=16, labelH=30;
    const half = Math.floor((W - pad * 3) / 2);
    const imgH = H - labelH - pad * 2;

    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = src;
    });

    const drawSide = (ctx, img, x, label) => {
      const ar = img.width / img.height;
      const boxAr = half / imgH;
      let sw, sh, sx, sy;
      if (ar > boxAr) { sh = img.height; sw = sh * boxAr; sx = (img.width - sw) / 2; sy = 0; }
      else            { sw = img.width;  sh = sw / boxAr; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, x, pad, half, imgH);
      // label bar
      ctx.fillStyle = "rgba(0,0,0,.7)";
      ctx.fillRect(x, pad + imgH - labelH, half, labelH);
      ctx.fillStyle = "white";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + half / 2, pad + imgH - labelH / 2 + 6);
    };

    Promise.all([loadImage(bPhoto.dataUrl), loadImage(aPhoto.dataUrl)])
      .then(([bImg, aImg]) => {
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        // Background
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, W, H);
        // Draw both sides
        drawSide(ctx, bImg, pad,           "BEFORE");
        drawSide(ctx, aImg, pad * 2 + half, "AFTER");
        // Pair name at top
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(pair.name || "Before & After", pad, 14);
        // Company logo (top-left of first image)
        const finalize = () => {
          canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(pair.name || "before-after").replace(/[^a-z0-9]/gi,"_")}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            setExporting(false);
          }, "image/jpeg", 0.92);
        };
        if (showCompanyLogo && companyLogo) {
          loadImage(companyLogo).then(logoImg => {
            const logoH = 72, logoW = Math.min(logoImg.width * (logoH / logoImg.height), 180);
            const lx = pad + 8, ly = pad + 8;
            ctx.fillStyle = "rgba(0,0,0,.45)";
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(lx - 4 + r, ly - 4);
            ctx.lineTo(lx - 4 + logoW + 8 - r, ly - 4);
            ctx.quadraticCurveTo(lx - 4 + logoW + 8, ly - 4, lx - 4 + logoW + 8, ly - 4 + r);
            ctx.lineTo(lx - 4 + logoW + 8, ly - 4 + logoH + 8 - r);
            ctx.quadraticCurveTo(lx - 4 + logoW + 8, ly - 4 + logoH + 8, lx - 4 + logoW + 8 - r, ly - 4 + logoH + 8);
            ctx.lineTo(lx - 4 + r, ly - 4 + logoH + 8);
            ctx.quadraticCurveTo(lx - 4, ly - 4 + logoH + 8, lx - 4, ly - 4 + logoH + 8 - r);
            ctx.lineTo(lx - 4, ly - 4 + r);
            ctx.quadraticCurveTo(lx - 4, ly - 4, lx - 4 + r, ly - 4);
            ctx.closePath();
            ctx.fill();
            ctx.drawImage(logoImg, lx, ly, logoW, logoH);
            finalize();
          }).catch(finalize);
        } else {
          finalize();
        }
        return; // finalize called asynchronously above
      })
      .catch(() => setExporting(false));
  };

  return (
    <div style={{ background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"8px 14px",borderBottom:"1px solid var(--border)" }}>
        {/* Row 1: title + room tag + date */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
              {pair.name}
              {pair.room && <span style={{ fontSize:10.5,fontWeight:600,color:"var(--text3)",background:"var(--surface3)",padding:"1px 7px",borderRadius:10,border:"1px solid var(--border)" }}>{pair.room}</span>}
            </div>
            {pair.notes && <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{pair.notes}</div>}
          </div>
          <span style={{ fontSize:11,color:"var(--text3)",flexShrink:0 }}>{pair.createdAt}</span>
        </div>
        {/* Row 2: action buttons */}
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          {/* View toggle */}
          <div style={{ display:"flex",background:"var(--surface3)",borderRadius:6,padding:2,border:"1px solid var(--border)",flexShrink:0 }}>
            {[{v:"slider",icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",tip:"Slider"},{v:"sidebyside",icon:ic.layers,tip:"Side by side"}].map(({v,icon,tip})=>(
              <button key={v} title={tip} onClick={()=>setMode(v)} className="btn btn-ghost btn-sm btn-icon ba-icon-btn"
                style={{ width:32,height:32,background:mode===v?"var(--accent)":"transparent",color:mode===v?"white":"var(--text3)",borderRadius:4 }}>
                <Icon d={icon} size={16}/>
              </button>
            ))}
          </div>
          {/* Company logo toggle */}
          {companyLogo && (
            <button className="btn btn-ghost btn-sm btn-icon ba-icon-btn" title={showCompanyLogo ? "Hide company logo" : "Show company logo"}
              onClick={()=>setShowCompanyLogo(v=>!v)}
              style={{ width:32,height:32,color:showCompanyLogo?"var(--accent)":"var(--text3)",flexShrink:0 }}>
              <Icon d={ic.image} size={16}/>
            </button>
          )}
          {/* Embed code button */}
          <button className="btn btn-ghost btn-sm btn-icon ba-icon-btn" title="Get embed code for website"
            style={{ width:32,height:32,color:showEmbed?"var(--accent)":"var(--text3)",flexShrink:0 }}
            disabled={!bPhoto?.dataUrl || !aPhoto?.dataUrl}
            onClick={()=>setShowEmbed(v=>!v)}>
            <Icon d={ic.link} size={16}/>
          </button>
          {/* Export combined image */}
          <button className="btn btn-ghost btn-sm btn-icon ba-icon-btn" title="Export as combined image"
            style={{ width:32,height:32,color:exporting?"var(--accent)":"var(--text3)",flexShrink:0 }}
            disabled={exporting || !bPhoto?.dataUrl || !aPhoto?.dataUrl}
            onClick={exportPair}>
            <Icon d={exporting ? ic.timer : ic.download} size={16}/>
          </button>
          <div style={{ flex:1 }} />
          {!confirmDel && (
            <button className="btn btn-ghost btn-sm btn-icon ba-icon-btn" style={{ width:32,height:32,color:"#e85a3a",flexShrink:0 }} onClick={()=>setConfirmDel(true)}><Icon d={ic.trash} size={16}/></button>
          )}
        </div>
        {confirmDel && (
          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"8px 10px",background:"rgba(232,90,58,.08)",borderRadius:6,border:"1px solid rgba(232,90,58,.25)" }}>
            <span style={{ fontSize:12,color:"#e85a3a",fontWeight:600,flex:1 }}>Delete this pair?</span>
            <button className="btn btn-sm" style={{ background:"#e85a3a",border:"none",color:"white",padding:"4px 16px",fontSize:12,fontWeight:700,flexShrink:0 }} onClick={onDelete}>Yes, delete</button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize:12,padding:"4px 12px",flexShrink:0 }} onClick={()=>setConfirmDel(false)}>Cancel</button>
          </div>
        )}
      </div>
      {mode==="slider"
        ? <div style={{ position:"relative" }}>
            <BAPairSlider bPhoto={bPhoto} aPhoto={aPhoto} />
            {showCompanyLogo && companyLogo && (
              <div style={{ position:"absolute",top:8,left:8,pointerEvents:"none",zIndex:10 }}>
                <img src={companyLogo} alt="logo" style={{ height:64,maxWidth:160,objectFit:"contain",borderRadius:4,background:"rgba(0,0,0,.45)",padding:3 }} />
              </div>
            )}
          </div>
        : (
          <div style={{ position:"relative" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:0 }}>
              {[{label:"Before",photo:bPhoto},{label:"After",photo:aPhoto}].map(({label,photo})=>(
                <div key={label} style={{ position:"relative" }}>
                  {photo?.dataUrl
                    ? <img src={photo.dataUrl} alt={label} style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} />
                    : <div style={{ width:"100%",aspectRatio:"4/3",background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:12 }}>No photo</div>
                  }
                  <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"4px 8px",background:"rgba(0,0,0,.55)",fontSize:11,fontWeight:700,color:"white",letterSpacing:".04em",textTransform:"uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
            {showCompanyLogo && companyLogo && (
              <div style={{ position:"absolute",top:8,left:8,pointerEvents:"none",zIndex:10 }}>
                <img src={companyLogo} alt="logo" style={{ height:64,maxWidth:160,objectFit:"contain",borderRadius:4,background:"rgba(0,0,0,.45)",padding:3 }} />
              </div>
            )}
          </div>
        )
      }

      {/* ── Embed Panel ── */}
      {showEmbed && (
        <div style={{ padding:"14px 16px",borderTop:"1px solid var(--border)",background:"var(--surface)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <Icon d={ic.link} size={13} stroke="var(--accent)" />
            <span style={{ fontWeight:700,fontSize:13,flex:1 }}>Website Embed Code</span>
            <button className="btn btn-ghost btn-sm btn-icon" style={{ width:24,height:24 }} onClick={()=>setShowEmbed(false)}><Icon d={ic.close} size={13}/></button>
          </div>
          <div style={{ fontSize:12,color:"var(--text2)",marginBottom:10,lineHeight:1.6 }}>
            Paste this into any website builder's <strong>Custom HTML</strong> block (Squarespace, Wix, Webflow, WordPress, etc). The slider works fully on desktop and mobile — no plugins needed.
          </div>
          {/* Max width control */}
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
            <span style={{ fontSize:12,color:"var(--text2)",flexShrink:0 }}>Max width:</span>
            <input type="number" min="300" max="2000" step="50"
              className="form-input"
              value={maxWidth}
              onChange={e=>setMaxWidth(e.target.value)}
              style={{ width:80,padding:"3px 8px",fontSize:12 }} />
            <span style={{ fontSize:11.5,color:"var(--text3)" }}>px</span>
            <span style={{ fontSize:11,color:"var(--text3)",marginLeft:4 }}>(slider will scale responsively)</span>
          </div>
          {/* Company logo toggle in embed */}
          {companyLogo && (
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 10px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)" }}>
              <img src={companyLogo} alt="logo" style={{ height:24,maxWidth:60,objectFit:"contain",borderRadius:3,flexShrink:0 }} />
              <span style={{ fontSize:12,color:"var(--text2)",flex:1 }}>Include company logo</span>
              <div onClick={()=>setShowCompanyLogo(v=>!v)}
                style={{ width:40,height:22,borderRadius:11,background:showCompanyLogo?"var(--accent)":"var(--surface3)",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0,border:"1px solid var(--border)" }}>
                <div style={{ width:16,height:16,borderRadius:"50%",background:"white",position:"absolute",top:2,left:showCompanyLogo?21:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
              </div>
            </div>
          )}
          {/* Code block */}
          <div style={{ position:"relative" }}>
            <textarea
              readOnly
              value={generateEmbed()}
              style={{ width:"100%",boxSizing:"border-box",height:120,fontSize:10.5,fontFamily:"monospace",lineHeight:1.5,resize:"none",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",color:"var(--text2)",outline:"none" }}
              onFocus={e=>e.target.select()}
            />
          </div>
          {/* Copy button */}
          <div style={{ display:"flex",justifyContent:"flex-end",marginTop:8,gap:8 }}>
            <div style={{ fontSize:11,color:"var(--text3)",alignSelf:"center" }}>
              â  Images are embedded as data — keep file sizes reasonable.
            </div>
            <button className="btn btn-primary btn-sm" onClick={copyEmbed}
              style={{ minWidth:130,background:embedCopied?"#3dba7e":undefined,borderColor:embedCopied?"#3dba7e":undefined,transition:"background .2s" }}>
              {embedCopied
                ? <><Icon d={ic.check} size={13}/> Copied!</>
                : <><Icon d={ic.copy} size={13}/> Copy Code</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
