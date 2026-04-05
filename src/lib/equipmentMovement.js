/**
 * src/lib/equipmentMovement.js
 * Helpers for logging and querying equipment movement history.
 * All writes are org-scoped via RLS.
 */
import { supabase } from './supabase';

// ── Action type constants ─────────────────────────────────────────────────────
export const MOVE_ACTION = {
  ASSIGNED:              'assigned',
  MOVED:                 'moved',
  REMOVED:               'removed',
  RETURNED_TO_INVENTORY: 'returned_to_inventory',
  MARKED_IN_TRANSIT:     'marked_in_transit',
  ARRIVED:               'arrived',
  LOCKOUT_APPLIED:       'lockout_applied',
  LOCKOUT_CLEARED:       'lockout_cleared',
  STATUS_CHANGED:        'status_changed',
  NOTES_UPDATED:         'notes_updated',
};

export const ACTION_LABELS = {
  assigned:              'Assigned to room',
  moved:                 'Moved to room',
  removed:               'Removed from room',
  returned_to_inventory: 'Returned to inventory',
  marked_in_transit:     'Marked in transit',
  arrived:               'Marked as arrived',
  lockout_applied:       'Lockout applied',
  lockout_cleared:       'Lockout cleared',
  status_changed:        'Status changed',
  notes_updated:         'Notes updated',
};

export const ACTION_ICONS = {
  assigned:              '📦',
  moved:                 '🔄',
  removed:               '🚫',
  returned_to_inventory: '🏠',
  marked_in_transit:     '🚚',
  arrived:               '✅',
  lockout_applied:       '🔒',
  lockout_cleared:       '🔓',
  status_changed:        '⚙️',
  notes_updated:         '📝',
};

// ── Log a movement event ──────────────────────────────────────────────────────
/**
 * logMovement(params) — insert one row into equipment_movement_log.
 *
 * @param {object} p
 * @param {string}  p.organizationId
 * @param {string}  p.equipmentId
 * @param {string}  [p.equipmentName]
 * @param {string}  p.actionType         — one of MOVE_ACTION.*
 * @param {string}  [p.fromRoomId]
 * @param {string}  [p.fromRoomName]
 * @param {string}  [p.fromProjectId]
 * @param {string}  [p.fromProjectName]
 * @param {string}  [p.toRoomId]
 * @param {string}  [p.toRoomName]
 * @param {string}  [p.toProjectId]
 * @param {string}  [p.toProjectName]
 * @param {string}  [p.performedByUserId]
 * @param {string}  [p.assignmentId]
 * @param {string}  [p.notes]
 * @param {string}  [p.previousStatus]
 * @param {string}  [p.newStatus]
 * @param {string}  [p.scanMethod]       — 'qr_scan' | 'manual'
 * @param {object}  [p.metadata]
 */
export async function logMovement(p) {
  try {
    const { error } = await supabase.from('equipment_movement_log').insert([{
      organization_id:      p.organizationId,
      equipment_id:         p.equipmentId,
      equipment_name:       p.equipmentName       || null,
      action_type:          p.actionType,
      from_room_id:         p.fromRoomId          || null,
      from_room_name:       p.fromRoomName        || null,
      from_project_id:      p.fromProjectId       || null,
      from_project_name:    p.fromProjectName     || null,
      to_room_id:           p.toRoomId            || null,
      to_room_name:         p.toRoomName          || null,
      to_project_id:        p.toProjectId         || null,
      to_project_name:      p.toProjectName       || null,
      performed_by_user_id: p.performedByUserId   || null,
      assignment_id:        p.assignmentId        || null,
      notes:                p.notes               || null,
      previous_status:      p.previousStatus      || null,
      new_status:           p.newStatus           || null,
      scan_method:          p.scanMethod          || null,
      metadata_json:        p.metadata            || null,
    }]);
    if (error) console.warn('[movement] Log failed:', error.message);
  } catch (e) {
    console.warn('[movement] Log error:', e.message);
  }
}

// ── Fetch movement history for one equipment unit ─────────────────────────────
/**
 * Returns up to `limit` most-recent entries for the given equipment_id.
 */
