/**
 * src/lib/equipment.js
 * Supabase CRUD helpers for the Equipment system.
 * All queries are org-scoped via RLS.
 */
import { supabase } from './supabase';

// ── Shape helpers ─────────────────────────────────────────────────────────────

function eqFromRow(r) {
  return {
    id:                     r.id,
    organizationId:         r.organization_id,
    name:                   r.name             || '',
    uniqueCode:             r.unique_code       || '',
    typeId:                 r.type_id           || null,
    categoryId:             r.category_id       || null,
    photoUrl:               r.photo_url         || null,
    serialNumber:           r.serial_number     || '',
    manufacturer:           r.manufacturer      || '',
    model:                  r.model             || '',
    purchaseDate:           r.purchase_date     || null,
    manufactureDate:        r.manufacture_date  || null,
    warrantyStartDate:      r.warranty_start_date || null,
    warrantyTermMonths:     r.warranty_term_months ?? null,
    warrantyExpiry:         r.warranty_expiry   || null,
    status:                 r.status            || 'available',
    condition:              r.condition         || null,
    currentLocation:        r.current_location  || 'shop',
    notes:                  r.notes             || '',
    active:                 r.active            ?? true,
    isLockedOut:            r.is_locked_out     ?? false,
    lockoutReason:          r.lockout_reason    || null,
    lockoutNotes:           r.lockout_notes     || null,
    lockoutCreatedByUserId: r.lockout_created_by_user_id || null,
    lockoutCreatedAt:       r.lockout_created_at || null,
    createdByUserId:        r.created_by_user_id || null,
    updatedByUserId:        r.updated_by_user_id || null,
    createdAt:              r.created_at        || '',
    updatedAt:              r.updated_at        || '',
    qrCodeId:               r.qr_code_id        || null,
    // joined data (optional)
    typeName:               r.equipment_types?.name || null,
    categoryName:           r.equipment_categories?.name || null,
  };
}

function eqToRow(e) {
  return {
    organization_id:            e.organizationId,
    name:                       e.name,
    unique_code:                e.uniqueCode,
    type_id:                    e.typeId           || null,
    category_id:                e.categoryId       || null,
    photo_url:                  e.photoUrl         || null,
    serial_number:              e.serialNumber     || null,
    manufacturer:               e.manufacturer     || null,
    model:                      e.model            || null,
    purchase_date:              e.purchaseDate     || null,
    manufacture_date:           e.manufactureDate  || null,
    warranty_start_date:        e.warrantyStartDate || null,
    warranty_term_months:       e.warrantyTermMonths ?? null,
    warranty_expiry:            e.warrantyExpiry   || null,
    status:                     e.status           || 'available',
    condition:                  e.condition        || null,
    current_location:           e.currentLocation  || 'shop',
    notes:                      e.notes            || null,
    active:                     e.active           ?? true,
    is_locked_out:              e.isLockedOut      ?? false,
    lockout_reason:             e.lockoutReason    || null,
    lockout_notes:              e.lockoutNotes     || null,
    lockout_created_by_user_id: e.lockoutCreatedByUserId || null,
    lockout_created_at:         e.lockoutCreatedAt || null,
    updated_by_user_id:         e.updatedByUserId  || null,
  };
}

// ── Equipment CRUD ────────────────────────────────────────────────────────────

export async function getEquipment() {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, equipment_types(name), equipment_categories(name)')
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(eqFromRow);
}

export async function createEquipment(eq, userId) {
  const row = { ...eqToRow(eq), created_by_user_id: userId || null };
  const { data, error } = await supabase
    .from('equipment')
    .insert([row])
    .select('*, equipment_types(name), equipment_categories(name)')
    .single();
  if (error) throw error;
  return eqFromRow(data);
}

export async function updateEquipment(id, eq, userId) {
  const row = { ...eqToRow(eq), updated_by_user_id: userId || null };
  delete row.organization_id;
  delete row.created_by_user_id;
  const { data, error } = await supabase
    .from('equipment')
    .update(row)
    .eq('id', id)
    .select('*, equipment_types(name), equipment_categories(name)')
    .single();
  if (error) throw error;
  return eqFromRow(data);
}

