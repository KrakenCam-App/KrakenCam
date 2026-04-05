/**
 * src/components/QrActionModal.jsx
 *
 * Smart QR scan → action modal for equipment tracking.
 * Replaces inline QR state machine in RoomsTab.
 *
 * Props:
 *   mode         — 'assign' | 'track'  (assign = for a specific room, track = free scan)
 *   room         — current room object (id, name) — required when mode='assign'
 *   projectId    — required
 *   orgId        — required
 *   userId       — current user id
 *   allRooms     — array of all rooms in the project [{id, name}]
 *   onDone       — called with updated assignment after action completes
 *   onClose      — close the modal
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  logMovement,
  removeAssignment,
  moveEquipmentToRoom,
  markInTransit,
  MOVE_ACTION,
} from "../lib/equipmentMovement";

// ── Dynamic jsQR load ──────────────────────────────────────────────────────────
let _jsQR = null;
async function loadJsQR() {
  if (_jsQR) return _jsQR;
  const mod = await import("jsqr");
  _jsQR = mod.default || mod;
  return _jsQR;
}

// ── Phase constants ────────────────────────────────────────────────────────────
const PHASE = {
  SCANNING:    'scanning',
  LOOKING_UP:  'looking_up',
  NOT_FOUND:   'not_found',
  LOCKED_OUT:  'locked_out',
  ALREADY_HERE:'already_here',
  CHOOSE_ACTION:'choose_action',  // equipment found, in other room or unassigned
  CONFIRM:     'confirm',
  SAVING:      'saving',
  SAVED:       'saved',
};

// ── Overlay styles ─────────────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 1100,
  background: '#000',
  display: 'flex', flexDirection: 'column',
};
const TOP_BAR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', background: 'rgba(0,0,0,.85)',
  borderBottom: '1px solid rgba(255,255,255,.1)',
};
const CARD = {
  background: 'var(--surface1, #1e1e1e)', borderRadius: 16,
  padding: '22px 20px', margin: '0 0 12px',
  border: '1px solid var(--border, #333)',
};

// ── Animated scan frame ────────────────────────────────────────────────────────
function ScanFrame({ status }) {
  const color = status === 'success' ? '#22c55e'
              : status === 'error'   ? '#ef4444'
              : '#ffffff';
  const s = { position: 'absolute', width: 28, height: 28,
    borderColor: color, borderStyle: 'solid', borderWidth: 0 };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', width: 220, height: 220 }}>
        <div style={{ ...s, top: 0, left: 0,  borderTopWidth: 3, borderLeftWidth: 3,  borderTopLeftRadius: 8 }} />
        <div style={{ ...s, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 }} />
        <div style={{ ...s, bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 8 }} />
        <div style={{ ...s, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 }} />
        {/* scan line */}
        <div style={{
          position: 'absolute', left: 4, right: 4, height: 2,
          background: `linear-gradient(to right, transparent, ${color}, transparent)`,
          top: '50%', opacity: status === 'scanning' ? 1 : 0,
          animation: status === 'scanning' ? 'scanLine 1.6s ease-in-out infinite' : 'none',
        }} />
      </div>
      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(-80px); opacity: 0.3; }
          50%  { transform: translateY(0px);   opacity: 1; }
          100% { transform: translateY(80px);  opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function QrActionModal({ mode = 'assign', room, projectId, orgId, userId, allRooms = [], onDone, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);

  const [phase,      setPhase]      = useState(PHASE.SCANNING);
  const [camStatus,  setCamStatus]  = useState('starting'); // starting|scanning|success|error
  const [equipment,  setEquipment]  = useState(null);   // found equipment row
  const [assignment, setAssignment] = useState(null);   // existing assignment (if any)
  const [targetRoom, setTargetRoom] = useState(null);   // chosen destination room for move
  const [actionNotes, setActionNotes] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'assign'|'move'|'remove'|'transit'
  const [saveErr, setSaveErr] = useState(null);

  // ── Camera setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCamStatus('scanning');
        }
      } catch (e) {
        if (!cancelled) setCamStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  // ── Scan loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camStatus !== 'scanning' || phase !== PHASE.SCANNING) return;
    let active = true;

    async function tick() {
      if (!active || phase !== PHASE.SCANNING) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        try {
          const jsQR   = await loadJsQR();
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result  = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (result && active) {
            setCamStatus('success');
            stopCamera();
            try { navigator.vibrate([80, 40, 80]); } catch (_) {}
            handleScan(result.data);
            return;
          }
        } catch (_) {}
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { active = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [camStatus, phase]);

  // ── Handle scan result ────────────────────────────────────────────────────
  const handleScan = useCallback(async (decoded) => {
    setPhase(PHASE.LOOKING_UP);

    // Look up equipment by qr_code_id scoped to this org
    const { data: eqRows, error } = await supabase
      .from('equipment')
      .select('*, equipment_types(name), equipment_categories(name)')
      .eq('qr_code_id', decoded)
      .eq('organization_id', orgId)
      .eq('active', true)
      .limit(1);

    if (error || !eqRows || eqRows.length === 0) {
      setPhase(PHASE.NOT_FOUND);
      return;
    }

    const eq = eqRows[0];
    setEquipment(eq);

    // Locked out?
    if (eq.is_locked_out) {
      setPhase(PHASE.LOCKED_OUT);
      return;
    }

    // Look up active assignment(s) in this project
    const { data: assigns } = await supabase
      .from('room_equipment_assignments')
      .select('*')
      .eq('equipment_id', eq.id)
      .eq('project_id', projectId)
      .is('removed_at', null);

    const existingHere = assigns?.find(a => a.room_id === room?.id);
    const otherAssign  = assigns?.find(a => a.room_id !== room?.id);

    if (mode === 'assign') {
      // Already in THIS room
      if (existingHere) {
        setAssignment(existingHere);
        setPhase(PHASE.ALREADY_HERE);
        return;
      }
      // In another room → offer move
      if (otherAssign) {
        setAssignment(otherAssign);
        setPhase(PHASE.CHOOSE_ACTION);
        setPendingAction('move_from_other');
        return;
      }
      // Free — confirm assign
      setPhase(PHASE.CONFIRM);
      setPendingAction('assign');
    } else {
      // Track mode — show contextual action menu
      setAssignment(existingHere || otherAssign || null);
      setPhase(PHASE.CHOOSE_ACTION);
    }
  }, [orgId, projectId, room, mode]);

  // ── Confirm and execute action ─────────────────────────────────────────────
  const executeAction = useCallback(async (action) => {
    setSaveErr(null);
    setPhase(PHASE.SAVING);
    const now = new Date().toISOString();

    try {
      if (action === 'assign' || action === 'move_from_other' || action === 'move') {
        const fromRoomId   = assignment?.room_id   || null;
        const fromRoomName = allRooms.find(r => r.id === fromRoomId)?.name || fromRoomId || null;

        // Remove old assignment if moving
        if (assignment && fromRoomId !== room?.id) {
          await supabase
            .from('room_equipment_assignments')
            .update({ removed_at: now, removed_by_user_id: userId || null, removal_reason: 'moved_to_room', updated_at: now })
            .eq('id', assignment.id);
        }

        // Create new assignment
        const { data: newAssign, error: nErr } = await supabase
          .from('room_equipment_assignments')
          .insert([{
            organization_id:    orgId,
            project_id:         projectId,
            room_id:            room.id,
            equipment_id:       equipment.id,
            placed_at:          now,
            placed_by_user_id:  userId || null,
            assigned_via:       'qr_scan',
            scan_timestamp:     now,
            scanned_by_user_id: userId || null,
            notes:              actionNotes || null,
          }])
          .select()
          .single();
        if (nErr) throw nErr;

        // Update equipment status
        await supabase.from('equipment').update({
          status:             'deployed',
          current_location:   room.name || 'jobsite',
          updated_by_user_id: userId || null,
          updated_at:         now,
        }).eq('id', equipment.id);

        // Log
        await logMovement({
          organizationId:    orgId,
          equipmentId:       equipment.id,
          equipmentName:     equipment.name,
          actionType:        fromRoomId ? MOVE_ACTION.MOVED : MOVE_ACTION.ASSIGNED,
          fromRoomId,
          fromRoomName,
          toRoomId:          room.id,
          toRoomName:        room.name,
          toProjectId:       projectId,
          performedByUserId: userId,
          assignmentId:      newAssign.id,
          notes:             actionNotes || null,
          previousStatus:    equipment.status,
          newStatus:         'deployed',
          scanMethod:        'qr_scan',
        });

        onDone?.({ action, equipment, assignment: newAssign });

      } else if (action === 'remove') {
        if (!assignment) throw new Error('No assignment to remove');
        const fromRoomName = allRooms.find(r => r.id === assignment.room_id)?.name || assignment.room_id;
        await removeAssignment(assignment.id, {
          equipmentId:   equipment.id,
          equipmentName: equipment.name,
          organizationId: orgId,
          fromRoomId:    assignment.room_id,
          fromRoomName,
          projectId,
          notes:         actionNotes || null,
          userId,
        });
        onDone?.({ action: 'remove', equipment, assignment });

      } else if (action === 'transit') {
        const fromRoomName = allRooms.find(r => r.id === assignment?.room_id)?.name || null;
        await markInTransit(equipment.id, {
          organizationId: orgId,
          equipmentName:  equipment.name,
          fromRoomId:     assignment?.room_id || null,
          fromRoomName,
          projectId,
          notes:          actionNotes || null,
          userId,
        });
        onDone?.({ action: 'transit', equipment });

      } else if (action === 'move_to_room') {
        // targetRoom must be set
        if (!targetRoom) throw new Error('No target room selected');
        const fromRoomId   = assignment?.room_id || null;
        const fromRoomName = allRooms.find(r => r.id === fromRoomId)?.name || fromRoomId;
        const newAssign = await moveEquipmentToRoom(assignment?.id, {
          equipmentId:   equipment.id,
          equipmentName: equipment.name,
          organizationId: orgId,
          fromRoomId,
          fromRoomName,
          toRoomId:      targetRoom.id,
          toRoomName:    targetRoom.name,
          projectId,
          notes:         actionNotes || null,
          userId,
        });
        onDone?.({ action: 'moved', equipment, assignment: newAssign, targetRoom });
      }

      setPhase(PHASE.SAVED);

    } catch (err) {
      console.error('[QrActionModal] action error:', err);
      setSaveErr(err.message || 'Something went wrong.');
      setPhase(PHASE.CONFIRM);
    }
  }, [assignment, equipment, room, targetRoom, orgId, projectId, userId, allRooms, actionNotes, onDone]);

  // ── Scan again ─────────────────────────────────────────────────────────────
  const scanAgain = useCallback(async () => {
    setPhase(PHASE.SCANNING);
    setEquipment(null);
    setAssignment(null);
    setTargetRoom(null);
    setActionNotes('');
    setPendingAction(null);
    setSaveErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCamStatus('scanning');
    } catch (_) {
      setCamStatus('error');
    }
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function EqCard({ eq }) {
    return (
      <div style={CARD}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {eq.photo_url
            ? <img src={eq.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--surface2,#2a2a2a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📦</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1,#fff)' }}>{eq.name}</div>
            {eq.unique_code && <div style={{ fontSize: 12, color: 'var(--text3,#888)', marginTop: 2 }}>#{eq.unique_code}</div>}
            {(eq.equipment_types?.name || eq.equipment_categories?.name) && (
              <div style={{ fontSize: 12, color: 'var(--text3,#888)', marginTop: 2 }}>
                {[eq.equipment_types?.name, eq.equipment_categories?.name].filter(Boolean).join(' · ')}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={eq.status} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function StatusBadge({ status }) {
    const map = {
      available:      { bg: '#166534', text: '#bbf7d0', label: 'Available' },
      deployed:       { bg: '#1e40af', text: '#bfdbfe', label: 'Deployed' },
      in_maintenance: { bg: '#92400e', text: '#fde68a', label: 'In Maintenance' },
      out_of_service: { bg: '#7f1d1d', text: '#fecaca', label: 'Out of Service' },
      in_transit:     { bg: '#4a1d96', text: '#ddd6fe', label: 'In Transit' },
    };
    const s = map[status] || { bg: '#333', text: '#ccc', label: status || '—' };
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
        background: s.bg, color: s.text, letterSpacing: '.3px' }}>{s.label}</span>
    );
  }

  function ActionBtn({ onClick, children, variant = 'primary', disabled = false }) {
    const bg = variant === 'primary'   ? 'var(--accent, #2563eb)'
             : variant === 'danger'    ? '#dc2626'
             : variant === 'warning'   ? '#d97706'
             : 'var(--surface2, #333)';
    return (
      <button onClick={onClick} disabled={disabled} style={{
        width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none',
        background: bg, color: '#fff', fontWeight: 600, fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1,
        marginBottom: 8,
      }}>{children}</button>
    );
  }

  // ── Phase renderers ────────────────────────────────────────────────────────

  const renderScanning = () => (
    <>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <ScanFrame status={camStatus} />
        {camStatus === 'starting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontSize: 14, background: 'rgba(0,0,0,.5)' }}>
            Starting camera…
          </div>
        )}
        {camStatus === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#111', color: '#fff', gap: 8 }}>
            <div style={{ fontSize: 32 }}>📷</div>
            <div style={{ fontWeight: 600 }}>Camera not available</div>
            <div style={{ fontSize: 13, color: '#888', textAlign: 'center', maxWidth: 260 }}>
              Allow camera access and try again.
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,.85)', textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
          {mode === 'assign' ? `Scan to assign to ${room?.name || 'room'}` : 'Scan equipment QR code'}
        </div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Point camera at equipment QR label</div>
      </div>
    </>
  );

  const renderLookingUp = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: 32 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid transparent',
        borderTopColor: 'var(--accent,#2563eb)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ color: '#fff', fontWeight: 600 }}>Looking up equipment…</div>
    </div>
  );

  const renderNotFound = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 48 }}>❓</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 12 }}>Equipment Not Found</div>
        <div style={{ color: '#888', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          This QR code doesn't match any equipment in your organization.
        </div>
      </div>
      <ActionBtn onClick={scanAgain} variant="secondary">Scan Again</ActionBtn>
    </div>
  );

  const renderLockedOut = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginTop: 12 }}>Equipment Locked Out</div>
        {equipment && <EqCard eq={equipment} />}
        {equipment?.lockout_reason && (
          <div style={{ ...CARD, marginTop: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>LOCKOUT REASON</div>
            <div style={{ color: '#fecaca', fontSize: 14 }}>{equipment.lockout_reason}</div>
            {equipment.lockout_notes && <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{equipment.lockout_notes}</div>}
          </div>
        )}
        <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
          This equipment must be cleared by an admin before it can be assigned.
        </div>
      </div>
      <ActionBtn onClick={scanAgain} variant="secondary">Scan Different Equipment</ActionBtn>
    </div>
  );

  const renderAlreadyHere = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginTop: 8 }}>
          Already in {room?.name}
        </div>
      </div>
      {equipment && <EqCard eq={equipment} />}
      <div style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
        This equipment is already assigned to this room.
      </div>
      <ActionBtn onClick={scanAgain} variant="secondary">Scan Another</ActionBtn>
    </div>
  );

  const renderChooseAction = () => {
    const otherRoomName = allRooms.find(r => r.id === assignment?.room_id)?.name || assignment?.room_id || 'another room';
    const isAssigned    = !!assignment;

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: 0, overflowY: 'auto' }}>
        {equipment && <EqCard eq={equipment} />}

        {isAssigned && (
          <div style={{ ...CARD, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>CURRENTLY IN</div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>📍 {otherRoomName}</div>
          </div>
        )}

        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          {mode === 'assign' ? `What do you want to do?` : 'Choose an action:'}
        </div>

        {/* Assign to this room */}
        {mode === 'assign' && (
          <ActionBtn onClick={() => { setPendingAction('move_from_other'); setPhase(PHASE.CONFIRM); }}>
            📦 Assign to {room?.name} {isAssigned ? `(move from ${otherRoomName})` : ''}
          </ActionBtn>
        )}

        {/* Move to a different room (track mode) */}
        {mode === 'track' && isAssigned && (
          <>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Move to:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {allRooms.filter(r => r.id !== assignment?.room_id).map(r => (
                <button key={r.id} onClick={() => { setTargetRoom(r); setPendingAction('move_to_room'); setPhase(PHASE.CONFIRM); }}
                  style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border,#333)',
                    background: 'var(--surface2,#2a2a2a)', color: '#fff', textAlign: 'left',
                    cursor: 'pointer', fontSize: 14 }}>
                  🔄 Move to {r.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Remove from jobsite */}
        {isAssigned && (
          <ActionBtn onClick={() => { setPendingAction('remove'); setPhase(PHASE.CONFIRM); }} variant="danger">
            🚫 Remove from Jobsite
          </ActionBtn>
        )}

        {/* Mark in transit */}
        {isAssigned && (
          <ActionBtn onClick={() => { setPendingAction('transit'); setPhase(PHASE.CONFIRM); }} variant="warning">
            🚚 Mark In Transit
          </ActionBtn>
        )}

        <ActionBtn onClick={scanAgain} variant="secondary">↩ Scan Different</ActionBtn>
      </div>
    );
  };

  const renderConfirm = () => {
    const otherRoomName = allRooms.find(r => r.id === assignment?.room_id)?.name || assignment?.room_id;
    const actionLabel =
        pendingAction === 'assign'          ? `Assign to ${room?.name}`
      : pendingAction === 'move_from_other' ? `Move from ${otherRoomName} → ${room?.name}`
      : pendingAction === 'move_to_room'    ? `Move to ${targetRoom?.name}`
      : pendingAction === 'remove'          ? 'Remove from Jobsite'
      : pendingAction === 'transit'         ? 'Mark In Transit'
      : 'Confirm';

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: 0, overflowY: 'auto' }}>
        {equipment && <EqCard eq={equipment} />}

        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 10 }}>{actionLabel}</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6 }}>
            NOTES (optional)
          </label>
          <textarea
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder="Add any notes about this action…"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border,#444)',
              background: 'var(--surface2,#2a2a2a)', color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {saveErr && (
          <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8,
            padding: '10px 14px', color: '#fecaca', fontSize: 13, marginBottom: 12 }}>
            {saveErr}
          </div>
        )}

        <ActionBtn
          onClick={() => executeAction(pendingAction === 'move_from_other' ? 'assign' : pendingAction)}
          variant={pendingAction === 'remove' ? 'danger' : pendingAction === 'transit' ? 'warning' : 'primary'}
        >
          Confirm
        </ActionBtn>
        <ActionBtn onClick={() => setPhase(equipment ? PHASE.CHOOSE_ACTION : PHASE.SCANNING)} variant="secondary">
          Back
        </ActionBtn>
      </div>
    );
  };

  const renderSaving = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid transparent',
        borderTopColor: 'var(--accent,#2563eb)', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#fff', fontWeight: 600 }}>Saving…</div>
    </div>
  );

  const renderSaved = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: 32 }}>
      <div style={{ fontSize: 64 }}>✅</div>
      <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>Done!</div>
      {equipment && <div style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>{equipment.name}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
        <ActionBtn onClick={scanAgain}>Scan Another</ActionBtn>
        <ActionBtn onClick={onClose} variant="secondary">Close</ActionBtn>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={OVERLAY}>
      {/* Top bar */}
      <div style={TOP_BAR}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
          {mode === 'assign' ? '📷 Scan to Assign' : '📷 Equipment Scan'}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa',
          fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
      </div>

      {/* Phase content */}
      {phase === PHASE.SCANNING     && renderScanning()}
      {phase === PHASE.LOOKING_UP   && renderLookingUp()}
      {phase === PHASE.NOT_FOUND    && renderNotFound()}
      {phase === PHASE.LOCKED_OUT   && renderLockedOut()}
      {phase === PHASE.ALREADY_HERE && renderAlreadyHere()}
      {phase === PHASE.CHOOSE_ACTION && renderChooseAction()}
      {phase === PHASE.CONFIRM      && renderConfirm()}
      {phase === PHASE.SAVING       && renderSaving()}
      {phase === PHASE.SAVED        && renderSaved()}
    </div>
  );
}
