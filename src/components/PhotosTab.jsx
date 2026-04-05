import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icon, ic, RoomIcon } from "../utils/icons.jsx";
import { uid, today , getStatusMeta, getCertStatus, ROLE_META, isValidUuid
} from "../utils/helpers.js";
import { ChecklistsTab, ReportsTab, VideosTab, VoiceNotesTab, ProjectFilesTab, ClientPortalTab, BAPairCard, ClientPortalDesktopOnlyPrompt, ClientPortalUpgradePrompt } from "./ChecklistsTab.jsx";
import { saveSketch as dbSaveSketch, deleteSketch as dbDeleteSketch } from "../lib/sketches.js";
import { SketchEditor, ProjectActivityFeed } from "./SketchEditor.jsx";
import { TEMPLATES } from "../utils/constants.js";
import { AIProjectOverview } from "./SketchEditor.jsx";
import { getAuthHeaders } from "../lib/supabase.js";

// Lazy-load PropertyMapTab to keep initial bundle small
const PropertyMapTabLazy = React.lazy(() =>
  import("./PropertyMapTab.jsx").then(m => ({ default: m.PropertyMapTab }))
);
// Lazy-load JobsiteEquipmentTab
const JobsiteEquipmentTab = React.lazy(() =>
  import("./JobsiteEquipmentTab.jsx").then(m => ({ default: m.JobsiteEquipmentTab }))
);
// Lazy-load AssistantTab
const AssistantTab = React.lazy(() =>
  import("./AssistantTab.jsx").then(m => ({ default: m.AssistantTab }))
);

