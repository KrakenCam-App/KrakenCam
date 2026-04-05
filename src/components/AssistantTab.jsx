/**
 * src/components/AssistantTab.jsx
 *
 * Project Assistant — context-aware AI chat scoped to a single project.
 * Lazy-loaded; do not import directly in the main bundle.
 *
 * Props:
 *   project         — full project object
 *   orgId           — organization UUID
 *   userId          — current user UUID
 *   settings        — org/user settings (plan, aiGenerationsUsed, etc.)
 *   onSettingsChange — function to optimistically update settings (Kraken balance)
 *   teamUsers       — array of team members
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { PLAN_AI_LIMITS, getWeekWindowStart, getNextResetDate } from "../utils/constants.js";
import { checkAiPermission, logAiEvent, deductKrakens, KRAKEN_COSTS } from "../lib/krakenUsage.js";
import { AiBlockedModal } from "./KrakenUsageBar.jsx";

const KRAKENS_PER_PROMPT = 2;

// ── Icon helper ───────────────────────────────────────────────────────────────
function Ico({ d, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  sparkle:   "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  lock:      "M12 17v-2m0 0a2 2 0 100-4 2 2 0 000 4zM8 11V7a4 4 0 118 0v4M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z",
  send:      "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  user:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  bot:       "M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7H3a7 7 0 017-7h1V5.73A2 2 0 0110 4a2 2 0 012-2zM5 14v1a7 7 0 0014 0v-1M8 21h8",
  warning:   "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  refresh:   "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  chevron:   "M9 18l6-6-6-6",
  zap:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  check:     "M9 12l2 2 4-4",
  tasks:     "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  photo:     "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  report:    "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  progress:  "M22 12h-4l-3 9L9 3l-3 9H2",
};

// ── Utility ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)return Math.floor(diff / 3600) + "h ago";
  return new Date(iso).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function scrollToBottom(el) {
  if (el) el.scrollTop = el.scrollHeight;
}

// ── 1-click prompt chips ──────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: ICONS.progress,  label: "Project status",  prompt: "Give me a quick overview of where this project stands right now." },
  { icon: ICONS.tasks,     label: "Open tasks",      prompt: "What are the outstanding tasks and priorities for this project?" },
  { icon: ICONS.photo,     label: "Photo summary",   prompt: "Summarize the photo documentation we have for this project." },
  { icon: ICONS.report,    label: "Report help",     prompt: "What key points should I highlight in the next progress report?" },
  { icon: ICONS.zap,       label: "Next steps",      prompt: "What are the recommended next steps to move this project forward?" },
  { icon: ICONS.clipboard, label: "Checklist check", prompt: "How are the checklists progressing on this project?" },
];

// ── Locked (Tier 1) view ──────────────────────────────────────────────────────
function LockedView({ isAdmin }) {
  return (
    <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:32 }}>
      <div style={{ maxWidth:380,textAlign:"center" }}>
        <div style={{ width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#a855f722,#7c3aed22)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
          <Ico d={ICONS.lock} size={28} stroke="#a855f7" />
        </div>
        <div style={{ fontWeight:700,fontSize:18,color:"var(--text)",marginBottom:8 }}>
          Project Assistant
        </div>
        {isAdmin ? (
          <>
            <div style={{ fontSize:14,color:"var(--text2)",lineHeight:1.6,marginBottom:20 }}>
              Unlock AI-powered project assistance on Intelligence II or Command III. Ask questions about tasks,
              photos, reports, and more — all scoped to this project.
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:24,textAlign:"left" }}>
              {["Context-aware answers about this project","1-click prompts for common questions","Chat history saved per project","2 ⬡ Krakens per message"].map(f => (
                <div key={f} style={{ display:"flex",alignItems:"center",gap:10,fontSize:13,color:"var(--text2)" }}>
                  <div style={{ width:18,height:18,borderRadius:5,background:"#a855f711",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Ico d={ICONS.check} size={11} stroke="#a855f7" strokeWidth={2.5} />
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:6 }}>Available on Intelligence II and Command III</div>
          </>
        ) : (
          <div style={{ fontSize:14,color:"var(--text2)",lineHeight:1.6,marginBottom:20 }}>
            Project Assistant is available on Intelligence II and Command III plans. Contact your admin to upgrade your organization's plan.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display:"flex",flexDirection:isUser?"row-reverse":"row",gap:8,alignItems:"flex-end",marginBottom:12 }}>
      {/* Avatar */}
      <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
        background:isUser?"linear-gradient(135deg,#2b7fe8,#1a5fc8)":"linear-gradient(135deg,#7c3aed,#a855f7)" }}>
        <Ico d={isUser ? ICONS.user : ICONS.bot} size={14} stroke="white" />
      </div>
      {/* Bubble */}
      <div style={{ maxWidth:"76%",background:isUser?"var(--accent,#2b7fe8)":"var(--surface)",
        color:isUser?"white":"var(--text)",borderRadius:isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",
        padding:"10px 13px",fontSize:13.5,lineHeight:1.6,boxShadow:"0 1px 4px rgba(0,0,0,.07)",
        border:isUser?"none":"1px solid var(--border)" }}>
        {/* Render newlines */}
        {msg.content.split("\n").map((line, i) => (
          <React.Fragment key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</React.Fragment>
        ))}
        {msg.createdAt && (
          <div style={{ fontSize:10.5,opacity:.55,marginTop:5,textAlign:isUser?"right":"left" }}>
            {timeAgo(msg.createdAt)}{msg.krakensUsed > 0 ? ` · ${msg.krakensUsed} ⬡` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div style={{ display:"flex",flexDirection:"row",gap:8,alignItems:"flex-end",marginBottom:12 }}>
      <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
        background:"linear-gradient(135deg,#7c3aed,#a855f7)" }}>
        <Ico d={ICONS.bot} size={14} stroke="white" />
      </div>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"14px 14px 14px 4px",
        padding:"10px 14px",display:"flex",gap:4,alignItems:"center" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"var(--text3)",
            animation:`asstBounce 1.2s ${i*0.18}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  );
}

// ── Main AssistantTab ─────────────────────────────────────────────────────────
export function AssistantTab({ project, orgId, userId, settings, onSettingsChange, teamUsers = [] }) {
  const plan    = settings?.plan || "base";
  const isLocked = plan === "base";
  const isAdmin  = settings?.userRole === "admin";
  const isManager= settings?.userRole === "manager";
  const canManage = isAdmin || isManager;

  // Kraken balance
  const aiLimit  = PLAN_AI_LIMITS[plan] || 0;
  const wStart   = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
  const curWin   = getWeekWindowStart();
  const winValid = wStart && wStart >= curWin;
  const aiUsed   = winValid ? (settings?.aiGenerationsUsed || 0) : 0;
  const aiRemaining = Math.max(0, aiLimit - aiUsed);
  const canAfford   = aiRemaining >= KRAKENS_PER_PROMPT;

  // Messages (local + persisted)
  const [messages,    setMessages]    = useState([]);   // [{role, content, createdAt, krakensUsed}]
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [loadingHist, setLoadingHist] = useState(true);
  const [error,       setError]       = useState("");
  const [threadId,    setThreadId]    = useState(null);
  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const chatBodyRef = useRef(null);

  // ── Load/create thread + history ────────────────────────────────────────────
  useEffect(() => {
    if (isLocked || !project?.id) return;
    let cancelled = false;

    async function loadThread() {
      setLoadingHist(true);
      try {
        // Upsert thread (get or create)
        let { data: thread, error: tErr } = await supabase
          .from("project_assistant_threads")
          .select("id")
          .eq("project_id", project.id)
          .maybeSingle();

        if (!thread && !tErr) {
          const { data: newThread, error: cErr } = await supabase
            .from("project_assistant_threads")
            .insert([{ organization_id: orgId, project_id: project.id }])
            .select("id")
            .single();
          if (cErr) throw cErr;
          thread = newThread;
        }

        if (!cancelled && thread) {
          setThreadId(thread.id);

          // Load messages
          const { data: msgs, error: mErr } = await supabase
            .from("project_assistant_messages")
            .select("*")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: true })
            .limit(60);

          if (!cancelled && msgs) {
            setMessages(msgs.map(m => ({
              id:          m.id,
              role:        m.role,
              content:     m.content,
              krakensUsed: m.krakens_used || 0,
              createdAt:   m.created_at,
            })));
          }
        }
      } catch (e) {
        console.warn("[AssistantTab] loadThread:", e.message);
      } finally {
        if (!cancelled) setLoadingHist(false);
      }
    }

    loadThread();
    return () => { cancelled = true; };
  }, [project?.id, isLocked, orgId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom(chatBodyRef.current);
  }, [messages, loading]);

  // ── Build project context ────────────────────────────────────────────────────
  const buildContext = useCallback(() => {
    const tasks      = project.tasks || [];
    const openTasks  = tasks.filter(t => t.status !== "done" && t.status !== "complete" && !t.completed).length;
    const doneTasks  = tasks.filter(t => t.status === "done" || t.status === "complete" || t.completed).length;
    const checklists = project.checklists || [];
    const totalItems = checklists.reduce((a, cl) => a + (cl.items?.length || 0), 0);
    const doneItems  = checklists.reduce((a, cl) => a + (cl.items?.filter(i => i.checked).length || 0), 0);

    return {
      projectTitle:       project.title        || "Untitled Project",
      projectAddress:     project.address      || "",
      projectStatus:      project.status       || "active",
      projectDescription: project.description  || "",
      taskSummary:        tasks.length > 0
        ? `${openTasks} open, ${doneTasks} completed (${tasks.length} total)`
        : "No tasks",
      photoCount:  (project.photos     || []).length,
      reportCount: (project.reports    || []).length,
      checklistSummary: checklists.length > 0
        ? `${checklists.length} checklist(s), ${doneItems}/${totalItems} items checked`
        : "No checklists",
      teamSize: (teamUsers || []).filter(u => u.status === "active").length,
    };
  }, [project, teamUsers]);

  // ── Persist a message to Supabase ────────────────────────────────────────────
  async function persistMessage(tid, role, content, krakensUsed = 0) {
    if (!tid) return null;
    try {
      const { data } = await supabase
        .from("project_assistant_messages")
        .insert([{
          thread_id:         tid,
          organization_id:   orgId,
          project_id:        project.id,
          role,
          content,
          krakens_used:      krakensUsed,
          created_by_user_id: userId || null,
        }])
        .select("id")
        .single();
      return data?.id || null;
    } catch (e) {
      console.warn("[AssistantTab] persistMessage:", e.message);
      return null;
    }
  }

  // ── Send a message ────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    if (!canAfford) {
      const reset = getNextResetDate();
      setError(`Not enough Krakens. Resets ${reset.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at 11:59 PM.`);
      return;
    }

    // Role-level permission check
    const perm = checkAiPermission(settings);
    if (!perm.allowed) { setError("__blocked__"); return; }

    setError("");
    setInput("");

    // Optimistic user message
    const userMsg = { role:"user", content:trimmed, createdAt:new Date().toISOString(), krakensUsed:0 };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history (exclude the just-added msg to avoid duplicate)
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token || "";

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${jwt}` },
        body: JSON.stringify({
          feature:   "assistant",
          projectId: project.id,
          message:   trimmed,
          history,
          context:   buildContext(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI error");

      const assistantMsg = {
        role:        "assistant",
        content:     data.reply,
        createdAt:   new Date().toISOString(),
        krakensUsed: KRAKENS_PER_PROMPT,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Deduct Krakens and log event
      deductKrakens(KRAKENS_PER_PROMPT, onSettingsChange);
      logAiEvent({
        orgId:      orgId,
        userId:     userId,
        projectId:  project?.id,
        featureKey: "assistant_freeform",
        krakensCost: KRAKENS_PER_PROMPT,
        status:     "success",
      });

      // Persist both messages in background
      if (threadId) {
        persistMessage(threadId, "user",      trimmed,     0);
        persistMessage(threadId, "assistant", data.reply,  KRAKENS_PER_PROMPT);
        // Update thread updated_at
        supabase.from("project_assistant_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId)
          .then(() => {});
      }
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      // Remove optimistic user message on failure
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render: locked ───────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div style={{ display:"flex",flexDirection:"column",height:"100%",minHeight:480 }}>
        <LockedView isAdmin={isAdmin} />
      </div>
    );
  }

  // ── Render: active ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Inject animation keyframes */}
      <style>{`
        @keyframes asstBounce {
          0%,80%,100% { transform: translateY(0); opacity:.4; }
          40%          { transform: translateY(-6px); opacity:1; }
        }
        .asst-chip:hover { opacity:.85; transform:translateY(-1px); }
        .asst-send-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
        .asst-send-btn:active:not(:disabled) { transform:translateY(0); }
      `}</style>

      <div style={{ display:"flex",flexDirection:"column",height:"100%",minHeight:480 }}>

        {error === "__blocked__" && <AiBlockedModal onClose={() => setError("")} />}

      {/* ── Warning banner ──────────────────────────────────────────────── */}
        <div style={{ background:"linear-gradient(90deg,#7c3aed11,#a855f711)",border:"1px solid #a855f733",borderRadius:10,padding:"9px 14px",marginBottom:14,display:"flex",alignItems:"flex-start",gap:9 }}>
          <Ico d={ICONS.warning} size={15} stroke="#a855f7" style={{ flexShrink:0,marginTop:1 }} />
          <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>
            <span style={{ fontWeight:600,color:"#a855f7" }}>AI Assistant — </span>
            Responses are generated by AI and may not be fully accurate. Always verify important details. Each message costs{" "}
            <span style={{ fontWeight:700,color:"var(--text)" }}>{KRAKENS_PER_PROMPT} ⬡ Krakens</span>
            {" "}and this assistant only has access to this project's data.
          </div>
        </div>

        {/* ── 1-click chips ────────────────────────────────────────────────── */}
        {messages.length === 0 && !loadingHist && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11.5,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8 }}>
              Quick questions
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q.label}
                  className="asst-chip"
                  disabled={loading || !canAfford}
                  onClick={() => sendMessage(q.prompt)}
                  style={{ display:"flex",alignItems:"center",gap:6,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,padding:"6px 12px",fontSize:12.5,fontWeight:500,color:"var(--text)",cursor:"pointer",transition:"all .15s",outline:"none" }}>
                  <Ico d={q.icon} size={13} stroke="#a855f7" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat body ───────────────────────────────────────────────────── */}
        <div ref={chatBodyRef}
          style={{ flex:1,overflowY:"auto",padding:"2px 0 8px",minHeight:220,maxHeight:420,scrollbarWidth:"thin",scrollbarColor:"var(--border) transparent" }}>

          {loadingHist ? (
            <div style={{ textAlign:"center",padding:32,color:"var(--text3)",fontSize:13 }}>Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign:"center",padding:"40px 24px" }}>
              <div style={{ width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#7c3aed22,#a855f722)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px" }}>
                <Ico d={ICONS.sparkle} size={24} stroke="#a855f7" />
              </div>
              <div style={{ fontWeight:600,fontSize:14,color:"var(--text)",marginBottom:6 }}>Ask about this project</div>
              <div style={{ fontSize:13,color:"var(--text3)",lineHeight:1.5 }}>
                Get answers about tasks, photos, reports, and more — all scoped to {project.title || "this project"}.
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => <ChatBubble key={msg.id || i} msg={msg} />)}
              {loading && <TypingBubble />}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && error !== "__blocked__" && (
          <div style={{ background:"#e85a3a11",border:"1px solid #e85a3a33",borderRadius:8,padding:"8px 12px",fontSize:12.5,color:"#e85a3a",marginBottom:8,display:"flex",alignItems:"center",gap:7 }}>
            <Ico d={ICONS.warning} size={13} stroke="#e85a3a" />
            {error}
          </div>
        )}

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div style={{ display:"flex",gap:8,alignItems:"flex-end",marginTop:4 }}>
          <div style={{ flex:1,position:"relative" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={canAfford ? `Ask about ${project.title || "this project"}…` : "Kraken limit reached"}
              disabled={loading || !canAfford}
              rows={1}
              style={{ width:"100%",resize:"none",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",fontSize:13.5,color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box",minHeight:42,maxHeight:120,overflow:"auto",lineHeight:1.5,transition:"border-color .15s",
                ...(loading||!canAfford ? { opacity:.55,cursor:"not-allowed" } : {}) }}
              onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
            />
          </div>

          {/* Send button — purple gradient */}
          <button
            className="asst-send-btn"
            disabled={loading || !input.trim() || !canAfford}
            onClick={() => sendMessage()}
            title={canAfford ? `Send (${KRAKENS_PER_PROMPT} ⬡)` : "Not enough Krakens"}
            style={{ flexShrink:0,background:loading||!input.trim()||!canAfford
              ? "var(--border)"
              : "linear-gradient(135deg,#7c3aed,#a855f7)",
              border:"none",borderRadius:10,padding:"0 14px",height:42,display:"flex",alignItems:"center",gap:6,cursor:loading||!input.trim()||!canAfford?"not-allowed":"pointer",transition:"all .15s",outline:"none" }}>
            {loading
              ? <div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,.4)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />
              : <Ico d={ICONS.send} size={15} stroke="white" />
            }
            {!loading && (
              <span style={{ fontSize:12,fontWeight:700,color:"white",whiteSpace:"nowrap" }}>
                {KRAKENS_PER_PROMPT} ⬡
              </span>
            )}
          </button>
        </div>

        {/* ── Kraken balance footer ─────────────────────────────────────────── */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,fontSize:11.5,color:"var(--text3)" }}>
          <span>
            {canAfford
              ? <><span style={{ color:"#a855f7",fontWeight:600 }}>{aiRemaining} ⬡</span> Krakens remaining this week</>
              : <span style={{ color:"#e85a3a",fontWeight:600 }}>⚠ Kraken limit reached · resets {getNextResetDate().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
            }
          </span>
          {messages.length > 0 && (
            <span style={{ fontSize:11,color:"var(--text3)" }}>
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

      </div>
    </>
  );
}
