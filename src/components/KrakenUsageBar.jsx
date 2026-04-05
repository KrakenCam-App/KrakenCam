/**
 * src/components/KrakenUsageBar.jsx
 *
 * Compact org-wide weekly Kraken usage bar for the left navigation.
 * Reads from settings.aiGenerationsUsed (same source as AccountPage bar).
 * Only visible when the org is on an AI-enabled plan (pro or command have more
 * than 0 limit; base has 10).
 *
 * Props:
 *   settings     — org/user settings object
 *   collapsed    — whether the nav is collapsed (hides labels, shows mini bar)
 */

import React from "react";
import { getAiBalance } from "../lib/krakenUsage.js";
import { getNextResetDate } from "../utils/constants.js";

export function KrakenUsageBar({ settings, collapsed }) {
  const { limit, used, remaining, pct } = getAiBalance(settings);

  // Don't render if plan has no AI (shouldn't happen since base has 10, but guard)
  if (limit === 0) return null;

  const isNearEmpty = pct >= 90;
  const isEmpty     = remaining === 0;
  const barColor    = isEmpty
    ? "#e85a3a"
    : isNearEmpty
    ? "#f59e0b"
    : settings?.plan === "command"
    ? "#2b7fe8"
    : settings?.plan === "pro"
    ? "#a855f7"
    : "#3dba7e";

  const nextReset = getNextResetDate();
  const resetLabel = nextReset.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  if (collapsed) {
    // Mini mode: just a small vertical progress pip
    return (
      <div title={`${remaining} Krakens remaining · resets ${resetLabel}`}
        style={{ padding:"8px 0",display:"flex",justifyContent:"center" }}>
        <div style={{ width:6,height:32,borderRadius:4,background:"var(--border)",overflow:"hidden",position:"relative" }}>
          <div style={{ position:"absolute",bottom:0,left:0,right:0,
            height:`${100-pct}%`,background:barColor,borderRadius:4,transition:"height .4s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"10px 12px",borderRadius:10,background:"var(--surface2)",
      border:"1px solid var(--border)",marginBottom:8,userSelect:"none" }}
      title={`Resets ${resetLabel} at 11:59 PM`}>

      {/* Header row */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={barColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span style={{ fontSize:11,fontWeight:700,color:"var(--text2)",letterSpacing:.3 }}>
            KRAKENS
          </span>
        </div>
        <span style={{ fontSize:11,fontWeight:700,color:barColor }}>
          {isEmpty ? "⚠ Limit reached" : `${remaining} left`}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height:5,borderRadius:3,background:"var(--border)",overflow:"hidden",marginBottom:5 }}>
        <div style={{ height:"100%",width:`${pct}%`,background:barColor,
          borderRadius:3,transition:"width .4s",minWidth:pct>0?4:0 }} />
      </div>

      {/* Stats row */}
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:10.5,color:"var(--text3)" }}>
        <span>{used} / {limit} used</span>
        <span>resets {resetLabel}</span>
      </div>
    </div>
  );
}

// ── Shared AI Blocked Modal ──────────────────────────────────────────────────
// Import and render this wherever an AI action is blocked by role permission.
export function AiBlockedModal({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,display:"flex",
      alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.5)" }}
      onClick={onClose}>
      <div style={{ background:"var(--bg)",borderRadius:14,padding:"28px 32px",
        maxWidth:340,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,.4)",
        border:"1px solid var(--border)",textAlign:"center" }}
        onClick={e => e.stopPropagation()}>
        {/* Icon */}
        <div style={{ width:48,height:48,borderRadius:14,background:"#e85a3a11",
          display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#e85a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div style={{ fontWeight:700,fontSize:16,color:"var(--text)",marginBottom:8 }}>
          AI Features Restricted
        </div>
        <div style={{ fontSize:13.5,color:"var(--text2)",lineHeight:1.6,marginBottom:22 }}>
          Please speak with your admin to allow AI features.
        </div>
        <button onClick={onClose}
          style={{ background:"var(--accent)",border:"none",borderRadius:8,
            padding:"9px 28px",fontSize:13,fontWeight:600,color:"white",cursor:"pointer" }}>
          OK
        </button>
      </div>
    </div>
  );
}