// ── Camera Component ───────────────────────────────────────────────────────────
function PhotosTab({ project, onUpdateProject, onEditPhoto, onOpenCamera, fileRef, addUploadedPhotos, settings, teamUsers = [], chats = [], onSendPhotoToChat }) {
  const photos    = project.photos    || [];
  const rooms     = project.rooms     || [];
  const photoTags = project.photoTags || ["Before", "During", "After"];

  const [filterRoom,    setFilterRoom]    = useState("all");
  const [filterFloor,   setFilterFloor]   = useState("all");
  const [filterTag,     setFilterTag]     = useState("all");
  const [filterSource,  setFilterSource]  = useState("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [photoDetail,   setPhotoDetail]   = useState(null); // photo for detail modal
  const [bulkTagInput,  setBulkTagInput]  = useState("");
  const [showBulkTag,   setShowBulkTag]   = useState(false);
  const [editingTag,    setEditingTag]    = useState(null);
  const [addingTag,     setAddingTag]     = useState(false);
  const [newTagInput,   setNewTagInput]   = useState("");
  const [settingsPhoto, setSettingsPhoto] = useState(null);
  const [viewerPhoto,   setViewerPhoto]   = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameVal, setEditingNameVal] = useState("");
  const [sharePhoto,    setSharePhoto]    = useState(null);
  const [shareMode,     setShareMode]     = useState("dm");
  const [shareTargetId, setShareTargetId] = useState("");
  const [shareText,     setShareText]     = useState("");
  const shareTextRef = useRef(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [selectMode,    setSelectMode]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // null | "single" | "batch"
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Before & After
  const [showBAModal,   setShowBAModal]   = useState(false);
  const [baBefore,      setBaBefore]      = useState(null);  // photo id
  const [baAfter,       setBaAfter]       = useState(null);  // photo id
  const [baPairName,    setBaPairName]    = useState("");
  const [baRoom,        setBaRoom]        = useState("");
  const [baNotes,       setBaNotes]       = useState("");
  const [baPicking,     setBaPicking]     = useState(null);  // "before" | "after"
  const [showBAPairs,   setShowBAPairs]   = useState(true);

  const currentPlan  = settings?.plan || "base";
  const canBeforeAfter = currentPlan === "pro" || currentPlan === "command";
  const baPairs = project.beforeAfterPairs || [];
  const availableUsers = useMemo(() => teamUsers.filter(u => u.status === "active"), [teamUsers]);
  const shareableChats = useMemo(() => chats.filter(chat => chat && chat.id), [chats]);
  const canSharePhotos = typeof onSendPhotoToChat === "function" && (availableUsers.length > 0 || shareableChats.length > 0);

  const openShareModal = (photo) => {
    const nextMode = availableUsers.length > 0 ? "dm" : "chat";
    setSharePhoto(photo);
    setShareMode(nextMode);
    setShareTargetId(nextMode === "dm"
      ? (availableUsers[0]?.id || "")
      : (shareableChats[0]?.id || "")
    );
  };

  const closeShareModal = () => {
    setSharePhoto(null);
    if (shareTextRef.current) shareTextRef.current.value = "";
    setShareTargetId("");
    setShareMode(availableUsers.length > 0 ? "dm" : "chat");
  };

  useEffect(() => {
    if (!sharePhoto) return;
    if (shareMode === "dm") {
      if (!availableUsers.length) {
        if (shareableChats.length) {
          setShareMode("chat");
          setShareTargetId(shareableChats[0]?.id || "");
        } else {
          setShareTargetId("");
        }
      } else if (!availableUsers.some(user => user.id === shareTargetId)) {
        setShareTargetId(availableUsers[0]?.id || "");
      }
      return;
    }
    if (!shareableChats.length) {
      if (availableUsers.length) {
        setShareMode("dm");
        setShareTargetId(availableUsers[0]?.id || "");
      } else {
        setShareTargetId("");
      }
    } else if (!shareableChats.some(chat => chat.id === shareTargetId)) {
      setShareTargetId(shareableChats[0]?.id || "");
    }
  }, [sharePhoto, shareMode, shareTargetId, availableUsers, shareableChats]);

  const saveBAP = () => {
    if (!baBefore || !baAfter) return;
    const name = baPairName.trim() || `Pair ${baPairs.length + 1}`;
    onUpdateProject({ ...project, beforeAfterPairs: [...baPairs, { id: uid(), name, beforeId: baBefore, afterId: baAfter, room: baRoom, notes: baNotes, createdAt: today() }] });
    setBaBefore(null); setBaAfter(null); setBaPairName(""); setBaRoom(""); setBaNotes(""); setShowBAModal(false);
  };
  const deleteBAP = (id) => onUpdateProject({ ...project, beforeAfterPairs: baPairs.filter(p => p.id !== id) });

  const updatePhoto = (id, patch) =>
    onUpdateProject({ ...project, photos: photos.map(p => p.id===id ? { ...p, ...patch } : p) });
  const deletePhoto = (id) => {
    onUpdateProject({ ...project, photos: photos.filter(p => p.id !== id) });
    setSelectedPhotoIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const deleteBatch = () => {
    onUpdateProject({ ...project, photos: photos.filter(p => !selectedPhotoIds.has(p.id)) });
    setSelectedPhotoIds(new Set());
    setSelectMode(false);
  };

  const bulkAddTag = (tag) => {
    if (!tag.trim()) return;
    onUpdateProject({ ...project, photos: photos.map(p =>
      selectedPhotoIds.has(p.id)
        ? { ...p, tags: Array.from(new Set([...(p.tags||[]), tag.trim()])) }
        : p
    )});
    setBulkTagInput(""); setShowBulkTag(false);
  };

  const downloadSelected = () => {
    const sel = photos.filter(p => selectedPhotoIds.has(p.id) && p.dataUrl);
    sel.forEach((p, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = p.dataUrl;
        a.download = `${(p.name||"photo").replace(/[^a-z0-9]/gi,"_")}.jpg`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };
  const toggleSelect = (id) => setSelectedPhotoIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const saveTags = (tags) => onUpdateProject({ ...project, photoTags: tags });

  const togglePhotoTag = (photoId, tag) => {
    const photo = photos.find(p => p.id===photoId);
    const cur   = photo?.tags || [];
    updatePhoto(photoId, { tags: cur.includes(tag) ? cur.filter(t=>t!==tag) : [...cur, tag] });
  };

  const renameTag = (oldName, newName) => {
    if (!newName.trim() || newName===oldName) { setEditingTag(null); return; }
    const t = newName.trim();
    onUpdateProject({
      ...project,
      photoTags: photoTags.map(x => x===oldName ? t : x),
      photos: photos.map(p => ({ ...p, tags: (p.tags||[]).map(x => x===oldName ? t : x) })),
    });
    setEditingTag(null);
  };
  const deleteTag = (tag) => onUpdateProject({
    ...project,
    photoTags: photoTags.filter(t => t!==tag),
    photos: photos.map(p => ({ ...p, tags: (p.tags||[]).filter(t => t!==tag) })),
  });
  const addTag = () => {
    const t = newTagInput.trim();
    if (!t || photoTags.includes(t)) { setAddingTag(false); setNewTagInput(""); return; }
    saveTags([...photoTags, t]);
    setNewTagInput(""); setAddingTag(false);
  };

  // Collect unique floor values from photos that have one
  const floors = [...new Set(photos.map(p => p.floor).filter(Boolean))].sort();

  const sources = [...new Set(photos.map(p => p.source).filter(Boolean))].sort();

  const filtered = photos.filter(p => {
    if (filterRoom   !== "all" && p.room   !== filterRoom)                  return false;
    if (filterFloor  !== "all" && p.floor  !== filterFloor)                 return false;
    if (filterTag    !== "all" && !(p.tags||[]).includes(filterTag))        return false;
    if (filterSource !== "all" && p.source !== filterSource)                return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (p.name||"").toLowerCase().includes(q)
        || (p.room||"").toLowerCase().includes(q)
        || (p.notes||"").toLowerCase().includes(q)
        || (p.tags||[]).some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const hasActiveFilter = filterRoom !== "all" || filterFloor !== "all" || filterTag !== "all" || filterSource !== "all" || searchQuery.trim();

  return (
    <div>
      {/* ── Search bar ── */}
      <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center" }}>
        <div style={{ flex:1, position:"relative" }}>
          <input
            className="form-input"
            placeholder="🔍 Search photos by name, room, tag, notes…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft:12, paddingRight: searchQuery ? 30 : 12 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:16,lineHeight:1 }}>×</button>
          )}
        </div>
        {hasActiveFilter && (
          <button className="btn btn-ghost btn-sm" style={{ whiteSpace:"nowrap",color:"var(--text3)",fontSize:12 }}
            onClick={() => { setSearchQuery(""); setFilterRoom("all"); setFilterFloor("all"); setFilterTag("all"); setFilterSource("all"); }}>
            × Clear all filters
          </button>
        )}
      </div>

      {/* Top bar */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ fontSize:13,color:"var(--text2)" }}>{filtered.length} of {photos.length} photo{photos.length!==1?"s":""}</div>
          {selectMode && selectedPhotoIds.size > 0 && (
            <span style={{ fontSize:12,fontWeight:700,color:"var(--accent)" }}>{selectedPhotoIds.size} selected</span>
          )}
        </div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          {selectMode ? (<>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setSelectMode(false); setSelectedPhotoIds(new Set()); setShowBulkTag(false);
            }}>Cancel</button>
            {selectedPhotoIds.size > 0 && (<>
              {/* Bulk tag */}
              {showBulkTag ? (
                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                  <input className="form-input" style={{ height:30,padding:"0 8px",fontSize:12,width:130 }}
                    placeholder="Tag name…" value={bulkTagInput}
                    onChange={e => setBulkTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key==="Enter") bulkAddTag(bulkTagInput); if (e.key==="Escape") setShowBulkTag(false); }}
                    autoFocus />
                  <button className="btn btn-primary btn-sm" onClick={() => bulkAddTag(bulkTagInput)}>Add</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkTag(false)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkTag(true)}>
                  🏷 Tag {selectedPhotoIds.size}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={downloadSelected}>
                ⬇ Download {selectedPhotoIds.size}
              </button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={() => setConfirmDelete("batch")}>
                <Icon d={ic.trash} size={13} /> Delete {selectedPhotoIds.size}
              </button>
            </>)}
          </>) : (<>
            {photos.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectMode(true)}>
                ☑ Select
              </button>
            )}
            {canBeforeAfter ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBAModal(true)}>
                <Icon d={ic.layers} size={13} /> Before & After
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" style={{ opacity:0.5,cursor:"default" }} title="Available on Intelligence II and above">
                <Icon d={ic.layers} size={13} /> Before & After <span style={{ fontSize:10,marginLeft:3,fontWeight:700,color:"var(--accent)" }}>II+</span>
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Icon d={ic.image} size={13} /> Upload</button>
            <button className="btn btn-primary btn-sm desktop-only" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={13} /> Live Camera</button>
          </>)}
        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />

      {/* Source filter — only shown when multiple sources exist */}
      {sources.length > 1 && (
        <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:7,marginBottom:10,padding:"8px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap" }}>📤 Source:</span>
          {["all", ...sources].map(s => (
            <span key={s} onClick={() => setFilterSource(s)}
              style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                background:filterSource===s?"var(--accent)":"var(--surface3)",
                color:filterSource===s?"white":"var(--text2)",
                border:`1.5px solid ${filterSource===s?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
              {s==="all" ? "All Sources" : s}
            </span>
          ))}
        </div>
      )}

      {/* Floor filter — only shown when photos have floor data */}
      {floors.length > 0 && (
        <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:7,marginBottom:10,padding:"8px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap" }}>🏢 Floor:</span>
          {["all", ...floors].map(f => (
            <span key={f} onClick={() => setFilterFloor(f)}
              style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                background:filterFloor===f?"var(--accent)":"var(--surface3)",
                color:filterFloor===f?"white":"var(--text2)",
                border:`1.5px solid ${filterFloor===f?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
              {f==="all" ? "All Floors" : f}
            </span>
          ))}
          {filterFloor !== "all" && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft:"auto",fontSize:11.5,color:"var(--text3)" }} onClick={() => setFilterFloor("all")}>× Clear</button>
          )}
        </div>
      )}

      {/* Tags management row */}
      <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:7,marginBottom:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
        <span style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap" }}>📁 Tags:</span>
        {photoTags.map(tag => (
          <div key={tag} style={{ display:"flex",alignItems:"center",gap:4 }}>
            {editingTag===tag ? (
              <input autoFocus className="form-input" style={{ width:100,padding:"2px 7px",fontSize:12,height:26 }}
                defaultValue={tag}
                onBlur={e => renameTag(tag, e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") renameTag(tag, e.target.value); if (e.key==="Escape") setEditingTag(null); }} />
            ) : (
              <span onClick={() => setFilterTag(filterTag===tag?"all":tag)}
                style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                  background:filterTag===tag?"var(--accent)":"var(--surface3)",
                  color:filterTag===tag?"white":"var(--text2)",
                  border:`1.5px solid ${filterTag===tag?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
                {tag}
              </span>
            )}
            <button onClick={() => setEditingTag(tag)} title="Rename" style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:"2px 3px",fontSize:11,lineHeight:1 }}>✏</button>
            <button onClick={() => deleteTag(tag)} title="Delete" style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:"2px 3px",fontSize:11,lineHeight:1 }}>×</button>
          </div>
        ))}
        {addingTag ? (
          <input autoFocus className="form-input" style={{ width:110,padding:"2px 8px",fontSize:12,height:26 }}
            placeholder="Tag name…" value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
            onBlur={addTag}
            onKeyDown={e => { if (e.key==="Enter") addTag(); if (e.key==="Escape") { setAddingTag(false); setNewTagInput(""); }}} />
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ fontSize:12,padding:"2px 10px",height:26 }} onClick={() => setAddingTag(true)}>
            <Icon d={ic.plus} size={11} /> New Tag
          </button>
        )}
        {filterTag !== "all" && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:"auto",fontSize:11.5,color:"var(--text3)" }} onClick={() => setFilterTag("all")}>× Clear</button>
        )}
      </div>

      {/* Room filter pills */}
      {rooms.length > 0 && (
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
          {[{name:"all"}, ...rooms].map(r => (
            <div key={r.name} onClick={() => setFilterRoom(r.name)}
              style={{ fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                background:filterRoom===r.name?"var(--accent)":"var(--surface2)",
                color:filterRoom===r.name?"white":"var(--text2)",
                border:`1.5px solid ${filterRoom===r.name?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
              {r.name==="all"?"All Rooms":r.name}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.camera} size={28} stroke="var(--text3)" /></div>
          <h3>No photos yet</h3>
          <p>Open the live camera or upload photos to start documenting this jobsite.</p>
          <button className="btn btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Camera</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty" style={{ padding:"32px 0" }}>
          <div className="empty-icon"><Icon d={ic.image} size={24} stroke="var(--text3)" /></div>
          <h3>No photos match</h3>
          <p>Try a different search term, room, or filter.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(""); setFilterRoom("all"); setFilterFloor("all"); setFilterTag("all"); setFilterSource("all"); }}>Clear Filters</button>
        </div>
      ) : (
        <div className="grid-4">
          {filtered.map(photo => (
            <div key={photo.id} className="photo-card" style={{ outline: selectedPhotoIds.has(photo.id) ? "2.5px solid var(--accent)" : "none", borderRadius: 12 }}>
              {selectMode && (
                <div style={{ position:"absolute",top:8,left:8,zIndex:10 }}
                  onClick={e => { e.stopPropagation(); toggleSelect(photo.id); }}>
                  <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${selectedPhotoIds.has(photo.id)?"var(--accent)":"rgba(255,255,255,0.7)"}`,
                    background:selectedPhotoIds.has(photo.id)?"var(--accent)":"rgba(0,0,0,0.4)",
                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                    {selectedPhotoIds.has(photo.id) && <Icon d="M20 6L9 17l-5-5" size={13} stroke="white" strokeWidth={2.5} />}
                  </div>
                </div>
              )}
              <div className="photo-card-img" onClick={() => selectMode ? toggleSelect(photo.id) : setViewerPhoto(photo)}>
                {photo.dataUrl && photo.dataUrl.length > 10 && (
                  <img src={photo.dataUrl} alt={photo.name || "photo"} />
                )}
                {(!photo.dataUrl || photo.dataUrl.length <= 10) && (
                  <div className="photo-placeholder">
                    <Icon d={ic.image} size={32} stroke={photo.color||"var(--accent)"} />
                    <span style={{ fontSize:10,color:"var(--text3)" }}>{photo.room||"Photo"}</span>
                  </div>
                )}
                {photo.gps && <div style={{ position:"absolute",bottom:5,left:5 }}><span className="pill" style={{ fontSize:9,padding:"3px 7px" }}><Icon d={ic.mapPin} size={9} stroke="#3dba7e" />GPS</span></div>}
                {/* Hover actions */}
                <div style={{ position:"absolute",top:6,right:6,opacity:0,transition:"opacity .15s",display:"flex",gap:6 }} className="photo-actions">
                  <button className="btn btn-sm btn-icon photo-action-btn"
                    style={{ background:"rgba(20,22,30,0.85)",border:"1px solid var(--border)",color:"var(--text2)",width:36,height:36 }}
                    title="Photo details &amp; metadata"
                    onClick={e => { e.stopPropagation(); setPhotoDetail(photo); }}>
                    ℹ️
                  </button>
                  <button className="btn btn-sm btn-icon photo-action-btn"
                    style={{ background:"rgba(20,22,30,0.85)",border:"1px solid var(--border)",color:"var(--text2)",width:36,height:36 }}
                    title="Edit photo (annotate)"
                    onClick={e => { e.stopPropagation(); onEditPhoto(photo); }}>
                    <Icon d={ic.edit} size={15} />
                  </button>
                  <button className="btn btn-sm btn-icon photo-action-btn"
                    style={{ background:"rgba(20,22,30,0.85)",border:"1px solid var(--border)",color:"var(--text2)",width:36,height:36,opacity:canSharePhotos?1:0.45 }}
                    title="Send photo to chat"
                    disabled={!canSharePhotos}
                    onClick={e => { e.stopPropagation(); if (canSharePhotos) openShareModal(photo); }}>
                    <Icon d={ic.message} size={16} />
                  </button>
                  <button className="btn btn-sm btn-icon photo-action-btn" style={{ background:"#dc3c3c",border:"none",color:"white",width:36,height:36 }}
                    onClick={e => { e.stopPropagation(); setPendingDeleteId(photo.id); setConfirmDelete("single"); }}>
                    <Icon d={ic.trash} size={16} />
                  </button>
                </div>
              </div>

              <div className="photo-card-info">
                {editingNameId === photo.id ? (
                  <input
                    className="photo-card-name-input"
                    style={{ width:"100%", fontSize:"inherit", fontWeight:600, border:"none", borderBottom:"1.5px solid var(--accent)", background:"transparent", color:"var(--text)", outline:"none", padding:"0 0 2px 0", marginBottom:2 }}
                    value={editingNameVal}
                    autoFocus
                    onChange={e => setEditingNameVal(e.target.value)}
                    onBlur={() => { updatePhoto(photo.id, { name: editingNameVal.trim() || photo.name }); setEditingNameId(null); }}
                    onKeyDown={e => { if (e.key === "Enter") { updatePhoto(photo.id, { name: editingNameVal.trim() || photo.name }); setEditingNameId(null); } else if (e.key === "Escape") setEditingNameId(null); }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div className="photo-card-name" title="Click to rename" style={{ cursor:"text" }}
                    onClick={e => { e.stopPropagation(); setEditingNameId(photo.id); setEditingNameVal(photo.name || ""); }}>
                    {photo.name}
                  </div>
                )}
                <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:4,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap" }}>
                  {photo.room && <span><span style={{ fontSize:11 }}>📍</span> {photo.room}</span>}
                  {photo.floor && <><span style={{ color:"var(--border)" }}>·</span><span><span style={{ fontSize:11 }}>🏢</span> {photo.floor}</span></>}
                </div>
                {/* Tag chips */}
                {(photo.tags||[]).length > 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:4 }}>
                    {(photo.tags||[]).map(tag => (
                      <span key={tag} style={{ fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,
                        background:"var(--accent)",color:"white",border:"1px solid var(--accent)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:11,color:"var(--text3)" }}>{photo.date}</div>
              </div>
            </div>
          ))}

          {/* Add photo card */}
          <div className="photo-card" style={{ border:"2px dashed var(--border)",cursor:"pointer" }} onClick={() => onOpenCamera(project)}>
            <div className="photo-card-img" style={{ minHeight:120 }}>
              <div className="photo-placeholder">
                <div style={{ width:44,height:44,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.plus} size={20} stroke="var(--accent)" /></div>
                <span style={{ fontSize:11,color:"var(--text2)" }}>Add photo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.photo-card:hover .photo-actions{opacity:1!important}`}</style>

      {/* ── Photo Lightbox Viewer ── */}
      {viewerPhoto && (() => {
        const idx = filtered.findIndex(p => p.id === viewerPhoto.id);
        const prev = idx > 0 ? filtered[idx - 1] : null;
        const next = idx < filtered.length - 1 ? filtered[idx + 1] : null;
        const photo = viewerPhoto;
        const download = () => {
          const a = document.createElement("a");
          a.href = photo.dataUrl;
          a.download = `${(photo.name||"photo").replace(/[^a-z0-9]/gi,"_")}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        return (
          <div
            style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.96)",display:"flex",flexDirection:"column",overflow:"hidden" }}
            onKeyDown={e=>{
              if(e.key==="Escape") setViewerPhoto(null);
              if(e.key==="ArrowLeft"  && prev) setViewerPhoto(prev);
              if(e.key==="ArrowRight" && next) setViewerPhoto(next);
            }}
            tabIndex={0}
            ref={el=>el&&el.focus()}
            onClick={e=>{ if(e.target===e.currentTarget) setViewerPhoto(null); }}
          >
            {/* Top bar — stacks info above buttons on mobile */}
            <div style={{ display:"flex",flexDirection:"column",gap:8,padding:"10px 16px",background:"rgba(0,0,0,.6)",flexShrink:0 }}>
              {/* Photo info row */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:14,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{photo.name||"Photo"}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,.5)",display:"flex",gap:10,flexWrap:"wrap",marginTop:2 }}>
                  {photo.room && <span>📍 {photo.room}{photo.floor?` · ${photo.floor}`:""}</span>}
                  {photo.date && <span>🗓 {photo.date}{photo.time?` ${photo.time}`:""}</span>}
                  {photo.gps  && <span>🌐 {photo.gps.lat}, {photo.gps.lng}</span>}
                  {(photo.tags||[]).length>0 && <span>🏷 {photo.tags.join(", ")}</span>}
                  <span style={{ color:"rgba(255,255,255,.3)" }}>{idx+1} / {filtered.length}</span>
                </div>
              </div>
              {/* Action buttons row */}
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <button title="Download" onClick={download}
                  style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                  <Icon d={ic.download} size={16} stroke="white"/>
                </button>
                <button title="Edit photo" onClick={()=>{ setViewerPhoto(null); onEditPhoto(photo); }}
                  style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                  <Icon d={ic.edit} size={16} stroke="white"/>
                </button>
                <button title="Photo settings" onClick={()=>{ setViewerPhoto(null); setSettingsPhoto(photo); }}
                  style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                  <Icon d={ic.settings} size={16} stroke="white"/>
                </button>
                <button title="Send photo to chat" onClick={()=>{ if (canSharePhotos) openShareModal(photo); }}
                  disabled={!canSharePhotos}
                  style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:canSharePhotos?"pointer":"default",opacity:canSharePhotos?1:.45 }}>
                  <Icon d={ic.message} size={16} stroke="white"/>
                </button>
                <button title="Delete" onClick={()=>{ deletePhoto(photo.id); setViewerPhoto(next||prev||null); }}
                  onMouseDown={e=>{
                    // Two-click confirm: first click turns red, second deletes
                    const btn = e.currentTarget;
                    if (btn.dataset.armed === "1") return; // second click handled by onClick
                    e.preventDefault();
                    btn.dataset.armed = "1";
                    btn.style.background = "#e85a3a";
                    btn.title = "Click again to confirm delete";
                    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Delete?';
                    btn.style.width = "auto";
                    btn.style.padding = "0 12px";
                    setTimeout(()=>{ btn.dataset.armed="0"; btn.style.background="rgba(220,60,60,.7)"; btn.style.width="36px"; btn.style.padding="0"; btn.title="Delete"; btn.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`; }, 3000);
                  }}
                  style={{ background:"rgba(220,60,60,.7)",border:"none",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                  <Icon d={ic.trash} size={16} stroke="white"/>
                </button>
                <button title="Close (Esc)" onClick={()=>setViewerPhoto(null)}
                  style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"white",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginLeft:"auto" }}>
                  <Icon d={ic.close} size={16} stroke="white"/>
                </button>
              </div>
            </div>

            {/* Image area — arrows are siblings on desktop (absolute), row below on mobile */}
            <div className="viewer-img-wrap" style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",minHeight:0,overflow:"hidden" }}>
              {/* Desktop prev arrow (absolute, hidden on mobile) */}
              {prev && (
                <button onClick={()=>setViewerPhoto(prev)} title="Previous (←)" className="viewer-arrow-desktop"
                  style={{ position:"absolute",left:12,zIndex:10,background:"rgba(0,0,0,.55)",border:"1px solid rgba(255,255,255,.15)",color:"white",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"background .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(43,127,232,.7)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,.55)"}>
                  <Icon d="M15 18l-6-6 6-6" size={20} stroke="white"/>
                </button>
              )}

              {/* Photo */}
              {photo.dataUrl
                ? <img src={photo.dataUrl} alt={photo.name} className="viewer-img"
                    style={{ maxWidth:"calc(100% - 120px)",maxHeight:"100%",objectFit:"contain",borderRadius:4,userSelect:"none",pointerEvents:"none" }}
                    onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                : null}
              {!photo.dataUrl && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:16,color:"rgba(255,255,255,.4)",textAlign:"center",padding:"0 32px" }}>
                  <Icon d={ic.image} size={64} stroke="rgba(255,255,255,.15)" />
                  <div style={{ fontSize:15,fontWeight:600,color:"rgba(255,255,255,.5)" }}>Photo not available</div>
                  <div style={{ fontSize:13,color:"rgba(255,255,255,.3)",lineHeight:1.6,maxWidth:320 }}>
                    This photo was captured before cloud storage was enabled.<br/>
                    Re-capture to restore the image.
                  </div>
                </div>
              )}
              {photo.dataUrl && (
                <div style={{ display:"none",flexDirection:"column",alignItems:"center",gap:16,color:"rgba(255,255,255,.4)",textAlign:"center",padding:"0 32px" }}>
                  <Icon d={ic.image} size={64} stroke="rgba(255,255,255,.15)" />
                  <div style={{ fontSize:13 }}>Failed to load image</div>
                </div>
              )}

              {/* Desktop next arrow (absolute, hidden on mobile) */}
              {next && (
                <button onClick={()=>setViewerPhoto(next)} title="Next (→)" className="viewer-arrow-desktop"
                  style={{ position:"absolute",right:12,zIndex:10,background:"rgba(0,0,0,.55)",border:"1px solid rgba(255,255,255,.15)",color:"white",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"background .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(43,127,232,.7)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,.55)"}>
                  <Icon d="M9 18l6-6-6-6" size={20} stroke="white"/>
                </button>
              )}

              {/* Mobile arrow row — shown below image on mobile only */}
              {filtered.length > 1 && (
                <div className="viewer-arrow-mobile" style={{ display:"none",gap:16,marginTop:10,flexShrink:0 }}>
                  <button onClick={()=>prev&&setViewerPhoto(prev)} disabled={!prev}
                    style={{ background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:"white",borderRadius:"50%",width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",cursor:prev?"pointer":"default",opacity:prev?1:.3 }}>
                    <Icon d="M15 18l-6-6 6-6" size={22} stroke="white"/>
                  </button>
                  <span style={{ color:"rgba(255,255,255,.4)",fontSize:12,alignSelf:"center" }}>{idx+1} / {filtered.length}</span>
                  <button onClick={()=>next&&setViewerPhoto(next)} disabled={!next}
                    style={{ background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:"white",borderRadius:"50%",width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",cursor:next?"pointer":"default",opacity:next?1:.3 }}>
                    <Icon d="M9 18l6-6-6-6" size={22} stroke="white"/>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom thumbnail strip */}
            {filtered.length > 1 && (
              <div style={{ display:"flex",gap:6,padding:"10px 16px",background:"rgba(0,0,0,.6)",overflowX:"auto",flexShrink:0 }}>
                {filtered.map((p,i) => (
                  <div key={p.id} onClick={()=>setViewerPhoto(p)}
                    style={{ width:52,height:52,flexShrink:0,borderRadius:6,overflow:"hidden",cursor:"pointer",
                      border:`2px solid ${p.id===photo.id?"var(--accent)":"rgba(255,255,255,.15)"}`,
                      opacity:p.id===photo.id?1:.55,transition:"opacity .15s,border-color .15s" }}>
                    {p.dataUrl
                      ? <img src={p.dataUrl} alt={p.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : <div style={{ width:"100%",height:"100%",background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.image} size={18} stroke="rgba(255,255,255,.4)"/></div>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Before & After Pairs ── */}
      {canBeforeAfter && baPairs.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,cursor:"pointer" }}
            onClick={() => setShowBAPairs(v=>!v)}>
            <Icon d={ic.layers} size={14} stroke="var(--accent)" />
            <span style={{ fontWeight:700,fontSize:13 }}>Before & After Pairs</span>
            <span style={{ fontSize:11.5,color:"var(--text3)" }}>({baPairs.length})</span>
            <Icon d={showBAPairs?"M18 15l-6-6-6 6":"M6 9l6 6 6-6"} size={14} stroke="var(--text3)" style={{ marginLeft:"auto" }}/>
          </div>
          {showBAPairs && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {baPairs.map(pair => {
                const bPhoto = photos.find(p=>p.id===pair.beforeId);
                const aPhoto = photos.find(p=>p.id===pair.afterId);
                return (
                  <BAPairCard key={pair.id} pair={pair} bPhoto={bPhoto} aPhoto={aPhoto} onDelete={()=>deleteBAP(pair.id)} settings={settings} />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Photo settings popup */}
      {settingsPhoto && (
        <PhotoSettingsModal
          photo={settingsPhoto}
          rooms={rooms}
          photoTags={photoTags}
          onSave={patch => updatePhoto(settingsPhoto.id, patch)}
          onClose={() => setSettingsPhoto(null)}
        />
      )}

      {/* ── Photo Detail Modal (full metadata editor) ── */}
      {photoDetail && (
        <PhotoDetailModal
          photo={photoDetail}
          rooms={rooms}
          photoTags={photoTags}
          onSave={patch => { updatePhoto(photoDetail.id, patch); setPhotoDetail(prev => ({ ...prev, ...patch })); }}
          onClose={() => setPhotoDetail(null)}
          onEditMarkup={() => { onEditPhoto(photoDetail); setPhotoDetail(null); }}
          onDelete={() => { deletePhoto(photoDetail.id); setPhotoDetail(null); }}
        />
      )}

      {sharePhoto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeShareModal()}>
          <div className="modal fade-in" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon d={ic.message} size={15} /> Send Photo to Chat</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeShareModal}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body" style={{ display:"grid",gap:14 }}>
              <div style={{ display:"flex",gap:12,alignItems:"center",padding:12,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12 }}>
                <div style={{ width:76,height:76,borderRadius:10,overflow:"hidden",background:"var(--surface3)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {sharePhoto.dataUrl
                    ? <img src={sharePhoto.dataUrl} alt={sharePhoto.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                    : <Icon d={ic.image} size={24} stroke="var(--text3)" />}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13.5,fontWeight:700,marginBottom:4,wordBreak:"break-word" }}>{sharePhoto.name || "Project Photo"}</div>
                  <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.6 }}>
                    Send this photo from <strong>{project.title}</strong> into a direct message or one of your existing team chats.
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gap:8 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em" }}>Send To</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8 }}>
                <button
                  className="btn btn-sm"
                  disabled={!availableUsers.length}
                  onClick={() => {
                    if (!availableUsers.length) return;
                    setShareMode("dm");
                    setShareTargetId(availableUsers[0]?.id || "");
                  }}
                  style={{
                    justifyContent:"flex-start",
                    padding:"10px 12px",
                    borderRadius:12,
                    border:shareMode === "dm" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background:shareMode === "dm" ? "var(--accent-glow)" : "var(--surface)",
                    color:shareMode === "dm" ? "var(--accent)" : "var(--text)",
                    opacity:availableUsers.length ? 1 : 0.45,
                    boxShadow:shareMode === "dm" ? "inset 0 0 0 1px rgba(74,144,217,.16)" : "none",
                  }}
                >
                  <Icon d={ic.user} size={13} /> Direct Message
                </button>
                <button
                  className="btn btn-sm"
                  disabled={!shareableChats.length}
                  onClick={() => {
                    if (!shareableChats.length) return;
                    setShareMode("chat");
                    setShareTargetId(shareableChats[0]?.id || "");
                  }}
                  style={{
                    justifyContent:"flex-start",
                    padding:"10px 12px",
                    borderRadius:12,
                    border:shareMode === "chat" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background:shareMode === "chat" ? "var(--accent-glow)" : "var(--surface)",
                    color:shareMode === "chat" ? "var(--accent)" : "var(--text)",
                    opacity:shareableChats.length ? 1 : 0.45,
                    boxShadow:shareMode === "chat" ? "inset 0 0 0 1px rgba(74,144,217,.16)" : "none",
                  }}
                >
                  <Icon d={ic.users} size={13} /> Existing Chat
                </button>
                </div>
              </div>

              {shareMode === "dm" ? (
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Send To</label>
                  <div style={{ position:"relative" }}>
                  <select
                    className="form-select"
                    value={shareTargetId}
                    onChange={e => setShareTargetId(e.target.value)}
                    disabled={!availableUsers.length}
                    style={{
                      appearance:"none",
                      WebkitAppearance:"none",
                      MozAppearance:"none",
                      width:"100%",
                      background:"linear-gradient(180deg, var(--surface2) 0%, var(--surface) 100%)",
                      border:"1px solid var(--border)",
                      borderRadius:12,
                      color:"var(--text)",
                      fontWeight:600,
                      fontSize:13,
                      padding:"12px 42px 12px 14px",
                      boxShadow:"inset 0 1px 0 rgba(255,255,255,.02)",
                    }}
                  >
                    {availableUsers.length
                      ? availableUsers.map(user => (
                          <option key={user.id} value={user.id} style={{ color:"#17212b", background:"#ffffff" }}>{`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Team Member"}</option>
                        ))
                      : <option value="" style={{ color:"#17212b", background:"#ffffff" }}>No teammates available</option>}
                  </select>
                  <div style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"var(--text3)" }}>
                    <Icon d="M6 9l6 6 6-6" size={15} />
                  </div>
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Attach To Chat</label>
                  <div style={{ position:"relative" }}>
                  <select
                    className="form-select"
                    value={shareTargetId}
                    onChange={e => setShareTargetId(e.target.value)}
                    disabled={!shareableChats.length}
                    style={{
                      appearance:"none",
                      WebkitAppearance:"none",
                      MozAppearance:"none",
                      width:"100%",
                      background:"linear-gradient(180deg, var(--surface2) 0%, var(--surface) 100%)",
                      border:"1px solid var(--border)",
                      borderRadius:12,
                      color:"var(--text)",
                      fontWeight:600,
                      fontSize:13,
                      padding:"12px 42px 12px 14px",
                      boxShadow:"inset 0 1px 0 rgba(255,255,255,.02)",
                    }}
                  >
                    {shareableChats.length
                      ? shareableChats.map(chat => (
                          <option key={chat.id} value={chat.id} style={{ color:"#17212b", background:"#ffffff" }}>{chat.name || "Untitled Chat"}</option>
                        ))
                      : <option value="" style={{ color:"#17212b", background:"#ffffff" }}>No chats available</option>}
                  </select>
                  <div style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"var(--text3)" }}>
                    <Icon d="M6 9l6 6 6-6" size={15} />
                  </div>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Message</label>
                <textarea
                  ref={shareTextRef}
                  className="form-input"
                  rows={4}
                  defaultValue=""
                  placeholder="Add a note to send with this photo..."
                  style={{ resize:"vertical" }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={closeShareModal}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!shareTargetId}
                onClick={() => {
                  onSendPhotoToChat?.(project, sharePhoto, {
                    mode: shareMode,
                    recipientId: shareMode === "dm" ? shareTargetId : null,
                    chatId: shareMode === "chat" ? shareTargetId : null,
                    text: shareTextRef.current?.value || "",
                  });
                  closeShareModal();
                }}
              >
                <Icon d={ic.check} size={13} /> Send Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal fade-in" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:"#e85a3a" }}><Icon d={ic.trash} size={15} /> Delete Photo{confirmDelete === "batch" ? "s" : ""}</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setConfirmDelete(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:14,color:"var(--text2)",lineHeight:1.6,margin:0 }}>
                {confirmDelete === "batch"
                  ? `Are you sure you want to delete ${selectedPhotoIds.size} photo${selectedPhotoIds.size !== 1 ? "s" : ""}? This cannot be undone.`
                  : "Are you sure you want to delete this photo? This cannot be undone."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmDelete(null); setPendingDeleteId(null); }}>Cancel</button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={() => {
                  if (confirmDelete === "batch") deleteBatch();
                  else if (pendingDeleteId) deletePhoto(pendingDeleteId);
                  setConfirmDelete(null); setPendingDeleteId(null);
                }}>
                <Icon d={ic.trash} size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Before & After Modal */}
      {showBAModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowBAModal(false)}>
          <div className="modal modal-lg fade-in" style={{ maxWidth:680 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon d={ic.layers} size={16} stroke="var(--accent)"/> Create Before & After Pair</div>
              <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={()=>setShowBAModal(false)}><Icon d={ic.close} size={22}/></button>
            </div>
            <div className="modal-body" style={{ maxHeight:520,overflowY:"auto" }}>
              {/* Pair name + room */}
              <div className="form-row" style={{ marginBottom:16 }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Pair Name</label>
                  <input className="form-input" placeholder={`Pair ${baPairs.length+1}`} value={baPairName} onChange={e=>setBaPairName(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Room / Area</label>
                  <select className="form-input form-select" value={baRoom} onChange={e=>setBaRoom(e.target.value)}>
                    <option value="">— None —</option>
                    {rooms.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Notes */}
              <div className="form-group" style={{ marginBottom:16 }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="e.g. Mold remediated, drywall replaced…" value={baNotes} onChange={e=>setBaNotes(e.target.value)} />
              </div>

              {/* Before / After selectors */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>
                {[{key:"before",label:"Before",val:baBefore,set:v=>{setBaBefore(v);setBaPicking(null)}},{key:"after",label:"After",val:baAfter,set:v=>{setBaAfter(v);setBaPicking(null)}}].map(({key,label,val,set})=>{
                  const ph = photos.find(p=>p.id===val);
                  return (
                    <div key={key}>
                      <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--text3)",marginBottom:8 }}>{label} Photo</div>
                      <div style={{ position:"relative",aspectRatio:"4/3",background:"var(--surface2)",borderRadius:8,border:`2px solid ${baPicking===key?"var(--accent)":"var(--border)"}`,overflow:"hidden",cursor:"pointer",transition:"border-color .15s" }}
                        onClick={()=>setBaPicking(baPicking===key?null:key)}>
                        {ph?.dataUrl
                          ? <img src={ph.dataUrl} alt={label} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:"var(--text3)" }}>
                              <Icon d={ic.image} size={28} stroke="var(--text3)" />
                              <span style={{ fontSize:12 }}>Click to select</span>
                            </div>
                        }
                        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.35)",display:"flex",alignItems:"center",justifyContent:"center",opacity:baPicking===key?1:0,transition:"opacity .15s" }}>
                          <span style={{ color:"white",fontWeight:700,fontSize:12 }}>Choose photo</span>
                        </div>
                        {ph && <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"3px 7px",background:"rgba(0,0,0,.55)",fontSize:11,fontWeight:700,color:"white",textTransform:"uppercase" }}>{label}</div>}
                      </div>
                      {ph && <div style={{ fontSize:11,color:"var(--text3)",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{ph.name||ph.room}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Photo picker grid */}
              {baPicking && (
                <div>
                  <div style={{ fontSize:12,fontWeight:700,color:"var(--accent)",marginBottom:8 }}>
                    Select the <strong>{baPicking}</strong> photo:
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,maxHeight:240,overflowY:"auto" }}>
                    {photos.map(ph => {
                      const isSelected = (baPicking==="before"&&baBefore===ph.id)||(baPicking==="after"&&baAfter===ph.id);
                      return (
                        <div key={ph.id} onClick={()=>{ if(baPicking==="before") setBaBefore(ph.id); else setBaAfter(ph.id); setBaPicking(null); }}
                          style={{ position:"relative",aspectRatio:"1",borderRadius:6,overflow:"hidden",cursor:"pointer",border:`2px solid ${isSelected?"var(--accent)":"transparent"}`,transition:"border-color .15s" }}>
                          {ph.dataUrl
                            ? <img src={ph.dataUrl} alt={ph.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                            : <div style={{ width:"100%",height:"100%",background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.image} size={20} stroke="var(--text3)"/></div>
                          }
                          {isSelected && <div style={{ position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.check} size={10} stroke="white" strokeWidth={3}/></div>}
                          <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"2px 5px",background:"rgba(0,0,0,.55)",fontSize:9.5,color:"rgba(255,255,255,.9)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{ph.room}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setShowBAModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!baBefore||!baAfter} onClick={saveBAP}>
                <Icon d={ic.check} size={14}/> Save Pair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Photo Settings Modal ───────────────────────────────────────────────────────
function PhotoSettingsModal({ photo, rooms, photoTags, onSave, onClose }) {
  const [name,    setName]    = useState(photo?.name    || "");
  const [caption, setCaption] = useState(photo?.caption || "");
  const [room,    setRoom]    = useState(photo?.room    || "");
  const [tags,    setTags]    = useState(photo?.tags    || []);

  const toggleTag = (tag) => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleSave = () => {
    onSave({ name: name.trim() || photo?.name, caption: caption.trim(), room, tags });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.settings} size={15} /> Photo Settings</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16} /></button>
        </div>
        <div className="modal-body" style={{ display:"grid", gap:14 }}>
          {/* Thumbnail */}
          {photo?.dataUrl && (
            <div style={{ width:"100%", height:120, borderRadius:"var(--radius-sm)", overflow:"hidden", background:"var(--surface2)" }}>
              <img src={photo.dataUrl} alt={photo.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          )}
          {/* Name */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Photo Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Front entrance" />
          </div>
          {/* Caption */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Caption</label>
            <input className="form-input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption…" />
          </div>
          {/* Room */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Room</label>
            <select className="form-input form-select" value={room} onChange={e => setRoom(e.target.value)}>
              <option value="">— None —</option>
              {rooms.map(r => <option key={r.name || r} value={r.name || r}>{r.name || r}</option>)}
            </select>
          </div>
          {/* Tags */}
          {photoTags.length > 0 && (
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Tags</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
                {photoTags.map(tag => {
                  const active = tags.includes(tag);
                  return (
                    <div key={tag} onClick={() => toggleTag(tag)}
                      style={{ padding:"5px 14px", borderRadius:20, border:`1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: active ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                      {active ? "✓ " : ""}{tag}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Sketch Editor ──────────────────────────────────────────────────────────────
const SKETCH_TOOLS = [
  { id:"pan",       icon:"M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 00-2 2v.5 M14 10.5V4a2 2 0 00-2-2 2 2 0 00-2 2v.5 M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8a6 6 0 006 6h2a6 6 0 006-6v-2.5",  label:"Pan / Move Screen" },
  { id:"select",    icon:"M3 3l7 18 3-7 7-3z",                        label:"Select Element" },
  { id:"pen",       icon:"M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z", label:"Pen" },
  { id:"line",      icon:"M5 19L19 5",                                  label:"Line"      },
  { id:"rect",      icon:"M3 3h18v18H3z",                              label:"Rectangle" },
  { id:"circle",    icon:"M12 22a10 10 0 100-20 10 10 0 000 20z",      label:"Circle"    },
  { id:"dimension", icon:"M21 6H3 M3 6l3-3M3 6l3 3 M21 6l-3-3 M21 6l-3 3 M12 6v8", label:"Dimension"},
  { id:"text",      icon:"M4 7V4h16v3 M9 20h6 M12 4v16",               label:"Text"      },
  { id:"eraser",    icon:"M20 20H7L3 16l10-10 7 7-2.5 2.5",            label:"Eraser"    },
];

const MOISTURE_COLORS = [
  { id:"dry",       color:"#4a90d9", label:"Dry"       },
  { id:"damp",      color:"#3dba7e", label:"Damp"      },
  { id:"wet",       color:"#e8c53a", label:"Wet"       },
  { id:"saturated", color:"#e85a3a", label:"Saturated" },
  { id:"mold",      color:"#8b7cf8", label:"Mold Risk" },
];

const STROKE_COLORS = ["#000000","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#e85a3a","#8b7cf8","#ffffff"];
const REPORT_EMAIL_FEATURE_VISIBLE = false;

// ── Photo Detail Modal ─────────────────────────────────────────────────────────
function PhotoDetailModal({ photo, rooms, photoTags, onSave, onClose, onEditMarkup, onDelete }) {
  const [form, setForm] = useState({
    name:  photo.name  || "",
    room:  photo.room  || "",
    floor: photo.floor || "",
    notes: photo.notes || "",
    tags:  [...(photo.tags || [])],
    tagInput: "",
  });
  const [confirmDel, setConfirmDel] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const save = (patch) => onSave(patch || { name: form.name, room: form.room, floor: form.floor, notes: form.notes, tags: form.tags });

  const addTag = () => {
    const t = form.tagInput.trim();
    if (!t || form.tags.includes(t)) { set("tagInput", ""); return; }
    const next = [...form.tags, t];
    set("tags", next);
    set("tagInput", "");
  };
  const removeTag = (tag) => set("tags", form.tags.filter(t => t !== tag));

  const roomList = rooms.map(r => r.name);

  const download = () => {
    if (!photo.dataUrl) return;
    const a = document.createElement("a");
    a.href = photo.dataUrl;
    a.download = `${(form.name || "photo").replace(/[^a-z0-9]/gi,"_")}.jpg`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div className="modal-title">ℹ️ Photo Details</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display:"grid", gap:14 }}>

          {/* Preview */}
          {photo.dataUrl && (
            <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ width:100, height:80, borderRadius:8, overflow:"hidden", flexShrink:0, background:"var(--surface2)" }}>
                <img src={photo.dataUrl} alt={form.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
              <div style={{ flex:1, fontSize:11.5, color:"var(--text2)", lineHeight:1.7 }}>
                {photo.date && <div>📅 {photo.date}{photo.time ? ` ${photo.time}` : ""}</div>}
                {photo.gps  && <div>🌐 {photo.gps.lat}, {photo.gps.lng}</div>}
                {photo.source && <div>📤 Source: {photo.source}</div>}
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={download}>⬇ Download</button>
                  <button className="btn btn-secondary btn-sm" onClick={onEditMarkup}>✏️ Annotate</button>
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <div className="form-label">Photo Name</div>
            <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Photo name…" />
          </div>

          {/* Room + Floor */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div className="form-label">Room</div>
              {roomList.length > 0 ? (
                <select className="form-input form-select" value={form.room} onChange={e => set("room", e.target.value)}>
                  <option value="">— No room —</option>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              ) : (
                <input className="form-input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="Room / area…" />
              )}
            </div>
            <div>
              <div className="form-label">Floor</div>
              <input className="form-input" value={form.floor} onChange={e => set("floor", e.target.value)}
                placeholder="Main Floor…" list="detail-floor-opts" />
              <datalist id="detail-floor-opts">
                {["Basement","Lower Level","Main Floor","Second Floor","Third Floor","Attic","Roof","Exterior"].map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="form-label">Notes</div>
            <textarea className="form-input form-textarea" value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Add notes about this photo…" style={{ minHeight:64 }} />
          </div>

          {/* Tags */}
          <div>
            <div className="form-label">Tags</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
              {form.tags.map(tag => (
                <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, padding:"3px 9px", borderRadius:12, fontWeight:600, background:"var(--accent)", color:"white" }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background:"none", border:"none", color:"rgba(255,255,255,.8)", cursor:"pointer", fontSize:13, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
              {photoTags.filter(t => !form.tags.includes(t)).map(t => (
                <span key={t} onClick={() => set("tags", [...form.tags, t])}
                  style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, padding:"3px 9px", borderRadius:12, fontWeight:600, background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)", cursor:"pointer" }}>
                  + {t}
                </span>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input className="form-input" style={{ flex:1, height:30, padding:"0 10px", fontSize:12 }}
                placeholder="New tag…" value={form.tagInput}
                onChange={e => set("tagInput", e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") addTag(); }} />
              <button className="btn btn-secondary btn-sm" onClick={addTag}>Add</button>
            </div>
          </div>

          {/* Delete confirm */}
          {confirmDel && (
            <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontSize:13, color:"#f87171", fontWeight:600, marginBottom:8 }}>Delete this photo permanently?</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDel(false)}>Cancel</button>
                <button className="btn btn-sm" style={{ background:"#e85a3a", color:"white", border:"none" }} onClick={onDelete}>Yes, Delete</button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display:"flex", justifyContent:"space-between" }}>
          <button className="btn btn-sm" style={{ background:"rgba(239,68,68,.12)", color:"#f87171", border:"1px solid rgba(239,68,68,.3)" }}
            onClick={() => setConfirmDel(true)}>
            🗑 Delete Photo
          </button>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { save(); onClose(); }}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetail({ project, teamUsers = [], chats = [], onBack, onEdit, onOpenCamera, onEditPhoto, onUpdateProject, onOpenReportCreator, onSendVoiceNoteToChat, onSendFileToChat, onSendPhotoToChat, settings, onSettingsChange, orgId, userId }) {

  const _tabKey = `kc_tab_${project?.id}`;
  const _sketchKey = `kc_sketch_${project?.id}`;
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem(_tabKey) || "overview"; } catch { return "overview"; }
  });
  const [editingSketch, setEditingSketch] = useState(null); // null=list, "new"=new, sketch obj=edit

  // Persist tab so switching browser tabs doesn't lose it
  const setTabPersist = (t) => { setTab(t); try { localStorage.setItem(_tabKey, t); } catch {} };
  // Persist editing sketch id so we can reopen it after tab switch
  const setEditingSketchPersist = (sk) => {
    setEditingSketch(sk);
    try {
      if (sk && sk !== "new") localStorage.setItem(_sketchKey, sk.id);
      else localStorage.removeItem(_sketchKey);
    } catch {}
  };

  // On mount: if we were editing a sketch, reopen it
  useEffect(() => {
    try {
      const sid = localStorage.getItem(_sketchKey);
      if (sid && project?.sketches) {
        const found = project.sketches.find(s => s.id === sid);
        if (found) setEditingSketch(found);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scratchPad, setScratchPad] = useState(project.scratchPad || "");
  const [scratchSaved, setScratchSaved] = useState(false);
  const fileRef = useRef();
  const sm = getStatusMeta(project.status, settings);
  const isDesktopPortal = typeof window === "undefined" ? true : window.innerWidth > 768;
  const isCommandPlan = (settings?.plan || "base") === "command";

  const saveScratchPad = () => {
    onUpdateProject({ ...project, scratchPad });
    setScratchSaved(true);
    setTimeout(() => setScratchSaved(false), 2000);
  };

  const addUploadedPhotos = (files) => {
    const fileArray = Array.from(files);
    const roomName = project.rooms?.[0]?.name || "General";

    fileArray.forEach(async (file) => {
      const photoId = uid();
      const photoName = file.name.replace(/\.[^/.]+$/, "");

      // Show immediately with local dataUrl for instant feedback
      const localUrl = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(file);
      });

      // Upload to Supabase Storage and get permanent URL
      let finalUrl = localUrl; // fallback to local if upload fails
      if (orgId && project.id) {
        try {
          const supaUrl = import.meta.env.VITE_SUPABASE_URL;
          const ext = file.name.split('.').pop() || 'jpg';
          const path = `${orgId}/${project.id}/${photoId}.${ext}`;
          const uploadHeaders = await getAuthHeaders({ 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' });
          const uploadRes = await fetch(`${supaUrl}/storage/v1/object/project-photos/${path}`, {
            method: 'POST',
            headers: uploadHeaders,
            body: file,
          });
          if (uploadRes.ok) {
            finalUrl = `${supaUrl}/storage/v1/object/public/project-photos/${path}`;
          }
        } catch (e) {
          console.warn('[KrakenCam] Upload failed, using local dataUrl:', e.message);
        }
      }

      const newPhoto = { id: photoId, name: photoName, room: roomName, date: today(), tags: ["uploaded"], dataUrl: finalUrl };
      // Use setProjects to get latest state, then call onUpdateProject with fresh data
      onUpdateProject({ ...project, photos: [...(project.photos || []), newPhoto] });
    });
  };

  const deletePhoto = (photoId) => onUpdateProject({ ...project, photos: project.photos.filter(p => p.id !== photoId) });

  const TABS = [
    { id:"overview",   label:"Overview",                                          icon:ic.activity },
    { id:"rooms",      label:`Rooms (${project.rooms?.length||0})`,               icon:ic.rooms    },
    { id:"photos",     label:`Photos (${project.photos?.length||0})`,             icon:ic.camera   },
    { id:"maps",       label:"Maps",                                               icon:ic.mapPin   },
    { id:"sketches",   label:`Sketches (${project.sketches?.length||0})`,         icon:ic.sketch   },
    { id:"voicenotes", label:`Voice Notes (${project.voiceNotes?.length||0})`,    icon:ic.mic      },
    { id:"checklists", label:`Checklists (${project.checklists?.length||0})`,     icon:ic.check    },
    { id:"videos",     label:`Videos (${project.videos?.length||0})`,             icon:ic.video    },
    { id:"files",      label:`Files (${project.files?.length||0})`,               icon:ic.folder   },
    { id:"reports",    label:`Reports (${project.reports?.length||0})`,           icon:ic.reports,  desktopOnly:true },
    { id:"assistant",  label:"Assistant",                                           icon:ic.sparkle  },
    { id:"portal",     label:"Client Portal",                                      icon:ic.eye, desktopOnly:true },
    { id:"equipment",  label:"Equipment",                                          icon:ic.wrench   },
    { id:"activity",   label:"Activity",                                           icon:ic.activity },
  ];

  return (
    <div className="page fade-in">
      {/* Project hero */}
      <div className="project-hero">
        <div className="project-hero-bar" style={{ background:project.color }} />
        <div className="project-hero-body">
          <div className="proj-hero-header" style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
            <div className="proj-hero-text" style={{ flex:1,minWidth:0 }}>
              <div className="project-hero-title">{project.title}</div>
              <div className="project-hero-addr">
                <Icon d={ic.mapPin} size={14} stroke="var(--text3)" />
                {[project.address, project.city, project.state, project.zip].filter(Boolean).length > 0 ? (() => {
                  const addr = [project.address, project.city, project.state, project.zip].filter(Boolean).join(", ");
                  const encoded = encodeURIComponent(addr);
                  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
                  const mapsUrl = isApple ? `maps://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
                  return <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{addr}</a>;
                })() : "—"}
              </div>
            </div>
            <div className="proj-hero-btns" style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
              <span className={`tag tag-${sm.cls}`}>{sm.label}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => onEdit(project)}><Icon d={ic.edit} size={14} /> Edit</button>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={14} /> Camera</button>
            </div>
          </div>

          <div className="project-info-grid" style={{ marginTop:16 }}>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.user} size={11} /> Client</div>
              <div className="project-info-value">{project.clientName || "—"}</div>
              {project.clientPhone && <div className="project-info-sub"><a href={`tel:${project.clientPhone.replace(/\D/g,"")}`} style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{project.clientPhone}</a></div>}
              {project.clientEmail && <div className="project-info-sub">{project.clientEmail}</div>}
            </div>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.building} size={11} /> Contractor</div>
              <div className="project-info-value">{project.contractorName || "—"}</div>
              {project.contractorPhone && <div className="project-info-sub"><a href={`tel:${project.contractorPhone.replace(/\D/g,"")}`} style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{project.contractorPhone}</a></div>}
            </div>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.clockIcon} size={11} /> Details</div>
              <div className="project-info-value">{project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—"}</div>
              <div className="project-info-sub">{project.type || ""}</div>
            </div>
          </div>

          {project.notes && (
            <div style={{ marginTop:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:8,fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
              <strong style={{ color:"var(--text)" }}>Notes: </strong>{project.notes}
            </div>
          )}

          {/* ── Scratch Pad ── */}
          <div style={{ marginTop:10,padding:"8px 12px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)" }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:5 }}>
              <Icon d={ic.pen} size={11} stroke="var(--accent)" />
              <span style={{ fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",flex:1 }}>Scratch Pad</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={saveScratchPad}
                title="Save (Ctrl+S)"
                style={{ fontSize:11.5,height:24,padding:"0 10px",fontWeight:600,color:scratchSaved?"var(--green)":"var(--text3)",transition:"color .2s",flexShrink:0 }}>
                {scratchSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Quick notes, measurements, reminders…"
              value={scratchPad}
              onChange={e => setScratchPad(e.target.value)}
              onKeyDown={e => { if (e.key==="s" && (e.metaKey||e.ctrlKey)) { e.preventDefault(); saveScratchPad(); } }}
              style={{ resize:"vertical",width:"100%",boxSizing:"border-box",fontSize:12.5,lineHeight:1.5,background:"var(--surface)",border:"1px solid var(--border)",minHeight:52 }}
            />
          </div>

          {/* ── Assigned team members strip ── */}
          {(() => {
            const assigned = (project.assignedUserIds||[])
              .map(id => teamUsers.find(u => u.id === id))
              .filter(Boolean);
            const adminTagged = (settings?.userAssignedProjects||[]).includes(project.id);
            if (!adminTagged && assigned.length === 0) return null;

            const adminInitials = `${settings?.userFirstName?.[0]||"A"}${settings?.userLastName?.[0]||""}`.toUpperCase();
            const adminCerts = settings?.userCertifications || [];
            const adminHasCertAlert = adminCerts.some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires)));
            const adminColor = ROLE_META.admin.color;

            return (
              <div style={{ marginTop:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <span style={{ fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",flexShrink:0 }}>
                  Team
                </span>
                <div style={{ display:"flex",flexWrap:"wrap",gap:7,flex:1 }}>
                  {/* Admin pill (when tagged) */}
                  {adminTagged && (
                    <div style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px 5px 6px",background:"var(--surface)",borderRadius:20,border:"1px solid var(--border)",transition:"border-color .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=adminColor}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                      <div style={{ width:26,height:26,borderRadius:"50%",background:adminColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"white",flexShrink:0,position:"relative",overflow:"hidden" }}>
                        {settings?.userAvatar
                          ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : adminInitials
                        }
                        {adminHasCertAlert && (
                          <span style={{ position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#e85a3a",border:"1.5px solid var(--surface)" }} />
                        )}
                      </div>
                      <div style={{ lineHeight:1.2 }}>
                        <div style={{ fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>{settings?.userFirstName} {settings?.userLastName}</div>
                        <div style={{ fontSize:10,color:adminColor,fontWeight:700 }}>Admin</div>
                      </div>
                    </div>
                  )}
                  {/* Regular team member pills */}
                  {assigned.map(u => {
                    const m = ROLE_META[u.role] || ROLE_META.user;
                    const initials = `${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase();
                    const hasCertAlert = (u.certifications||[]).some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires)));
                    return (
                      <div key={u.id} style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px 5px 6px",background:"var(--surface)",borderRadius:20,border:"1px solid var(--border)",transition:"border-color .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=m.color}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                        <div style={{ width:26,height:26,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"white",flexShrink:0,position:"relative" }}>
                          {initials}
                          {hasCertAlert && (
                            <span style={{ position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#e85a3a",border:"1.5px solid var(--surface)" }} />
                          )}
                        </div>
                        <div style={{ lineHeight:1.2 }}>
                          <div style={{ fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize:10,color:m.color,fontWeight:700 }}>{m.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tabs — horizontally scrollable, compact labels */}
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"thin", scrollbarColor:"var(--border) transparent", marginBottom:20, borderBottom:"1px solid var(--border)", paddingBottom:2 }}>
        <div style={{ display:"flex", gap:0, minWidth:"max-content" }}>
          {TABS.map(t => {
            // Shorten labels for desktop display
            const short = {
              overview:"Overview", photos:"Photos", videos:"Videos",
              voicenotes:"Voice", rooms:"Rooms", sketches:"Sketches",
              files:"Files", portal:"Portal", reports:"Reports",
              checklists:"Checks", activity:"Activity",
            }[t.id] || t.label;
            const count = t.label.match(/\((\d+)\)/)?.[1];
            return (
              <button key={t.id}
                className={`btn btn-ghost btn-sm tab-item${t.desktopOnly?" desktop-only":""}`}
                title={t.label}
                style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,paddingLeft:12,paddingRight:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:5 }}
                onClick={() => setTabPersist(t.id)}>
                <Icon d={t.icon} size={13} />
                <span style={{ fontSize:12 }}>{short}</span>
                {count && count !== "0" && <span style={{ fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:10,background:tab===t.id?"var(--accent)":"var(--surface3)",color:tab===t.id?"white":"var(--text3)",lineHeight:1.4 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Timeline card */}
          {(() => {
            const TL_STAGES = [
              { id:"lead",        label:"Lead",        icon:"📋" },
              { id:"assessment",  label:"Assessment",  icon:"🔍" },
              { id:"approved",    label:"Approved",    icon:"✅" },
              { id:"planning",    label:"Planning",    icon:"🗂️" },
              { id:"in_progress", label:"In Progress", icon:"🔨" },
              { id:"final_walk",  label:"Final Walk",  icon:"🚶" },
              { id:"completion_phase", label:"Completion Phase", icon:"🧩" },
              { id:"invoiced",    label:"Invoiced",    icon:"🧾" },
              { id:"completed",   label:"Completed",   icon:"🏁" },
            ];
            const aIdx = TL_STAGES.findIndex(s => s.id === project.timelineStage);
            const activeStage = TL_STAGES.find(s => s.id === project.timelineStage);
            const stageNote = project.timelineNotes?.[project.timelineStage];
            const clientStageNote = project.timelineClientNotes?.[project.timelineStage];
            return (
              <div className="card">
                <div className="card-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:700 }}>Project Timeline</span>
                  {activeStage
                    ? <span style={{ fontSize:11.5, fontWeight:600, color:"var(--accent)", background:"var(--accent-glow)", padding:"3px 10px", borderRadius:20 }}>{activeStage.icon} {activeStage.label}</span>
                    : <span style={{ fontSize:11.5, color:"var(--text3)" }}>No stage set — click to update</span>
                  }
                </div>
                <div className="card-body" style={{ padding:"14px 20px 18px" }}>
                  <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
                  <div style={{ position:"relative", minWidth:480 }}>
                    <div style={{ position:"absolute", top:17, left:"3.5%", right:"3.5%", height:2, background:"var(--border)", zIndex:0 }} />
                    {aIdx > 0 && <div style={{ position:"absolute", top:17, left:"3.5%", width:`${(aIdx/(TL_STAGES.length-1))*93}%`, height:2, background:"var(--accent)", zIndex:1, transition:"width .4s" }} />}
                    <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:2 }}>
                      {TL_STAGES.map((stage, i) => {
                        const isDone   = aIdx >= 0 && i < aIdx;
                        const isActive = project.timelineStage === stage.id;
                        return (
                          <div key={stage.id} onClick={() => onUpdateProject({
                            ...project,
                            timelineStage: isActive ? "" : stage.id,
                            timelineNotes: project.timelineNotes || {},
                            timelineClientNotes: project.timelineClientNotes || {},
                          })}
                            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", flex:1 }}>
                            <div style={{ width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
                              border:`2px solid ${isActive||isDone ? "var(--accent)" : "var(--border)"}`,
                              background: isActive ? "var(--accent)" : isDone ? "var(--accent-glow)" : "var(--surface)",
                              boxShadow: isActive ? "0 0 0 4px var(--accent-glow)" : "none", transition:"all .2s" }}>
                              {isDone ? <Icon d={ic.check} size={13} stroke="var(--accent)" /> : <span style={{ filter:isActive?"brightness(10)":"none" }}>{stage.icon}</span>}
                            </div>
                            <span style={{ fontSize:10, fontWeight:isActive?700:500, color:isActive?"var(--accent)":isDone?"var(--text2)":"var(--text3)", textAlign:"center", lineHeight:1.2, whiteSpace:"nowrap" }}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                  {project.timelineStage && (
                    <div style={{ marginTop:12, display:"grid", gap:8 }}>
                      <input
                        className="form-input"
                        style={{ fontSize:12.5 }}
                        placeholder={`Internal note for "${activeStage?.label || "this stage"}"…`}
                        value={project.timelineNotes?.[project.timelineStage] || ""}
                        onChange={e => onUpdateProject({
                          ...project,
                          timelineNotes: {
                            ...(project.timelineNotes || {}),
                            [project.timelineStage]: e.target.value,
                          },
                        })}
                      />
                      <input
                        className="form-input"
                        style={{ fontSize:12.5 }}
                        placeholder={`Client portal note for "${activeStage?.label || "this stage"}"…`}
                        value={project.timelineClientNotes?.[project.timelineStage] || ""}
                        onChange={e => onUpdateProject({
                          ...project,
                          timelineClientNotes: {
                            ...(project.timelineClientNotes || {}),
                            [project.timelineStage]: e.target.value,
                          },
                        })}
                      />
                      {stageNote && (
                        <div style={{ padding:"8px 12px", background:"var(--surface2)", borderRadius:"var(--radius-sm)", borderLeft:"3px solid var(--accent)", fontSize:12.5, color:"var(--text2)", lineHeight:1.5 }}>
                          <strong style={{ color:"var(--text)" }}>Internal:</strong> {stageNote}
                        </div>
                      )}
                      {clientStageNote && (
                        <div style={{ padding:"8px 12px", background:"var(--surface2)", borderRadius:"var(--radius-sm)", borderLeft:"3px solid #7cb6ff", fontSize:12.5, color:"var(--text2)", lineHeight:1.5 }}>
                          <strong style={{ color:"var(--text)" }}>Client portal:</strong> {clientStageNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* AI Project Overview */}
          <AIProjectOverview
            project={project}
            settings={settings}
            onSettingsChange={onSettingsChange}
            orgId={orgId}
            userId={userId}
          />

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span style={{ fontWeight:700 }}>Photo Summary</span></div>
              <div className="card-body" style={{ padding:"10px 16px" }}>
                {project.rooms?.map(room => {
                  const cnt = project.photos?.filter(p=>p.room===room.name).length || 0;
                  return (
                    <div key={room.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)" }}>
                      <div style={{ width:32,height:32,borderRadius:8,background:"#f4f9ff",border:"1.5px solid #4a90d933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <RoomIcon name={room.name} size={16} />
                      </div>
                      <div style={{ flex:1,fontSize:13,fontWeight:600,color:"var(--text)" }}>{room.name}</div>
                      <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                        <span style={{ fontSize:13,fontWeight:700,color:cnt>0?"var(--text)":"var(--text3)" }}>{cnt}</span>
                        <span style={{ fontSize:11,color:"var(--text3)" }}>photo{cnt!==1?"s":""}</span>
                      </div>
                    </div>
                  );
                })}
                {(!project.rooms?.length || !project.photos?.length) && (
                  <div style={{ fontSize:13,color:"var(--text3)",textAlign:"center",padding:"16px 0" }}>No photos yet</div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span style={{ fontWeight:700 }}>Quick Actions</span></div>
              <div className="card-body">
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <button className="btn btn-primary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Live Camera</button>
                  <button className="btn btn-secondary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => { fileRef.current?.click(); }}><Icon d={ic.image} size={15} /> Upload Photos</button>
                  <button className="btn btn-secondary desktop-only" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => setTabPersist("reports")}><Icon d={ic.reports} size={15} /> Create Report</button>
                  <button className="btn btn-secondary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => onEdit(project)}><Icon d={ic.edit} size={15} /> Edit Project Info</button>
                </div>
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (
        <PhotosTab
          project={project}
          onUpdateProject={onUpdateProject}
          onEditPhoto={onEditPhoto}
          onOpenCamera={onOpenCamera}
          fileRef={fileRef}
          addUploadedPhotos={addUploadedPhotos}
          settings={settings}
          teamUsers={teamUsers}
          chats={chats}
          onSendPhotoToChat={onSendPhotoToChat}
        />
      )}

      {/* Maps tab */}
      {tab === "maps" && (
        <React.Suspense fallback={<div style={{ padding:32, textAlign:"center", color:"var(--text2)", fontSize:13 }}>Loading maps…</div>}>
          <PropertyMapTabLazy
            project={project}
            orgId={orgId}
            userId={userId}
            onUpdateProject={onUpdateProject}
            settings={settings}
          />
        </React.Suspense>
      )}

      {/* Videos tab */}
      {tab === "videos" && (
        <VideosTab
          project={project}
          onUpdateProject={onUpdateProject}
          onOpenCamera={onOpenCamera}
          orgId={orgId}
          userId={userId}
          teamUsers={teamUsers}
        />
      )}

      {tab === "voicenotes" && (
        <VoiceNotesTab
          project={project}
          teamUsers={teamUsers}
          settings={settings}
          onUpdateProject={onUpdateProject}
          onSendToDirectMessage={onSendVoiceNoteToChat}
          orgId={orgId}
        />
      )}

      {/* Rooms tab */}
      {tab === "rooms" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:13,color:"var(--text2)" }}>{project.rooms?.length || 0} rooms defined</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(project)}><Icon d={ic.edit} size={13} /> Manage Rooms</button>
          </div>
          <div className="grid-4">
            {project.rooms?.map(room => {
              const count = project.photos?.filter(p => p.room===room.name).length || 0;
              return (
                <div key={room.id} className="room-card" onClick={() => onOpenCamera({ ...project, _defaultRoom:room.name })}>
                  <div className="room-icon-wrap" style={{ background:"#f4f9ff",border:"1.5px solid #4a90d933" }}><RoomIcon name={room.name} size={20} /></div>
                  <div className="room-name">{room.name}</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginTop:4 }}>
                    <span style={{ fontSize:18,fontWeight:800,color:count>0?"#4a90d9":"var(--text3)",lineHeight:1 }}>{count}</span>
                    <span style={{ fontSize:11,color:"var(--text3)",fontWeight:500 }}>photo{count!==1?"s":""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "files" && (
        <ProjectFilesTab
          project={project}
          teamUsers={teamUsers}
          settings={settings}
          onUpdateProject={onUpdateProject}
          onSendFileToDirectMessage={onSendFileToChat}
          orgId={orgId}
        />
      )}
      {tab === "portal" && (
        !isDesktopPortal ? (
          <ClientPortalDesktopOnlyPrompt />
        ) : !isCommandPlan ? (
          <ClientPortalUpgradePrompt settings={settings} />
        ) : (
          <ClientPortalTab
            project={project}
            settings={settings}
            onUpdateProject={onUpdateProject}
          />
        )
      )}

      {/* Reports tab */}
      {tab === "reports" && (
        <ReportsTab
          project={project}
          onUpdateProject={onUpdateProject}
          onOpenReportCreator={onOpenReportCreator}
          settings={settings}
        />
      )}
      {tab === "sketches" && (
        <SketchesTab
          project={project}
          onUpdateProject={onUpdateProject}
          onNewSketch={() => setEditingSketchPersist("new")}
          onEditSketch={sk => setEditingSketchPersist(sk)}
        />
      )}
      {tab === "checklists" && (
        <ChecklistsTab project={project} onUpdateProject={onUpdateProject} />
      )}
      {tab === "equipment" && (
        <React.Suspense fallback={<div style={{ padding:40,textAlign:"center",color:"var(--text3)" }}>Loading…</div>}>
          <JobsiteEquipmentTab project={project} orgId={orgId} userId={userId} />
        </React.Suspense>
      )}
      {tab === "assistant" && (
        <React.Suspense fallback={<div style={{ padding:40,textAlign:"center",color:"var(--text3)" }}>Loading…</div>}>
          <AssistantTab
            project={project}
            orgId={orgId}
            userId={userId}
            settings={settings}
            onSettingsChange={onSettingsChange}
            teamUsers={teamUsers}
          />
        </React.Suspense>
      )}
      {tab === "activity" && (
        <ProjectActivityFeed project={project} onUpdateProject={onUpdateProject} settings={settings} userId={userId} />
      )}
      {editingSketch !== null && (
        <SketchEditor
          sketch={editingSketch === "new" ? null : editingSketch}
          rooms={project.rooms}
          reports={project.reports}
          project={project}
          settings={settings}
          onSave={(savedSketch, reportId) => {
            const existing = project.sketches || [];
            const updated  = existing.some(s => s.id === savedSketch.id)
              ? existing.map(s => s.id === savedSketch.id ? savedSketch : s)
              : [...existing, savedSketch];
            let updatedProj = { ...project, sketches: updated };
            // optionally attach to report as an image block
            if (reportId) {
              updatedProj = {
                ...updatedProj,
                reports: (updatedProj.reports||[]).map(r =>
                  r.id === reportId
                    ? { ...r, blocks: [...(r.blocks||[]), { id:uid(), type:"sketch", dataUrl:savedSketch.dataUrl, caption:savedSketch.title, sketchId:savedSketch.id }] }
                    : r
                )
              };
            }
            onUpdateProject(updatedProj);
            // ── Fire-and-forget: persist sketch to Supabase ──
            if (orgId && project.id && savedSketch.dataUrl) {
              try {
                // Convert dataUrl PNG to Blob
                const arr = savedSketch.dataUrl.split(",");
                const mime = (arr[0].match(/:(.*?);/) || [])[1] || "image/png";
                const bstr = atob(arr[1] || "");
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                const imageBlob = new Blob([u8arr], { type: mime });
                const canvasData = {
                  elements: savedSketch.elements || [],
                  scale: savedSketch.scale,
                  roomTag: savedSketch.roomTag,
                  editorMode: savedSketch.editorMode,
                  floorLabel: savedSketch.floorLabel,
                  snapToGrid: savedSketch.snapToGrid,
                  notes: savedSketch.notes,
                };
                const existingId = savedSketch.supabaseId || (isValidUuid(savedSketch.id) ? savedSketch.id : null);
                const existingPath = savedSketch.storagePath || null;
                dbSaveSketch(project.id, orgId, savedSketch.title || "Sketch", canvasData, imageBlob, existingId, existingPath).then(row => {
                  if (row?.id && !existingId) {
                    // Tag the new sketch with its DB id via onUpdateProject (has access to latest project state)
                    const supaUrl = import.meta.env.VITE_SUPABASE_URL;
                    const latestProj = project;
                    onUpdateProject({ ...latestProj, sketches: (latestProj.sketches || []).map(s =>
                      s.id === savedSketch.id
                        ? { ...s, supabaseId: row.id, storagePath: row.storage_path,
                            dataUrl: row.storage_path ? `${supaUrl}/storage/v1/object/public/project-photos/${row.storage_path}` : s.dataUrl }
                        : s
                    )});
                  }
                }).catch(err =>
                  console.warn("[KrakenCam] Sketch Supabase save failed:", err.message || err)
                );
              } catch (convErr) {
                console.warn("[KrakenCam] Could not convert sketch dataUrl for upload:", convErr);
              }
            }
            setEditingSketchPersist(null);
          }}
          onClose={() => setEditingSketchPersist(null)}
        />
      )}
    </div>
  );
}

// ── Sketches Tab ───────────────────────────────────────────────────────────────
function SketchesTab({ project, onUpdateProject, onNewSketch, onEditSketch }) {
  const sketches = project.sketches || [];
  const [selectMode,  setSelectMode]  = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDel,  setConfirmDel]  = useState(null); // null | sketchId | "batch"

  const toggleSelect = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteSketch = (id) => {
    const sk = sketches.find(s => s.id === id);
    onUpdateProject({ ...project, sketches: sketches.filter(s => s.id !== id) });
    setConfirmDel(null);
    if (sk?.supabaseId) dbDeleteSketch(sk.supabaseId, sk.storagePath).catch(() => {});
  };

  const deleteBatch = () => {
    const toDelete = sketches.filter(s => selectedIds.has(s.id));
    onUpdateProject({ ...project, sketches: sketches.filter(s => !selectedIds.has(s.id)) });
    toDelete.forEach(s => { if (s.supabaseId) dbDeleteSketch(s.supabaseId, s.storagePath).catch(() => {}); });
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDel(null);
  };

  if (sketches.length === 0) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px",gap:16,textAlign:"center" }}>
      <div style={{ width:64,height:64,borderRadius:16,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <Icon d={ic.sketch} size={28} stroke="var(--text3)" />
      </div>
      <div style={{ fontSize:16,fontWeight:700 }}>No sketches yet</div>
      <div style={{ fontSize:13.5,color:"var(--text2)",maxWidth:280 }}>Create room layouts, floor plans, and moisture maps. Add dimensions and notes.</div>
      <button className="btn btn-primary" onClick={onNewSketch}><Icon d={ic.plus} size={15} /> New Sketch</button>
    </div>
  );

  return (
    <div style={{ padding:"16px 0" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px 14px",flexWrap:"wrap",gap:8 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ fontWeight:700,fontSize:14 }}>Sketches ({sketches.length})</div>
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
            {sketches.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setSelectMode(true)}>☑ Select</button>}
            <button className="btn btn-primary btn-sm" onClick={onNewSketch}><Icon d={ic.plus} size={13} /> New Sketch</button>
          </>)}
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14,padding:"0 16px" }}>
        {sketches.map(sk => (
          <div key={sk.id} style={{ background:"var(--surface)",border:`1px solid ${selectedIds.has(sk.id)?"var(--accent)":"var(--border)"}`,borderRadius:12,overflow:"hidden",cursor:"pointer",position:"relative" }}
            onClick={() => selectMode ? toggleSelect(sk.id) : onEditSketch(sk)}>
            {selectMode && (
              <div style={{ position:"absolute",top:8,left:8,zIndex:10 }} onClick={e=>{e.stopPropagation();toggleSelect(sk.id);}}>
                <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${selectedIds.has(sk.id)?"var(--accent)":"rgba(255,255,255,0.7)"}`,
                  background:selectedIds.has(sk.id)?"var(--accent)":"rgba(0,0,0,0.4)",
                  display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {selectedIds.has(sk.id) && <Icon d="M20 6L9 17l-5-5" size={13} stroke="white" strokeWidth={2.5}/>}
                </div>
              </div>
            )}
            <div style={{ aspectRatio:"4/3",background:"var(--surface2)",overflow:"hidden",position:"relative" }}>
              {sk.dataUrl
                ? <img src={sk.dataUrl} alt={sk.title} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.sketch} size={32} stroke="var(--text3)" /></div>
              }
              {sk.roomTag && (
                <div style={{ position:"absolute",top:8,left:8,background:"rgba(0,0,0,.6)",color:"white",fontSize:10.5,padding:"2px 8px",borderRadius:20,backdropFilter:"blur(4px)" }}>
                  {sk.roomTag}
                </div>
              )}
            </div>
            <div style={{ padding:"10px 12px 12px" }}>
              <div style={{ fontWeight:600,fontSize:13.5,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{sk.title}</div>
              <div style={{ fontSize:11.5,color:"var(--text3)",display:"flex",gap:8 }}>
                <span>{sk.date}</span>
                {sk.scale && <span>· {sk.scale}</span>}
              </div>
              {sk.notes && <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{sk.notes}</div>}
              {!selectMode && (
                <div style={{ display:"flex",justifyContent:"flex-end",marginTop:8 }}>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Delete" style={{ color:"#e85a3a" }} onClick={e=>{e.stopPropagation();setConfirmDel(sk.id);}}>
                    <Icon d={ic.trash} size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm delete modal */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:"#e85a3a" }}><Icon d={ic.trash} size={15}/> Delete Sketch{confirmDel==="batch"?"es":""}</div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,color:"var(--text2)",margin:0 }}>
                {confirmDel === "batch"
                  ? `Delete ${selectedIds.size} sketch${selectedIds.size!==1?"es":""}? This cannot be undone.`
                  : "Delete this sketch? This cannot be undone."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:"#e85a3a",color:"white",border:"none" }}
                onClick={()=>confirmDel==="batch" ? deleteBatch() : deleteSketch(confirmDel)}>
                <Icon d={ic.trash} size={13}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplatesPage({ projects, onUseTemplate, templates: templatesProp, onTemplatesChange, orgId, supabaseUrl, getAuthHeaders }) {
  const [templates, setTemplatesLocal] = useState(templatesProp || TEMPLATES);
  const setTemplates = (updater) => {
    setTemplatesLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onTemplatesChange?.(next);
      return next;
    });
  };
  const [editTmpl,    setEditTmpl]    = useState(null);   // null | template obj | "new"
  const [deleteTmpl,  setDeleteTmpl]  = useState(null);
  const [useTmpl,     setUseTmpl]     = useState(null);   // template to use — triggers project picker

  const REPORT_TYPES = ["Insurance","Inspection","Contractor","Damage","Progress","Assessment","Quote","Other"];

  // Map report type → tag colour class
  const typeTag = type => {
    if (!type) return "orange";
    const t = type.toLowerCase();
    if (t.includes("insur") || t.includes("damage")) return "blue";
    if (t.includes("inspect") || t.includes("assess")) return "green";
    if (t.includes("contractor") || t.includes("quote")) return "purple";
    return "orange";
  };

  const imgRefs = useRef({});

  const TP = ({ color, img, tmplId, onImgChange }) => (
    <div className="template-preview" style={{ position:"relative", overflow:"hidden", cursor:"default" }}
      onClick={e => e.stopPropagation()}>
      {img
        ? <img src={img} alt="template cover" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        : <>
            <div className="tmpl-line" style={{ height:16, width:"60%", background:color+"40" }} />
            <div className="tmpl-line" style={{ height:9,  width:"90%" }} />
            <div className="tmpl-line" style={{ height:9,  width:"75%" }} />
            <div style={{ display:"flex", gap:5, marginTop:3 }}>
              <div className="tmpl-line" style={{ height:44, flex:1 }} />
              <div className="tmpl-line" style={{ height:44, flex:1 }} />
            </div>
            <div className="tmpl-line" style={{ height:9, width:"50%" }} />
          </>
      }
      {/* Image upload overlay button */}
      <div style={{ position:"absolute", bottom:6, right:6, display:"flex", gap:5 }}>
        <div title="Change cover image"
          onClick={() => { imgRefs.current[tmplId]?.click(); }}
          style={{ width:28, height:28, borderRadius:6, background:"rgba(0,0,0,.65)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px solid rgba(255,255,255,.2)" }}>
          <Icon d={ic.image} size={14} stroke="white" />
        </div>
        {img && (
          <div title="Remove image"
            onClick={() => onImgChange(null)}
            style={{ width:28, height:28, borderRadius:6, background:"rgba(180,30,30,.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px solid rgba(255,255,255,.2)" }}>
            <Icon d={ic.close} size={13} stroke="white" />
          </div>
        )}
        <input ref={el => imgRefs.current[tmplId] = el} type="file" accept="image/*" style={{ display:"none" }}
          onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            e.target.value = "";
            // Show base64 preview immediately
            const reader = new FileReader();
            reader.onload = async ev => {
              onImgChange(ev.target.result); // immediate local preview
              // Upload to Supabase Storage and replace with persistent URL
              if (orgId && supabaseUrl && getAuthHeaders) {
                try {
                  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
                  const headers = await getAuthHeaders({ 'Content-Type': file.type, 'x-upsert': 'true' });
                  const path = `templates/${orgId}/${tmplId}/cover.${ext}`;
                  const res = await fetch(`${supabaseUrl}/storage/v1/object/project-photos/${path}`, {
                    method: 'POST', headers, body: file,
                  });
                  if (res.ok) {
                    const url = `${supabaseUrl}/storage/v1/object/public/project-photos/${path}`;
                    onImgChange(url); // replace preview with storage URL
                  }
                } catch { /* keep base64 preview — user can retry */ }
              }
            };
            reader.readAsDataURL(file);
          }} />
      </div>
    </div>
  );

  // ── Template edit/create modal ──────────────────────────────────────────────
  function TemplateModal({ tmpl, onClose }) {
    const isNew = !tmpl || tmpl === "new";
    const base  = isNew ? { name:"", type:"Inspection", desc:"", color:"#4a90d9" } : tmpl;

    const AUTO_SECTIONS = ["Cover Page","Property Information","Photo Documentation"];
    const TEXT_SECTIONS = ["Scope of Work","Report","Damage Summary","Sign Off"];
    const ALL_SECTIONS  = ["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off"];

    const [name,      setName]      = useState(base.name || "");
    const [type,      setType]      = useState(base.type || "Inspection");
    const [desc,      setDesc]      = useState(base.desc || "");
    const [secEnabled, setSecEnabled] = useState(() => {
      const d = {}; ALL_SECTIONS.forEach((s,i) => { d[s] = base.sections?.[s]?.enabled ?? i < 5; }); return d;
    });
    const [secText,   setSecText]   = useState(() => {
      const d = {}; TEXT_SECTIONS.forEach(s => { d[s] = base.sections?.[s]?.text || ""; }); return d;
    });
    const [recipient, setRecipient] = useState(base.recipient || "Client");
    const [sigImg,    setSigImg]    = useState(base.signatureImg || null);
    const [expanded,  setExpanded]  = useState({});
    const sigRef = useRef();

    const toggle       = s => setSecEnabled(p => ({ ...p, [s]: !p[s] }));
    const toggleExpand = s => setExpanded(p => ({ ...p, [s]: !p[s] }));

    // Colour follows type
    const colorForType = t => {
      const lc = (t||"").toLowerCase();
      if (lc.includes("insur")||lc.includes("damage")) return "#4a90d9";
      if (lc.includes("inspect")||lc.includes("assess")) return "#3dba7e";
      if (lc.includes("contractor")||lc.includes("quote")) return "#8b7cf8";
      return "#2b7fe8";
    };

    const handleSave = () => {
      if (!name.trim()) return;
      const saved = {
        ...base,
        id: isNew ? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`) : base.id,
        name: name.trim(), type, desc, recipient,
        color: colorForType(type),
        sections: Object.fromEntries(ALL_SECTIONS.map(s => [s, { enabled: secEnabled[s], text: secText[s]||"" }])),
        signatureImg: sigImg,
      };
      setTemplates(prev => isNew ? [...prev, saved] : prev.map(t => t.id===saved.id ? saved : t));
      onClose();
    };

    return (
      <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="modal fade-in modal-lg" style={{ maxWidth:700 }}>
          <div className="modal-header">
            <div className="modal-title">{isNew ? "Create Template" : `Edit: ${base.name}`}</div>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Water Damage Assessment" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Report Type <span style={{ fontWeight:400, color:"var(--text3)" }}>— sets the tag</span></label>
                <select className="form-input form-select" value={type} onChange={e => setType(e.target.value)}>
                  {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {/* Tag preview */}
                <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:11.5, color:"var(--text3)" }}>Tag preview:</span>
                  <span className={`tag tag-${typeTag(type)}`}>{type}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Recipient</label>
                <select className="form-input form-select" value={recipient} onChange={e => setRecipient(e.target.value)}>
                  {["Client","Adjuster","Insurance Company","Contractor","N/A","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input form-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description of when to use this template…" />
            </div>

            {/* Sections */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom:12 }}>Sections</label>
              {ALL_SECTIONS.map(s => {
                const isAuto   = AUTO_SECTIONS.includes(s);
                const isText   = TEXT_SECTIONS.includes(s);
                const isSignOff = s === "Sign Off";
                const isOn     = secEnabled[s];
                const isOpen   = expanded[s];
                return (
                  <div key={s} style={{ borderBottom:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
                      <input type="checkbox" checked={!!isOn} onChange={() => toggle(s)} style={{ accentColor:"var(--accent)", flexShrink:0, width:16, height:16 }} />
                      <span style={{ fontSize:13.5, flex:1, fontWeight:500, color:"var(--text)" }}>{s}</span>
                      {isAuto && <span style={{ fontSize:11, color:"var(--text3)", background:"var(--surface2)", padding:"2px 8px", borderRadius:10, flexShrink:0, whiteSpace:"nowrap" }}>Auto-filled</span>}
                      {isText && isOn && (
                        <button onClick={() => toggleExpand(s)} style={{ background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"4px 12px", fontSize:12, color:"var(--text2)", cursor:"pointer", display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                          {isOpen ? "▲ Hide" : "▼ Edit"}
                        </button>
                      )}
                    </div>
                    {isText && isOn && isOpen && (
                      <div style={{ paddingBottom:14, display:"flex", flexDirection:"column", gap:10 }}>
                        <textarea className="form-input form-textarea" value={secText[s]} onChange={e => setSecText(p => ({ ...p, [s]: e.target.value }))} placeholder={`Default ${s} text…`} style={{ minHeight:100, fontSize:13, resize:"vertical" }} />
                        {isSignOff && (
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:8 }}>Company Signature</div>
                            <input ref={sigRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setSigImg(ev.target.result); r.readAsDataURL(f); }} />
                            {sigImg ? (
                              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                                <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"10px 16px", background:"#fff", flex:1, minHeight:64, display:"flex", alignItems:"center" }}>
                                  <img src={sigImg} alt="Signature" style={{ maxHeight:56, maxWidth:"100%", objectFit:"contain" }} />
                                </div>
                                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                  <button className="btn btn-sm btn-secondary" onClick={() => sigRef.current?.click()}>Replace</button>
                                  <button className="btn btn-sm btn-ghost" style={{ color:"var(--text3)", fontSize:12 }} onClick={() => setSigImg(null)}>Remove</button>
                                </div>
                              </div>
                            ) : (
                              <button className="btn btn-secondary btn-sm" onClick={() => sigRef.current?.click()} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <Icon d={ic.upload} size={13} /> Upload Signature Image
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={handleSave}><Icon d={ic.check} size={14} /> {isNew ? "Create Template" : "Save Changes"}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Project picker modal for "Use" ─────────────────────────────────────────
  function ProjectPickerModal({ tmpl, onClose }) {
    return (
      <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="modal fade-in" style={{ maxWidth:480 }}>
          <div className="modal-header">
            <div className="modal-title">Choose a Jobsite</div>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
          </div>
          <div className="modal-body">
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:14 }}>
              Using <strong style={{ color:"var(--text)" }}>{tmpl.name}</strong> — select which jobsite to create the report under:
            </div>
            {projects?.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {projects.map(p => (
                  <div key={p.id} onClick={() => { onUseTemplate(tmpl, p); onClose(); }}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", background:"var(--surface2)", transition:"border-color .15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:p.color, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{p.title}</div>
                      <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:1 }}>{[p.address, p.city, p.state].filter(Boolean).join(", ") || "No address"}</div>
                    </div>
                    <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding:"24px 0" }}>
                <div className="empty-icon"><Icon d={ic.folder} size={24} stroke="var(--text3)" /></div>
                <h3 style={{ fontSize:14 }}>No jobsites yet</h3>
                <p>Create a jobsite first, then come back to use this template.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
        <div><div className="section-title">Report Templates</div><div className="section-sub">Reusable templates for insurance, contractors, inspections & more</div></div>
        <button className="btn btn-primary" onClick={() => setEditTmpl("new")}><Icon d={ic.plus} size={15} /> New Template</button>
      </div>

      <div className="grid-3">
        {templates.map(t => (
          <div key={t.id} className="template-card">
            <TP color={t.color} img={t.coverImg || null} tmplId={t.id}
              onImgChange={img => {
                const updated = templates.map(x => x.id===t.id ? { ...x, coverImg: img } : x);
                setTemplates(updated);
                // Save to Supabase once we have a storage URL (not base64)
                if (img === null || (img && !img.startsWith('data:'))) onTemplatesChange(updated);
              }} />
            <div className="template-info">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:5 }}>
                <div className="template-name">{t.name}</div>
                <span className={`tag tag-${typeTag(t.type)}`} style={{ flexShrink:0 }}>{t.type}</span>
              </div>
              <div className="template-desc">{t.desc}</div>
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button className="btn btn-sm btn-secondary" style={{ flex:1 }} onClick={() => setEditTmpl(t)}><Icon d={ic.edit} size={12} /> Edit</button>
                <button className="btn btn-sm btn-primary"   style={{ flex:1 }} onClick={() => setUseTmpl(t)}><Icon d={ic.copy} size={12} /> Use</button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteTmpl(t)}><Icon d={ic.trash} size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        <div className="template-card" style={{ border:"2px dashed var(--border)", cursor:"pointer" }} onClick={() => setEditTmpl("new")}>
          <div style={{ height:130, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
            <div style={{ width:46, height:46, borderRadius:"50%", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon d={ic.plus} size={20} stroke="var(--accent)" /></div>
            <span style={{ fontSize:13, color:"var(--text2)", fontWeight:600 }}>Create Template</span>
          </div>
          <div className="template-info"><div className="template-name" style={{ color:"var(--text2)" }}>Blank Template</div><div className="template-desc">Start from scratch.</div></div>
        </div>
      </div>

      {editTmpl !== null && <TemplateModal tmpl={editTmpl} onClose={() => setEditTmpl(null)} />}
      {useTmpl   && <ProjectPickerModal tmpl={useTmpl} onClose={() => setUseTmpl(null)} />}

      {deleteTmpl && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDeleteTmpl(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Template?</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteTmpl(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5, lineHeight:1.6, color:"var(--text2)" }}>Are you sure you want to delete <strong style={{ color:"var(--text)" }}>{deleteTmpl.name}</strong>? This cannot be undone.</p>
              <div className="confirm-box"><Icon d={ic.alert} size={20} stroke="#ff6b6b" /><span style={{ fontSize:13, color:"#ff6b6b" }}>This action cannot be undone.</span></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTmpl(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setTemplates(prev => prev.filter(t => t.id !== deleteTmpl.id)); setDeleteTmpl(null); }}>
                <Icon d={ic.trash} size={13} /> Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}