export async function archiveEquipment(id, userId) {
  const { data, error } = await supabase
    .from('equipment')
    .update({ active: false, updated_by_user_id: userId || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return eqFromRow(data);
}

// ── Lockout ───────────────────────────────────────────────────────────────────

export async function lockoutEquipment(id, { reason, notes }, userId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('equipment')
    .update({
      is_locked_out: true,
      lockout_reason: reason || null,
      lockout_notes: notes || null,
      lockout_created_by_user_id: userId || null,
      lockout_created_at: now,
      status: 'out_of_service',
      updated_by_user_id: userId || null,
    })
    .eq('id', id)
    .select('*, equipment_types(name), equipment_categories(name)')
    .single();
  if (error) throw error;
  await logEquipmentActivity(id, data.organization_id, userId, 'lockout_applied', `Locked out: ${reason || 'No reason given'}`);
  return eqFromRow(data);
}

export async function clearLockout(id, userId) {
  const { data, error } = await supabase
    .from('equipment')
    .update({
      is_locked_out: false,
      lockout_reason: null,
      lockout_notes: null,
      lockout_created_by_user_id: null,
      lockout_created_at: null,
      status: 'available',
      updated_by_user_id: userId || null,
    })
    .eq('id', id)
    .select('*, equipment_types(name), equipment_categories(name)')
    .single();
  if (error) throw error;
  await logEquipmentActivity(id, data.organization_id, userId, 'lockout_cleared', 'Lockout cleared');
  return eqFromRow(data);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export async function getEquipmentTypes() {
  const { data, error } = await supabase
    .from('equipment_types')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createEquipmentType(orgId, name) {
  const { data, error } = await supabase
    .from('equipment_types')
    .insert([{ organization_id: orgId, name }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipmentType(id, name) {
  const { data, error } = await supabase
    .from('equipment_types')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveEquipmentType(id, archived) {
  const { data, error } = await supabase
    .from('equipment_types')
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getEquipmentCategories() {
  const { data, error } = await supabase
    .from('equipment_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createEquipmentCategory(orgId, name) {
  const { data, error } = await supabase
    .from('equipment_categories')
    .insert([{ organization_id: orgId, name }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipmentCategory(id, name) {
  const { data, error } = await supabase
    .from('equipment_categories')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveEquipmentCategory(id, archived) {
  const { data, error } = await supabase
    .from('equipment_categories')
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Maintenance Records ───────────────────────────────────────────────────────

export async function getMaintenanceRecords(equipmentId) {
  const { data, error } = await supabase
    .from('equipment_maintenance_records')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('performed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createMaintenanceRecord(record) {
  const { data, error } = await supabase
    .from('equipment_maintenance_records')
    .insert([record])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaintenanceRecord(id, record) {
  const { data, error } = await supabase
    .from('equipment_maintenance_records')
    .update({ ...record, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaintenanceRecord(id) {
  const { error } = await supabase
    .from('equipment_maintenance_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Deployments ───────────────────────────────────────────────────────────────

export async function getDeployments(equipmentId = null, projectId = null) {
  let query = supabase
    .from('equipment_deployments')
    .select('*, equipment(name, unique_code, photo_url, status, equipment_types(name), equipment_categories(name)), projects(title)')
    .order('start_at', { ascending: false });
  if (equipmentId) query = query.eq('equipment_id', equipmentId);
  if (projectId)   query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getActiveDeployments(projectId) {
  const { data, error } = await supabase
    .from('equipment_deployments')
    .select('*, equipment(id, name, unique_code, photo_url, status, condition, is_locked_out, equipment_types(name), equipment_categories(name))')
    .eq('project_id', projectId)
    .in('status', ['scheduled', 'deployed'])
    .order('start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createDeployment(dep, userId) {
  const row = {
    organization_id:    dep.organizationId,
    equipment_id:       dep.equipmentId,
    project_id:         dep.projectId,
    status:             dep.status || 'scheduled',
    start_at:           dep.startAt,
    expected_return_at: dep.expectedReturnAt || null,
    notes:              dep.notes || null,
    booked_by_user_id:  userId || null,
  };
  const { data, error } = await supabase
    .from('equipment_deployments')
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function returnEquipment(deploymentId, { returnLocation, condition, notes }, equipmentId, userId) {
  const now = new Date().toISOString();
  // Update deployment
  const { data: dep, error: depErr } = await supabase
    .from('equipment_deployments')
    .update({
      status:              'returned',
      actual_return_at:    now,
      returned_by_user_id: userId || null,
      updated_at:          now,
    })
    .eq('id', deploymentId)
    .select()
    .single();
  if (depErr) throw depErr;

  // Update equipment status + location
  const newStatus = condition === 'damaged' ? 'in_maintenance' : 'available';
  const { data: eq, error: eqErr } = await supabase
    .from('equipment')
    .update({
      status:              newStatus,
      current_location:    returnLocation || 'shop',
      condition:           condition || null,
      updated_by_user_id:  userId || null,
      updated_at:          now,
    })
    .eq('id', equipmentId)
    .select('*, equipment_types(name), equipment_categories(name)')
    .single();
  if (eqErr) throw eqErr;

  await logEquipmentActivity(equipmentId, dep.organization_id, userId, 'returned', `Returned from project`);
  return { deployment: dep, equipment: eqFromRow(eq) };
}

export async function updateDeployment(id, updates) {
  const { data, error } = await supabase
    .from('equipment_deployments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export async function getEquipmentActivity(equipmentId) {
  const { data, error } = await supabase
    .from('equipment_activity_logs')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function logEquipmentActivity(equipmentId, orgId, userId, actionType, actionLabel, metadata = null) {
  try {
    await supabase.from('equipment_activity_logs').insert([{
      equipment_id:    equipmentId,
      organization_id: orgId,
      user_id:         userId || null,
      action_type:     actionType,
      action_label:    actionLabel,
      metadata_json:   metadata,
    }]);
  } catch(e) {
    console.warn('[equipment] Activity log failed:', e.message);
  }
}

// ── Bulk actions ──────────────────────────────────────────────────────────────

export async function bulkArchiveEquipment(ids, userId) {
  const { error } = await supabase
    .from('equipment')
    .update({ active: false, updated_by_user_id: userId || null })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkUpdateStatus(ids, status, userId) {
  const { error } = await supabase
    .from('equipment')
    .update({ status, updated_by_user_id: userId || null })
    .in('id', ids);
  if (error) throw error;
}
