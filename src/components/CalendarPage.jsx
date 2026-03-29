import React, { useState, useRef } from "react";
import { Icon, ic } from "../utils/icons.jsx";
import { PLAN_CALENDAR_USERS, PLAN_CALENDAR_RECUR, PLAN_CALENDAR_DISPATCH } from "../utils/constants.js";
import { uid, ROLE_META } from "../utils/helpers.js";

// ── Calendar shared helpers (defined here since CalendarPage was split from the same module) ──
const CAL_USER_COLORS = [
  "#2b7fe8","#a855f7","#3dba7e","#e85a3a","#e8c53a","#3ab8e8","#f0954e","#8b7cf8",
  "#e8703a","#1a9e6e","#d946ef","#06b6d4","#84cc16","#f43f5e","#6366f1","#14b8a6",
];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const isSameDay = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const calDateStr = (d) => d.toISOString().slice(0,10);
const parseCalDate = (s) => s ? new Date(s+"T12:00:00") : null;
const expandRecurringEvent = (event, rangeStart, rangeEnd) => {
  if (!event.repeatEnabled || !event.startDate) return [event];
  const instances = [];
  let cursor = parseCalDate(event.startDate);
  if (!cursor) return [event];
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

export function EventModal({ event, projects, teamUsers, settings, onSave, onClose, onDelete }) {
  const isNew = !event?.id || event?._isNew;
  const allUsers = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ];
  const currentPlan = settings?.plan || "base";
  const canRecur    = PLAN_CALENDAR_RECUR[currentPlan];

  const [form, setForm] = useState({
    id: event?.id || uid(),
    title: event?.title || "",
    description: event?.description || "",
    startDate: event?.startDate || calDateStr(new Date()),
    endDate:   event?.endDate   || calDateStr(new Date()),
    startTime: event?.startTime || "09:00",
    endTime:   event?.endTime   || "10:00",
    allDay:    event?.allDay    ?? false,
    type:      event?.type      || "appointment",
    projectId: event?.projectId || "",
    assigneeIds: event?.assigneeIds || ["__admin__"],
    color:     event?.color     || "#2b7fe8",
    notes:     event?.notes     || "",
    repeatEnabled: event?.repeatEnabled || false,
    repeatType:    event?.repeatType    || "days",
    repeatValue:   event?.repeatValue   || 1,
    repeatDay:     event?.repeatDay     || 1,
    repeatWeekday: event?.repeatWeekday || 1,
    repeatEndDate: event?.repeatEndDate || "",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleAssignee = id => set("assigneeIds", form.assigneeIds.includes(id) ? form.assigneeIds.filter(x=>x!==id) : [...form.assigneeIds, id]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const EVENT_TYPES = [
    { id:"appointment", label:"Appointment", color:"#2b7fe8" },
    { id:"job",         label:"Jobsite Visit", color:"#3dba7e" },
    { id:"inspection",  label:"Inspection",  color:"#8b7cf8" },
    { id:"meeting",     label:"Meeting",     color:"#e8c53a" },
    { id:"deadline",    label:"Deadline",    color:"#e85a3a" },
    { id:"other",       label:"Other",       color:"#6b7280" },
  ];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:580 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew?"New Event":"Edit Event"}</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22}/></button>
        </div>
        <div className="modal-body" style={{ maxHeight:560,overflowY:"auto" }}>

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="What's happening?" autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {EVENT_TYPES.map(t=>(
                <button key={t.id} onClick={()=>{ set("type",t.id); set("color",t.color); }}
                  className="btn btn-sm"
                  style={{ fontSize:11.5,padding:"4px 12px",
                    background:form.type===t.id?t.color:"var(--surface2)",
                    color:form.type===t.id?"white":"var(--text2)",
                    border:`1px solid ${form.type===t.id?t.color:"var(--border)"}` }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <DatePickerInput value={form.startDate} onChange={v => set("startDate", v)} placeholder="Pick start date" />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <DatePickerInput value={form.endDate} onChange={v => set("endDate", v)} placeholder="Pick end date" />
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
            <div onClick={()=>set("allDay",!form.allDay)}
              style={{ width:36,height:20,borderRadius:10,background:form.allDay?"var(--accent)":"var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
              <div style={{ position:"absolute",top:2,left:form.allDay?18:2,width:16,height:16,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"left .2s" }} />
            </div>
            <span style={{ fontSize:12.5,color:"var(--text2)" }}>All day</span>
          </div>

          {!form.allDay && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input className="form-input" type="time" value={form.startTime} onChange={e=>set("startTime",e.target.value)} style={{ colorScheme:"dark" }} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input className="form-input" type="time" value={form.endTime} onChange={e=>set("endTime",e.target.value)} style={{ colorScheme:"dark" }} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Linked Jobsite</label>
            <select className="form-input form-select" value={form.projectId} onChange={e=>set("projectId",e.target.value)}>
              <option value="">Ã¢ÂÂ None Ã¢ÂÂ</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assign To</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {allUsers.map(u=>{
                const sel = form.assigneeIds.includes(u.id);
                const meta = ROLE_META[u.role]||ROLE_META.user;
                return (
                  <div key={u.id} onClick={()=>toggleAssignee(u.id)}
                    style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${sel?meta.color:"var(--border)"}`,background:sel?`${meta.color}15`:"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                    <div style={{ width:20,height:20,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",flexShrink:0 }}>
                      {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                    </div>
                    <span style={{ fontSize:12,fontWeight:sel?700:500,color:sel?meta.color:"var(--text)" }}>{u.firstName} {u.lastName}</span>
                    {sel && <Icon d={ic.check} size={11} stroke={meta.color} strokeWidth={2.5}/>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Additional detailsÃ¢ÂÂ¦" style={{ minHeight:64 }} />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display:"flex",alignItems:"center",gap:8 }}>
              Repeat
              {!canRecur && <span style={{ fontSize:10.5,color:"var(--accent)",fontWeight:700,padding:"1px 7px",background:"var(--accent-glow)",borderRadius:6,border:"1px solid var(--accent)" }}>Intelligence II+</span>}
              {canRecur && (
                <div onClick={()=>set("repeatEnabled",!form.repeatEnabled)}
                  style={{ width:36,height:20,borderRadius:10,background:form.repeatEnabled?"var(--accent)":"var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:2,left:form.repeatEnabled?18:2,width:16,height:16,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"left .2s" }} />
                </div>
              )}
            </label>
            {canRecur && form.repeatEnabled && (
              <div style={{ padding:"12px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {[{id:"days",l:"Daily"},{id:"weeks",l:"Weekly"},{id:"months",l:"Monthly"},{id:"monthday",l:"Day of month"},{id:"weekday",l:"Day of week"}].map(o=>(
                    <button key={o.id} onClick={()=>set("repeatType",o.id)} className="btn btn-sm"
                      style={{ fontSize:11,padding:"3px 10px",background:form.repeatType===o.id?"var(--accent)":"var(--surface3)",color:form.repeatType===o.id?"white":"var(--text2)",border:`1px solid ${form.repeatType===o.id?"var(--accent)":"var(--border)"}` }}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {(form.repeatType==="days"||form.repeatType==="weeks"||form.repeatType==="months") && (
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>Every</span>
                    <input type="number" min="1" max="365" className="form-input" value={form.repeatValue}
                      onChange={e=>set("repeatValue",Math.max(1,parseInt(e.target.value)||1))} style={{ width:64,textAlign:"center",padding:"4px 8px" }}/>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>{form.repeatType}</span>
                  </div>
                )}
                {form.repeatType==="monthday" && (
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>On day</span>
                    <input type="number" min="1" max="31" className="form-input" value={form.repeatDay}
                      onChange={e=>set("repeatDay",Math.min(31,Math.max(1,parseInt(e.target.value)||1)))} style={{ width:64,textAlign:"center",padding:"4px 8px" }}/>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>of each month</span>
                  </div>
                )}
                {form.repeatType==="weekday" && (
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {WEEKDAYS_SHORT.map((d,i)=>(
                      <button key={d} onClick={()=>set("repeatWeekday",i)} className="btn btn-sm"
                        style={{ fontSize:11,padding:"3px 10px",minWidth:44,background:form.repeatWeekday===i?"var(--accent)":"var(--surface3)",color:form.repeatWeekday===i?"white":"var(--text2)",border:`1px solid ${form.repeatWeekday===i?"var(--accent)":"var(--border)"}` }}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Repeat until (optional)</label>
                  <DatePickerInput value={form.repeatEndDate} onChange={v => set("repeatEndDate", v)} placeholder="No end date" />
                </div>
              </div>
            )}
          </div>

        </div>
        <div className="modal-footer" style={{ justifyContent:"space-between" }}>
          <div>
            {!isNew && onDelete && (
              confirmingDelete
                ? <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:12.5,color:"#e85a3a",fontWeight:600 }}>Delete this event?</span>
                    <button className="btn btn-sm" style={{ background:"#e85a3a",border:"none",color:"white",fontWeight:700,padding:"4px 12px" }}
                      onClick={()=>onDelete(form.id)}>
                      Yes, delete
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmingDelete(false)}>Cancel</button>
                  </div>
                : <button className="btn btn-ghost btn-sm" style={{ color:"#e85a3a",borderColor:"rgba(232,90,58,.3)" }}
                    onClick={()=>setConfirmingDelete(true)}>
                    <Icon d={ic.trash} size={14}/> Delete
                  </button>
            )}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.title.trim()} onClick={()=>onSave(form)}>
              <Icon d={ic.check} size={14}/> {isNew?"Create Event":"Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ Calendar Page Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function CalendarPage({ projects, teamUsers, settings, calEvents, onCalEventsChange, onNotify }) {
  const todayDate = new Date();
  const [calView,     setCalView]     = useState("month");
  const [cursor,      setCursor]      = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [dayCursor,   setDayCursor]   = useState(new Date());
  const [showMyOnly,  setShowMyOnly]  = useState(false);
  const [showOthers,  setShowOthers]  = useState(true);
  const [editingEvt,  setEditingEvt]  = useState(null);
  const [newEvtData,  setNewEvtData]  = useState(null); // { date, startTime, endTime }
  const [selectMode,  setSelectMode]  = useState(false);
  const [selectedEvts,setSelectedEvts]= useState(new Set());
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);

  const currentPlan   = settings?.plan || "base";
  const userRole      = settings?.userRole || "admin";
  const isAdminOrMgr  = userRole === "admin" || userRole === "manager";
  const canDispatch   = PLAN_CALENDAR_DISPATCH[currentPlan];
  const maxUsers      = PLAN_CALENDAR_USERS[currentPlan];
  const currentUserId = "__admin__";

  const allUsers = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ].slice(0, maxUsers === Infinity ? undefined : maxUsers);

  const userColorMap = {};
  allUsers.forEach((u,i) => { userColorMap[u.id] = CAL_USER_COLORS[i % CAL_USER_COLORS.length]; });

  const getRangeForView = () => {
    if (calView==="month") {
      return { start: new Date(cursor.getFullYear(), cursor.getMonth(), 1), end: new Date(cursor.getFullYear(), cursor.getMonth()+1, 0, 23, 59, 59) };
    }
    const ws = new Date(dayCursor); ws.setDate(ws.getDate()-ws.getDay()); ws.setHours(0,0,0,0);
    const we = new Date(ws); we.setDate(we.getDate()+6); we.setHours(23,59,59,999);
    if (calView==="week" || calView==="dispatch") return { start:ws, end:we };
    const dayStart = new Date(dayCursor); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(dayCursor); dayEnd.setHours(23,59,59,999);
    return { start: dayStart, end: dayEnd };
  };

  const { start: rangeStart, end: rangeEnd } = getRangeForView();

  const expandedEvents = calEvents.flatMap(ev => {
    const endBound = ev.repeatEndDate ? parseCalDate(ev.repeatEndDate) : rangeEnd;
    return expandRecurringEvent(ev, rangeStart, endBound && endBound < rangeEnd ? endBound : rangeEnd);
  });

  const visibleEvents = expandedEvents.filter(ev => {
    if (!ev.startDate) return false;
    const d = parseCalDate(ev.startDate);
    if (!d) return false;
    // For recurring instances, each has its own startDate Ã¢ÂÂ don't use original endDate
    const eEnd = (!ev._isRecurring && ev.endDate) ? parseCalDate(ev.endDate) : d;
    // Normalise to midnight for pure date comparison
    const dN    = new Date(d.getFullYear(),    d.getMonth(),    d.getDate()).getTime();
    const eEndN = new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate()).getTime();
    const rsN   = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
    const reN   = new Date(rangeEnd.getFullYear(),   rangeEnd.getMonth(),   rangeEnd.getDate()).getTime();
    if (eEndN < rsN || dN > reN) return false;
    if (showMyOnly && !(ev.assigneeIds||[]).includes(currentUserId)) return false;
    if (!showOthers && !(ev.assigneeIds||[]).includes(currentUserId)) return false;
    return true;
  });

  const eventsOnDay = (d) => visibleEvents.filter(ev => {
    const eStart = parseCalDate(ev.startDate);
    if (!eStart) return false;
    // For recurring instances each occurrence has its own startDate Ã¢ÂÂ don't use original endDate
    const eEnd = (!ev._isRecurring && ev.endDate) ? parseCalDate(ev.endDate) : eStart;
    // Normalise all three to midnight for pure date comparison
    const dN = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const sN = new Date(eStart.getFullYear(), eStart.getMonth(), eStart.getDate()).getTime();
    const eN = new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate()).getTime();
    return dN >= sN && dN <= eN;
  });

  const getEvtColor = (ev) => {
    if (ev.color && ev.color !== "#2b7fe8") return ev.color;
    const primary = (ev.assigneeIds||[])[0];
    return primary ? (userColorMap[primary] || ev.color || "#2b7fe8") : (ev.color || "#2b7fe8");
  };

  const saveEvent = (ev) => {
    const exists = calEvents.find(x=>x.id===ev.id);
    onCalEventsChange(exists ? calEvents.map(x=>x.id===ev.id?ev:x) : [...calEvents, ev]);
    if (onNotify) {
      const prevA = exists ? (exists.assigneeIds||[]) : [];
      const newA  = (ev.assigneeIds||[]).filter(id=>!prevA.includes(id)&&id!=="__admin__");
      const authorName = `${settings.userFirstName||"Admin"} ${settings.userLastName||""}`.trim();
      newA.forEach(userId => onNotify({ id:uid(), author:authorName,
        authorInitials:`${settings.userFirstName?.[0]||"A"}${settings.userLastName?.[0]||""}`.toUpperCase(),
        authorColor:"var(--accent)", action:"scheduled you for",
        context:ev.title, preview:`${ev.startDate}${ev.startTime?" at "+ev.startTime:""}`,
        date:calDateStr(new Date()), read:false, type:"calendar", recipientUserIds:[userId] }));
    }
    setEditingEvt(null); setNewEvtData(null);
  };

  const deleteEvent = (id) => {
    onCalEventsChange(calEvents.filter(e=>e.id!==id));
    setEditingEvt(null);
    setNewEvtData(null);
  };

  const deleteSelectedEvents = () => {
    onCalEventsChange(calEvents.filter(e=>!selectedEvts.has(e.id)));
    setSelectedEvts(new Set());
    setSelectMode(false);
    setConfirmBulkDel(false);
  };

  const toggleSelectEvt = (id) => {
    setSelectedEvts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const navPrev = () => {
    if (calView==="month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1));
    else { const d=new Date(dayCursor); d.setDate(d.getDate()-(calView==="week"||calView==="dispatch"?7:1)); setDayCursor(d); }
  };
  const navNext = () => {
    if (calView==="month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1));
    else { const d=new Date(dayCursor); d.setDate(d.getDate()+(calView==="week"||calView==="dispatch"?7:1)); setDayCursor(d); }
  };
  const goToday = () => { setCursor(new Date(todayDate.getFullYear(),todayDate.getMonth(),1)); setDayCursor(new Date()); };

  const headerLabel = () => {
    if (calView==="month") return `${MONTHS_FULL[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (calView==="week"||calView==="dispatch") {
      const ws=new Date(dayCursor); ws.setDate(ws.getDate()-ws.getDay());
      const we=new Date(ws); we.setDate(we.getDate()+6);
      return `${ws.toLocaleDateString("en-US",{month:"short",day:"numeric"})} Ã¢ÂÂ ${we.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    }
    return dayCursor.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  };

  // Ã¢ÂÂÃ¢ÂÂ Month grid Ã¢ÂÂÃ¢ÂÂ
  const renderMonth = () => {
    const year=cursor.getFullYear(), month=cursor.getMonth();
    const daysInMonth=getDaysInMonth(year,month), firstDay=getFirstDayOfMonth(year,month);
    const cells=[];
    for (let i=0;i<firstDay;i++) cells.push(null);
    for (let d=1;d<=daysInMonth;d++) cells.push(new Date(year,month,d));
    return (
      <div className="cal-scroll" style={{ flex:1,overflow:"auto",padding:"0 16px 16px",WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2 }}>
          {WEEKDAYS_SHORT.map(d=>(
            <div key={d} style={{ padding:"6px 4px",textAlign:"center",fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em" }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
          {cells.map((d,i) => {
            if (!d) return <div key={"e"+i} style={{ minHeight:80,background:"var(--surface2)",borderRadius:4,opacity:.3 }} />;
            const isToday = isSameDay(d, todayDate);
            const dayEvts = eventsOnDay(d);
            return (
              <div key={d.toISOString()}
                onClick={()=>{ setDayCursor(new Date(d)); setNewEvtData({ date:calDateStr(d), startTime:null, endTime:null }); }}
                style={{ minHeight:80,background:"var(--surface)",border:`1px solid ${isToday?"var(--accent)":"var(--border)"}`,borderRadius:4,padding:"4px 5px",cursor:"pointer",transition:"background .1s" }}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
                onMouseLeave={e=>e.currentTarget.style.background="var(--surface)"}>
                <div style={{ fontSize:12,fontWeight:isToday?800:400,width:22,height:22,borderRadius:"50%",background:isToday?"var(--accent)":"transparent",color:isToday?"white":"var(--text)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:2 }}>
                  {d.getDate()}
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:1 }}>
                  {dayEvts.slice(0,3).map(ev=>(
                    <div key={ev.id+ev.startDate}
                      onClick={e=>{ e.stopPropagation(); selectMode ? toggleSelectEvt(ev.id) : (()=>{ const orig=calEvents.find(x=>x.id===ev.id); if(orig) setEditingEvt(orig); })(); }}
                      style={{ fontSize:10.5,fontWeight:600,padding:"1px 5px",borderRadius:3,background:getEvtColor(ev),color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:3,outline:selectedEvts.has(ev.id)?"2px solid white":"none" }}>
                      {selectMode && <span style={{ fontSize:9,flexShrink:0 }}>{selectedEvts.has(ev.id)?"Ã¢ÂÂ":"Ã¢ÂÂ"}</span>}
                      {!ev.allDay&&ev.startTime&&<span style={{ opacity:.8,marginRight:2 }}>{ev.startTime}</span>}
                      <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}</span>
                    </div>
                  ))}
                  {dayEvts.length>3&&<div style={{ fontSize:10,color:"var(--text3)",paddingLeft:4,fontWeight:600 }}>+{dayEvts.length-3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Ã¢ÂÂÃ¢ÂÂ Week view Ã¢ÂÂÃ¢ÂÂ
  const [dragState, setDragState] = useState(null); // { day: dateStr, startH, endH }
  const isDragging     = useRef(false);
  const dragDay        = useRef(null);
  const dragStartH     = useRef(null);
  const pendingEndTime = useRef(null);

  const renderWeek = () => {
    const ws=new Date(dayCursor); ws.setDate(ws.getDate()-ws.getDay());
    const days=Array.from({length:7},(_,i)=>{ const d=new Date(ws); d.setDate(d.getDate()+i); return d; });
    const hours=Array.from({length:24},(_,i)=>i);

    const fmtH = h => `${String(h).padStart(2,"0")}:00`;

    const handleMouseDown = (d, h, e) => {
      if (selectMode) return;
      e.preventDefault();
      isDragging.current = true;
      dragDay.current    = calDateStr(d);
      dragStartH.current = h;
      setDragState({ day: calDateStr(d), startH: h, endH: h });
    };

    const handleMouseEnter = (d, h) => {
      if (!isDragging.current) return;
      if (calDateStr(d) !== dragDay.current) return; // stay on same column
      setDragState(s => s ? { ...s, endH: h } : null);
    };

    const handleMouseUp = (d, h) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const sH = dragStartH.current;
      const eH = h;
      const lo = Math.min(sH, eH);
      const hi = Math.max(sH, eH);
      setDragState(null);
      // If released on the same cell as started Ã¢ÂÂ single-click behaviour
      if (lo === hi) {
        setNewEvtData({ date:calDateStr(d), startTime:fmtH(lo), endTime:fmtH(lo+1>23?23:lo+1) });
        return;
      }
      // Drag across multiple cells Ã¢ÂÂ open modal with range
      setNewEvtData({ date:dragDay.current, startTime:fmtH(lo), endTime:fmtH(hi+1>23?23:hi+1) });
    };

    // Global mouseup to cancel drag if released outside grid
    const handleGlobalUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setDragState(null);
      }
    };

    // Pre-compute overlap columns per day so chips sit side-by-side
    const computeLayout = (dayEvts) => {
      // dayEvts: all non-allday events for one day, each with startTime/endTime
      const toMins = t => { const [h,m]=(t||"00:00").split(":").map(Number); return h*60+(m||0); };
      // Sort by start time
      const sorted = [...dayEvts].sort((a,b)=>toMins(a.startTime)-toMins(b.startTime));
      const layout = {}; // ev.id Ã¢ÂÂ { col, total }
      const cols = []; // cols[i] = endMins of last event in that column
      sorted.forEach(ev => {
        const start = toMins(ev.startTime);
        const endH  = ev.endTime ? parseInt(ev.endTime.split(":")[0]) : parseInt(ev.startTime.split(":")[0])+1;
        const endM  = ev.endTime ? parseInt(ev.endTime.split(":")[1]||0) : 0;
        const end   = endH*60+endM;
        // Find first column where this event doesn't overlap
        let placed = false;
        for (let i=0; i<cols.length; i++) {
          if (cols[i] <= start) { cols[i]=end; layout[ev.id]={col:i}; placed=true; break; }
        }
        if (!placed) { layout[ev.id]={col:cols.length}; cols.push(end); }
      });
      const total = cols.length || 1;
      Object.keys(layout).forEach(id => { layout[id].total = total; });
      return layout;
    };

    // Build layout map per day
    const dayLayouts = {};
    days.forEach(d => {
      const dStr = calDateStr(d);
      const allDayEvts = eventsOnDay(d).filter(ev=>!ev.allDay&&ev.startTime);
      dayLayouts[dStr] = computeLayout(allDayEvts);
    });

    return (
      <div className="cal-scroll"
        style={{ flex:1,overflow:"auto",padding:"0 16px 16px",WebkitOverflowScrolling:"touch" }}
        onMouseLeave={handleGlobalUp}
        onMouseUp={handleGlobalUp}>
        <div style={{ display:"grid",gridTemplateColumns:"44px repeat(7,1fr)",minWidth:520 }}>
          <div style={{ borderBottom:"1px solid var(--border)" }}/>
          {days.map(d=>{ const it=isSameDay(d,todayDate); return (
            <div key={d.toISOString()} style={{ borderBottom:"1px solid var(--border)",borderLeft:"1px solid var(--border)",padding:"5px 4px",textAlign:"center",cursor:"pointer",background:it?"var(--accent-glow)":"transparent" }}
              onClick={()=>{setDayCursor(new Date(d));setCalView("day");}}>
              <div style={{ fontSize:10,color:"var(--text3)",fontWeight:600 }}>{WEEKDAYS_SHORT[d.getDay()]}</div>
              <div style={{ fontSize:14,fontWeight:it?800:400,width:24,height:24,borderRadius:"50%",background:it?"var(--accent)":"transparent",color:it?"white":"var(--text)",display:"flex",alignItems:"center",justifyContent:"center",margin:"1px auto 0" }}>{d.getDate()}</div>
            </div>
          );})}
          {/* All-day row */}
          <div style={{ padding:"2px",fontSize:9.5,color:"var(--text3)",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4,borderBottom:"1px solid var(--border)" }}>allÃ¢ÂÂday</div>
          {days.map(d=>(
            <div key={"ad"+d} style={{ borderLeft:"1px solid var(--border)",borderBottom:"1px solid var(--border)",padding:2,minHeight:22 }}
              onClick={()=>{ if(!selectMode) setNewEvtData({ date:calDateStr(d), startTime:null, endTime:null }); }}>
              {eventsOnDay(d).filter(e=>e.allDay).map(ev=>(
                <div key={ev.id}
                  onClick={e=>{ e.stopPropagation(); selectMode ? toggleSelectEvt(ev.id) : (()=>{ const orig=calEvents.find(x=>x.id===ev.id); if(orig) setEditingEvt(orig); })(); }}
                  style={{ fontSize:10,padding:"1px 4px",borderRadius:3,background:getEvtColor(ev),color:"white",marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:3,outline:selectedEvts.has(ev.id)?"2px solid white":"none" }}>
                  {selectMode && <span style={{ fontSize:9,flexShrink:0 }}>{selectedEvts.has(ev.id)?"Ã¢ÂÂ":"Ã¢ÂÂ"}</span>}
                  <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}</span>
                </div>
              ))}
            </div>
          ))}
          {/* Hour rows */}
          {hours.map(h=>(
            <React.Fragment key={h}>
              <div style={{ borderBottom:"1px solid var(--border)",padding:"0 4px 0 0",textAlign:"right",fontSize:9.5,color:"var(--text3)",height:28,lineHeight:"28px",flexShrink:0 }}>
                {h===0?"Midnight":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`}
              </div>
              {days.map(d=>{
                const hEvts=eventsOnDay(d).filter(ev=>!ev.allDay&&ev.startTime&&parseInt(ev.startTime.split(":")[0])===h);
                const dStr = calDateStr(d);
                const layout = dayLayouts[dStr] || {};
                const lo = dragState && dStr===dragState.day ? Math.min(dragState.startH, dragState.endH) : null;
                const hi = dragState && dStr===dragState.day ? Math.max(dragState.startH, dragState.endH) : null;
                const isHighlighted = lo !== null && h >= lo && h <= hi;
                return (
                  <div key={dStr+h}
                    style={{ borderLeft:"1px solid var(--border)",borderBottom:"1px solid var(--border)",height:28,position:"relative",
                      cursor:"crosshair",
                      background: isHighlighted ? "var(--accent-glow)" : "transparent",
                      userSelect:"none" }}
                    onMouseDown={e => handleMouseDown(d, h, e)}
                    onMouseEnter={() => handleMouseEnter(d, h)}
                    onMouseUp={e => { e.stopPropagation(); handleMouseUp(d, h); }}>
                    {/* Drag highlight overlay */}
                    {isHighlighted && h === lo && (
                      <div style={{ position:"absolute",left:2,right:2,top:1,
                        height: `${(hi - lo + 1) * 28 - 2}px`,
                        background:"var(--accent)",opacity:.18,borderRadius:4,
                        pointerEvents:"none",zIndex:0 }} />
                    )}
                    {/* Drag label on first cell */}
                    {isHighlighted && h === lo && hi > lo && (
                      <div style={{ position:"absolute",left:4,top:2,fontSize:9,fontWeight:700,color:"var(--accent)",pointerEvents:"none",zIndex:2,whiteSpace:"nowrap" }}>
                        {fmtH(lo)} Ã¢ÂÂ {fmtH(hi+1 > 23 ? 23 : hi+1)}
                      </div>
                    )}
                    {hEvts.map(ev=>{
                      const startH = parseInt(ev.startTime.split(":")[0]);
                      const startM = parseInt(ev.startTime.split(":")[1]||0);
                      const endParts = ev.endTime ? ev.endTime.split(":") : null;
                      const endH = endParts ? parseInt(endParts[0]) : startH + 1;
                      const endM = endParts ? parseInt(endParts[1]||0) : 0;
                      const durationHours = Math.max(0.25, (endH + endM/60) - (startH + startM/60));
                      const chipHeight = Math.round(durationHours * 28) - 2;
                      const topOffset  = Math.round((startM / 60) * 28);
                      // Overlap layout: divide column width among concurrent events
                      const { col=0, total=1 } = layout[ev.id] || {};
                      const pct = 100 / total;
                      const leftPct  = `${col * pct + 1}%`;
                      const widthPct = `${pct - 1.5}%`;
                      return (
                        <div key={ev.id}
                          onClick={e=>{ e.stopPropagation(); selectMode ? toggleSelectEvt(ev.id) : (()=>{ const orig=calEvents.find(x=>x.id===ev.id); if(orig) setEditingEvt(orig); })(); }}
                          style={{ position:"absolute",left:leftPct,width:widthPct,top:topOffset+1,height:Math.max(26,chipHeight),
                            background:getEvtColor(ev),borderRadius:3,fontSize:9.5,color:"white",
                            padding:"2px 4px",overflow:"hidden",cursor:"pointer",zIndex:1,
                            display:"flex",flexDirection:"column",justifyContent:"flex-start",
                            outline:selectedEvts.has(ev.id)?"2px solid white":"none",
                            boxSizing:"border-box" }}>
                          <div style={{ fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:3 }}>
                            {selectMode && <span style={{ fontSize:9,flexShrink:0 }}>{selectedEvts.has(ev.id)?"Ã¢ÂÂ":"Ã¢ÂÂ"}</span>}
                            <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}</span>
                          </div>
                          {chipHeight > 26 && <div style={{ fontSize:8.5,opacity:.85,whiteSpace:"nowrap" }}>{ev.startTime}{ev.endTime?` Ã¢ÂÂ ${ev.endTime}`:""}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Ã¢ÂÂÃ¢ÂÂ Day view Ã¢ÂÂÃ¢ÂÂ
  const renderDay = () => {
    const dayEvts=eventsOnDay(dayCursor).sort((a,b)=>((a.startTime||"00:00")<(b.startTime||"00:00")?-1:1));
    return (
      <div className="cal-scroll" style={{ flex:1,overflow:"auto",padding:"0 20px 20px",maxWidth:680,WebkitOverflowScrolling:"touch" }}>
        {dayEvts.length===0 ? (
          <div style={{ textAlign:"center",padding:"48px 20px",color:"var(--text3)" }}>
            <Icon d={ic.calendarIcon} size={36} stroke="var(--text3)" />
            <div style={{ fontSize:13,marginTop:10 }}>No events scheduled for this day.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop:14 }} onClick={()=>setNewEvtData({ date:calDateStr(dayCursor), startTime:null, endTime:null })}>
              <Icon d={ic.plus} size={13}/> Add Event
            </button>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {dayEvts.map(ev=>{
              const proj=projects.find(p=>p.id===ev.projectId);
              const color=getEvtColor(ev);
              return (
                <div key={ev.id+ev.startDate}
                  onClick={()=>{ const orig=calEvents.find(x=>x.id===ev.id); if(orig) setEditingEvt(orig); }}
                  style={{ background:"var(--surface)",border:`1px solid var(--border)`,borderLeft:`4px solid ${color}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",cursor:"pointer",transition:"box-shadow .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.15)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,fontSize:14,marginBottom:3,color:"var(--text)" }}>{ev.title}</div>
                      {ev.allDay
                        ? <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3 }}>All day</div>
                        : ev.startTime && <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3 }}>Ã°ÂÂÂ {ev.startTime}{ev.endTime?` Ã¢ÂÂ ${ev.endTime}`:""}</div>
                      }
                      {proj && <div style={{ fontSize:11.5,color,fontWeight:600,marginBottom:3 }}>Ã°ÂÂÂ {proj.title}</div>}
                      {ev.notes && <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>{ev.notes}</div>}
                      {ev.repeatEnabled && <div style={{ fontSize:10.5,color:"var(--text3)",marginTop:4 }}>Ã°ÂÂÂ Recurring</div>}
                    </div>
                    <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                      {(ev.assigneeIds||[]).map(aid=>{
                        const u=allUsers.find(x=>x.id===aid);
                        const m=ROLE_META[u?.role]||ROLE_META.user;
                        return u?(
                          <div key={aid} title={`${u.firstName} ${u.lastName}`}
                            style={{ width:26,height:26,borderRadius:"50%",background:userColorMap[aid]||m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",border:"2px solid var(--surface)" }}>
                            {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                          </div>
                        ):null;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Ã¢ÂÂÃ¢ÂÂ Dispatch view (Command III) Ã¢ÂÂÃ¢ÂÂ
  const renderDispatch = () => {
    const ws=new Date(dayCursor); ws.setDate(ws.getDate()-ws.getDay());
    const days=Array.from({length:7},(_,i)=>{ const d=new Date(ws); d.setDate(d.getDate()+i); return d; });
    return (
      <div className="cal-scroll" style={{ flex:1,overflow:"auto",padding:"0 16px 16px",WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"grid",gridTemplateColumns:"160px repeat(7,minmax(90px,1fr))",gap:0,minWidth:800,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden" }}>
          <div style={{ padding:"8px 12px",fontWeight:700,fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",borderBottom:"1px solid var(--border)",background:"var(--surface2)" }}>Crew Member</div>
          {days.map(d=>{ const it=isSameDay(d,todayDate); return (
            <div key={d.toISOString()} style={{ padding:"6px 4px",textAlign:"center",borderBottom:"1px solid var(--border)",borderLeft:"1px solid var(--border)",background:it?"var(--accent-glow)":"var(--surface2)" }}>
              <div style={{ fontSize:10,color:"var(--text3)",fontWeight:600 }}>{WEEKDAYS_SHORT[d.getDay()]}</div>
              <div style={{ fontSize:13,fontWeight:it?800:400,color:it?"var(--accent)":"var(--text)" }}>{d.getDate()}</div>
            </div>
          );})}
          {allUsers.map(u=>{
            const meta=ROLE_META[u.role]||ROLE_META.user;
            const uColor=userColorMap[u.id];
            return (
              <React.Fragment key={u.id}>
                <div style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderBottom:"1px solid var(--border)",background:"var(--surface2)",minHeight:44 }}>
                  <div style={{ width:26,height:26,borderRadius:"50%",background:uColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                    {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.firstName} {u.lastName}</div>
                    <div style={{ fontSize:10,color:"var(--text3)" }}>{meta.label}</div>
                  </div>
                </div>
                {days.map(d=>{
                  const uEvts=visibleEvents.filter(ev=>{
                    if (!(ev.assigneeIds||[]).includes(u.id)) return false;
                    const eStart = parseCalDate(ev.startDate);
                    if (!eStart) return false;
                    const eEnd = (!ev._isRecurring && ev.endDate) ? parseCalDate(ev.endDate) : eStart;
                    // Normalize all to midnight for day-level comparison
                    const normalize = (dt) => { const n=new Date(dt); n.setHours(0,0,0,0); return n.getTime(); };
                    const dN = normalize(d);
                    return dN >= normalize(eStart) && dN <= normalize(eEnd);
                  });
                  return (
                    <div key={calDateStr(d)} style={{ borderBottom:"1px solid var(--border)",borderLeft:"1px solid var(--border)",padding:3,minHeight:44,cursor:"pointer",background:"transparent" }}
                      onClick={()=>setNewEvtData({ date:calDateStr(d), startTime:null, endTime:null })}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      {uEvts.map(ev=>{
                        const proj=projects.find(p=>p.id===ev.projectId);
                        return (
                          <div key={ev.id+ev.startDate}
                            onClick={e=>{ e.stopPropagation(); selectMode ? toggleSelectEvt(ev.id) : (()=>{ const orig=calEvents.find(x=>x.id===ev.id); if(orig) setEditingEvt(orig); })(); }}
                            style={{ fontSize:10,padding:"2px 5px",borderRadius:3,background:getEvtColor(ev),color:"white",marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:3,outline:selectedEvts.has(ev.id)?"2px solid white":"none" }}>
                            {selectMode && <span style={{ fontSize:9,flexShrink:0 }}>{selectedEvts.has(ev.id)?"Ã¢ÂÂ":"Ã¢ÂÂ"}</span>}
                            <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}{proj?` ÃÂ· ${proj.title.split(" ").slice(0,2).join(" ")}`:""}{ev.startTime?` ${ev.startTime}`:""}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const viewBtns = [
    {v:"month",l:"Month"},{v:"week",l:"Week"},{v:"day",l:"Day"},
    ...(canDispatch?[{v:"dispatch",l:"Ã¢Â¬Â¡ Dispatch"}]:[]),
  ];

  return (
    <div className="page cal-page fade-in" style={{ maxWidth:"100%",paddingRight:0,paddingBottom:0,display:"flex",flexDirection:"column",overflow:"hidden",height:"100%" }}>

      {/* Toolbar */}
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingRight:16,flexWrap:"wrap",flexShrink:0 }}>
        <div style={{ display:"flex",gap:3 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={navPrev} style={{ width:34,height:34 }}><Icon d={ic.chevLeft} size={17}/></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={navNext} style={{ width:34,height:34 }}><Icon d={ic.chevRight} size={17}/></button>
          <button className="btn btn-secondary btn-sm" onClick={goToday} style={{ height:34,fontSize:12 }}>Today</button>
        </div>
        <span style={{ fontWeight:800,fontSize:15,color:"var(--text)" }}>{headerLabel()}</span>

        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
          <button onClick={()=>setShowMyOnly(v=>!v)} className="btn btn-sm"
            style={{ fontSize:11.5,height:32,padding:"0 11px",fontWeight:600,
              background:showMyOnly?"var(--accent)":"var(--surface2)",
              color:showMyOnly?"white":"var(--text2)",
              border:`1px solid ${showMyOnly?"var(--accent)":"var(--border)"}` }}>
            <Icon d={ic.user} size={12}/> Mine
          </button>
          {isAdminOrMgr && (
            <button onClick={()=>setShowOthers(v=>!v)} className="btn btn-sm"
              style={{ fontSize:11.5,height:32,padding:"0 11px",fontWeight:600,
                background:showOthers?"var(--surface2)":"var(--surface3)",
                color:showOthers?"var(--text2)":"var(--text3)",
                border:`1px solid var(--border)` }}>
              <Icon d={ic.users} size={12}/> {showOthers?"Team on":"Team off"}
            </button>
          )}
          <div style={{ display:"flex",background:"var(--surface2)",borderRadius:"var(--radius-sm)",padding:2,border:"1px solid var(--border)",gap:1 }}>
            {viewBtns.map(({v,l})=>(
              <button key={v} onClick={()=>setCalView(v)} className="btn btn-sm"
                style={{ padding:"3px 10px",fontSize:11.5,fontWeight:600,borderRadius:"var(--radius-sm)",
                  background:calView===v?"var(--accent)":"transparent",
                  color:calView===v?"white":"var(--text2)",border:"none" }}>
                {l}
              </button>
            ))}
          </div>
          {!selectMode
            ? <>
                <button className="btn btn-secondary btn-sm" style={{ height:34 }} onClick={()=>{ setSelectMode(true); setSelectedEvts(new Set()); }}>
                  <Icon d={ic.check} size={13}/> Select
                </button>
                <button className="btn btn-primary btn-sm" style={{ height:34 }} onClick={()=>setNewEvtData({ date:calDateStr(calView==="day"?dayCursor:new Date()), startTime:null, endTime:null })}>
                  <Icon d={ic.plus} size={13}/> New Event
                </button>
              </>
            : <>
                <span style={{ fontSize:12.5,color:"var(--text2)",fontWeight:600 }}>{selectedEvts.size} selected</span>
                <button className="btn btn-sm" style={{ height:34,background:"#e85a3a",border:"none",color:"white",fontWeight:700 }}
                  disabled={selectedEvts.size===0}
                  onClick={()=>setConfirmBulkDel(true)}>
                  <Icon d={ic.trash} size={13}/> Delete Selected
                </button>
                <button className="btn btn-ghost btn-sm" style={{ height:34 }} onClick={()=>{ setSelectMode(false); setSelectedEvts(new Set()); setConfirmBulkDel(false); }}>
                  Cancel
                </button>
              </>
          }
        </div>
      </div>

      {/* Bulk delete confirmation bar */}
      {confirmBulkDel && (
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",background:"rgba(232,90,58,.08)",border:"1px solid rgba(232,90,58,.3)",borderRadius:8,marginBottom:8,flexShrink:0 }}>
          <Icon d={ic.alert} size={16} stroke="#e85a3a" />
          <span style={{ fontSize:13,flex:1 }}>Delete <strong>{selectedEvts.size} event{selectedEvts.size!==1?"s":""}</strong>? This cannot be undone.</span>
          <button className="btn btn-sm" style={{ background:"#e85a3a",border:"none",color:"white",fontWeight:700,padding:"4px 14px" }} onClick={deleteSelectedEvents}>Yes, delete</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmBulkDel(false)}>Cancel</button>
        </div>
      )}

      {/* User colour legend */}
      {isAdminOrMgr && showOthers && (
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:8,paddingRight:16,flexShrink:0 }}>
          {allUsers.map(u=>(
            <div key={u.id} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text2)" }}>
              <div style={{ width:9,height:9,borderRadius:"50%",background:userColorMap[u.id],flexShrink:0 }} />
              {u.firstName} {u.lastName}
            </div>
          ))}
        </div>
      )}

      {/* View content */}
      {calView==="month"    && renderMonth()}
      {calView==="week"     && renderWeek()}
      {calView==="day"      && renderDay()}
      {calView==="dispatch" && canDispatch && renderDispatch()}
      {calView==="dispatch" && !canDispatch && (
        <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"var(--text3)" }}>
          <Icon d={ic.dispatch} size={40} stroke="var(--text3)" />
          <div style={{ fontWeight:700,fontSize:15,color:"var(--text2)" }}>Dispatch View Ã¢ÂÂ Command III</div>
          <div style={{ fontSize:13,textAlign:"center",maxWidth:320 }}>Assign crews to jobsites across a weekly dispatch grid. Upgrade to Command III to unlock.</div>
        </div>
      )}

      {/* Event Modal */}
      {(editingEvt || newEvtData) && (
        <EventModal
          key={editingEvt?.id || "new"}
          event={editingEvt || { _isNew:true, startDate:newEvtData.date, endDate:newEvtData.date, startTime:newEvtData.startTime||"09:00", endTime:newEvtData.endTime||(newEvtData.startTime?`${String(parseInt(newEvtData.startTime.split(":")[0])+1).padStart(2,"0")}:00`:"10:00"), allDay:!newEvtData.startTime }}
          projects={projects}
          teamUsers={teamUsers}
          settings={settings}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={()=>{ setEditingEvt(null); setNewEvtData(null); }}
        />
      )}
    </div>
  );
}

