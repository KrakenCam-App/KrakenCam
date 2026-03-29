import React, { useState, useEffect, useRef } from "react";
import { Icon, ic } from "../utils/icons.jsx";
import { uid, formatDate, today, getCertStatus, ROLE_META, getDueUrgency } from "../utils/helpers.js";
import { DEFAULT_COLUMNS, EMPTY_TASK } from "../utils/constants.js";

const TASK_PRIORITIES = [
  { id:"critical", label:"Critical", color:"#e85a3a" },
  { id:"high",     label:"High",     color:"#e8703a" },
  { id:"medium",   label:"Medium",   color:"#e8c53a" },
  { id:"low",      label:"Low",      color:"#3dba7e" },
];

function TaskModal({ task, projects, teamUsers, settings, onSave, onClose, onNotify }) {
  const isNew = !task?.id;
  const [form, setForm] = useState(isNew
    ? { ...EMPTY_TASK, id:uid(), createdAt:today() }
    : { ...task, checklist: task.checklist||[], comments: task.comments||[], tags: task.tags||[], assigneeIds: task.assigneeIds||[], attachments: task.attachments||[] }
  );
  const [tab, setTab]               = useState("details");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newComment, setNewComment]     = useState("");
  const [newTag, setNewTag]             = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Checklist item edit state
  const [editingCheckId, setEditingCheckId]     = useState(null);
  const [editingCheckText, setEditingCheckText] = useState("");

  // Drag-and-drop state
  const [dragIdx, setDragIdx]       = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Checklist templates state
  const [templates, setTemplates]           = useState(() => { try { return JSON.parse(localStorage.getItem("kc_checklist_templates") || "[]"); } catch { return []; } });
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate]   = useState(false);
  const [templateName, setTemplateName]           = useState("");
  const [editingTplId, setEditingTplId]           = useState(null);
  const [editingTplName, setEditingTplName]       = useState("");

  const persistTemplates = (updated) => { setTemplates(updated); try { localStorage.setItem("kc_checklist_templates", JSON.stringify(updated)); } catch {} };
  const saveAsTemplate   = () => { if (!templateName.trim()) return; persistTemplates([...templates, { id:uid(), name:templateName.trim(), items:form.checklist.map(c=>({ id:uid(), text:c.text })) }]); setTemplateName(""); setShowSaveTemplate(false); };
  const deleteTemplate   = (id) => persistTemplates(templates.filter(t=>t.id!==id));
  const loadTemplate     = (t) => { set("checklist", [...form.checklist, ...t.items.map(item=>({ id:uid(), text:item.text, done:false }))]); setShowTemplatePanel(false); };
  const saveTemplateName = (id) => { if (!editingTplName.trim()) return; persistTemplates(templates.map(t=>t.id===id?{...t,name:editingTplName.trim()}:t)); setEditingTplId(null); };

  const toggleAssignee = id => set("assigneeIds", form.assigneeIds.includes(id) ? form.assigneeIds.filter(x=>x!==id) : [...form.assigneeIds, id]);
  const addCheckItem = () => { if (!newCheckItem.trim()) return; set("checklist", [...form.checklist, { id:uid(), text:newCheckItem.trim(), done:false }]); setNewCheckItem(""); };
  const toggleCheck  = id => set("checklist", form.checklist.map(c=>c.id===id?{...c,done:!c.done}:c));
  const removeCheck  = id => set("checklist", form.checklist.filter(c=>c.id!==id));
  const startEditCheck = (item) => { setEditingCheckId(item.id); setEditingCheckText(item.text); };
  const saveEditCheck  = (id) => { if (!editingCheckText.trim()) return; set("checklist", form.checklist.map(c=>c.id===id?{...c,text:editingCheckText.trim()}:c)); setEditingCheckId(null); };

  const onDragStart   = (idx) => setDragIdx(idx);
  const onDragOver    = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDragEnd     = () => { setDragIdx(null); setDragOverIdx(null); };
  const onDrop        = (idx) => { if (dragIdx===null||dragIdx===idx) return; const r=[...form.checklist]; const [m]=r.splice(dragIdx,1); r.splice(idx,0,m); set("checklist",r); setDragIdx(null); setDragOverIdx(null); };

  const addComment = (text) => {
    const t = (text || newComment).trim();
    if (!t) return;
    const authorName = `${settings.userFirstName} ${settings.userLastName}`.trim() || "Admin";
    const comment = { id:uid(), text:t, author:authorName, date:today() };
    set("comments", [...form.comments, comment]);
    setNewComment("");
    // Fire notifications for @mentions
    if (onNotify) {
      const mentions = t.match(/@(\S+)/g) || [];
      const authorInitials = authorName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const authorColor = ROLE_META.admin?.color || "var(--accent)";
      const assignableAll = [
        { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"" },
        ...((typeof teamUsers !== "undefined" ? teamUsers : []) || []).filter(u=>u.status==="active"),
      ];
      mentions.forEach(mention => {
        const handle = mention.replace("@","").toLowerCase();
        const mentionedUser = assignableAll.find(u =>
          `${u.firstName||""}${u.lastName||""}`.toLowerCase().replace(/\s/g,"").includes(handle) ||
          (u.firstName||"").toLowerCase() === handle
        );
        if (!mentionedUser) return;
        onNotify({
          id: uid(),
          author: authorName,
          authorInitials,
          authorColor,
          action: "mentioned you in",
          context: form.title || "a task",
          preview: t,
          mention,
          date: today(),
          read: false,
          type: "mention",
          recipientUserIds: [mentionedUser.id],
        });
      });
    }
  };

  const addTag = () => { if (!newTag.trim() || form.tags.includes(newTag.trim())) return; set("tags", [...form.tags, newTag.trim()]); setNewTag(""); };

  const attachFileRef = React.useRef(null);
  const handleAttachFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File must be under 10MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      set("attachments", [...(form.attachments||[]), {
        id: uid(), name: file.name, type: file.type,
        dataUrl: ev.target.result, size: file.size,
        addedAt: new Date().toISOString(),
      }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const removeAttachment = (id) => set("attachments", (form.attachments||[]).filter(a=>a.id!==id));

  const assignableAll = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ];

  const pri = TASK_PRIORITIES.find(p=>p.id===form.priority)||TASK_PRIORITIES[2];

  const TABS = [
    { id:"details",     label:"Details"   },
    { id:"checklist",   label:`Checklist${form.checklist.length?` (${form.checklist.length})`:""}` },
    { id:"attachments", label:`Files${(form.attachments||[]).length?` (${form.attachments.length})`:""}` },
    { id:"comments",    label:`Comments${form.comments.length?` (${form.comments.length})`:""}` },
  ];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <div style={{ display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0 }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:pri.color,flexShrink:0 }} />
            <div className="modal-title" style={{ margin:0 }}>{isNew?"New Task":form.title||"Edit Task"}</div>
          </div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22}/></button>
        </div>

        <div style={{ display:"flex",gap:2,borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {TABS.map(t=>(
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
              style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,fontSize:12.5,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500 }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight:500,overflowY:"auto" }}>

          {tab==="details" && (
            <div>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="What needs to be done?" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input form-textarea" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Add more detail, context, or instructions…" style={{ minHeight:80 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <div style={{ display:"flex",gap:6 }}>
                    {TASK_PRIORITIES.map(p=>(
                      <div key={p.id} onClick={()=>set("priority",p.id)}
                        style={{ flex:1,padding:"7px 4px",borderRadius:"var(--radius-sm)",border:`2px solid ${form.priority===p.id?p.color:"var(--border)"}`,background:form.priority===p.id?`${p.color}15`:"var(--surface2)",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:p.color,margin:"0 auto 4px" }} />
                        <div style={{ fontSize:11,fontWeight:700,color:form.priority===p.id?p.color:"var(--text2)" }}>{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                    {DEFAULT_COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <div className="date-input-wrap">
                    <input className="form-input" type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} />
                    <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2}/></span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Linked Project</label>
                  <select className="form-input form-select" value={form.projectId} onChange={e=>set("projectId",e.target.value)}>
                    <option value="">— None —</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Assignees */}
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                  {assignableAll.map(u=>{
                    const sel = form.assigneeIds.includes(u.id);
                    const meta = ROLE_META[u.role]||ROLE_META.user;
                    return (
                      <div key={u.id} onClick={()=>toggleAssignee(u.id)}
                        style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px",borderRadius:20,border:`1.5px solid ${sel?meta.color:"var(--border)"}`,background:sel?`${meta.color}15`:"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                        <div style={{ width:22,height:22,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                          {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                        </div>
                        <span style={{ fontSize:12.5,fontWeight:sel?700:500,color:sel?meta.color:"var(--text)" }}>{u.firstName} {u.lastName}</span>
                        {sel && <Icon d={ic.check} size={12} stroke={meta.color} strokeWidth={2.5}/>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
                  {form.tags.map(t=>(
                    <span key={t} style={{ display:"flex",alignItems:"center",gap:4,fontSize:12,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 10px" }}>
                      <Icon d={ic.tag} size={11} stroke="var(--accent)"/>{t}
                      <span style={{ cursor:"pointer",color:"var(--text3)",marginLeft:2,fontSize:13,lineHeight:1 }} onClick={()=>set("tags",form.tags.filter(x=>x!==t))}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Add tag…" value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} />
                  <button className="btn btn-secondary btn-sm" onClick={addTag}><Icon d={ic.plus} size={14}/></button>
                </div>
              </div>

            </div>
          )}

          {/* ── ATTACHMENTS TAB ── */}
          {tab==="attachments" && (
            <div>
              <input ref={attachFileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style={{ display:"none" }} onChange={handleAttachFile} />
              <div style={{ marginBottom:14 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>attachFileRef.current?.click()}>
                  <Icon d={ic.plus} size={14}/> Attach File or Photo
                </button>
                <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:10 }}>Max 10MB per file</span>
              </div>
              {(form.attachments||[]).length === 0 && (
                <div style={{ textAlign:"center",padding:"32px 16px",color:"var(--text3)",fontSize:13,border:"2px dashed var(--border)",borderRadius:"var(--radius-sm)" }}>
                  No files attached yet.<br/>
                  <span style={{ fontSize:12 }}>Attach photos, PDFs, or documents as evidence or reference.</span>
                </div>
              )}
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {(form.attachments||[]).map(att=>(
                  <div key={att.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                    {att.type?.startsWith("image/")
                      ? <img src={att.dataUrl} alt={att.name} style={{ width:48,height:48,objectFit:"cover",borderRadius:6,flexShrink:0 }} />
                      : <div style={{ width:48,height:48,borderRadius:6,background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon d={ic.folder} size={22} stroke="var(--text2)" /></div>
                    }
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{att.name}</div>
                      <div style={{ fontSize:11,color:"var(--text3)" }}>{(att.size/1024).toFixed(0)} KB · {new Date(att.addedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    </div>
                    {att.type?.startsWith("image/") && (
                      <a href={att.dataUrl} download={att.name} className="btn btn-ghost btn-sm btn-icon" title="Download" style={{ width:30,height:30 }}><Icon d={ic.arrowUpRight} size={14}/></a>
                    )}
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ width:30,height:30,color:"#e85a3a" }} onClick={()=>removeAttachment(att.id)}><Icon d={ic.trash} size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="checklist" && (
            <div>
              {/* ── Templates toolbar ─────────────────────────────── */}
              <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
                <button className="btn btn-secondary btn-sm" style={{ fontSize:12 }} onClick={()=>setShowTemplatePanel(v=>!v)}>
                  <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={13}/> {showTemplatePanel ? "Hide Templates" : "Load Template"}{templates.length > 0 ? ` (${templates.length})` : ""}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:12, marginLeft:"auto" }} onClick={()=>{ setShowSaveTemplate(v=>!v); setTemplateName(""); }}>
                  <Icon d={ic.plus} size={12}/> Save as Template
                </button>
              </div>

              {/* ── Save-as-template form ──────────────────────────── */}
              {showSaveTemplate && (
                <div style={{ display:"flex",gap:8,marginBottom:12,padding:"10px 12px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--accent)" }}>
                  <input className="form-input" style={{ flex:1,fontSize:13 }} placeholder="Template name…" value={templateName} onChange={e=>setTemplateName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveAsTemplate();if(e.key==="Escape")setShowSaveTemplate(false);}} autoFocus />
                  <button className="btn btn-primary btn-sm" onClick={saveAsTemplate} disabled={!templateName.trim()}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setShowSaveTemplate(false)}>Cancel</button>
                </div>
              )}

              {/* ── Template panel ────────────────────────────────── */}
              {showTemplatePanel && (
                <div style={{ marginBottom:14,background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",overflow:"hidden" }}>
                  {templates.length === 0
                    ? <div style={{ padding:"16px 14px",color:"var(--text3)",fontSize:13,textAlign:"center" }}>No templates saved yet. Build a checklist and click "Save as Template".</div>
                    : templates.map(t=>(
                        <div key={t.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:"1px solid var(--border)" }}>
                          {editingTplId===t.id
                            ? <>
                                <input className="form-input" style={{ flex:1,fontSize:13,padding:"4px 8px" }} value={editingTplName} onChange={e=>setEditingTplName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveTemplateName(t.id);if(e.key==="Escape")setEditingTplId(null);}} autoFocus />
                                <button className="btn btn-primary btn-sm" style={{ fontSize:11 }} onClick={()=>saveTemplateName(t.id)}>Save</button>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={()=>setEditingTplId(null)}>Cancel</button>
                              </>
                            : <>
                                <span style={{ flex:1,fontSize:13,fontWeight:500 }}>{t.name}</span>
                                <span style={{ fontSize:11,color:"var(--text3)" }}>{t.items.length} item{t.items.length!==1?"s":""}</span>
                                <button className="btn btn-primary btn-sm" style={{ fontSize:11 }} onClick={()=>loadTemplate(t)}>Load</button>
                                <button className="btn btn-ghost btn-icon" style={{ width:26,height:26,color:"var(--text2)" }} title="Rename" onClick={()=>{ setEditingTplId(t.id); setEditingTplName(t.name); }}>
                                  <Icon d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" size={13}/>
                                </button>
                                <button className="btn btn-ghost btn-icon" style={{ width:26,height:26,color:"#e85a3a" }} title="Delete" onClick={()=>deleteTemplate(t.id)}>
                                  <Icon d={ic.trash} size={13}/>
                                </button>
                              </>
                          }
                        </div>
                      ))
                  }
                </div>
              )}

              {/* ── Progress bar ──────────────────────────────────── */}
              {form.checklist.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ height:6,background:"var(--surface2)",borderRadius:3,overflow:"hidden",marginBottom:8 }}>
                    <div style={{ height:"100%",background:"var(--accent)",borderRadius:3,width:`${Math.round((form.checklist.filter(c=>c.done).length/form.checklist.length)*100)}%`,transition:"width .3s" }} />
                  </div>
                  <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,textAlign:"right" }}>{form.checklist.filter(c=>c.done).length} / {form.checklist.length} done</div>
                </div>
              )}

              {/* ── Checklist items ───────────────────────────────── */}
              <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:14 }}>
                {form.checklist.map((item, idx)=>(
                  <div key={item.id}
                    draggable
                    onDragStart={()=>onDragStart(idx)}
                    onDragOver={e=>onDragOver(e,idx)}
                    onDrop={()=>onDrop(idx)}
                    onDragEnd={onDragEnd}
                    style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:dragOverIdx===idx&&dragIdx!==idx?"var(--accent-glow)":"var(--surface2)",borderRadius:"var(--radius-sm)",border:`1px solid ${dragOverIdx===idx&&dragIdx!==idx?"var(--accent)":"var(--border)"}`,transition:"background .1s,border .1s",cursor:"default" }}>
                    {/* Drag handle */}
                    <div style={{ cursor:"grab",color:"var(--text3)",display:"flex",flexShrink:0,padding:"0 2px" }} title="Drag to reorder">
                      <Icon d="M8 6h8M8 12h8M8 18h8" size={14} stroke="var(--text3)" strokeWidth={2}/>
                    </div>
                    {/* Checkbox */}
                    <div onClick={()=>toggleCheck(item.id)} style={{ width:18,height:18,borderRadius:4,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                      {item.done && <Icon d={ic.check} size={11} stroke="white" strokeWidth={3}/>}
                    </div>
                    {/* Text / inline edit */}
                    {editingCheckId===item.id
                      ? <input className="form-input" style={{ flex:1,fontSize:13,padding:"3px 7px" }} value={editingCheckText} autoFocus onChange={e=>setEditingCheckText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEditCheck(item.id);if(e.key==="Escape")setEditingCheckId(null);}} onBlur={()=>saveEditCheck(item.id)} />
                      : <span onClick={()=>startEditCheck(item)} style={{ flex:1,fontSize:13,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)",cursor:"text",transition:"all .15s" }} title="Click to edit">{item.text}</span>
                    }
                    {/* Edit btn */}
                    {editingCheckId!==item.id && (
                      <button className="btn btn-ghost btn-icon" style={{ width:24,height:24,color:"var(--text3)" }} title="Edit" onClick={()=>startEditCheck(item)}>
                        <Icon d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" size={12}/>
                      </button>
                    )}
                    {/* Delete btn */}
                    <button className="btn btn-ghost btn-icon" style={{ width:24,height:24,color:"var(--text3)" }} onClick={()=>removeCheck(item.id)}><Icon d={ic.close} size={12}/></button>
                  </div>
                ))}
              </div>

              {/* ── Add new item ──────────────────────────────────── */}
              <div style={{ display:"flex",gap:8 }}>
                <input className="form-input" style={{ flex:1 }} placeholder="Add checklist item…" value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheckItem()} />
                <button className="btn btn-secondary btn-sm" onClick={addCheckItem}><Icon d={ic.plus} size={14}/> Add</button>
              </div>
            </div>
          )}

          {tab==="comments" && (
            <div>
              {form.comments.length === 0 && <div style={{ textAlign:"center",padding:"28px 0",color:"var(--text3)",fontSize:13 }}>No comments yet — start the conversation.</div>}
              <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
                {form.comments.map(c=>(
                  <div key={c.id} style={{ padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                      <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white" }}>
                        {c.author.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight:700,fontSize:13 }}>{c.author}</span>
                      <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:"auto" }}>{c.date}</span>
                    </div>
                    {/* Render comment text with @mentions highlighted */}
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                      {c.text.split(/(@\S+)/g).map((part,i) =>
                        part.startsWith("@")
                          ? <span key={i} style={{ color:"var(--accent)",fontWeight:700,background:"var(--accent-glow)",borderRadius:4,padding:"0 3px" }}>{part}</span>
                          : part
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Comment input with @ picker */}
              <CommentInput
                value={newComment}
                onChange={setNewComment}
                onPost={addComment}
                mentionables={assignableAll}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)} disabled={!form.title.trim()}>
            <Icon d={ic.check} size={14}/> {isNew?"Create Task":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMMENT INPUT WITH @MENTION ──────────────────────────────────────────────
// ── Date Picker Input ─────────────────────────────────────────────────────────
export function DatePickerInput({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Parse value or default to today
  const parsed = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear,  setViewYear]  = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync view to value when it changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + "T12:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const today       = new Date();

  const selectDay = (day) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const displayValue = value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const selectedDay   = value ? new Date(value + "T12:00:00").getDate() : null;
  const selectedMonth = value ? new Date(value + "T12:00:00").getMonth() : null;
  const selectedYear  = value ? new Date(value + "T12:00:00").getFullYear() : null;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="form-input"
        style={{ width:"100%", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", height:40, background:"var(--surface2)", border:`1px solid ${open ? "var(--accent)" : "var(--border)"}`, borderRadius:"var(--radius-sm)", transition:"border-color .15s" }}>
        <span style={{ color: displayValue ? "var(--text)" : "var(--text3)", fontSize:13.5 }}>
          {displayValue || placeholder}
        </span>
        <Icon d={ic.calendarIcon} size={15} stroke={open ? "var(--accent)" : "var(--text3)"} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:9999, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", boxShadow:"0 8px 32px rgba(0,0,0,.35)", padding:"10px", minWidth:260, userSelect:"none" }}>

          {/* Month/Year header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <button type="button" onClick={prevMonth}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", padding:"4px 8px", borderRadius:6, fontSize:16, lineHeight:1 }}>‹</button>
            <span style={{ fontWeight:700, fontSize:13.5, color:"var(--text)" }}>
              {MONTHS_FULL[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", padding:"4px 8px", borderRadius:6, fontSize:16, lineHeight:1 }}>›</button>
          </div>

          {/* Weekday labels */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", marginBottom:4 }}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"var(--text3)", padding:"2px 0" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={"e" + i} />;
              const isSelected = day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear;
              const isToday    = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <button key={day} type="button" onClick={() => selectDay(day)}
                  style={{
                    padding:"5px 0", textAlign:"center", borderRadius:6, border:"none", cursor:"pointer", fontSize:12.5, fontWeight: isSelected || isToday ? 700 : 400,
                    background: isSelected ? "var(--accent)" : isToday ? "var(--accent-glow)" : "transparent",
                    color: isSelected ? "white" : isToday ? "var(--accent)" : "var(--text)",
                    transition:"background .1s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface2)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? "var(--accent-glow)" : "transparent"; }}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {value && (
            <div style={{ borderTop:"1px solid var(--border)", marginTop:8, paddingTop:8, textAlign:"center" }}>
              <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:12, fontWeight:600 }}>
                Clear date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentInput({ value, onChange, onPost, mentionables }) {
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = filter
  const [menuIndex, setMenuIndex]       = useState(0);
  const textareaRef = useRef();

  const filtered = mentionQuery === null ? [] : mentionables.filter(u => {
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    return name.includes(mentionQuery.toLowerCase()) || u.email?.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    // Detect @ trigger: find last @ before cursor that isn't followed by a space
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\S*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMenuIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user) => {
    const cursor = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, cursor);
    const textAfter  = value.slice(cursor);
    const atIdx = textBefore.lastIndexOf("@");
    const handle = `@${user.firstName}${user.lastName ? "_" + user.lastName : ""}`.replace(/\s+/g, "_");
    const newVal = textBefore.slice(0, atIdx) + handle + " " + textAfter;
    onChange(newVal);
    setMentionQuery(null);
    // Refocus and move cursor to end of inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = atIdx + handle.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMenuIndex(i => Math.min(i+1, filtered.length-1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMenuIndex(i => Math.max(i-1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filtered[menuIndex]); return; }
      if (e.key === "Escape")    { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { onPost(value); }
  };

  const meta = (role) => ROLE_META[role] || ROLE_META.user;

  return (
    <div style={{ position:"relative" }}>
      {/* Mention dropdown */}
      {mentionQuery !== null && filtered.length > 0 && (
        <div style={{ position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"0 8px 28px rgba(0,0,0,.25)",zIndex:100,overflow:"hidden",maxHeight:200,overflowY:"auto" }}>
          <div style={{ padding:"6px 10px 4px",fontSize:11,color:"var(--text3)",fontWeight:700,borderBottom:"1px solid var(--border)" }}>
            <Icon d={ic.atSign} size={11} stroke="var(--text3)" /> Mention a team member
          </div>
          {filtered.map((u, i) => {
            const m = meta(u.role);
            return (
              <div key={u.id} onMouseDown={e=>{ e.preventDefault(); insertMention(u); }}
                style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",background:i===menuIndex?"var(--accent-glow)":"transparent",borderLeft:i===menuIndex?`3px solid var(--accent)`:"3px solid transparent",transition:"background .1s" }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                  {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:13 }}>{u.firstName} {u.lastName}</div>
                  <div style={{ fontSize:11,color:"var(--text2)" }}>{m.label}{u.title?` · ${u.title}`:""}</div>
                </div>
                <span style={{ marginLeft:"auto",fontSize:10.5,color:m.color,fontWeight:700,padding:"1px 7px",background:`${m.color}15`,borderRadius:10 }}>{m.label}</span>
              </div>
            );
          })}
          {filtered.length === 0 && mentionQuery.length > 0 && (
            <div style={{ padding:"10px 14px",fontSize:12.5,color:"var(--text3)" }}>No match for "@{mentionQuery}"</div>
          )}
        </div>
      )}
      <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
        <div style={{ flex:1,position:"relative" }}>
          <textarea ref={textareaRef} className="form-input form-textarea"
            style={{ flex:1,minHeight:64,width:"100%",resize:"none",paddingRight:60 }}
            placeholder="Write a comment… type @ to mention someone"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <span style={{ position:"absolute",bottom:8,right:10,fontSize:10,color:"var(--text3)",pointerEvents:"none" }}>⌘↵ post</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>onPost(value)}>
          <Icon d={ic.message} size={14}/> Post
        </button>
      </div>
    </div>
  );
}

// ── Chat Button ───────────────────────────────────────────────────────────────
// ── Analytics Dashboard ───────────────────────────────────────────────────────
export function AnalyticsDashboard({ projects, tasks, teamUsers, settings, onClose }) {
  const [period, setPeriod] = useState("week"); // day | week | month | year
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  // ── Period window ──
  const now = new Date();
  const periodStart = (() => {
    const d = new Date(now);
    if (period === "day")   { d.setHours(0,0,0,0); return d; }
    if (period === "week")  { d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
    if (period === "month") { d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d; }
    if (period === "year")  { d.setFullYear(d.getFullYear() - 1); d.setHours(0,0,0,0); return d; }
    return d;
  })();

  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= periodStart && d <= now;
  };
  const endOfDay = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(23,59,59,999);
    return d;
  };
  const firstDate = (obj, keys = ["updatedAt","createdAt","date"]) => {
    for (const key of keys) if (obj?.[key]) return obj[key];
    return null;
  };
  const projectStatusLabel = (status) => {
    const match = (settings?.projectStatuses || []).find(s => s.id === status);
    return (match?.label || status || "").toLowerCase();
  };
  const isActiveProject = (project) => {
    const label = projectStatusLabel(project.status);
    return label.includes("active") || (!label.includes("completed") && !label.includes("archived") && !label.includes("hold"));
  };
  const isCompletedProject = (project) => projectStatusLabel(project.status).includes("completed");

  // ── Build full user list (admin + team) ──
  const allUsers = [
    { id:"__admin__", firstName:settings?.userFirstName||"Admin", lastName:settings?.userLastName||"", role:"admin", certifications:settings?.userCertifications||[] },
    ...teamUsers.filter(u => u.status !== "archived"),
  ];

  // ── Per-user stats ──
  const portfolio = projects.reduce((acc, p) => {
    const reports = p.reports || [];
    const photos = p.photos || [];
    const files = p.files || [];
    const voiceNotes = p.voiceNotes || [];
    const checklists = p.checklists || [];
    acc.activeJobs += isActiveProject(p) ? 1 : 0;
    acc.completedProjects += isCompletedProject(p) ? 1 : 0;
    acc.projectsTouched += inPeriod(firstDate(p, ["updatedAt","createdAt"])) ? 1 : 0;
    acc.activeReports += reports.filter(r => {
      const status = `${r.status || ""}`.toLowerCase();
      return status && !status.includes("complete") && !status.includes("sent") && !status.includes("archiv");
    }).length;
    acc.reportsCreated += reports.filter(r => inPeriod(firstDate(r, ["date","createdAt","updatedAt"]))).length;
    acc.completedReports += reports.filter(r => `${r.status || ""}`.toLowerCase().includes("complete")).length;
    acc.photosCaptured += photos.filter(ph => inPeriod(firstDate(ph, ["date","createdAt","updatedAt"]))).length;
    acc.filesUploaded += files.filter(f => inPeriod(firstDate(f, ["createdAt","updatedAt","date"]))).length;
    acc.voiceNotes += voiceNotes.filter(v => inPeriod(firstDate(v, ["createdAt","timestamp","date"]))).length;
    acc.completedChecklists += checklists.filter(cl => cl.status === "complete" && inPeriod(firstDate(cl, ["completedAt","updatedAt","createdAt"]))).length;
    acc.openIssues += checklists.reduce((sum, cl) => sum + (cl.fields || []).filter(f => f.issue && f.issue.status !== "resolved").length, 0);
    return acc;
  }, {
    activeJobs:0, completedProjects:0, projectsTouched:0, activeReports:0,
    reportsCreated:0, completedReports:0, photosCaptured:0, filesUploaded:0,
    voiceNotes:0, completedChecklists:0, openIssues:0
  });
  const openTasks = tasks.filter(t => t.status !== "done").length;
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.dueDate && endOfDay(t.dueDate) < now).length;
  const tasksCompletedPeriod = tasks.filter(t => t.status === "done" && inPeriod(firstDate(t, ["completedAt","updatedAt","createdAt","date"]))).length;

  const userStats = allUsers.map(u => {
    const isAdmin = u.id === "__admin__";

    // Photos: count photos on projects where this user is assigned or admin
    const photosTotal = projects.reduce((sum, p) => {
      const assigned = isAdmin || (p.assignedUserIds||[]).includes(u.id);
      if (!assigned) return sum;
      return sum + (p.photos||[]).filter(ph => inPeriod(ph.date)).length;
    }, 0);

    // Reports: count reports on assigned projects
    const reportsTotal = projects.reduce((sum, p) => {
      const assigned = isAdmin || (p.assignedUserIds||[]).includes(u.id);
      if (!assigned) return sum;
      return sum + (p.reports||[]).filter(r => inPeriod(r.date||r.createdAt)).length;
    }, 0);

    // Tasks completed: tasks where this user is an assignee and status === "done"
    const tasksCompleted = tasks.filter(t =>
      t.status === "done" &&
      (t.assigneeIds||[]).includes(u.id === "__admin__" ? "__admin__" : u.id)
    ).length;

    // Active projects
    const activeProjects = projects.filter(p =>
      isActiveProject(p) && (isAdmin || (p.assignedUserIds||[]).includes(u.id))
    ).length;

    const score = photosTotal * 0.25 + reportsTotal * 10 + tasksCompleted * 3;

    return { ...u, photosTotal, reportsTotal, tasksCompleted, activeProjects, score };
  });

  // MVK — top scorer
  const mvk = [...userStats].sort((a, b) => b.score - a.score)[0];

  // ── Totals ──
  const totals = userStats.reduce((acc, u) => ({
    photos:   acc.photos   + u.photosTotal,
    reports:  acc.reports  + u.reportsTotal,
    tasks:    acc.tasks    + u.tasksCompleted,
  }), { photos:0, reports:0, tasks:0 });

  // ── Cert expiry (all users, within 30 days or already expired) ──
  const certAlerts = [];
  allUsers.forEach(u => {
    const certs = u.id === "__admin__" ? (settings?.userCertifications||[]) : (u.certifications||[]);
    certs.forEach(c => {
      if (!c.dateExpires) return;
      const status = getCertStatus(c.dateExpires);
      if (status === "expired" || status === "expiring-soon") {
        const exp = new Date(c.dateExpires + "T00:00:00");
        const daysLeft = Math.ceil((exp - new Date()) / 86400000);
        certAlerts.push({ user: u, cert: c, status, daysLeft });
      }
    });
  });
  certAlerts.sort((a, b) => a.daysLeft - b.daysLeft);

  const initials = u => `${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase() || "?";
  const fullName = u => `${u.firstName||""} ${u.lastName||""}`.trim() || "User";

  const ROLE_COLORS = { admin:"#e8703a", manager:"#3ab8e8", user:"#8b7cf8" };

  const panelStyle = isMobile ? {
    position:"fixed", bottom:"58px", left:0, right:0, height:"85dvh",
    borderRadius:"16px 16px 0 0", zIndex:600,
  } : {
    position:"fixed", top:0, right:0, bottom:0, width:560,
    borderLeft:"1px solid var(--border)", zIndex:600,
  };

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background:"var(--surface2)",borderRadius:10,padding:"14px 16px",border:"1px solid var(--border)",minWidth:160 }}>
      <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--text3)",marginBottom:6,lineHeight:1.3 }}>{label}</div>
      <div style={{ fontSize:26,fontWeight:800,color:color||"var(--text)",lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11,color:"var(--text3)",marginTop:6,lineHeight:1.35 }}>{sub}</div>}
    </div>
  );

  const periodLabel = { day:"Today", week:"Last 7 days", month:"Last 30 days", year:"Last year" }[period];
  const buildBuckets = () => {
    if (period === "day") {
      return Array.from({ length: 8 }, (_, i) => {
        const start = new Date(periodStart);
        start.setHours(i * 3, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 2, 59, 59, 999);
        return { label: `${String(start.getHours()).padStart(2,"0")}:00`, start, end };
      });
    }
    if (period === "week") {
      return Array.from({ length: 7 }, (_, i) => {
        const start = new Date(periodStart);
        start.setDate(periodStart.getDate() + i);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setHours(23,59,59,999);
        return { label: start.toLocaleDateString("en-US", { weekday:"short" }), start, end };
      });
    }
    if (period === "month") {
      return Array.from({ length: 6 }, (_, i) => {
        const start = new Date(periodStart);
        start.setDate(periodStart.getDate() + i * 5);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);
        end.setHours(23,59,59,999);
        return { label: `${start.getMonth()+1}/${start.getDate()}`, start, end };
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now.getFullYear(), i, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999);
      return { label: start.toLocaleDateString("en-US", { month:"short" }), start, end };
    });
  };
  const buckets = buildBuckets();
  const bucketCount = (items, getter) => buckets.map(bucket => items.filter(item => {
    const raw = getter(item);
    if (!raw) return false;
    const d = new Date(raw);
    return d >= bucket.start && d <= bucket.end;
  }).length);
  const projectCreatedTrend = bucketCount(projects, p => firstDate(p, ["createdAt","updatedAt"]));
  const projectCompletedTrend = bucketCount(projects.filter(isCompletedProject), p => firstDate(p, ["updatedAt","createdAt"]));
  const reportTrend = bucketCount(projects.flatMap(p => p.reports || []), r => firstDate(r, ["date","createdAt","updatedAt"]));
  const taskTrend = bucketCount(tasks.filter(t => t.status === "done"), t => firstDate(t, ["completedAt","updatedAt","createdAt","date"]));
  const chartMax = (...sets) => Math.max(1, ...sets.flat());
  const TrendChart = ({ title, subtitle, values, color }) => {
    const max = chartMax(values);
    return (
      <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 14px 12px" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>{title}</div>
        <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:2 }}>{subtitle}</div>
        <div style={{ display:"flex", alignItems:"end", gap:8, height:130, marginTop:12 }}>
          {values.map((value, idx) => (
            <div key={idx} style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"end", gap:6 }}>
              <div style={{ fontSize:10, color:"var(--text3)" }}>{value}</div>
              <div style={{ width:"100%", maxWidth:26, height:Math.max(8, Math.round((value / max) * 88)), borderRadius:"8px 8px 4px 4px", background:color, transition:"height .3s" }} />
              <div style={{ fontSize:10, color:"var(--text3)", whiteSpace:"nowrap" }}>{buckets[idx]?.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:599 }} onClick={onClose} />
      <div style={{ ...panelStyle, background:"var(--surface)", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"-8px 0 40px rgba(0,0,0,.25)" }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid var(--border)",flexShrink:0,gap:10 }}>
          <Icon d={ic.pieChart} size={18} stroke="var(--accent)" />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800,fontSize:15 }}>Tracking & Analytics</div>
            <div style={{ fontSize:11.5,color:"var(--text3)" }}>{periodLabel}</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" style={{ width:34,height:34 }} onClick={onClose}>
            <Icon d={ic.close} size={18}/>
          </button>
        </div>

        {/* Period selector */}
        <div style={{ display:"flex",gap:4,padding:"10px 18px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
          {[["day","Today"],["week","Week"],["month","Month"],["year","Year"]].map(([v,l]) => (
            <button key={v} onClick={()=>setPeriod(v)}
              className="btn btn-sm"
              style={{ flex:1,background:period===v?"var(--accent)":"var(--surface2)",color:period===v?"white":"var(--text2)",border:`1px solid ${period===v?"var(--accent)":"var(--border)"}`,fontWeight:period===v?700:500,fontSize:12 }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:20 }}>

          {/* ── Totals ── */}
          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Executive Snapshot</div>
            <div style={{ display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))" }}>
              <StatCard label="Active Jobs" value={portfolio.activeJobs} sub="currently live" color="var(--accent)" />
              <StatCard label="Active Reports" value={portfolio.activeReports} sub="in progress" color="#8b7cf8" />
              <StatCard label="Completed Projects" value={portfolio.completedProjects} sub="all-time" color="#3dba7e" />
              <StatCard label="Projects Touched" value={portfolio.projectsTouched} sub={periodLabel.toLowerCase()} color="#4a90d9" />
              <StatCard label="Reports Created" value={portfolio.reportsCreated} sub={periodLabel.toLowerCase()} color="var(--accent)" />
              <StatCard label="Tasks Completed" value={tasksCompletedPeriod} sub={periodLabel.toLowerCase()} color="var(--green)" />
            </div>
          </div>

          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Operations Health</div>
            <div style={{ display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))" }}>
              <StatCard label="Open Tasks" value={openTasks} sub="teamwide" color="#e8c53a" />
              <StatCard label="Overdue Tasks" value={overdueTasks} sub="needs attention" color="#e85a3a" />
              <StatCard label="Open Issues" value={portfolio.openIssues} sub="punchlist items" color="#e8803a" />
              <StatCard label="Checklists" value={portfolio.completedChecklists} sub="completed" color="#3dba7e" />
            </div>
          </div>

          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Field Activity</div>
            <div style={{ display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))" }}>
              <StatCard label="Photos" value={portfolio.photosCaptured} sub={periodLabel.toLowerCase()} color="#4a90d9" />
              <StatCard label="Files" value={portfolio.filesUploaded} sub="uploaded" color="#8b7cf8" />
              <StatCard label="Voice Notes" value={portfolio.voiceNotes} sub="captured" color="#e8803a" />
              <StatCard label="Completed Reports" value={portfolio.completedReports} sub="all-time" color="#3dba7e" />
            </div>
          </div>

          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Trend Charts</div>
            <div style={{ display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))" }}>
              <TrendChart title="Jobs Created" subtitle={periodLabel} values={projectCreatedTrend} color="linear-gradient(180deg,#2b7fe8,#4a90d9)" />
              <TrendChart title="Projects Completed" subtitle={periodLabel} values={projectCompletedTrend} color="linear-gradient(180deg,#3dba7e,#69d89b)" />
              <TrendChart title="Reports Volume" subtitle={periodLabel} values={reportTrend} color="linear-gradient(180deg,#8b7cf8,#a897ff)" />
              <TrendChart title="Tasks Closed" subtitle={periodLabel} values={taskTrend} color="linear-gradient(180deg,#e8803a,#f3b06d)" />
            </div>
          </div>

          {/* ── MVK ── */}
          {mvk && mvk.score > 0 && (
            <div style={{ background:"linear-gradient(135deg,var(--surface2),var(--surface3))",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px" }}>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:15 }}>🦑</span> MVK — Most Valuable Kraken
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:44,height:44,borderRadius:"50%",background:ROLE_COLORS[mvk.role]||"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"white",flexShrink:0,overflow:"hidden" }}>
                  {mvk.id==="__admin__" && settings?.userAvatar
                    ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                    : initials(mvk)}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:800,fontSize:14 }}>{fullName(mvk)}</div>
                  <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:2 }}>
                    {mvk.photosTotal} photos · {mvk.reportsTotal} reports · {mvk.tasksCompleted} tasks done
                  </div>
                </div>
                <div style={{ flexShrink:0,textAlign:"right" }}>
                  <div style={{ fontSize:22,fontWeight:800,color:"var(--accent)",lineHeight:1 }}>{mvk.score.toFixed(1)}</div>
                  <div style={{ fontSize:10,color:"var(--text3)" }}>pts</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Per-user breakdown ── */}
          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Leaderboard</div>
            <div style={{ background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",gap:8 }}>
              {[...userStats].sort((a,b)=>b.score-a.score).slice(0,5).map((u, idx) => (
                <div key={u.id} style={{ display:"grid",gridTemplateColumns:"30px 1fr auto",alignItems:"center",gap:10,padding:"6px 2px" }}>
                  <div style={{ fontSize:12,fontWeight:800,color:idx===0?"var(--accent)":"var(--text3)" }}>#{idx + 1}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12.5,fontWeight:700,color:"var(--text)" }}>{fullName(u)}</div>
                    <div style={{ fontSize:10.5,color:"var(--text3)" }}>{u.reportsTotal} reports · {u.tasksCompleted} tasks · {u.photosTotal} photos</div>
                  </div>
                  <div style={{ fontSize:12.5,fontWeight:800,color:"var(--accent)" }}>{u.score.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10 }}>Individual Productivity</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {[...userStats].sort((a,b)=>b.score-a.score).map(u => (
                <div key={u.id} style={{ background:"var(--surface2)",borderRadius:10,padding:"11px 14px",border:"1px solid var(--border)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                    <div style={{ width:32,height:32,borderRadius:"50%",background:ROLE_COLORS[u.role]||"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"white",flexShrink:0,overflow:"hidden" }}>
                      {u.id==="__admin__" && settings?.userAvatar
                        ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                        : initials(u)}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:6 }}>
                        {fullName(u)}
                        {u.id===mvk?.id && mvk?.score>0 && <span style={{ fontSize:10 }}>🦑</span>}
                      </div>
                      <div style={{ fontSize:11,color:"var(--text3)",textTransform:"capitalize" }}>{u.role} · {u.activeProjects} active jobs</div>
                    </div>
                    <div style={{ fontSize:13,fontWeight:700,color:"var(--text3)" }}>{u.score.toFixed(1)} pts</div>
                  </div>
                  {/* Mini stat bars */}
                  <div style={{ display:"flex",gap:6 }}>
                    {[
                      { label:"📷", value:u.photosTotal,   max:Math.max(1,...userStats.map(x=>x.photosTotal)),  color:"var(--blue)"   },
                      { label:"📄", value:u.reportsTotal,  max:Math.max(1,...userStats.map(x=>x.reportsTotal)), color:"var(--accent)" },
                      { label:"✓",  value:u.tasksCompleted,max:Math.max(1,...userStats.map(x=>x.tasksCompleted)),color:"var(--green)"  },
                    ].map(({ label, value, max, color }) => (
                      <div key={label} style={{ flex:1 }}>
                        <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text3)",marginBottom:3 }}>
                          <span>{label}</span><span style={{ fontWeight:600,color:"var(--text2)" }}>{value}</span>
                        </div>
                        <div style={{ height:4,borderRadius:2,background:"var(--surface3)",overflow:"hidden" }}>
                          <div style={{ height:"100%",borderRadius:2,background:color,width:`${Math.round((value/max)*100)}%`,transition:"width .4s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Cert Expiry ── */}
          <div>
            <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
              <Icon d={ic.shield} size={12} stroke="var(--text3)" /> Certifications — Expired &amp; Expiring Soon
            </div>
            {certAlerts.length === 0 ? (
              <div style={{ background:"var(--surface2)",borderRadius:10,padding:"14px 16px",border:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10 }}>
                <Icon d={ic.check} size={16} stroke="var(--green)" />
                <span style={{ fontSize:13,color:"var(--text2)" }}>All certifications are current — nothing expiring within 30 days.</span>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                {certAlerts.map((a, i) => {
                  const isExp = a.status === "expired";
                  const bg    = isExp ? "#e85a3a18" : "#e8803a18";
                  const col   = isExp ? "#e85a3a"   : "#e8803a";
                  const bdr   = isExp ? "#e85a3a44" : "#e8803a44";
                  return (
                    <div key={i} style={{ background:bg,border:`1px solid ${bdr}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:30,height:30,borderRadius:"50%",background:ROLE_COLORS[a.user.role]||"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"white",flexShrink:0,overflow:"hidden" }}>
                        {a.user.id==="__admin__" && settings?.userAvatar
                          ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : initials(a.user)}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:700,fontSize:12.5,color:"var(--text)" }}>{a.cert.name||a.cert.certCode||"Certification"}</div>
                        <div style={{ fontSize:11.5,color:"var(--text2)" }}>{fullName(a.user)}</div>
                      </div>
                      <div style={{ textAlign:"right",flexShrink:0 }}>
                        <div style={{ fontSize:12,fontWeight:800,color:col }}>
                          {isExp ? "Expired" : `${a.daysLeft}d left`}
                        </div>
                        <div style={{ fontSize:10.5,color:"var(--text3)" }}>{a.cert.dateExpires}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scoring key */}
          <div style={{ fontSize:10.5,color:"var(--text3)",padding:"10px 14px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)",lineHeight:1.7 }}>
            <strong style={{ color:"var(--text2)" }}>Scoring:</strong> Photo = 0.25 pts · Report = 10 pts · Task completed = 3 pts
            <br />
            <strong style={{ color:"var(--text2)" }}>KPIs tracked:</strong> active jobs, active reports, completed projects, overdue tasks, open issues, files, voice notes, and checklist closeouts.
          </div>

        </div>
      </div>
    </>
  );
}

export function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onClear }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(null); // notif id that's expanded
  const ref = useRef();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const typeMeta = (n) => {
    if (n.type === "assignment") return { icon:ic.userPlus, color:"var(--accent)", bg:"var(--accent-glow)", title:"Assignment", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"var(--accent)" }}>{n.context}</strong></> };
    if (n.type === "mention") return { icon:ic.atSign, color:"#8b7cf8", bg:"rgba(139,124,248,.14)", title:"Mention", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#8b7cf8" }}>@you</strong> {n.context && <span style={{ color:"var(--text2)" }}>in <em>{n.context}</em></span>}</> };
    if (n.type === "cert-alert") return {
      icon:ic.alert,
      color:n.certStatus === "expired" ? "#e85a3a" : "#e8c53a",
      bg:n.certStatus === "expired" ? "rgba(232,90,58,.14)" : "rgba(232,197,58,.14)",
      title:"Certification Alert",
      summary:<><strong style={{ color:n.certStatus === "expired" ? "#e85a3a" : "#b8950a" }}>Certification Alert</strong> <span style={{ color:"var(--text2)" }}>for</span> {n.context}</>,
    };
    if (n.type === "task" || n.type === "task-comment") return { icon:ic.kanban, color:"#3ab8e8", bg:"rgba(58,184,232,.14)", title:"Task Activity", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#3ab8e8" }}>{n.context}</strong></> };
    if (n.type === "calendar") return { icon:ic.calendarIcon, color:"#2ec4b6", bg:"rgba(46,196,182,.14)", title:"Calendar Update", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#2ec4b6" }}>{n.context}</strong></> };
    if (n.type === "checklist") return { icon:ic.clipboardList, color:"#3dba7e", bg:"rgba(61,186,126,.14)", title:"Checklist Update", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#3dba7e" }}>{n.context}</strong></> };
    if (n.type === "file") return { icon:ic.folder, color:"#4a90d9", bg:"rgba(74,144,217,.14)", title:"File Activity", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#4a90d9" }}>{n.context}</strong></> };
    if (n.type === "report") return { icon:ic.reports, color:"#f0954e", bg:"rgba(240,149,78,.14)", title:"Report Update", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#f0954e" }}>{n.context}</strong></> };
    if (n.type === "photo" || n.type === "video" || n.type === "voice-note") return { icon:n.type === "video" ? ic.video : n.type === "voice-note" ? ic.mic : ic.camera, color:"#8b7cf8", bg:"rgba(139,124,248,.14)", title:"Media Update", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#8b7cf8" }}>{n.context}</strong></> };
    if (n.type === "team") return { icon:ic.users, color:"#e8c53a", bg:"rgba(232,197,58,.14)", title:"Team Update", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#e8c53a" }}>{n.context}</strong></> };
    if (n.type === "admin") return { icon:ic.shield, color:"#e85a8a", bg:"rgba(232,90,138,.14)", title:"Admin Alert", summary:<><strong>{n.author}</strong> {n.action} <strong style={{ color:"#e85a8a" }}>{n.context}</strong></> };
    return { icon:ic.bell, color:"var(--text2)", bg:"var(--surface2)", title:"Notification", summary:<><strong>{n.author || "System"}</strong> {n.action || "sent an update"} {n.context && <strong style={{ color:"var(--accent)" }}>{n.context}</strong>}</> };
  };

  const handleClick = (n) => {
    onMarkRead(n.id);
    setExpanded(v => v === n.id ? null : n.id);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setOpen(v => !v); setExpanded(null); }}
        style={{ position:"relative", width:36, height:36, color: unread > 0 ? "var(--accent)" : "var(--text2)" }}>
        <Icon d={ic.bell} size={18} />
        {unread > 0 && (
          <span style={{ position:"absolute", top:4, right:4, width:16, height:16, borderRadius:"50%", background:"var(--accent)", color:"white", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--surface)", lineHeight:1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-screen backdrop */}
          {isMobile && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:199 }} onClick={()=>setOpen(false)} />}

          <div style={{
            position: isMobile ? "fixed" : "absolute",
            ...(isMobile
              ? { bottom:"58px", left:0, right:0, top:"auto", borderRadius:"16px 16px 0 0", maxHeight:"calc(80dvh - 58px)" }
              : { top:"calc(100% + 8px)", right:0, width:360, borderRadius:"var(--radius)" }),
            background:"var(--surface)", border:"1px solid var(--border)",
            boxShadow:"0 12px 48px rgba(0,0,0,.35)", zIndex:600, overflow:"hidden",
            display:"flex", flexDirection:"column"
          }}>
            {/* Handle bar (mobile) */}
            {isMobile && <div style={{ width:36,height:4,borderRadius:2,background:"var(--border)",margin:"10px auto 0",flexShrink:0 }} />}

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>
                Notifications
                {unread > 0 && <span style={{ fontSize:11, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"var(--accent)", color:"white", marginLeft:6 }}>{unread}</span>}
              </div>
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                {unread > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5, color:"var(--accent)", padding:"2px 8px" }} onClick={onMarkAllRead}>Mark all read</button>}
                {notifications.length > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5, color:"var(--text3)", padding:"2px 8px" }} onClick={()=>{ onClear(); setExpanded(null); }}>Clear</button>}
                {isMobile && <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setOpen(false)}><Icon d={ic.close} size={16} /></button>}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY:"auto", flex:1, ...(isMobile ? { maxHeight:"calc(80dvh - 58px - 80px)" } : { maxHeight:420 }) }}>
              {notifications.length === 0 ? (
                <div style={{ padding:"48px 16px", textAlign:"center", color:"var(--text3)" }}>
                  <Icon d={ic.bell} size={28} stroke="var(--text3)" />
                  <div style={{ marginTop:10, fontSize:13 }}>You're all caught up!</div>
                </div>
              ) : (
                notifications.map(n => {
                  const isExpanded = expanded === n.id;
                  const meta = typeMeta(n);
                  return (
                    <div key={n.id}
                      style={{ borderBottom:"1px solid var(--border)", background: n.read ? "transparent" : "var(--accent-glow)", transition:"background .15s", cursor:"pointer" }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "var(--surface2)"; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = n.read ? "transparent" : "var(--accent-glow)"; }}>

                      {/* Summary row — always visible */}
                      <div style={{ display:"flex", gap:11, padding:"11px 16px 11px", alignItems:"flex-start" }}
                        onClick={() => handleClick(n)}>
                        {/* Icon */}
                        <div style={{ width:34, height:34, borderRadius:"50%",
                          background: meta.bg,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:16, flexShrink:0, border:`1px solid ${meta.color === "var(--text2)" ? "var(--border)" : `${meta.color}33`}` }}>
                          <Icon d={meta.icon} size={16} stroke={meta.color} />
                        </div>

                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Title line */}
                          <div style={{ fontSize:13, lineHeight:1.45, color:"var(--text)", marginBottom:2 }}>
                            {meta.summary}
                          </div>
                          {/* Preview — truncated when collapsed */}
                          {n.preview && !isExpanded && (
                            <div style={{ fontSize:12, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {n.type === "assignment" ? n.preview : `"${n.preview}"`}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:"var(--text3)", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
                            {n.date}
                            <span style={{ color:"var(--text3)", fontSize:10 }}>{isExpanded ? "▲ collapse" : "▼ expand"}</span>
                          </div>
                        </div>
                        {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent)", flexShrink:0, marginTop:5 }} />}
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div style={{ padding:"0 16px 14px 61px" }}>
                          <div style={{ padding:"10px 14px", background:"var(--surface2)", borderRadius:9, border:"1px solid var(--border)", fontSize:13, color:"var(--text)", lineHeight:1.7 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                              <Icon d={meta.icon} size={15} stroke={meta.color} />
                              <div style={{ fontWeight:700, color:meta.color }}>{meta.title}</div>
                            </div>
                            {n.preview && (
                              <div style={{ color:"var(--text2)", fontSize:12.5, fontStyle:n.type==="mention" ? "italic" : "normal" }}>
                                {n.type==="mention" ? `"${n.preview}"` : n.preview}
                              </div>
                            )}
                            {n.context && <div style={{ marginTop:6, fontSize:12, color:"var(--text3)" }}>Context: <strong>{n.context}</strong></div>}
                            {n.type === "cert-alert" && <div style={{ marginTop:8, fontSize:12, color:"var(--text3)" }}>Go to <strong>Team Members</strong> to update the certification record.</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ListCheckToggle({task, checkDone, checkTotal, onToggleChecklistItem}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flexShrink:0 }}>
      {/* Pill — only this toggles open/close */}
      <div style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"2px 6px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",border:"1px solid var(--border)" }}
        onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}>
        <Icon d={ic.listCheck} size={12} stroke={checkDone===checkTotal?"#3dba7e":"var(--text3)"}/>
        <span style={{ fontSize:11,fontWeight:700,color:checkDone===checkTotal?"#3dba7e":"var(--text2)" }}>{checkDone}/{checkTotal}</span>
        <span style={{ fontSize:9,color:"var(--text3)" }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ position:"absolute",zIndex:50,marginTop:4,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"0 8px 24px rgba(0,0,0,.2)",padding:"8px",minWidth:220,maxWidth:300 }}
          onClick={e=>e.stopPropagation()}>
          {(task.checklist||[]).map(item=>(
            <div key={item.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 6px",borderRadius:"var(--radius-sm)",cursor:"pointer",marginBottom:2 }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              onClick={e=>{e.stopPropagation();onToggleChecklistItem(task.id,item.id);}}>
              <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                {item.done && <Icon d={ic.check} size={9} stroke="white" strokeWidth={3}/>}
              </div>
              <span style={{ fontSize:12,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)" }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Jobsite Map Page ─────────────────────────────────────────────────────────
export function JobsiteMapPage({ projects, settings, onSelectProject }) {
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const markersRef  = useRef([]);
  const [filter,    setFilter]    = useState("all");   // "1m" | "6m" | "12m" | "all"
  const [selected,  setSelected]  = useState(null);    // project id hovered/clicked
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const userRole = settings?.userRole || "admin";
  const canEmbed = userRole === "admin" || userRole === "manager";

  // Filter projects by creation date
  const filtered = projects.filter(p => {
    if (filter === "all") return true;
    const created = new Date(p.createdAt || 0);
    const now     = new Date();
    const months  = { "1m":1, "6m":6, "12m":12 }[filter];
    const cutoff  = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return created >= cutoff;
  });

  // Geocode from address — builds a lat/lng from stored geocode or returns null
  // Projects store address/city/state. We use a simple lookup approach:
  // if the project already has latLng stored we use it, otherwise we show
  // it in the sidebar as "no coordinates" and prompt user to add them.
  const getCoords = (proj) => {
    if (!proj.lat || !proj.lng) return null;
    const lat = parseFloat(proj.lat), lng = parseFloat(proj.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  const withCoords  = filtered.filter(p => getCoords(p));
  const noCoords    = filtered.filter(p => !getCoords(p));

  // Leaflet is loaded dynamically so it doesn't need a build step
  useEffect(() => {
    // Inject Leaflet CSS if not already present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    // Load Leaflet JS
    const loadLeaflet = () => {
      if (window.L) { initMap(); return; }
      const script = document.createElement("script");
      script.src  = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = initMap;
      document.head.appendChild(script);
    };
    loadLeaflet();
    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []);

  // Re-render markers whenever filter changes
  useEffect(() => {
    if (window.L && leafletMap.current) renderMarkers();
  }, [filter, projects, selected]);

  function initMap() {
    if (!mapRef.current || leafletMap.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    leafletMap.current = map;

    // Always use light tiles — dark tiles don't render clearly on jobsite maps
    const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    L.tileLayer(tileUrl, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    renderMarkers(map);
  }

  function renderMarkers(mapInstance) {
    const L   = window.L;
    const map = mapInstance || leafletMap.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const pts = withCoords.map(p => getCoords(p));
    if (pts.length === 0) {
      // Default view — Denver, CO if no projects with coords
      map.setView([39.7392, -104.9903], 10);
      return;
    }

    // Create markers
    withCoords.forEach(proj => {
      const coords = getCoords(proj);
      const color  = proj.color || "var(--accent)";

      // Custom SVG pin
      const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
      </svg>`;

      const icon = L.divIcon({
        html: svgPin,
        className: "",
        iconSize:   [28, 36],
        iconAnchor: [14, 36],
        popupAnchor:[0, -38],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:200px;padding:2px 0">
            <div style="width:100%;height:3px;background:${color};border-radius:2px;margin-bottom:8px"></div>
            <div style="font-weight:700;font-size:13px;margin-bottom:3px;line-height:1.3">${proj.title}</div>
            <div style="font-size:11px;color:#666;margin-bottom:6px">
              📍 ${[proj.address,proj.city,proj.state].filter(Boolean).join(", ") || "No address"}${proj.manualGps ? ' <span style="font-size:10px;color:#2b7fe8;font-weight:700">(GPS override)</span>' : ''}
            </div>
            <div style="display:flex;gap:10px;font-size:11px;color:#888;margin-bottom:8px">
              <span>📷 ${proj.photos?.length||0} photos</span>
              <span>📄 ${proj.reports?.length||0} reports</span>
            </div>
            <div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-block;
              background:${color}20;color:${color}">${proj.type||"Project"}</div>
          </div>
        `, { maxWidth: 260 });

      marker.on("click", () => setSelected(proj.id));
      markersRef.current.push(marker);
    });

    // Fit map to show all markers with padding
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }

  const FILTER_OPTIONS = [
    { id:"1m",  label:"Last month"   },
    { id:"6m",  label:"Last 6 months"},
    { id:"12m", label:"Last 12 months"},
    { id:"all", label:"All time"     },
  ];

  const buildMapEmbed = () => {
    const map   = leafletMap.current;
    const center = map ? map.getCenter() : { lat: 39.7392, lng: -104.9903 };
    const zoom   = map ? map.getZoom()   : 10;

    // Sanitise: only lat/lng/color per project — no names, addresses, client info
    const pins = withCoords.map(p => ({
      lat:   parseFloat(p.lat),
      lng:   parseFloat(p.lng),
      color: p.color || "#2b7fe8",
    }));

    const krakenLogo = settings?.logo || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Service Area Map</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;}
  #map{width:100%;height:100%;}
  #badge{position:fixed;bottom:0;right:0;z-index:1000;display:flex;align-items:center;gap:7px;
    background:#000;border-radius:6px 0 0 0;padding:6px 11px 6px 7px;
    border-top:1px solid rgba(255,255,255,.18);border-left:1px solid rgba(255,255,255,.18);
    pointer-events:none;}
  #badge img{width:22px;height:22px;border-radius:4px;object-fit:contain;background:#0d1a2e;}
  #badge span{font-size:13.5px;font-weight:700;color:white;letter-spacing:.04em;white-space:nowrap;}
</style>
</head>
<body>
<div id="map"></div>
<div id="badge">
  <img src="${krakenLogo}" alt="KrakenCam"/>
  <span>Made with KrakenCam</span>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center.lat},${center.lng}],${zoom});
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
var pins=${JSON.stringify(pins)};
pins.forEach(function(p){
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">'
    +'<path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="'+p.color+'" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>'
    +'<circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>'
    +'</svg>';
  var icon=L.divIcon({html:svg,className:'',iconSize:[28,36],iconAnchor:[14,36]});
  L.marker([p.lat,p.lng],{icon:icon}).addTo(map);
});
</script>
</body>
</html>`;
  };

  const openEmbed = () => { setEmbedOpen(true); setEmbedCopied(false); };
  const copyEmbed = () => {
    navigator.clipboard.writeText(buildMapEmbed()).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    });
  };

  const selProj = selected ? projects.find(p => p.id === selected) : null;
  const accentColor = settings?.accent || "#2b7fe8";

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",overflow:"hidden" }}>

      {/* ── Toolbar ── */}
      <div style={{ padding:"12px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <Icon d={ic.mapPin} size={16} stroke="var(--accent)" />
          <span style={{ fontWeight:700,fontSize:13.5 }}>
            {withCoords.length} jobsite{withCoords.length!==1?"s":""} on map
          </span>
          {noCoords.length > 0 && (
            <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:4 }}>
              · {noCoords.length} missing coordinates
            </span>
          )}
        </div>
        {/* Filter pills */}
        <div style={{ display:"flex",gap:6,marginLeft:"auto" }}>
          {FILTER_OPTIONS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="btn btn-sm"
              style={{ padding:"5px 12px",fontSize:12,fontWeight:600,
                background: filter===f.id ? "var(--accent)" : "var(--surface2)",
                color:      filter===f.id ? "white" : "var(--text2)",
                border:     `1px solid ${filter===f.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius:"var(--radius-sm)" }}>
              {f.label}
            </button>
          ))}
          {canEmbed && (
            <button className="btn btn-sm btn-secondary" onClick={openEmbed} style={{ gap:5,marginLeft:4 }}>
              <Icon d={ic.copy} size={13} /> Embed Map
            </button>
          )}
        </div>
      </div>

      {/* ── Body: map + sidebar ── */}
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>

        {/* Map */}
        <div ref={mapRef} style={{ flex:1,minWidth:0,height:"100%" }} />

        {/* Sidebar */}
        <div style={{ width:260,background:"var(--surface)",borderLeft:"1px solid var(--border)",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column" }}>

          {/* Selected project panel */}
          {selProj && (
            <div style={{ padding:"14px 16px",borderBottom:"1px solid var(--border)",background:"var(--surface2)" }}>
              <div style={{ height:3,borderRadius:2,background:selProj.color,marginBottom:10 }} />
              <div style={{ fontWeight:700,fontSize:13,marginBottom:3,lineHeight:1.3 }}>{selProj.title}</div>
              <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:8 }}>
                {[selProj.address,selProj.city,selProj.state].filter(Boolean).join(", ") || "No address"}
              </div>
              <div style={{ display:"flex",gap:8,marginBottom:10,fontSize:11.5,color:"var(--text2)" }}>
                <span>📷 {selProj.photos?.length||0} photos</span>
                <span>📄 {selProj.reports?.length||0} reports</span>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-primary btn-sm" style={{ flex:1,fontSize:11,justifyContent:"center" }}
                  onClick={() => onSelectProject(selProj)}>
                  Open Jobsite
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ flexShrink:0 }}
                  onClick={() => setSelected(null)}>
                  <Icon d={ic.close} size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Project list */}
          <div style={{ padding:"10px 0",flex:1 }}>
            <div style={{ padding:"0 14px 6px",fontSize:10.5,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".08em" }}>
              {filtered.length} Jobsite{filtered.length!==1?"s":""}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding:"24px 16px",textAlign:"center",color:"var(--text3)",fontSize:12.5 }}>
                No jobsites in this time range.
              </div>
            )}
            {filtered.map(proj => {
              const hasCoords = !!getCoords(proj);
              const isSel = selected === proj.id;
              return (
                <div key={proj.id}
                  onClick={() => { setSelected(proj.id); if (hasCoords && leafletMap.current) { const c = getCoords(proj); leafletMap.current.flyTo([c.lat, c.lng], 14, { duration:0.8 }); } }}
                  style={{ padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                    background: isSel ? "var(--accent-glow)" : "transparent",
                    borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`,
                    transition:"all .15s" }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background="var(--surface2)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background="transparent"; }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:proj.color||"var(--accent)",flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj.title}</div>
                    <div style={{ fontSize:11,color:"var(--text3)",marginTop:1 }}>
                      {hasCoords ? `${proj.city||proj.address||"Located"}` : <span style={{ color:"#e8c53a" }}>⚠ No coordinates</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Help box for projects without coords */}
            {noCoords.length > 0 && (
              <div style={{ margin:"10px 14px",padding:"10px 12px",background:"rgba(232,197,58,.08)",border:"1px solid rgba(232,197,58,.25)",borderRadius:"var(--radius-sm)",fontSize:11.5,color:"var(--text2)",lineHeight:1.6 }}>
                <div style={{ fontWeight:700,color:"#e8c53a",marginBottom:3 }}>⚠ {noCoords.length} jobsite{noCoords.length!==1?"s":""} not on map</div>
                These jobsites have no coordinates yet. Open and re-save each one to automatically locate them, or ensure they have a full street address.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Embed Map Modal ── */}
      {embedOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEmbedOpen(false)}>
          <div className="modal modal-lg fade-in" style={{ maxWidth:640 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon d={ic.copy} size={15} stroke="var(--accent)" /> Embed Map</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setEmbedOpen(false)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body" style={{ padding:"16px 20px" }}>
              {/* Info banner */}
              <div style={{ padding:"10px 14px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:12.5,color:"var(--text2)",marginBottom:14,lineHeight:1.6 }}>
                <div style={{ fontWeight:700,color:"var(--text)",marginBottom:3 }}>🔒 Privacy-safe embed</div>
                The generated code shows only <strong>pin locations</strong> at the current zoom level.
                No project names, addresses, client info, or other jobsite data is included — just colored dots on a map.
              </div>
              {/* Preview */}
              <div style={{ position:"relative",borderRadius:"var(--radius-sm)",overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,height:220 }}>
                <iframe
                  srcDoc={buildMapEmbed()}
                  title="Map embed preview"
                  style={{ width:"100%",height:"100%",border:"none",display:"block" }}
                  sandbox="allow-scripts"
                />
              </div>
              {/* Info row */}
              <div style={{ fontSize:12,color:"var(--text3)",marginBottom:10 }}>
                <strong>{withCoords.length}</strong> location{withCoords.length!==1?"s":""} · Zoom and pan the live map first, then copy the code to capture that exact view.
              </div>
              {/* Code box */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:12,color:"var(--text3)",fontWeight:600 }}>Embed Code</span>
                <button className="btn btn-secondary btn-sm" onClick={copyEmbed}
                  style={{ gap:5,fontSize:12,background:embedCopied?"#3dba7e":undefined,borderColor:embedCopied?"#3dba7e":undefined,transition:"background .2s" }}>
                  {embedCopied ? <><Icon d={ic.check} size={12}/> Copied!</> : <><Icon d={ic.copy} size={12}/> Copy Embed Code</>}
                </button>
              </div>
              <textarea readOnly value={buildMapEmbed()}
                style={{ width:"100%",height:110,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                  color:"var(--text3)",fontSize:11,fontFamily:"monospace",padding:"10px 12px",resize:"none",outline:"none",boxSizing:"border-box" }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={()=>setEmbedOpen(false)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={copyEmbed}
                style={{ minWidth:130,background:embedCopied?"#3dba7e":undefined,borderColor:embedCopied?"#3dba7e":undefined,transition:"background .2s" }}>
                {embedCopied ? <><Icon d={ic.check} size={13}/> Copied!</> : <><Icon d={ic.copy} size={13}/> Copy Code</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
const CAL_USER_COLORS = [
  "#2b7fe8","#a855f7","#3dba7e","#e85a3a","#e8c53a","#3ab8e8","#f0954e","#8b7cf8",
  "#e8703a","#1a9e6e","#d946ef","#06b6d4","#84cc16","#f43f5e","#6366f1","#14b8a6",
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const isSameDay = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const calDateStr = (d) => d.toISOString().slice(0,10);
const parseCalDate = (s) => s ? new Date(s+"T12:00:00") : null;
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const expandRecurringEvent = (event, rangeStart, rangeEnd) => {
  if (!event.repeatEnabled || !event.startDate) return [event];
  const instances = [];
  let cursor = parseCalDate(event.startDate);
  if (!cursor) return [event];
  // Normalise rangeEnd to end-of-day so noon cursors on the last day still pass
  const endBound = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59);
  let safety = 0;
  while (cursor <= endBound && safety++ < 500) {
    if (cursor >= rangeStart) {
      instances.push({ ...event, startDate: calDateStr(cursor), _isRecurring: true });
    }
    const next = new Date(cursor);
    const rv = event.repeatValue || 1;
    if      (event.repeatType === "days")     next.setDate(next.getDate() + rv);
    else if (event.repeatType === "weeks")    next.setDate(next.getDate() + rv * 7);
    else if (event.repeatType === "months")   next.setMonth(next.getMonth() + rv);
    else if (event.repeatType === "monthday") { next.setMonth(next.getMonth() + 1); next.setDate(event.repeatDay||1); }
    else if (event.repeatType === "weekday")  { next.setDate(next.getDate() + 1); while (next.getDay() !== (event.repeatWeekday||0)) next.setDate(next.getDate() + 1); }
    else break;
    if (next <= cursor) break;
    cursor = next;
  }
  return instances.length > 0 ? instances : [event];
};

// ── Event Modal ───────────────────────────────────────────────────────────────
export function TasksPage({ projects, teamUsers, settings, tasks, onTasksChange, onNotify }) {
  const [view, setView]           = useState("board");   // board | list
  const [editingTask, setEditingTask]   = useState(null);
  const [addingTask, setAddingTask]     = useState(null);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [myTasksOnly, setMyTasksOnly]       = useState(false);
  const currentUserId = "__admin__";
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProject,  setFilterProject]  = useState("all");
  const [searchQ, setSearchQ]           = useState("");
  const [columns, setColumns]           = useState(DEFAULT_COLUMNS);
  const [editingCol, setEditingCol]     = useState(null);
  const [newColLabel, setNewColLabel]   = useState("");
  const [dragTask, setDragTask]         = useState(null);
  const [dragOver, setDragOver]         = useState(null);
  const boardRef = useRef(null);

  const scrollBoard = (dir) => {
    if (!boardRef.current) return;
    boardRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const saveTask = t => {
    const exists = tasks.find(x=>x.id===t.id);
    const prevAssignees = exists ? (exists.assigneeIds||[]) : [];
    const newAssignees  = (t.assigneeIds||[]).filter(id => !prevAssignees.includes(id) && id !== "__admin__");
    onTasksChange(exists ? tasks.map(x=>x.id===t.id?t:x) : [...tasks, t]);
    if (onNotify && newAssignees.length > 0) {
      const authorName = `${settings.userFirstName||"Admin"} ${settings.userLastName||""}`.trim();
      newAssignees.forEach(userId => {
        onNotify({
          id: uid(),
          author: authorName,
          authorInitials: `${settings.userFirstName?.[0]||"A"}${settings.userLastName?.[0]||""}`.toUpperCase(),
          authorColor: "var(--accent)",
          action: "assigned you to task",
          context: t.title,
          preview: t.dueDate ? `Due ${t.dueDate}` : (t.description||""),
          date: today(),
          read: false,
          type: "task",
          recipientUserIds: [userId],
        });
      });
    }
    setEditingTask(null); setAddingTask(null);
  };
  const deleteTask = id => { onTasksChange(tasks.filter(t=>t.id!==id)); setConfirmDel(null); };
  const moveTask = (taskId, newStatus) => onTasksChange(tasks.map(t=>t.id===taskId?{...t,status:newStatus}:t));

  // Drag-and-drop handlers
  const onDragStart = (e, taskId) => { setDragTask(taskId); e.dataTransfer.effectAllowed="move"; };
  const onDragOver  = (e, colId)  => { e.preventDefault(); setDragOver(colId); };
  const onDrop      = (e, colId)  => { e.preventDefault(); if (dragTask) moveTask(dragTask, colId); setDragTask(null); setDragOver(null); };

  const allAssignees = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ];

  const filteredTasks = tasks.filter(t => {
    if (myTasksOnly && !t.assigneeIds?.includes(currentUserId)) return false;
    if (filterAssignee !== "all" && !t.assigneeIds?.includes(filterAssignee)) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterProject  !== "all" && t.projectId !== filterProject)  return false;
    if (searchQ && !`${t.title} ${t.description} ${(t.tags||[]).join(" ")}`.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const tasksByCol = col => filteredTasks.filter(t=>t.status===col.id);

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const colors = ["#6b7280","#3ab8e8","#8b7cf8","#e8c53a","#3dba7e","#e85a3a","#f0954e"];
    setColumns(prev=>[...prev, { id:uid(), label, color:colors[prev.length%colors.length] }]);
    setNewColLabel(""); setEditingCol(null);
  };

  const PriorityDot = ({priority, size=8}) => {
    const p = TASK_PRIORITIES.find(x=>x.id===priority)||TASK_PRIORITIES[2];
    return <span style={{ width:size,height:size,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />;
  };

  const AssigneeAvatars = ({assigneeIds=[]}) => {
    const shown = assigneeIds.slice(0,3);
    return (
      <div style={{ display:"flex",gap:-2 }}>
        {shown.map((id,i)=>{
          const u = allAssignees.find(a=>a.id===id);
          if (!u) return null;
          const meta = ROLE_META[u.role]||ROLE_META.user;
          return (
            <div key={id} title={`${u.firstName} ${u.lastName}`}
              style={{ width:22,height:22,borderRadius:"50%",background:meta.color,border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",marginLeft:i>0?-6:0,zIndex:shown.length-i,position:"relative" }}>
              {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
            </div>
          );
        })}
        {assigneeIds.length > 3 && <div style={{ width:22,height:22,borderRadius:"50%",background:"var(--surface3)",border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text2)",marginLeft:-6 }}>+{assigneeIds.length-3}</div>}
      </div>
    );
  };

  const DueBadge = ({dueDate}) => {
    if (!dueDate) return null;
    const due = new Date(dueDate+"T12:00:00");
    const diff = Math.ceil((due - new Date()) / 86400000);
    const overdue = diff < 0;
    const soon    = diff >= 0 && diff <= 2;
    if (!overdue && !soon) return <span style={{ fontSize:10.5,color:"var(--text3)" }}>Due {formatDate(dueDate, settings)}</span>;
    return <span style={{ fontSize:10.5,fontWeight:700,color:overdue?"#e85a3a":"#e8c53a",background:overdue?"#e85a3a18":"#e8c53a18",padding:"1px 7px",borderRadius:10 }}>{overdue?`Overdue ${Math.abs(diff)}d`:`Due in ${diff}d`}</span>;
  };

  // Self-contained list-view checklist expander
  const toggleChecklistItem = (taskId, itemId) => {
    onTasksChange(tasks.map(t => t.id !== taskId ? t : {
      ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, done:!c.done } : c)
    }));
  };

  const progressTask = (taskId, direction) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = columns.findIndex(c => c.id === task.status);
    const next = columns[idx + direction];
    if (next) moveTask(taskId, next.id);
  };

  const TaskCard = ({task}) => {
    const proj = projects.find(p=>p.id===task.projectId);
    const checkDone = (task.checklist||[]).filter(c=>c.done).length;
    const checkTotal = (task.checklist||[]).length;
    const colIdx = columns.findIndex(c=>c.id===task.status);
    const col    = columns[colIdx];
    const canBack = colIdx > 0;
    const canFwd  = colIdx < columns.length - 1;
    const [showChecklist, setShowChecklist] = useState(false);

    return (
      <div draggable onDragStart={e=>onDragStart(e,task.id)}
        style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"11px 13px",cursor:"grab",transition:"box-shadow .15s",userSelect:"none" }}
        onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.18)"}
        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

        {/* Top row */}
        <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:7 }}>
          <PriorityDot priority={task.priority} size={9} />
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:700,lineHeight:1.4,marginBottom:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{task.title}</div>
            {task.description && <div style={{ fontSize:11.5,color:"var(--text2)",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.5 }}>{task.description}</div>}
          </div>
          <div style={{ display:"flex",gap:3,flexShrink:0 }}>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={e=>{e.stopPropagation();setEditingTask(task);}}><Icon d={ic.edit} size={22}/></button>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44,color:"#e85a3a" }} onClick={e=>{e.stopPropagation();setConfirmDel(task);}}><Icon d={ic.trash} size={22}/></button>
          </div>
        </div>

        {/* Tags */}
        {(task.tags||[]).length > 0 && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:7 }}>
            {task.tags.slice(0,3).map(t=><span key={t} style={{ fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"1px 7px",color:"var(--text2)" }}>{t}</span>)}
            {task.tags.length>3 && <span style={{ fontSize:10,color:"var(--text3)" }}>+{task.tags.length-3}</span>}
          </div>
        )}

        {/* Inline checklist (expandable) */}
        {checkTotal > 0 && (
          <div style={{ marginBottom:8 }}>
            {/* Progress bar + toggle */}
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:showChecklist?6:0,cursor:"pointer" }}
              onClick={e=>{e.stopPropagation();setShowChecklist(v=>!v);}}>
              <div style={{ flex:1,height:4,background:"var(--surface3)",borderRadius:2,overflow:"hidden" }}>
                <div style={{ height:"100%",background:checkDone===checkTotal?"#3dba7e":"var(--accent)",borderRadius:2,width:`${Math.round((checkDone/checkTotal)*100)}%`,transition:"width .3s" }} />
              </div>
              <span style={{ fontSize:10.5,color:checkDone===checkTotal?"#3dba7e":"var(--text2)",fontWeight:600,flexShrink:0 }}>{checkDone}/{checkTotal}</span>
              <span style={{ fontSize:10,color:"var(--text3)",flexShrink:0 }}>{showChecklist?"▲":"▼"}</span>
            </div>
            {showChecklist && (
              <div style={{ display:"flex",flexDirection:"column",gap:4,paddingTop:2 }}
                onClick={e=>e.stopPropagation()}>
                {(task.checklist||[]).map(item=>(
                  <div key={item.id} style={{ display:"flex",alignItems:"center",gap:7,padding:"4px 6px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",cursor:"pointer" }}
                    onClick={()=>toggleChecklistItem(task.id, item.id)}>
                    <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                      {item.done && <Icon d={ic.check} size={9} stroke="white" strokeWidth={3}/>}
                    </div>
                    <span style={{ fontSize:11.5,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)",lineHeight:1.3 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom row */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap" }}>
          <AssigneeAvatars assigneeIds={task.assigneeIds||[]} />
          <div style={{ flex:1 }} />
          {proj && <span style={{ fontSize:10,background:`${proj.color}20`,color:proj.color,borderRadius:10,padding:"1px 7px",fontWeight:600,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj.title}</span>}
          <DueBadge dueDate={task.dueDate} />
        </div>

        {/* Progress controls */}
        <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:9,paddingTop:8,borderTop:"1px solid var(--border)" }}
          onClick={e=>e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" disabled={!canBack}
            style={{ fontSize:11,padding:"3px 8px",color:canBack?"var(--text2)":"var(--text3)",opacity:canBack?1:0.35 }}
            onClick={()=>progressTask(task.id,-1)}>
            ← Back
          </button>
          <div style={{ flex:1,textAlign:"center" }}>
            <span style={{ fontSize:10.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:`${col?.color||"#888"}18`,color:col?.color||"var(--text2)" }}>{col?.label||task.status}</span>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={!canFwd}
            style={{ fontSize:11,padding:"3px 8px",color:canFwd?"var(--accent)":"var(--text3)",opacity:canFwd?1:0.35,fontWeight:canFwd?700:400 }}
            onClick={()=>progressTask(task.id,1)}>
            {canFwd ? `→ ${columns[colIdx+1]?.label}` : "✓ Done"}
          </button>
        </div>
      </div>
    );
  };

  const totalOpen = tasks.filter(t=>t.status!=="done").length;
  const totalDone = tasks.filter(t=>t.status==="done").length;

  return (
    <div className="page fade-in" style={{ maxWidth:"100%",paddingRight:0 }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,paddingRight:26 }}>
        <div>
          <div className="section-title" style={{ marginBottom:4 }}>Tasks</div>
          <div className="section-sub" style={{ marginBottom:0 }}>
            {totalOpen} open · {totalDone} completed · {tasks.length} total
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {/* View toggle */}
          <div style={{ display:"flex",background:"var(--surface2)",borderRadius:"var(--radius-sm)",padding:3,border:"1px solid var(--border)" }}>
            {[{v:"board",icon:ic.kanban},{v:"list",icon:ic.clipboardList}].map(({v,icon})=>(
              <button key={v} onClick={()=>setView(v)} className="btn btn-ghost btn-sm btn-icon"
                style={{ width:44,height:44,background:view===v?"var(--surface)":"transparent",boxShadow:view===v?"0 1px 4px rgba(0,0,0,.15)":"none",color:view===v?"var(--accent)":"var(--text2)",transition:"all .15s" }}>
                <Icon d={icon} size={22}/>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ height:44,fontSize:14,padding:"0 16px" }} onClick={()=>setAddingTask("todo")}>
            <Icon d={ic.plus} size={18}/> New Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",paddingRight:26,alignItems:"center" }}>
        <input className="form-input" style={{ width:200 }} placeholder="Search tasks…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        <select className="form-input form-select" style={{ width:"auto" }} value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
          <option value="all">All Assignees</option>
          {allAssignees.map(u=><option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          {TASK_PRIORITIES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterProject} onChange={e=>setFilterProject(e.target.value)}>
          <option value="all">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button onClick={()=>setMyTasksOnly(v=>!v)}
          className="btn btn-sm"
          style={{ padding:"0 14px",height:36,fontWeight:600,fontSize:12.5,display:"flex",alignItems:"center",gap:6,
            background:myTasksOnly?"var(--accent)":"var(--surface2)",
            color:myTasksOnly?"white":"var(--text2)",
            border:`1.5px solid ${myTasksOnly?"var(--accent)":"var(--border)"}` }}>
          <Icon d={ic.user} size={13}/> My Tasks
        </button>
        {(searchQ||filterAssignee!=="all"||filterPriority!=="all"||filterProject!=="all"||myTasksOnly) && (
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--text3)" }} onClick={()=>{setSearchQ("");setFilterAssignee("all");setFilterPriority("all");setFilterProject("all");setMyTasksOnly(false);}}>✕ Clear</button>
        )}
        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
          <span style={{ fontSize:12,color:"var(--text3)" }}>{filteredTasks.length} task{filteredTasks.length!==1?"s":""}</span>
        </div>
      </div>

      {/* ── BOARD VIEW ── */}
      {view==="board" && (
        <div ref={boardRef} style={{ display:"flex",gap:14,overflowX:"auto",paddingBottom:12,paddingRight:26,alignItems:"flex-start",scrollbarWidth:"auto",scrollbarColor:"var(--border) transparent" }}
          className="board-scroll">
        {columns.map(col=>{
            const colTasks = tasksByCol(col);
            const isOver   = dragOver===col.id;
            return (
              <div key={col.id}
                onDragOver={e=>onDragOver(e,col.id)} onDrop={e=>onDrop(e,col.id)}
                style={{ minWidth:272,maxWidth:272,display:"flex",flexDirection:"column",gap:0,flexShrink:0 }}>
                {/* Column header */}
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"0 2px" }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:col.color,flexShrink:0 }} />
                  {editingCol===col.id
                    ? <input className="form-input" style={{ flex:1,padding:"3px 8px",fontSize:13 }} autoFocus
                        defaultValue={col.label}
                        onBlur={e=>{ setColumns(prev=>prev.map(c=>c.id===col.id?{...c,label:e.target.value||c.label}:c)); setEditingCol(null); }}
                        onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Escape") e.target.blur(); }} />
                    : <span style={{ fontWeight:700,fontSize:13.5,flex:1,cursor:"text" }} onDoubleClick={()=>setEditingCol(col.id)}>{col.label}</span>
                  }
                  <span style={{ fontSize:12,fontWeight:700,padding:"1px 8px",borderRadius:10,background:`${col.color}20`,color:col.color }}>{colTasks.length}</span>
                  <button className="btn btn-ghost btn-icon" style={{ width:24,height:24,color:"var(--text3)" }} onClick={()=>setAddingTask(col.id)}><Icon d={ic.plus} size={14}/></button>
                </div>

                {/* Drop zone */}
                <div style={{ display:"flex",flexDirection:"column",gap:8,minHeight:60,padding:isOver?"6px":"2px",borderRadius:"var(--radius)",background:isOver?`${col.color}10`:"transparent",border:isOver?`2px dashed ${col.color}`:"2px solid transparent",transition:"all .15s" }}>
                  {colTasks.length===0 && !isOver && (
                    <div onClick={()=>setAddingTask(col.id)}
                      style={{ padding:"20px 10px",borderRadius:"var(--radius-sm)",border:"2px dashed var(--border)",textAlign:"center",cursor:"pointer",color:"var(--text3)",fontSize:12 }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=col.color}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                      + Add task
                    </div>
                  )}
                  {colTasks.map(task=><TaskCard key={task.id} task={task} />)}
                </div>
              </div>
            );
          })}

          {/* Add column */}
          <div style={{ minWidth:220,flexShrink:0 }}>
            {editingCol==="__new__"
              ? <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Column name…" autoFocus value={newColLabel} onChange={e=>setNewColLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addColumn()} />
                  <button className="btn btn-primary btn-sm" onClick={addColumn}><Icon d={ic.check} size={14}/></button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingCol(null);setNewColLabel("");}}>✕</button>
                </div>
              : <button className="btn btn-ghost btn-sm" style={{ width:"100%",justifyContent:"center",border:"2px dashed var(--border)",padding:"10px",color:"var(--text3)",fontSize:12.5 }}
                  onClick={()=>setEditingCol("__new__")} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  <Icon d={ic.plus} size={14}/> Add Column
                </button>
            }
          </div>
        </div>
      )}

      {/* Board scroll nav buttons */}
      {view==="board" && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,paddingRight:26,paddingTop:10,paddingBottom:8 }}>
          <button className="btn btn-secondary btn-sm" style={{ minWidth:90,gap:6 }} onClick={()=>scrollBoard(-1)}>
            <Icon d={ic.chevLeft} size={14}/> Scroll Left
          </button>
          <button className="btn btn-secondary btn-sm" style={{ minWidth:90,gap:6 }} onClick={()=>scrollBoard(1)}>
            Scroll Right <Icon d={ic.chevRight} size={14}/>
          </button>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view==="list" && (
        <div style={{ paddingRight:26 }}>
          {columns.map(col=>{
            const colTasks = tasksByCol(col);
            if (colTasks.length===0) return null;
            return (
              <div key={col.id} style={{ marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:col.color }} />
                  <span style={{ fontWeight:700,fontSize:14 }}>{col.label}</span>
                  <span style={{ fontSize:12,fontWeight:700,padding:"1px 8px",borderRadius:10,background:`${col.color}20`,color:col.color }}>{colTasks.length}</span>
                </div>
                <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden" }}>
                  {colTasks.map((task,i)=>{
                    const proj = projects.find(p=>p.id===task.projectId);
                    const pri  = TASK_PRIORITIES.find(p=>p.id===task.priority)||TASK_PRIORITIES[2];
                    const checkDone  = (task.checklist||[]).filter(c=>c.done).length;
                    const checkTotal = (task.checklist||[]).length;
                    const colIdx = columns.findIndex(c=>c.id===task.status);
                    const canBack = colIdx > 0;
                    const canFwd  = colIdx < columns.length - 1;
                    const listUrgency = getDueUrgency(task.dueDate);
                    const listBg = listUrgency==="overdue"?"rgba(232,90,58,.04)":listUrgency==="soon"?"rgba(232,197,58,.04)":"transparent";
                    const listBorderL = listUrgency==="overdue"?"3px solid #e85a3a":listUrgency==="soon"?"3px solid #e8c53a":"3px solid transparent";
                    return (
                      <div key={task.id} style={{ borderBottom:i<colTasks.length-1?"1px solid var(--border)":"none",padding:"10px 14px",background:listBg,borderLeft:listBorderL }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {/* Row 1: priority dot + title + edit/delete */}
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                          <div style={{ width:9,height:9,borderRadius:"50%",background:pri.color,flexShrink:0 }} />
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:600,fontSize:13.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{task.title}</div>
                          </div>
                          <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={()=>setEditingTask(task)}><Icon d={ic.edit} size={22}/></button>
                            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44,color:"#e85a3a" }} onClick={()=>setConfirmDel(task)}><Icon d={ic.trash} size={22}/></button>
                          </div>
                        </div>
                        {/* Row 2: meta — description, tags, project, assignees, due, status */}
                        <div style={{ display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,paddingLeft:19 }}>
                          {task.description && <span style={{ fontSize:11.5,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200 }}>{task.description}</span>}
                          {(task.tags||[]).map(t=><span key={t} style={{ fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"1px 7px",color:"var(--text2)" }}>{t}</span>)}
                          {proj && <span style={{ fontSize:10.5,background:`${proj.color}20`,color:proj.color,borderRadius:10,padding:"1px 8px",fontWeight:600,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj.title}</span>}
                          <AssigneeAvatars assigneeIds={task.assigneeIds||[]} />
                          <DueBadge dueDate={task.dueDate} />
                          {checkTotal > 0 && <ListCheckToggle task={task} checkDone={checkDone} checkTotal={checkTotal} onToggleChecklistItem={toggleChecklistItem} />}
                          {/* Status select */}
                          <select className="form-input form-select" value={task.status} onChange={e=>moveTask(task.id,e.target.value)}
                            style={{ width:"auto",fontSize:11,padding:"3px 22px 3px 7px",height:"auto",marginLeft:"auto" }}>
                            {columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredTasks.length===0 && (
            <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--text3)" }}>
              <Icon d={ic.clipboardList} size={40} stroke="var(--text3)"/>
              <div style={{ fontSize:16,fontWeight:700,marginTop:14,marginBottom:6,color:"var(--text2)" }}>{tasks.length===0?"No tasks yet":"No tasks match your filters"}</div>
              {tasks.length===0 && <button className="btn btn-primary" style={{ marginTop:8 }} onClick={()=>setAddingTask("todo")}><Icon d={ic.plus} size={14}/> Create First Task</button>}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {(addingTask || editingTask) && (
        <TaskModal
          task={editingTask||null}
          projects={projects}
          teamUsers={teamUsers}
          settings={settings}
          onSave={saveTask}
          onNotify={onNotify}
          onClose={()=>{ setEditingTask(null); setAddingTask(null); }}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Task</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13.5,color:"var(--text2)",lineHeight:1.7 }}>
                Delete <strong style={{ color:"var(--text)" }}>{confirmDel.title}</strong>? This cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:"#e85a3a",borderColor:"#e85a3a" }} onClick={()=>deleteTask(confirmDel.id)}>
                <Icon d={ic.trash} size={14}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}