import React, { useState, useEffect, useRef } from "react";
import {
  sendChatMessage    as dbSendChatMessage,
  upsertChatRoom     as dbUpsertChatRoom,
} from "../lib/chat.js";
import { Icon, ic } from "../utils/icons.jsx";
import { PLAN_CHAT_LIMITS, getPermissionPolicies, getEffectivePermissions, hasPermissionLevel } from "../utils/constants.js";
import { uid, formatTime, _sentChatDbIds, today, formatDurationLabel, ROLE_META } from "../utils/helpers.js";

export function ChatButton({ chats, currentUserId, onClick }) {
  const unread = chats.reduce((sum, c) => {
    const u = (c.messages||[]).filter(m => !(m.readBy||[]).includes(currentUserId)).length;
    return sum + u;
  }, 0);
  return (
    <button className="btn btn-ghost btn-sm btn-icon" onClick={onClick}
      style={{ position:"relative", width:36, height:36, color: unread > 0 ? "var(--accent)" : "var(--text2)" }}>
      <Icon d={ic.message} size={18} />
      {unread > 0 && (
        <span style={{ position:"absolute", top:4, right:4, width:16, height:16, borderRadius:"50%", background:"var(--accent)", color:"white", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--surface)", lineHeight:1 }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
export function ChatPanel({ chats, onChatsChange, teamUsers, settings, currentUserId, initialChatId = null, onInitialChatOpened, onClose, onNotify, orgId }) {
  const [view,         setView]         = useState("list");   // "list" | "chat"
  const [activeChatId, setActiveChatId] = useState(null);
  const [newMsg,       setNewMsg]       = useState("");
  const [showNewChat,  setShowNewChat]  = useState(false);
  const [editingChat,  setEditingChat]  = useState(null);     // chat being renamed/managed
  const [attachFile,   setAttachFile]   = useState(null);
  const [voiceRecState, setVoiceRecState] = useState("idle");
  const [voiceRecMs, setVoiceRecMs] = useState(0);
  const [voiceRecError, setVoiceRecError] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);  // null = closed, string = query
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileInputRef   = useRef(null);
  const textareaRef    = useRef(null);
  const messagesEndRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStartedAtRef = useRef(0);
  const voiceStopTimeoutRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const currentPlan   = settings?.plan || "base";
  const chatLimit     = PLAN_CHAT_LIMITS[currentPlan] || 4;
  const userRole      = settings?.userRole || "admin";
  const isAdminOrMgr  = userRole === "admin" || userRole === "manager";
  const chatPerms     = getEffectivePermissions(userRole, settings?.userPermissions, settings);
  const policies      = getPermissionPolicies(settings);
  const canSend       = hasPermissionLevel(chatPerms, "messages", "edit") && (userRole !== "user" || policies.chatAllowUserMsg);
  const directMsgOk   = hasPermissionLevel(chatPerms, "messages", "edit") && policies.chatAllowDirect;

  // All users including admin
  const allUsers = [
    { id:"__admin__", firstName:settings?.userFirstName||"Admin", lastName:settings?.userLastName||"", role:"admin", status:"active" },
    ...teamUsers.filter(u => u.status === "active"),
  ];

  // Chats visible to current user
  const visibleChats = chats.filter(c =>
    c.memberIds?.includes(currentUserId) ||
    currentUserId === "__admin__"
  );

  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    if (voiceRecState !== "recording") return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - voiceStartedAtRef.current;
      setVoiceRecMs(Math.min(90000, elapsed));
      if (elapsed >= 90000 && voiceRecorderRef.current?.state === "recording") {
        voiceRecorderRef.current.stop();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [voiceRecState]);

  useEffect(() => () => {
    if (voiceStopTimeoutRef.current) clearTimeout(voiceStopTimeoutRef.current);
    voiceStreamRef.current?.getTracks?.().forEach(track => track.stop());
  }, []);

  // @ mention autocomplete
  const chatMembers = activeChat
    ? allUsers.filter(u => u.id !== currentUserId && (activeChat.memberIds||[]).includes(u.id))
    : allUsers.filter(u => u.id !== currentUserId);

  const mentionFiltered = mentionQuery === null ? [] : chatMembers.filter(u => {
    const q = mentionQuery.toLowerCase();
    return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.firstName?.toLowerCase().startsWith(q);
  });

  const handleMsgChange = (e) => {
    const val = e.target.value;
    setNewMsg(val);
    // Detect @ followed by word chars at cursor position
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user) => {
    const cursor = textareaRef.current?.selectionStart || newMsg.length;
    const before = newMsg.slice(0, cursor);
    const after  = newMsg.slice(cursor);
    const atIdx  = before.lastIndexOf("@");
    const firstName = (user.firstName || "").trim();
    const lastName  = (user.lastName  || "").trim();
    const tag = lastName ? `@${firstName}${lastName}` : `@${firstName}`;
    const newVal = before.slice(0, atIdx) + tag + " " + after;
    setNewMsg(newVal);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const handleMsgKeyDown = (e) => {
    if (mentionQuery !== null && mentionFiltered.length > 0) {
      if (e.key === "ArrowDown")  { e.preventDefault(); setMentionIndex(i => Math.min(i+1, mentionFiltered.length-1)); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); setMentionIndex(i => Math.max(i-1, 0)); return; }
      if (e.key === "Tab" || (e.key === "Enter" && mentionQuery !== null)) {
        e.preventDefault(); insertMention(mentionFiltered[mentionIndex]); return;
      }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault(); sendMessage();
    }
  };

  const unreadCount = (chat) =>
    (chat.messages||[]).filter(m => !(m.readBy||[]).includes(currentUserId)).length;

  const openChat = (chat) => {
    // Mark all messages as read
    onChatsChange(prev => prev.map(c => c.id !== chat.id ? c : {
      ...c,
      messages: (c.messages||[]).map(m => ({
        ...m, readBy: [...new Set([...(m.readBy||[]), currentUserId])]
      }))
    }));
    setActiveChatId(chat.id);
    setView("chat");
    setConfirmAction(null);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
  };

  const sendMessage = () => {
    const text = newMsg.trim();
    if (!text && !attachFile) return;
    const msg = {
      id: uid(),
      authorId: currentUserId,
      authorName: `${settings?.userFirstName||"Admin"} ${settings?.userLastName||""}`.trim(),
      text,
      attachment: attachFile || null,
      timestamp: new Date().toISOString(),
      readBy: [currentUserId],
    };
    // Fire notifications for @mentions
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const handle = match[1].toLowerCase();
      const mentioned = allUsers.find(u =>
        `${u.firstName}${u.lastName}`.toLowerCase().replace(/\s/g,"").includes(handle) ||
        u.firstName?.toLowerCase() === handle
      );
      if (mentioned && onNotify) {
        onNotify({
          id: uid(),
          author: msg.authorName,
          authorInitials: `${settings?.userFirstName?.[0]||"A"}${settings?.userLastName?.[0]||""}`.toUpperCase(),
          authorColor: "var(--accent)",
          action: "mentioned you in",
          context: activeChat?.name || "a chat",
          preview: text,
          date: today(),
          read: false,
          type: "mention",
          recipientUserIds: [mentioned.id],
        });
      }
    }
    onChatsChange(prev => prev.map(c => c.id !== activeChatId ? c : {
      ...c,
      messages: [...(c.messages||[]), msg],
    }));
    // Fire-and-forget: persist message + attachment to Supabase
    if (orgId && activeChatId && isValidUuid(activeChatId)) {
      // Register a fingerprint BEFORE the async call so realtime dedup catches it
      // even if the websocket event arrives before .then() fires
      const fingerprint = `${msg.authorName}::${(text||'').slice(0,40)}::${activeChatId}`;
      _sentChatDbIds.add(fingerprint);
      setTimeout(() => _sentChatDbIds.delete(fingerprint), 30000);

      if (activeChat) dbUpsertChatRoom(orgId, activeChat).catch(() => {});
      dbSendChatMessage(orgId, activeChatId, {
        senderId:    currentUserId !== '__admin__' ? currentUserId : null,
        senderName:  msg.authorName,
        content:     text || '',
        messageType: attachFile?.type?.startsWith('audio') ? 'voice'
                   : attachFile?.type?.startsWith('image') ? 'image'
                   : attachFile ? 'file' : 'text',
        attachment:  attachFile || null,
      }).then(saved => {
        if (saved?.id) {
          _sentChatDbIds.add(saved.id);
          setTimeout(() => _sentChatDbIds.delete(saved.id), 30000);
        }
      }).catch(e => console.error('[KrakenCam] Chat save failed:', e));
    }
    setNewMsg("");
    setAttachFile(null);
    setVoiceRecError("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 60);
  };

  const createChat = (name, memberIds, isGroup) => {
    if (chats.length >= chatLimit) return;
    const chat = {
      id: crypto.randomUUID ? crypto.randomUUID() : uid(),
      name: name || "New Chat",
      isGroup,
      memberIds: [...new Set([currentUserId, ...memberIds])],
      messages: [],
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };
    onChatsChange(prev => [...prev, chat]);
    if (orgId) dbUpsertChatRoom(orgId, chat).catch(e => console.warn('[KrakenCam] Chat room save failed:', e));
    setShowNewChat(false);
    openChat(chat);
  };

  const [confirmAction, setConfirmAction] = useState(null); // null | "clear" | "delete"

  const deleteChat = (chatId) => {
    onChatsChange(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) { setView("list"); setActiveChatId(null); }
    setConfirmAction(null);
  };

  const clearChat = (chatId) => {
    onChatsChange(prev => prev.map(c => c.id !== chatId ? c : { ...c, messages:[] }));
    setConfirmAction(null);
  };

  const renameChat = (chatId, name) => {
    onChatsChange(prev => prev.map(c => c.id !== chatId ? c : { ...c, name }));
    setEditingChat(null);
  };

  const handleAttach = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setAttachFile({
      name: file.name,
      type: file.type,
      dataUrl: ev.target.result,
      size: file.size,
    });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current?.state === "recording") voiceRecorderRef.current.stop();
  };

  const startVoiceRecording = async () => {
    if (attachFile) {
      alert("Send or remove the current attachment before recording a voice message.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceRecError("Voice messages are not supported in this browser.");
      return;
    }
    try {
      setVoiceRecError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      voiceRecorderRef.current = recorder;
      voiceStartedAtRef.current = Date.now();
      setVoiceRecMs(0);
      recorder.ondataavailable = (e) => {
        if (e.data?.size) voiceChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;
        if (voiceStopTimeoutRef.current) clearTimeout(voiceStopTimeoutRef.current);
        if (blob.size) {
          const durationMs = Math.max(1000, Math.min(90000, Date.now() - voiceStartedAtRef.current));
          const reader = new FileReader();
          reader.onload = ev => {
            setAttachFile({
              name: `Voice Message ${new Date().toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}.webm`,
              type: blob.type || "audio/webm",
              dataUrl: ev.target.result,
              size: blob.size,
              durationMs,
            });
            setVoiceRecState("idle");
            setVoiceRecMs(0);
          };
          reader.readAsDataURL(blob);
        } else {
          setVoiceRecState("idle");
          setVoiceRecMs(0);
          setVoiceRecError("No audio was captured. Please try again.");
        }
      };
      recorder.start();
      voiceStopTimeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 90000);
      setVoiceRecState("recording");
    } catch (err) {
      setVoiceRecError(err?.message || "Microphone access was blocked.");
      setVoiceRecState("idle");
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)  return d.toLocaleDateString("en-US", { weekday:"short" });
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  };

  const getUserMeta = (id) => {
    const u = allUsers.find(x => x.id === id);
    const m = ROLE_META[u?.role] || ROLE_META.user;
    return { name: u ? `${u.firstName||""} ${u.lastName||""}`.trim() : "Unknown", color: m.color, initials: `${u?.firstName?.[0]||""}${u?.lastName?.[0]||""}`.toUpperCase() || "?" };
  };

  // Panel styles — slides in from right on desktop, bottom sheet on mobile
  const panelStyle = isMobile ? {
    position:"fixed", bottom:"58px", left:0, right:0, height:"75dvh",
    borderRadius:"16px 16px 0 0", zIndex:600,
  } : {
    position:"fixed", top:0, right:0, bottom:0, width:360,
    borderLeft:"1px solid var(--border)", zIndex:600,
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:599 }} onClick={onClose} />

      <div style={{ ...panelStyle, background:"var(--surface)", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"-8px 0 40px rgba(0,0,0,.25)" }}>

        {/* ── Header ── */}
        <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10, flexShrink:0, background:"var(--surface)" }}>
          {view === "chat" && (
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setView("list")}>
              <Icon d={ic.chevLeft} size={18} />
            </button>
          )}
          {isMobile && <div style={{ width:36,height:4,borderRadius:2,background:"var(--border)",position:"absolute",top:8,left:"50%",transform:"translateX(-50%)" }} />}
          <div style={{ flex:1, minWidth:0 }}>
            {view === "list"
              ? <div style={{ fontWeight:700, fontSize:14 }}>Team Chat</div>
              : editingChat === activeChatId
                ? <input autoFocus className="form-input" style={{ padding:"4px 8px", fontSize:14, fontWeight:700 }}
                    defaultValue={activeChat?.name}
                    onBlur={e => renameChat(activeChatId, e.target.value || activeChat?.name)}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditingChat(null); }}
                  />
                : <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {activeChat?.name}
                    {isAdminOrMgr && <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft:4, width:24, height:24, display:"inline-flex" }} onClick={() => setEditingChat(activeChatId)}>
                      <Icon d={ic.pen} size={12} />
                    </button>}
                  </div>
            }
          </div>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {view === "chat" && isAdminOrMgr && (
              confirmAction ? (
                // Inline confirm row — replaces buttons while confirming
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"4px 8px" }}>
                  <span style={{ fontSize:11.5, color:"var(--text2)", whiteSpace:"nowrap" }}>
                    {confirmAction === "delete" ? "Delete this chat?" : "Clear all messages?"}
                  </span>
                  <button className="btn btn-sm" style={{ fontSize:11, padding:"2px 10px", background:"#e85a3a", border:"none", color:"white", borderRadius:6, fontWeight:700 }}
                    onClick={() => confirmAction === "delete" ? deleteChat(activeChatId) : clearChat(activeChatId)}>
                    Yes
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"2px 8px" }}
                    onClick={() => setConfirmAction(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Clear messages" onClick={() => setConfirmAction("clear")} style={{ width:30,height:30 }}>
                    <Icon d={ic.eraser} size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Delete chat" onClick={() => setConfirmAction("delete")} style={{ width:30,height:30,color:"#e85a3a" }}>
                    <Icon d={ic.trash} size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Manage members" onClick={() => setEditingChat(editingChat==="members" ? null : "members")} style={{ width:30,height:30 }}>
                    <Icon d={ic.users} size={14} />
                  </button>
                </>
              )
            )}
            <button className="btn btn-ghost btn-sm btn-icon chat-close-btn" onClick={onClose} style={{ width:30,height:30 }}>
              <Icon d={ic.close} size={16} />
            </button>
          </div>
        </div>

        {/* ── Member manager panel ── */}
        {view === "chat" && editingChat === "members" && (
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", background:"var(--surface2)", flexShrink:0, maxHeight:200, overflowY:"auto" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Members</div>
            {allUsers.map(u => {
              const inChat = (activeChat?.memberIds||[]).includes(u.id);
              const m = ROLE_META[u.role]||ROLE_META.user;
              return (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                  <div style={{ width:26,height:26,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",flexShrink:0 }}>
                    {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                  </div>
                  <div style={{ flex:1, fontSize:12.5, fontWeight:500 }}>{u.firstName} {u.lastName}</div>
                  <button className={`btn btn-sm ${inChat?"btn-danger":"btn-secondary"}`} style={{ fontSize:11, padding:"2px 10px" }}
                    onClick={() => onChatsChange(prev => prev.map(c => c.id!==activeChatId ? c : {
                      ...c, memberIds: inChat ? c.memberIds.filter(id=>id!==u.id) : [...c.memberIds, u.id]
                    }))}>
                    {inChat ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Chat list ── */}
        {view === "list" && (
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
            {/* Plan limit bar */}
            <div style={{ padding:"8px 14px", background:"var(--surface2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11.5 }}>
              <span style={{ color:"var(--text3)" }}>{chats.length} / {chatLimit} groups</span>
              {isAdminOrMgr && chats.length < chatLimit && (
                <button className="btn btn-primary btn-sm" style={{ fontSize:11, padding:"3px 10px" }} onClick={() => setShowNewChat(true)}>
                  <Icon d={ic.plus} size={12} /> New Chat
                </button>
              )}
              {chats.length >= chatLimit && (
                <span style={{ fontSize:10.5, color:"#e8c53a", fontWeight:600 }}>⚠ Group limit reached</span>
              )}
            </div>

            {visibleChats.length === 0 ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, color:"var(--text3)", padding:24, textAlign:"center" }}>
                <Icon d={ic.message} size={36} stroke="var(--text3)" />
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text2)" }}>No chats yet</div>
                <div style={{ fontSize:12 }}>Create a group chat to start collaborating with your team.</div>
                {isAdminOrMgr && chats.length < chatLimit && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowNewChat(true)}>
                    <Icon d={ic.plus} size={13} /> Create First Chat
                  </button>
                )}
              </div>
            ) : (
              visibleChats.map(chat => {
                const unread  = unreadCount(chat);
                const lastMsg = chat.messages?.[chat.messages.length - 1];
                return (
                  <div key={chat.id} onClick={() => openChat(chat)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid var(--border)", transition:"background .12s" }}
                    onMouseEnter={e => e.currentTarget.style.background="var(--surface2)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    {/* Avatar */}
                    <div style={{ width:42,height:42,borderRadius:chat.isGroup?"12px":"50%",background:unread>0?"var(--accent)":"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16 }}>
                      {chat.isGroup ? <Icon d={ic.users} size={18} stroke={unread>0?"white":"var(--text3)"} /> : <Icon d={ic.user} size={18} stroke={unread>0?"white":"var(--text3)"} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <div style={{ fontWeight:unread>0?700:600, fontSize:13.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{chat.name}</div>
                        <div style={{ fontSize:10.5, color:"var(--text3)", flexShrink:0, marginLeft:6 }}>{lastMsg ? formatTime(lastMsg.timestamp) : ""}</div>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {lastMsg
                          ? `${lastMsg.authorName?.split(" ")[0]||""}: ${lastMsg.attachment ? (lastMsg.attachment.type?.startsWith("audio/") ? "Voice note" : lastMsg.attachment.name) : lastMsg.text}`
                          : <span style={{ color:"var(--text3)" }}>No messages yet</span>}
                      </div>
                    </div>
                    {unread > 0 && (
                      <div style={{ width:20,height:20,borderRadius:"50%",background:"var(--accent)",color:"white",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        {unread > 9 ? "9+" : unread}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Chat view ── */}
        {view === "chat" && activeChat && (
          <>
            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
              {(activeChat.messages||[]).length === 0 && (
                <div style={{ textAlign:"center", color:"var(--text3)", fontSize:12.5, padding:"32px 0" }}>No messages yet. Say hello! 👋</div>
              )}
              {(activeChat.messages||[]).map((msg, i) => {
                const isMe = msg.authorId === currentUserId;
                const meta = getUserMeta(msg.authorId);
                const prevMsg = (activeChat.messages||[])[i-1];
                const showAuthor = !prevMsg || prevMsg.authorId !== msg.authorId;
                // Highlight @mentions
                const renderText = (txt) => {
                  if (!txt) return null;
                  const parts = txt.split(/(@\w+)/g);
                  return parts.map((p, pi) => p.startsWith("@")
                    ? <span key={pi} style={{
                        fontWeight:700,
                        borderRadius:4,
                        padding:"0 3px",
                        // Own bubble = accent bg → use white text + white tint bg
                        // Other bubble = surface2 bg → use accent text + accent-glow bg
                        color:      isMe ? "white"              : "var(--accent)",
                        background: isMe ? "rgba(255,255,255,.25)" : "var(--accent-glow)",
                      }}>{p}</span>
                    : p
                  );
                };
                return (
                  <div key={msg.id} style={{ display:"flex", flexDirection:isMe?"row-reverse":"row", gap:8, alignItems:"flex-end" }}>
                    {!isMe && (
                      <div style={{ width:28,height:28,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0,marginBottom:2,visibility:showAuthor?"visible":"hidden" }}>
                        {meta.initials}
                      </div>
                    )}
                    <div style={{ maxWidth:"72%", display:"flex", flexDirection:"column", gap:2 }}>
                      {showAuthor && !isMe && (
                        <div style={{ fontSize:10.5, color:"var(--text3)", marginLeft:2, fontWeight:600 }}>{meta.name}</div>
                      )}
                      <div style={{ background:isMe?"var(--accent)":"var(--surface2)", color:isMe?"white":"var(--text)", borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"8px 12px", fontSize:13, lineHeight:1.5 }}>
                        {msg.text && <div>{renderText(msg.text)}</div>}
                        {msg.attachment && (
                          <div style={{ marginTop:msg.text?6:0 }}>
                            {msg.attachment.type?.startsWith("image/")
                              ? <img src={msg.attachment.dataUrl} alt={msg.attachment.name} style={{ maxWidth:"100%", maxHeight:200, borderRadius:8, display:"block", marginTop:4 }} />
                              : msg.attachment.type?.startsWith("audio/")
                                ? <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                                    <audio controls preload="metadata" src={msg.attachment.dataUrl} style={{ width:"100%", minWidth:220 }} />
                                    <div style={{ fontSize:11.5,opacity:0.85 }}>{msg.attachment.name}</div>
                                  </div>
                              : <div style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:isMe?"rgba(255,255,255,.15)":"var(--surface3)",borderRadius:8,fontSize:12 }}>
                                  <Icon d={ic.folder} size={14} stroke={isMe?"white":"var(--text2)"} />
                                  <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160 }}>{msg.attachment.name}</span>
                                  {msg.attachment.dataUrl && (
                                    <a
                                      href={msg.attachment.dataUrl}
                                      download={msg.attachment.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color:isMe?"white":"var(--accent)",fontWeight:700,textDecoration:"none",marginLeft:4 }}
                                    >
                                      Open
                                    </a>
                                  )}
                                </div>
                            }
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize:10, color:"var(--text3)", textAlign:isMe?"right":"left", marginLeft:isMe?0:2, marginRight:isMe?2:0 }}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment preview */}
            {attachFile && (
              <div style={{ padding:"6px 14px", borderTop:"1px solid var(--border)", background:"var(--surface2)", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                {attachFile.type?.startsWith("image/")
                  ? <img src={attachFile.dataUrl} alt={attachFile.name} style={{ height:48,width:48,objectFit:"cover",borderRadius:6 }} />
                  : attachFile.type?.startsWith("audio/")
                    ? <div style={{ width:48,height:48,borderRadius:6,background:"rgba(74,144,217,.12)",border:"1px solid rgba(74,144,217,.24)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.mic} size={20} stroke="var(--accent)" /></div>
                    : <div style={{ width:48,height:48,borderRadius:6,background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.folder} size={20} stroke="var(--text2)" /></div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{attachFile.name}</div>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>{attachFile.type?.startsWith("audio/") && attachFile.durationMs ? `${formatDurationLabel(attachFile.durationMs)} · ` : ""}{(attachFile.size/1024).toFixed(0)} KB</div>
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAttachFile(null)}><Icon d={ic.close} size={14} /></button>
              </div>
            )}
            {voiceRecError && !attachFile && (
              <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", background:"rgba(232,90,58,.08)", color:"#e85a3a", fontSize:11.5, flexShrink:0 }}>
                {voiceRecError}
              </div>
            )}
            {voiceRecState === "recording" && (
              <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", background:"rgba(74,144,217,.08)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexShrink:0 }}>
                <div style={{ fontSize:11.5, fontWeight:700, color:"var(--accent)" }}>
                  Recording voice message {formatDurationLabel(voiceRecMs)} / 1:30
                </div>
                <button className="btn btn-secondary btn-sm" onClick={stopVoiceRecording}>
                  <Icon d={ic.square} size={11} /> Stop
                </button>
              </div>
            )}

            {/* Input bar */}
            <div style={{ position:"relative", flexShrink:0 }}>
              {/* @ mention dropdown */}
              {mentionQuery !== null && mentionFiltered.length > 0 && (
                <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:12, right:12, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, boxShadow:"0 8px 28px rgba(0,0,0,.25)", zIndex:20, overflow:"hidden", maxHeight:200, overflowY:"auto" }}>
                  <div style={{ padding:"5px 10px 4px", fontSize:10.5, color:"var(--text3)", fontWeight:700, borderBottom:"1px solid var(--border)" }}>
                    <Icon d={ic.atSign} size={10} stroke="var(--text3)" /> Mention a team member
                  </div>
                  {mentionFiltered.map((u, i) => {
                    const m = ROLE_META[u.role]||ROLE_META.user;
                    return (
                      <div key={u.id} onMouseDown={e=>{ e.preventDefault(); insertMention(u); }}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", cursor:"pointer",
                          background:i===mentionIndex?"var(--accent-glow)":"transparent",
                          borderLeft:i===mentionIndex?"3px solid var(--accent)":"3px solid transparent" }}>
                        <div style={{ width:28,height:28,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                          {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                        </div>
                        <div>
                          <div style={{ fontWeight:600,fontSize:13 }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize:11,color:"var(--text3)" }}>{m.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ padding:"10px 12px", borderTop:"1px solid var(--border)", display:"grid", gap:8, background:"var(--surface)" }}>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display:"none" }} onChange={handleAttach} />
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <button className="btn btn-secondary btn-sm" style={{ opacity:canSend?1:0.4 }}
                    disabled={!canSend} onClick={() => canSend && fileInputRef.current?.click()}>
                    <Icon d={ic.plus} size={14} /> Attach
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ opacity:canSend?1:0.4, color:voiceRecState==="recording"?"#e85a3a":undefined }}
                    disabled={!canSend} onClick={() => canSend && (voiceRecState === "recording" ? stopVoiceRecording() : startVoiceRecording())}>
                    <Icon d={ic.mic} size={14} stroke={voiceRecState==="recording"?"#e85a3a":"currentColor"} /> {voiceRecState === "recording" ? "Stop" : "Record"}
                  </button>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <textarea ref={textareaRef} className="form-input" value={newMsg}
                  onChange={handleMsgChange}
                  onKeyDown={handleMsgKeyDown}
                  placeholder={voiceRecState === "recording" ? "Recording voice message..." : "Message… type @ to mention"}
                  style={{ flex:1, minHeight:38, maxHeight:100, resize:"none", padding:"8px 12px", fontSize:13, lineHeight:1.5, borderRadius:18 }}
                  rows={1}
                />
                <button className="btn btn-primary btn-sm btn-icon" style={{ flexShrink:0, width:36, height:36, borderRadius:"50%" }}
                  onClick={sendMessage} disabled={!newMsg.trim() && !attachFile}>
                  <Icon d={ic.arrowUpRight} size={16} stroke="white" />
                </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── New Chat modal ── */}
        {showNewChat && (
          <NewChatModal
            allUsers={allUsers}
            currentUserId={currentUserId}
            directMsgOk={directMsgOk}
            onCreate={createChat}
            onClose={() => setShowNewChat(false)}
          />
        )}
      </div>
    </>
  );
}

// ── New Chat Modal ────────────────────────────────────────────────────────────
export function NewChatModal({ allUsers, currentUserId, directMsgOk, onCreate, onClose }) {
  const [type,       setType]       = useState("group");  // "group" | "direct"
  const [name,       setName]       = useState("");
  const [selected,   setSelected]   = useState([]);

  const others = allUsers.filter(u => u.id !== currentUserId);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const handleCreate = () => {
    if (selected.length === 0) return;
    if (type === "direct") {
      const other = allUsers.find(u => u.id === selected[0]);
      const chatName = `${other?.firstName||""} ${other?.lastName||""}`.trim() || "Direct Message";
      onCreate(chatName, selected, false);
    } else {
      onCreate(name.trim() || "New Group", selected, true);
    }
  };

  return (
    <div style={{ position:"absolute",inset:0,background:"var(--surface)",zIndex:10,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <div style={{ padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.chevLeft} size={18}/></button>
        <div style={{ fontWeight:700,fontSize:14 }}>New Chat</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:14 }}>
        {/* Type toggle */}
        <div style={{ display:"flex",gap:8 }}>
          {[{v:"group",label:"Group Chat"},{v:"direct",label:"Direct Message",disabled:!directMsgOk}].map(t=>(
            <button key={t.v} disabled={t.disabled} onClick={()=>setType(t.v)}
              className="btn btn-sm"
              style={{ flex:1,justifyContent:"center",
                background:type===t.v?"var(--accent)":"var(--surface2)",
                color:type===t.v?"white":t.disabled?"var(--text3)":"var(--text2)",
                border:`1px solid ${type===t.v?"var(--accent)":"var(--border)"}`,
                opacity:t.disabled?0.5:1,cursor:t.disabled?"not-allowed":"pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Group name */}
        {type === "group" && (
          <div>
            <label className="form-label">Group Name</label>
            <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Site A Team" autoFocus />
          </div>
        )}
        {/* Member picker */}
        <div>
          <label className="form-label">{type==="direct"?"Choose person":"Add Members"}</label>
          <div style={{ display:"flex",flexDirection:"column",gap:5,maxHeight:280,overflowY:"auto" }}>
            {others.map(u => {
              const m = ROLE_META[u.role]||ROLE_META.user;
              const sel = selected.includes(u.id);
              return (
                <div key={u.id} onClick={()=>type==="direct"?setSelected([u.id]):toggle(u.id)}
                  style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:"var(--radius-sm)",border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                  <div style={{ width:30,height:30,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                    {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:13 }}>{u.firstName} {u.lastName}</div>
                    <div style={{ fontSize:11,color:"var(--text3)" }}>{m.label}</div>
                  </div>
                  {sel && <Icon d={ic.check} size={14} stroke="var(--accent)" strokeWidth={2.5} />}
                </div>
              );
            })}
            {others.length === 0 && <div style={{ fontSize:12.5,color:"var(--text3)",textAlign:"center",padding:16 }}>No team members yet. Add users in Account → Team Members.</div>}
          </div>
        </div>
        {/* Direct message permission notice */}
        {!directMsgOk && type==="direct" && (
          <div style={{ fontSize:11.5,color:"var(--text3)",padding:"8px 12px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)" }}>
            Direct messages are disabled by your admin. Contact your admin to enable them.
          </div>
        )}
      </div>
      <div style={{ padding:"10px 16px",borderTop:"1px solid var(--border)",flexShrink:0 }}>
        <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center" }}
          disabled={selected.length===0||(type==="group"&&!name.trim())}
          onClick={handleCreate}>
          <Icon d={ic.plus} size={14} /> {type==="direct"?"Start Conversation":"Create Group"}
        </button>
      </div>
    </div>
  );
}

// ── NOTIFICATION BELL ────────────────────────────────────────────────────────