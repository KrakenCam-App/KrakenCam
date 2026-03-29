import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon, ic } from "../utils/icons.jsx";
import {
  uid, formatDate, today,
  SKETCH_SCALE_OPTIONS, normalizeSketchScale,
  getTitleBlockHeight, buildSketchTitleBlockData,
} from "../utils/helpers.js";
import { PLAN_AI_LIMITS, getWeekWindowStart, getNextResetDate } from "../utils/constants.js";
import { getAuthHeaders } from "../lib/supabase.js";

export function SketchEditor({ sketch, rooms, reports, project, settings, onSave, onClose }) {
  const { useState: us, useRef: ur, useEffect: ue, useCallback: uc } = React;
  const canvasRef    = ur(null);
  const overlayRef   = ur(null);  // for live preview of in-progress shapes
  const containerRef = ur(null);

  const [tool,       setTool]       = us("pen");
  const [color,      setColor]      = us("#000000");
  const [strokeW,    setStrokeW]    = us(2);
  const [fontSize,   setFontSize]   = us(16);
  const [zoom,       setZoom]       = us(1);
  const [panOffset,  setPanOffset]  = us({x:0,y:0});
  const [elements,   setElements]   = us(sketch?.elements   || []);
  const [history,    setHistory]    = us([sketch?.elements  || []]);
  const [histIdx,    setHistIdx]    = us(0);
  const [title,      setTitle]      = us(sketch?.title      || "New Sketch");
  const [notes,      setNotes]      = us(sketch?.notes      || "");
  const [scale,      setScale]      = us(normalizeSketchScale(sketch?.scale));
  const [roomTag,    setRoomTag]    = us(sketch?.roomTag    || (rooms?.[0]?.name || ""));
  const [editorMode, setEditorMode] = us(sketch?.editorMode || "sketch");
  const [floorLabel, setFloorLabel] = us(sketch?.floorLabel || "");
  const [snapToGrid, setSnapToGrid] = us(sketch?.snapToGrid ?? true);
  const [showGrid,   setShowGrid]   = us(true);
  const [showNotes,  setShowNotes]  = us(false);
  const [fpPanelCollapsed, setFpPanelCollapsed] = us(false);
  const [showExport, setShowExport] = us(false);
  const [selReport,  setSelReport]  = us("");
  const [editingText,setEditingText]= us(null);
  const [tempText,   setTempText]   = us("");
  const [selectedEl, setSelectedEl] = us(null);
  const [saved,      setSaved]      = us(false);
  const [lineMeasureDraft, setLineMeasureDraft] = us("");
  const [roomLabelDraft, setRoomLabelDraft] = us("");
  const [placingRoomLabel, setPlacingRoomLabel] = us(false);
  const textInputRef = ur(null);

  // refs for current zoom/pan (used inside event handlers without stale closure)
  const zoomRef      = ur(1);
  const panRef       = ur({x:0,y:0});
  ue(() => { zoomRef.current = zoom; }, [zoom]);
  ue(() => { panRef.current = panOffset; }, [panOffset]);

  const elementsRef = ur(elements);
  ue(() => { elementsRef.current = elements; }, [elements]);

  // Auto-save sketch progress to localStorage so switching browser tabs doesn't lose work
  const _draftKey = `kc_sketch_draft_${sketch?.id || project?.id + "_new"}`;
  ue(() => {
    try {
      localStorage.setItem(_draftKey, JSON.stringify({
        elements, title, notes, scale, roomTag, editorMode, floorLabel, snapToGrid,
      }));
    } catch {}
  }, [elements, title, notes, scale, roomTag, editorMode, floorLabel, snapToGrid]);

  // On mount: restore draft if available (only when no existing sketch data)
  ue(() => {
    try {
      const draft = localStorage.getItem(_draftKey);
      if (draft) {
        const d = JSON.parse(draft);
        if (d.elements?.length && (!sketch?.elements?.length)) {
          setElements(d.elements);
          if (d.title)      setTitle(d.title);
          if (d.notes)      setNotes(d.notes);
          if (d.scale)      setScale(d.scale);
          if (d.roomTag)    setRoomTag(d.roomTag);
          if (d.editorMode) setEditorMode(d.editorMode);
          if (d.floorLabel) setFloorLabel(d.floorLabel);
          if (d.snapToGrid !== undefined) setSnapToGrid(d.snapToGrid);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const historyRef = ur(history);
  ue(() => { historyRef.current = history; }, [history]);
  const histIdxRef = ur(histIdx);
  ue(() => { histIdxRef.current = histIdx; }, [histIdx]);

  // drawing state refs (not state — no re-render needed mid-stroke)
  const drawing   = ur(false);
  const startPt   = ur({x:0,y:0});
  const lastPt    = ur({x:0,y:0});
  const penPoints = ur([]);
  const panStart  = ur({x:0,y:0}); // raw screen coords for pan

  const CANVAS_W = 900;
  const CANVAS_H = 650;
  const GRID_SIZE = 30;
  const floorPlanMode = editorMode === "floorplan";
  const selectedLine = elements.find(el => el.id === selectedEl && el.type === "line") || null;
  const selectedTitleBlock = elements.find(el => el.id === selectedEl && el.type === "titleblock") || null;

  ue(() => {
    setLineMeasureDraft(selectedLine?.measurement || "");
  }, [selectedLine?.id, selectedLine?.measurement]);

  function addTitleBlock() {
    const width = 280;
    const height = getTitleBlockHeight(width);
    const nextEl = {
      id: uid(),
      type: "titleblock",
      x: CANVAS_W - width - 28,
      y: CANVAS_H - height - 24,
      w: width,
      h: height,
      data: buildSketchTitleBlockData(project, settings, scale, floorLabel),
    };
    pushHistory([...elementsRef.current, nextEl]);
    setTool("select");
    setSelectedEl(nextEl.id);
  }

  function updateSelectedTitleBlockWidth(nextWidth) {
    if (!selectedTitleBlock) return;
    const width = Math.max(160, Math.min(420, Number(nextWidth) || selectedTitleBlock.w || 280));
    const height = getTitleBlockHeight(width);
    pushHistory(elementsRef.current.map(el => el.id === selectedTitleBlock.id ? { ...el, w: width, h: height } : el));
  }

  // ── Render all elements to main canvas ──
  const redraw = uc(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(180,190,210,0.25)";
      ctx.lineWidth = 0.5;
      const SZ = GRID_SIZE;
      for (let x = 0; x <= CANVAS_W; x += SZ) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CANVAS_H); ctx.stroke(); }
      for (let y = 0; y <= CANVAS_H; y += SZ) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CANVAS_W,y); ctx.stroke(); }
    }

    if (floorPlanMode) {
      ctx.save();
      ctx.fillStyle = "rgba(11,15,24,0.92)";
      ctx.strokeStyle = "rgba(74,144,217,0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(16, 16, 220, floorLabel ? 58 : 36, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4a90d9";
      ctx.font = "700 11px Inter, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("FLOOR PLAN MODE", 28, 28);
      if (floorLabel) {
        ctx.fillStyle = "#f0f2f7";
        ctx.font = "600 16px Inter, sans-serif";
        ctx.fillText(floorLabel, 28, 44);
      }
      ctx.restore();
    }

    elements.forEach(el => {
      drawElement(ctx, el);
      // draw selection highlight
      if (tool === "select" && selectedEl === el.id) {
        ctx.save();
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.globalAlpha = 0.8;
        const pad = 6;
        if (el.type === "rect" || el.type === "titleblock") {
          ctx.strokeRect(el.x-pad, el.y-pad, el.w+pad*2, el.h+pad*2);
        } else if (el.type === "circle") {
          const rx = Math.abs(el.w/2)+pad, ry = Math.abs(el.h/2)+pad;
          ctx.beginPath(); ctx.ellipse(el.x+el.w/2, el.y+el.h/2, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
        } else if (el.type === "line" || el.type === "dimension") {
          const mx=(el.x1+el.x2)/2, my=(el.y1+el.y2)/2;
          ctx.beginPath(); ctx.arc(mx,my,6,0,Math.PI*2); ctx.stroke();
        } else if (el.type === "pen") {
          const xs = el.points.map(p=>p.x), ys = el.points.map(p=>p.y);
          const minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad,maxX=Math.max(...xs)+pad,maxY=Math.max(...ys)+pad;
          ctx.strokeRect(minX,minY,maxX-minX,maxY-minY);
        } else if (el.type === "text") {
          ctx.strokeRect(el.x-pad, el.y-pad, 200, (el.fontSize||14)*1.5+pad*2);
        }
        ctx.restore();
      }
    });
  }, [elements, floorLabel, floorPlanMode, showGrid, selectedEl, tool]);

  // ── Keyboard: delete selected element ──
  ue(() => {
    function onKey(e) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEl && tool === "select") {
        // Don't fire if user is typing in an input
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;
        pushHistory(elements.filter(el => el.id !== selectedEl));
        setSelectedEl(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEl, elements, tool]);

  ue(() => { redraw(); }, [redraw]);

  function drawElement(ctx, el, preview = false) {
    ctx.save();
    ctx.strokeStyle = el.color || "#f0f2f7";
    ctx.fillStyle   = el.fillColor || "transparent";
    ctx.lineWidth   = el.strokeW || 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    if (preview) { ctx.globalAlpha = 0.7; }

    if (el.type === "pen") {
      if (!el.points || el.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      el.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (el.type === "line") {
      ctx.beginPath(); ctx.moveTo(el.x1,el.y1); ctx.lineTo(el.x2,el.y2); ctx.stroke();
      if (el.measurement) {
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const mx = (el.x1 + el.x2) / 2 - Math.sin(angle) * 16;
        const my = (el.y1 + el.y2) / 2 + Math.cos(angle) * 16;
        const text = String(el.measurement);
        ctx.font = `700 ${el.fontSize||12}px Inter, sans-serif`;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = "rgba(20,24,34,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mx - tw/2 - 8, my - 10, tw + 16, 20, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = el.color || "#1a1e28";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, mx, my + 1);
      }
    } else if (el.type === "rect") {
      ctx.beginPath(); ctx.rect(el.x,el.y,el.w,el.h);
      if (el.fillColor && el.fillColor !== "transparent") { ctx.fillStyle=el.fillColor; ctx.fill(); }
      ctx.stroke();
    } else if (el.type === "circle") {
      const rx = Math.abs(el.w/2), ry = Math.abs(el.h/2);
      ctx.beginPath(); ctx.ellipse(el.x+el.w/2, el.y+el.h/2, rx, ry, 0, 0, Math.PI*2);
      if (el.fillColor && el.fillColor !== "transparent") { ctx.fillStyle=el.fillColor; ctx.fill(); }
      ctx.stroke();
    } else if (el.type === "dimension") {
      const dx = el.x2-el.x1, dy = el.y2-el.y1;
      const len = Math.sqrt(dx*dx+dy*dy);
      const label = el.label || `${(len/30).toFixed(1)} ft`;
      // main line
      ctx.strokeStyle = el.color || "#2b7fe8";
      ctx.lineWidth = el.strokeW || 1.5;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(el.x1,el.y1); ctx.lineTo(el.x2,el.y2); ctx.stroke();
      ctx.setLineDash([]);
      // arrow heads
      const angle = Math.atan2(dy,dx);
      const aw = 10;
      [[el.x1,el.y1,angle+Math.PI],[el.x2,el.y2,angle]].forEach(([ax,ay,a]) => {
        ctx.beginPath();
        ctx.moveTo(ax,ay);
        ctx.lineTo(ax+aw*Math.cos(a-0.4),ay+aw*Math.sin(a-0.4));
        ctx.moveTo(ax,ay);
        ctx.lineTo(ax+aw*Math.cos(a+0.4),ay+aw*Math.sin(a+0.4));
        ctx.stroke();
      });
      // tick marks perpendicular at endpoints
      const px = -Math.sin(angle)*10, py = Math.cos(angle)*10;
      [[el.x1,el.y1],[el.x2,el.y2]].forEach(([ex,ey]) => {
        ctx.beginPath(); ctx.moveTo(ex+px,ey+py); ctx.lineTo(ex-px,ey-py); ctx.stroke();
      });
      // label
      const mx = (el.x1+el.x2)/2 - Math.sin(angle)*14;
      const my = (el.y1+el.y2)/2 + Math.cos(angle)*14;
      ctx.font = `bold ${el.fontSize||12}px 'Inter',sans-serif`;
      ctx.fillStyle = el.color || "#2b7fe8";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    } else if (el.type === "text") {
      ctx.font = `${el.fontStyle||""}${el.fontSize||14}px 'Inter',sans-serif`;
      ctx.fillStyle = el.color || "#1a1e28";
      ctx.textAlign = el.align || "left"; ctx.textBaseline = "top";
      (el.text||"").split("\n").forEach((line,i) => ctx.fillText(line, el.x, el.y + i*(el.fontSize||14)*1.4));
    } else if (el.type === "titleblock") {
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.w || 280;
      const h = el.h || getTitleBlockHeight(w);
      const blockData = { ...(el.data || {}), ...buildSketchTitleBlockData(project, settings, scale, floorLabel) };
      const headerH = Math.max(36, Math.round(h * 0.24));
      const labelW = Math.max(76, Math.round(w * 0.28));
      const rows = [
        ["PROJECT", blockData.projectName || "Untitled Project"],
        ["PROJECT #", blockData.projectNumber || "—"],
        ["TYPE", blockData.projectType || "—"],
        ["ADDRESS", blockData.projectAddress || "—"],
        ["COMPANY", blockData.siteCompany || "—"],
        ["CLIENT", blockData.clientName || "—"],
      ];
      const footerTop = y + headerH + ((h - headerH) * 0.68);
      const bodyH = footerTop - (y + headerH);
      const rowH = bodyH / rows.length;

      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.strokeStyle = "#17324e";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#eff6fd";
      ctx.fillRect(x, y, w, headerH);
      ctx.strokeRect(x, y, w, headerH);

      ctx.font = `700 ${Math.max(11, Math.round(w * 0.045))}px 'Courier New', monospace`;
      ctx.fillStyle = "#17324e";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(blockData.title || "PROJECT INFO", x + 10, y + 7);

      ctx.font = `600 ${Math.max(9, Math.round(w * 0.031))}px 'Courier New', monospace`;
      const headerY = y + headerH - 15;
      const headerGap = 10;
      const userName = blockData.userName || "";
      let userDisplay = userName;
      const userMaxW = Math.max(72, w * 0.34);
      if (userDisplay) {
        while (userDisplay.length > 8 && ctx.measureText(userDisplay).width > userMaxW) {
          userDisplay = `${userDisplay.slice(0, -2)}…`;
        }
      }
      const userW = userDisplay ? ctx.measureText(userDisplay).width : 0;
      const companyMaxW = Math.max(60, w - 20 - (userDisplay ? userW + headerGap : 0));
      let companyDisplay = blockData.companyName || "";
      if (companyDisplay) {
        while (companyDisplay.length > 8 && ctx.measureText(companyDisplay).width > companyMaxW) {
          companyDisplay = `${companyDisplay.slice(0, -2)}…`;
        }
      }
      if (companyDisplay) {
        ctx.textAlign = "left";
        ctx.fillText(companyDisplay, x + 10, headerY);
      }
      if (userDisplay) {
        ctx.textAlign = "right";
        ctx.fillText(userDisplay, x + w - 10, headerY);
      }

      rows.forEach(([label, value], idx) => {
        const rowY = y + headerH + idx * rowH;
        ctx.strokeStyle = "#17324e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x + w, rowY);
        ctx.moveTo(x + labelW, rowY);
        ctx.lineTo(x + labelW, rowY + rowH);
        ctx.stroke();
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = `700 ${Math.max(8, Math.round(w * 0.029))}px 'Courier New', monospace`;
        ctx.fillStyle = "#244a71";
        ctx.fillText(label, x + 8, rowY + rowH / 2);
        ctx.font = `600 ${Math.max(8, Math.round(w * 0.03))}px 'Courier New', monospace`;
        ctx.fillStyle = "#10253a";
        const text = String(value || "—");
        const availableW = Math.max(40, w - labelW - 16);
        const measured = ctx.measureText(text).width;
        const displayText = measured > availableW
          ? `${text.slice(0, Math.max(8, Math.floor(text.length * (availableW / measured)) - 1))}…`
          : text;
        ctx.fillText(displayText, x + labelW + 8, rowY + rowH / 2);
      });

      const footerH = h - (footerTop - y);
      const footerMid = x + w * 0.53;
      ctx.beginPath();
      ctx.moveTo(x, footerTop);
      ctx.lineTo(x + w, footerTop);
      ctx.moveTo(footerMid, footerTop);
      ctx.lineTo(footerMid, y + h);
      ctx.stroke();

      const footerFont = Math.max(8, Math.round(w * 0.028));
      ctx.font = `700 ${footerFont}px 'Courier New', monospace`;
      ctx.fillStyle = "#244a71";
      ctx.fillText("FLOOR", x + 8, footerTop + footerH * 0.32);
      ctx.fillText("SCALE", x + 8, footerTop + footerH * 0.72);
      ctx.fillText("DATE", footerMid + 8, footerTop + footerH * 0.32);

      ctx.font = `600 ${footerFont}px 'Courier New', monospace`;
      ctx.fillStyle = "#10253a";
      ctx.fillText(blockData.floorLabel || "—", x + 62, footerTop + footerH * 0.32);
      ctx.fillText(blockData.scale || "No Scale", x + 62, footerTop + footerH * 0.72);
      ctx.fillText(blockData.draftDate || today(), footerMid + 54, footerTop + footerH * 0.32);

      ctx.fillStyle = "#4a90d9";
      ctx.beginPath();
      ctx.rect(x + w - 11, y + h - 11, 7, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Preview overlay ──
  function drawPreview(el) {
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext("2d");
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    drawElement(ctx, el, true);
  }
  function clearPreview() {
    const oc = overlayRef.current;
    if (!oc) return;
    overlayRef.current.getContext("2d").clearRect(0,0,CANVAS_W,CANVAS_H);
  }

  // ── Coordinate helpers ──
  // Returns canvas-space coords accounting for current zoom+pan
  function getPos(e) {
    const canvas = canvasRef.current;
    if (!canvas) return {x:0,y:0};
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    // rect already includes CSS zoom transform, so direct mapping is correct
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return { x:(src.clientX-rect.left)*scaleX, y:(src.clientY-rect.top)*scaleY };
  }

  function maybeSnapPoint(pt) {
    if (!(floorPlanMode && snapToGrid)) return pt;
    return {
      x: Math.round(pt.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(pt.y / GRID_SIZE) * GRID_SIZE,
    };
  }

  // Raw screen position (for pan dragging)
  function getRawPos(e) {
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  // ── Push to history ──
  function pushHistory(newEls) {
    setHistory(h => {
      const trimmed = h.slice(0, histIdxRef.current+1);
      return [...trimmed, newEls];
    });
    setHistIdx(histIdxRef.current + 1);
    setElements(newEls);
  }

  // ── Scale helper: pixels per unit ──
  function pxPerUnit(scaleStr) {
    // "1 sq = X ft" or "1 sq = X in" — 1 grid square = 30px
    if (!scaleStr || String(scaleStr).toLowerCase() === "no scale") return null;
    const m = scaleStr.match(/([\d.]+)\s*(ft|in)/i);
    if (!m) return null;
    const val  = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    // 30px = val ft  →  pxPerFt = 30/val
    return unit === "in" ? { px: 30, val, unit:"in" } : { px: 30, val, unit:"ft" };
  }

  function formatDimension(len, scaleStr) {
    const s = pxPerUnit(scaleStr);
    if (!s) return `${Math.round(len)}px`;
    const realUnits = (len / s.px) * s.val;
    if (s.unit === "in") {
      const totalIn = Math.round(realUnits);
      return totalIn >= 12 ? `${Math.floor(totalIn/12)}'-${totalIn%12}"` : `${totalIn}"`;
    }
    return realUnits < 1 ? `${Math.round(realUnits*12)}"` : `${realUnits.toFixed(1)} ft`;
  }

  function placeRoomLabel(pt) {
    const text = roomLabelDraft.trim();
    if (!text) return;
    const target = maybeSnapPoint(pt);
    pushHistory([...elementsRef.current, {
      id: uid(),
      type: "text",
      x: target.x,
      y: target.y,
      text,
      color: "#1a1e28",
      fontSize: 18,
      fontStyle: "700 ",
      align: "center",
      role: "roomLabel",
    }]);
    setSelectedEl(null);
    setPlacingRoomLabel(false);
  }

  // ── Hit testing ──
  function hitTest(el, pt, thresh = 8) {
    if (el.type === "pen") {
      const pts = el.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegment(pt, pts[i], pts[i+1]) < thresh + (el.strokeW||2)) return true;
      }
      return false;
    }
    if (el.type === "line") {
      return distToSegment(pt, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2}) < thresh + (el.strokeW||2);
    }
    if (el.type === "rect" || el.type === "titleblock") {
      const inBox = pt.x >= el.x-thresh && pt.x <= el.x+el.w+thresh && pt.y >= el.y-thresh && pt.y <= el.y+el.h+thresh;
      if (!inBox) return false;
      if (el.type === "titleblock") return true;
      // near edge or inside if filled
      if (el.fillColor && el.fillColor !== "transparent") return true;
      return pt.x <= el.x+thresh || pt.x >= el.x+el.w-thresh || pt.y <= el.y+thresh || pt.y >= el.y+el.h-thresh;
    }
    if (el.type === "circle") {
      const cx = el.x + el.w/2, cy = el.y + el.h/2;
      const rx = Math.abs(el.w/2), ry = Math.abs(el.h/2);
      if (rx < 1 || ry < 1) return false;
      const norm = Math.pow((pt.x-cx)/rx,2) + Math.pow((pt.y-cy)/ry,2);
      return norm <= Math.pow(1 + thresh/Math.min(rx,ry), 2) && norm >= Math.pow(Math.max(0,1-thresh/Math.min(rx,ry)), 2);
    }
    if (el.type === "dimension") {
      return distToSegment(pt, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2}) < thresh + 6;
    }
    if (el.type === "text") {
      return pt.x >= el.x - thresh && pt.y >= el.y - thresh && pt.x <= el.x + 200 && pt.y <= el.y + (el.fontSize||14) * 1.5;
    }
    return false;
  }

  function distToSegment(p, a, b) {
    const dx = b.x-a.x, dy = b.y-a.y;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return Math.hypot(p.x-a.x, p.y-a.y);
    const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq));
    return Math.hypot(p.x - (a.x+t*dx), p.y - (a.y+t*dy));
  }

  // ── Move element by delta ──
  function moveElement(el, dx, dy) {
    if (el.type === "pen") return { ...el, points: el.points.map(p => ({x:p.x+dx,y:p.y+dy})) };
    if (el.type === "line") return { ...el, x1:el.x1+dx,y1:el.y1+dy,x2:el.x2+dx,y2:el.y2+dy };
    if (el.type === "rect" || el.type === "circle" || el.type === "titleblock") return { ...el, x:el.x+dx,y:el.y+dy };
    if (el.type === "dimension") return { ...el, x1:el.x1+dx,y1:el.y1+dy,x2:el.x2+dx,y2:el.y2+dy };
    if (el.type === "text") return { ...el, x:el.x+dx,y:el.y+dy };
    return el;
  }

  function updateSelectedLineMeasurement(nextMeasurement) {
    if (!selectedLine) return;
    const trimmed = nextMeasurement.trim();
    pushHistory(elementsRef.current.map(el => el.id === selectedLine.id ? { ...el, measurement: trimmed } : el));
  }

  // select tool drag state refs
  const dragEl     = ur(null);  // element being dragged
  const dragOffset = ur({x:0,y:0});

  // ── Pointer down ──
  function onDown(e) {
    e.preventDefault();
    if (placingRoomLabel) return;
    if (tool === "text") return;

    if (tool === "pan") {
      drawing.current = true;
      panStart.current = getRawPos(e);
      return;
    }

    const pt = maybeSnapPoint(getPos(e));
    drawing.current = true;
    startPt.current = pt;
    lastPt.current  = pt;

    if (tool === "select") {
      // find topmost element under cursor
      const hit = [...elements].reverse().find(el => hitTest(el, pt));
      if (hit) {
        dragEl.current     = hit.id;
        dragOffset.current = pt;
        setSelectedEl(hit.id);
      } else {
        dragEl.current = null;
        setSelectedEl(null);
      }
      return;
    }

    if (tool === "eraser") {
      penPoints.current = [pt];
      return;
    }
    if (tool === "pen") {
      penPoints.current = [pt];
    }
  }

  // ── Pointer move ──
  function onMove(e) {
    e.preventDefault();
    if (!drawing.current) return;

    if (tool === "pan") {
      const raw = getRawPos(e);
      const dx = raw.x - panStart.current.x;
      const dy = raw.y - panStart.current.y;
      panStart.current = raw;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    const pt = maybeSnapPoint(getPos(e));
    const prev = lastPt.current;
    lastPt.current = pt;

    if (tool === "select") {
      if (dragEl.current) {
        const dx = pt.x - dragOffset.current.x;
        const dy = pt.y - dragOffset.current.y;
        dragOffset.current = pt;
        setElements(els => els.map(el => el.id === dragEl.current ? moveElement(el, dx, dy) : el));
      }
      return;
    }

    if (tool === "pen") {
      penPoints.current.push(pt);
      drawPreview({ type:"pen", points:[...penPoints.current], color, strokeW });
    } else if (tool === "eraser") {
      // live visual: draw semi-transparent circle cursor on overlay
      penPoints.current.push(pt);
      const oc = overlayRef.current;
      if (oc) {
        const ctx = oc.getContext("2d");
        ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
        ctx.strokeStyle = "rgba(200,50,50,0.6)";
        ctx.fillStyle   = "rgba(200,50,50,0.08)";
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (strokeW*8)/2, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      }
    } else if (tool === "line") {
      const dx=pt.x-startPt.current.x, dy=pt.y-startPt.current.y;
      const len=Math.sqrt(dx*dx+dy*dy);
      drawPreview({ type:"line", x1:startPt.current.x, y1:startPt.current.y, x2:pt.x, y2:pt.y, color, strokeW, measurement: floorPlanMode ? formatDimension(len, scale) : "" });
    } else if (tool === "rect") {
      drawPreview({ type:"rect", x:Math.min(startPt.current.x,pt.x), y:Math.min(startPt.current.y,pt.y), w:Math.abs(pt.x-startPt.current.x), h:Math.abs(pt.y-startPt.current.y), color, strokeW });
    } else if (tool === "circle") {
      drawPreview({ type:"circle", x:Math.min(startPt.current.x,pt.x), y:Math.min(startPt.current.y,pt.y), w:pt.x-startPt.current.x, h:pt.y-startPt.current.y, color, strokeW });
    } else if (tool === "dimension") {
      const dx=pt.x-startPt.current.x, dy=pt.y-startPt.current.y;
      const len=Math.sqrt(dx*dx+dy*dy);
      drawPreview({ type:"dimension", x1:startPt.current.x,y1:startPt.current.y,x2:pt.x,y2:pt.y, label:formatDimension(len, scale), color:"#e86c3a", strokeW:1.5 });
    }
  }

  // ── Pointer up ──
  function onUp(e) {
    if (!drawing.current) return;
    drawing.current = false;

    if (tool === "pan") return; // pan complete, nothing to commit

    clearPreview();

    if (tool === "select") {
      if (dragEl.current) {
        // commit final position to history
        pushHistory([...elementsRef.current]);
        dragEl.current = null;
      }
      return;
    }

    const pt = lastPt.current;
    const sp = startPt.current;

    if (tool === "eraser") {
      // Remove any elements that the eraser path touches
      const eraserR = strokeW * 8;
      const path = penPoints.current;
      const toRemove = new Set();
      elements.forEach(el => {
        for (const p of path) {
          if (hitTest(el, p, eraserR / 2)) { toRemove.add(el.id); break; }
        }
      });
      if (toRemove.size > 0) {
        pushHistory(elements.filter(el => !toRemove.has(el.id)));
      }
      penPoints.current = [];
      return;
    }

    let newEl = null;
    if (tool === "pen") {
      if (penPoints.current.length > 1)
        newEl = { id:uid(), type:"pen", points:[...penPoints.current], color, strokeW };
    } else if (tool === "line") {
      const dx=pt.x-sp.x,dy=pt.y-sp.y,len=Math.sqrt(dx*dx+dy*dy);
      if (len > 3) newEl = { id:uid(), type:"line", x1:sp.x,y1:sp.y,x2:pt.x,y2:pt.y, color, strokeW, measurement: floorPlanMode ? formatDimension(len, scale) : "", fontSize:12 };
    } else if (tool === "rect") {
      const w = Math.abs(pt.x-sp.x), h = Math.abs(pt.y-sp.y);
      if (w > 3 && h > 3) newEl = { id:uid(), type:"rect", x:Math.min(sp.x,pt.x),y:Math.min(sp.y,pt.y),w,h, color, strokeW };
    } else if (tool === "circle") {
      if (Math.abs(pt.x-sp.x) > 3 && Math.abs(pt.y-sp.y) > 3)
        newEl = { id:uid(), type:"circle", x:Math.min(sp.x,pt.x),y:Math.min(sp.y,pt.y),w:pt.x-sp.x,h:pt.y-sp.y, color, strokeW };
    } else if (tool === "dimension") {
      const dx=pt.x-sp.x,dy=pt.y-sp.y,len=Math.sqrt(dx*dx+dy*dy);
      if (len > 10) newEl = { id:uid(), type:"dimension", x1:sp.x,y1:sp.y,x2:pt.x,y2:pt.y, label:formatDimension(len, scale), color:"#e86c3a", strokeW:1.5 };
    }

    if (newEl) {
      pushHistory([...elements, newEl]);
      if (newEl.type === "line" && floorPlanMode) setSelectedEl(newEl.id);
    }
    penPoints.current = [];
  }

  // ── Text tool ──
  function onCanvasClick(e) {
    const pt = maybeSnapPoint(getPos(e));
    if (placingRoomLabel) {
      placeRoomLabel(pt);
      return;
    }
    if (tool !== "text") return;
    setEditingText(pt);
    setTempText("");
    setTimeout(() => textInputRef.current?.focus(), 50);
  }

  function commitText() {
    if (tempText.trim() && editingText) {
      pushHistory([...elements, { id:uid(), type:"text", x:editingText.x, y:editingText.y, text:tempText, color, fontSize }]);
    }
    setEditingText(null);
    setTempText("");
  }

  // ── Undo / Redo ──
  function undo() {
    if (histIdx <= 0) return;
    const ni = histIdx - 1;
    setHistIdx(ni);
    setElements(history[ni]);
  }
  function redo() {
    if (histIdx >= history.length-1) return;
    const ni = histIdx+1;
    setHistIdx(ni);
    setElements(history[ni]);
  }

  // ── Export canvas as dataUrl ──
  function exportDataUrl() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }

  // ── Save ──
  function handleSave() {
    const dataUrl = exportDataUrl();
    onSave({ id: sketch?.id || uid(), title, notes, scale, roomTag, editorMode, floorLabel, snapToGrid, elements, dataUrl, date: today() });
    // Clear draft on explicit save
    try { localStorage.removeItem(_draftKey); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Add to report ──
  function handleAddToReport() {
    if (!selReport) return;
    const dataUrl = exportDataUrl();
    onSave({ id: sketch?.id || uid(), title, notes, scale, roomTag, editorMode, floorLabel, snapToGrid, elements, dataUrl, date: today() }, selReport);
    setShowExport(false);
  }

  // ── Clear canvas ──
  function clearAll() {
    if (!window.confirm("Clear all drawing content?")) return;
    pushHistory([]);
  }

  const canvasStyle = {
    position:"absolute", top:0, left:0, width:"100%", height:"100%",
    touchAction:"none", userSelect:"none",
    cursor: tool==="pan" ? (drawing.current ? "grabbing" : "grab") : tool==="eraser" ? "cell" : tool==="text" ? "text" : tool==="select" ? "default" : "crosshair",
  };

  // Zoom helpers
  const ZOOM_MIN = 0.25, ZOOM_MAX = 4;
  const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, +(z * 1.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z / 1.25).toFixed(2)));
  const zoomReset = () => { setZoom(1); setPanOffset({x:0,y:0}); };

  const activeReports = reports?.filter(r => r.status !== "archived") || [];

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"var(--bg)",display:"flex",flexDirection:"column",overflow:"hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ height:54,background:"var(--surface)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,padding:"0 12px",flexShrink:0 }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} title="Close">
          <Icon d={ic.close} size={18} />
        </button>
        <input value={title} onChange={e=>setTitle(e.target.value)}
          style={{ background:"transparent",border:"none",outline:"none",color:"var(--text)",fontWeight:700,fontSize:15,flex:1,minWidth:0 }} />
        <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:"auto" }}>
          {saved && <span style={{ fontSize:12,color:"var(--green)" }}>✓ Saved</span>}

          <button className="btn btn-secondary btn-sm" onClick={() => setShowNotes(!showNotes)}>
            <Icon d={ic.text} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>Notes</span>
          </button>
          <button className={`btn btn-sm ${floorPlanMode ? "btn-primary" : "btn-secondary"}`} onClick={() => setEditorMode(floorPlanMode ? "sketch" : "floorplan")}>
            <Icon d={ic.rooms} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>Floor Plan</span>
          </button>
          {floorPlanMode && (
            <button className={`btn btn-sm ${snapToGrid ? "btn-primary" : "btn-secondary"}`} onClick={() => setSnapToGrid(v => !v)}>
              <Icon d={ic.grid} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>{snapToGrid ? "Snap On" : "Snap Off"}</span>
            </button>
          )}
          {floorPlanMode && (
            <button className="btn btn-secondary btn-sm" onClick={addTitleBlock}>
              <Icon d={ic.text} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>CAD Info Box</span>
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)}>
            <Icon d={ic.reports} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>Add to Report</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Icon d={ic.check} size={14} /><span style={{ marginLeft:5 }}>Save</span>
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }}>

        {/* ── Left toolbar ── */}
        <div style={{ width:64,background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0",gap:2,flexShrink:0,overflowY:"auto" }}>
          {SKETCH_TOOLS.map(t => (
            <button key={t.id} title={t.label} onClick={()=>setTool(t.id)}
              style={{ width:52,height:52,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                background: tool===t.id ? "var(--accent)" : "transparent",
                color: tool===t.id ? "white" : "var(--text2)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Stroke width — horizontal line preview */}
          {[1,3,5,9].map(w => (
            <button key={w} title={`Stroke ${w}`} onClick={()=>setStrokeW(w)}
              style={{ width:52,height:40,borderRadius:10,border:strokeW===w?"2px solid var(--accent)":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                background: strokeW===w ? "var(--surface3)" : "transparent" }}>
              <div style={{ width:32,height:Math.min(w+1,8),borderRadius:4,background: strokeW===w ? "var(--accent)" : "var(--text2)" }} />
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Font size — only when text tool */}
          {tool === "text" && (<>
            <div style={{ fontSize:8,color:"var(--text3)",textAlign:"center",letterSpacing:".04em",marginBottom:2 }}>SIZE</div>
            {[10,14,18,24,32].map(fs => (
              <button key={fs} title={`Font ${fs}px`} onClick={()=>setFontSize(fs)}
                style={{ width:46,height:36,borderRadius:8,border:fontSize===fs?"2px solid var(--accent)":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  background: fontSize===fs ? "var(--surface3)" : "transparent",
                  color: fontSize===fs ? "var(--accent)" : "var(--text2)",
                  fontSize: Math.max(9, Math.min(fs*0.65, 18)), fontWeight:700 }}>
                {fs}
              </button>
            ))}
            <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />
          </>)}

          {/* Color swatches */}
          {STROKE_COLORS.map(c => (
            <button key={c} title={c} onClick={()=>setColor(c)}
              style={{ width:52,height:40,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{ width:26,height:26,borderRadius:"50%",background:c,
                outline: color===c ? "2px solid var(--accent)" : "1.5px solid rgba(255,255,255,0.15)",
                outlineOffset:2,
                boxShadow: c==="#ffffff"||c==="#000000" ? "inset 0 0 0 1px rgba(128,128,128,0.35)" : "none"
              }} />
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Grid toggle */}
          <button title="Toggle Grid" onClick={()=>setShowGrid(!showGrid)}
            style={{ width:52,height:46,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              background: showGrid ? "var(--surface3)" : "transparent",
              color: showGrid ? "var(--accent)" : "var(--text3)" }}>
            <Icon d={ic.grid} size={22} />
          </button>

          <div style={{ height:14 }} />

          {/* Clear */}
          <button title="Clear All" onClick={clearAll}
            style={{ width:52,height:46,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)" }}>
            <Icon d={ic.trash} size={22} />
          </button>
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef} style={{ flex:1,overflow:"hidden",background:"#1a1e28",position:"relative" }}>
          {/* Zoom + pan transform wrapper */}
          <div style={{
            position:"absolute", inset:0, overflow:"hidden",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: tool === "pan" ? "none" : "transform 0.05s",
              position:"relative",
              width:CANVAS_W, height:CANVAS_H,
              flexShrink:0,
              boxShadow:"0 8px 40px rgba(0,0,0,.5)",
              borderRadius:4,
              overflow:"hidden",
            }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%" }} />
              <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                onClick={onCanvasClick} />
              {/* Text input overlay */}
              {editingText && (
                <div style={{ position:"absolute", left:editingText.x/CANVAS_W*100+"%", top:editingText.y/CANVAS_H*100+"%", zIndex:10 }}>
                  <textarea ref={textInputRef} value={tempText} onChange={e=>setTempText(e.target.value)}
                    onBlur={commitText}
                    onKeyDown={e=>{ if(e.key==="Escape"){ setEditingText(null); setTempText(""); } if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); commitText(); } }}
                    rows={2}
                    style={{ background:"rgba(255,255,255,.95)",color:"#1a1e28",border:"2px solid var(--accent)",borderRadius:4,padding:"4px 8px",fontSize:fontSize,fontFamily:"Inter,sans-serif",outline:"none",minWidth:120,resize:"both" }} />
                </div>
              )}
            </div>
          </div>

          {/* ── Undo/Redo overlay — top-right, always visible ── */}
          <div style={{ position:"absolute",top:12,right:12,display:"flex",flexDirection:"row",gap:4,zIndex:20 }}>
            <button onClick={undo} title="Undo"
              style={{ height:40,padding:"0 12px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,boxShadow:"0 2px 12px rgba(0,0,0,.4)",fontSize:14,fontWeight:600 }}>
              â© <span style={{ fontSize:12 }}>Undo</span>
            </button>
            <button onClick={redo} title="Redo"
              style={{ height:40,padding:"0 12px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,boxShadow:"0 2px 12px rgba(0,0,0,.4)",fontSize:14,fontWeight:600 }}>
              âª <span style={{ fontSize:12 }}>Redo</span>
            </button>
          </div>

          {/* ── Zoom controls overlay — bottom-right, horizontal ── */}
          {floorPlanMode && (
            <div style={{ position:"absolute",left:12,bottom:56,zIndex:24,background:"rgba(13,15,20,.95)",border:"1px solid var(--border)",borderRadius:14,padding:"10px 12px",minWidth:fpPanelCollapsed?120:230,maxWidth:"min(92vw, 320px)",boxShadow:"0 10px 30px rgba(0,0,0,.35)",display:"flex",flexDirection:"column",gap:8,transition:"min-width .2s" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
                <div style={{ fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)" }}>Floor Plan</div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  {!fpPanelCollapsed && selectedLine && <div style={{ fontSize:11,color:"var(--accent)" }}>Wall selected</div>}
                  <button onClick={() => setFpPanelCollapsed(v => !v)} title={fpPanelCollapsed ? "Expand" : "Collapse"} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:16,lineHeight:1,padding:"0 2px" }}>
                    {fpPanelCollapsed ? "â²" : "â¼"}
                  </button>
                </div>
              </div>
              {fpPanelCollapsed && <div style={{ fontSize:11,color:"var(--text3)",textAlign:"center" }}>Tap â² to expand</div>}
              {!fpPanelCollapsed && <>
              <button className={`btn btn-sm ${snapToGrid ? "btn-primary" : "btn-secondary"}`} onClick={() => setSnapToGrid(v => !v)} style={{ alignSelf:"flex-start" }}>
                <Icon d={ic.grid} size={13} /> {snapToGrid ? "Snap On" : "Snap Off"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={addTitleBlock} style={{ alignSelf:"flex-start" }}>
                <Icon d={ic.text} size={13} /> Add CAD Info Box
              </button>
              <input
                className="form-input"
                value={floorLabel}
                onChange={e=>setFloorLabel(e.target.value)}
                placeholder="Floor name, e.g. Main Floor"
                style={{ fontSize:12.5,padding:"9px 11px" }}
              />
              <div style={{ display:"flex",gap:6 }}>
                <input
                  className="form-input"
                  value={roomLabelDraft}
                  onChange={e=>setRoomLabelDraft(e.target.value)}
                  placeholder="Room label"
                  style={{ fontSize:12.5,padding:"9px 11px",flex:1 }}
                />
                <button className={`btn btn-sm ${placingRoomLabel ? "btn-primary" : "btn-secondary"}`} onClick={() => setPlacingRoomLabel(v => !v)} disabled={!roomLabelDraft.trim()}>
                  {placingRoomLabel ? "Tap Plan" : "Place"}
                </button>
              </div>
              {selectedTitleBlock && (
                <>
                  <div style={{ fontSize:11,color:"var(--accent)",fontWeight:700 }}>Info box selected</div>
                  <input
                    type="range"
                    min="160"
                    max="420"
                    step="10"
                    value={selectedTitleBlock.w || 280}
                    onChange={e => updateSelectedTitleBlockWidth(e.target.value)}
                    style={{ width:"100%" }}
                  />
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {[
                      { label:"Corner", width:180 },
                      { label:"Small", width:220 },
                      { label:"Med", width:280 },
                      { label:"Large", width:340 },
                    ].map(opt => (
                      <button key={opt.label} className="btn btn-ghost btn-sm" style={{ fontSize:11,height:26,padding:"0 8px" }} onClick={() => updateSelectedTitleBlockWidth(opt.width)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {selectedLine ? (
                <>
                  <input
                    className="form-input"
                    value={lineMeasureDraft}
                    onChange={e=>setLineMeasureDraft(e.target.value)}
                    onBlur={() => updateSelectedLineMeasurement(lineMeasureDraft)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        updateSelectedLineMeasurement(lineMeasureDraft);
                      }
                    }}
                    placeholder="Wall measurement"
                    style={{ fontSize:12.5,padding:"9px 11px" }}
                  />
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {["8 ft","10 ft","12 ft","14 ft","16 ft"].map(v => (
                      <button key={v} className="btn btn-ghost btn-sm" style={{ fontSize:11,height:26,padding:"0 8px" }} onClick={() => { setLineMeasureDraft(v); updateSelectedLineMeasurement(v); }}>{v}</button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.45 }}>
                  Draw with the line tool, then tap a wall to edit its measurement.
                </div>
              )}
              </>}
            </div>
          )}

          <div style={{ position:"absolute",bottom:12,right:12,display:"flex",flexDirection:"row",alignItems:"center",gap:4,zIndex:20 }}>
            <button onClick={zoomOut} title="Zoom Out"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>â</button>
            <button onClick={zoomReset} title={`${Math.round(zoom*100)}% — Click to reset`}
              style={{ height:40,padding:"0 8px",minWidth:44,borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>
              {Math.round(zoom*100)}%
            </button>
            <button onClick={zoomIn} title="Zoom In"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>+</button>
          </div>
        </div>

        {/* ── Notes panel — side panel on desktop, bottom sheet on mobile ── */}
        {showNotes && (
          <>
            {/* Mobile bottom sheet backdrop */}
            <div className="mobile-only" onClick={() => setShowNotes(false)}
              style={{ position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,.5)" }} />

            {/* Panel */}
            <div style={{
              // desktop: right side panel
              // mobile: fixed bottom sheet
              zIndex:300,
              background:"var(--surface)",
              display:"flex", flexDirection:"column",
              gap:12, overflowY:"auto",
            }}
              className="sketch-notes-panel">
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>Sketch Details</div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowNotes(false)}>
                  <Icon d={ic.close} size={16} />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Sketch Title</label>
                <input className="form-input" style={{ fontSize:13 }} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Living Room Floor Plan" />
              </div>

              <div className="form-group">
                <label className="form-label">Room / Area</label>
                <select className="form-input form-select" style={{ fontSize:12.5 }} value={roomTag} onChange={e=>setRoomTag(e.target.value)}>
                  <option value="">— None —</option>
                  {(rooms||[]).map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
                  <option value="General">General</option>
                  <option value="Exterior">Exterior</option>
                  <option value="Floor Plan">Floor Plan</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Scale</label>
                <select className="form-input form-select" style={{ fontSize:12.5 }} value={scale} onChange={e=>setScale(e.target.value)}>
                  {SKETCH_SCALE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Editor Mode</label>
                <select className="form-input form-select" style={{ fontSize:12.5 }} value={editorMode} onChange={e=>setEditorMode(e.target.value)}>
                  <option value="sketch">General Sketch</option>
                  <option value="floorplan">Floor Plan Mode</option>
                </select>
              </div>

              {floorPlanMode && (
                <>
                  <div className="form-group">
                    <label className="form-label">Floor</label>
                    <input className="form-input" style={{ fontSize:12.5 }} value={floorLabel} onChange={e=>setFloorLabel(e.target.value)} placeholder="e.g. Basement, Main Floor, Level 2" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Snap to Grid</label>
                    <button type="button" className={`btn btn-sm ${snapToGrid ? "btn-primary" : "btn-secondary"}`} onClick={() => setSnapToGrid(v => !v)}>
                      <Icon d={ic.grid} size={13} /> {snapToGrid ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room Label</label>
                    <div style={{ display:"flex",gap:8 }}>
                      <input className="form-input" style={{ fontSize:12.5,flex:1 }} value={roomLabelDraft} onChange={e=>setRoomLabelDraft(e.target.value)} placeholder="e.g. Kitchen" />
                      <button type="button" className={`btn btn-sm ${placingRoomLabel ? "btn-primary" : "btn-secondary"}`} onClick={() => setPlacingRoomLabel(v => !v)} disabled={!roomLabelDraft.trim()}>
                        {placingRoomLabel ? "Tap Plan" : "Place"}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">CAD Info Box</label>
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addTitleBlock} style={{ alignSelf:"flex-start" }}>
                        <Icon d={ic.text} size={13} /> Add Project Info Box
                      </button>
                      <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.45 }}>
                        Adds a draft-style title block with company, user, project, and client details.
                      </div>
                      {selectedTitleBlock && (
                        <>
                          <input
                            type="range"
                            min="160"
                            max="420"
                            step="10"
                            value={selectedTitleBlock.w || 280}
                            onChange={e => updateSelectedTitleBlockWidth(e.target.value)}
                            style={{ width:"100%" }}
                          />
                          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                            {[
                              { label:"Corner", width:180 },
                              { label:"Small", width:220 },
                              { label:"Medium", width:280 },
                              { label:"Large", width:340 },
                            ].map(opt => (
                              <button key={opt.label} type="button" className="btn btn-ghost btn-sm" style={{ fontSize:11,height:26,padding:"0 8px" }} onClick={() => updateSelectedTitleBlockWidth(opt.width)}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={5} value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Add site notes, observations, moisture readings..." style={{ fontSize:12.5,resize:"vertical" }} />
              </div>

              {/* Moisture legend */}
              <div>
                <div style={{ fontSize:11.5,fontWeight:600,color:"var(--text2)",marginBottom:6 }}>Moisture Legend</div>
                {MOISTURE_COLORS.map(mc=>(
                  <div key={mc.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                    <div style={{ width:14,height:14,borderRadius:3,background:mc.color,flexShrink:0 }} />
                    <span style={{ fontSize:12,color:"var(--text2)" }}>{mc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom info bar ── */}
      <div style={{ height:36,background:"var(--surface)",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",padding:"0 14px",gap:16,flexShrink:0 }}>
        <span style={{ fontSize:11.5,color:"var(--text3)" }}>Tool: <b style={{ color:"var(--text2)" }}>{SKETCH_TOOLS.find(t=>t.id===tool)?.label}</b></span>
        <span style={{ fontSize:11.5,color:"var(--text3)" }}>Mode: <b style={{ color:"var(--text2)" }}>{floorPlanMode ? "Floor Plan" : "Sketch"}</b></span>
        <span style={{ fontSize:11.5,color:"var(--text3)" }}>Scale: <b style={{ color:"var(--text2)" }}>{scale}</b></span>
        {floorPlanMode && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Snap: <b style={{ color:"var(--text2)" }}>{snapToGrid ? "On" : "Off"}</b></span>}
        {roomTag && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Room: <b style={{ color:"var(--text2)" }}>{roomTag}</b></span>}
        {floorPlanMode && floorLabel && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Floor: <b style={{ color:"var(--text2)" }}>{floorLabel}</b></span>}
        {selectedEl && tool === "select" && (
          <button className="btn btn-ghost btn-sm" style={{ color:"#e85a3a",fontSize:11.5,height:24,padding:"0 8px" }}
            onClick={() => { pushHistory(elements.filter(el => el.id !== selectedEl)); setSelectedEl(null); }}>
            <Icon d={ic.trash} size={12} /> Delete selected
          </button>
        )}
        <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:"auto" }}>{elements.length} element{elements.length!==1?"s":""}</span>
      </div>

      {/* ── Add to Report modal ── */}
      {showExport && (
        <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div style={{ background:"var(--surface)",borderRadius:16,padding:24,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ fontWeight:700,fontSize:16,marginBottom:4 }}>Add to Report</div>
            <div style={{ fontSize:13,color:"var(--text2)",marginBottom:18 }}>Add this sketch as an image block in a report.</div>
            {activeReports.length === 0 ? (
              <div style={{ fontSize:13,color:"var(--text3)",marginBottom:16 }}>No reports found for this project. Create a report first.</div>
            ) : (
              <div className="form-group" style={{ marginBottom:16 }}>
                <label className="form-label">Select Report</label>
                <select className="form-input form-select" value={selReport} onChange={e=>setSelReport(e.target.value)}>
                  <option value="">— Choose a report —</option>
                  {activeReports.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowExport(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddToReport} disabled={!selReport}>
                <Icon d={ic.check} size={14} /> Add to Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project Activity Feed ──────────────────────────────────────────────────────
export function ProjectActivityFeed({ project, onUpdateProject, settings }) {
  const [newNote, setNewNote] = useState("");
  const [posting, setPosting] = useState(false);

  // Build a unified activity list from all project data
  const events = [];

  // Project created
  if (project.date) events.push({ id:"created", type:"created", date: project.date, time:"", icon:"ð", label:"Project created", detail: project.title });

  // Photos
  (project.photos || []).forEach(p => {
    if (p.date) events.push({ id:`ph-${p.id}`, type:"photo", date:p.date, time:p.time||"", icon:"ð·", label:"Photo captured", detail: `${p.name || "Photo"}${p.room ? ` · ${p.room}` : ""}` });
  });

  // Videos
  (project.videos || []).forEach(v => {
    if (v.date) events.push({ id:`vid-${v.id}`, type:"video", date:v.date, time:"", icon:"ð¬", label:"Video recorded", detail: v.name || "Video clip" });
  });

  // Voice notes
  (project.voiceNotes || []).forEach(vn => {
    if (vn.date) events.push({ id:`vn-${vn.id}`, type:"voice", date:vn.date, time:"", icon:"ð", label:"Voice note recorded", detail: vn.name || "Voice note" });
  });

  // Reports
  (project.reports || []).forEach(r => {
    if (r.date) events.push({ id:`rpt-${r.id}`, type:"report", date:r.date, time:"", icon:"ð", label:`Report ${r.status === "final" ? "finalised" : r.status === "sent" ? "sent" : "created"}`, detail: r.title || "Report" });
  });

  // Checklists
  (project.checklists || []).forEach(cl => {
    if (cl.date) events.push({ id:`cl-${cl.id}`, type:"checklist", date:cl.date, time:"", icon:"â", label:`Checklist ${cl.status === "complete" ? "completed" : "started"}`, detail: cl.name || "Checklist" });
  });

  // Files
  (project.files || []).forEach(f => {
    if (f.date || f.uploadedAt) events.push({ id:`fl-${f.id}`, type:"file", date:f.date||f.uploadedAt, time:"", icon:"ð", label:"File uploaded", detail: f.name || "File" });
  });

  // Activity log notes (manual entries)
  (project.activityLog || []).forEach(a => {
    events.push({ id:`al-${a.id}`, type:"note", date:a.date, time:a.time||"", icon:"ð¬", label:a.author ? `Note by ${a.author}` : "Note added", detail:a.text, deletable: true, _raw: a });
  });

  // Timeline stage changes
  if (project.timelineStage) {
    events.push({ id:"stage", type:"stage", date: project.date || today(), time:"", icon:"ð·", label:"Stage updated", detail: project.timelineStage.replace(/_/g," ") });
  }

  // Sort newest first
  const sorted = events.sort((a, b) => {
    const da = new Date(`${a.date}${a.time ? " " + a.time : ""}`);
    const db = new Date(`${b.date}${b.time ? " " + b.time : ""}`);
    return db - da;
  });

  const postNote = () => {
    if (!newNote.trim()) return;
    setPosting(true);
    const entry = { id: uid(), type:"note", date: today(), time: new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true}), text: newNote.trim(), author: settings?.userFirstName ? `${settings.userFirstName} ${settings.userLastName||""}`.trim() : "You" };
    onUpdateProject({ ...project, activityLog: [...(project.activityLog||[]), entry] });
    setNewNote(""); setPosting(false);
  };

  const deleteNote = (id) => {
    onUpdateProject({ ...project, activityLog: (project.activityLog||[]).filter(a => a.id !== id) });
  };

  const TYPE_COLOR = { photo:"var(--accent)", video:"#8b7cf8", voice:"#f0954e", report:"#3dba7e", checklist:"#3dba7e", file:"#4a90d9", note:"var(--text2)", created:"var(--accent)", stage:"#fbbf24" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Add a note */}
      <div className="card">
        <div className="card-header"><span style={{ fontWeight:700 }}>ð¬ Add Note</span></div>
        <div className="card-body" style={{ padding:"14px 20px" }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <textarea
              className="form-input form-textarea"
              placeholder="Log an update, note, or observation about this project…"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              style={{ flex:1, minHeight:72, resize:"vertical" }}
            />
            <button className="btn btn-primary" disabled={!newNote.trim() || posting} onClick={postNote} style={{ flexShrink:0, alignSelf:"flex-end" }}>
              <Icon d={ic.plus} size={14} /> Post
            </button>
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="card">
        <div className="card-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontWeight:700 }}>ð Activity Feed</span>
          <span style={{ fontSize:12, color:"var(--text3)" }}>{sorted.length} event{sorted.length!==1?"s":""}</span>
        </div>
        <div className="card-body" style={{ padding:"6px 0" }}>
          {sorted.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 20px", color:"var(--text3)", fontSize:13 }}>
              No activity yet. Start by taking photos or adding a note.
            </div>
          )}
          {sorted.map((ev, i) => (
            <div key={ev.id} style={{ display:"flex", gap:14, padding:"12px 20px", borderBottom: i < sorted.length-1 ? "1px solid var(--border)" : "none", alignItems:"flex-start" }}>
              {/* Icon + line */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, paddingTop:2 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                  {ev.icon}
                </div>
                {i < sorted.length-1 && <div style={{ width:1, flex:1, minHeight:12, background:"var(--border)", marginTop:4 }} />}
              </div>
              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{ev.label}</span>
                  <span style={{ fontSize:11, color:"var(--text3)" }}>{ev.date}{ev.time ? ` · ${ev.time}` : ""}</span>
                </div>
                <div style={{ fontSize:13, color:"var(--text2)", marginTop:3, lineHeight:1.5, wordBreak:"break-word" }}>
                  {ev.detail}
                </div>
              </div>
              {/* Delete note */}
              {ev.deletable && (
                <button onClick={() => deleteNote(ev._raw.id)} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", padding:"2px 4px", flexShrink:0, opacity:.6, fontSize:16, lineHeight:1 }}
                  onMouseEnter={e => e.currentTarget.style.opacity=1}
                  onMouseLeave={e => e.currentTarget.style.opacity=0.6}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Project Detail (tabs: Overview, Photos, Rooms, Reports, Checklists) ────────
// ── AI Project Overview ─────────────────────────────────────────────────────
export function AIProjectOverview({ project, settings, onSettingsChange, orgId, userId }) {
  const [overviewData,    setOverviewData]    = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [generating,      setGenerating]      = useState(false);
  const [expanded,        setExpanded]        = useState(false);
  const [genError,        setGenError]        = useState(null);
  const supaUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!orgId || !project?.id) return;
    setLoadingOverview(true);
    setOverviewData(null);
    getAuthHeaders()
      .then(h => fetch(
        `${supaUrl}/rest/v1/project_ai_overviews?organization_id=eq.${orgId}&project_id=eq.${encodeURIComponent(String(project.id))}&select=overview_text,updated_at&order=updated_at.desc&limit=1`,
        { headers: h }
      ))
      .then(r => r.ok ? r.json() : [])
      .then(rows => { if (rows.length > 0) setOverviewData({ text: rows[0].overview_text, updatedAt: rows[0].updated_at }); })
      .catch(() => {})
      .finally(() => setLoadingOverview(false));
  }, [project?.id, orgId]);

  const handleGenerate = async () => {
    const plan  = settings?.plan || "base";
    const limit = PLAN_AI_LIMITS[plan] || 0;
    if (limit === 0) { setGenError("AI features are not available on your current plan."); return; }
    const curWin  = getWeekWindowStart();
    const wStart  = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
    const valid   = wStart && wStart >= curWin;
    const usedNow = valid ? (settings?.aiGenerationsUsed || 0) : 0;
    if (usedNow >= limit) {
      const reset = getNextResetDate();
      setGenError(`Weekly limit reached (${limit} AI Generation Krakens). Resets ${reset.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })} at 11:59 PM.`);
      return;
    }
    setGenerating(true); setGenError(null);
    try {
      const rooms      = (project.rooms || []).map(r => r.name).join(", ") || "None";
      const photoRooms = [...new Set((project.photos || []).map(p => p.room).filter(Boolean))].join(", ") || "None";
      const checklists = (project.checklists || []).map(cl => {
        const fields = cl.fields || [];
        const done   = fields.filter(f => f.value || f.checked || f.response).length;
        return `${cl.name} (${done}/${fields.length} items${cl.completedAt ? " \u2014 COMPLETED" : ""})`;
      }).join("; ") || "None";
      const reports    = (project.reports  || []).map(r => r.title || r.type || "Report").join(", ") || "None";
      const voiceNotes = (project.voiceNotes || []).map(v => v.name || v.label || "Voice note").join(", ") || "None";
      const actNotes   = (project.activity || []).filter(a => a.text || a.content).map(a => a.text || a.content || "").filter(Boolean).slice(0, 6).join(" | ") || "None";
      const dateInsp   = project.dateInspection ? formatDate(project.dateInspection, settings) : "N/A";
      const ctx = [
        `Project Title: ${project.title}`,
        `Project Type: ${project.type || "N/A"}`,
        `Status: ${project.status || "Active"}`,
        `Client: ${project.clientName || "N/A"}`,
        `Date of Inspection/Assessment: ${dateInsp}`,
        `Project Notes: ${project.notes || "None"}`,
        `Rooms Documented: ${rooms}`,
        `Photo Areas: ${photoRooms}`,
        `Checklists: ${checklists}`,
        `Reports Generated: ${reports}`,
        `Voice Notes: ${voiceNotes}`,
        `Activity/Field Notes: ${actNotes}`,
      ].join("\n");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          projectName:        project.title,
          projectDescription: ctx,
          photos:             [],
          customPrompt: "Write a concise professional AI overview of this jobsite project in 1\u20132 paragraphs. Focus on: what the job entails, job type, key findings or observations, work completed or in progress, and any other notable details specific to this project. Do not mention photo counts or generic statistics. Use bullet points within the paragraphs for key findings if helpful. Keep it informative but concise \u2014 about 1\u20132 paragraphs total.",
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = (data.report || data.text || "").trim();
      if (!text) throw new Error("No content returned from AI");

      const now = new Date().toISOString();
      const h2  = await getAuthHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" });
      await fetch(`${supaUrl}/rest/v1/project_ai_overviews`, {
        method: "POST", headers: h2,
        body: JSON.stringify({ organization_id: orgId, project_id: String(project.id), overview_text: text, updated_at: now, updated_by: userId || null }),
      });
      setOverviewData({ text, updatedAt: now });

      if (onSettingsChange) {
        const curWin2 = getWeekWindowStart();
        const wStart2 = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
        const valid2  = wStart2 && wStart2 >= curWin2;
        const used2   = valid2 ? (settings?.aiGenerationsUsed || 0) : 0;
        onSettingsChange(prev => ({ ...prev, aiGenerationsUsed: used2 + 1, aiGenerationsWindowStart: valid2 ? prev.aiGenerationsWindowStart : curWin2.toISOString() }));
      }
    } catch (err) { setGenError(`Generation failed: ${err.message}`); }
    finally { setGenerating(false); }
  };

  const lastUpdatedLabel = overviewData?.updatedAt
    ? new Date(overviewData.updatedAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
      + " at " + new Date(overviewData.updatedAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })
    : null;

  return (
    <div className="card" style={{ marginBottom:16 }}>
      <div className="card-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <span style={{ fontWeight:700, display:"flex", alignItems:"center", gap:7 }}>
          <Icon d={ic.zap} size={14} stroke="var(--accent)" />
          AI Project Overview
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {lastUpdatedLabel && (
            <span style={{ fontSize:11.5, color:"var(--text3)" }}>Last updated: {lastUpdatedLabel}</span>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}
            style={{ display:"flex", alignItems:"center", gap:6 }}>
            {generating
              ? <><div style={{ width:11,height:11,border:"2px solid rgba(255,255,255,.4)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />Updating\u2026</>
              : <>&#10022; Update&nbsp;<span style={{ fontSize:10,fontWeight:700,background:"rgba(255,255,255,.2)",borderRadius:8,padding:"1px 6px" }}>1 Kraken</span></>}
          </button>
        </div>
      </div>
      <div className="card-body" style={{ padding:"14px 20px" }}>
        {genError && (
          <div style={{ fontSize:12.5,color:"#ff6b6b",background:"rgba(220,60,60,.08)",border:"1px solid rgba(220,60,60,.22)",borderRadius:8,padding:"8px 12px",marginBottom:10 }}>
            {genError}
          </div>
        )}
        {loadingOverview ? (
          <div style={{ color:"var(--text3)",fontSize:13,textAlign:"center",padding:"18px 0" }}>Loading\u2026</div>
        ) : overviewData ? (
          <>
            <div style={{ position:"relative" }}>
              <div style={{ fontSize:13.5,lineHeight:1.75,color:"var(--text2)",whiteSpace:"pre-wrap",overflow:"hidden",maxHeight:expanded?"none":"6em" }}>
                {overviewData.text}
              </div>
              {!expanded && (
                <div style={{ position:"absolute",bottom:0,left:0,right:0,height:32,background:"linear-gradient(transparent, var(--surface))",pointerEvents:"none" }} />
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(v => !v)}
              style={{ marginTop:6,fontSize:12,color:"var(--accent)",padding:"3px 0" }}>
              {expanded ? "\u2191 Show less" : "\u2193 Show more"}
            </button>
          </>
        ) : (
          <div style={{ fontSize:13,color:"var(--text3)",textAlign:"center",padding:"18px 0",lineHeight:1.6 }}>
            No overview yet. Click <strong style={{ color:"var(--text2)" }}>Update</strong> to generate an AI summary of this jobsite \u2014 costs <strong style={{ color:"var(--accent)" }}>1 AI Generation Kraken</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