export async function getMovementHistory(equipmentId, limit = 100) {
  const { data, error } = await supabase
    .from('equipment_movement_log')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Remove an assignment (with optional movement log) ─────────────────────────
/**
 * Marks a room_equipment_assignments row as removed.
 * Also updates equipment status back to 'available' and logs the removal.
 */
export async function removeAssignment(assignmentId, {
  equipmentId, equipmentName,
  organizationId,
  fromRoomId, fromRoomName,
  projectId, projectName,
  reason, notes,
  userId,
}) {
  const now = new Date().toISOString();

  // 1. Mark assignment removed
  const { error: aErr } = await supabase
    .from('room_equipment_assignments')
    .update({
      removed_at:           now,
      removed_by_user_id:   userId || null,
      removal_reason:       reason || null,
      updated_at:           now,
    })
    .eq('id', assignmentId);
  if (aErr) throw aErr;

  // 2. Update equipment status → available
  const { error: eErr } = await supabase
    .from('equipment')
    .update({
      status:               'available',
      current_location:     'shop',
      updated_by_user_id:   userId || null,
      updated_at:           now,
    })
    .eq('id', equipmentId);
  if (eErr) throw eErr;

  // 3. Log it
  await logMovement({
    organizationId,
    equipmentId,
    equipmentName,
    actionType:         MOVE_ACTION.REMOVED,
    fromRoomId,
    fromRoomName,
    fromProjectId:      projectId,
    fromProjectName:    projectName,
    performedByUserId:  userId,
    assignmentId,
    notes,
    previousStatus:     'deployed',
    newStatus:          'available',
    scanMethod:         'manual',
  });
}

// ── Move equipment to a different room (within the same project) ──────────────
/**
 * Removes old assignment, creates new one, updates equipment record, logs move.
 */
export async function moveEquipmentToRoom(oldAssignmentId, {
  equipmentId, equipmentName,
  organizationId,
  fromRoomId, fromRoomName,
  toRoomId, toRoomName,
  projectId, projectName,
  notes,
  userId,
}) {
  const now = new Date().toISOString();

  // 1. Mark old assignment removed
  const { error: aErr } = await supabase
    .from('room_equipment_assignments')
    .update({
      removed_at:         now,
      removed_by_user_id: userId || null,
      removal_reason:     'moved_to_room',
      updated_at:         now,
    })
    .eq('id', oldAssignmentId);
  if (aErr) throw aErr;

  // 2. Create new assignment
  const { data: newAssign, error: nErr } = await supabase
    .from('room_equipment_assignments')
    .insert([{
      organization_id:    organizationId,
      project_id:         projectId,
      room_id:            toRoomId,
      equipment_id:       equipmentId,
      placed_at:          now,
      placed_by_user_id:  userId || null,
      assigned_via:       'manual',
      notes:              notes || null,
    }])
    .select()
    .single();
  if (nErr) throw nErr;

  // 3. Update equipment current_location (use room name)
  const { error: eErr } = await supabase
    .from('equipment')
    .update({
      current_location:   toRoomName || 'jobsite',
      updated_by_user_id: userId || null,
      updated_at:         now,
    })
    .eq('id', equipmentId);
  if (eErr) throw eErr;

  // 4. Log the move
  await logMovement({
    organizationId,
    equipmentId,
    equipmentName,
    actionType:         MOVE_ACTION.MOVED,
    fromRoomId,
    fromRoomName,
    fromProjectId:      projectId,
    fromProjectName:    projectName,
    toRoomId,
    toRoomName,
    toProjectId:        projectId,
    toProjectName:      projectName,
    performedByUserId:  userId,
    assignmentId:       newAssign.id,
    notes,
    previousStatus:     'deployed',
    newStatus:          'deployed',
    scanMethod:         'manual',
  });

  return newAssign;
}

// ── Mark equipment in transit ─────────────────────────────────────────────────
export async function markInTransit(equipmentId, {
  organizationId, equipmentName,
  fromRoomId, fromRoomName,
  projectId, projectName,
  notes, userId,
}) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('equipment')
    .update({
      status:              'in_transit',
      current_location:    'in_transit',
      updated_by_user_id:  userId || null,
      updated_at:          now,
    })
    .eq('id', equipmentId);
  if (error) throw error;

  await logMovement({
    organizationId,
    equipmentId,
    equipmentName,
    actionType:        MOVE_ACTION.MARKED_IN_TRANSIT,
    fromRoomId,
    fromRoomName,
    fromProjectId:     projectId,
    fromProjectName:   projectName,
    performedByUserId: userId,
    notes,
    previousStatus:    'deployed',
    newStatus:         'in_transit',
    scanMethod:        'manual',
  });
}
